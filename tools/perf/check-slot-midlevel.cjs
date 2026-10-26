// Poly Slot from the HUD: opens mid-level, freezes the level (timer + RUN clock + entities), closes
// back into the same level with the same time left, keeps unspent tokens. Test-only seam (not shipped).
// Usage: node tools/perf/check-slot-midlevel.cjs [out.json]   (server on 127.0.0.1:8765)
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'/Users/paulfisher/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});try{
 const p=await b.newPage({viewport:{width:430,height:932},deviceScaleFactor:2});p.setDefaultTimeout(15000);
 const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.route('**/*',async r=>{const u=r.request().url();if(!u.startsWith('http://127.0.0.1:8765'))return r.abort();
  if(new URL(u).pathname==='/script.js'){let src=fs.readFileSync('script.js','utf8');const seam='    isSlotActive, // slot owns';
   if(!src.includes(seam))throw new Error('Missing slot test seam');
   src=src.replace(seam,'    __auditDevOn() { devModeOn = true; },\n    __auditLevel() { return ARCADE_LEVELS[currentLevelIndex]?.level; },\n    __auditGiveTokens(n) { slotTokens = n; },\n    __auditState() { const n = performance.now(); return { remaining: levelEndsAt - n, run: gameTimer.running ? n - gameTimer.startedAt : 0, tokens: slotTokens, slot: isSlotActive(), ast: sim.asteroids.map((a) => [Math.round(a.x), Math.round(a.y)]).slice(0, 3) }; },\n'+seam);
   return r.fulfill({contentType:'application/javascript',body:src})}return r.continue()});
 await p.addInitScript(()=>{try{localStorage.setItem('poly-oracle-game-beaten','true');localStorage.setItem('poly_slot_hint_seen','0')}catch{}});
 await p.goto('http://127.0.0.1:8765');await p.locator('#openGalaxy').click();await p.locator('#btnArcade').click();await p.locator('#btnArcadeLevelSelect').click();
 await p.locator('.arcadeLevelBtn',{hasText:/^3$/}).click();await p.waitForTimeout(6000);
 const st=()=>p.evaluate(()=>galaxyCanvasController.__auditState());
 const btnHiddenNoTokens=await p.locator('#hudSlotBtn').isDisabled();
 // 0 tokens: still openable (inventory-style); no dimming curtain; RESUME PLAY goes back to the level.
 await p.locator('#hudSlotBtn').click({force:true});await p.waitForTimeout(1400);
 const zero={slot:(await st()).slot,resumeLabel:await p.locator('#psModes').textContent(),curtain:await p.locator('#polyslots .ps-continue.show').count()};
 await p.locator('#psModes').click();await p.waitForTimeout(900);zero.closed=!(await st()).slot;
 await p.evaluate(()=>galaxyCanvasController.__auditGiveTokens(3));await p.waitForTimeout(300);
 const hint=await p.locator('.slotHudHint').count();
 const before=await st();
 await p.locator('#hudSlotBtn').click({force:true}); // force: the attention pulse never reads as 'stable'await p.waitForTimeout(500);
 const open1=await st();
 await p.waitForTimeout(4000);
 const open2=await st();
 await p.waitForTimeout(300);await p.locator('#psModes').click();
 await p.waitForTimeout(1200);
 const after=await st();
 // Level clear → scorecard → (odd level: no reward box) → straight into the next level, no slot.
 await p.evaluate(()=>{galaxyCanvasController.__auditDevOn();galaxyCanvasController.devInstantWin()});await p.waitForTimeout(2500);
 await p.mouse.click(215,600);await p.waitForTimeout(400);await p.mouse.click(215,600);await p.waitForTimeout(3500);
 const next={level:await p.evaluate(()=>galaxyCanvasController.__auditLevel()),...await st()};
 const r={zero,next,btnDisabledWithoutTokens:btnHiddenNoTokens,hintShown:hint===1,before,open1,open2,after,errors};
 r.frozenWhileOpen=Math.abs(open2.ast[0]?.[0]-open1.ast[0]?.[0])<=1&&Math.abs(open2.ast[0]?.[1]-open1.ast[0]?.[1])<=1;
 r.timeLostMs=Math.round(open1.remaining-after.remaining); // ~ exit beat + post-close wait, not the ~4.3s the cabinet was open
 r.runLostMs=Math.round(after.run-before.run);
 console.log(JSON.stringify(r,null,1));if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(r,null,2));
 if(errors.length)throw new Error(errors.join('; '));
 if(btnHiddenNoTokens)throw new Error('HUD slot button disabled at 0 tokens');
 if(!zero.slot||!/RESUME/.test(zero.resumeLabel)||zero.curtain||!zero.closed)throw new Error('0-token mid-level open/resume wrong: '+JSON.stringify(zero));
 if(!open1.slot||after.slot)throw new Error('slot did not open/close');
 if(!r.frozenWhileOpen)throw new Error('asteroids moved while the slot was open');
 if(r.timeLostMs>2500)throw new Error(`level timer drained while the slot was open: ${r.timeLostMs}ms`);
 if(after.tokens!==3)throw new Error('tokens not kept on close');
 if(next.slot)throw new Error('slot auto-opened between levels');
 if(next.level!==4||next.tokens!==3)throw new Error(`expected level 4 with 3 banked tokens, got L${next.level} / ${next.tokens}`);
}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
