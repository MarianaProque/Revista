const { chromium } = require('C:/Users/marianaproque-ieg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(path.resolve(root,'..',file))).digest('hex').toUpperCase();
const preserved={'index.html':'D9967BC39D9003EC3A2015158DC1237A8D2CF30B0397D385007E3F7D8146C92D','style.css':'370E3082E75B17785E33BB07E93941126B188FBDD73B1742C84DCFF17613EF75','script.js':'E7213157B9A205C7E11AAF8126976D0EC717C77F0ED5175D97E575D6CE4D2234','assets/portrait/edition.json':'2BDE7371426A78C0EB7A3ACE1FE059E710E8D7BA62489369472F6255681A7004'};
(async()=>{
  for(const [file,expected] of Object.entries(preserved))assert.equal(hash(file),expected,'Revista com virada alterada');
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    const page=await browser.newPage({reducedMotion:'reduce'}),errors=[],report=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
    const edition=JSON.parse(fs.readFileSync(path.join(root,'assets/portrait/edition.json'),'utf8'));
    for(const viewport of [{width:1440,height:900},{width:1920,height:1080},{width:1280,height:720},{width:390,height:844},{width:320,height:720},{width:844,height:390},{width:568,height:320}]){
      await page.setViewportSize(viewport);
      await page.goto('http://127.0.0.1:8001/versao-rolagem/',{waitUntil:'networkidle'});
      await page.locator('.cover__collage').evaluate(img=>img.decode());
      const geometry=await page.evaluate(()=>{
        const cover=document.querySelector('.cover'),toc=document.querySelector('.contents');
        const cr=cover.getBoundingClientRect(),tr=toc.getBoundingClientRect();
        return {width:cr.width,height:cr.height,viewportWidth:document.documentElement.clientWidth,viewportHeight:innerHeight,contentsHeight:tr.height,titleSize:getComputedStyle(document.querySelector('h1')).fontSize,bodySize:getComputedStyle(document.querySelector('.article-flow')).fontSize,transform:getComputedStyle(document.querySelector('.magazine')).transform,overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,coverElementsFit:[...cover.querySelectorAll('*')].every(el=>{const r=el.getBoundingClientRect();return r.top>=-.5&&r.bottom<=innerHeight+.5&&r.left>=0&&r.right<=innerWidth;})};
      });
      assert.equal(geometry.width,geometry.viewportWidth,'Página deve ocupar toda a largura');
      assert.ok(geometry.height<=geometry.viewportHeight+.5,'Capa deve caber na primeira tela');
      assert.equal(geometry.coverElementsFit,true,'Elementos da capa devem caber na janela');
      assert.equal(geometry.transform,'none','Página inteira não deve ser escalada');
      assert.equal(geometry.overflow,false,'Rolagem horizontal');
      for(const chapter of edition.chapters)for(const [i,block]of chapter.blocks.entries())if(block.text){
        const rendered=await page.locator(`[data-block="${chapter.id}-${i}"]`).evaluate(el=>el.matches('[data-flow-text]')?el.textContent:el.querySelector('[data-flow-text]').textContent);
        assert.equal(rendered.replace(/\s+/g,' ').trim(),block.text.replace(/\s+/g,' ').trim(),'Texto editorial alterado');
      }
      assert.equal(await page.locator('.chapter').count(),18);
      assert.equal(await page.locator('.contents a').count(),18);
      await page.screenshot({path:path.join(root,'tmp',`native-cover-${viewport.width}.png`)});
      await page.locator('#sumario').evaluate(el=>el.scrollIntoView());
      await page.screenshot({path:path.join(root,'tmp',`native-contents-${viewport.width}.png`)});
      await page.locator('.contents a[href="#introducao"]').click();
      assert.equal(new URL(page.url()).hash,'#introducao');
      if(viewport.width===1440||viewport.width===390){
        await page.locator('#introducao img').evaluateAll(images=>Promise.all(images.map(img=>img.decode())));
        await page.screenshot({path:path.join(root,'tmp',`native-article-${viewport.width}.png`)});
      }
      report.push({viewport,...geometry});
    }
    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(root,'tmp/native-verification.json'),JSON.stringify({report,errors,mainProjectUnchanged:true},null,2));
    console.log(JSON.stringify({report,errors,mainProjectUnchanged:true},null,2));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
