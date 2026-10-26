// Ad Theater: a cheat-code ad pod (stubbed AdMob — web build, no real ads) keeps #adTheater covering
// the game through every gap between ads, shows progress + the end card, then hides; the cheat unlocks.
// Usage: node tools/perf/check-ad-theater.cjs [out.json]   (server on 127.0.0.1:8765)
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'/Users/paulfisher/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});try{
 const p=await b.newPage({viewport:{width:430,height:932},deviceScaleFactor:2});p.setDefaultTimeout(15000);
 const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:8765')?r.continue():r.abort());
 await p.addInitScript(()=>{
  try{localStorage.removeItem('poly_oracle_cheat_ads');}catch{}
  const L={};const emit=(e)=>(L[e]||[]).forEach((f)=>f({}));window.__adShows=0;
  const AdMob={initialize:async()=>{},requestConsentInfo:async()=>({status:'NOT_REQUIRED',canRequestAds:true}),showConsentForm:async()=>({canRequestAds:true}),
   addListener:(e,f)=>{(L[e]||(L[e]=[])).push(f);return{remove(){}}},
   prepareRewardVideoAd:()=>new Promise((r)=>setTimeout(r,350)),
   showRewardVideoAd:async()=>{window.__adShows++;setTimeout(()=>{emit('onRewardedVideoAdReward');emit('onRewardedVideoAdDismissed')},700)}};
  window.Capacitor={getPlatform:()=>'ios',isNativePlatform:()=>false,Plugins:{AdMob}};
  // sample theater coverage every 50ms
  window.__cov=[];setInterval(()=>{const t=document.getElementById('adTheater');window.__cov.push({t:Math.round(performance.now()),on:!!t&&t.classList.contains('show'),shows:window.__adShows,status:t?.querySelector('.adTheaterStatus')?.textContent||''})},50);
 });
 await p.goto('http://127.0.0.1:8765');await p.locator('#playStroidsTile').click();await p.waitForTimeout(800);
 await p.locator('#btnCheatCodes').click();await p.waitForTimeout(2500);
 const btn=p.locator('.cheatRow',{hasText:'Unlimited Missiles'}).locator('.cheatWatchBtn');
 await btn.waitFor();const label=await btn.textContent();
 await p.evaluate(()=>{window.__cov=[]});await btn.click();
 await p.waitForFunction(()=>window.__adShows>=3,null,{timeout:20000});
 await p.waitForTimeout(3000);
 const cov=await p.evaluate(()=>window.__cov);
 const firstOn=cov.findIndex((c)=>c.on);const lastOn=cov.length-1-[...cov].reverse().findIndex((c)=>c.on);
 const gapsUncovered=cov.slice(firstOn,lastOn+1).filter((c)=>!c.on).length;
 const statuses=[...new Set(cov.filter((c)=>c.on).map((c)=>c.status))];
 const hiddenAtEnd=!cov[cov.length-1].on;
 const rowText=await p.locator('.cheatRow',{hasText:'Unlimited Missiles'}).textContent();
 const r={label,adShows:await p.evaluate(()=>window.__adShows),gapsUncovered,statuses,hiddenAtEnd,unlocked:/ON|OFF/.test(rowText),errors};
 console.log(JSON.stringify(r,null,1));if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(r,null,2));
 if(errors.length)throw new Error(errors.join('; '));
 if(firstOn<0)throw new Error('theater never shown');
 if(gapsUncovered)throw new Error(`theater dropped for ${gapsUncovered} samples mid-pod`);
 if(!hiddenAtEnd)throw new Error('theater still up after the pod');
 if(r.adShows!==3)throw new Error('expected 3 ads');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
