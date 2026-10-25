// Counts canvas backing-store churn during Arcade gameplay: width/height writes per canvas,
// new canvases created, and 2D gradient creation. Each write/creation reallocates a GPU buffer on iOS.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'/Users/paulfisher/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});try{
 const p=await b.newPage({viewport:{width:430,height:932},deviceScaleFactor:3});p.setDefaultTimeout(15000);
 await p.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:8765')?r.continue():r.abort());
 await p.addInitScript(()=>{const c=window.__churn={sizeWrites:{},created:0,createdStacks:{},gradients:{},on:false};
  const label=(el)=>el.id||el.className||(el.isConnected?'(attached)':'(detached)');
  const stack=()=>{const s=(new Error().stack||'').split('\n').slice(3,5).map(l=>l.trim().replace(/^at /,'').replace(/https?:\/\/[^/]+\//,'')).join(' < ');return s};
  for(const prop of ['width','height']){const d=Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype,prop);
   Object.defineProperty(HTMLCanvasElement.prototype,prop,{configurable:true,get:d.get,set(v){if(c.on){const k=label(this)+' <- '+stack();c.sizeWrites[k]=(c.sizeWrites[k]||0)+1}return d.set.call(this,v)}})}
  const ce=Document.prototype.createElement;Document.prototype.createElement=function(t,...a){if(c.on&&String(t).toLowerCase()==='canvas'){c.created++;const k=stack();c.createdStacks[k]=(c.createdStacks[k]||0)+1}return ce.call(this,t,...a)};
  const C=CanvasRenderingContext2D.prototype;for(const m of ['createRadialGradient','createLinearGradient']){const f=C[m];C[m]=function(...a){if(c.on){const k=label(this.canvas)+' '+m+' <- '+stack();c.gradients[k]=(c.gradients[k]||0)+1}return f.apply(this,a)}}});
 await p.goto('http://127.0.0.1:8765',{waitUntil:'domcontentloaded'});await p.locator('#openGalaxy').click();await p.locator('#btnArcade').click();await p.locator('#btnArcadeNew').click();await p.waitForTimeout(6000);
 // Tap around the playfield so weapons/effects fire.
 await p.evaluate(()=>window.__churn.on=true);
 for(let i=0;i<25;i++){await p.mouse.click(60+(i*53)%310,220+(i*97)%420);await p.waitForTimeout(200)}
 const r=await p.evaluate(()=>window.__churn);r.on=undefined;
 const top=(o)=>Object.entries(o).sort((a,b)=>b[1]-a[1]).slice(0,15);
 const out={windowS:5,sizeWrites:top(r.sizeWrites),created:r.created,createdStacks:top(r.createdStacks),gradients:top(r.gradients)};
 console.log(JSON.stringify(out,null,1));fs.writeFileSync(process.argv[2]||'/dev/null',JSON.stringify(out,null,2));
}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
