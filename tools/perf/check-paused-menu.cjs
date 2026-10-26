// PERF-03: compare work on a fresh Stroids menu with the menu after pausing Arcade (← Modes).
// Counts canvas ops per canvas and main-thread task/script time (CDP) over equal windows.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'/Users/paulfisher/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});try{
 const p=await b.newPage({viewport:{width:430,height:932},deviceScaleFactor:3});p.setDefaultTimeout(15000);
 const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:8765')?r.continue():r.abort());
 await p.addInitScript(()=>{window.__ops={};const C=CanvasRenderingContext2D.prototype;for(const m of ['clearRect','fillRect','drawImage','fill','stroke','fillText']){const f=C[m];C[m]=function(...a){const k=this.canvas.id||'(anon)';window.__ops[k]=(window.__ops[k]||0)+1;return f.apply(this,a)}}});
 const cdp=await p.context().newCDPSession(p);await cdp.send('Performance.enable');
 const metric=async()=>{const {metrics}=await cdp.send('Performance.getMetrics');const m=Object.fromEntries(metrics.map(x=>[x.name,x.value]));return {task:m.TaskDuration,script:m.ScriptDuration}};
 const sample=async(ms)=>{await p.evaluate(()=>{window.__ops={};window.__pixiDraws=0});const a=await metric();await p.waitForTimeout(ms);const z=await metric();
  return {taskMsPerS:+((z.task-a.task)*1000/(ms/1000)).toFixed(1),scriptMsPerS:+((z.script-a.script)*1000/(ms/1000)).toFixed(1),...await p.evaluate(()=>({ops:window.__ops,pixiDraws:window.__pixiDraws}))}};
 await p.goto('http://127.0.0.1:8765',{waitUntil:'domcontentloaded'});await p.locator('#playStroidsTile').click();await p.waitForTimeout(4000);
 const freshMenu=await sample(4000);
 await p.locator('#btnArcade').click();await p.locator('#btnArcadeNew').click();await p.waitForTimeout(6000);
 await p.evaluate(()=>{const d=window.pixiRenderer.draw;window.pixiRenderer.draw=function(...a){window.__pixiDraws++;return d.apply(this,a)}});
 const gameplay=await sample(4000);
 await p.locator('#arcadeBack').click();await p.waitForTimeout(2000);
 const pausedMenu=await sample(4000);
 await p.locator('#btnArcadeResume').click();await p.waitForTimeout(1500);
 const resumed=await sample(4000);
 const result={freshMenu,gameplay,pausedMenu,resumed,errors};console.log(JSON.stringify(result,null,1));
 fs.writeFileSync(process.argv[2]||'docs/performance/paused-menu-baseline.json',JSON.stringify(result,null,2));
 if(errors.length)throw new Error(errors.join('; '));
 if(!resumed.ops.galaxyBgCanvas||resumed.pixiDraws<20)throw new Error('Resume did not restore gameplay rendering and starfield');
 if(pausedMenu.ops.galaxyBgCanvas)throw new Error(`Starfield still repaints behind the paused menu: ${pausedMenu.ops.galaxyBgCanvas} ops / 4 s`);
}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
