const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// Tests feed modified copies of portfolio.json through request interception,
// so nothing on disk is touched.
const PORTFOLIO = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/portfolio.json'), 'utf8'));
const clone = () => JSON.parse(JSON.stringify(PORTFOLIO));

async function openAbout(page, data) {
  if (data) {
    await page.route('**/data/portfolio.json', route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) }));
  }
  await page.goto('/?tab=about');
  await page.waitForSelector('.tl-row');
}

// Mirrors Renderer.timeline's month-index maths for the expected bar offset.
function monthIdx(v) {
  if (v === 'present') { const n = new Date(); return n.getFullYear() * 12 + n.getMonth(); }
  const [y, m] = v.split('-').map(Number);
  return y * 12 + m - 1;
}

test.describe('Career timeline', () => {

  test('renders one row per entry, newest first, from portfolio.json', async ({ page }) => {
    await openAbout(page);
    const tl = PORTFOLIO.about.timeline;
    await expect(page.locator('.timeline__heading')).toHaveText(tl.heading);
    await expect(page.locator('.tl-row')).toHaveCount(tl.entries.length);
    const starts = [];
    for (const row of await page.locator('.tl-row').all()) {
      const company = await row.locator('.tl-row__company').textContent();
      const e = tl.entries.find(x => x.company === company);
      starts.push(monthIdx((e.positions ? e.positions[0] : e).start));
    }
    expect(starts).toEqual([...starts].sort((a, b) => b - a));
  });

  test('entry with positions shows one bar and keeps each role for screen readers', async ({ page }) => {
    const data = clone();
    data.about.timeline.entries = [{
      company: 'Two Roles Co', role: 'A → B', discipline: 'content',
      positions: [{ role: 'Role A', start: '2015-09', end: '2016-09' }, { role: 'Role B', start: '2016-09', end: '2017-09' }],
    }];
    await openAbout(page, data);
    const row = page.locator('.tl-row');
    await expect(row.locator('.tl-bar')).toHaveCount(1);
    await expect(row.locator('.tl-row__meta')).toContainText('Sep 2015 – Sep 2017');
    await expect(row.locator('.tl-sr li')).toHaveText(['Role A, Sep 2015 – Sep 2016', 'Role B, Sep 2016 – Sep 2017']);
  });

  test('changing dates recalculates axis, bar position and order', async ({ page }) => {
    const data = clone();
    data.about.timeline.order = 'newest';
    data.about.timeline.entries = [
      { company: 'Later', role: 'r', discipline: 'ux-research', start: '2016-07', end: '2018-01' },
      { company: 'Earlier', role: 'r', discipline: 'content', start: '2010-04', end: '2012-04' },
      { company: 'Newest', role: 'r', discipline: 'product-design', start: '2019-01', end: '2020-01' },
    ];
    await openAbout(page, data);
    await expect(page.locator('.tl-row__company')).toHaveText(['Newest', 'Later', 'Earlier']);
    await expect(page.locator('.tl-tick').first()).toHaveText('2010');

    const axisStart = 2010 * 12, axisEnd = 2020 * 12;
    const left = await page.locator('.tl-row', { hasText: 'Later' }).locator('.tl-bar').evaluate(b => b.style.left);
    expect(parseFloat(left)).toBeCloseTo((monthIdx('2016-07') - axisStart) / (axisEnd - axisStart) * 100, 2);
  });

  test('manual order keeps the listed order', async ({ page }) => {
    const data = clone();
    data.about.timeline.order = 'manual';
    data.about.timeline.entries = [
      { company: 'First listed', role: 'r', discipline: 'content', start: '2010-01', end: '2011-01' },
      { company: 'Second listed', role: 'r', discipline: 'content', start: '2015-01', end: '2016-01' },
    ];
    await openAbout(page, data);
    await expect(page.locator('.tl-row__company')).toHaveText(['First listed', 'Second listed']);
  });

  test('discipline colour and label drive both bars and legend', async ({ page }) => {
    const data = clone();
    const d = data.about.timeline.disciplines.find(x => x.id === 'product-design');
    d.color = '#123456';
    d.label = 'Renamed';
    await openAbout(page, data);
    const entry = data.about.timeline.entries.find(e => e.discipline === 'product-design');
    const bar = page.locator('.tl-row', { hasText: entry.company }).first().locator('.tl-bar');
    await expect(bar).toHaveCSS('background-color', 'rgb(18, 52, 86)');
    const legendItem = page.locator('.tl-legend li', { hasText: 'Renamed' });
    await expect(legendItem.locator('.tl-legend__dot')).toHaveCSS('background-color', 'rgb(18, 52, 86)');
  });

  test('mentoring sits outside the bars and the legend', async ({ page }) => {
    await openAbout(page);
    const m = PORTFOLIO.about.timeline.mentoring;
    await expect(page.locator('.tl-mentoring')).toContainText(m.organization);
    await expect(page.locator('.tl-list')).not.toContainText(m.organization);
    await expect(page.locator('.tl-legend li')).toHaveCount(PORTFOLIO.about.timeline.disciplines.length);
  });

  test('narrow viewport shows a stacked list with visible discipline, no horizontal scroll', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openAbout(page);
    await expect(page.locator('.tl-axis')).toBeHidden();
    await expect(page.locator('.tl-row__track').first()).toBeHidden();
    await expect(page.locator('.tl-row__discipline').first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  test.describe('Bar tooltips', () => {
    const tooltip = page => page.locator('.tl-tooltip');

    function oneEntry() {
      const data = clone();
      data.about.timeline.entries = [{
        company: 'Acme', role: 'Design Lead', discipline: 'ux-research',
        description: 'Tooltip copy from the editor.', start: '2018-03', end: 'present',
      }];
      return data;
    }

    test('hover shows discipline · dates, role, company and description from the data', async ({ page }) => {
      const data = oneEntry();
      const label = data.about.timeline.disciplines.find(d => d.id === 'ux-research').label;
      await openAbout(page, data);
      await page.locator('.tl-bar').hover();
      await expect(tooltip(page)).toHaveClass(/is-visible/);
      await expect(tooltip(page).locator('p')).toHaveText([
        `${label} · Mar 2018 – Present`, 'Design Lead', 'Acme', 'Tooltip copy from the editor.',
      ]);
      const box = await tooltip(page).boundingBox();
      expect(box.width).toBeGreaterThanOrEqual(280);
      expect(box.width).toBeLessThanOrEqual(340);
      await page.mouse.move(2, 2);
      await expect(tooltip(page)).not.toHaveClass(/is-visible/);
    });

    test('keyboard focus shows the tooltip, Escape hides it', async ({ page }) => {
      await openAbout(page, oneEntry());
      // Tab through the page's tab buttons until the bar receives focus
      await page.locator('.tab-btn').first().focus();
      for (let i = 0; i < 6; i++) {
        await page.keyboard.press('Tab');
        if (await page.locator('.tl-bar').evaluate(b => b === document.activeElement)) break;
      }
      await expect(page.locator('.tl-bar')).toBeFocused();
      await expect(tooltip(page)).toHaveClass(/is-visible/);
      await page.keyboard.press('Escape');
      await expect(tooltip(page)).not.toHaveClass(/is-visible/);
    });

    test('bar is described for screen readers by the tooltip content', async ({ page }) => {
      await openAbout(page, oneEntry());
      const bar = page.locator('.tl-bar');
      await expect(bar).toHaveAttribute('aria-label', 'Acme, Design Lead');
      const ids = (await bar.getAttribute('aria-describedby')).split(' ');
      await expect(page.locator(`#${ids[1]}`)).toHaveText('Tooltip copy from the editor.');
    });

    test('stacked mobile list shows the description inline', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await openAbout(page, oneEntry());
      await expect(page.locator('.tl-row__desc')).toBeVisible();
      await expect(page.locator('.tl-row__desc')).toHaveText('Tooltip copy from the editor.');
    });
  });

  test('wide desktop shows the two-column chart', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openAbout(page);
    await expect(page.locator('.tl-axis')).toBeVisible();
    await expect(page.locator('.tl-bar').first()).toBeVisible();
  });

});
