// Cockpit HUD layout — written by the Lab's Cockpit Designer (tools/reactbits-lab, "Save to game").
// Read by syncCockpitHud()/applyCockpitLayout() in script.js. Hand edits are fine but get overwritten
// on the next Save. Anchors: [t|b][l|c|r|s] — x/y are px from that edge (c: offset of the centre,
// s: stretch with x inset both sides); t/b offsets sit inside the safe area unless `bleed`.
// 2026-10-26: concept G (Paul's pick) — A's canopy glass up top, weapons on a glowing belt under it
// (skin "belt": haloed icon + ammo pips), POLYSLOTS at the right end. The previous "D · Hybrid"
// layout is in git history (8dbd19b).
// 2026-10-26 (later): belt → "arcade" — round cabinet buttons (bezel, lit well, count chip) in one
// tight cluster, mounted in a console plate tucked under the canopy rim. Belt layout = 2a2bfee.
// Compacted (Paul: "takes too much playing area", tall Dynamic Island): one-line RUN/LEVEL, 46px buttons.
window.POLY_COCKPIT_LAYOUT = {
  "version": 1,
  "style": "arcade",
  "parts": {
    "pause": {"anchor": "tl", "x": 14, "y": 4, "w": 74, "h": 26, "skin": "custom", "shape": "round", "radius": 8, "fill": "#1e2846", "fill2": "#0c1222", "alpha": 0.95, "stroke": "#7be2ff", "strokeAlpha": 0.6, "strokeW": 1, "glow": 0, "color": "#7be2ff", "font": 11, "weight": 800, "family": "sans", "spacing": 0},
    "lives": {"anchor": "tl", "x": 14, "y": 31, "w": 74, "h": 12, "skin": "text", "color": "#7be2ff", "font": 10, "weight": 700, "family": "mono", "spacing": 0.08},
    "run": {"anchor": "tc", "x": 46, "y": 4, "w": 92, "h": 11, "skin": "text", "color": "#b7c9ff", "font": 9, "weight": 600, "family": "mono", "spacing": 0.12},
    "level": {"anchor": "tc", "x": -44, "y": 4, "w": 84, "h": 11, "skin": "text", "color": "#7be2ff", "font": 9, "weight": 800, "family": "mono", "spacing": 0.2},
    "score": {"anchor": "tc", "x": 0, "y": 16, "w": 180, "h": 26, "skin": "text", "color": "#ffffff", "font": 24, "weight": 900, "family": "mono", "spacing": 0.03, "textGlow": 12},
    "mult": {"anchor": "tr", "x": 14, "y": 4, "w": 70, "h": 40, "skin": "text", "label": "MULT", "color": "#f6a7ff", "font": 16, "weight": 900, "family": "mono", "spacing": 0.02},
    "devwin": {"anchor": "tl", "x": 14, "y": 112, "skin": "native", "scale": 0.85},
    "quad": {"anchor": "tr", "x": 8, "y": 52, "skin": "native", "scale": 0.85},
    "pulse": {"anchor": "tr", "x": 8, "y": 80, "skin": "native", "scale": 0.85},
    "bomb": {"anchor": "tc", "x": -92, "y": 51, "w": 46, "h": 46, "skin": "arcade", "stroke": "#ff8c5a"},
    "freeze": {"anchor": "tc", "x": -40, "y": 51, "w": 46, "h": 46, "skin": "arcade", "stroke": "#88ddff"},
    "missile": {"anchor": "tc", "x": 12, "y": 51, "w": 46, "h": 46, "skin": "arcade", "stroke": "#ffd700"},
    "slots": {"anchor": "tc", "x": 72, "y": 51, "skin": "native", "scale": 1},
    "comm": {"anchor": "bl", "x": 16, "y": 16, "skin": "native", "scale": 1}
  },
  "panels": [
    {"id": "canopy", "anchor": "ts", "x": 0, "y": 0, "h": 50, "bleed": true, "shape": "canopy", "curve": 12, "fill": "#0a1630", "fill2": "#060c1c", "alpha": 0.82, "stroke": "#7be2ff", "strokeAlpha": 0.85, "strokeW": 2, "strut": 20, "z": 0},
    {"id": "console", "anchor": "tc", "x": -6, "y": 38, "w": 248, "h": 66, "shape": "console", "radius": 24, "fill": "#1a2233", "fill2": "#0b1020", "alpha": 0.94, "stroke": "#7be2ff", "strokeAlpha": 0.7, "strokeW": 2, "z": 0}
  ]
};
