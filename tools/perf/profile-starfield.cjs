// CPU-profile Arcade gameplay in headless Chrome and attribute self time to functions in
// galaxyBackground.js / script.js / pixiRenderer.js. Desktop timings; use for ranking only.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'/Users/paulfisher/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});try{
 const p=await b.newPage({viewport:{width:430,height:932},deviceScaleFactor:3});p.setDefaultTimeout(15000);
 await p.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:8765')?r.continue():r.abort());
 await p.goto('http://127.0.0.1:8765',{waitUntil:'domcontentloaded'});await p.locator('#openGalaxy').click();await p.locator('#btnArcade').click();await p.locator('#btnArcadeNew').click();await p.waitForTimeout(6000);
 const cdp=await p.context().newCDPSession(p);await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:200});await cdp.send('Profiler.start');
 await p.waitForTimeout(5000);const {profile}=await cdp.send('Profiler.stop');
 const dt=profile.timeDeltas;const self=new Map();const byId=new Map(profile.nodes.map(n=>[n.id,n]));
 profile.samples.forEach((id,i)=>{self.set(id,(self.get(id)||0)+(dt[i]||0))});
 const agg={};for(const [id,us] of self){const n=byId.get(id);const f=n.callFrame;const file=(f.url.split('/').pop()||'(native)');const k=`${f.functionName||'(anon)'} @ ${file}:${f.lineNumber+1}`;agg[k]=(agg[k]||0)+us}
 const total=Object.values(agg).reduce((a,b)=>a+b,0);const rows=Object.entries(agg).sort((a,b)=>b[1]-a[1]).slice(0,25).map(([k,us])=>({fn:k,ms:+(us/1000).toFixed(1),pct:+(100*us/total).toFixed(1)}));
 console.table(rows);fs.writeFileSync(process.argv[2]||'/dev/null',JSON.stringify(rows,null,2));
}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
