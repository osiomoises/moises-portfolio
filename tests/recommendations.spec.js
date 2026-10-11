const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// Modified copies of portfolio.json are served through request interception,
// so nothing on disk is touched.
const PORTFOLIO = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/portfolio.json'), 'utf8'));
const clone = () => JSON.parse(JSON.stringify(PORTFOLIO));
const LONG = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(12).trim();

async function openAbout(page, data) {
  if (data) {
    await page.route('**/data/portfolio.json', route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) }));
  }
  await page.goto('/?tab=about');
  await page.waitForSelector('.tl-row');
}

function withItems(items, extra = {}) {
  const data = clone();
  data.about.recommendations = { heading: 'Recommendations', subtitle: '', visible: true, items, ...extra };
  return data;
}

test.describe('Recommendations', () => {

  test('renders every visible recommendation from portfolio.json, in order', async ({ page }) => {
    await openAbout(page);
    const visible = PORTFOLIO.about.recommendations.items.filter(r => r.visible !== false);
    await expect(page.locator('.recs__heading')).toHaveText(PORTFOLIO.about.recommendations.heading);
    await expect(page.locator('.rec-card__name')).toHaveText(visible.map(r => r.name));
  });

  test('hidden items and a hidden section are not shown', async ({ page }) => {
    const data = withItems([
      { id: 'rec-01', visible: true, name: 'Shown Person', relationship: 'Mentee', text: 'Hi.' },
      { id: 'rec-02', visible: false, name: 'Hidden Person', relationship: 'Mentee', text: 'Hi.' },
    ]);
    await openAbout(page, data);
    await expect(page.locator('.rec-card__name')).toHaveText(['Shown Person']);

    data.about.recommendations.visible = false;
    await page.unroute('**/data/portfolio.json');
    await openAbout(page, data);
    await expect(page.locator('#about-recommendations')).toBeHidden();
  });

  test('card shows name, title, relationship and text; keeps paragraph breaks', async ({ page }) => {
    await openAbout(page, withItems([
      { id: 'rec-01', name: 'Ada Lovelace', title: 'Analyst', relationship: 'Former colleague', avatar: '', text: 'One.\n\nTwo.' },
    ], { subtitle: 'Kind words' }));
    const card = page.locator('.rec-card');
    await expect(page.locator('.recs__subtitle')).toHaveText('Kind words');
    await expect(card.locator('.rec-card__title')).toHaveText('Analyst');
    await expect(card.locator('.rec-card__relationship')).toHaveText('Former colleague');
    expect(await card.locator('.rec-card__text').evaluate(t => t.innerText)).toBe('One.\n\nTwo.');
  });

  test('missing or broken avatar falls back to initials', async ({ page }) => {
    await openAbout(page, withItems([
      { id: 'rec-01', name: 'Ada Lovelace', relationship: 'Mentee', avatar: '', text: 'Hi.' },
      { id: 'rec-02', name: 'Grace Brewster Hopper', relationship: 'Mentee', avatar: 'assets/images/does-not-exist.png', text: 'Hi.' },
    ]));
    await expect(page.locator('.rec-avatar').first()).toHaveText('AL');
    await expect(page.locator('.rec-avatar').nth(1)).toHaveText('GH');
    await expect(page.locator('.rec-avatar__img')).toHaveCount(0);
  });

  test('always shows the full text, with no Read more control', async ({ page }) => {
    await openAbout(page, withItems([
      { id: 'rec-01', name: 'Long Text', relationship: 'Mentee', text: LONG },
    ]));
    const text = page.locator('.rec-card__text');
    await expect(text).toHaveText(LONG);
    expect(await text.evaluate(t => t.scrollHeight <= t.clientHeight + 1)).toBe(true);
    await expect(page.locator('.rec-card button')).toHaveCount(0);
  });

  test('desktop masonry: cards stack per column in editor order, no row gaps', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    // #1 long, #2 short: #3 should land under the short #2, not leave a gap under it
    await openAbout(page, withItems([
      { id: 'rec-01', name: 'One', relationship: 'Mentee', text: LONG },
      { id: 'rec-02', name: 'Two', relationship: 'Mentee', text: 'Short.' },
      { id: 'rec-03', name: 'Three', relationship: 'Mentee', text: 'Short too.' },
    ]));
    await expect(page.locator('.recs__grid')).toHaveClass(/is-masonry/);
    const [one, two, three] = await page.locator('.rec-card').evaluateAll(cs => cs.map(c => c.getBoundingClientRect().toJSON()));
    expect(Math.abs(one.top - two.top)).toBeLessThan(1);          // #1 and #2 side by side
    expect(Math.round(three.left)).toBe(Math.round(two.left));     // #3 goes to the shorter column
    expect(three.top - two.bottom).toBeGreaterThanOrEqual(19.5);   // ~20px gap, stacked directly
    expect(three.top - two.bottom).toBeLessThanOrEqual(21.5);
    expect(three.top).toBeLessThan(one.bottom);                    // not pushed below the tall card
  });

  test('two columns on wide desktop, one on mobile, no horizontal scroll', async ({ page }) => {
    const items = [1, 2, 3].map(n => ({ id: `rec-0${n}`, name: `Person ${n}`, relationship: 'Mentee', text: 'Hi.' }));
    await page.setViewportSize({ width: 1440, height: 900 });
    await openAbout(page, withItems(items));
    const lefts = await page.locator('.rec-card').evaluateAll(cs => new Set(cs.map(c => Math.round(c.getBoundingClientRect().left))).size);
    expect(lefts).toBe(2);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(100);
    const mobileLefts = await page.locator('.rec-card').evaluateAll(cs => new Set(cs.map(c => Math.round(c.getBoundingClientRect().left))).size);
    expect(mobileLefts).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

});
