// Real flow: level win -> scorecard -> slot never stops the gameplay loop. Count gameplay
// renders while the opaque slot overlay is up. Test-only seam; nothing is shipped in game source.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'/Users/paulfisher/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});try{
 const p=await b.newPage({viewport:{width:430,height:932},deviceScaleFactor:3});p.setDefaultTimeout(15000);
 const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.route('**/*',async r=>{
  const u=r.request().url();if(!u.startsWith('http://127.0.0.1:8765'))return r.abort();
  if(new URL(u).pathname==='/script.js'){
   let source=fs.readFileSync('script.js','utf8');const seam='    isSlotActive, // slot owns';
   if(!source.includes(seam))throw new Error('Missing slot test seam');
   // Unlike check-slot-redraw, keep the gameplay loop running, as handoffAfterScorecard() does.
   source=source.replace(seam,'    __auditOpenSlotLive() { slotTokens = 3; enterSlot({onExit() {}}); },\n    __auditLoopRunning() { return galaxyRunning; },\n'+seam);
   return r.fulfill({contentType:'application/javascript',body:source});
  }return r.continue();
 });
 await p.addInitScript(()=>{window.__bgOps=0;const C=CanvasRenderingContext2D.prototype;for(const m of ['clearRect','fillRect','drawImage']){const f=C[m];C[m]=function(...a){if(this.canvas.id==='galaxyBgCanvas')window.__bgOps++;return f.apply(this,a)}}});
 await p.goto('http://127.0.0.1:8765',{waitUntil:'domcontentloaded'});await p.locator('#openGalaxy').click();await p.locator('#btnArcade').click();await p.locator('#btnArcadeNew').click();await p.waitForTimeout(5000);
 await p.evaluate(()=>{window.__draws=0;const draw=window.pixiRenderer.draw;window.pixiRenderer.draw=function(...a){window.__draws++;return draw.apply(this,a)}});
 const sample=async(ms)=>{await p.evaluate(()=>{window.__draws=0;window.__bgOps=0});await p.waitForTimeout(ms);return p.evaluate(()=>({draws:window.__draws,bgOps:window.__bgOps}))};
 const gameplay=await sample(3000);
 await p.evaluate(()=>galaxyCanvasController.__auditOpenSlotLive());await p.waitForTimeout(3000);
 const slotIdle=await sample(3000);
 const state=await p.evaluate(()=>({slotActive:galaxyCanvasController.isSlotActive(),loopRunning:galaxyCanvasController.__auditLoopRunning()}));
 // Leaving via the slot's Modes button must hand the menu its starfield back.
 await p.locator('#psModes').click();await p.waitForTimeout(1500);
 const menu3s=await sample(3000);const menuStarfield=await p.evaluate(()=>document.getElementById('galaxyBgCanvas')?.style.display);
 const result={gameplay3s:gameplay,slotIdle3s:slotIdle,...state,menu3s,menuStarfield,errors};console.log(result);
 fs.writeFileSync(process.argv[2]||'docs/performance/slot-underlay-baseline.json',JSON.stringify(result,null,2));
 if(errors.length)throw new Error(errors.join('; '));if(!state.slotActive)throw new Error('Slot did not open');
 if(gameplay.draws<20)throw new Error('Insufficient gameplay frames to test');
  if(menuStarfield==='none'||menu3s.bgOps===0)throw new Error('Menu lost its starfield after leaving the slot');
 if(slotIdle.draws>0||slotIdle.bgOps>0)throw new Error(`Gameplay still renders under the slot: ${JSON.stringify(slotIdle)} / 3 s`);
}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
