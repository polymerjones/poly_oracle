// Which DOM/compositing layers repaint during Arcade gameplay, and which CSS animations run.
// Repainted layers need fresh backing buffers on iOS (RemoteImageBufferSet::ensureBufferForDisplay).
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'/Users/paulfisher/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});try{
 const p=await b.newPage({viewport:{width:430,height:932},deviceScaleFactor:3});p.setDefaultTimeout(15000);
 await p.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:8765')?r.continue():r.abort());
 await p.goto('http://127.0.0.1:8765',{waitUntil:'domcontentloaded'});await p.locator('#openGalaxy').click();await p.locator('#btnArcade').click();await p.locator('#btnArcadeNew').click();await p.waitForTimeout(6000);
 const anims=await p.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').map(a=>{const t=a.effect?.target;const kf=a.effect?.getKeyframes?.()||[];
  const props=[...new Set(kf.flatMap(k=>Object.keys(k).filter(x=>!['offset','easing','composite','computedOffset'].includes(x))))];
  const r=t?.getBoundingClientRect?.();const vis=t&&r&&r.width*r.height>0&&getComputedStyle(t).visibility!=='hidden'&&getComputedStyle(t).display!=='none';
  return {name:a.animationName||a.constructor.name,target:t?(t.id?'#'+t.id:(t.className&&String(t.className).slice(0,40))||t.tagName):'?',props,area:r?Math.round(r.width*r.height):0,visible:!!vis,opacity:t?getComputedStyle(t).opacity:null}}));
 // DOM mutations per second, grouped by target (style/text changes force layer repaints).
 await p.evaluate(()=>{window.__mut={};const lab=(n)=>{const e=n.nodeType===1?n:n.parentElement;return e?(e.id?'#'+e.id:(String(e.className).slice(0,30)||e.tagName)):'?'};
  window.__mo=new MutationObserver(l=>{for(const m of l){const k=lab(m.target)+' '+m.type+(m.attributeName?':'+m.attributeName:'');window.__mut[k]=(window.__mut[k]||0)+1}});
  window.__mo.observe(document.body,{subtree:true,attributes:true,characterData:true,childList:true})});
 const cdp=await p.context().newCDPSession(p);await cdp.send('LayerTree.enable');const paints={};let layers=[];
 cdp.on('LayerTree.layerPainted',e=>{paints[e.layerId]=(paints[e.layerId]||0)+1});cdp.on('LayerTree.layerTreeDidChange',e=>{if(e.layers)layers=e.layers});
 await p.waitForTimeout(5000);
 const mut=await p.evaluate(()=>{window.__mo.disconnect();return window.__mut});
 const byId=Object.fromEntries(layers.map(l=>[l.layerId,l]));
 const desc=async(l)=>{if(!l?.backendNodeId)return '(no node)';try{const {node}=await cdp.send('DOM.describeNode',{backendNodeId:l.backendNodeId});const a=node.attributes||[];const id=a[a.indexOf('id')+1];const cls=a[a.indexOf('class')+1];return node.nodeName+(a.includes('id')?'#'+id:'')+(a.includes('class')?'.'+String(cls).split(' ')[0]:'')}catch{return '?'}};
 const painted=[];for(const [id,n] of Object.entries(paints).sort((a,b)=>b[1]-a[1]).slice(0,20)){const l=byId[id];painted.push({paints5s:n,node:await desc(l),size:l?`${Math.round(l.width)}x${Math.round(l.height)}`:'?'})}
 const out={runningAnimations:anims,paintedLayers:painted,mutations5s:Object.entries(mut).sort((a,b)=>b[1]-a[1]).slice(0,20)};
 console.log(JSON.stringify(out,null,1));fs.writeFileSync(process.argv[2]||'/dev/null',JSON.stringify(out,null,2));
}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
