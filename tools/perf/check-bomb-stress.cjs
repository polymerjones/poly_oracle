// 9 simultaneous bomb detonations (MAX_BOMB_INVENTORY) through the real PIXI renderer during L12:
// PIXI draw time per frame across the 1.8s blast window and page errors. (Headless = CPU side only;
// the budget's main win — fewer full-screen ADD layers — is GPU overdraw, so confirm on device.)
// Usage: node tools/perf/check-bomb-stress.cjs [out.json]   (server on 127.0.0.1:8765)
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'/Users/paulfisher/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});try{
 const p=await b.newPage({viewport:{width:430,height:932},deviceScaleFactor:3});p.setDefaultTimeout(20000);
 const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:8765')?r.continue():r.abort());
 await p.addInitScript(()=>{try{localStorage.setItem('poly-oracle-game-beaten','true')}catch{}});
 await p.goto('http://127.0.0.1:8765');await p.locator('#playStroidsTile').click();await p.locator('#btnArcade').click();await p.locator('#btnArcadeLevelSelect').click();
 await p.locator('.arcadeLevelBtn',{hasText:/^12$/}).click();await p.waitForTimeout(8000);
 const r=await p.evaluate(()=>new Promise(res=>{const pr=window.pixiRenderer;const d=pr.draw;const times=[];
  pr.draw=function(...a){const s=performance.now();const out=d.apply(this,a);times.push(performance.now()-s);return out};
  const W=innerWidth,H=innerHeight;for(let i=0;i<9;i++)pr.triggerBombDetonation(W*(0.2+0.3*(i%3)),H*(0.25+0.25*Math.floor(i/3)),700);
  const t0=performance.now();const poll=()=>{if(performance.now()-t0<1800)requestAnimationFrame(poll);else{pr.draw=d;
   times.sort((x,y)=>x-y);res({frames:times.length,meanMs:+(times.reduce((x,y)=>x+y,0)/times.length).toFixed(2),p95Ms:+times[Math.floor(times.length*0.95)].toFixed(2),maxMs:+times[times.length-1].toFixed(2)})}};poll()}));
 const result={...r,errors};console.log(result);if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(result,null,2));
 if(errors.length)throw new Error(errors.join('; '));
}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
