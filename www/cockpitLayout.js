// Cockpit HUD layout — written by the Lab's Cockpit Designer (tools/reactbits-lab, "Save to game").
// Read by syncCockpitHud()/applyCockpitLayout() in script.js. Hand edits are fine but get overwritten
// on the next Save. Anchors: [t|b][l|c|r|s] — x/y are px from that edge (c: offset of the centre,
// s: stretch with x inset both sides); t/b offsets sit inside the safe area unless `bleed`.
// 2026-10-26: concept G (Paul's pick) — A's canopy glass up top, weapons on a glowing belt under it
// (skin "belt": haloed icon + ammo pips), POLYSLOTS at the right end. The previous "D · Hybrid"
// layout is in git history (8dbd19b).
window.POLY_COCKPIT_LAYOUT = {
  "version": 1,
  "style": "belt",
  "parts": {
    "pause": {"anchor": "tl", "x": 14, "y": 8, "w": 78, "h": 30, "skin": "custom", "shape": "round", "radius": 9, "fill": "#1e2846", "fill2": "#0c1222", "alpha": 0.95, "stroke": "#7be2ff", "strokeAlpha": 0.6, "strokeW": 1, "glow": 0, "color": "#7be2ff", "font": 11, "weight": 800, "family": "sans", "spacing": 0},
    "lives": {"anchor": "tl", "x": 14, "y": 42, "w": 70, "h": 14, "skin": "text", "color": "#7be2ff", "font": 11, "weight": 700, "family": "mono", "spacing": 0.08},
    "run": {"anchor": "tc", "x": 0, "y": 6, "w": 160, "h": 11, "skin": "text", "color": "#b7c9ff", "font": 9, "weight": 600, "family": "mono", "spacing": 0.18},
    "level": {"anchor": "tc", "x": 0, "y": 18, "w": 160, "h": 13, "skin": "text", "color": "#7be2ff", "font": 10, "weight": 800, "family": "mono", "spacing": 0.24},
    "score": {"anchor": "tc", "x": 0, "y": 31, "w": 180, "h": 28, "skin": "text", "color": "#ffffff", "font": 26, "weight": 900, "family": "mono", "spacing": 0.03, "textGlow": 12},
    "mult": {"anchor": "tr", "x": 14, "y": 8, "w": 70, "h": 46, "skin": "text", "label": "MULT", "color": "#f6a7ff", "font": 17, "weight": 900, "family": "mono", "spacing": 0.02},
    "devwin": {"anchor": "tl", "x": 14, "y": 150, "skin": "native", "scale": 0.85},
    "quad": {"anchor": "tr", "x": 12, "y": 150, "skin": "native", "scale": 0.9},
    "pulse": {"anchor": "tr", "x": 104, "y": 150, "skin": "native", "scale": 0.9},
    "bomb": {"anchor": "tc", "x": -138, "y": 78, "w": 84, "h": 66, "skin": "belt", "stroke": "#ff8c5a", "icon": 46, "pip": 6},
    "freeze": {"anchor": "tc", "x": -46, "y": 78, "w": 84, "h": 66, "skin": "belt", "stroke": "#88ddff", "icon": 46, "pip": 9},
    "missile": {"anchor": "tc", "x": 46, "y": 78, "w": 84, "h": 66, "skin": "belt", "stroke": "#ffd700", "icon": 46, "pip": 9},
    "slots": {"anchor": "tc", "x": 138, "y": 84, "skin": "native", "scale": 0.9},
    "comm": {"anchor": "bl", "x": 16, "y": 16, "skin": "native", "scale": 1}
  },
  "panels": [
    {"id": "canopy", "anchor": "ts", "x": 0, "y": 0, "h": 64, "bleed": true, "shape": "canopy", "curve": 30, "fill": "#0a1630", "fill2": "#060c1c", "alpha": 0.82, "stroke": "#7be2ff", "strokeAlpha": 0.85, "strokeW": 2, "z": 0},
    {"id": "belt", "anchor": "ts", "x": 26, "y": 126, "h": 2, "shape": "rail", "stroke": "#7be2ff", "strokeAlpha": 0.85, "z": 0}
  ]
};
