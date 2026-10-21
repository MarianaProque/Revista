const {chromium}=require('C:/Users/marianaproque-ieg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');

async function inspectTurn(page, button, direction, prefix) {
  await page.locator(button).click();
  await page.waitForSelector(`.turning-sheet--${direction}`);
  const samples=[];
  for (const fraction of [.2,.45,.6,.85]) {
    const sample=await page.evaluate(async fraction=>{
      const leaf=document.querySelector('.turning-sheet');
      const animations=leaf.getAnimations({subtree:true});
      for(const animation of animations)animation.pause();
      await Promise.all(animations.map(a=>a.ready));
      for(const animation of animations)animation.currentTime=880*fraction;
      const matrix=new DOMMatrixReadOnly(getComputedStyle(leaf).transform);
      const front=Number(getComputedStyle(leaf.querySelector('.turn-face:not(.turn-face--back)')).opacity);
      const back=Number(getComputedStyle(leaf.querySelector('.turn-face--back')).opacity);
      const filters=[];
      for(let parent=leaf;parent;parent=parent.parentElement){if(getComputedStyle(parent).filter!=='none')filters.push(parent.className);}
      return {fraction,cosine:matrix.m11,front,back,filters};
    },fraction);
    assert.deepEqual(sample.filters,[],'Filtro achatando a cena 3D');
    if(sample.cosine>0) {assert.equal(sample.front,1);assert.equal(sample.back,0);}
    else {assert.equal(sample.front,0);assert.equal(sample.back,1);}
    samples.push(sample);
    await page.screenshot({path:`tmp/pdfs/${prefix}-${Math.round(fraction*100)}.png`});
  }
  await page.evaluate(()=>{for(const a of document.querySelector('.turning-sheet').getAnimations({subtree:true}))a.finish();});
  await page.waitForSelector('.turning-sheet',{state:'detached'});
  return samples;
}

(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1024}});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:8001/#materia-introducao',{waitUntil:'networkidle'});
    await page.waitForSelector('[data-ready="true"]');
    const report={forward:await inspectTurn(page,'#next-page','forward','turn-forward')};
    report.backward=await inspectTurn(page,'#previous-page','backward','turn-backward');
    await page.setViewportSize({width:390,height:844});
    await page.waitForTimeout(350);
    report.mobile=await inspectTurn(page,'#next-page','forward','turn-mobile');
    assert.deepEqual(errors,[]);
    fs.writeFileSync('tmp/pdfs/turn-faces.json',JSON.stringify(report,null,2));
    console.log('PASS: faces corretas em 12 quadros de viradas para frente, para trás e no celular; nenhum verso espelhado.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
