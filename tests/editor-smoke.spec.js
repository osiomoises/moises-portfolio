const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const ROOT = '/Users/moises/Documents/Moises Wiki Landing Page';

const jsonFiles = [
  'data/case-studies/fintech-onboarding.json',
  'data/case-studies/expense-management.json',
  'data/case-studies/design-system.json',
  'data/case-studies/mobile-app.json',
].map(f => ({ rel: f, abs: path.join(ROOT, f) }));

// Helper: navigate to editor and switch to the Case Study tab
async function openEditor(page) {
  await page.goto('/editor.html');
  await page.locator('.tab-btn[data-tab="casestudy"]').click();
  await page.waitForSelector('#cs-body-editor .section-card', { timeout: 8000 });
}

test.describe('Editor smoke tests', () => {

  test('opening an existing case study does NOT modify any JSON file on disk', async ({ page }) => {
    // Record mtimes before opening the editor
    const mtimesBefore = {};
    jsonFiles.forEach(f => { mtimesBefore[f.rel] = fs.statSync(f.abs).mtimeMs; });

    await openEditor(page);

    // Switch to another case study
    await page.locator('.cs-list-item').nth(1).click();
    await page.waitForSelector('#cs-body-editor .section-card', { timeout: 5000 });

    // Check no files were touched
    jsonFiles.forEach(f => {
      const mtimeAfter = fs.statSync(f.abs).mtimeMs;
      expect(mtimeAfter, `${f.rel} was modified just by opening it`).toBe(mtimesBefore[f.rel]);
    });
  });

  test('TOC section is read-only with auto-generated notice', async ({ page }) => {
    await openEditor(page);

    const tocCard = page.locator('#cs-toc-editor');
    await expect(tocCard).toContainText('Auto-generated from body sections');

    // Should have NO input fields (read-only preview)
    const inputs = await tocCard.locator('input').count();
    expect(inputs).toBe(0);
  });

  test('body sections show anchor badge, TOC Label field, and Heading field', async ({ page }) => {
    await openEditor(page);

    const firstCard = page.locator('#cs-body-editor .section-card').first();
    await expect(firstCard.locator('.section-header-left .toc-anchor')).toBeVisible();
    // First hint is for TOC Label, second is for Heading
    await expect(firstCard.locator('.field-hint').first()).toContainText('TOC');
    await expect(firstCard.locator('.field-hint').nth(1)).toContainText('heading');
  });

  test('body sections have move ↑ ↓ and Remove buttons', async ({ page }) => {
    await openEditor(page);

    const secondCard = page.locator('#cs-body-editor .section-card').nth(1);
    await expect(secondCard.locator('button[title="Move section up"]')).toBeVisible();
    await expect(secondCard.locator('button[title="Move section down"]')).toBeVisible();
    await expect(secondCard.locator('button', { hasText: 'Remove' })).toBeVisible();

    // First card's ↑ should be disabled
    const firstUp = page.locator('#cs-body-editor .section-card').first()
      .locator('button[title="Move section up"]');
    await expect(firstUp).toBeDisabled();
  });

  test('editing TOC Label updates the TOC preview immediately', async ({ page }) => {
    await openEditor(page);

    const firstCard = page.locator('#cs-body-editor .section-card').first();
    const tocLabelInput = firstCard.locator('input').first();

    await tocLabelInput.fill('CHANGED LABEL');

    await expect(page.locator('#cs-toc-editor')).toContainText('CHANGED LABEL');
  });

  test('Add section creates a section with generic section-NN id', async ({ page }) => {
    await openEditor(page);

    const sectionsBefore = await page.locator('#cs-body-editor .section-card').count();

    await page.getByRole('button', { name: '+ Add section' }).click();

    const sectionsAfter = await page.locator('#cs-body-editor .section-card').count();
    expect(sectionsAfter).toBe(sectionsBefore + 1);

    // New section has section-NN anchor
    const newCard = page.locator('#cs-body-editor .section-card').last();
    const anchorText = await newCard.locator('.toc-anchor').textContent();
    expect(anchorText).toMatch(/^#section-\d{2}$/);

    // TOC preview includes the new section
    await expect(page.locator('#cs-toc-editor')).toContainText('New Section');
  });

  test('moving a section updates the TOC order', async ({ page }) => {
    await openEditor(page);

    const getAnchors = async () => {
      const cards = page.locator('#cs-body-editor .section-card');
      const n = await cards.count();
      const ids = [];
      for (let i = 0; i < Math.min(n, 3); i++) {
        ids.push(await cards.nth(i).locator('.toc-anchor').textContent());
      }
      return ids;
    };

    const before = await getAnchors();

    // Move second section up
    await page.locator('#cs-body-editor .section-card').nth(1)
      .locator('button[title="Move section up"]').click();

    const after = await getAnchors();
    expect(after[0]).toBe(before[1]);
    expect(after[1]).toBe(before[0]);

    // TOC preview reflects the swap
    const tocAnchors = await page.locator('#cs-toc-editor .toc-anchor').allTextContents();
    expect(tocAnchors[0]).toBe(before[1]);
    expect(tocAnchors[1]).toBe(before[0]);
  });

  test('removing a section: cancel keeps it, confirm removes it and updates TOC', async ({ page }) => {
    await openEditor(page);

    const countBefore = await page.locator('#cs-body-editor .section-card').count();
    const tocCountBefore = await page.locator('#cs-toc-editor .toc-row').count();

    const lastCard = page.locator('#cs-body-editor .section-card').last();
    const lastAnchor = await lastCard.locator('.toc-anchor').textContent();

    // Dismiss — count unchanged
    page.once('dialog', d => d.dismiss());
    await lastCard.locator('button', { hasText: 'Remove' }).click();
    expect(await page.locator('#cs-body-editor .section-card').count()).toBe(countBefore);

    // Accept — count decreases
    page.once('dialog', d => d.accept());
    await lastCard.locator('button', { hasText: 'Remove' }).click();
    expect(await page.locator('#cs-body-editor .section-card').count()).toBe(countBefore - 1);

    const tocCountAfter = await page.locator('#cs-toc-editor .toc-row').count();
    expect(tocCountAfter).toBe(tocCountBefore - 1);

    const tocAnchors = await page.locator('#cs-toc-editor .toc-anchor').allTextContents();
    expect(tocAnchors).not.toContain(lastAnchor);
  });

  test('Generate JSON rebuilds toc from body sections with tocLabel on each section', async ({ page }) => {
    await openEditor(page);

    await page.locator('#tab-casestudy .btn-export').click();
    await page.waitForFunction(() => document.getElementById('cs-pre').textContent.trim().length > 0, { timeout: 3000 });

    const json = await page.locator('#cs-pre').textContent();
    const data = JSON.parse(json);

    expect(Array.isArray(data.toc)).toBe(true);

    const bodySectionIds = data.body.filter(i => i.type === 'section').map(i => i.id);
    expect(data.toc.map(t => t.id)).toEqual(bodySectionIds);

    data.body.filter(i => i.type === 'section').forEach(s => {
      expect(s.tocLabel, `section ${s.id} missing tocLabel`).toBeTruthy();
    });
  });

  // These two tests both write to expense-management.json and must not run concurrently.
  test.describe.serial('Save / restore tests', () => {

    test('Save Changes writes toc and tocLabel to disk correctly', async ({ page }) => {
      // expense-management is the first project in portfolio.json — what gets auto-loaded
      const targetFile = path.join(ROOT, 'data/case-studies/expense-management.json');
      const originalContent = fs.readFileSync(targetFile, 'utf8');

      try {
        await openEditor(page);

        await page.locator('#btn-save-cs').click();
        await expect(page.locator('.save-toast--ok')).toBeVisible({ timeout: 5000 });

        const savedData = JSON.parse(fs.readFileSync(targetFile, 'utf8'));
        const bodySectionIds = savedData.body.filter(i => i.type === 'section').map(i => i.id);
        expect(savedData.toc.map(t => t.id)).toEqual(bodySectionIds);

        savedData.body.filter(i => i.type === 'section').forEach(s => {
          expect(s.tocLabel, `section ${s.id} missing tocLabel after save`).toBeTruthy();
        });
      } finally {
        fs.writeFileSync(targetFile, originalContent, 'utf8');
      }
    });

    test('reload editor after save — tocLabel persists (non-empty input values)', async ({ page }) => {
      // expense-management is the first project in portfolio.json — what gets auto-loaded
      const targetFile = path.join(ROOT, 'data/case-studies/expense-management.json');
      const originalContent = fs.readFileSync(targetFile, 'utf8');

      try {
        await openEditor(page);
        await page.locator('#btn-save-cs').click();
        await expect(page.locator('.save-toast--ok')).toBeVisible({ timeout: 5000 });

        // Reload and switch back to case study tab
        await page.reload();
        await page.locator('.tab-btn[data-tab="casestudy"]').click();
        await page.waitForSelector('#cs-body-editor .section-card', { timeout: 8000 });

        const firstCard = page.locator('#cs-body-editor .section-card').first();
        const tocLabelVal = await firstCard.locator('input').first().inputValue();
        expect(tocLabelVal.trim().length).toBeGreaterThan(0);
      } finally {
        fs.writeFileSync(targetFile, originalContent, 'utf8');
      }
    });

  });

  test('case study page renders correctly after file is not changed', async ({ page }) => {
    // Just verify the case study page still works end-to-end
    await page.goto('/case-study.html?id=fintech-onboarding');
    await expect(page.locator('.cs-toc a')).toHaveCount(7);
    for (const id of ['overview', 'problem', 'research', 'process', 'solution', 'results', 'learnings']) {
      await expect(page.locator(`#${id}`)).toBeAttached();
    }
  });

});
