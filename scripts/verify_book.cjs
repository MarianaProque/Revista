const { chromium } = require('C:/Users/marianaproque-ieg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const base = 'http://127.0.0.1:8001';
const normalize = text => text.replace(/\s+/g,' ').trim();

async function audit(page) {
  const source = JSON.parse(fs.readFileSync('assets/portrait/edition.json','utf8'));
  const missing = [];
  for (const chapter of source.chapters) {
    for (const [i, block] of chapter.blocks.entries()) {
      if (block.src) assert.equal(fs.existsSync(block.src), true, block.src);
      for (const person of block.people || []) assert.equal(fs.existsSync(person.src), true, person.src);
      if (!block.text) continue;
      const chunks = await page.locator(`[data-block="${chapter.id}-${i}"]`).evaluateAll(elements => elements.map(e => e.matches('[data-flow-text]') ? e.textContent : e.querySelector('[data-flow-text]')?.textContent || ''));
      if (normalize(chunks.join(' ')) !== normalize(block.text)) missing.push(`${chapter.id}/${i}`);
      if (block.type === 'callout' && chunks.length > 1) {
        const fragments = page.locator(`[data-block="${chapter.id}-${i}"]`);
        for (let part = 1; part < chunks.length; part++) {
          assert.equal(await fragments.nth(part).locator('.callout__continuation').count(), 1, 'Caixa dividida sem indicação de continuação');
          if (block.title) assert.equal(await fragments.nth(part).locator('h3').textContent(), block.title);
        }
      }
    }
  }
  const overflow = await page.locator('.sheet').evaluateAll(sheets => sheets.flatMap(sheet => {
    const hidden = sheet.hidden;
    sheet.hidden = false;
    const content = sheet.querySelector('.sheet__content');
    const bad = content && content.scrollHeight > content.clientHeight + 2;
    sheet.hidden = hidden;
    return bad ? [sheet.dataset.page] : [];
  }));
  assert.deepEqual(missing, [], 'Texto ausente ou alterado');
  assert.deepEqual(overflow, [], 'Páginas com conteúdo cortado');
  const empty = await page.locator('.book > .sheet:not(.sheet--cover)').evaluateAll(sheets => sheets
    .filter(sheet => !sheet.querySelector('.sheet__content [data-block], .sheet__content .toc-link'))
    .map(sheet => sheet.dataset.page));
  assert.deepEqual(empty, [], 'Folhas vazias ou com apenas título');
  const shared = await page.locator('.book > .sheet[data-chapters*=" "]').count();
  assert.ok(shared > 0, 'Tópicos devem aproveitar o espaço disponível na folha anterior');
  const mismatchedHeaders = await page.locator('.book > .sheet[data-chapters*=" "]').evaluateAll(sheets => sheets.filter(sheet => {
    const label = sheet.querySelector('.sheet__running-head span:last-child');
    return !label?.textContent.includes(' / ');
  }).map(sheet => sheet.dataset.page));
  assert.deepEqual(mismatchedHeaders, [], 'Cabeçalhos devem identificar os tópicos compartilhados');
  for (const chart of ['energy', 'pue']) {
    const file = `assets/portrait/${chart}.png`;
    assert.ok(fs.statSync(file).size > 10000, 'Gráfico original ausente');
    assert.equal(await page.locator(`.figure--chart img[src="${file}"]`).count(), 1);
  }
  for (const chapter of source.chapters) {
    assert.equal(await page.locator(`h2[data-section="${chapter.id}"]`).count(), 1, `Título: ${chapter.id}`);
    const number = Number(await page.locator(`.toc-link[data-topic="${chapter.id}"] .toc-number`).textContent());
    assert.ok((await page.locator(`.book > .sheet[data-page="${number}"]`).getAttribute('data-chapters')).split(' ').includes(chapter.id), `Sumário: ${chapter.id}`);
  }
  return { sheets: await page.locator('.book > .sheet').count(), missingText: missing, clippedPages: overflow, emptyPages: empty, sharedPages: shared };
}

(async () => {
  const browser = await chromium.launch({channel:'chrome',headless:true});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:1024}});
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base,{waitUntil:'networkidle'});
    await page.waitForSelector('[data-ready="true"]',{timeout:30000});
    await page.waitForFunction(()=>document.querySelector('.cover__collage')?.complete);
    assert.equal(await page.locator('#topic-select, .reader-header, .reader-nav').count(),0);
    const report={desktop:await audit(page)};
    assert.ok(report.desktop.sheets <= 25, 'A edição revisada deve usar no máximo 25 folhas em 1440×1024');
    assert.equal(await page.locator('.book > .sheet:visible').count(),1);
    assert.equal(await page.locator('#previous-page').isDisabled(),true);
    await page.screenshot({path:'tmp/pdfs/book-cover.png'});
    await page.locator('#next-page').click();
    await page.waitForSelector('.turning-sheet');
    await page.screenshot({path:'tmp/pdfs/book-turn.png'});
    await page.waitForSelector('.turning-sheet',{state:'detached'});
    assert.equal(await page.locator('.book > .sheet:visible').count(),2);
    await page.screenshot({path:'tmp/pdfs/book-contents.png'});
    await page.locator('.toc-link[data-topic="introducao"]').click();
    await page.waitForSelector('.turning-sheet',{state:'detached'});
    await page.waitForFunction(()=>location.hash==='#materia-introducao');
    await page.screenshot({path:'tmp/pdfs/book-article.png'});
    await page.goBack();
    await page.waitForFunction(()=>document.querySelector('.book > .sheet:not([hidden])')?.dataset.chapter==='sumario');
    await page.locator('#previous-page').click();
    await page.waitForSelector('.turning-sheet--backward');
    await page.waitForSelector('.turning-sheet',{state:'detached'});
    assert.equal(await page.locator('#page-status').textContent(),'Capa');
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.evaluate(()=>{location.hash='materia-paracatu';});
    await page.waitForFunction(()=>location.hash==='#materia-paracatu');
    assert.equal(await page.locator('.turning-sheet').count(),0);
    await page.setViewportSize({width:390,height:844});
    await page.waitForTimeout(350);
    assert.ok((await page.locator('.book > .sheet:visible').first().getAttribute('data-chapters')).split(' ').includes('paracatu'));
    assert.equal(await page.locator('.book > .sheet:visible').count(),1);
    report.mobile=await audit(page);
    assert.ok(report.mobile.sheets <= 36, 'A edição revisada deve usar no máximo 36 folhas em 390×844');
    report.horizontalOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
    report.verticalOverflow=await page.evaluate(()=>document.documentElement.scrollHeight>innerHeight);
    await page.screenshot({path:'tmp/pdfs/book-mobile.png'});
    await page.evaluate(()=>{location.hash='capa';});
    await page.waitForFunction(()=>document.querySelector('#page-status').textContent==='Capa');
    await page.screenshot({path:'tmp/pdfs/book-mobile-cover.png'});
    await page.locator('#reader-stage').dispatchEvent('pointerdown',{pointerId:7,pointerType:'touch',clientX:300,clientY:400,button:0});
    await page.locator('#reader-stage').dispatchEvent('pointerup',{pointerId:7,pointerType:'touch',clientX:90,clientY:410,button:0});
    assert.equal(await page.locator('#previous-page').isDisabled(),false);
    await page.locator('#next-page').focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('#previous-page').isDisabled(),false);
    await page.evaluate(()=>{location.hash='materia-creditos';});
    await page.waitForFunction(()=>location.hash==='#materia-creditos');
    // The final chapter can span more than one leaf on narrow devices.
    while (!await page.locator('#next-page').isDisabled()) await page.locator('#next-page').click();
    assert.equal(await page.locator('#next-page').isDisabled(),true);
    await page.reload({waitUntil:'networkidle'});
    await page.waitForSelector('[data-ready="true"]');
    report.additionalViewports = {};
    for (const viewport of [{width:320,height:720},{width:768,height:1024},{width:1280,height:720},{width:1920,height:1080}]) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(350);
      report.additionalViewports[`${viewport.width}x${viewport.height}`] = await audit(page);
    }
    report.errors=errors;
    assert.deepEqual(errors,[]);
    assert.equal(report.horizontalOverflow,false);
    assert.equal(report.verticalOverflow,false);
    fs.writeFileSync('tmp/pdfs/book-verification.json',JSON.stringify(report,null,2));
    console.log(JSON.stringify(report,null,2));
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
