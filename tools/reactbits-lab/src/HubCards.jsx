// Hub Cards (2026-10-26) — pick the art on each POLYVERSE hub ring card against the real game.
// The game runs in an iframe (/game/index.html, served from the repo root by vite.config.js); a pick
// swaps that card's <img> in the iframe directly (same origin) and turns the ring to it.
// BAKE copies assets/ui/hub/picks/<id>.webp over assets/ui/hub/<card>.webp (/__hubcards/bake), so the
// shipped art changes — then `npm run prepare:web` from the repo root. Crops come from
// tools/build-hub-card-picks.js; keep PICKS in sync with it.
import { useCallback, useEffect, useRef, useState } from "react";

const CARDS = [ // [shipped file, button id, label]
  ["arcade", "btnArcade", "Arcade"], ["stunt", "btnArcadeStunt", "Stunt Mode"], ["scores", "btnScores", "Scoreboard"],
  ["cheats", "btnCheatCodes", "Cheat Codes"], ["settings", "btnSettings", "Settings"], ["news", "btnHubNews", "What's New"],
];
const PICKS = [
  "cmdr_default", "cmdr_smirk", "cmdr_laugh", "cmdr_laugh2", "cmdr_angry", "cmdr_shocked", "cmdr_thinking", "cmdr_lookleft",
  "cmdr_lookright", "cmdr_eyesdown", "cmdr_exhausted", "cmdr_lightdmg", "cmdr_heavydmg", "cmdr_coffee", "cmdr_duckface", "cmdr_tongue",
  "spc_smile_wide", "spc_smile", "spc_smirk", "spc_warm", "spc_soft", "spc_gentle", "spc_neutral", "spc_alert", "spc_laugh",
  "spc_praise", "spc_smile_open", "spc_happy", "spc_friendly", "spc_shades", "spc_blink",
];
const LS = "polyLab.hubCards";
const W = 390, H = 844;
const src = (file, v, bust) => (v === "ship" ? `/game/assets/ui/hub/${file}.webp?v=${bust}` : `/game/assets/ui/hub/picks/${v}.webp`);

export default function HubCards({ modeSwitch }) {
  const [picks, setPicks] = useState(() => { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch { return {}; } });
  const [card, setCard] = useState("arcade");
  const [status, setStatus] = useState("Booting the game…");
  const [ready, setReady] = useState(false);
  const [bust, setBust] = useState(() => Date.now());
  const [scale, setScale] = useState(0.8);
  const frameRef = useRef(null);
  const doc = () => frameRef.current?.contentDocument;

  useEffect(() => {
    const fit = () => setScale(Math.min(1, (window.innerHeight - 130) / H));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  useEffect(() => { try { localStorage.setItem(LS, JSON.stringify(picks)); } catch { /* ignore */ } }, [picks]);

  // push every pick into the game's ring
  useEffect(() => {
    const d = doc();
    if (!ready || !d) return;
    for (const [file, id] of CARDS) {
      const img = d.querySelector(`#${id} .polyCardArt`);
      const want = src(file, picks[file] || "ship", bust);
      if (img && img.getAttribute("src") !== want) img.setAttribute("src", want);
    }
  }, [picks, ready, bust]);

  // the picker follows the ring: whichever card is at the front is the one being edited
  useEffect(() => {
    if (!ready) return undefined;
    const t = setInterval(() => {
      const id = doc()?.querySelector("#polyRing .polyTile.on")?.id;
      const file = CARDS.find((c) => c[1] === id)?.[0];
      if (file) setCard((cur) => (cur === file ? cur : file));
    }, 200);
    return () => clearInterval(t);
  }, [ready]);

  // turn the ring to a card: a tap on a side card turns it (tapping the front card would open it)
  const turnTo = useCallback((file) => {
    const id = CARDS.find((c) => c[0] === file)?.[1];
    const el = doc()?.getElementById(id);
    if (el && !el.classList.contains("on")) el.click();
  }, []);

  // boot: Oracle page → Stroids tile → the POLYVERSE hub
  const boot = useCallback(() => {
    setReady(false);
    let tries = 0;
    const wait = () => {
      const d = doc();
      const ring = d?.getElementById("polyRing");
      if (ring?.getClientRects().length) { setReady(true); setStatus("Hub ready — drag the ring in the phone, pick art on the right."); return; }
      d?.getElementById("playStroidsTile")?.click();
      if (++tries < 100) setTimeout(wait, 150);
      else setStatus("Couldn't reach the hub — check the game's console.");
    };
    setTimeout(wait, 400);
  }, []);

  const choose = (file, v) => { setCard(file); setPicks((p) => ({ ...p, [file]: v })); turnTo(file); };
  const changed = Object.fromEntries(Object.entries(picks).filter(([, v]) => v && v !== "ship"));
  const copy = () => navigator.clipboard?.writeText(JSON.stringify(changed));
  const bake = async () => {
    if (!Object.keys(changed).length) return;
    if (!window.confirm(`Overwrite the shipped art for: ${Object.keys(changed).join(", ")}?`)) return;
    const r = await fetch("/__hubcards/bake", { method: "POST", body: JSON.stringify(changed) }).then((x) => x.json()).catch((e) => ({ ok: false, error: String(e) }));
    if (!r.ok) { setStatus(`Bake failed: ${r.error}`); return; }
    setPicks({});
    setBust(Date.now());
    setStatus(`Baked ${r.baked.join(", ")} → assets/ui/hub/. Run npm run prepare:web (repo root) before shipping.`);
  };

  return (
    <div className="lab cd hc">
      <aside className="labList">
        <h1>POLYVERSE<br /><span>Hub Cards</span></h1>
        {modeSwitch}
        <div className="labGroup">
          <h3>Cards</h3>
          {CARDS.map(([file, , label]) => (
            <button key={file} className={`labItem hcCardItem${card === file ? " on" : ""}`} onClick={() => { setCard(file); turnTo(file); }}>
              <img src={src(file, picks[file] || "ship", bust)} alt="" />{label}
              {picks[file] && picks[file] !== "ship" ? <small className="cdDim"> · {picks[file]}</small> : null}
            </button>
          ))}
        </div>
      </aside>

      <main className="labStage">
        <div className="labBar">
          <div className="labScenes"><button className="on">POLYVERSE hub · the mouse is your finger</button></div>
          <button className="cdBtn" onClick={() => { frameRef.current?.contentWindow?.location.reload(); }}>Reload game</button>
        </div>
        <div className="phoneWrap" style={{ width: W * scale + 20, height: H * scale + 20 }}>
          <div className="phone cdPhone" style={{ width: W + 20, height: H + 20, transform: `scale(${scale})` }}>
            <iframe ref={frameRef} title="Stroids" src="/game/index.html" style={{ width: W, height: H }} onLoad={boot} />
          </div>
        </div>
        <p className="labNote">{status}</p>
      </main>

      <aside className="labProps">
        <div className="labPropsHead"><h2>Editing: {CARDS.find((c) => c[0] === card)?.[2]}</h2></div>
        <p className="labDesc">Spin the ring (or pick a card on the left): art goes on the card at the front. ★ = the card's shipped art.</p>
        <div className="hcGrid">
          {["ship", ...PICKS].map((v) => (
            <button key={v} className={`hcThumb${(picks[card] || "ship") === v ? " on" : ""}`} onClick={() => choose(card, v)} title={v === "ship" ? "shipped art" : v}>
              <img src={src(card, v, bust)} alt="" loading="lazy" />
              {v === "ship" && <b>★</b>}
            </button>
          ))}
        </div>
        <div className="labPicks">
          <button className="copyBtn" onClick={copy} disabled={!Object.keys(changed).length}>COPY PICKS ({Object.keys(changed).length})</button>
          <button className="copyBtn hcBake" onClick={bake} disabled={!Object.keys(changed).length}>BAKE INTO GAME</button>
          {Object.keys(changed).length > 0 && <pre>{JSON.stringify(changed, null, 1)}</pre>}
        </div>
      </aside>
    </div>
  );
}
