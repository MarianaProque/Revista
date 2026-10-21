const { chromium } = require('C:/Users/marianaproque-ieg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const parent = path.resolve(root, '..');
const base = 'http://127.0.0.1:8001/versao-rolagem/';
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').toUpperCase();
const preserved = {
  'index.html':'D9967BC39D9003EC3A2015158DC1237A8D2CF30B0397D385007E3F7D8146C92D',
  'style.css':'370E3082E75B17785E33BB07E93941126B188FBDD73B1742C84DCFF17613EF75',
  'script.js':'E7213157B9A205C7E11AAF8126976D0EC717C77F0ED5175D97E575D6CE4D2234',
  'texto.html':'D600DAE19C3F07DB02CCB873DFE3BF465F13D3672CEC4DB90E1DB1A48912DBE6',
  'contents.css':'EA9BC71BCC7B90F9FDCC952A90EDEF9B22A5001218628F4CCADD2A427BF991F3',
  'README.md':'D598249EED187E24AE5ADC3578CE1024CB5766230C5A79F28618C0045E5BA25F',
  'assets/portrait/edition.json':'2BDE7371426A78C0EB7A3ACE1FE059E710E8D7BA62489369472F6255681A7004',
};
(async () => {
  const output = path.join(root, 'tmp');
  fs.mkdirSync(output, {recursive:true});
  for (const [file, checksum] of Object.entries(preserved)) assert.equal(hash(path.join(parent,file)), checksum, `Revista principal alterada: ${file}`);
  for (let i=1;i<=25;i++) {
    const file=`assets/page-${String(i).padStart(2,'0')}.svg`;
    assert.equal(hash(path.join(root,file)),hash(path.join(parent,file)),`Arte alterada: ${file}`);
  }
  const browser = await chromium.launch({channel:'chrome',headless:true});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:1024},reducedMotion:'reduce'});
    const errors=[];
    const requests=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error'){errors.push(message.text());console.error(message.text());}});
    page.on('response',response=>{if(response.status()>=400)errors.push(`${response.status()} ${response.url()}`);});
    page.on('request',request=>requests.push(request.url()));
    await page.goto(base,{waitUntil:'networkidle'});
    await page.waitForSelector('#pagina-1[data-loaded="true"]');
    assert.equal(await page.locator('.page').count(),25);
    assert.equal(await page.locator('.turning-sheet, .pager, .reader-header').count(),0);
    await page.screenshot({path:path.join(output,'desktop-cover.png')});
    const geometry = await page.locator('.page').evaluateAll(pages=>pages.map(page=>{
      const r=page.getBoundingClientRect();return {width:r.width,height:r.height,top:r.top+scrollY};
    }));
    assert.equal(geometry[0].width,1440);
    assert.equal(geometry[0].height,1024);
    let expectedTop=0;
    geometry.forEach(r=>{
      assert.ok(Math.abs(r.top-expectedTop)<.1,'Não deve haver espaço entre páginas');
      expectedTop+=r.height;
    });
    await page.locator('#pagina-2').scrollIntoViewIfNeeded();
    await page.waitForSelector('#pagina-2[data-loaded="true"]');
    await page.screenshot({path:path.join(output,'desktop-contents.png')});
    await page.locator('.contents-link').first().click();
    await page.waitForSelector('#pagina-4[data-loaded="true"]');
    assert.equal(new URL(page.url()).hash,'#pagina-4');
    await page.setViewportSize({width:360,height:256});
    for(let i=1;i<=25;i++) {
      await page.evaluate(number=>{location.hash=`pagina-${number}`;},i);
      await page.waitForSelector(`#pagina-${i}[data-loaded="true"]`,{timeout:60000});
      await page.waitForLoadState('networkidle');
      await page.locator(`#pagina-${i}`).screenshot({path:path.join(output,`page-${String(i).padStart(2,'0')}.png`)});
    }
    const duplicates=await page.locator('svg [id]').evaluateAll(elements=>{
      const ids=elements.map(e=>e.id);return ids.length-new Set(ids).size;
    });
    assert.equal(duplicates,0,'Colisão de IDs entre páginas SVG');
    assert.equal(await page.locator('.page[data-error="true"]').count(),0);
    await page.setViewportSize({width:390,height:844});
    await page.evaluate(()=>{location.hash='pagina-1';});
    await page.waitForTimeout(100);
    const mobile=await page.locator('#pagina-1').boundingBox();
    assert.ok(Math.abs(mobile.width/mobile.height-1440/1024)<.001);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.screenshot({path:path.join(output,'mobile-scroll.png')});
    const foreign = requests.filter(url=>!url.startsWith(base));
    assert.deepEqual(foreign,[],'A subpasta deve usar somente arquivos próprios');
    const responsive = [];
    for (const viewport of [{width:320,height:720},{width:844,height:390},{width:768,height:1024},{width:1920,height:1080},{width:2560,height:1440}]) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(100);
      const size = await page.locator('#pagina-1').evaluate(element => {
        const bounds = element.getBoundingClientRect();
        const artwork = element.querySelector('.page__artwork').getBoundingClientRect();
        return {viewport:document.documentElement.clientWidth,viewportHeight:innerHeight,left:bounds.left,width:bounds.width,height:bounds.height,artworkWidth:artwork.width,artworkHeight:artwork.height,overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth};
      });
      assert.equal(size.width,size.viewport,'Revista deve preencher toda a largura da janela');
      assert.equal(size.left,0,'Não deve haver margem lateral');
      assert.equal(size.overflow,false,'Não deve haver rolagem horizontal');
      assert.ok(Math.abs(size.height-size.width*1024/1440)<.1,'Proporções originais devem ser preservadas');
      assert.ok(Math.abs(size.artworkWidth-size.width)<.1,'Arte deve acompanhar a largura da folha');
      assert.ok(Math.abs(size.artworkHeight-size.height)<.1,'Arte não deve ser cortada ou esticada');
      const contents=await page.locator('#pagina-2,#pagina-3').evaluateAll(pages=>pages.map(page=>{
        const r=page.getBoundingClientRect();
        const art=page.querySelector('.page__artwork').getBoundingClientRect();
        return {width:r.width,height:r.height,artworkWidth:art.width};
      }));
      for (const entry of contents) {
        assert.equal(entry.width,size.viewport,'Sumário deve manter a largura original da revista');
        assert.ok(Math.abs(entry.width-entry.artworkWidth)<.1,'Escala do sumário incorreta');
      }
      responsive.push(size);
      if(viewport.width===1920) {
        await page.evaluate(()=>scrollTo(0,0));
        await page.screenshot({path:path.join(output,'desktop-restored-cover.png')});
        await page.evaluate(()=>document.getElementById('pagina-2').scrollIntoView());
        await page.screenshot({path:path.join(output,'desktop-restored-contents.png')});
      }
    }
    await page.goto(`${base}texto.html`,{waitUntil:'networkidle'});
    assert.equal(await page.locator('.text-reader > section').count(),25);
    const report={pages:25,loaded:25,desktopGeometry:geometry[0],mobileGeometry:{width:mobile.width,height:mobile.height},responsive,duplicateIds:duplicates,requestsOutsideSubfolder:foreign,mainProjectUnchanged:true,errors};
    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify(report,null,2));
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
