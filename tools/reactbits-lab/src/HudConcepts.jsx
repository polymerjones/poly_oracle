// Cockpit HUD concepts for Stroids (2026-10-25) — static mockups over a live Galaxy background with
// the game's real icons, to pick a direction before rebuilding the in-game HUD (index.html #arcadeHud).
// Tap a weapon to see its "armed" state. Pure CSS/HTML so the winner ports straight to the app.
import { Suspense, lazy, useState } from "react";

const Galaxy = lazy(() => import("./rb/Galaxy/Galaxy.jsx"));
const ICON = { bomb: "/art/powerup_bomb.png", freeze: "/art/powerup_freeze.png", missile: "/art/powerup_missile.png" };
const WEAPONS = [["bomb", 3, "#ff8c5a"], ["freeze", 1, "#88ddff"], ["missile", 2, "#ffd700"]];

function Field({ commBottom = 120 }) {
  return (
    <>
      <div className="hcBg"><Suspense fallback={null}><Galaxy density={1.1} starSpeed={0.35} hueShift={200} glowIntensity={0.35} transparent={false} /></Suspense></div>
      <img className="hcRock" style={{ left: "18%", top: "38%", width: 74 }} src="/art/roid01.png" alt="" />
      <img className="hcRock" style={{ left: "62%", top: "52%", width: 96, transform: "rotate(40deg)" }} src="/art/roid01.png" alt="" />
      <img className="hcRock" style={{ left: "40%", top: "26%", width: 50, transform: "rotate(-30deg)" }} src="/art/roid01.png" alt="" />
      <div className="hcComm" style={{ bottom: commBottom }}><img src="/art/spc_news_portrait.png" alt="" /><div><small>CMDR</small>WELCOME TO THE POLYVERSE.</div></div>
    </>
  );
}

function Weapon({ kind, count, color, armed, onTap, cls }) {
  return (
    <button className={`${cls}${armed ? " armed" : ""}${count ? "" : " empty"}`} style={{ "--c": color }} onClick={onTap}>
      <img src={ICON[kind]} alt="" />
      <b>{count}</b>
    </button>
  );
}

// A — CANOPY: cockpit glass frame up top, illuminated dashboard console at the bottom.
function Canopy({ armed, setArmed }) {
  return (
    <div className="hcA">
      <svg className="hcA-canopy" viewBox="0 0 430 150" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 0 H430 V92 Q215 150 0 92 Z" fill="rgba(6,14,34,0.72)" />
        <path d="M0 92 Q215 150 430 92" fill="none" stroke="rgba(123,226,255,0.8)" strokeWidth="2" />
        <path d="M0 98 Q215 158 430 98" fill="none" stroke="rgba(123,226,255,0.25)" strokeWidth="1" />
        <path d="M120 0 L138 112 M310 0 L292 112" stroke="rgba(123,226,255,0.35)" strokeWidth="2" />
      </svg>
      <div className="hcA-left"><button className="hcPause">❚❚</button><div className="hcLives">{[0, 1, 2].map((i) => <span key={i} className={i < 2 ? "on" : ""}>▲</span>)}</div></div>
      <div className="hcA-center"><small>LEVEL 3 · 00:42</small><b>12,480</b></div>
      <div className="hcA-right"><svg viewBox="0 0 60 36"><path d="M6 32 A24 24 0 0 1 54 32" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="5" /><path d="M6 32 A24 24 0 0 1 44 12" fill="none" stroke="#f6a7ff" strokeWidth="5" strokeLinecap="round" /></svg><b>×2.8</b></div>
      <div className="hcA-dash">
        <div className="hcA-bays">
          {WEAPONS.map(([k, n, c]) => <Weapon key={k} kind={k} count={n} color={c} armed={armed === k} onTap={() => setArmed(armed === k ? "" : k)} cls="hcA-key" />)}
          <button className="hcA-slot"><img src="/art/hud_polyslots.png" alt="" /><b>×3</b></button>
        </div>
      </div>
    </div>
  );
}

// B — VISOR: minimal fighter-jet HUD, corner brackets, mono readouts, weapon rail on the right edge.
function Visor({ armed, setArmed }) {
  return (
    <div className="hcB">
      <i className="hcB-br tl" /><i className="hcB-br tr" /><i className="hcB-br bl" /><i className="hcB-br br" />
      <div className="hcB-tl"><button className="hcPause small">❚❚</button><div><small>LVL</small> 03 <small>T-</small> 00:42</div></div>
      <div className="hcB-tr"><b>12480</b><div className="hcB-pips">{[0, 1, 2].map((i) => <span key={i} className={i < 2 ? "on" : ""} />)}</div><small>MULT ×2.8</small></div>
      <div className="hcB-rail">
        {WEAPONS.map(([k, n, c]) => <Weapon key={k} kind={k} count={n} color={c} armed={armed === k} onTap={() => setArmed(armed === k ? "" : k)} cls="hcB-w" />)}
        <button className="hcB-slot"><img src="/art/hud_polyslots.png" alt="" /><b>3</b></button>
      </div>
      <div className="hcB-reticle" />
    </div>
  );
}

// C — COMMAND DECK: chamfered holo panels across the top, a weapon tray at the bottom.
function Deck({ armed, setArmed }) {
  return (
    <div className="hcC">
      <div className="hcC-top">
        <div className="hcC-panel"><button className="hcPause small">❚❚</button><div className="hcLives">{[0, 1, 2].map((i) => <span key={i} className={i < 2 ? "on" : ""}>▲</span>)}</div></div>
        <div className="hcC-panel wide"><small>LEVEL 3 · BLUE MOON</small><b>12,480</b><div className="hcC-time"><i style={{ width: "62%" }} /></div></div>
        <div className="hcC-panel"><small>MULT</small><b className="mult">×2.8</b></div>
      </div>
      <div className="hcC-tray">
        {WEAPONS.map(([k, n, c]) => <Weapon key={k} kind={k} count={n} color={c} armed={armed === k} onTap={() => setArmed(armed === k ? "" : k)} cls="hcC-w" />)}
        <button className="hcC-slot"><img src="/art/hud_polyslots.png" alt="" /><b>×3</b></button>
      </div>
    </div>
  );
}

// D — HYBRID (Paul: "I like A and C"): C's chamfered top panels (no time bar — the perimeter timer
// border stays the clock) + A's illuminated dashboard, slimmed, absorbing the weapons, POLYSLOTS and
// the NET/AUTO plasma control; the comm box sits above the dash like a cockpit monitor.
function Hybrid({ armed, setArmed }) {
  const [net, setNet] = useState("AUTO");
  return (
    <div className="hcD">
      <div className="hcD-perim"><i /></div>
      <div className="hcC-top hcD-top">
        <div className="hcC-panel"><button className="hcPause small">❚❚</button><div className="hcLives">{[0, 1, 2].map((i) => <span key={i} className={i < 2 ? "on" : ""}>▲</span>)}</div></div>
        <div className="hcC-panel wide"><small>LEVEL 3 · BLUE MOON</small><b>12,480</b></div>
        <div className="hcC-panel"><small>MULT</small><b className="mult">×2.8</b></div>
      </div>
      <div className="hcD-dash">
        <div className="hcD-bays">
          {WEAPONS.map(([k, n, c]) => <Weapon key={k} kind={k} count={n} color={c} armed={armed === k} onTap={() => setArmed(armed === k ? "" : k)} cls="hcA-key hcD-key" />)}
          <button className="hcA-slot hcD-slot"><img src="/art/hud_polyslots.png" alt="" /><b>×3</b></button>
          <button className="hcD-net" onClick={() => setNet(net === "AUTO" ? "MANUAL" : "AUTO")}><i /><span>NET</span><b>{net}</b></button>
        </div>
      </div>
    </div>
  );
}

export const HUD_CONCEPTS = [["D", "D · Hybrid (A + C)"], ["A", "A · Canopy"], ["B", "B · Visor"], ["C", "C · Command Deck"]];
export default function HudConcepts({ which }) {
  const [armed, setArmed] = useState("");
  const C = which === "B" ? Visor : which === "C" ? Deck : which === "D" ? Hybrid : Canopy;
  return (
    <div className="hc">
      <Field commBottom={which === "D" ? 100 : 120} />
      <C armed={armed} setArmed={setArmed} />
    </div>
  );
}
