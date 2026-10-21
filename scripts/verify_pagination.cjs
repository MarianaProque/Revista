const { chromium } = require('C:/Users/marianaproque-ieg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1024 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:8001', { waitUntil: 'networkidle' });
    await page.waitForSelector('#pagina-1[data-loaded="true"]');
    assert.equal(await page.locator('.page:visible').count(), 1);
    assert.equal(await page.locator('#previous-page').isDisabled(), true);
    await page.locator('#next-page').click();
    await page.waitForSelector('#pagina-2[data-loaded="true"]');
    assert.equal(await page.locator('#page-status').textContent(), '2 / 25');
    await page.locator('#pagina-2 .contents-link').first().click();
    await page.waitForSelector('#pagina-4[data-loaded="true"]');
    assert.equal(await page.locator('#topic-select').inputValue(), '4');
    await page.goBack();
    assert.equal(await page.locator('#page-status').textContent(), '2 / 25');
    await page.locator('#topic-select').selectOption('17');
    await page.waitForSelector('#pagina-17[data-loaded="true"]');
    await page.locator('#next-page').click();
    assert.equal(await page.locator('#topic-select').inputValue(), '17');
    assert.equal(await page.locator('#page-status').textContent(), '18 / 25');
    await page.locator('#next-page').focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('#page-status').textContent(), '19 / 25');
    await page.locator('#topic-select').selectOption('25');
    assert.equal(await page.locator('#next-page').isDisabled(), true);
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.locator('#page-status').textContent(), '25 / 25');
    await page.locator('#topic-select').selectOption('15');
    await page.waitForSelector('#pagina-15[data-loaded="true"]');
    await page.evaluate(async () => {
      await Promise.all([...document.querySelectorAll('#pagina-15 svg image')].map(element => {
        const image = new Image();
        image.src = element.getAttributeNS('http://www.w3.org/1999/xlink', 'href') || element.getAttribute('href');
        return image.decode();
      }));
    });
    await page.screenshot({ path: 'tmp/pdfs/pagination-desktop.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: 'tmp/pdfs/pagination-mobile.png' });
    assert.equal(await page.locator('.page:visible').count(), 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.equal(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight), false);
    assert.deepEqual(errors, []);
    console.log('PASS: página única, tópicos, anterior/próxima, limites, sumário, histórico, teclado, recarga e mobile sem rolagem.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
