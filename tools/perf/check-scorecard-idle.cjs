// GAME-04 follow-up: the end-of-level scorecard now waits for a tap, so nothing may keep rendering
// under it. Uses Dev Mode (3 logo taps → Dev Mode → DEV WIN) to reach the scorecard, then checks:
// gameplay + starfield stop under the idle scorecard, it never auto-advances, and the next level
// renders again — both directly and after backgrounding the app on the scorecard.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'/Users/paulfisher/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});try{
 const result={};
 for(const bg of [false,true]){
  const p=await b.newPage({viewport:{width:430,height:932},deviceScaleFactor:3});p.setDefaultTimeout(15000);
  const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.route('**/*',r=>{const u=r.request().url();return u.startsWith('http://127.0.0.1:8765')||u.startsWith('data:')?r.continue():r.abort()});
  await p.addInitScript(()=>{window.__ops={};const C=CanvasRenderingContext2D.prototype;for(const m of ['clearRect','fillRect','drawImage','fill','stroke','fillText']){const f=C[m];C[m]=function(...a){const k=this.canvas.id||'(anon)';window.__ops[k]=(window.__ops[k]||0)+1;return f.apply(this,a)}}});
  const cdp=await p.context().newCDPSession(p);await cdp.send('Performance.enable');
  const task=async()=>{const {metrics}=await cdp.send('Performance.getMetrics');return metrics.find(x=>x.name==='TaskDuration').value};
  const wrapPixi=()=>p.evaluate(()=>{const r=window.pixiRenderer;if(r&&!r.draw.__counted){const d=r.draw;r.draw=function(...a){window.__pixiDraws++;return d.apply(this,a)};r.draw.__counted=1}});
  const sample=async(ms)=>{await wrapPixi();await p.evaluate(()=>{window.__ops={};window.__pixiDraws=0});const a=await task();await p.waitForTimeout(ms);const z=await task();
   return {taskMsPerS:+((z-a)*1000/(ms/1000)).toFixed(1),...await p.evaluate(()=>({ops:window.__ops,pixiDraws:window.__pixiDraws}))}};
  const setHidden=(h)=>p.evaluate((h)=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>h});document.dispatchEvent(new Event('visibilitychange'))},h);
  await p.goto('http://127.0.0.1:8765',{waitUntil:'domcontentloaded'});await p.locator('#playStroidsTile').click();await p.waitForTimeout(3000);
  for(let i=0;i<3;i++){await p.locator('#menuLogoCanvas').click({force:true});await p.waitForTimeout(120)}
  await p.locator('#btnDevMode').click();await p.waitForTimeout(800); // menu buttons replay their click after a press-pause
  await p.locator('#btnArcade').click();await p.waitForTimeout(800);await p.locator('#btnArcadeNew').click();await p.waitForTimeout(7000);
  const gameplay=await sample(3000);
  await p.locator('#hudDevWin').click();await p.waitForTimeout(bg?3000:20000); // non-bg run outlasts the old 15s auto-advance cap
  if(bg){await setHidden(true);await p.waitForTimeout(1500);await setHidden(false);await p.waitForTimeout(1500)}
  const scorecard=await sample(3000);
  const stillUp=await p.locator('#levelScoreReport').count();
  await p.mouse.click(215,466);await p.waitForTimeout(500);await p.mouse.click(215,466);await p.waitForTimeout(9000);
  const nextLevel=await sample(3000);
  const hud=await p.locator('#hudLevel').textContent();
  result[bg?'backgrounded':'direct']={gameplay,scorecard,stillUp,nextLevel,hud,errors};
  await p.close();
  if(errors.length)throw new Error(errors.join('; '));
  if(!stillUp)throw new Error('Scorecard auto-advanced while the player was idle');
  if(scorecard.pixiDraws||scorecard.ops.galaxyBgCanvas||scorecard.ops['(anon)'])throw new Error(`Rendering continued under the scorecard: ${JSON.stringify(scorecard)}`);
  if(hud.trim()!=='LEVEL 2'||!nextLevel.pixiDraws||!nextLevel.ops.galaxyBgCanvas)throw new Error(`Next level did not resume rendering (${bg?'after backgrounding':'direct'}): ${JSON.stringify(nextLevel)}`);
 }
 console.log(JSON.stringify(result,null,1));
 fs.writeFileSync(process.argv[2]||'docs/performance/scorecard-idle.json',JSON.stringify(result,null,2));
}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
