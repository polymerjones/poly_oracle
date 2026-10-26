const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'/Users/paulfisher/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});try{
 const p=await browser.newPage({viewport:{width:430,height:932},deviceScaleFactor:3});p.setDefaultTimeout(15000);
 await p.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:8765')?r.continue():r.abort());
 await p.goto('http://127.0.0.1:8765',{waitUntil:'domcontentloaded'});await p.locator('#playStroidsTile').click();await p.locator('#btnArcade').click();await p.locator('#btnArcadeNew').click();await p.waitForTimeout(5000);
 await p.evaluate(async()=>{const app=await window.pixiRenderer.init();window.__counts={draw:0,render:0,effectTicks:0};
  const probe=()=>{window.__counts.effectTicks++};app.ticker.add(probe);window.__removeProbe=()=>app.ticker.remove(probe);
  const render=app.renderer.render;app.renderer.render=function(...args){window.__counts.render++;return render.apply(this,args)};
  const draw=window.pixiRenderer.draw;window.pixiRenderer.draw=function(...args){window.__counts.draw++;return draw.apply(this,args)};
 });
 await p.waitForTimeout(3000);const result=await p.evaluate(()=>window.__counts);
 console.log(result);fs.writeFileSync(process.argv[2]||'docs/performance/render-count-baseline.json',JSON.stringify(result,null,2));
 await p.evaluate(()=>window.__removeProbe());
 if(result.draw<20)throw new Error('Insufficient gameplay frames to test');
 if(result.effectTicks!==result.draw)throw new Error('Effect ticker is no longer advanced once per draw');
 if(result.render!==result.draw)throw new Error(`Expected one render per draw: ${result.render} renders / ${result.draw} draws`);
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
