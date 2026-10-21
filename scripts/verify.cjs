const { chromium } = require('C:/Users/marianaproque-ieg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const origin = process.env.MAGAZINE_URL || 'http://127.0.0.1:8001';

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1024 }, deviceScaleFactor: 1 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  await page.goto(origin, { waitUntil: 'networkidle' });
  await page.waitForSelector('#pagina-1[data-loaded="true"]');
  await page.screenshot({ path: 'tmp/pdfs/web-cover.png' });
  const report = { pages: await page.locator('article.page').count(), links: await page.locator('.contents-link').count(), errors };
  await page.goto(`${origin}/#pagina-2`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#pagina-2[data-loaded="true"]');
  await page.screenshot({ path: 'tmp/pdfs/web-contents.png' });
  await page.locator('.contents-link').first().click();
  await page.waitForSelector('#pagina-4[data-loaded="true"]');
  report.contentsDestination = new URL(page.url()).hash;
  await page.screenshot({ path: 'tmp/pdfs/web-editorial.png' });
  await page.setViewportSize({ width: 360, height: 256 });
  for (let i = 1; i <= 25; i++) {
    await page.evaluate(n => { location.hash = `pagina-${n}`; }, i);
    await page.waitForSelector(`#pagina-${i}[data-loaded="true"]`, { timeout: 60000 });
    await page.waitForLoadState('networkidle');
    await page.locator(`#pagina-${i}`).screenshot({path:`tmp/pdfs/check-${String(i).padStart(2,'0')}.png`});
  }
  report.loaded = await page.locator('.page[data-loaded="true"]').count();
  report.vectorImages = await page.locator('svg image').count();
  report.externalRequests = await page.evaluate(() => performance.getEntriesByType('resource').filter(r => new URL(r.name).origin !== location.origin).length);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin, { waitUntil: 'networkidle' });
  await page.waitForSelector('#pagina-1[data-loaded="true"]');
  report.mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  await page.screenshot({ path: 'tmp/pdfs/web-mobile.png' });
  await page.goto(`${origin}/texto.html`, { waitUntil: 'networkidle' });
  report.textSections = await page.locator('.text-reader > section').count();
  report.errors = errors;
  fs.writeFileSync('tmp/pdfs/verification.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  if (errors.length || report.loaded !== 25 || report.mobileOverflow || report.contentsDestination !== '#pagina-4') process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
