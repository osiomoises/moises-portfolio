/**
 * Local static file server + write API for the portfolio editor.
 * Serves files from the project root on localhost:3000.
 *
 * Extra endpoints (local only — not exposed on GitHub Pages):
 *   POST /api/save   { path, content }  — write a .json file inside data/
 *   POST /api/delete { path }           — delete a .json file inside data/
 *
 * Safety: both endpoints resolve the requested path and confirm it starts
 * with <root>/data/ and carries a .json extension before touching disk.
 * No writes outside data/ are possible through these endpoints.
 */
const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT = 3000;
const ROOT = __dirname;
const DATA   = path.join(ROOT, 'data');            // only directory writable via /api/save, /api/delete
const IMAGES = path.join(ROOT, 'assets', 'images'); // only directory writable via /api/upload-image

const MIME = {
  '.html':  'text/html; charset=utf-8',
  '.css':   'text/css',
  '.js':    'application/javascript',
  '.png':   'image/png',
  '.jpg':   'image/jpeg',
  '.jpeg':  'image/jpeg',
  '.gif':   'image/gif',
  '.svg':   'image/svg+xml',
  '.webp':  'image/webp',
  '.avif':  'image/avif',
  '.ico':   'image/x-icon',
  '.woff':  'font/woff',
  '.woff2': 'font/woff2',
  '.json':  'application/json',
};

const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'svg']);

/* ── Path validation ──────────────────────────────────────────────────────── */
function safeDataPath(rel) {
  if (typeof rel !== 'string' || rel.includes('\0')) return null;
  if (path.extname(rel).toLowerCase() !== '.json')  return null;
  const abs = path.resolve(ROOT, rel);
  // Must be strictly inside DATA — not DATA itself, no ../ escape
  return abs.startsWith(DATA + path.sep) ? abs : null;
}

// Lowercase alnum + hyphens only — used to build filenames, so it can never
// contain path separators or traversal sequences regardless of input.
function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Appends -2, -3, … until an unused filename in IMAGES is found.
function uniqueImageFilename(base, ext) {
  let name = `${base}.${ext}`;
  let n = 2;
  while (fs.existsSync(path.join(IMAGES, name))) {
    name = `${base}-${n}.${ext}`;
    n++;
  }
  return name;
}

/* ── Body parser ──────────────────────────────────────────────────────────── */
function readJSON(req, maxLen = 2_000_000) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.setEncoding('utf8');
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > maxLen) {
        req.destroy();                              // FIX 3: stop reading, free memory
        reject(new Error(`Payload too large (max ${Math.round(maxLen / 1_000_000)} MB)`));
      }
    });
    req.on('end', () => {
      try { resolve(JSON.parse(raw)); }
      catch { reject(new Error('Invalid JSON body')); }
    });
    req.on('error', reject);
  });
}

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

/* ── Atomic file write ────────────────────────────────────────────────────── */
// FIX 2: write to <file>.tmp then fs.rename — rename is atomic on the same
// filesystem, so a crash mid-write leaves the original file intact.
function writeAtomic(abs, content, cb) {
  const tmp = abs + '.tmp';
  fs.writeFile(tmp, content, 'utf8', err => {
    if (err) return cb(err);
    fs.rename(tmp, abs, renameErr => {
      if (renameErr) {
        fs.unlink(tmp, () => cb(renameErr));  // best-effort temp cleanup
      } else {
        cb(null);
      }
    });
  });
}

/* ── POST /api/save ───────────────────────────────────────────────────────── */
async function handleSave(req, res) {
  let body;
  try   { body = await readJSON(req); }
  catch (e) { return send(res, 400, { ok: false, error: e.message }); }

  const abs = safeDataPath(body.path);
  if (!abs)
    return send(res, 400, { ok: false, error: 'path must be a .json file inside data/' });

  if (typeof body.content !== 'string')
    return send(res, 400, { ok: false, error: 'content must be a string' });

  // Validate content is parseable JSON before touching disk
  try   { JSON.parse(body.content); }
  catch { return send(res, 400, { ok: false, error: 'content is not valid JSON' }); }

  // FIX 1: catch mkdirSync errors — return 500 instead of hanging the request
  try {
    fs.mkdirSync(path.dirname(abs), { recursive: true });
  } catch (e) {
    return send(res, 500, { ok: false, error: `Could not create directory: ${e.message}` });
  }

  writeAtomic(abs, body.content, err =>
    err ? send(res, 500, { ok: false, error: err.message })
        : send(res, 200, { ok: true })
  );
}

/* ── POST /api/delete ─────────────────────────────────────────────────────── */
async function handleDelete(req, res) {
  let body;
  try   { body = await readJSON(req); }
  catch (e) { return send(res, 400, { ok: false, error: e.message }); }

  const abs = safeDataPath(body.path);
  if (!abs)
    return send(res, 400, { ok: false, error: 'path must be a .json file inside data/' });

  fs.unlink(abs, err =>
    err && err.code !== 'ENOENT'
      ? send(res, 500, { ok: false, error: err.message })
      : send(res, 200, { ok: true })
  );
}

/* ── POST /api/upload-image ───────────────────────────────────────────────── */
// Body: { id, purpose, ext, dataBase64 }. Filename is always server-generated
// from slugify(id) + slugify(purpose) + ext, so id/purpose can never steer
// the write outside IMAGES.
async function handleUploadImage(req, res) {
  let body;
  try   { body = await readJSON(req, 15_000_000); }  // ~11 MB decoded, plenty for a web image
  catch (e) { return send(res, 400, { ok: false, error: e.message }); }

  const ext = String(body.ext || '').toLowerCase().replace(/^\./, '');
  if (!IMAGE_EXT.has(ext))
    return send(res, 400, { ok: false, error: `Unsupported image type: .${ext}` });

  if (typeof body.dataBase64 !== 'string' || !body.dataBase64)
    return send(res, 400, { ok: false, error: 'dataBase64 is required' });

  let buf;
  try   { buf = Buffer.from(body.dataBase64, 'base64'); }
  catch { return send(res, 400, { ok: false, error: 'dataBase64 is not valid base64' }); }

  if (buf.length === 0)
    return send(res, 400, { ok: false, error: 'Empty file' });

  const idSlug      = slugify(body.id) || 'image';
  const purposeSlug = slugify(body.purpose);
  const base = purposeSlug ? `${idSlug}-${purposeSlug}` : idSlug;

  try {
    fs.mkdirSync(IMAGES, { recursive: true });
  } catch (e) {
    return send(res, 500, { ok: false, error: `Could not create assets/images: ${e.message}` });
  }

  const filename = uniqueImageFilename(base, ext);
  const abs = path.join(IMAGES, filename);
  if (!abs.startsWith(IMAGES + path.sep))
    return send(res, 400, { ok: false, error: 'Invalid filename' });

  writeAtomic(abs, buf, err =>
    err ? send(res, 500, { ok: false, error: err.message })
        : send(res, 200, { ok: true, path: `assets/images/${filename}` })
  );
}

/* ── Static file server ───────────────────────────────────────────────────── */
http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/api/save')         return handleSave(req, res);
  if (req.method === 'POST' && req.url === '/api/delete')       return handleDelete(req, res);
  if (req.method === 'POST' && req.url === '/api/upload-image') return handleUploadImage(req, res);

  const urlPath  = req.url.split('?')[0];
  const filePath = path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath);

  // FIX 4: require ROOT + sep so a sibling directory sharing a name prefix
  // cannot be reached (e.g. /path/to/project-evil/ bypassing startsWith(/path/to/project))
  if (!filePath.startsWith(ROOT + path.sep)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(PORT, '127.0.0.1', () => {
  console.log(`Static server → http://localhost:${PORT}`);
  console.log(`Write API     → POST /api/save         (data/*.json only)`);
  console.log(`Delete API    → POST /api/delete       (data/*.json only)`);
  console.log(`Upload API    → POST /api/upload-image (assets/images/* only)`);
});
