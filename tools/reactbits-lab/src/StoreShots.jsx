// Store Shots (2026-10-27) — pick, order and caption the App Store screenshots.
// Raw captures come from tools/capture-store-shots.cjs (store-assets/raw/<profile>/, RECAPTURE runs it);
// picks + caption copy + style live in tools/store-shots.json (autosaved via /__storeshots/save).
// Every shot is rendered in the browser on a canvas at full store size, so what you see in the preview
// is byte-for-byte what EXPORT writes to store-assets/appstore/<profile>/01.png, 02.png, …
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const PROFILES = { iphone69: { label: "iPhone 6.9\"", w: 1320, h: 2868 }, ipad13: { label: "iPad 13\"", w: 2064, h: 2752 } };
const MAX_SLOTS = 10;
const DEFAULT_STYLE = {
  layout: "frame", captionPos: "top", font: "DIN Alternate", titleSize: 0.062, subtitleSize: 0.032, uppercase: true,
  titleColor: "#ffffff", subtitleColor: "#b9c6d8", accentColor: "#33cfff", bgTop: "#1a0f3d", bgBottom: "#04060f",
  shotScale: 0.8, shotRadius: 0.045, glow: true, scrimOpacity: 0.82,
};
const FONTS = ["DIN Alternate", "Rajdhani", "Futura", "Avenir Next", "Helvetica Neue", "Arial Black", "Impact", "Trebuchet MS", "Georgia"];
const rawUrl = (profile, f) => `/game/store-assets/raw/${profile}/${f.file}?v=${Math.round(f.mtime)}`;

const imgCache = new Map();
function loadImg(url) {
  if (!imgCache.has(url)) {
    imgCache.set(url, new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = url;
    }));
  }
  return imgCache.get(url);
}

function wrap(ctx, text, maxW) {
  const lines = [];
  let line = "";
  for (const word of String(text || "").split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxW) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Caption block: accent bar, title lines, subtitle lines — top-aligned at y, centered on W. Returns its height.
function drawCaption(ctx, slot, st, W, y, measureOnly = false) {
  const tSize = Math.round(W * st.titleSize), sSize = Math.round(W * st.subtitleSize);
  const title = st.uppercase ? String(slot.title || "").toUpperCase() : slot.title;
  const sub = st.uppercase ? String(slot.subtitle || "").toUpperCase() : slot.subtitle;
  ctx.font = `bold ${tSize}px "${st.font}"`;
  const tLines = wrap(ctx, title, W * 0.86);
  ctx.font = `bold ${sSize}px "${st.font}"`;
  const sLines = wrap(ctx, sub, W * 0.86);
  const accentH = Math.max(4, Math.round(W * 0.004)), gap = Math.round(tSize * 0.35);
  const h = accentH + gap + tLines.length * tSize * 1.08 + (sLines.length ? gap * 0.8 + sLines.length * sSize * 1.25 : 0);
  if (measureOnly) return h;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillStyle = st.accentColor;
  const aw = W * 0.13;
  ctx.fillRect((W - aw) / 2, y, aw, accentH);
  let cy = y + accentH + gap;
  ctx.font = `bold ${tSize}px "${st.font}"`;
  ctx.fillStyle = st.titleColor;
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = tSize * 0.25;
  for (const l of tLines) { ctx.fillText(l, W / 2, cy); cy += tSize * 1.08; }
  ctx.font = `bold ${sSize}px "${st.font}"`;
  ctx.fillStyle = st.subtitleColor;
  cy += gap * 0.8;
  for (const l of sLines) { ctx.fillText(l, W / 2, cy); cy += sSize * 1.25; }
  ctx.shadowBlur = 0;
  return h;
}

async function renderShot(canvas, url, slot, st, W, H) {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const img = await loadImg(url);
  if (document.fonts?.load) await document.fonts.load(`bold 40px "${st.font}"`).catch(() => {});
  const capH = drawCaption(ctx, slot, st, W, 0, true);
  if (st.layout === "frame") {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, st.bgTop);
    g.addColorStop(1, st.bgBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const sw = W * st.shotScale, sh = sw * (img.height / img.width);
    const margin = H * 0.035;
    const top = st.captionPos === "top";
    const sx = (W - sw) / 2, sy = top ? H - sh - margin * 0.6 : margin * 0.6;
    const r = sw * st.shotRadius;
    if (st.glow) {
      ctx.save();
      ctx.shadowColor = st.accentColor;
      ctx.shadowBlur = W * 0.05;
      roundRect(ctx, sx, sy, sw, sh, r);
      ctx.fillStyle = "#000";
      ctx.fill();
      ctx.restore();
    }
    ctx.save();
    roundRect(ctx, sx, sy, sw, sh, r);
    ctx.clip();
    ctx.drawImage(img, sx, sy, sw, sh);
    ctx.restore();
    ctx.save();
    roundRect(ctx, sx, sy, sw, sh, r);
    ctx.lineWidth = Math.max(2, W * 0.003);
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.stroke();
    ctx.restore();
    const free = top ? sy : H - (sy + sh);
    drawCaption(ctx, slot, st, W, top ? Math.max(margin, (free - capH) / 2) : sy + sh + Math.max(margin * 0.5, (free - capH) / 2));
  } else {
    ctx.drawImage(img, 0, 0, W, H);
    const band = capH + H * 0.09;
    const top = st.captionPos === "top";
    const g = ctx.createLinearGradient(0, top ? 0 : H, 0, top ? band * 1.4 : H - band * 1.4);
    g.addColorStop(0, `rgba(4,6,15,${st.scrimOpacity})`);
    g.addColorStop(0.7, `rgba(4,6,15,${st.scrimOpacity * 0.7})`);
    g.addColorStop(1, "rgba(4,6,15,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, top ? 0 : H - band * 1.4, W, band * 1.4);
    drawCaption(ctx, slot, st, W, top ? H * 0.05 : H - capH - H * 0.04);
  }
}

function ShotCanvas({ url, slot, st, W, H, className, onClick }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && url) renderShot(ref.current, url, slot, st, W, H).catch(() => {});
  }, [url, slot, st, W, H]);
  return <canvas ref={ref} className={className} onClick={onClick} />;
}

export default function StoreShots({ modeSwitch }) {
  const [profile, setProfile] = useState("iphone69");
  const [raw, setRaw] = useState({ iphone69: [], ipad13: [] });
  const [config, setConfig] = useState(null);
  const [sel, setSel] = useState(0);
  const [status, setStatus] = useState("Loading…");
  const [busy, setBusy] = useState(false);
  const loaded = useRef(false);

  const refresh = useCallback(async () => {
    const r = await fetch("/__storeshots/list").then((x) => x.json());
    setRaw(r.raw);
    if (!loaded.current) {
      const cfg = r.config || { style: DEFAULT_STYLE, profiles: { iphone69: { slots: [] }, ipad13: { slots: [] } } };
      cfg.style = { ...DEFAULT_STYLE, ...cfg.style };
      setConfig(cfg);
      loaded.current = true;
    }
    setStatus("Click a capture to add it · reorder with ↑ ↓ · captions autosave to tools/store-shots.json");
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  // autosave (debounced)
  useEffect(() => {
    if (!config) return undefined;
    const t = setTimeout(() => { fetch("/__storeshots/save", { method: "POST", body: JSON.stringify(config) }); }, 500);
    return () => clearTimeout(t);
  }, [config]);

  const P = PROFILES[profile];
  const st = config?.style || DEFAULT_STYLE;
  const slots = config?.profiles?.[profile]?.slots || [];
  const files = raw[profile] || [];
  const fileInfo = useMemo(() => Object.fromEntries(files.map((f) => [f.file, f])), [files]);
  const urlFor = (slot) => (fileInfo[slot.file] ? rawUrl(profile, fileInfo[slot.file]) : null);

  const setSlots = (fn) => setConfig((c) => ({ ...c, profiles: { ...c.profiles, [profile]: { ...(c.profiles[profile] || {}), slots: fn(c.profiles[profile]?.slots || []) } } }));
  const setStyle = (k, v) => setConfig((c) => ({ ...c, style: { ...c.style, [k]: v } }));
  const add = (file) => {
    if (slots.length >= MAX_SLOTS) { setStatus(`Apple shows at most ${MAX_SLOTS} — remove one first.`); return; }
    setSlots((s) => [...s, { file, title: "", subtitle: "" }]);
    setSel(slots.length);
  };
  const move = (i, d) => { setSlots((s) => { const n = [...s]; const j = i + d; if (j < 0 || j >= n.length) return n; [n[i], n[j]] = [n[j], n[i]]; return n; }); setSel(i + d); };
  const remove = (i) => { setSlots((s) => s.filter((_, k) => k !== i)); setSel((x) => Math.max(0, Math.min(x, slots.length - 2))); };
  const edit = (i, k, v) => setSlots((s) => s.map((x, k2) => (k2 === i ? { ...x, [k]: v } : x)));

  const recapture = async () => {
    setBusy(true);
    setStatus(`Capturing ${P.label} scenes headless (a couple of minutes)…`);
    const r = await fetch("/__storeshots/capture", { method: "POST", body: JSON.stringify({ profile }) }).then((x) => x.json()).catch((e) => ({ ok: false, error: String(e) }));
    imgCache.clear();
    await refresh();
    setBusy(false);
    setStatus(r.ok ? `Captured: ${(r.log.match(/shot \S+/g) || []).length} scenes.` : `Capture failed: ${r.error}\n${r.log || ""}`);
  };

  const exportAll = async () => {
    if (!slots.length) return;
    setBusy(true);
    const c = document.createElement("canvas");
    for (let i = 0; i < slots.length; i++) {
      setStatus(`Exporting ${i + 1}/${slots.length}…`);
      const url = urlFor(slots[i]);
      if (!url) { setStatus(`Slot ${i + 1}: ${slots[i].file} is missing — recapture or replace it.`); setBusy(false); return; }
      await renderShot(c, url, slots[i], st, P.w, P.h);
      const r = await fetch("/__storeshots/export", { method: "POST", body: JSON.stringify({ profile, index: i + 1, png: c.toDataURL("image/png"), clear: i === 0 }) }).then((x) => x.json());
      if (!r.ok) { setStatus(`Export failed: ${r.error}`); setBusy(false); return; }
    }
    setBusy(false);
    setStatus(`Exported ${slots.length} shots → store-assets/appstore/${profile}/01.png … ${String(slots.length).padStart(2, "0")}.png (${P.w}×${P.h})`);
  };

  if (!config) return <div className="lab"><p className="labNote">{status}</p></div>;
  const cur = slots[sel];
  const usedAt = (file) => slots.map((s, i) => (s.file === file ? i + 1 : 0)).filter(Boolean);

  return (
    <div className="lab cd ss">
      <aside className="labList">
        <h1>APP STORE<br /><span>Store Shots</span></h1>
        {modeSwitch}
        <div className="labScenes ssProfiles">
          {Object.entries(PROFILES).map(([k, v]) => (
            <button key={k} className={profile === k ? "on" : ""} onClick={() => { setProfile(k); setSel(0); }}>{v.label}</button>
          ))}
        </div>
        <div className="labGroup">
          <h3>Captures · {files.length}</h3>
          <div className="ssRawGrid">
            {files.map((f) => (
              <button key={f.file} className={`ssRaw${usedAt(f.file).length ? " used" : ""}`} onClick={() => add(f.file)} title={`${f.file} — click to add`}>
                <img src={rawUrl(profile, f)} alt="" loading="lazy" />
                <span>{f.file.replace(/\.png$/, "")}</span>
                {usedAt(f.file).map((n) => <b key={n}>{String(n).padStart(2, "0")}</b>)}
              </button>
            ))}
          </div>
          <button className="cdBtn" disabled={busy} onClick={recapture}>RECAPTURE {P.label}</button>
        </div>
      </aside>

      <main className="labStage ssStage">
        <div className="labBar">
          <div className="labScenes"><button className="on">{slots.length}/{MAX_SLOTS} · {P.w}×{P.h}</button></div>
          <button className="copyBtn hcBake" disabled={busy || !slots.length} onClick={exportAll}>EXPORT 01–{String(slots.length || 1).padStart(2, "0")}</button>
        </div>
        <div className="ssStrip">
          {slots.map((s, i) => (
            <div key={`${i}-${s.file}`} className={`ssSlot${i === sel ? " on" : ""}`}>
              <div className="ssNum">{String(i + 1).padStart(2, "0")}</div>
              <ShotCanvas url={urlFor(s)} slot={s} st={st} W={P.w} H={P.h} className="ssThumb" onClick={() => setSel(i)} />
              <div className="ssSlotBtns">
                <button onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
                <button onClick={() => move(i, 1)} disabled={i === slots.length - 1}>↓</button>
                <button onClick={() => remove(i)}>✕</button>
              </div>
            </div>
          ))}
          {!slots.length && <p className="labNote">No shots picked yet — click captures on the left.</p>}
        </div>
        <p className="labNote" style={{ whiteSpace: "pre-wrap" }}>{status}</p>
      </main>

      <aside className="labProps">
        {cur ? (
          <>
            <div className="labPropsHead"><h2>{String(sel + 1).padStart(2, "0")} · {cur.file.replace(/\.png$/, "")}</h2></div>
            <ShotCanvas url={urlFor(cur)} slot={cur} st={st} W={P.w} H={P.h} className="ssBig" />
            <label className="ssField">Title<input value={cur.title} onChange={(e) => edit(sel, "title", e.target.value)} /></label>
            <label className="ssField">Subtitle<input value={cur.subtitle} onChange={(e) => edit(sel, "subtitle", e.target.value)} /></label>
          </>
        ) : <p className="labDesc">Pick a slot to edit its caption.</p>}
        <h3 className="ssHead">Style · all shots</h3>
        <div className="ssStyle">
          <label>Layout<select value={st.layout} onChange={(e) => setStyle("layout", e.target.value)}><option value="frame">Frame (shot inset)</option><option value="overlay">Overlay (full bleed)</option></select></label>
          <label>Caption<select value={st.captionPos} onChange={(e) => setStyle("captionPos", e.target.value)}><option value="top">Top</option><option value="bottom">Bottom</option></select></label>
          <label>Font<select value={st.font} onChange={(e) => setStyle("font", e.target.value)}>{FONTS.map((f) => <option key={f}>{f}</option>)}</select></label>
          <label>UPPERCASE<input type="checkbox" checked={st.uppercase} onChange={(e) => setStyle("uppercase", e.target.checked)} /></label>
          <label>Title size<input type="range" min="0.03" max="0.1" step="0.002" value={st.titleSize} onChange={(e) => setStyle("titleSize", +e.target.value)} /></label>
          <label>Subtitle size<input type="range" min="0.015" max="0.06" step="0.001" value={st.subtitleSize} onChange={(e) => setStyle("subtitleSize", +e.target.value)} /></label>
          {st.layout === "frame" ? (
            <>
              <label>Shot size<input type="range" min="0.6" max="0.92" step="0.01" value={st.shotScale} onChange={(e) => setStyle("shotScale", +e.target.value)} /></label>
              <label>Corner radius<input type="range" min="0" max="0.1" step="0.005" value={st.shotRadius} onChange={(e) => setStyle("shotRadius", +e.target.value)} /></label>
              <label>Glow<input type="checkbox" checked={st.glow} onChange={(e) => setStyle("glow", e.target.checked)} /></label>
              <label>BG top<input type="color" value={st.bgTop} onChange={(e) => setStyle("bgTop", e.target.value)} /></label>
              <label>BG bottom<input type="color" value={st.bgBottom} onChange={(e) => setStyle("bgBottom", e.target.value)} /></label>
            </>
          ) : (
            <label>Scrim<input type="range" min="0" max="1" step="0.02" value={st.scrimOpacity} onChange={(e) => setStyle("scrimOpacity", +e.target.value)} /></label>
          )}
          <label>Title color<input type="color" value={st.titleColor} onChange={(e) => setStyle("titleColor", e.target.value)} /></label>
          <label>Subtitle color<input type="color" value={st.subtitleColor} onChange={(e) => setStyle("subtitleColor", e.target.value)} /></label>
          <label>Accent / glow<input type="color" value={st.accentColor} onChange={(e) => setStyle("accentColor", e.target.value)} /></label>
        </div>
      </aside>
    </div>
  );
}
