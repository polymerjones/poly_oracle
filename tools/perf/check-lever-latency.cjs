// Slot lever latency: a human-paced pull (drag to the stop over ~250ms, hold 300ms, release) —
// how long from pointerdown until the reels start spinning, vs when the finger lifts.
// Same test-only slot seam as check-slot-redraw.cjs. Usage: node tools/perf/check-lever-latency.cjs [out.json]
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
   source=source.replace(seam,'    __auditOpenSlot() { stopGalaxyLoop(); slotTokens = 3; enterSlot({onExit() {}}); },\n'+seam);
   return r.fulfill({contentType:'application/javascript',body:source});
  }return r.continue();
 });
 // First reel-canvas paint after pointerdown = reels visibly moving.
 await p.addInitScript(()=>{window.__firstSpinPaint=0;window.__armed=false;const clear=CanvasRenderingContext2D.prototype.clearRect;
  CanvasRenderingContext2D.prototype.clearRect=function(...a){if(window.__armed&&!window.__firstSpinPaint&&this.canvas.id.startsWith('psReelC')&&document.getElementById('psTokenCount')?.textContent==='2')window.__firstSpinPaint=performance.now();return clear.apply(this,a)}});
 await p.goto('http://127.0.0.1:8765',{waitUntil:'domcontentloaded'});await p.locator('#openGalaxy').click();await p.evaluate(()=>galaxyCanvasController.__auditOpenSlot());await p.waitForTimeout(5000);
 const track=await p.locator('#psTrack').boundingBox();const knob=await p.locator('#psKnob').boundingBox();
 const x=knob.x+knob.width/2,y0=knob.y+knob.height/2,y1=track.y+track.height-2;
 await p.mouse.move(x,y0);
 const tDown=await p.evaluate(()=>{window.__armed=true;return performance.now()});await p.mouse.down();
 const STEPS=10;for(let i=1;i<=STEPS;i++){await p.mouse.move(x,y0+(y1-y0)*i/STEPS);await p.waitForTimeout(25)}
 await p.waitForTimeout(300);
 const tUp=await p.evaluate(()=>performance.now());await p.mouse.up();
 await p.waitForTimeout(300);
 const firstSpin=await p.evaluate(()=>window.__firstSpinPaint);
 const result={spinAfterDownMs:firstSpin?+(firstSpin-tDown).toFixed(0):null,releaseAfterDownMs:+(tUp-tDown).toFixed(0),spunBeforeRelease:!!firstSpin&&firstSpin<tUp,
  tokensAfter:await p.locator('#psTokenCount').textContent(),errors};
 console.log(result);if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(result,null,2));
 if(errors.length||!firstSpin)throw new Error('lever pull did not spin');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
