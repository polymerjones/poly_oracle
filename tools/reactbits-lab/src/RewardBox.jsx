// Reward Box (2026-10-26) — lock in the reward chest's sounds against the real game.
// The game runs in an iframe (/game/index.html?rewardLab=1) and exposes window.__rewardBoxLab
// (sfxFiles / setSfx / preview). Every edit is pushed live, so PREVIEW CHEST + tapping the chest in
// the phone plays exactly what you hear in-game. ▶ auditions one layer from the Lab page itself.
// BAKE writes rewardBoxSfx.js at the repo root (/__rewardbox/save) — then `npm run prepare:web`.
import { useCallback, useEffect, useRef, useState } from "react";

const MOMENTS = [
  ["arrive", "Chest arrives", "The chest whizzes in on the teal swirl."],
  ["tap", "Each tap (1–5)", "Plays on every shake tap. Ramps add volume / speed per tap so it builds."],
  ["open", "Chest opens", "Tap 6: screen flash, open frames, confetti."],
  ["collect", "COLLECT", "Player taps COLLECT (or the ×2 ad pays out)."],
];
const DEFAULTS = {
  arrive: [{ key: "warp", vol: 0.7 }],
  tap: [{ key: "blip1", vol: 0.6, volRamp: 0.3, rate: 0.85, rateRamp: 0.09 }],
  open: [{ key: "bling", vol: 0.9 }, { key: "pickup_weapon", vol: 0.9 }],
  collect: [{ key: "level_up", vol: 0.8 }],
};
const LS = "polyLab.rewardBox";
const W = 390, H = 844;
const round = (v) => Math.round(v * 100) / 100;

function Slider({ label, value, min, max, step, onChange }) {
  return (
    <label className="rbSlider">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(round(Number(e.target.value)))} />
      <b>{value}</b>
    </label>
  );
}

export default function RewardBox({ modeSwitch }) {
  const [cfg, setCfg] = useState(() => { try { return JSON.parse(localStorage.getItem(LS)) || null; } catch { return null; } });
  const [files, setFiles] = useState({});
  const [status, setStatus] = useState("Booting the game…");
  const [ready, setReady] = useState(false);
  const [scale, setScale] = useState(0.8);
  const [filter, setFilter] = useState("");
  const frameRef = useRef(null);
  const audioRef = useRef(null);
  const bridge = () => frameRef.current?.contentWindow?.__rewardBoxLab;

  useEffect(() => {
    const fit = () => setScale(Math.min(1, (window.innerHeight - 130) / H));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  useEffect(() => { if (cfg) try { localStorage.setItem(LS, JSON.stringify(cfg)); } catch { /* ignore */ } }, [cfg]);
  useEffect(() => { if (ready && cfg) bridge()?.setSfx(JSON.parse(JSON.stringify(cfg))); }, [cfg, ready]);

  const boot = useCallback(() => {
    setReady(false);
    let tries = 0;
    const wait = () => {
      const b = bridge();
      if (b) {
        setFiles(b.sfxFiles());
        // first visit: start from what the game ships (rewardBoxSfx.js)
        setCfg((cur) => cur || JSON.parse(JSON.stringify(frameRef.current.contentWindow.POLY_REWARD_BOX_SFX || DEFAULTS)));
        setReady(true);
        setStatus("Ready — PREVIEW CHEST, then tap the chest in the phone (click inside the phone once so it can play audio).");
        return;
      }
      if (++tries < 100) setTimeout(wait, 150);
      else setStatus("Couldn't reach the game — check its console.");
    };
    setTimeout(wait, 300);
  }, []);

  const keys = Object.keys(files).sort();
  const shown = filter ? keys.filter((k) => k.toLowerCase().includes(filter.toLowerCase()) || files[k].toLowerCase().includes(filter.toLowerCase())) : keys;
  const c = cfg || DEFAULTS;
  const setLayer = (m, i, patch) => setCfg({ ...c, [m]: c[m].map((l, j) => (j === i ? { ...l, ...patch } : l)) });
  const addLayer = (m) => setCfg({ ...c, [m]: [...(c[m] || []), { key: keys.includes("blip") ? "blip" : keys[0], vol: 0.8 }] });
  const removeLayer = (m, i) => setCfg({ ...c, [m]: c[m].filter((_, j) => j !== i) });

  const audition = (l, taps = 0) => {
    const file = files[l.key];
    if (!file) return;
    audioRef.current?.pause();
    const a = new Audio(`/game/${file}`);
    a.preservesPitch = false;
    a.volume = Math.min(1, Math.max(0, (l.vol || 0) + (l.volRamp || 0) * (taps / 6)));
    a.playbackRate = Math.max(0.25, (l.rate ?? 1) + (l.rateRamp || 0) * taps);
    a.play().catch(() => {});
    audioRef.current = a;
  };
  const auditionMoment = (m, taps = m === "tap" ? 1 : 0) => (c[m] || []).forEach((l) => audition(l, taps));
  const tapRun = () => { for (let t = 1; t <= 5; t += 1) setTimeout(() => (c.tap || []).forEach((l) => audition(l, t)), (t - 1) * 380); };

  const bake = async () => {
    if (!window.confirm("Write these chest sounds into rewardBoxSfx.js?")) return;
    const r = await fetch("/__rewardbox/save", { method: "POST", body: JSON.stringify(c) }).then((x) => x.json()).catch((e) => ({ ok: false, error: String(e) }));
    setStatus(r.ok ? "Baked → rewardBoxSfx.js. Run npm run prepare:web (repo root) before shipping." : `Bake failed: ${r.error}`);
  };

  return (
    <div className="lab cd rb">
      <aside className="labList">
        <h1>POLYVERSE<br /><span>Reward Box</span></h1>
        {modeSwitch}
        <div className="labGroup">
          <h3>Sound library</h3>
          <input className="labSearch" placeholder="Filter sounds…" value={filter} onChange={(e) => setFilter(e.target.value)} />
          <div className="rbLib">
            {shown.map((k) => (
              <button key={k} className="labItem" title={files[k]} onClick={() => audition({ key: k, vol: 0.9 })}>▶ {k}</button>
            ))}
          </div>
        </div>
      </aside>

      <main className="labStage">
        <div className="labBar">
          <div className="labScenes"><button className="on" onClick={() => bridge()?.preview()} disabled={!ready}>PREVIEW CHEST</button></div>
          <button className="cdBtn" onClick={() => { frameRef.current?.contentWindow?.location.reload(); }}>Reload game</button>
        </div>
        <div className="phoneWrap" style={{ width: W * scale + 20, height: H * scale + 20 }}>
          <div className="phone cdPhone" style={{ width: W + 20, height: H + 20, transform: `scale(${scale})` }}>
            <iframe ref={frameRef} title="Stroids" src="/game/index.html?rewardLab=1" style={{ width: W, height: H }} onLoad={boot} />
          </div>
        </div>
        <p className="labNote">{status}</p>
      </main>

      <aside className="labProps">
        <div className="labPropsHead"><h2>Chest sounds</h2></div>
        <p className="labDesc">Each moment plays all its layers at once. Pick a sound, set volume / speed, ▶ to hear it. Click a sound in the library on the left to audition it first.</p>
        {MOMENTS.map(([m, label, desc]) => (
          <div key={m} className="rbMoment">
            <div className="rbMomentHead">
              <h3>{label}</h3>
              <button onClick={() => (m === "tap" ? tapRun() : auditionMoment(m))}>{m === "tap" ? "▶ taps 1–5" : "▶"}</button>
            </div>
            <p className="labDesc">{desc}</p>
            {(c[m] || []).map((l, i) => (
              <div key={i} className="rbLayer">
                <div className="rbLayerTop">
                  <select value={l.key} onChange={(e) => setLayer(m, i, { key: e.target.value })}>
                    {!keys.includes(l.key) && <option value={l.key}>{l.key}</option>}
                    {keys.map((k) => <option key={k} value={k}>{k}</option>)}
                  </select>
                  <button onClick={() => audition(l, m === "tap" ? 1 : 0)}>▶</button>
                  <button onClick={() => removeLayer(m, i)} title="remove layer">✕</button>
                </div>
                <Slider label="vol" value={l.vol ?? 0.8} min={0} max={1.5} step={0.05} onChange={(v) => setLayer(m, i, { vol: v })} />
                <Slider label="speed" value={l.rate ?? 1} min={0.5} max={2} step={0.05} onChange={(v) => setLayer(m, i, { rate: v })} />
                {m === "tap" && <Slider label="+vol/tap" value={l.volRamp ?? 0} min={0} max={0.6} step={0.05} onChange={(v) => setLayer(m, i, { volRamp: v })} />}
                {m === "tap" && <Slider label="+speed/tap" value={l.rateRamp ?? 0} min={0} max={0.2} step={0.01} onChange={(v) => setLayer(m, i, { rateRamp: v })} />}
              </div>
            ))}
            <button className="rbAdd" onClick={() => addLayer(m)} disabled={!keys.length}>+ layer</button>
          </div>
        ))}
        <div className="labPicks">
          <button className="copyBtn" onClick={() => { if (window.confirm("Reset to the original chest sounds?")) setCfg(JSON.parse(JSON.stringify(DEFAULTS))); }}>RESET</button>
          <button className="copyBtn hcBake" onClick={bake} disabled={!ready}>BAKE INTO GAME</button>
        </div>
      </aside>
    </div>
  );
}
