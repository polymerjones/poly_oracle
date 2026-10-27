// Polyverse React Bits Lab — try React Bits effects against real Poly Oracle / Stroids art in a
// phone-sized frame, tune their props, star favorites and COPY PICKS. Winners get ported to vanilla
// JS/WebGL for the app (the app has no React). Components come from `npm run pull`.
import { Component, Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import manifest from "./rb/manifest.json";
import HudConcepts, { HUD_CONCEPTS } from "./HudConcepts.jsx";
import CockpitDesigner from "./CockpitDesigner.jsx";
import HubCards from "./HubCards.jsx";
import RewardBox from "./RewardBox.jsx";

const HUD_NOTES = {
  E: "A's canopy (Paul liked the look) with the weapons moved UP TOP: big hex pods hanging off the canopy rim on struts. The art is oversized and breaks out of its hex; the count is a chunky arcade digit plate. Bottom of the screen stays clear for play + the comm box.",
  F: "A's canopy with the weapons mounted on the canopy struts as round turret gauges — freeze/bomb left, missile/POLYSLOTS right. The glowing ring around each icon fills with how many you hold out of the max (bomb 9, freeze/missile 3).",
  G: "A's canopy with no weapon boxes at all: big floating icons with neon halos on a glowing rail under the canopy rim. Ammo is segmented pips like an arcade lives bar instead of a number.",
  D: "Hybrid of A + C: C's chamfered top panels (pause/lives · level + score · multiplier — no time bar, the perimeter border stays the clock) and A's dashboard slimmed to ~86px holding the weapons, POLYSLOTS and the NET/AUTO plasma control. Comm box sits above the dash like a cockpit monitor. Tap weapons to arm, tap NET to toggle.",
  A: "Cockpit glass canopy up top (pause + ship lives on the left strut, big score readout, multiplier gauge right). Weapons move to an illuminated dashboard console along the bottom — thumb-reachable.",
  B: "Minimal fighter-jet visor: corner brackets, mono readouts (level/time top-left, score + life pips + multiplier top-right). Weapons sit on a right-edge rail. Keeps the most playfield clear.",
  C: "Command deck: three chamfered holo panels across the top (pause/lives · level, score, time bar · multiplier) and a chamfered weapon tray at the bottom with POLYSLOTS built in.",
};

const loaders = import.meta.glob("./rb/*/*.jsx");
const lazyCache = {};
function getComponent(name) {
  if (!lazyCache[name]) {
    const key = `./rb/${name}/${name}.jsx`;
    lazyCache[name] = lazy(() => loaders[key]());
  }
  return lazyCache[name];
}

const CATEGORY_LABEL = { background: "Backgrounds", transition: "Transitions", text: "Text", card: "Cards", button: "Buttons", wrapper: "Interaction" };
const SCENES = [
  ["hub", "Polyverse hub"],
  ["oracle", "Oracle page"],
  ["warp", "Level warp"],
  ["title", "Title"],
];
const FAV_KEY = "polyLab.favs";
const PROPS_KEY = "polyLab.props";
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || "") ?? d; } catch { return d; } };

class Boundary extends Component {
  state = { err: null };
  static getDerivedStateFromError(err) { return { err }; }
  componentDidUpdate(prev) { if (prev.resetKey !== this.props.resetKey && this.state.err) this.setState({ err: null }); }
  render() {
    if (this.state.err) return <div className="labErr">This effect threw: {String(this.state.err.message || this.state.err)}</div>;
    return this.props.children;
  }
}

function useFps() {
  const [fps, setFps] = useState(0);
  useEffect(() => {
    let raf, frames = 0, last = performance.now();
    const tick = (t) => {
      frames++;
      if (t - last >= 500) { setFps(Math.round((frames * 1000) / (t - last))); frames = 0; last = t; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return fps;
}

// ── Scene mockups (real game art) ─────────────────────────────────────────────────────────────
function HubContent({ heroWrap = (x) => x, tileWrap = (x) => x, titleNode = null }) {
  const tiles = [["Arcade", "#7be2ff", "/art/roid01.png"], ["Stunt Mode", "#b48cff"], ["Scoreboard", "#ffd36a"], ["Cheat Codes", "#9dff5a"], ["Settings", "#ff9ad5"], ["What's New", "#5fd3ff"]];
  return (
    <div className="mHub">
      <img className="mLogo" src="/art/stroids_menu_logo.png" alt="" />
      <div className="mByline"><img src="/art/spc_news_mug.png" alt="" />A GAME BY POLYMER JONES</div>
      <div className="mCard">
        <div className="mTitle">{titleNode || "POLYVERSE"}</div>
        {heroWrap(<button className="mHero"><span className="mHeroIcon">▶</span><span><b>PLAY</b><small>NEW GAME · LEVEL 1</small></span></button>)}
        <div className="mTiles">
          {tiles.map(([label, accent, img], i) => (
            <div key={label} style={{ "--accent": accent }}>
              {i === 0 ? tileWrap(<div className="mTile">{img ? <img src={img} alt="" /> : <span className="mDot" />}<span>{label}</span></div>) : <div className="mTile">{img ? <img src={img} alt="" /> : <span className="mDot" />}<span>{label}</span></div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
function OracleContent({ tileWrap = (x) => x }) {
  return (
    <div className="mOracle">
      <div className="mOracleCard">
        <h2>Poly Oracle</h2>
        <p>Allow the Polyverse Oracle to guide you.</p>
        <div className="mOrb" />
        <div className="mInput" />
      </div>
      {tileWrap(<div className="mPlayTile"><img src="/art/stroids_logo_tile.png" alt="" /><div><small>THE GAME</small><b>STROIDS IN THE POLYVERSE</b><span>▶ PLAY</span></div></div>)}
    </div>
  );
}
function WarpContent() {
  return <div className="mWarp"><div>LEVEL 3</div><b>BLUE MOON</b></div>;
}

function Stage({ item, props, scene }) {
  const Comp = getComponent(item.name);
  const c = item.category;
  const text = scene === "title" ? "STROIDS" : "POLYVERSE";
  const fx = (children) => <Comp {...props}>{children}</Comp>;
  let layer = null, content = null;
  if (c === "background" || c === "transition") {
    layer = <div className="fxLayer"><Comp {...props} /></div>;
    content = scene === "oracle" ? <OracleContent /> : scene === "warp" ? <WarpContent /> : scene === "title" ? <div className="mBigTitle">STROIDS<br />IN THE POLYVERSE</div> : <HubContent />;
  } else if (c === "text") {
    const node = item.name === "DecryptedText" ? <Comp {...props} text={text} animateOn="view" /> : item.name === "ShinyText" ? <Comp {...props} text={text} /> : fx(text);
    content = scene === "title" ? <div className="mBigTitle">{node}</div> : <HubContent titleNode={node} />;
  } else if (c === "card") {
    if (item.name === "TiltedCard") {
      const card = <Comp {...props} imageSrc="/art/stroids_logo_tile.png" imageHeight="190px" imageWidth="240px" containerHeight="220px" />;
      content = scene === "oracle" ? <OracleContent tileWrap={() => card} /> : <HubContent heroWrap={() => card} />;
    } else if (item.name === "PixelTransition") {
      const card = <Comp {...props} firstContent={<img src="/art/stroids_logo_tile.png" alt="" style={{ width: "100%", height: "100%", objectFit: "contain", background: "#120a2a" }} />} secondContent={<div className="mPixelBack">▶ PLAY</div>} style={{ width: 240, height: 190 }} />;
      content = scene === "oracle" ? <OracleContent tileWrap={() => card} /> : <HubContent heroWrap={() => card} />;
    } else {
      content = scene === "oracle" ? <OracleContent tileWrap={(x) => fx(x)} /> : <HubContent heroWrap={(x) => fx(x)} tileWrap={(x) => fx(x)} />;
    }
  } else if (c === "button") {
    content = <HubContent heroWrap={(x) => fx(x)} />;
  } else if (c === "wrapper") {
    content = fx(<HubContent />);
  }
  return (
    <>
      {scene === "oracle" && <img className="mBackdrop" src="/art/oracle_bg_poster.jpg" alt="" />}
      {layer}
      <div className="sceneContent">{content}</div>
    </>
  );
}

// ── Auto prop panel ───────────────────────────────────────────────────────────────────────────
const isColor = (v) => typeof v === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v);
function range(v) {
  if (Number.isInteger(v) && v >= 2) return [0, Math.max(v * 3, 10), 1];
  if (Math.abs(v) <= 1) return [Math.min(0, v * 2, -0) - (v < 0 ? 1 : 0), Math.max(1, v * 3), 0.01];
  return [Math.min(0, v * 3), Math.max(v * 3, 5), 0.05];
}
function PropRow({ k, v, def, onChange }) {
  if (typeof def === "boolean") return <label className="pRow"><span>{k}</span><input type="checkbox" checked={!!v} onChange={(e) => onChange(e.target.checked)} /></label>;
  if (typeof def === "number") {
    const [min, max, step] = range(def);
    return (
      <label className="pRow"><span>{k}</span>
        <input type="range" min={min} max={max} step={step} value={v} onChange={(e) => onChange(Number(e.target.value))} />
        <input className="pNum" type="number" step={step} value={v} onChange={(e) => onChange(Number(e.target.value))} />
      </label>
    );
  }
  if (isColor(def)) return <label className="pRow"><span>{k}</span><input type="color" value={v} onChange={(e) => onChange(e.target.value)} /><code>{v}</code></label>;
  if (Array.isArray(def) && def.every(isColor)) {
    return (
      <label className="pRow"><span>{k}</span>
        <span className="pColors">{v.map((c, i) => <input key={i} type="color" value={c} onChange={(e) => { const n = [...v]; n[i] = e.target.value; onChange(n); }} />)}</span>
      </label>
    );
  }
  if (typeof def === "string") return <label className="pRow"><span>{k}</span><input className="pText" value={v} onChange={(e) => onChange(e.target.value)} /></label>;
  return (
    <label className="pRow"><span>{k}</span>
      <input className="pText" defaultValue={JSON.stringify(v)} onBlur={(e) => { try { onChange(JSON.parse(e.target.value)); } catch { /* keep */ } }} />
    </label>
  );
}

export default function App() {
  const [selected, setSelected] = useState(manifest[0]?.name);
  const [mode, setModeState] = useState(() => load("polyLab.mode", "effects")); // effects | hud | designer | hubcards
  const setMode = (m) => { setModeState(m); try { localStorage.setItem("polyLab.mode", JSON.stringify(m)); } catch { /* ignore */ } };
  const [hud, setHud] = useState("E");
  const [scene, setScene] = useState("hub");
  const [filter, setFilter] = useState("");
  const [favs, setFavs] = useState(() => load(FAV_KEY, []));
  const [allProps, setAllProps] = useState(() => load(PROPS_KEY, {}));
  const [copied, setCopied] = useState("");
  const [nonce, setNonce] = useState(0);
  const fps = useFps();
  const item = manifest.find((m) => m.name === selected) || manifest[0];
  const props = useMemo(() => ({ ...item.defaults, ...(allProps[item.name] || {}) }), [item, allProps]);
  const stageRef = useRef(null);
  // Exact 430×932 phone layout, scaled to fit the window height.
  const [scale, setScale] = useState(0.8);
  useEffect(() => {
    const fit = () => setScale(Math.min(1, (window.innerHeight - 120) / 932));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  useEffect(() => { try { localStorage.setItem(FAV_KEY, JSON.stringify(favs)); } catch { /* ignore */ } }, [favs]);
  useEffect(() => { try { localStorage.setItem(PROPS_KEY, JSON.stringify(allProps)); } catch { /* ignore */ } }, [allProps]);
  // sensible default scene per category
  useEffect(() => {
    if (item.category === "transition") setScene("warp");
    else if (item.category === "text") setScene("title"); // display-size type; the hub title is tiny
  }, [item.name]); // eslint-disable-line react-hooks/exhaustive-deps

  const setProp = (k, v) => setAllProps((p) => ({ ...p, [item.name]: { ...(p[item.name] || {}), [k]: v } }));
  const resetProps = () => { setAllProps((p) => { const n = { ...p }; delete n[item.name]; return n; }); setNonce((x) => x + 1); };
  const toggleFav = () => setFavs((f) => (f.includes(item.name) ? f.filter((x) => x !== item.name) : [...f, item.name]));
  const copyPicks = () => {
    const picks = favs.map((name) => {
      const m = manifest.find((x) => x.name === name);
      const changed = Object.fromEntries(Object.entries(allProps[name] || {}).filter(([k, v]) => JSON.stringify(m?.defaults?.[k]) !== JSON.stringify(v)));
      return { component: name, props: changed };
    });
    const text = JSON.stringify(picks, null, 1);
    navigator.clipboard?.writeText(text);
    setCopied(text);
  };

  const modeSwitch = (
    <div className="labModes">
      <button className={mode === "effects" ? "on" : ""} onClick={() => setMode("effects")}>Effects</button>
      <button className={mode === "hud" ? "on" : ""} onClick={() => setMode("hud")}>HUD concepts</button>
      <button className={mode === "designer" ? "on" : ""} onClick={() => setMode("designer")}>Cockpit Designer</button>
      <button className={mode === "hubcards" ? "on" : ""} onClick={() => setMode("hubcards")}>Hub Cards</button>
      <button className={mode === "rewardbox" ? "on" : ""} onClick={() => setMode("rewardbox")}>Reward Box</button>
    </div>
  );
  if (mode === "designer") return <CockpitDesigner modeSwitch={modeSwitch} />;
  if (mode === "hubcards") return <HubCards modeSwitch={modeSwitch} />;
  if (mode === "rewardbox") return <RewardBox modeSwitch={modeSwitch} />;

  const groups = {};
  manifest.filter((m) => !filter || m.name.toLowerCase().includes(filter.toLowerCase()) || m.description.toLowerCase().includes(filter.toLowerCase()))
    .forEach((m) => { (groups[m.category] ||= []).push(m); });

  return (
    <div className="lab">
      <aside className="labList">
        <h1>POLYVERSE<br /><span>React Bits Lab</span></h1>
        {modeSwitch}
        {mode === "hud" && (
          <div className="labGroup">
            <h3>HUD concepts</h3>
            {HUD_CONCEPTS.map(([id, label]) => <button key={id} className={`labItem${hud === id ? " on" : ""}`} onClick={() => setHud(id)}>{label}</button>)}
          </div>
        )}
        {mode === "effects" && <input className="labSearch" placeholder="Search effects…" value={filter} onChange={(e) => setFilter(e.target.value)} />}
        {mode === "effects" && Object.entries(CATEGORY_LABEL).filter(([c]) => groups[c]).map(([c, label]) => (
          <div key={c} className="labGroup">
            <h3>{label}</h3>
            {groups[c].map((m) => (
              <button key={m.name} className={`labItem${m.name === item.name ? " on" : ""}`} onClick={() => setSelected(m.name)} title={m.description}>
                {favs.includes(m.name) ? "★ " : ""}{m.title}
              </button>
            ))}
          </div>
        ))}
      </aside>

      <main className="labStage">
        <div className="labBar">
          {mode === "effects" ? (
            <div className="labScenes">
              {SCENES.map(([id, label]) => <button key={id} className={scene === id ? "on" : ""} onClick={() => setScene(id)}>{label}</button>)}
            </div>
          ) : <div className="labScenes"><button className="on">In-game HUD · tap a weapon to arm it</button></div>}
          <span className={`labFps${fps < 50 ? " warn" : ""}`}>{fps} FPS</span>
        </div>
        <div className="phoneWrap" ref={stageRef} style={{ width: 430 * scale, height: 932 * scale }}>
          <div className="phone" style={{ transform: `scale(${scale})` }}>
            <Boundary resetKey={`${mode}-${hud}-${item.name}-${scene}-${nonce}`}>
              {mode === "hud" ? <HudConcepts key={hud} which={hud} /> : (
                <Suspense fallback={<div className="labErr">Loading {item.name}…</div>}>
                  <Stage key={`${item.name}-${scene}-${nonce}`} item={item} props={props} scene={scene} />
                </Suspense>
              )}
            </Boundary>
          </div>
        </div>
        <p className="labNote">Desktop preview (mouse = finger). Phone cost is judged after we port the winner to vanilla WebGL/CSS.</p>
      </main>

      {mode === "hud" ? (
        <aside className="labProps">
          <div className="labPropsHead"><h2>{HUD_CONCEPTS.find((h) => h[0] === hud)?.[1]}</h2></div>
          <p className="labDesc">{HUD_NOTES[hud]}</p>
          <p className="labDesc">Mockup only — tell me which direction (or mix: e.g. "C top + A dashboard") and I'll build it into the game HUD.</p>
        </aside>
      ) : (
      <aside className="labProps">
        <div className="labPropsHead">
          <h2>{item.title}</h2>
          <button className={`favBtn${favs.includes(item.name) ? " on" : ""}`} onClick={toggleFav}>{favs.includes(item.name) ? "★ Favorite" : "☆ Favorite"}</button>
        </div>
        <p className="labDesc">{item.description}</p>
        <div className="labPropsBtns"><button onClick={resetProps}>Reset props</button></div>
        <div className="pList">
          {Object.entries(item.defaults).filter(([k]) => !["className", "style"].includes(k)).map(([k, def]) => (
            <PropRow key={`${item.name}-${k}-${nonce}`} k={k} def={def} v={props[k]} onChange={(v) => setProp(k, v)} />
          ))}
        </div>
        <div className="labPicks">
          <button className="copyBtn" onClick={copyPicks} disabled={!favs.length}>COPY PICKS ({favs.length})</button>
          {copied && <pre>{copied}</pre>}
        </div>
      </aside>
      )}
    </div>
  );
}
