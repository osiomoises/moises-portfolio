const { test, expect } = require('@playwright/test');

test.describe('Case study page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/case-study.html');
  });

  // ── Page identity ──────────────────────────────────────────────────────────

  test('has correct title', async ({ page }) => {
    await expect(page).toHaveTitle(/FinTech/);
  });

  // ── Navigation ─────────────────────────────────────────────────────────────

  test('nav bar is visible with back link', async ({ page }) => {
    await expect(page.locator('.nav')).toBeVisible();
    await expect(page.locator('.nav__logo')).toBeVisible();
    await expect(
      page.locator('.cs-hero__eyebrow a')
    ).toHaveAttribute('href', 'index.html#work');
  });

  // ── Hero ───────────────────────────────────────────────────────────────────

  test('hero shows case study title', async ({ page }) => {
    await expect(page.locator('.cs-hero h1')).toContainText('FinTech');
  });

  test('hero has five meta items', async ({ page }) => {
    await expect(page.locator('.cs-meta-item')).toHaveCount(5);
  });

  // ── Table of contents ──────────────────────────────────────────────────────

  test('TOC has seven section links', async ({ page }) => {
    await expect(page.locator('.cs-toc a')).toHaveCount(7);
  });

  test('TOC links point to correct anchors', async ({ page }) => {
    const hrefs = await page.locator('.cs-toc a').evaluateAll(
      els => els.map(el => el.getAttribute('href'))
    );
    expect(hrefs).toEqual([
      '#overview', '#problem', '#research',
      '#process', '#solution', '#results', '#learnings',
    ]);
  });

  // ── Content sections ───────────────────────────────────────────────────────

  test('all seven content sections are present', async ({ page }) => {
    for (const id of ['overview', 'problem', 'research', 'process', 'solution', 'results', 'learnings']) {
      await expect(page.locator(`#${id}`), `section #${id} missing`).toBeAttached();
    }
  });

  test('results grid has four metric cards', async ({ page }) => {
    await expect(page.locator('.result-card')).toHaveCount(4);
    await expect(page.locator('.result-card__number').first()).toHaveText('42%');
  });

  // ── Footer & next project ─────────────────────────────────────────────────

  test('next project section is visible', async ({ page }) => {
    await expect(page.locator('.cs-next')).toBeVisible();
  });

  test('footer is present with year', async ({ page }) => {
    await expect(page.locator('footer')).toBeVisible();
    await expect(page.locator('.footer__right')).toContainText('2026');
  });

  // ── Carousel ───────────────────────────────────────────────────────────────

  test.describe('Carousel', () => {
    test('track starts with no transform applied', async ({ page }) => {
      const transform = await page.locator('.cs-carousel__track').first()
        .evaluate(el => el.style.transform);
      expect(transform).toBe('');
    });

    test('next button advances to slide 1', async ({ page }) => {
      const carousel = page.locator('.cs-carousel').first();
      await carousel.locator('[data-carousel-next]').click();
      const transform = await carousel.locator('.cs-carousel__track')
        .evaluate(el => el.style.transform);
      expect(transform).toBe('translateX(-100%)');
    });

    test('prev button wraps to last slide', async ({ page }) => {
      const carousel = page.locator('.cs-carousel').first();
      const total = await carousel.locator('.cs-carousel__slide').count();
      await carousel.locator('[data-carousel-prev]').click();
      const transform = await carousel.locator('.cs-carousel__track')
        .evaluate(el => el.style.transform);
      expect(transform).toBe(`translateX(-${100 * (total - 1)}%)`);
    });

    test('next button wraps back to slide 0 after full cycle', async ({ page }) => {
      const carousel  = page.locator('.cs-carousel').first();
      const total     = await carousel.locator('.cs-carousel__slide').count();
      const nextBtn   = carousel.locator('[data-carousel-next]');
      for (let i = 0; i < total; i++) await nextBtn.click();
      const transform = await carousel.locator('.cs-carousel__track')
        .evaluate(el => el.style.transform);
      expect(transform).toBe('translateX(0%)');
    });

    test('dot click jumps to correct slide and marks dot active', async ({ page }) => {
      const carousel = page.locator('.cs-carousel').first();
      const dots     = carousel.locator('.cs-carousel__dot');
      await dots.nth(1).click();
      const transform = await carousel.locator('.cs-carousel__track')
        .evaluate(el => el.style.transform);
      expect(transform).toBe('translateX(-100%)');
      await expect(dots.nth(1)).toHaveClass(/active/);
      await expect(dots.nth(0)).not.toHaveClass(/active/);
    });
  });

  // ── Lightbox ───────────────────────────────────────────────────────────────

  test.describe('Lightbox', () => {
    test('lightbox is in DOM but closed on load', async ({ page }) => {
      const lb = page.locator('#lightbox');
      await expect(lb).toBeAttached();
      await expect(lb).not.toHaveClass(/active/);
    });

    test('clicking a solo image opens the lightbox', async ({ page }) => {
      await page.locator('[data-lightbox-solo]').first().click();
      await expect(page.locator('#lightbox')).toHaveClass(/active/);
    });

    test('close button dismisses the lightbox', async ({ page }) => {
      await page.locator('[data-lightbox-solo]').first().click();
      await page.locator('.lightbox__close').click();
      await expect(page.locator('#lightbox')).not.toHaveClass(/active/);
    });

    test('backdrop click dismisses the lightbox', async ({ page }) => {
      await page.locator('[data-lightbox-solo]').first().click();
      // Click the top-left corner of the backdrop — the image is centered and
      // sits above the backdrop element, so we must click outside the image area.
      await page.locator('.lightbox__backdrop').click({ position: { x: 20, y: 20 } });
      await expect(page.locator('#lightbox')).not.toHaveClass(/active/);
    });

    test('Escape key dismisses the lightbox', async ({ page }) => {
      await page.locator('[data-lightbox-solo]').first().click();
      await page.keyboard.press('Escape');
      await expect(page.locator('#lightbox')).not.toHaveClass(/active/);
    });
  });
});
