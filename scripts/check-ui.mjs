// Run with Playwright installed locally, or PLAYWRIGHT_MODULE pointing to its package.
// Uses an installed Chrome and the production preview; no runtime app dependencies.
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const report = [];
const modes = ['endAmount', 'contribution', 'returnRate', 'startingAmount', 'years'];
const fields = ['startingAmount', 'endAmount', 'returnRate', 'years', 'contributionFrequency', 'contribution'];
await mkdir('docs/verification', { recursive: true });
try {
  for (const width of [320, 360, 390, 430, 680]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(process.env.PREVIEW_URL || 'http://127.0.0.1:4173/');
    const field = (id) => page.locator(`#${id}`);
    const fill = async (id, text) => { await field(id).click(); await field(id).press('ControlOrMeta+A'); await field(id).pressSequentially(text); };
    const value = async (id) => (await field(id).inputValue()).replace(/,/g, '');
    const calculate = async (mode) => {
      await page.getByRole('button', { name: '开始计算' }).click();
      if (await page.getByRole('alert').count()) throw new Error(`${mode}: ${await page.getByRole('alert').innerText()}`);
      await page.locator('.results').waitFor();
      assert.equal(await field(mode).inputValue(), '待计算');
      assert.equal(await field(mode).isDisabled(), true);
    };
    assert.equal(await page.locator('.results').count(), 0);
    assert.equal(await page.locator('.advanced-options').getAttribute('open'), null);
    await calculate('endAmount');
    assert.equal(await page.locator('.headline-value').innerText(), '¥198,290.40');
    await field('tab-contribution').click();
    assert.equal(await value('endAmount'), '');
    await fill('endAmount', '300000');
    await fill('startingAmount', '12345');
    await fill('returnRate', '7.5');
    await fill('years', '12.42');
    await calculate('contribution');
    await field('tab-returnRate').click();
    assert.equal(await value('contribution'), '1000');
    await calculate('returnRate');
    await field('tab-startingAmount').click();
    assert.equal(await value('returnRate'), '7.5');
    await calculate('startingAmount');
    await field('tab-years').click();
    assert.equal(await value('startingAmount'), '12345');
    await calculate('years');
    await field('tab-endAmount').click();
    assert.equal(await value('years'), '12.42');
    const positions = [];
    for (const mode of modes) {
      await field(`tab-${mode}`).click();
      assert.equal(await page.locator('.input-grid input:disabled').count(), 1);
      assert.equal(await field(mode).inputValue(), '待计算');
      const boxes = await Promise.all(fields.map((id) => field(id).evaluate((element) => {
        const { x, y, width, height } = element.closest('.field').getBoundingClientRect();
        return { x, y, width, height };
      })));
      for (let row = 0; row < 3; row++) {
        assert.equal(boxes[row * 2].y, boxes[row * 2 + 1].y);
        assert.ok(boxes[row * 2].x < boxes[row * 2 + 1].x);
      }
      positions.push(boxes.map(({ x, y, width, height }) => ({ x, y, width, height })));
    }
    for (const position of positions) assert.deepEqual(position, positions[0]);
    await page.locator('.advanced-options > summary').click();
    const advanced = await Promise.all(['compoundFrequency', 'contributionTiming'].map((id) => field(id).boundingBox()));
    assert.equal(advanced[0].y, advanced[1].y);
    assert.equal(await value('compoundFrequency'), 'annually');
    assert.equal(await value('contributionTiming'), 'end');
    await page.locator('.advanced-options > summary').click();
    await field('tab-endAmount').click();
    await fill('startingAmount', '100000');
    await fill('contribution', '-1000');
    await fill('returnRate', '6');
    await fill('years', '5');
    await calculate('endAmount');
    assert.ok((await page.locator('.results').innerText()).includes('累计提取金额'));
    await page.locator('.annual-details > summary').click();
    await page.locator('tbody tr').first().waitFor();
    assert.equal(await page.locator('tbody tr').count(), 5);
    assert.ok((await page.locator('tbody tr').first().innerText()).includes('-¥12,000.00'));
    const dimensions = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
    assert.equal(dimensions.document, width);
    if (width === 390) await page.screenshot({ path: 'docs/verification/withdrawals-390.png', fullPage: true });
    await fill('years', '100');
    await page.getByRole('button', { name: '开始计算' }).click();
    assert.ok((await page.getByRole('alert').innerText()).includes('资产不足'));
    assert.equal(await page.locator('.results').count(), 0);
    await field('tab-years').click();
    await fill('endAmount', '0');
    await calculate('years');
    assert.ok(!(await page.locator('.results').innerText()).match(/NaN|Infinity|undefined/));
    assert.deepEqual(errors, []);
    report.push({ width, fixedTwoColumns: true, stablePositionsAcrossModes: true, noResultBackfill: true, withdrawals: true, exhaustion: true, advancedOneRow: true, ...dimensions, errors });
    await page.close();
  }
  await writeFile('docs/verification/layout-withdrawals-browser.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
