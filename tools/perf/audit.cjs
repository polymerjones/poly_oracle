// Local Chromium baseline. Not a native-device CPU or battery measurement.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/Users/paulfisher/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('fs');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
 try {
 const page=await browser.newPage({viewport:{width:430,height:932},deviceScaleFactor:3});
 page.setDefaultTimeout(12000);
 await page.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:8765') || route.request().url().startsWith('data:') ? route.continue() : route.abort());
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
   const raf=window.requestAnimationFrame.bind(window); const counts={};window.__perfCounts=counts;
   window.requestAnimationFrame=fn=>{const key=fn.name||'anonymous';return raf(t=>{counts[key]=(counts[key]||0)+1;fn(t)})};
 });
 await page.goto('http://127.0.0.1:8765',{waitUntil:'domcontentloaded'});await page.waitForTimeout(8000);
 const cdp=await page.context().newCDPSession(page);await cdp.send('Performance.enable');
 const samples=[];
 async function measure(name){
  await page.evaluate(()=>{for(const k in window.__perfCounts)delete window.__perfCounts[k]});
  const a=(await cdp.send('Performance.getMetrics')).metrics;
  await page.waitForTimeout(10000);
  const b=(await cdp.send('Performance.getMetrics')).metrics;
  const m=Object.fromEntries(b.map(x=>[x.name,x.value]));const old=Object.fromEntries(a.map(x=>[x.name,x.value]));
  const data=await page.evaluate(()=>({frames:window.__perfCounts,animations:document.getAnimations().map(a=>({name:a.animationName,state:a.playState,id:a.effect?.target?.id,tag:a.effect?.target?.tagName})),videos:[...document.querySelectorAll('video')].map(v=>({id:v.id,paused:v.paused,ready:v.readyState})),visibleButtons:[...document.querySelectorAll('button')].filter(x=>x.getClientRects().length).map(x=>({id:x.id,text:x.textContent.trim()}))}));
  samples.push({name,seconds:m.Timestamp-old.Timestamp,taskMs:(m.TaskDuration-old.TaskDuration)*1000,scriptMs:(m.ScriptDuration-old.ScriptDuration)*1000,layoutMs:(m.LayoutDuration-old.LayoutDuration)*1000,heap:m.JSHeapUsedSize,...data});
  fs.writeFileSync(process.argv[2]||'docs/performance/browser-baseline.json',JSON.stringify({environment:'Headless desktop Chromium, web path, 430x932 DPR3, 10s samples; external network blocked; not native CPU',errors,samples},null,2));
  console.log(JSON.stringify(samples.at(-1)));
 }
 await measure('oracle-idle');
 if(process.env.PERF_ISOLATE){
  await page.addStyleTag({content:'#oracleBgWarmup.warmup-done .warmup-pip {animation:none}'});
  await measure('oracle-no-warmup-pulse');
  await page.evaluate(()=>{oracleBgController.stop();document.getElementById('oracleBgVideo').pause()});
  await measure('oracle-no-video');
  if (!(await page.locator('#oracleBgVideo').evaluate(v=>v.paused))) throw new Error('Video isolation invalid: playback restarted');
 }
 await page.locator('#openGalaxy').click();await page.waitForTimeout(4000);await measure('stroids-menu');
 await page.locator('#btnGalaxyBack').click();await page.waitForTimeout(4000);await measure('oracle-return');
 await page.locator('#openGalaxy').click();await page.waitForTimeout(1000);await page.locator('#btnArcade').click();await page.locator('#btnArcadeNew').click();await page.waitForTimeout(8000);await measure('arcade-start');
 await page.locator('#arcadeBack').click();await page.waitForTimeout(1000);await measure('menu-after-play');
 fs.writeFileSync(process.argv[2]||'docs/performance/browser-baseline.json',JSON.stringify({environment:'Desktop headless Chromium, 430x932 DPR3; web path; 10s samples; RAF probe overhead included',errors,samples},null,2));
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exit(1)});
