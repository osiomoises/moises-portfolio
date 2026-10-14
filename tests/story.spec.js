const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// Modified copies of portfolio.json are served through request interception,
// so nothing on disk is touched.
const PORTFOLIO = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/portfolio.json'), 'utf8'));
const clone = () => JSON.parse(JSON.stringify(PORTFOLIO));
// The real panels, with the section forced visible whatever the saved toggle is
const shown = () => { const d = clone(); d.about.story.visible = true; return d; };

async function serve(page, data) {
  if (data) {
    await page.route('**/data/portfolio.json', route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) }));
  }
}

async function openAbout(page, data) {
  await serve(page, data);
  await page.goto('/?tab=about');
  await page.waitForSelector('#about-body p');
}

function withPanels(items, extra = {}) {
  const data = clone();
  data.about.story = { visible: true, heading: 'The story so far', items, ...extra };
  return data;
}

const panel = (n, extra = {}) => ({
  id: `story-0${n}`, visible: true, number: `0${n}`, label: `Label ${n}`,
  heading: `Heading ${n}`, description: `Description ${n}.`, image: '', ...extra,
});

test.describe('The story so far', () => {

  test('sits between the intro and Recommendations, with the shared heading and divider', async ({ page }) => {
    await openAbout(page, shown());
    const order = await page.locator('#panel-about > *:not([hidden])').evaluateAll(els => els.map(e => e.id));
    expect(order.indexOf('about-story')).toBe(order.indexOf('about-body') + 1);
    expect(order.indexOf('about-recommendations')).toBe(order.indexOf('about-story') + 1);

    await expect(page.locator('.story__heading')).toHaveText(PORTFOLIO.about.story.heading);
    const css = el => {
      const s = getComputedStyle(el);
      return [s.fontSize, s.fontWeight, s.letterSpacing, s.lineHeight].join();
    };
    expect(await page.locator('.story__heading').evaluate(css))
      .toBe(await page.locator('.recs__heading').evaluate(css));
    const divider = el => {
      const s = getComputedStyle(el);
      return [s.marginTop, s.paddingTop, s.borderTopWidth, s.borderTopColor].join();
    };
    expect(await page.locator('#about-story').evaluate(divider))
      .toBe(await page.locator('#about-recommendations').evaluate(divider));
  });

  test('renders each visible panel in order with number, label, heading and description', async ({ page }) => {
    await openAbout(page, shown());
    const visible = PORTFOLIO.about.story.items.filter(p => p.visible !== false);
    await expect(page.locator('.story-panel__heading')).toHaveText(visible.map(p => p.heading));
    await expect(page.locator('.story-panel__num')).toHaveText(visible.map(p => p.number));
    await expect(page.locator('.story-panel__desc')).toHaveText(visible.map(p => p.description));
  });

  test('hidden panels and a hidden section are not shown', async ({ page }) => {
    const data = withPanels([panel(1), panel(2, { visible: false }), panel(3)]);
    await openAbout(page, data);
    await expect(page.locator('.story-panel__heading')).toHaveText(['Heading 1', 'Heading 3']);

    data.about.story.visible = false;
    await page.unroute('**/data/portfolio.json');
    await openAbout(page, data);
    await expect(page.locator('#about-story')).toBeHidden();
  });

  test('panels without (or with a broken) illustration keep a 5:4 placeholder', async ({ page }) => {
    await openAbout(page, withPanels([panel(1), panel(2, { image: 'assets/images/does-not-exist.png' })]));
    const media = page.locator('.story-panel__media');
    await expect(media).toHaveCount(2);
    await expect(page.locator('.story-panel__img')).toHaveCount(0);
    for (const box of await media.all()) {
      const { width, height } = await box.boundingBox();
      expect(width / height).toBeCloseTo(1.25, 1);
    }
  });

  test('desktop: four equal-width panels in a single row', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openAbout(page, shown());
    const boxes = await Promise.all((await page.locator('.story-panel').all()).map(p => p.boundingBox()));
    expect(boxes).toHaveLength(4);
    boxes.forEach(b => {
      expect(Math.abs(b.y - boxes[0].y)).toBeLessThan(1);
      expect(Math.abs(b.width - boxes[0].width)).toBeLessThan(1);
    });
    const gap = boxes[1].x - (boxes[0].x + boxes[0].width);
    expect(gap).toBeGreaterThanOrEqual(16);
    expect(gap).toBeLessThanOrEqual(20);
  });

  test('mobile: swipeable strip with the next panel peeking, no page overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openAbout(page, shown());
    const track = page.locator('.story__track');
    const { scrollWidth, clientWidth } = await track.evaluate(t => ({ scrollWidth: t.scrollWidth, clientWidth: t.clientWidth }));
    expect(scrollWidth).toBeGreaterThan(clientWidth);

    const second = await page.locator('.story-panel').nth(1).boundingBox();
    expect(second.x).toBeLessThan(390);   // starts on screen…
    expect(second.x + second.width).toBeGreaterThan(390);   // …but is cut off

    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });

  test('editor: "Show The story so far" hides the section but keeps its content editable', async ({ page }) => {
    await serve(page, withPanels([panel(1, { image: 'assets/images/x.png' }), panel(2)]));
    await page.goto('/editor.html');
    await page.locator('.tab-btn[data-tab="about"]').click();
    const ed = page.locator('#story-editor');
    const toggle = ed.locator('.checkbox-wrap', { hasText: 'Show The story so far' }).locator('input');
    await expect(toggle).toBeChecked();
    await toggle.uncheck();
    await ed.locator('.editor-card').nth(1).locator('.field-textarea').fill('Still editable.');

    await page.locator('#tab-about .btn-export').click();
    const story = JSON.parse(await page.locator('#portfolio-pre-about').textContent()).about.story;
    expect(story.visible).toBe(false);
    expect(story.items).toHaveLength(2);
    expect(story.items[0]).toMatchObject({ image: 'assets/images/x.png', description: 'Still editable.' });
  });

  test('editor: edit, reorder, hide and add panels; changes land in the exported JSON', async ({ page }) => {
    await serve(page, withPanels([panel(1), panel(2)]));
    await page.goto('/editor.html');
    await page.locator('.tab-btn[data-tab="about"]').click();
    const ed = page.locator('#story-editor');
    await expect(ed.locator('.editor-card')).toHaveCount(3);   // section + 2 panels

    await ed.locator('.editor-card').first().locator('input[type="text"]').fill('My path');
    const first = ed.locator('.editor-card').nth(1);
    await first.locator('.field-textarea').fill('Edited description.');
    await first.locator('button[title="Move down"]').click();
    await ed.locator('.editor-card').nth(1).locator('input[type="checkbox"]').uncheck();   // now panel 2
    await ed.getByRole('button', { name: '+ Add panel' }).click();

    await page.locator('#tab-about .btn-export').click();
    const story = JSON.parse(await page.locator('#portfolio-pre-about').textContent()).about.story;
    expect(story.heading).toBe('My path');
    expect(story.items.map(p => p.id)).toEqual(['story-02', 'story-01', 'story-03']);
    expect(story.items[0].visible).toBe(false);
    expect(story.items[1].description).toBe('Edited description.');
    expect(story.items[2]).toMatchObject({ number: '03', image: '', visible: true });
  });

});
