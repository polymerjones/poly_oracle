// Test-only entry into the real slot controller; no test hook is shipped in game source.
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
 await p.addInitScript(()=>{window.__reelPaints=0;const clear=CanvasRenderingContext2D.prototype.clearRect;CanvasRenderingContext2D.prototype.clearRect=function(...a){if(this.canvas.id.startsWith('psReelC'))window.__reelPaints++;return clear.apply(this,a)}});
 await p.goto('http://127.0.0.1:8765',{waitUntil:'domcontentloaded'});await p.locator('#openGalaxy').click();await p.evaluate(()=>galaxyCanvasController.__auditOpenSlot());await p.waitForTimeout(5000);
 const sample=async(ms)=>{await p.evaluate(()=>window.__reelPaints=0);await p.waitForTimeout(ms);return p.evaluate(()=>window.__reelPaints)};
 const idle=await sample(3000);
 const before=await p.locator('#psTokenCount').textContent();
 const track=await p.locator('#psTrack').boundingBox();const knob=await p.locator('#psKnob').boundingBox();
 await p.mouse.move(knob.x+knob.width/2,knob.y+knob.height/2);await p.mouse.down();await p.mouse.move(track.x+track.width/2,track.y+track.height-2,{steps:15});await p.waitForTimeout(500);await p.mouse.up();
 await p.waitForTimeout(100);const tokenAfterPull=await p.locator('#psTokenCount').textContent();
 const moving=await sample(1500);await p.waitForTimeout(7000);const settled=await sample(3000);
 const after=await p.locator('#psTokenCount').textContent();
 const pixels=await p.locator('#psReelC0').evaluate(c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0));
 const result={idle,moving,settled,tokensBefore:before,tokenAfterPull,tokensAfter:after,reelHasPixels:pixels,errors};console.log(result);fs.writeFileSync(process.argv[2]||'docs/performance/slot-redraw-baseline.json',JSON.stringify(result,null,2));
 if(errors.length)throw new Error(errors.join('; '));if(moving===0||Number(tokenAfterPull)!==Number(before)-1||!pixels)throw new Error('Spin or visible final reel failed');
 if(idle!==0||settled!==0)throw new Error('Stopped reels still repaint');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
