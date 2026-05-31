const { test, expect } = require('@playwright/test');

test.describe('Landing page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  // ── Page identity ──────────────────────────────────────────────────────────

  test('has correct title', async ({ page }) => {
    await expect(page).toHaveTitle('Moises Osio — Product Designer');
  });

  // ── Sidebar ────────────────────────────────────────────────────────────────

  test('sidebar shows name, role, and tagline', async ({ page }) => {
    await expect(page.locator('.sidebar__name')).toHaveText('Moises Osio');
    await expect(page.locator('.sidebar__title')).toContainText('Product');
    await expect(page.locator('.sidebar__tagline')).not.toBeEmpty();
  });

  test('sidebar has seven focus tags', async ({ page }) => {
    await expect(page.locator('.tags .tag')).toHaveCount(7);
  });

  test('sidebar has email and LinkedIn contact links', async ({ page }) => {
    await expect(
      page.locator('a.contact-item[href="mailto:osiomoises@gmail.com"]')
    ).toBeVisible();
    await expect(
      page.locator('a.contact-item[href*="linkedin"]')
    ).toBeVisible();
  });

  // ── Tab navigation ─────────────────────────────────────────────────────────

  test('renders three tabs', async ({ page }) => {
    const tabs = page.locator('.tab-btn');
    await expect(tabs).toHaveCount(3);
    await expect(tabs.nth(0)).toHaveText('Selected work');
    await expect(tabs.nth(1)).toHaveText('About me');
    await expect(tabs.nth(2)).toHaveText('Publications');
  });

  test('work panel is active and others hidden on load', async ({ page }) => {
    await expect(page.locator('#panel-work')).toBeVisible();
    await expect(page.locator('#panel-about')).toBeHidden();
    await expect(page.locator('#panel-publications')).toBeHidden();
    await expect(page.locator('.tab-btn').nth(0)).toHaveClass(/active/);
  });

  test('clicking About me tab shows about panel', async ({ page }) => {
    await page.locator('.tab-btn', { hasText: 'About me' }).click();
    await expect(page.locator('#panel-about')).toBeVisible();
    await expect(page.locator('#panel-work')).toBeHidden();
    await expect(page.locator('.tab-btn', { hasText: 'About me' })).toHaveClass(/active/);
  });

  test('clicking Publications tab shows publications panel', async ({ page }) => {
    await page.locator('.tab-btn', { hasText: 'Publications' }).click();
    await expect(page.locator('#panel-publications')).toBeVisible();
    await expect(page.locator('#panel-work')).toBeHidden();
  });

  test('switching back to work tab re-shows work panel', async ({ page }) => {
    await page.locator('.tab-btn', { hasText: 'About me' }).click();
    await page.locator('.tab-btn', { hasText: 'Selected work' }).click();
    await expect(page.locator('#panel-work')).toBeVisible();
    await expect(page.locator('#panel-about')).toBeHidden();
  });

  // ── Work grid ──────────────────────────────────────────────────────────────

  test('work grid has four project cards', async ({ page }) => {
    await expect(page.locator('.project-card')).toHaveCount(4);
  });

  test('every project card links to the case study', async ({ page }) => {
    const cards = page.locator('.project-card');
    for (let i = 0; i < await cards.count(); i++) {
      await expect(cards.nth(i)).toHaveAttribute('href', /case-study\.html/);
    }
  });

  test('project cards have title and subtitle in hover overlay', async ({ page }) => {
    await expect(page.locator('.project-card__title').first()).not.toBeEmpty();
    await expect(page.locator('.project-card__subtitle').first()).not.toBeEmpty();
  });

  // ── Panel content ──────────────────────────────────────────────────────────

  test('about panel has bio paragraphs', async ({ page }) => {
    await page.locator('.tab-btn', { hasText: 'About me' }).click();
    await expect(page.locator('.about-body p').first()).not.toBeEmpty();
  });

  test('publications panel has two articles', async ({ page }) => {
    await page.locator('.tab-btn', { hasText: 'Publications' }).click();
    await expect(page.locator('.article')).toHaveCount(2);
    await expect(page.locator('.article__title').first()).not.toBeEmpty();
  });
});
