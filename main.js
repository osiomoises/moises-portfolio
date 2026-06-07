/* ============================================
   Navigation scroll effect
   ============================================ */
const nav = document.querySelector('.nav');
if (nav) {
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 20);
  }, { passive: true });
}

/* ============================================
   Scroll-triggered fade-ins
   ============================================ */
const fadeEls = document.querySelectorAll('.fade-in');
if (fadeEls.length) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  fadeEls.forEach(el => observer.observe(el));
}

/* ============================================
   Lightbox
   ============================================ */
const LB_ICONS = {
  zoomIn:  `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="6.5" cy="6.5" r="5"/><line x1="10.5" y1="10.5" x2="15" y2="15"/><line x1="6.5" y1="4" x2="6.5" y2="9"/><line x1="4" y1="6.5" x2="9" y2="6.5"/></svg>`,
  zoomOut: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="6.5" cy="6.5" r="5"/><line x1="10.5" y1="10.5" x2="15" y2="15"/><line x1="4" y1="6.5" x2="9" y2="6.5"/></svg>`,
  close:   `<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="1" y1="1" x2="12" y2="12"/><line x1="12" y1="1" x2="1" y2="12"/></svg>`,
};

class Lightbox {
  constructor() {
    this.images = [];
    this.current = 0;
    this.zoomed = false;
    this.el = null;
    this.init();
  }

  init() {
    this.el = document.getElementById('lightbox');
    if (!this.el) return;

    this.imgEl   = this.el.querySelector('.lightbox__img');
    this.wrap    = this.el.querySelector('.lightbox__image-wrap');
    this.content = this.el.querySelector('.lightbox__content');
    this.backdrop = this.el.querySelector('.lightbox__backdrop');
    this.prevBtn  = this.el.querySelector('[data-lb-prev]');
    this.nextBtn  = this.el.querySelector('[data-lb-next]');
    this.zoomBtn  = this.el.querySelector('.lightbox__zoom-btn');
    this.closeBtn = this.el.querySelector('.lightbox__close');

    if (this.zoomBtn)  this.zoomBtn.innerHTML  = LB_ICONS.zoomIn;
    if (this.closeBtn) this.closeBtn.innerHTML = LB_ICONS.close;

    this.closeBtn?.addEventListener('click', () => this.close());
    this.backdrop?.addEventListener('click', () => this.close());
    this.prevBtn?.addEventListener('click',  () => this.step(-1));
    this.nextBtn?.addEventListener('click',  () => this.step(1));
    this.zoomBtn?.addEventListener('click',  () => this.toggleZoom());

    // Clicking the image toggles zoom in both directions
    this.imgEl?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleZoom();
    });

    // Clicking the dark area around the image in Stage 2 closes.
    // Only fires when zoomed — in Stage 1 the backdrop handles it.
    this.content?.addEventListener('click', (e) => {
      if (this.zoomed && e.target === this.content) this.close();
    });

    document.addEventListener('keydown', (e) => {
      if (!this.el.classList.contains('active')) return;
      if (e.key === 'Escape') this.close();
      if (!this.zoomed && e.key === 'ArrowLeft')  this.step(-1);
      if (!this.zoomed && e.key === 'ArrowRight') this.step(1);
    });

    // Gallery images (data-lightbox)
    document.querySelectorAll('[data-lightbox]').forEach((trigger, i) => {
      this.images.push({ src: trigger.dataset.lightbox, alt: trigger.dataset.lightboxAlt || '' });
      trigger.addEventListener('click', () => this.open(i));
    });

    // Solo images (data-lightbox-solo) — open in isolation, no prev/next
    document.querySelectorAll('[data-lightbox-solo]').forEach(trigger => {
      trigger.addEventListener('click', () => {
        this._savedImages  = this.images;
        this._savedCurrent = this.current;
        this.images  = [{ src: trigger.dataset.lightboxSolo, alt: trigger.dataset.lightboxAlt || '' }];
        this.current = 0;
        this.open(0);
      });
    });

    // Grid and carousel images
    document.querySelectorAll('.cs-image-grid img, .cs-carousel__slide img').forEach(img => {
      img.addEventListener('click', () => {
        const idx = this.images.findIndex(i => i.src === img.src);
        if (idx !== -1) this.open(idx);
        else {
          this.images.push({ src: img.src, alt: img.alt });
          this.open(this.images.length - 1);
        }
      });
    });
  }

  toggleZoom() {
    this.zoomed = !this.zoomed;
    this.el.classList.toggle('is-zoomed', this.zoomed);
    if (this.zoomBtn) {
      this.zoomBtn.innerHTML = this.zoomed ? LB_ICONS.zoomOut : LB_ICONS.zoomIn;
      this.zoomBtn.setAttribute('aria-label', this.zoomed ? 'Zoom out' : 'Zoom in');
    }
    if (this.zoomed) {
      // Double RAF: first lets the browser apply the new CSS (overflow, max constraints
      // removed), second reads the settled layout dimensions before scrolling.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        this.el.scrollTo({
          left: (this.el.scrollWidth  - this.el.clientWidth)  / 2,
          top:  (this.el.scrollHeight - this.el.clientHeight) / 2,
        });
      }));
    } else {
      // Reset scroll so Stage 1 re-opens cleanly if revisited.
      this.el.scrollLeft = 0;
      this.el.scrollTop  = 0;
    }
  }

  open(index) {
    if (!this.el) return;
    this.zoomed = false;
    this.el.classList.remove('is-zoomed');
    if (this.zoomBtn) this.zoomBtn.innerHTML = LB_ICONS.zoomIn;
    this.current = index;
    this.render();
    this.el.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  close() {
    this.el.classList.remove('active', 'is-zoomed');
    this.zoomed = false;
    if (this.zoomBtn) this.zoomBtn.innerHTML = LB_ICONS.zoomIn;
    document.body.style.overflow = '';
    if (this._savedImages) {
      this.images  = this._savedImages;
      this.current = this._savedCurrent;
      this._savedImages = null;
    }
  }

  step(dir) {
    this.current = (this.current + dir + this.images.length) % this.images.length;
    this.render();
  }

  render() {
    if (this.imgEl && this.images[this.current]) {
      this.imgEl.src = this.images[this.current].src;
      this.imgEl.alt = this.images[this.current].alt;
    }
    const multi = this.images.length > 1;
    if (this.prevBtn) this.prevBtn.style.display = multi ? '' : 'none';
    if (this.nextBtn) this.nextBtn.style.display = multi ? '' : 'none';
  }
}

/* ============================================
   Project card lightbox triggers
   ============================================ */
function initProjectCards() {
  document.querySelectorAll('.project-card').forEach(card => {
    const img = card.querySelector('img');
    const btn = card.querySelector('.project-card__expand-btn');
    if (!img) return;

    const src = img.src;
    const alt = img.alt;

    const handler = (e) => {
      e.stopPropagation();
      const lb = window.__lightbox;
      if (lb) {
        lb.images.push({ src, alt });
        lb.open(lb.images.length - 1);
      }
    };

    btn?.addEventListener('click', handler);
  });
}

/* ============================================
   Carousel
   ============================================ */
class Carousel {
  constructor(el) {
    this.el = el;
    this.track = el.querySelector('.cs-carousel__track');
    this.slides = el.querySelectorAll('.cs-carousel__slide');
    this.dots = el.querySelectorAll('.cs-carousel__dot');
    this.prevBtn = el.querySelector('[data-carousel-prev]');
    this.nextBtn = el.querySelector('[data-carousel-next]');
    this.current = 0;
    this.total = this.slides.length;
    this.startX = 0;
    this.isDragging = false;

    this.bind();
  }

  bind() {
    this.prevBtn?.addEventListener('click', () => this.step(-1));
    this.nextBtn?.addEventListener('click', () => this.step(1));

    this.dots.forEach((dot, i) => {
      dot.addEventListener('click', () => this.goTo(i));
    });

    // Touch/swipe
    this.el.addEventListener('touchstart', (e) => {
      this.startX = e.touches[0].clientX;
    }, { passive: true });

    this.el.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - this.startX;
      if (Math.abs(dx) > 50) this.step(dx < 0 ? 1 : -1);
    }, { passive: true });
  }

  step(dir) {
    this.goTo((this.current + dir + this.total) % this.total);
  }

  goTo(index) {
    this.current = index;
    this.track.style.transform = `translateX(-${100 * index}%)`;
    this.dots.forEach((dot, i) => {
      dot.classList.toggle('active', i === index);
    });
  }
}

/* ============================================
   TOC active highlight (case study)
   ============================================ */
function initToc() {
  const toc = document.querySelector('.cs-toc');
  if (!toc) return;

  const links = toc.querySelectorAll('a[href^="#"]');
  const sections = [...links].map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        links.forEach(a => a.classList.remove('active'));
        const link = toc.querySelector(`a[href="#${entry.target.id}"]`);
        link?.classList.add('active');
      }
    });
  }, { rootMargin: '-20% 0px -70% 0px' });

  sections.forEach(s => observer.observe(s));
}

/* ============================================
   Boot
   ============================================ */
document.addEventListener('DOMContentLoaded', () => {
  window.__lightbox = new Lightbox();
  initProjectCards();
  document.querySelectorAll('.cs-carousel').forEach(el => new Carousel(el));
  initToc();
});

/* Expose for re-init after dynamic content injection */
window._Lightbox  = Lightbox;
window._Carousel  = Carousel;
window._initToc   = initToc;
