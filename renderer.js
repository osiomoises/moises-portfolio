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
  location: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  email:    `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 7l10 7 10-7"/></svg>`,
  linkedin: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="4"/><path d="M8 11v5M8 8v.01M12 16v-5M12 11a3 3 0 0 1 6 0v5"/></svg>`,
};

const Renderer = {

  /* ── Homepage ──────────────────────────────────────────────────────────── */

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

  projectCard(p) {
    const draftBadge = p.status === 'draft'
      ? `<span class="project-card__draft-badge">Draft</span>`
      : '';
    const imgInner = p.image
      ? `<img src="${esc(p.image)}" alt="${esc(p.title)}" loading="lazy">`
      : '';
    return `<a class="project-card" href="${esc(p.url)}">
  ${draftBadge}
  <div class="project-card__image">${imgInner}</div>
  <div class="project-card__body">
    <p class="project-card__title">${esc(p.title)}</p>
    <p class="project-card__subtitle">${esc(p.subtitle)}</p>
    <span class="project-card__link">Read Case Study &nbsp;&#8594;</span>
  </div>
</a>`;
  },

  article(pub) {
    return `<a class="article" href="${esc(pub.url)}">
  <div class="article__body">
    <p class="article__title">${esc(pub.title)}</p>
    <p class="article__excerpt">${esc(pub.excerpt)}</p>
    <span class="article__link">Read article <span>&#8594;</span></span>
  </div>
  <div class="article__image">
    <div class="article__image-bg">${pub.image ? `<img src="${esc(pub.image)}" alt="${esc(pub.title)}" loading="lazy">` : ''}</div>
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

  block(b) {
    switch (b.type) {
      case 'paragraph':
        return `<p>${b.html}</p>`;

      case 'subheading':
        return `<h3>${esc(b.text)}</h3>`;

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
        return `<div class="cs-hero-image${modClass}"><img src="${esc(b.src)}" alt="${esc(b.alt || '')}"${lbAttr}></div>`;
      }

      case 'carousel':
        return Renderer.carousel(b);

      case 'metrics':
        return Renderer.metricsGrid(b.items);

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
    return items.map(item => {
      if (item.type === 'section')  return Renderer.section(item);
      if (item.type === 'carousel') return Renderer.carousel(item);
      return '';
    }).join('\n');
  },

  nextProject(data) {
    return `<div>
  <span class="label">Next project</span>
  <a href="${esc(data.url)}" class="cs-next__link">
    <h3>${data.titleHtml || esc(data.title || '')}</h3>
  </a>
  <a href="${esc(data.url)}" class="link-arrow" style="margin-top: var(--space-2); display: inline-flex">
    Read case study <span>&rarr;</span>
  </a>
</div>
<a href="${esc(data.url)}" class="cs-next__link">
  <div class="cs-next__image">
    <img src="${esc(data.image.src)}" alt="${esc(data.image.alt)}" loading="lazy">
  </div>
</a>`;
  },

};
