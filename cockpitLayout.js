// Cockpit HUD layout — written by the Lab's Cockpit Designer (tools/reactbits-lab, "Save to game").
// Read by syncCockpitHud()/applyCockpitLayout() in script.js. Hand edits are fine but get overwritten
// on the next Save. Anchors: [t|b][l|c|r|s] — x/y are px from that edge (c: offset of the centre,
// s: stretch with x inset both sides); t/b offsets sit inside the safe area unless `bleed`.
window.POLY_COCKPIT_LAYOUT = {
  "version": 1,
  "parts": {
    "pause": {"anchor": "tl", "x": 16, "y": 12, "w": 94, "h": 30, "skin": "custom", "shape": "round", "radius": 8, "fill": "#1e2846", "fill2": "#0c1222", "alpha": 0.95, "stroke": "#7be2ff", "strokeAlpha": 0.5, "strokeW": 1, "glow": 0, "color": "#e6f0ff", "font": 12, "weight": 700, "family": "sans", "spacing": 0.04},
    "lives": {"anchor": "tl", "x": 16, "y": 46, "w": 94, "h": 16, "skin": "text", "color": "#7be2ff", "font": 11, "weight": 700, "family": "mono", "spacing": 0.08},
    "run": {"anchor": "tc", "x": 0, "y": 11, "w": 160, "h": 11, "skin": "text", "color": "#b7c9ff", "font": 9, "weight": 600, "family": "mono", "spacing": 0.18},
    "level": {"anchor": "tc", "x": 0, "y": 23, "w": 160, "h": 13, "skin": "text", "color": "#7be2ff", "font": 10, "weight": 800, "family": "mono", "spacing": 0.22},
    "score": {"anchor": "tc", "x": 0, "y": 37, "w": 160, "h": 24, "skin": "text", "color": "#ffffff", "font": 20, "weight": 900, "family": "mono", "spacing": 0.02},
    "mult": {"anchor": "tr", "x": 16, "y": 12, "w": 94, "h": 50, "skin": "text", "label": "MULT", "color": "#f6a7ff", "font": 17, "weight": 900, "family": "mono", "spacing": 0.02},
    "devwin": {"anchor": "tl", "x": 16, "y": 128, "skin": "native", "scale": 0.85},
    "quad": {"anchor": "tr", "x": 12, "y": 128, "skin": "native", "scale": 0.9},
    "pulse": {"anchor": "tr", "x": 104, "y": 128, "skin": "native", "scale": 0.9},
    "bomb": {"anchor": "tr", "x": 156, "y": 76, "w": 44, "h": 44, "skin": "custom", "shape": "round", "radius": 11, "fill": "#1e2846", "fill2": "#0a0e1c", "alpha": 0.95, "strokeAlpha": 0.7, "strokeW": 1.5, "glow": 0, "color": "#ffffff", "font": 10, "weight": 700, "family": "sans", "spacing": 0, "icon": 24, "countCorner": true, "stroke": "#ff8c5a"},
    "freeze": {"anchor": "tr", "x": 108, "y": 76, "w": 44, "h": 44, "skin": "custom", "shape": "round", "radius": 11, "fill": "#1e2846", "fill2": "#0a0e1c", "alpha": 0.95, "strokeAlpha": 0.7, "strokeW": 1.5, "glow": 0, "color": "#ffffff", "font": 10, "weight": 700, "family": "sans", "spacing": 0, "icon": 24, "countCorner": true, "stroke": "#88ddff"},
    "missile": {"anchor": "tr", "x": 60, "y": 76, "w": 44, "h": 44, "skin": "custom", "shape": "round", "radius": 11, "fill": "#1e2846", "fill2": "#0a0e1c", "alpha": 0.95, "strokeAlpha": 0.7, "strokeW": 1.5, "glow": 0, "color": "#ffffff", "font": 10, "weight": 700, "family": "sans", "spacing": 0, "icon": 24, "countCorner": true, "stroke": "#ffd700"},
    "slots": {"anchor": "tl", "x": 16, "y": 76, "skin": "native", "scale": 0.9},
    "net": {"anchor": "tr", "x": 12, "y": 76, "w": 44, "h": 44, "skin": "native"},
    "comm": {"anchor": "bl", "x": 16, "y": 16, "skin": "native", "scale": 1}
  },
  "panels": [
    {"id": "topLeft", "anchor": "tl", "x": 8, "y": 6, "w": 110, "h": 62, "shape": "chamfer", "cut": 10, "fill": "#0e1e3c", "fill2": "#060c1a", "alpha": 0.92, "stroke": "#7be2ff", "strokeAlpha": 0.4, "strokeW": 1, "glow": 0, "z": 0},
    {"id": "topCenter", "anchor": "tc", "x": 0, "y": 6, "w": 178, "h": 62, "shape": "chamfer", "cut": 10, "fill": "#0e1e3c", "fill2": "#060c1a", "alpha": 0.92, "stroke": "#7be2ff", "strokeAlpha": 0.4, "strokeW": 1, "glow": 0, "z": 0},
    {"id": "topRight", "anchor": "tr", "x": 8, "y": 6, "w": 110, "h": 62, "shape": "chamfer", "cut": 10, "fill": "#0e1e3c", "fill2": "#060c1a", "alpha": 0.92, "stroke": "#7be2ff", "strokeAlpha": 0.4, "strokeW": 1, "glow": 0, "z": 0},
    {"id": "weaponsRail", "anchor": "tr", "x": 6, "y": 71, "w": 200, "h": 54, "shape": "chamfer", "cut": 9, "fill": "#0e1e3c", "fill2": "#060c1a", "alpha": 0.88, "stroke": "#7be2ff", "strokeAlpha": 0.35, "strokeW": 1, "glow": 0, "z": 0}
  ]
};
