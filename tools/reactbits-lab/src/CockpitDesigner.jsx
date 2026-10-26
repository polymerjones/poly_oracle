// Cockpit Designer (2026-10-26) — design the in-game cockpit HUD against the REAL game. The game runs
// in an iframe (/game/index.html?cockpitLab=1, served from the repo root by vite.config.js) and exposes
// window.__cockpitLab; every edit here is pushed live through it. "Save to game" writes
// cockpitLayout.js at the repo root, which is exactly what the phone reads (after prepare:web/ship).
import { useCallback, useEffect, useRef, useState } from "react";

const PARTS = [
  ["pause", "Pause / Modes", "box"],
  ["lives", "Lives", "box"],
  ["run", "Run timer", "box"],
  ["level", "Level", "box"],
  ["score", "Score", "box"],
  ["mult", "Multiplier", "box"],
  ["bomb", "Bomb", "box"],
  ["freeze", "Freeze", "box"],
  ["missile", "Missile", "box"],
  ["slots", "POLYSLOTS", "scale"],
  ["net", "NET charge chip", "box"],
  ["quad", "Quad badge", "scale"],
  ["pulse", "Pulse badge", "scale"],
  ["comm", "Comm box", "scale"],
  ["devwin", "Dev Win", "scale"],
];
const SIZING = Object.fromEntries(PARTS.map(([k, , s]) => [k, s]));
const WEAPONS = new Set(["bomb", "freeze", "missile"]);
const DEVICES = [
  ["iPhone 14 Pro Max", 430, 932, 59, 34],
  ["iPhone 15 / 14 Pro", 393, 852, 59, 34],
  ["iPhone 13 mini", 375, 812, 50, 34],
  ["iPhone SE", 375, 667, 20, 0],
  ["iPad Air", 820, 1180, 24, 20],
];
const ANCHORS = [["tl", "Top left"], ["tc", "Top centre"], ["tr", "Top right"], ["ts", "Top stretch"], ["bl", "Bottom left"], ["bc", "Bottom centre"], ["br", "Bottom right"], ["bs", "Bottom stretch"]];
const LS_LAYOUT = "polyLab.cockpit.layout";
const LS_UI = "polyLab.cockpit.ui";
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || "") ?? d; } catch { return d; } };
const clone = (o) => JSON.parse(JSON.stringify(o));
const r1 = (n) => Math.round(n);
const r2 = (n) => Math.round(n * 100) / 100;

const NEW_PANEL = { anchor: "tc", x: 0, y: 80, w: 160, h: 50, shape: "chamfer", cut: 10, fill: "#0e1e3c", fill2: "#060c1a", alpha: 0.92, stroke: "#7be2ff", strokeAlpha: 0.4, strokeW: 1, glow: 0, z: 0 };
const CUSTOM_DEFAULTS = { shape: "round", radius: 10, fill: "#1e2846", fill2: "#0a0e1c", alpha: 0.95, stroke: "#7be2ff", strokeAlpha: 0.6, strokeW: 1, glow: 0 };
const TEXT_DEFAULTS = { color: "#ffffff", font: 12, weight: 700, family: "mono", spacing: 0.04 };

// ── geometry helpers (all in the device's logical px) ─────────────────────────────────────────
function moveBy(item, dx, dy) {
  const n = { ...item };
  const hz = item.anchor[1], v = item.anchor[0];
  if (hz === "l" || hz === "c") n.x = r1((item.x || 0) + dx);
  else if (hz === "r") n.x = r1((item.x || 0) - dx);
  n.y = r1((item.y || 0) + (v === "t" ? dy : -dy));
  if (hz === "c" && Math.abs(n.x) <= 3) n.x = 0; // snap to the centre line
  return n;
}
function resizeBy(item, dx, dy, sizing, rect0) {
  const n = { ...item };
  const hz = item.anchor[1], v = item.anchor[0];
  if (sizing === "scale") {
    n.scale = r2(Math.max(0.3, Math.min(3, (item.scale || 1) * ((rect0.width + dx) / rect0.width))));
    return n;
  }
  if (hz !== "s") {
    const w = Math.max(12, (item.w || rect0.width) + dx);
    const dw = w - (item.w || rect0.width);
    n.w = r1(w);
    if (hz === "r") n.x = r1((item.x || 0) - dw);
    if (hz === "c") n.x = r1((item.x || 0) + dw / 2);
  }
  const h = Math.max(8, (item.h || rect0.height) + dy);
  const dh = h - (item.h || rect0.height);
  n.h = r1(h);
  if (v === "b") n.y = r1((item.y || 0) - dh);
  return n;
}
function reanchor(item, anchor, rect, dev, sizing) {
  const [, W, H, sat, sab] = dev;
  const n = { ...item, anchor };
  const hz = anchor[1], v = anchor[0];
  n.x = r1(hz === "l" || hz === "s" ? rect.left : hz === "r" ? W - rect.right : rect.left + rect.width / 2 - W / 2);
  n.y = r1(v === "t" ? rect.top - (item.bleed ? 0 : sat) : H - rect.bottom - (item.bleed ? 0 : sab));
  if (sizing !== "scale") {
    if (hz === "s") delete n.w;
    else if (!n.w) n.w = r1(rect.width);
  }
  return n;
}

// ── small controls ────────────────────────────────────────────────────────────────────────────
function Num({ label, value, onChange, min = -500, max = 1200, step = 1 }) {
  return (
    <label className="pRow"><span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value ?? 0} onChange={(e) => onChange(Number(e.target.value))} />
      <input className="pNum" type="number" step={step} value={value ?? 0} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}
function Color({ label, value, onChange }) {
  return <label className="pRow"><span>{label}</span><input type="color" value={value || "#000000"} onChange={(e) => onChange(e.target.value)} /><code>{value}</code></label>;
}
function Sel({ label, value, options, onChange }) {
  return (
    <label className="pRow"><span>{label}</span>
      <select className="pText" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}
function Check({ label, value, onChange }) {
  return <label className="pRow"><span>{label}</span><input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} /></label>;
}
function Text({ label, value, onChange }) {
  return <label className="pRow"><span>{label}</span><input className="pText" value={value || ""} onChange={(e) => onChange(e.target.value)} /></label>;
}

function ShapeFields({ it, set, panel }) {
  const shapes = panel ? [["chamfer", "Chamfer"], ["round", "Rounded"], ["trapezoid", "Trapezoid"]] : [["round", "Rounded"], ["chamfer", "Chamfer"]];
  return (
    <>
      <Sel label="shape" value={it.shape || "round"} options={shapes} onChange={(v) => set({ shape: v })} />
      {it.shape === "chamfer" && <Num label="corner cut" value={it.cut ?? 10} min={0} max={40} onChange={(v) => set({ cut: v })} />}
      {it.shape === "trapezoid" && <Num label="slant %" value={it.inset ?? 6} min={-30} max={30} onChange={(v) => set({ inset: v })} />}
      {(it.shape || "round") === "round" && <Num label="radius" value={it.radius ?? 10} min={0} max={60} onChange={(v) => set({ radius: v })} />}
      <Color label="fill top" value={it.fill} onChange={(v) => set({ fill: v })} />
      <Color label="fill bottom" value={it.fill2 || it.fill} onChange={(v) => set({ fill2: v })} />
      <Num label="fill opacity" value={it.alpha ?? 1} min={0} max={1} step={0.01} onChange={(v) => set({ alpha: v })} />
      <Color label="stroke" value={it.stroke} onChange={(v) => set({ stroke: v })} />
      <Num label="stroke opacity" value={it.strokeAlpha ?? 1} min={0} max={1} step={0.01} onChange={(v) => set({ strokeAlpha: v })} />
      <Num label="stroke width" value={it.strokeW ?? 1} min={0} max={6} step={0.5} onChange={(v) => set({ strokeW: v })} />
      <Num label="glow" value={it.glow ?? 0} min={0} max={40} onChange={(v) => set({ glow: v })} />
    </>
  );
}
function TypeFields({ it, set }) {
  return (
    <>
      <Color label="text colour" value={it.color} onChange={(v) => set({ color: v })} />
      <Num label="font size" value={it.font ?? 12} min={6} max={48} onChange={(v) => set({ font: v })} />
      <Sel label="weight" value={String(it.weight ?? 700)} options={[["400", "400"], ["600", "600"], ["700", "700"], ["800", "800"], ["900", "900"]]} onChange={(v) => set({ weight: Number(v) })} />
      <Sel label="font" value={it.family || "mono"} options={[["mono", "Mono"], ["sans", "Sans"]]} onChange={(v) => set({ family: v })} />
      <Num label="letter spacing" value={it.spacing ?? 0} min={-0.05} max={0.5} step={0.01} onChange={(v) => set({ spacing: v })} />
      <Num label="text glow" value={it.textGlow ?? 0} min={0} max={30} onChange={(v) => set({ textGlow: v })} />
      <Text label="label above" value={it.label} onChange={(v) => set({ label: v })} />
    </>
  );
}

export default function CockpitDesigner({ modeSwitch }) {
  const ui0 = load(LS_UI, {});
  const [layout, setLayoutState] = useState(() => load(LS_LAYOUT, null));
  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);
  const [sel, setSel] = useState(ui0.sel || "bomb"); // part key or "panel:<id>"
  const [devIdx, setDevIdx] = useState(ui0.devIdx ?? 0);
  const [level, setLevel] = useState(ui0.level ?? 3);
  const [design, setDesign] = useState(true);
  const [showAll, setShowAll] = useState(ui0.showAll ?? true);
  const [showField, setShowField] = useState(ui0.showField ?? false);
  const [rects, setRects] = useState({});
  const [field, setField] = useState(null);
  const [status, setStatus] = useState("Booting the game…");
  const [ready, setReady] = useState(false);
  const [scale, setScale] = useState(0.8);
  const frameRef = useRef(null);
  const drag = useRef(null);
  const lastPush = useRef(0);
  const dev = DEVICES[devIdx];
  const [, W, H, sat, sab] = dev;
  const bridge = () => frameRef.current?.contentWindow?.__cockpitLab;

  // first run: start from the game's own cockpitLayout.js
  useEffect(() => {
    if (layout) return;
    fetch("/__cockpit/load").then((r) => r.json()).then(setLayoutState).catch((e) => setStatus(`Couldn't read cockpitLayout.js: ${e}`));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const fit = () => setScale(Math.min(1, (window.innerHeight - 130) / H, (window.innerWidth - 640) / W));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [W, H]);

  useEffect(() => { try { localStorage.setItem(LS_UI, JSON.stringify({ sel, devIdx, level, showAll, showField })); } catch { /* ignore */ } }, [sel, devIdx, level, showAll, showField]);
  useEffect(() => {
    if (!layout) return;
    try { localStorage.setItem(LS_LAYOUT, JSON.stringify(layout)); } catch { /* ignore */ }
    bridge()?.setLayout(clone(layout));
  }, [layout]);
  useEffect(() => { bridge()?.setSafeInsets(sat, sab); }, [sat, sab, ready]);
  useEffect(() => { bridge()?.setPreviewAll(showAll); }, [showAll, ready]);

  // edits: `commit` records undo history (coalescing rapid slider changes), `setLive` doesn't
  const commit = useCallback((next, coalesce = false) => {
    setLayoutState((cur) => {
      const now = performance.now();
      if (!(coalesce && now - lastPush.current < 500)) { setPast((p) => [...p.slice(-80), cur]); setFuture([]); }
      lastPush.current = now;
      return typeof next === "function" ? next(cur) : next;
    });
  }, []);
  const undo = () => { if (!past.length) return; setFuture((f) => [layout, ...f]); setLayoutState(past[past.length - 1]); setPast((p) => p.slice(0, -1)); };
  const redo = () => { if (!future.length) return; setPast((p) => [...p, layout]); setLayoutState(future[0]); setFuture((f) => f.slice(1)); };

  const getItem = (L, key) => (key.startsWith("panel:") ? L.panels.find((p) => `panel:${p.id}` === key) : L.parts[key]);
  const withItem = (L, key, fn) => {
    const n = clone(L);
    if (key.startsWith("panel:")) n.panels = n.panels.map((p) => (`panel:${p.id}` === key ? fn(p) : p));
    else n.parts[key] = fn(n.parts[key]);
    return n;
  };
  const setProps = (patch) => commit((L) => withItem(L, sel, (it) => ({ ...it, ...patch })), true);

  // boot the game inside the iframe and start a level
  const boot = useCallback(() => {
    let tries = 0;
    setReady(false);
    const wait = () => {
      const b = bridge();
      if (!b) { if (++tries < 150) setTimeout(wait, 100); else setStatus("The game didn't expose __cockpitLab — check its console."); return; }
      b.setSafeInsets(sat, sab);
      if (layout) b.setLayout(clone(layout));
      b.setPreviewAll(showAll);
      b.start(level);
      setReady(true);
    };
    wait();
  }, [sat, sab, layout, showAll, level]);
  const restart = () => bridge()?.start(level);
  // (the iframe is keyed by device: the arcade locks its world size, so a switch reboots the game)

  // poll the real elements' rects (~10 fps) so the overlay tracks the game
  useEffect(() => {
    let t;
    const poll = () => {
      const doc = frameRef.current?.contentDocument;
      if (doc) {
        const next = {};
        for (const el of doc.querySelectorAll("[data-cockpit]")) {
          const r = el.getBoundingClientRect();
          if (r.width && r.height) next[el.dataset.cockpit] = { left: r.left, top: r.top, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
        }
        setRects((cur) => (JSON.stringify(cur) === JSON.stringify(next) ? cur : next));
        const b = bridge();
        if (b && showField) setField(b.isActive() ? b.playfield() : null);
        if (b) setStatus((cur) => (/^Sav|^Reload|copied|failed/.test(cur) ? cur : b.isActive() ? "Cockpit live" : "Waiting for an Arcade level… (Restart level)"));
      }
      t = setTimeout(poll, 100);
    };
    poll();
    return () => clearTimeout(t);
  }, [showField]);

  // drag / resize on the overlay
  const onDown = (e, key, mode) => {
    e.preventDefault();
    e.stopPropagation();
    setSel(key);
    const rect0 = rects[key];
    if (!rect0 || !layout) return;
    commit((L) => L); // one undo step per drag
    drag.current = { key, mode, x: e.clientX, y: e.clientY, item0: clone(getItem(layout, key)), rect0 };
  };
  useEffect(() => {
    const move = (e) => {
      const d = drag.current;
      if (!d) return;
      const dx = (e.clientX - d.x) / scale, dy = (e.clientY - d.y) / scale;
      const sizing = d.key.startsWith("panel:") ? "box" : SIZING[d.key];
      const next = d.mode === "move" ? moveBy(d.item0, dx, dy) : resizeBy(d.item0, d.mode === "s" ? 0 : dx, d.mode === "e" ? 0 : dy, sizing, d.rect0);
      setLayoutState((L) => withItem(L, d.key, () => next));
    };
    const up = () => { drag.current = null; };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, [scale]); // eslint-disable-line react-hooks/exhaustive-deps

  // keyboard: arrows nudge, ⌘Z / ⇧⌘Z, ⌘D duplicates a panel, Delete removes one
  useEffect(() => {
    const key = (e) => {
      if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
      const step = e.shiftKey ? 10 : 1;
      const nudge = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      if (nudge && layout && getItem(layout, sel)) { e.preventDefault(); commit((L) => withItem(L, sel, (it) => moveBy(it, ...nudge)), true); return; }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d" && sel.startsWith("panel:")) { e.preventDefault(); duplicatePanel(); return; }
      if ((e.key === "Delete" || e.key === "Backspace") && sel.startsWith("panel:")) { e.preventDefault(); deletePanel(); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });

  const newPanelId = (L) => { let i = 1; while (L.panels.some((p) => p.id === `panel${i}`)) i++; return `panel${i}`; };
  const addPanel = () => { const id = newPanelId(layout); commit((L) => ({ ...L, panels: [...L.panels, { id, ...NEW_PANEL }] })); setSel(`panel:${id}`); };
  const duplicatePanel = () => {
    const src = getItem(layout, sel);
    if (!src) return;
    const id = newPanelId(layout);
    commit((L) => ({ ...L, panels: [...L.panels, { ...clone(src), id, y: (src.y || 0) + 12 }] }));
    setSel(`panel:${id}`);
  };
  const deletePanel = () => { commit((L) => ({ ...L, panels: L.panels.filter((p) => `panel:${p.id}` !== sel) })); setSel("bomb"); };

  const save = async () => {
    setStatus("Saving…");
    try {
      const res = await fetch("/__cockpit/save", { method: "POST", body: JSON.stringify(layout) });
      const j = await res.json();
      setStatus(j.ok ? "Saved to cockpitLayout.js — ship a build to see it on the phone" : `Save failed: ${j.error}`);
    } catch (e) { setStatus(`Save failed: ${e}`); }
  };
  const reloadFromFile = async () => {
    try { const L = await (await fetch("/__cockpit/load")).json(); commit(L); setStatus("Reloaded from cockpitLayout.js"); } catch (e) { setStatus(`Reload failed: ${e}`); }
  };
  const copyJson = () => { navigator.clipboard?.writeText(JSON.stringify(layout, null, 1)); setStatus("Layout JSON copied"); };

  if (!layout) return <div className="labErr">{status}</div>;
  const it = getItem(layout, sel);
  const isPanel = sel.startsWith("panel:");
  const sizing = isPanel ? "box" : SIZING[sel];
  const selLabel = isPanel ? `Panel · ${sel.slice(6)}` : PARTS.find((p) => p[0] === sel)?.[1];
  const changeAnchor = (a) => {
    const rect = rects[sel];
    if (!rect) { setProps({ anchor: a }); return; }
    commit((L) => withItem(L, sel, (x) => reanchor(x, a, rect, dev, sizing)));
  };
  const changeSkin = (skin) => setProps({ skin, ...(skin !== "native" ? { ...TEXT_DEFAULTS, ...pick(it, TEXT_DEFAULTS) } : {}), ...(skin === "custom" ? { ...CUSTOM_DEFAULTS, ...pick(it, CUSTOM_DEFAULTS) } : {}) });

  return (
    <div className="lab cd">
      <aside className="labList">
        <h1>POLYVERSE<br /><span>Cockpit Designer</span></h1>
        {modeSwitch}
        <div className="labGroup">
          <h3>Device</h3>
          {DEVICES.map((d, i) => <button key={d[0]} className={`labItem${i === devIdx ? " on" : ""}`} onClick={() => setDevIdx(i)}>{d[0]} <small className="cdDim">{d[1]}×{d[2]}</small></button>)}
        </div>
        <div className="labGroup">
          <h3>HUD parts</h3>
          {PARTS.map(([k, label]) => (
            <button key={k} className={`labItem${sel === k ? " on" : ""}${layout.parts[k]?.hidden ? " cdHidden" : ""}`} onClick={() => setSel(k)}>
              {label}{!rects[k] && !layout.parts[k]?.hidden ? <small className="cdDim"> · not on screen</small> : null}
            </button>
          ))}
        </div>
        <div className="labGroup">
          <h3>Panels <button className="cdMini" onClick={addPanel}>+ Add</button></h3>
          {layout.panels.map((p) => <button key={p.id} className={`labItem${sel === `panel:${p.id}` ? " on" : ""}${p.hidden ? " cdHidden" : ""}`} onClick={() => setSel(`panel:${p.id}`)}>{p.id}</button>)}
        </div>
      </aside>

      <main className="labStage">
        <div className="labBar">
          <div className="labScenes">
            <button className={design ? "on" : ""} onClick={() => setDesign(true)}>Design</button>
            <button className={!design ? "on" : ""} onClick={() => setDesign(false)}>Play</button>
          </div>
          <label className="cdInline">Level <input className="pNum" type="number" min={1} max={15} value={level} onChange={(e) => setLevel(Math.max(1, Math.min(15, Number(e.target.value) || 1)))} /></label>
          <button className="cdBtn" onClick={restart} disabled={!ready}>Restart level</button>
          <label className="cdInline"><input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Show hidden states</label>
          <label className="cdInline"><input type="checkbox" checked={showField} onChange={(e) => setShowField(e.target.checked)} /> Playfield</label>
          <button className="cdBtn" onClick={undo} disabled={!past.length} title="⌘Z">Undo</button>
          <button className="cdBtn" onClick={redo} disabled={!future.length} title="⇧⌘Z">Redo</button>
        </div>
        <div className="phoneWrap" style={{ width: W * scale + 20, height: H * scale + 20 }}>
          <div className="phone cdPhone" style={{ width: W + 20, height: H + 20, transform: `scale(${scale})` }}>
            <iframe key={devIdx} ref={frameRef} title="Stroids" src="/game/index.html?cockpitLab=1" style={{ width: W, height: H }} onLoad={boot} />
            <div className="cdSafe top" style={{ height: sat }} />
            <div className="cdSafe bottom" style={{ height: sab }} />
            <div className={`cdOverlay${design ? "" : " play"}`} style={{ width: W, height: H }} onPointerDown={() => design && setSel(sel)}>
              {design && field && showField && <div className="cdField" style={{ left: field.x, top: field.y, width: field.w, height: field.h }} />}
              {design && Object.entries(rects).map(([k, r]) => {
                const on = k === sel;
                return (
                  <div key={k} className={`cdBox${on ? " on" : ""}${k.startsWith("panel:") ? " panel" : ""}`} style={{ left: r.left, top: r.top, width: r.width, height: r.height, zIndex: on ? 3 : k.startsWith("panel:") ? 1 : 2 }} onPointerDown={(e) => onDown(e, k, "move")}>
                    {on && <><i className="cdH e" onPointerDown={(e) => onDown(e, k, "e")} /><i className="cdH s" onPointerDown={(e) => onDown(e, k, "s")} /><i className="cdH se" onPointerDown={(e) => onDown(e, k, "se")} /></>}
                    {on && <span className="cdTag">{k.replace("panel:", "▭ ")}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <p className="labNote">{status} · Design: drag to move, handles to resize, arrows nudge (⇧ = 10px). Play: the mouse is your finger.</p>
      </main>

      <aside className="labProps">
        <div className="labPropsHead"><h2>{selLabel}</h2></div>
        {it ? (
          <div className="pList">
            <Sel label="anchor" value={it.anchor} options={ANCHORS.filter(([a]) => a[1] !== "s" || sizing === "box")} onChange={changeAnchor} />
            {it.anchor?.[1] !== "s" && <Num label={it.anchor?.[1] === "c" ? "x (from centre)" : "x"} value={it.x} onChange={(v) => setProps({ x: v })} />}
            {it.anchor?.[1] === "s" && <Num label="side inset" value={it.x} min={0} max={200} onChange={(v) => setProps({ x: v })} />}
            <Num label="y" value={it.y} min={-100} max={600} onChange={(v) => setProps({ y: v })} />
            {sizing === "box" && it.anchor?.[1] !== "s" && <Num label="width" value={it.w ?? r1(rects[sel]?.width || 0)} min={8} max={W} onChange={(v) => setProps({ w: v })} />}
            {sizing === "box" && <Num label="height" value={it.h ?? r1(rects[sel]?.height || 0)} min={8} max={400} onChange={(v) => setProps({ h: v })} />}
            {sizing === "scale" && <Num label="scale" value={it.scale ?? 1} min={0.3} max={3} step={0.01} onChange={(v) => setProps({ scale: v })} />}
            {isPanel && <Check label="bleed into safe area" value={it.bleed} onChange={(v) => setProps({ bleed: v })} />}
            <Num label="layer (z)" value={it.z ?? (isPanel ? 0 : 1)} min={-5} max={10} onChange={(v) => setProps({ z: v })} />
            <Check label="hidden" value={it.hidden} onChange={(v) => setProps({ hidden: v })} />
            {isPanel ? <ShapeFields it={it} set={setProps} panel /> : sel !== "comm" && (
              <>
                <Sel label="skin" value={it.skin || "native"} options={[["native", "Native (game's own look)"], ["text", "Text only"], ["custom", "Custom panel"]]} onChange={changeSkin} />
                {(it.skin === "text" || it.skin === "custom") && <TypeFields it={it} set={setProps} />}
                {it.skin === "custom" && <ShapeFields it={it} set={setProps} />}
                {WEAPONS.has(sel) && it.skin === "custom" && <Num label="icon size" value={it.icon ?? 30} min={10} max={60} onChange={(v) => setProps({ icon: v })} />}
                {WEAPONS.has(sel) && it.skin === "custom" && <Check label="count in corner" value={it.countCorner} onChange={(v) => setProps({ countCorner: v })} />}
              </>
            )}
            {isPanel && <div className="labPropsBtns"><button onClick={duplicatePanel}>Duplicate (⌘D)</button><button onClick={deletePanel}>Delete</button></div>}
          </div>
        ) : <p className="labDesc">Pick a part or panel.</p>}
        <div className="labPicks">
          <button className="copyBtn" onClick={save}>SAVE TO GAME</button>
          <div className="labPropsBtns"><button onClick={copyJson}>Copy JSON</button><button onClick={reloadFromFile}>Reload from file</button></div>
          <p className="labDesc">Save writes <code>cockpitLayout.js</code> in the repo. The phone shows it after the next build (ship-ios). Your work in progress is also kept in this browser.</p>
        </div>
      </aside>
    </div>
  );
}

function pick(src, keys) {
  return Object.fromEntries(Object.keys(keys).filter((k) => src?.[k] != null).map((k) => [k, src[k]]));
}
