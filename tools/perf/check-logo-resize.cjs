const {chromium}=require(process.env.PLAYWRIGHT_MODULE || '/Users/paulfisher/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});try{
 const p=await b.newPage({viewport:{width:430,height:932},deviceScaleFactor:3});
 await p.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:8765')?r.continue():r.abort());
 await p.addInitScript(()=>{
  window.__logoWrites={width:0,height:0};
  for(const key of ['width','height']){const d=Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype,key);Object.defineProperty(HTMLCanvasElement.prototype,key,{...d,set(v){if(this.id==='menuLogoCanvas')window.__logoWrites[key]++;return d.set.call(this,v)}})}
 });
 await p.goto('http://127.0.0.1:8765',{waitUntil:'domcontentloaded'});await p.locator('#playStroidsTile').click();await p.waitForTimeout(4000);
 async function sample(name){await p.evaluate(()=>window.__logoWrites={width:0,height:0});await p.waitForTimeout(6000);return {name,...await p.evaluate(()=>({writes:window.__logoWrites,width:menuLogoCanvas.width,height:menuLogoCanvas.height,cssWidth:getComputedStyle(menuLogoCanvas).width,visualWidth:menuLogoCanvas.getBoundingClientRect().width}))}}
 const results=[await sample('breathing-enabled')];await p.addStyleTag({content:'#menuLogoCanvas {animation:none!important}'});await p.waitForTimeout(500);results.push(await sample('breathing-disabled'));
 await p.setViewportSize({width:390,height:844});await p.waitForTimeout(500);
 const resized=await p.locator('#menuLogoCanvas').evaluate(c=>({width:c.width,cssWidth:parseFloat(getComputedStyle(c).width),dpr:Math.min(2,devicePixelRatio)}));
 if(Math.abs(resized.width-Math.round(resized.cssWidth*resized.dpr))>1)throw new Error('Canvas did not adapt to viewport resize');
 results.push({name:'viewport-resize',...resized});
 console.log(JSON.stringify(results,null,2));fs.writeFileSync(process.argv[2]||'docs/performance/logo-resize-baseline.json',JSON.stringify(results,null,2));
 if(process.env.EXPECT_STABLE==='1' && results[0].writes.width+results[0].writes.height!==0)throw new Error('Logo backing store changes while only transform animates');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
