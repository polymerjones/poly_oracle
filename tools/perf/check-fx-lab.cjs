// FX Lab (Dev Mode): opens, chips persist + apply body classes, previews run and fully dispose
// (no leftover canvases), laser beam trial draws in a level. Screenshots to argv[2] dir if given.
// Usage: node tools/perf/check-fx-lab.cjs [shotDir]   (server on 127.0.0.1:8765)
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'/Users/paulfisher/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const DIR=process.argv[2];
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});try{
 const p=await b.newPage({viewport:{width:430,height:932},deviceScaleFactor:2});p.setDefaultTimeout(15000);
 const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:8765')?r.continue():r.abort());
 await p.addInitScript(()=>{try{localStorage.removeItem('poly_oracle_trials');localStorage.setItem('poly-oracle-game-beaten','true')}catch{}});
 const shot=async(n)=>{if(DIR)await p.screenshot({path:`${DIR}/fxlab-${n}.png`})};
 await p.goto('http://127.0.0.1:8765');await p.locator('#openGalaxy').click();await p.waitForTimeout(1500);
 for(let i=0;i<3;i++){await p.locator('#menuLogoCanvas').dispatchEvent('pointerdown');await p.waitForTimeout(80)}
 await p.locator('#btnDevMode').click();await p.waitForTimeout(400);
 await p.locator('#btnFxLab').click();await p.waitForTimeout(400);
 const labOpen=await p.locator('.fxLab.show').count();
 const pick=async(key,val)=>{await p.locator(`.fxLabChips[data-trial="${key}"] button[data-value="${val}"]`).click();await p.waitForTimeout(150)};
 await pick('titles','shiny');await pick('cards','holo');await pick('buttons','star');await pick('sfxLaser','lab_zap5');await pick('laser','beam');
 await shot('panel');
 const canvasesBefore=await p.evaluate(()=>document.querySelectorAll('body > canvas').length);
 await p.locator('.fxLabChips[data-trial="warp"] button[data-value="tunnel"]').click();
 await p.locator('.fxLabChips[data-trial="warp"] .fxLabPreview').click();await p.waitForTimeout(450);await shot('tunnel');
 await p.waitForTimeout(1200);
 await p.locator('.fxLabChips[data-trial="warp"] button[data-value="streaks"]').click();
 await p.locator('.fxLabChips[data-trial="warp"] .fxLabPreview').click();await p.waitForTimeout(350);await shot('streaks');
 await p.waitForTimeout(1200);
 await p.locator('.fxLabChips[data-trial="cheatFx"] .fxLabPreview').click();await p.waitForTimeout(500);await shot('confetti');
 await p.waitForTimeout(2000);
 const canvasesAfter=await p.evaluate(()=>document.querySelectorAll('body > canvas').length);
 await p.locator('.fxLabClose').click();await p.waitForTimeout(500);await shot('menu');
 const body=await p.evaluate(()=>[...document.body.classList].filter(c=>c.startsWith('fx-')));
 const saved=await p.evaluate(()=>JSON.parse(localStorage.getItem('poly_oracle_trials')||'{}'));
 // laser beam in a level
 await p.locator('#btnArcade').click();await p.locator('#btnArcadeLevelSelect').click();await p.locator('.arcadeLevelBtn',{hasText:/^3$/}).click();await p.waitForTimeout(6000);
 await p.mouse.click(300,500);await p.waitForTimeout(40);await shot('beam');
 const r={labOpen,body,saved,canvasesBefore,canvasesAfter,errors};console.log(JSON.stringify(r,null,1));
 if(errors.length)throw new Error(errors.join('; '));
 if(!labOpen)throw new Error('lab did not open');
 if(canvasesAfter>canvasesBefore)throw new Error('effect canvases leaked');
 if(!body.includes('fx-title-shiny')||!body.includes('fx-holo-cards')||!body.includes('fx-star-buttons'))throw new Error('look classes not applied');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
