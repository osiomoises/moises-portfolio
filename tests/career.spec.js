const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// Modified copies of portfolio.json are served through request interception,
// so nothing on disk is touched.
const PORTFOLIO = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/portfolio.json'), 'utf8'));
const clone = () => JSON.parse(JSON.stringify(PORTFOLIO));

async function openAbout(page, data) {
  if (data) {
    await page.route('**/data/portfolio.json', route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) }));
  }
  await page.goto('/?tab=about');
  await page.waitForSelector('#about-body p');
}

const entry = (company, dates, extra = {}) =>
  ({ id: company.toLowerCase(), visible: true, current: false, company, role: 'Role', dates, description: '', ...extra });

test.describe('Career & education', () => {

  test('renders heading, education and one continuous career list', async ({ page }) => {
    await openAbout(page);
    const c = PORTFOLIO.about.career;
    await expect(page.locator('.career__heading')).toHaveText(c.heading);
    await expect(page.locator('.career-edu__title')).toHaveText(c.education.filter(e => e.visible !== false).map(e => e.title));
    await expect(page.locator('.career__entries ul')).toHaveCount(1);
    // at most the (optional) Experience label — no Mentoring / Earlier group labels
    await expect(page.locator('.career__entries .career__label')).toHaveCount(c.labels.experience ? 1 : 0);
    await expect(page.locator('.career__eyebrow')).toHaveCount(c.eyebrow ? 1 : 0);
    await expect(page.locator('.career-entry')).toHaveCount(c.entries.filter(e => e.visible !== false).length);
  });

  test('chronological order: current first, then newest start date; hidden skipped', async ({ page }) => {
    const data = clone();
    data.about.career.order = 'chronological';
    data.about.career.entries = [
      entry('Oldest', 'Jun 2012 – Sep 2015'),
      entry('Overlap', 'Oct 2024 – Oct 2025'),
      entry('Now Co', 'Jan 2022 – Present', { current: true }),
      entry('Year Only', '2019'),
      entry('Hidden Co', 'Jan 2026 – Present', { visible: false }),
      entry('No Date', ''),
    ];
    await openAbout(page, data);
    await expect(page.locator('.career-entry__company')).toHaveText(['Now Co', 'Overlap', 'Year Only', 'Oldest', 'No Date']);
  });

  test('manual order keeps the listed order', async ({ page }) => {
    const data = clone();
    data.about.career.order = 'manual';
    data.about.career.entries = [entry('B', '2010'), entry('A', '2020', { current: true })];
    await openAbout(page, data);
    await expect(page.locator('.career-entry__company')).toHaveText(['B', 'A']);
  });

  test('no divider under the highlighted current card; dividers kept elsewhere', async ({ page }) => {
    const data = clone();
    data.about.career.order = 'manual';
    data.about.career.entries = [entry('A', '2020'), entry('Now', '2021', { current: true }), entry('C', '2019')];
    await openAbout(page, data);
    const widths = await page.locator('.career-entry').evaluateAll(es => es.map(e => getComputedStyle(e).borderBottomWidth));
    expect(widths).toEqual(['1px', '0px', '1px']);
  });

  test('current entry uses the configured background, with no pill', async ({ page }) => {
    const data = clone();
    data.about.career.current = { highlight: true, background: '#112233' };
    data.about.career.entries = [entry('Now Co', '2022', { current: true }), entry('Past Co', '2020')];
    await openAbout(page, data);
    const now = page.locator('.career-entry', { hasText: 'Now Co' });
    await expect(now.locator('.career-entry__body')).toHaveCSS('background-color', 'rgb(17, 34, 51)');
    await expect(page.locator('.career-entry__pill')).toHaveCount(0);
    await expect(page.locator('.career-entry', { hasText: 'Past Co' }).locator('.career-entry__body')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  });

  test('highlight is optional', async ({ page }) => {
    const data = clone();
    data.about.career.current = { ...data.about.career.current, highlight: false };
    data.about.career.entries = [entry('Now Co', '2022', { current: true })];
    await openAbout(page, data);
    await expect(page.locator('.career-entry--current')).toHaveCount(0);
  });

  test('hidden section renders nothing', async ({ page }) => {
    const data = clone();
    data.about.career.visible = false;
    await openAbout(page, data);
    await expect(page.locator('#about-career')).toBeHidden();
  });

  test('desktop: two columns, dates under the job title; mobile: stacked, no overflow', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openAbout(page);
    const [l, r] = await page.locator('.career__intro, .career__entries').evaluateAll(els => els.map(e => e.getBoundingClientRect().toJSON()));
    expect(Math.round(l.top)).toBe(Math.round(r.top));
    expect(l.width / (l.width + r.width)).toBeCloseTo(0.3, 1);
    const first = page.locator('.career-entry').first();
    const company = await first.locator('.career-entry__company').boundingBox();
    const role = await first.locator('.career-entry__role').boundingBox();
    const dates = await first.locator('.career-entry__dates').boundingBox();
    expect(Math.round(dates.x)).toBe(Math.round(company.x));   // left-aligned with company/role
    expect(dates.y).toBeGreaterThan(role.y);                     // below the job title

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(100);
    const [l2, r2] = await page.locator('.career__intro, .career__entries').evaluateAll(els => els.map(e => e.getBoundingClientRect().toJSON()));
    expect(r2.top).toBeGreaterThan(l2.bottom);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  test('old timeline chart, legend and tooltips are gone', async ({ page }) => {
    await openAbout(page);
    await expect(page.locator('.tl-row, .tl-bar, .tl-legend, .tl-tooltip')).toHaveCount(0);
  });

});
