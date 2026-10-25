// Late-level gameplay cost: per level, 2D canvas ops per canvas, PIXI draw time, whole-frame
// main-thread time and composited-layer repaints. Usage: node tools/perf/profile-late-levels.cjs [out.json] [levels]
// Needs `python3 -m http.server 8765 --bind 127.0.0.1` from the repo root.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'/Users/paulfisher/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs');
const LEVELS=(process.argv[3]||'2,10,12,15').split(',').map(Number);
const SAMPLE_MS=5000;
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
const results={};try{
 for(const lv of LEVELS){
  const p=await b.newPage({viewport:{width:430,height:932},deviceScaleFactor:3});p.setDefaultTimeout(20000);
  const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:8765')?r.continue():r.abort());
  await p.addInitScript(()=>{
   try{localStorage.setItem('poly-oracle-game-beaten','true')}catch{}
   window.__ops={};const C=CanvasRenderingContext2D.prototype;
   const lab=(c)=>c.id||(c.style&&c.style.zIndex?'z'+c.style.zIndex:'')+'('+c.width+'x'+c.height+')';
   for(const m of ['clearRect','fillRect','strokeRect','drawImage','fill','stroke','fillText','strokeText']){const f=C[m];C[m]=function(...a){const k=lab(this.canvas)+'.'+m;window.__ops[k]=(window.__ops[k]||0)+1;return f.apply(this,a)}}
   // whole rAF callback time
   window.__raf={n:0,ms:0,max:0};const R=window.requestAnimationFrame.bind(window);
   window.requestAnimationFrame=(cb)=>R((t)=>{const s=performance.now();try{cb(t)}finally{const d=performance.now()-s;window.__raf.n++;window.__raf.ms+=d;if(d>window.__raf.max)window.__raf.max=d}});
  });
  const cdp=await p.context().newCDPSession(p);await cdp.send('Performance.enable');await cdp.send('LayerTree.enable');
  const paints={};let layers=[];cdp.on('LayerTree.layerPainted',e=>{paints[e.layerId]=(paints[e.layerId]||0)+1});cdp.on('LayerTree.layerTreeDidChange',e=>{if(e.layers)layers=e.layers});
  const metric=async()=>{const {metrics}=await cdp.send('Performance.getMetrics');const m=Object.fromEntries(metrics.map(x=>[x.name,x.value]));return {task:m.TaskDuration,script:m.ScriptDuration}};
  await p.goto('http://127.0.0.1:8765',{waitUntil:'domcontentloaded'});
  await p.locator('#openGalaxy').click();await p.locator('#btnArcade').click();
  await p.locator('#btnArcadeLevelSelect').click();
  await p.locator('.arcadeLevelBtn',{hasText:new RegExp('^'+lv+'$')}).click();
  await p.waitForTimeout(9000);
  await p.evaluate(()=>{const d=window.pixiRenderer.draw;window.__pixi={n:0,ms:0};window.pixiRenderer.draw=function(...a){window.__sim=a[0];const s=performance.now();const r=d.apply(this,a);window.__pixi.n++;window.__pixi.ms+=performance.now()-s;return r}});
  await p.evaluate(()=>{window.__ops={};window.__raf={n:0,ms:0,max:0}});for(const k in paints)delete paints[k];
  // Auto-player (PERF_COMBAT=1): tap a live asteroid every 110ms so explosions/splits/combos load the frame.
  if(process.env.PERF_COMBAT)await p.evaluate(()=>{const c=document.getElementById('galaxyPlayCanvas');let i=0;window.__tapper=setInterval(()=>{const sim=window.__sim;if(!sim||!sim.asteroids.length)return;
   const a=sim.asteroids[(i++)%sim.asteroids.length];const r=c.getBoundingClientRect();const x=r.left+a.x*r.width/sim.width,y=r.top+a.y*r.height/sim.height;
   for(const t of ['pointerdown','pointerup']){c.dispatchEvent(new PointerEvent(t,{clientX:x,clientY:y,bubbles:true,cancelable:true,pointerId:1,pointerType:'touch',isPrimary:true}))}},110)});
  const a=await metric();await p.waitForTimeout(SAMPLE_MS);const z=await metric();
  await p.evaluate(()=>clearInterval(window.__tapper));
  const st=await p.evaluate(()=>({ops:window.__ops,raf:window.__raf,pixi:window.__pixi,
   asteroids:window.__sim?.asteroids.length,particles:window.__sim?.particles.length,videos:[...document.querySelectorAll('video')].filter(v=>!v.paused).map(v=>(v.id||'video')+' '+v.videoWidth+'x'+v.videoHeight)}));
  const byId=Object.fromEntries(layers.map(l=>[l.layerId,l]));
  const desc=async(l)=>{if(!l?.backendNodeId)return '(no node)';try{const {node}=await cdp.send('DOM.describeNode',{backendNodeId:l.backendNodeId});const at=node.attributes||[];const id=at.includes('id')?'#'+at[at.indexOf('id')+1]:'';const cls=at.includes('class')?'.'+String(at[at.indexOf('class')+1]).split(' ')[0]:'';return node.nodeName+id+cls}catch{return '?'}};
  const painted=[];for(const [id,n] of Object.entries(paints).sort((x,y)=>y[1]-x[1]).slice(0,12)){const l=byId[id];painted.push(`${n}x ${await desc(l)} ${l?Math.round(l.width)+'x'+Math.round(l.height):''}`)}
  const s=SAMPLE_MS/1000;
  results['L'+lv]={scriptMsPerS:+((z.script-a.script)*1000/s).toFixed(1),taskMsPerS:+((z.task-a.task)*1000/s).toFixed(1),
   rafPerS:+(st.raf.n/s).toFixed(1),rafMsPerS:+(st.raf.ms/s).toFixed(1),rafMaxMs:+st.raf.max.toFixed(1),
   pixiDrawsPerS:+(st.pixi.n/s).toFixed(1),pixiMsPerDraw:+(st.pixi.ms/Math.max(1,st.pixi.n)).toFixed(2),
   canvasOpsPerS:Object.fromEntries(Object.entries(st.ops).sort((x,y)=>y[1]-x[1]).slice(0,14).map(([k,v])=>[k,Math.round(v/s)])),
   layerPaints5s:painted,asteroidsAtEnd:st.asteroids,particlesAtEnd:st.particles,videos:st.videos,errors};
  console.error('done L'+lv);
  await p.close();
 }
 console.log(JSON.stringify(results,null,1));
 if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(results,null,2));
}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
