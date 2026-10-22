const {chromium}=require('C:/Users/marianaproque-ieg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict'), fs=require('node:fs'), path=require('node:path'), crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),parent=path.resolve(root,'..');
const base=process.env.MAGAZINE_URL||'http://127.0.0.1:8002/versao-rolagem/';
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const preserved=['index.html','style.css','script.js','texto.html','README.md','assets/portrait/edition.json'];
const before=Object.fromEntries(preserved.map(file=>[file,hash(path.join(parent,file))]));
async function isOpen(button,expected){
  assert.equal(await button.getAttribute('aria-expanded'),String(expected));
  const state=await button.evaluate(el=>({caption:getComputedStyle(el.querySelector('.photo-hotspot__caption')).opacity,shade:getComputedStyle(el,'::after').opacity,hidden:el.querySelector('.photo-hotspot__caption').getAttribute('aria-hidden')}));
  assert.equal(state.caption,expected?'1':'0');assert.equal(state.shade,expected?'1':'0');assert.equal(state.hidden,String(!expected));
}
(async()=>{
  const output=path.join(root,'tmp');fs.mkdirSync(output,{recursive:true});
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const errors=[],report={desktop:[],responsive:[],touch:[],mainProjectUnchanged:false};
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1024},reducedMotion:'reduce'});
    page.on('pageerror',e=>errors.push(e.message));
    page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
    for(const number of [11,13]){
      await page.goto(`${base}#pagina-${number}`,{waitUntil:'networkidle'});
      await page.waitForSelector(`#pagina-${number}[data-loaded="true"]`);
      const button=page.locator(`#pagina-${number} .photo-hotspot`);
      const fixed=page.locator(`#pagina-${number} [data-static-photo-caption="true"]`);
      assert.ok(await fixed.count()>0,'A legenda fixa do PDF deve ser ocultada');
      assert.equal(await fixed.evaluateAll(paths=>paths.every(path=>getComputedStyle(path).visibility==='hidden')),true);
      await button.scrollIntoViewIfNeeded();await page.mouse.move(0,0);
      await isOpen(button,false);
      const geometry=await button.boundingBox();
      assert.equal(Math.round(geometry.width),number===11?1042:595);
      assert.equal(Math.round(geometry.height),number===11?287:328);
      await button.screenshot({path:path.join(output,`photo-${number}-normal.png`)});
      await page.locator(`#pagina-${number}`).screenshot({path:path.join(output,`photo-${number}-page-normal.png`)});
      await button.hover();await isOpen(button,true);
      const after=await button.boundingBox();assert.deepEqual(after,geometry,'Hover não pode mover nem redimensionar a foto');
      await button.screenshot({path:path.join(output,`photo-${number}-hover.png`)});
      await page.locator(`#pagina-${number}`).screenshot({path:path.join(output,`photo-${number}-page-hover.png`)});
      await page.mouse.move(0,0);await isOpen(button,false);
      await page.keyboard.press('Tab');await button.focus();await isOpen(button,true);
      await page.keyboard.press('Escape');await isOpen(button,false);
      await page.keyboard.press('Enter');await isOpen(button,true);
      await page.keyboard.press('Escape');await isOpen(button,false);
      report.desktop.push({page:number,normal:true,hover:true,mouseLeave:true,keyboard:true,escape:true,geometry});
    }
    for(const width of [320,390,768,1920]){
      await page.setViewportSize({width,height:900});
      await page.waitForTimeout(100);
      for(const number of [11,13]){
        const button=page.locator(`#pagina-${number} .photo-hotspot`);
        // Both leaves may not yet be loaded after navigation/reload.
        if(!await button.count()){
          await page.evaluate(n=>{location.hash=`pagina-${n}`;},number);
          await page.waitForSelector(`#pagina-${number}[data-loaded="true"]`);
        }
        const bounds=await button.boundingBox();
        assert.ok(Math.abs(bounds.width-(number===11?1042:595)*width/1440)<.1,'Imagem desalinhada ao redimensionar');
      }
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      report.responsive.push(width);
    }
    const mobile=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
    mobile.on('pageerror',e=>errors.push(e.message));
    for(const number of [11,13]){
      await mobile.goto(`${base}#pagina-${number}`,{waitUntil:'networkidle'});
      await mobile.waitForSelector(`#pagina-${number}[data-loaded="true"]`);
      const button=mobile.locator(`#pagina-${number} .photo-hotspot`);
      assert.ok(await mobile.locator(`#pagina-${number} [data-static-photo-caption="true"]`).count()>0,'A legenda fixa também deve ficar oculta no celular');
      await button.tap();await isOpen(button,true);
      await button.tap();await isOpen(button,false);
      await button.tap();await isOpen(button,true);
      await mobile.touchscreen.tap(2,2);await isOpen(button,false);
      report.touch.push({page:number,toggle:true,outsideDismiss:true});
    }
    assert.deepEqual(errors,[]);
    for(const file of preserved)assert.equal(hash(path.join(parent,file)),before[file],`Revista principal modificada: ${file}`);
    report.mainProjectUnchanged=true;report.errors=errors;
    fs.writeFileSync(path.join(output,'photo-hover-verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
