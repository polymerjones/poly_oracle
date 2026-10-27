// POLYVERSE hub card ring: frame times (4× CPU throttle) + which layers repaint while it's dragged and
// coasting. The spin should be compositor-only: no per-frame layer repaints, no forced layouts.
// Usage: node tools/perf/check-hub-ring.cjs   (server on 127.0.0.1:8765 serving www/)
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'/Users/paulfisher/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});try{
 const p=await b.newPage({viewport:{width:390,height:844},deviceScaleFactor:3});p.setDefaultTimeout(15000);
 await p.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:8765')?r.continue():r.abort());
 await p.goto('http://127.0.0.1:8765');await p.locator('#playStroidsTile').click();await p.waitForTimeout(2500);
 const cdp=await p.context().newCDPSession(p);
 await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 await cdp.send('LayerTree.enable');const paints={};let layers=[];
 cdp.on('LayerTree.layerPainted',e=>{paints[e.layerId]=(paints[e.layerId]||0)+1});cdp.on('LayerTree.layerTreeDidChange',e=>{if(e.layers)layers=e.layers});
 await p.waitForTimeout(500);for(const k in paints)delete paints[k];
 await cdp.send('Performance.enable');const m0=Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
 await p.evaluate(()=>{window.__ft=[];let last=performance.now();const f=(t)=>{window.__ft.push(t-last);last=t;if(window.__ft.length<400)requestAnimationFrame(f)};requestAnimationFrame(f)});
 const r=await p.locator('#polyRing').boundingBox();const y=r.y+r.height/2,cx=r.x+r.width/2;
 for(let n=0;n<3;n++){ // slow drag, then a hard flick each way
  await p.mouse.move(cx+100,y);await p.mouse.down();for(let i=1;i<=40;i++){await p.mouse.move(cx+100-200*i/40,y);await p.waitForTimeout(16)}await p.mouse.up();await p.waitForTimeout(700);
  await p.mouse.move(cx-150,y);await p.mouse.down();for(let i=1;i<=4;i++){await p.mouse.move(cx-150+300*i/4,y);await p.waitForTimeout(10)}await p.mouse.up();await p.waitForTimeout(1500);
 }
 const ft=await p.evaluate(()=>window.__ft.slice(5));const m1=Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
 const s=[...ft].sort((a,b)=>a-b);const pct=(q)=>s[Math.floor(q*(s.length-1))].toFixed(1);
 const byId=Object.fromEntries(layers.map(l=>[l.layerId,l]));
 const desc=async(l)=>{if(!l?.backendNodeId)return '(no node)';try{const {node}=await cdp.send('DOM.describeNode',{backendNodeId:l.backendNodeId});const a=node.attributes||[];return node.nodeName+(a.includes('id')?'#'+a[a.indexOf('id')+1]:'')+(a.includes('class')?'.'+String(a[a.indexOf('class')+1]).split(' ')[0]:'')}catch{return '?'}};
 const painted=[];for(const [id,n] of Object.entries(paints).sort((a,b)=>b[1]-a[1]).slice(0,12)){const l=byId[id];painted.push(`${n}× ${await desc(l)} ${l?`${Math.round(l.width)}x${Math.round(l.height)}`:''}`)}
 console.log(JSON.stringify({frames:ft.length,p50:pct(0.5),p95:pct(0.95),p99:pct(0.99),over33ms:ft.filter(x=>x>33.4).length,
  layouts:m1.LayoutCount-m0.LayoutCount,recalcs:m1.RecalcStyleCount-m0.RecalcStyleCount,layoutMs:((m1.LayoutDuration-m0.LayoutDuration)*1000).toFixed(0),styleMs:((m1.RecalcStyleDuration-m0.RecalcStyleDuration)*1000).toFixed(0),painted},null,1));
}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
