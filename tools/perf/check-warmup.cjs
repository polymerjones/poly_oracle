const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || '/Users/paulfisher/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});try{
 const page=await browser.newPage();
 await page.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:8765')?r.continue():r.abort());
 await page.goto('http://127.0.0.1:8765',{waitUntil:'domcontentloaded'});
 const result=await page.evaluate(async()=>{
  const el=document.getElementById('oracleBgWarmup'),pip=el.querySelector('.warmup-pip');
  el.classList.remove('warmup-done');const loading=getComputedStyle(pip).animationName;
  el.classList.add('warmup-done');const done=getComputedStyle(pip).animationName;
  return {loading,done,remaining:el.getAnimations({subtree:true}).filter(a=>a.animationName==='warmupPulse').length};
 });
 assert.equal(result.loading,'warmupPulse');assert.equal(result.done,'none');assert.equal(result.remaining,0);console.log('PASS',result);
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
