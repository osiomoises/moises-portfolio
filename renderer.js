/* renderer.js — Pure rendering functions. Return HTML strings; no DOM side-effects. */

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/* SVG icons for sidebar contact items */
const CONTACT_ICONS = {
  location: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
  email:    `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 7l10 7 10-7"/></svg>`,
  linkedin: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="4"/><path d="M8 11v5M8 8v.01M12 16v-5M12 11a3 3 0 0 1 6 0v5"/></svg>`,
};

const Renderer = {

  /* ── Homepage ──────────────────────────────────────────────────────────── */

  avatar(src) {
    return src ? `<img class="avatar__img" src="${esc(src)}" alt="">` : '';
  },

  tags(tags) {
    return tags.map(t => `<span class="tag">${esc(t)}</span>`).join('');
  },

  contact(items) {
    return items.map(item => {
      if (item.type === 'location') {
        return `<span class="contact-item">${CONTACT_ICONS.location}${esc(item.text)}</span>`;
      }
      if (item.type === 'email') {
        return `<a href="mailto:${esc(item.value)}" class="contact-item">${CONTACT_ICONS.email}${esc(item.value)}</a>`;
      }
      if (item.type === 'linkedin') {
        return `<a href="https://linkedin.com/in/${esc(item.handle)}" target="_blank" rel="noopener" class="contact-item">${CONTACT_ICONS.linkedin}LinkedIn</a>`;
      }
      return '';
    }).join('');
  },

  /* ── Career timeline (About tab) ─────────────────────────────────────────
     Everything is derived from about.timeline in portfolio.json: dates are
     "YYYY-MM" strings (end may be "present"), converted to month indices so
     bar offsets/widths are percentages of the axis span — no pixel values.
     An entry with `positions` (e.g. two consecutive roles at one company)
     renders as one bar spanning its earliest start → latest end. */
  timeline(tl, now = new Date()) {
    if (!tl) return '';
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const nowIdx = now.getFullYear() * 12 + now.getMonth();
    const toIdx = (v, isEnd) => {
      if (isEnd && String(v).toLowerCase() === 'present') return nowIdx;
      const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(v || '');
      return m ? +m[1] * 12 + (+m[2] - 1) : null;
    };
    const fmt = (v, isEnd) => {
      if (isEnd && String(v).toLowerCase() === 'present') return 'Present';
      const i = toIdx(v);
      return i === null ? '' : `${MONTHS[i % 12]} ${Math.floor(i / 12)}`;
    };
    const range = (start, end) => `${fmt(start)} – ${fmt(end, true)}`;
    const safeColor = c => (/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(c || '') ? c : '#9ca3af');

    const disciplines = tl.disciplines || [];
    const discById = id => disciplines.find(d => d.id === id) || { label: '', color: '' };

    // Resolve each entry's span (from its positions, if any) and drop invalid ones.
    const rows = (tl.entries || []).map(e => {
      const parts = (e.positions && e.positions.length) ? e.positions : [e];
      const spans = parts.map(p => ({ p, s: toIdx(p.start), e: toIdx(p.end, true) }))
                         .filter(x => x.s !== null && x.e !== null && x.e >= x.s);
      if (!spans.length) return null;
      const first = spans.reduce((a, b) => (b.s < a.s ? b : a));
      const last  = spans.reduce((a, b) => (b.e > a.e ? b : a));
      return { e, s: first.s, end: last.e, startVal: first.p.start, endVal: last.p.end };
    }).filter(Boolean);

    if (tl.order !== 'manual') rows.sort((a, b) => (b.s - a.s) || (b.end - a.end));

    let chart = '';
    if (rows.length) {
      const minYear = Math.floor(Math.min(...rows.map(r => r.s)) / 12);
      const axisStart = minYear * 12;
      const axisEnd = Math.max(...rows.map(r => r.end), axisStart + 12);
      const span = axisEnd - axisStart;
      const pct = i => (((i - axisStart) / span) * 100).toFixed(3) + '%';

      // Tick density from the year span; CSS thins to every other tick when narrow.
      const years = span / 12;
      const step = years <= 8 ? 1 : years <= 18 ? 2 : 5;
      const ticks = [];
      for (let y = minYear, n = 0; y * 12 <= axisEnd; y += step, n++) {
        ticks.push({ y, pos: pct(y * 12), sparse: n % 2 === 0 });
      }
      const tickCls = t => (t.sparse ? ' tl-tick--sparse' : '');

      const items = rows.map(({ e, s, end, startVal, endVal }, idx) => {
        const d = discById(e.discipline);
        const color = safeColor(d.color);
        const dates = range(startVal, endVal);
        // Tooltip content comes from the same entry fields — nothing is stored twice.
        const tipId = `tl-tip-${idx}`;
        const meta = d.label ? `${d.label} · ${dates}` : dates;
        const positions = (e.positions || []).length > 1
          ? `<ul class="tl-sr">${e.positions.map(p =>
              `<li>${esc(p.role || '')}, ${esc(range(p.start, p.end))}</li>`).join('')}</ul>`
          : '';
        return `<li class="tl-row" style="--tl-color: ${color};">
  <div class="tl-row__text">
    <p class="tl-row__company">${esc(e.company || '')}</p>
    <p class="tl-row__role">${esc(e.role || '')}</p>
    <p class="tl-row__meta"><span>${esc(dates)}</span>${d.label ? `<span class="tl-row__discipline"><span class="tl-row__sep" aria-hidden="true"> · </span>${esc(d.label)}</span>` : ''}</p>
    ${positions}
    ${e.description ? `<p class="tl-row__desc">${esc(e.description)}</p>` : ''}
  </div>
  <div class="tl-row__track">
    <div class="tl-row__plot">
      <button type="button" class="tl-bar" style="left: ${pct(s)}; width: ${(((end - s) / span) * 100).toFixed(3)}%;" data-tip="${tipId}" aria-label="${esc([e.company, e.role].filter(Boolean).join(', '))}" aria-describedby="${tipId}-meta${e.description ? ` ${tipId}-desc` : ''}"></button>
      <div class="tl-tip-content" id="${tipId}" hidden>
        <p class="tl-tip__meta" id="${tipId}-meta">${esc(meta)}</p>
        <p class="tl-tip__role">${esc(e.role || '')}</p>
        <p class="tl-tip__company">${esc(e.company || '')}</p>
        ${e.description ? `<p class="tl-tip__desc" id="${tipId}-desc">${esc(e.description)}</p>` : ''}
      </div>
    </div>
  </div>
</li>`;
      }).join('\n');

      chart = `<div class="tl-chart">
  <div class="tl-axis" aria-hidden="true"><div class="tl-axis__plot">${ticks.map(t =>
    `<span class="tl-tick${tickCls(t)}" style="left: ${t.pos};">${t.y}</span>`).join('')}</div></div>
  <div class="tl-guides" aria-hidden="true">${ticks.map(t =>
    `<span class="tl-guide${tickCls(t)}" style="left: ${t.pos};"></span>`).join('')}</div>
  <ol class="tl-list">
${items}
  </ol>
</div>`;
    }

    const m = tl.mentoring;
    const mentoring = m && (m.organization || m.role)
      ? `<div class="tl-mentoring">
  <h4 class="tl-mentoring__heading">${esc(m.heading || 'Mentoring')}</h4>
  <p class="tl-row__role">${[m.organization, m.role].filter(Boolean).map(esc).join(' · ')}</p>
  ${m.start ? `<p class="tl-row__meta">${esc(range(m.start, m.end))}</p>` : ''}
</div>`
      : '';

    const legend = disciplines.length
      ? `<ul class="tl-legend" aria-label="Legend">${disciplines.map(d =>
          `<li><span class="tl-legend__dot" style="background: ${safeColor(d.color)};" aria-hidden="true"></span>${esc(d.label || '')}</li>`).join('')}</ul>`
      : '';

    return `<h3 class="timeline__heading" id="timeline-heading">${esc(tl.heading || '')}</h3>
${tl.subtitle ? `<p class="timeline__subtitle">${esc(tl.subtitle)}</p>` : ''}
${legend}
${chart}
${mentoring}`;
  },

  projectCard(p) {
    const draftBadge = p.status === 'draft'
      ? `<span class="project-card__draft-badge">Draft</span>`
      : '';
    const imgInner = p.image
      ? `<img src="${esc(p.image)}" alt="${esc(p.title)}" loading="lazy">`
      : '';
    const hoverStyle = p.hoverColor ? ` style="--hover-bg: ${esc(p.hoverColor)};"` : '';
    return `<a class="project-card" href="${esc(p.url)}"${hoverStyle}>
  ${draftBadge}
  <div class="project-card__image">${imgInner}</div>
  <div class="project-card__hover-bg" aria-hidden="true"></div>
  <div class="project-card__body">
    <p class="project-card__title">${esc(p.title)}</p>
    <p class="project-card__subtitle">${esc(p.subtitle)}</p>
    <span class="project-card__link">Read Case Study &nbsp;&#8594;</span>
  </div>
</a>`;
  },

  /* meta = { date, readMins }, both optional — either can be left out
     (e.g. a fetch failure or a missing publishedAt) and the row degrades
     gracefully: an empty meta renders no row at all, never "undefined",
     "NaN", or a lone "·". */
  article(pub, meta) {
    const metaParts = [];
    if (meta?.date) metaParts.push(esc(meta.date));
    if (meta?.readMins) metaParts.push(`${esc(meta.readMins)} min read`);
    const metaRow = metaParts.length
      ? `<p class="article__meta">${metaParts.join(' &middot; ')}</p>`
      : '';

    return `<a class="article" href="${esc(pub.url)}">
  <div class="article__image">
    <div class="article__image-bg">${pub.image ? `<img src="${esc(pub.image)}" alt="${esc(pub.title)}" loading="lazy">` : ''}</div>
  </div>
  <div class="article__body">
    <p class="article__title">${esc(pub.title)}</p>
    ${metaRow}
    <p class="article__excerpt">${esc(pub.excerpt)}</p>
    <span class="article__link">Read article <span>&#8594;</span></span>
  </div>
</a>`;
  },

  /* ── Case study ──────────────────────────────────────────────────────────── */

  metaItems(items) {
    return items.map(item => `<div class="cs-meta-item">
  <span class="label">${esc(item.label)}</span>
  <p${item.accent ? ' class="accent"' : ''}>${esc(item.value)}</p>
</div>`).join('');
  },

  tocList(toc) {
    return toc.map(item => `<li><a href="#${esc(item.id)}">${esc(item.label)}</a></li>`).join('');
  },

  carousel(data) {
    const slides = data.slides.map(s => `<div class="cs-carousel__slide">
  <img src="${esc(s.src)}" alt="${esc(s.alt)}" loading="lazy">
</div>`).join('');

    const dots = data.slides.map((_, i) =>
      `<button class="cs-carousel__dot${i === 0 ? ' active' : ''}" aria-label="Slide ${i + 1}"></button>`
    ).join('');

    const sizeClass = data.size ? ` cs-carousel--${esc(data.size)}` : '';

    return `<div class="cs-carousel${sizeClass}" aria-label="${esc(data.label || '')}">
  <div class="cs-carousel__track-wrap">
    <div class="cs-carousel__track">
      ${slides}
    </div>
  </div>
  <div class="cs-carousel__controls">
    <div class="cs-carousel__dots">${dots}</div>
    <div class="cs-carousel__arrows">
      <button class="cs-carousel__btn" data-carousel-prev aria-label="Previous">&#8592;</button>
      <button class="cs-carousel__btn" data-carousel-next aria-label="Next">&#8594;</button>
    </div>
  </div>
</div>`;
  },

  metricsGrid(metrics) {
    const cards = metrics.map(m => `<div class="result-card">
  <div class="result-card__number">${esc(m.number)}</div>
  <p class="result-card__label">${esc(m.label)}</p>
</div>`).join('');
    return `<div class="results-grid">${cards}</div>`;
  },

  infoListCard(data) {
    const items = data.items.map(item => `<li>${esc(item)}</li>`).join('');
    return `<div class="cs-info-list-card">
  <h3 class="cs-info-list-card__title">${esc(data.title)}</h3>
  <ul>${items}</ul>
</div>`;
  },

  keyInsightsTable(data) {
    const titleHtml = data.title
      ? `<h3 class="cs-key-insights__title">${esc(data.title)}</h3>`
      : '';
    const rows = (data.items || []).map(item => `<div class="cs-key-insights__row">
  <p class="cs-key-insights__finding">${esc(item.finding)}</p>
  <span class="cs-key-insights__arrow" aria-hidden="true">&#8594;</span>
  <p class="cs-key-insights__insight">${esc(item.insight)}</p>
</div>`).join('');
    return `<div class="cs-key-insights">
  ${titleHtml}
  <div class="cs-key-insights__table" role="list" aria-label="${esc(data.title || 'Key insights')}">
    <div class="cs-key-insights__header">
      <span class="cs-key-insights__header-cell">Insight</span>
      <span class="cs-key-insights__header-cell" aria-hidden="true"></span>
      <span class="cs-key-insights__header-cell">Design Decision</span>
    </div>
    ${rows}
  </div>
</div>`;
  },

  personasGrid(personas) {
    const rows = personas.map(p => {
      const avatarInner = p.image
        ? `<img src="${esc(p.image)}" alt="${esc(p.role)}" loading="lazy">`
        : '';
      const quoteHtml = (p.quote || '').trim()
        ? `<p class="cs-personas-table__quote">&ldquo;${esc(p.quote)}&rdquo;</p>`
        : '';
      return `<div class="cs-personas-table__row">
  <div class="cs-personas-table__cell cs-personas-table__cell--user">
    <div class="cs-personas-table__avatar" aria-hidden="true">${avatarInner}</div>
    <h4 class="cs-personas-table__name">${esc(p.role)}</h4>
    ${quoteHtml}
  </div>
  <div class="cs-personas-table__cell cs-personas-table__cell--goal">
    <span class="cs-personas-table__mobile-label">Goal</span>
    <p class="cs-personas-table__goal">${esc(p.goal)}</p>
  </div>
  <div class="cs-personas-table__cell cs-personas-table__cell--challenge">
    <span class="cs-personas-table__mobile-label">Challenge</span>
    <p class="cs-personas-table__challenge">${esc(p.challenge)}</p>
  </div>
</div>`;
    }).join('');
    return `<div class="cs-personas-table">
  <div class="cs-personas-table__header">
    <span class="cs-personas-table__header-cell">User</span>
    <span class="cs-personas-table__header-cell">Goal</span>
    <span class="cs-personas-table__header-cell">Challenge</span>
  </div>
  ${rows}
</div>`;
  },

  block(b) {
    switch (b.type) {
      case 'paragraph':
        // "cs-paragraph" lets style.css preserve line breaks the author typed
        // in the editor textarea (white-space: pre-line) without affecting
        // callout/list text, which share the same raw-html rendering.
        return `<p class="cs-paragraph">${b.html}</p>`;

      case 'subheading':
        // b.text may contain inline <strong>/<em> from the editor's
        // formatting toolbar — same trust model as the paragraph/callout html fields.
        return `<h3>${b.text}</h3>`;

      case 'callout':
        return `<div class="cs-callout"><p>${b.html}</p></div>`;

      case 'list': {
        const tag = b.ordered ? 'ol' : 'ul';
        const items = b.items.map(item => `<li>${item.html}</li>`).join('');
        return `<${tag}>${items}</${tag}>`;
      }

      case 'image': {
        const modClass = b.size ? ` cs-hero-image--${esc(b.size)}` : '';
        const lbAttr = b.lightboxSrc
          ? ` data-lightbox-solo="${esc(b.lightboxSrc)}" data-lightbox-alt="${esc(b.alt || '')}" style="cursor: zoom-in;"`
          : '';
        return `<div class="cs-hero-image${modClass}"><img src="${esc(b.src)}" alt="${esc(b.alt || '')}" loading="lazy"${lbAttr}></div>`;
      }

      case 'carousel':
        return Renderer.carousel(b);

      case 'metrics':
        return Renderer.metricsGrid(b.items);

      case 'personas':
        return Renderer.personasGrid(b.items);

      case 'infoListCard':
        return Renderer.infoListCard(b);

      case 'keyInsightsTable':
        return Renderer.keyInsightsTable(b);

      default:
        return '';
    }
  },

  section(s) {
    const blocks = s.blocks.map(b => Renderer.block(b)).join('\n');
    return `<section id="${esc(s.id)}">
  <h2>${esc(s.heading)}</h2>
  ${blocks}
</section>`;
  },

  body(items) {
    return (items || []).map(item => {
      if (item.type === 'section')  return Renderer.section(item);
      if (item.type === 'carousel') return Renderer.carousel(item);
      return '';
    }).join('\n');
  },

  /* Publish date — shared by the article page's byline and the Publications
     list, so both show the identical label for the same publishedAt value.
     Returns '' for a missing/invalid date so callers can drop it cleanly. */
  formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(`${dateStr}T00:00:00`);
    if (isNaN(d)) return '';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },

  /* Reading time — shared by the article page's byline and the Publications
     list, so both compute the exact same value from the same body content.
     Word count is taken from the rendered body's plain text (what a reader
     actually sees, tags stripped), at 200wpm, rounded, minimum 1 minute. */
  readingTime(bodyItems) {
    const tmp = document.createElement('div');
    tmp.innerHTML = Renderer.body(bodyItems);
    const wordCount = (tmp.textContent.match(/\S+/g) || []).length;
    return Math.max(1, Math.round(wordCount / 200));
  },

  // label/linkText default to the case-study copy; article.html passes
  // 'Next article' / 'Read article' — same markup and design either way.
  nextProject(data, label = 'Next project', linkText = 'Read case study') {
    return `<div class="cs-next__text">
  <span class="label">${esc(label)}</span>
  <a href="${esc(data.url)}" class="cs-next__link">
    <h3>${data.titleHtml || esc(data.title || '')}</h3>
  </a>
  <a href="${esc(data.url)}" class="link-arrow" style="margin-top: var(--space-2); display: inline-flex">
    ${esc(linkText)} <span>&rarr;</span>
  </a>
</div>
<a href="${esc(data.url)}" class="cs-next__link">
  <div class="cs-next__image">
    <img src="${esc(data.image.src)}" alt="${esc(data.image.alt)}" loading="lazy">
  </div>
</a>`;
  },

};
