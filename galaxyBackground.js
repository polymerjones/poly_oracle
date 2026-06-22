const galaxyBackground = (() => {
  const THEMES = [
    // L1 — Deep Space (teal)
    { sky: "#020408", neb: [[0, 40, 90], [55, 0, 100], [0, 65, 85]], star: [220, 230, 255], gas: [[0, 140, 160], [0, 80, 120], [20, 60, 100]] },
    // L2 — Nebula (purple)
    { sky: "#040208", neb: [[80, 0, 120], [50, 0, 100], [100, 20, 80]], star: [220, 200, 255], gas: [[80, 0, 140], [120, 20, 160], [60, 0, 100]] },
    // L3 — Ice Field (cyan)
    { sky: "#020608", neb: [[0, 80, 100], [0, 60, 120], [20, 80, 90]], star: [200, 240, 255], gas: [[0, 160, 180], [0, 120, 160], [20, 140, 160]] },
    // L4 — Void (dark indigo)
    { sky: "#010104", neb: [[20, 0, 40], [10, 0, 30], [30, 5, 50]], star: [180, 180, 220], gas: [[30, 0, 60], [20, 0, 50], [40, 10, 70]] },
    // L5 — Ember (amber/orange)
    { sky: "#060200", neb: [[140, 60, 0], [180, 90, 10], [120, 40, 0]], star: [255, 210, 140], gas: [[200, 100, 0], [240, 140, 20], [160, 70, 0]] },
    // L6 — Jungle (deep green)
    { sky: "#010804", neb: [[0, 80, 30], [10, 100, 40], [0, 60, 20]], star: [180, 255, 200], gas: [[0, 140, 60], [20, 180, 80], [0, 100, 40]] },
    // L7 — Storm (electric blue)
    { sky: "#020318", neb: [[20, 60, 220], [40, 100, 255], [10, 40, 180]], star: [220, 240, 255], gas: [[60, 120, 255], [100, 160, 255], [40, 80, 220]] },
    // L8 — Blood (crimson)
    { sky: "#080002", neb: [[160, 0, 20], [200, 10, 30], [120, 0, 10]], star: [255, 160, 170], gas: [[180, 0, 30], [220, 20, 40], [140, 0, 20]] },
    // L9 — Toxic (acid green)
    { sky: "#030800", neb: [[60, 160, 0], [100, 200, 10], [40, 120, 0]], star: [220, 255, 160], gas: [[80, 200, 0], [120, 240, 20], [60, 160, 0]] },
    // L10 — Hellfire (red/orange)
    { sky: "#1E0200", neb: [[200, 30, 0], [240, 80, 0], [160, 15, 0]], star: [255, 160, 60], gas: [[220, 70, 0], [255, 110, 10], [180, 45, 0]] },
    // 2026-06-15: second act (levels 11-15) — Part 5. star[] is the single star tint the renderer
    // uses; neb[]/gas[] are the nebula/gas cloud palettes (RGB).
    // L11 — Void Grey (cold, high-contrast)
    { sky: "#0A0A0A", neb: [[26, 26, 26], [42, 42, 42], [20, 20, 20]], star: [204, 204, 204], gas: [[40, 40, 40], [60, 60, 60], [30, 30, 30]] },
    // L12 — Cyberpunk Neon (purple-blue swirl, cyan/magenta stars)
    { sky: "#050510", neb: [[26, 0, 64], [0, 8, 48], [40, 0, 90]], star: [0, 255, 255], gas: [[0, 200, 255], [150, 0, 255], [60, 0, 140]] },
    // L13 — Virtual Boy Red (pure red + black)
    { sky: "#000000", neb: [[26, 0, 0], [51, 0, 0], [20, 0, 0]], star: [255, 0, 0], gas: [[136, 0, 0], [204, 0, 0], [80, 0, 0]] },
    // L14 — Forest Green
    { sky: "#050F05", neb: [[10, 31, 10], [13, 43, 13], [8, 24, 8]], star: [0, 255, 68], gas: [[0, 200, 40], [136, 255, 0], [68, 204, 0]] },
    // L15 — Inferno (intense fire — denser than L10)
    { sky: "#150500", neb: [[42, 8, 0], [26, 3, 0], [50, 12, 0]], star: [255, 102, 0], gas: [[255, 102, 0], [255, 204, 0], [255, 51, 0]] },
  ];

  const PDEFS = [
    { ox: 0.28, oy: 0.22, r: 7, z: 0.022, col: [22, 35, 55], atmo: [0, 50, 110], ring: false, tile: true, moon: false, b: 2, cr: [{ x: -2, y: -1, r: 1.5 }] },
    { ox: 1.10, oy: 0.62, r: 14, z: 0.050, col: [35, 18, 55], atmo: [65, 0, 140], ring: false, tile: true, moon: false, b: 3, cr: [{ x: -4, y: 3, r: 2.5 }] },
    { ox: 0.58, oy: 0.19, r: 16, z: 0.007, col: [14, 50, 70], atmo: [0, 100, 145], ring: true, ringCol: [0, 80, 100], ringTilt: 0.28, tile: false, moon: false, b: 3, cr: [] },
    { ox: 1.60, oy: 0.38, r: 28, z: 0.018, col: [35, 10, 60], atmo: [80, 0, 160], ring: false, tile: false, moon: true, b: 4, cr: [] },
    { ox: 1.85, oy: 0.72, r: 42, z: 0.19, col: [28, 10, 48], atmo: [90, 0, 170], ring: false, tile: true, moon: false, b: 5, cr: [] },
  ];
  // 2026-06-22: PDEFS never mutates, so its z-order is fixed — sort once instead of allocating a
  // fresh copy and re-sorting every frame in the draw loop (60 needless allocs/sec, always on).
  const PDEFS_SORTED = [...PDEFS].sort((a, b) => a.z - b.z);

  const GAS_CLOUDS = [
    { ox: 2.30, oy: 0.72, rBase: 260, z: 0.30, ci: 0, phase: 0, ps: 0.35, sx: 1.4, sy: 0.85 },
    { ox: -0.10, oy: 0.80, rBase: 220, z: 0.24, ci: 1, phase: 2.2, ps: 0.50, sx: 1.2, sy: 0.90 },
    { ox: 1.10, oy: 0.08, rBase: 180, z: 0.12, ci: 2, phase: 4.4, ps: 0.45, sx: 1.6, sy: 0.60 },
    { ox: 0.70, oy: 0.50, rBase: 350, z: 0.06, ci: 0, phase: 1.0, ps: 0.20, sx: 1.8, sy: 1.20, diffuse: true },
  ];

  const MOON_CRATERS = Array.from({ length: 22 }, (_, i) => {
    const s = i * 7.3;
    return {
      x: Math.sin(s) * 0.5 * 0.85,
      y: Math.cos(s * 1.3) * 0.5 * 0.85,
      r: 0.04 + Math.abs(Math.sin(s * 2.1)) * 0.1,
      dark: Math.sin(s * 3.7) > 0,
    };
  });

  let canvas = null;
  let cx = null;
  let W = 0;
  let H = 0;
  let VPX = 0;
  let VPY = 0;
  let themeIdx = 0;
  let curTheme = THEMES[0];
  let tgtTheme = THEMES[0];
  let blend = 1;
  let _planetLevel = 1; // 2026-06-09: current level, drives per-level planet color
  let scrollX = 0;
  let scrollY = 0;
  let velX = 0.6;
  let velY = 0.2;
  let tvX = 0.6;
  let tvY = 0.2;
  let driftT = 0;
  let hectic = false;
  let t = 0;
  let warping = false;
  let warpT = 0;
  let warpPhase = 0;
  let _warpFrameTs = 0; // 2026-06-16: timestamp of last rendered frame, for the 45fps warp cap
  let raf = 0;
  let running = false;
  let isNative = false;
  let _levelSpeedMult = 1;
  let dust = [];
  let nebDefs = [];
  let shoots = [];
  let s1 = [];
  let s2 = [];
  let s3 = [];
  let s4 = [];
  let s5 = [];
  let s6 = [];
  let debris = [];
  let shootInterval = null;

  function wrap(v, r) {
    return ((v % r) + r) % r;
  }

  function ra(arr, a) {
    if (!arr) return "rgba(0,0,0,0)";
    return `rgba(${arr[0] | 0},${arr[1] | 0},${arr[2] | 0},${a})`;
  }

  function pShift(ox, oy, z) {
    return {
      x: VPX + (ox - VPX) * (1 + z * 0.15) + scrollX * z,
      y: VPY + (oy - VPY) * (1 + z * 0.15) + scrollY * z,
    };
  }

  function mkStars(n, z, r0, r1, a0, a1) {
    return Array.from({ length: Math.floor(n) }, () => ({
      ox: (Math.random() - 0.5) * W * 5 + W * 2.5,
      oy: (Math.random() - 0.5) * H * 5 + H * 2.5,
      r: r0 + Math.random() * (r1 - r0),
      a: a0 + Math.random() * (a1 - a0),
      tw: Math.random() * Math.PI * 2,
      ts: 0.2 + Math.random() * 2,
      z,
      sp: Math.random() < 0.06,
    }));
  }

  function mkDebris(n) {
    return Array.from({ length: n }, () => ({
      ox: (Math.random() - 0.5) * W * 5 + W * 2.5,
      oy: (Math.random() - 0.5) * H * 5 + H * 2.5,
      r: 2 + Math.random() * 5,
      a: 0.05 + Math.random() * 0.12,
      z: 0.04 + Math.random() * 0.14,
      sides: Math.floor(5 + Math.random() * 4),
      rot: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.006,
    }));
  }

  function spawnShoot() {
    if (!running) return;
    const spd = 6 + Math.random() * 9;
    const a = -0.5 + Math.random() * 0.4;
    shoots.push({
      x: Math.random() * W,
      y: Math.random() * H * 0.5,
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd + spd * 0.2,
      life: 0,
      maxLife: 30 + Math.random() * 25,
    });
  }

  function drawMoonTexture(px, py, r, col) {
    cx.save();
    cx.beginPath();
    cx.arc(px, py, r, 0, Math.PI * 2);
    cx.clip();
    MOON_CRATERS.forEach((cr) => {
      const cx2 = px + cr.x * r;
      const cy2 = py + cr.y * r;
      const cr2 = cr.r * r;
      cx.beginPath();
      cx.arc(cx2, cy2, cr2, 0, Math.PI * 2);
      cx.fillStyle = cr.dark ? "rgba(0,0,0,0.18)" : "rgba(255,255,255,0.06)";
      cx.fill();
      cx.beginPath();
      cx.arc(cx2 - cr2 * 0.3, cy2 - cr2 * 0.3, cr2 * 0.4, 0, Math.PI * 2);
      cx.fillStyle = "rgba(255,255,255,0.07)";
      cx.fill();
    });
    for (let i = 0; i < 8; i += 1) {
      const a = i * 0.785;
      const rx = px + Math.cos(a) * r * 0.4;
      const ry = py + Math.sin(a) * r * 0.4;
      cx.beginPath();
      cx.arc(rx, ry, r * 0.25, 0, Math.PI * 2);
      cx.fillStyle = i % 2 === 0
        ? `rgba(${col[0] + 10},${col[1] + 5},${col[2] + 15},0.12)`
        : "rgba(0,0,0,0.08)";
      cx.fill();
    }
    cx.restore();
  }

  // 2026-06-09: per-level planet palette, mirrors getAsteroidTintForLevel() bands in script.js.
  // Returns RGB arrays (the task's hex equivalents) so they plug into ra()/the col gradient.
  function getPlanetColorForLevel(level) {
    if (level <= 2)  return { main: [74, 63, 107],  atmosphere: [107, 90, 158] }; // #4a3f6b / #6b5a9e purple
    if (level <= 4)  return { main: [107, 42, 26],  atmosphere: [160, 64, 48] };  // #6b2a1a / #a04030 rust red
    if (level <= 6)  return { main: [26, 90, 74],   atmosphere: [32, 137, 122] }; // #1a5a4a / #20897a deep teal
    if (level <= 8)  return { main: [107, 37, 0],   atmosphere: [196, 64, 0] };   // #6b2500 / #c44000 fire orange (2026-06-09)
    if (level === 9) return { main: [107, 74, 0],   atmosphere: [160, 112, 16] }; // #6b4a00 / #a07010 gold/amber
    // 2026-06-15: second-act planets (Part 4). Hex from the brief, converted to RGB arrays.
    if (level === 11) return { main: [42, 42, 42],  atmosphere: [68, 68, 68] };   // #2a2a2a / #444444 void grey
    if (level === 12) return { main: [45, 0, 96],   atmosphere: [119, 0, 204] };  // #2d0060 / #7700cc cyberpunk purple
    if (level === 13) return { main: [26, 0, 0],    atmosphere: [136, 0, 0] };    // #1a0000 / #880000 virtual boy red
    if (level === 14) return { main: [13, 43, 13],  atmosphere: [26, 92, 26] };   // #0d2b0d / #1a5c1a forest green
    if (level === 15) return { main: [42, 5, 0],    atmosphere: [204, 34, 0] };   // #2a0500 / #cc2200 inferno
    return { main: [107, 26, 0], atmosphere: [160, 32, 0] };                      // #6b1a00 / #a02000 boss red-orange (level 10)
  }

  function drawPlanet(def, px, py) {
    const r = def.r;
    // 2026-06-09: tint planets to match the current level theme (was fixed def.col/def.atmo)
    const planetTheme = getPlanetColorForLevel(_planetLevel);
    const col = planetTheme.main;
    const atm = planetTheme.atmosphere;
    const ag = cx.createRadialGradient(px, py, r * 0.7, px, py, r * 2.4);
    ag.addColorStop(0, ra(atm, 0.18));
    ag.addColorStop(1, "transparent");
    cx.fillStyle = ag;
    cx.beginPath();
    cx.arc(px, py, r * 2.4, 0, Math.PI * 2);
    cx.fill();

    if (def.ring && def.ringCol) {
      const tilt = def.ringTilt || 0;
      cx.save();
      cx.translate(px, py);
      cx.rotate(tilt);
      cx.scale(1, 0.26);
      cx.beginPath();
      cx.arc(0, 0, r * 2.2, Math.PI, Math.PI * 2);
      cx.arc(0, 0, r * 1.28, Math.PI * 2, Math.PI, true);
      cx.closePath();
      const rg = cx.createRadialGradient(0, 0, r * 1.28, 0, 0, r * 2.2);
      rg.addColorStop(0, ra(def.ringCol, 0.38));
      rg.addColorStop(0.6, ra(def.ringCol, 0.18));
      rg.addColorStop(1, "transparent");
      cx.fillStyle = rg;
      cx.fill();
      cx.restore();
    }

    const pg = cx.createRadialGradient(px - r * 0.3, py - r * 0.3, r * 0.05, px, py, r);
    pg.addColorStop(0, `rgb(${(col[0] + 55) | 0},${(col[1] + 55) | 0},${(col[2] + 55) | 0})`);
    pg.addColorStop(0.55, `rgb(${col[0]},${col[1]},${col[2]})`);
    pg.addColorStop(1, `rgb(${(col[0] / 2) | 0},${(col[1] / 2) | 0},${(col[2] / 2) | 0})`);
    cx.beginPath();
    cx.arc(px, py, r, 0, Math.PI * 2);
    cx.fillStyle = pg;
    cx.fill();

    if (def.moon) drawMoonTexture(px, py, r, col);

    cx.save();
    cx.beginPath();
    cx.arc(px, py, r, 0, Math.PI * 2);
    cx.clip();
    for (let b = 0; b < def.b; b += 1) {
      cx.fillStyle = "rgba(255,255,255,0.028)";
      cx.fillRect(px - r, py - r + r * (2 * b / def.b), r * 2, r * 0.14);
    }
    def.cr.forEach((c2) => {
      cx.beginPath();
      cx.arc(px + c2.x, py + c2.y, c2.r, 0, Math.PI * 2);
      cx.fillStyle = "rgba(0,0,0,0.28)";
      cx.fill();
    });
    cx.restore();

    const sg = cx.createRadialGradient(px + r * 0.5, py, 0, px, py, r);
    sg.addColorStop(0.38, "transparent");
    sg.addColorStop(1, "rgba(0,0,12,0.82)");
    cx.beginPath();
    cx.arc(px, py, r, 0, Math.PI * 2);
    cx.fillStyle = sg;
    cx.fill();

    if (def.ring && def.ringCol) {
      const tilt = def.ringTilt || 0;
      cx.save();
      cx.translate(px, py);
      cx.rotate(tilt);
      cx.scale(1, 0.26);
      cx.beginPath();
      cx.arc(0, 0, r * 2.2, 0, Math.PI);
      cx.arc(0, 0, r * 1.28, Math.PI, 0, true);
      cx.closePath();
      const rg = cx.createRadialGradient(0, 0, r * 1.28, 0, 0, r * 2.2);
      rg.addColorStop(0, ra(def.ringCol, 0.38));
      rg.addColorStop(0.6, ra(def.ringCol, 0.18));
      rg.addColorStop(1, "transparent");
      cx.fillStyle = rg;
      cx.fill();
      cx.restore();
    }
  }

  function drawGasCloud(gc, px, py) {
    const pulse = (Math.sin(t * gc.ps + gc.phase) + 1) * 0.5;
    const r = gc.rBase * (0.88 + pulse * 0.12);
    const sx = gc.sx || 1;
    const sy = gc.sy || 1;
    const gas = curTheme.gas || [[0, 140, 160], [0, 80, 120], [20, 60, 100]];
    const col0 = gas[gc.ci % gas.length];
    const col1 = gas[(gc.ci + 1) % gas.length];
    const col2 = gas[(gc.ci + 2) % gas.length];

    cx.save();
    cx.scale(sx, sy);
    const spx = px / sx;
    const spy = py / sy;

    if (gc.diffuse) {
      const og = cx.createRadialGradient(spx, spy, 0, spx, spy, r);
      og.addColorStop(0, ra(col0, 0.10 + pulse * 0.05));
      og.addColorStop(0.6, ra(col1, 0.02));
      og.addColorStop(1, "transparent");
      cx.fillStyle = og;
      cx.beginPath();
      cx.arc(spx, spy, r, 0, Math.PI * 2);
      cx.fill();
      cx.restore();
      return;
    }

    const og = cx.createRadialGradient(spx, spy, r * 0.3, spx, spy, r * 1.7);
    og.addColorStop(0, ra(col1, 0.12 + pulse * 0.06));
    og.addColorStop(0.5, ra(col0, 0.03));
    og.addColorStop(1, "transparent");
    cx.fillStyle = og;
    cx.beginPath();
    cx.arc(spx, spy, r * 1.7, 0, Math.PI * 2);
    cx.fill();

    const mg = cx.createRadialGradient(spx - r * 0.15, spy - r * 0.08, r * 0.05, spx, spy, r);
    mg.addColorStop(0, ra(col0, 0.28 + pulse * 0.12));
    mg.addColorStop(0.35, ra(col1, 0.10 + pulse * 0.04));
    mg.addColorStop(0.65, ra(col2, 0.06));
    mg.addColorStop(1, "transparent");
    cx.fillStyle = mg;
    cx.beginPath();
    cx.arc(spx, spy, r, 0, Math.PI * 2);
    cx.fill();

    const ig = cx.createRadialGradient(spx - r * 0.12, spy - r * 0.08, 0, spx, spy, r * 0.5);
    ig.addColorStop(0, ra(col0, 0.40 + pulse * 0.18));
    ig.addColorStop(0.4, ra(col1, 0.12));
    ig.addColorStop(1, "transparent");
    cx.fillStyle = ig;
    cx.beginPath();
    cx.arc(spx, spy, r * 0.5, 0, Math.PI * 2);
    cx.fill();

    [
      { dx: -0.55, dy: -0.35, rs: 0.55, ci: 0 },
      { dx: 0.45, dy: 0.30, rs: 0.50, ci: 1 },
      { dx: -0.25, dy: 0.52, rs: 0.45, ci: 2 },
      { dx: 0.55, dy: -0.20, rs: 0.40, ci: 0 },
      { dx: -0.65, dy: 0.15, rs: 0.35, ci: 1 },
      { dx: 0.20, dy: -0.55, rs: 0.38, ci: 2 },
    ].forEach((td) => {
      const tx = spx + td.dx * r;
      const ty = spy + td.dy * r;
      const tr = r * td.rs * (0.85 + pulse * 0.15);
      const tc = gas[td.ci % gas.length];
      const tg = cx.createRadialGradient(tx, ty, 0, tx, ty, tr);
      tg.addColorStop(0, ra(tc, 0.18 + pulse * 0.09));
      tg.addColorStop(0.5, ra(tc, 0.04));
      tg.addColorStop(1, "transparent");
      cx.fillStyle = tg;
      cx.beginPath();
      cx.arc(tx, ty, tr, 0, Math.PI * 2);
      cx.fill();
    });
    cx.restore();
  }

  function drawStarLayer(layer, st, sc) {
    layer.forEach((s) => {
      const p = pShift(s.ox, s.oy, s.z);
      const sx = wrap(p.x, W);
      const sy = wrap(p.y, H);
      const tw = Math.sin(t * s.ts + s.tw) * 0.15;
      const a = Math.max(0.02, s.a + tw);
      cx.globalAlpha = a;
      cx.fillStyle = sc;
      cx.beginPath();
      cx.arc(sx, sy, s.r, 0, Math.PI * 2);
      cx.fill();
      if (s.sp && s.r > 1.2) {
        cx.strokeStyle = `rgba(${st[0]},${st[1]},${st[2]},${a * 0.35})`;
        cx.lineWidth = 0.5;
        cx.beginPath();
        cx.moveTo(sx - s.r * 3.5, sy);
        cx.lineTo(sx + s.r * 3.5, sy);
        cx.moveTo(sx, sy - s.r * 3.5);
        cx.lineTo(sx, sy + s.r * 3.5);
        cx.stroke();
      }
    });
    cx.globalAlpha = 1;
  }

  function drawDebrisShape(d, st, warpMult) {
    d.rot += d.rotSpeed * warpMult;
    const p = pShift(d.ox, d.oy, d.z);
    const dx = wrap(p.x, W);
    const dy = wrap(p.y, H);
    cx.globalAlpha = d.a * 0.65;
    cx.fillStyle = `rgb(${(st[0] * 0.35) | 0},${(st[1] * 0.35) | 0},${(st[2] * 0.35) | 0})`;
    cx.beginPath();
    for (let i = 0; i < d.sides; i += 1) {
      const a = d.rot + (i / d.sides) * Math.PI * 2;
      const ir = d.r * (0.65 + Math.sin(i * 7.3) * 0.35);
      const x = dx + Math.cos(a) * ir;
      const y = dy + Math.sin(a) * ir;
      if (i === 0) cx.moveTo(x, y);
      else cx.lineTo(x, y);
    }
    cx.closePath();
    cx.fill();
    cx.globalAlpha = 1;
  }

  function frame(ts) {
    if (!running || !cx) return;
    raf = requestAnimationFrame(frame);
    // 2026-06-16: during the between-level warp the GPU cost spikes (radial ray burst +
    // amplified scroll). Cap that transition to ~45fps via a timestamp gate to lighten the
    // load — the burst is short and punchy enough that the dropped frames aren't noticeable.
    // Normal drifting background is left at full refresh.
    if (warping && ts) {
      if (ts - _warpFrameTs < 22) return;
      _warpFrameTs = ts;
    }
    t += 0.01;

    if (blend < 1) {
      blend = Math.min(1, blend + 0.007);
      if (blend >= 1) curTheme = tgtTheme;
    }

    let warpMult = 1;
    if (warping) {
      warpT += 0.04;
      if (warpPhase === 1) {
        warpMult = 1 + warpT * warpT * 55;
        if (warpT > 0.85) {
          warpPhase = 2;
          warpT = 0;
        }
      } else if (warpPhase === 2) {
        warpMult = Math.max(1, (1 - warpT) * 38);
        if (warpT > 0.95) {
          warping = false;
          warpPhase = 0;
          warpT = 0;
        }
      }
    }

    driftT += 0.004;
    if (!hectic) {
      tvX = (Math.cos(driftT) * 1.5 + Math.cos(driftT * 0.37) * 0.66) * _levelSpeedMult;
      tvY = (Math.sin(driftT * 0.7) * 0.96 + Math.sin(driftT * 0.41) * 0.42) * _levelSpeedMult;
      const spd = Math.sqrt(tvX * tvX + tvY * tvY);
      const minSpd = 0.8 * _levelSpeedMult;
      if (spd < minSpd) {
        if (spd > 0) {
          tvX *= minSpd / spd;
          tvY *= minSpd / spd;
        } else {
          tvX = minSpd;
          tvY = 0;
        }
      }
    }
    velX += (tvX - velX) * 0.025;
    velY += (tvY - velY) * 0.025;
    scrollX += velX * warpMult;
    scrollY += velY * warpMult;

    const st = curTheme.star;
    const sc = `rgb(${st[0]},${st[1]},${st[2]})`;
    cx.fillStyle = curTheme.sky;
    cx.fillRect(0, 0, W, H);

    const nc0 = curTheme.neb[0];
    const vg = cx.createRadialGradient(VPX, VPY, 0, VPX, VPY, H * 0.65);
    vg.addColorStop(0, `rgba(${nc0[0]},${nc0[1]},${nc0[2]},0.25)`);
    vg.addColorStop(0.5, `rgba(${nc0[0]},${nc0[1]},${nc0[2]},0.12)`);
    vg.addColorStop(1, "transparent");
    cx.fillStyle = vg;
    cx.fillRect(0, 0, W, H);

    GAS_CLOUDS.filter((g) => g.diffuse).forEach((gc) => {
      const p = pShift(gc.ox * W, gc.oy * H, gc.z);
      drawGasCloud(gc, p.x, p.y);
    });

    dust.forEach((s) => {
      const p = pShift(s.ox, s.oy, s.z);
      const sx = wrap(p.x, W);
      const sy = wrap(p.y, H);
      cx.globalAlpha = s.a;
      cx.fillStyle = sc;
      cx.beginPath();
      cx.arc(sx, sy, s.r, 0, Math.PI * 2);
      cx.fill();
    });
    cx.globalAlpha = 1;

    nebDefs.forEach((n, i) => {
      const nc = curTheme.neb[i % curTheme.neb.length];
      const p = pShift(n.ox, n.oy, n.z);
      const nx = wrap(p.x, W + 300) - 150;
      const ny = wrap(p.y, H + 150) - 75;
      cx.save();
      cx.scale(1, n.ry / n.rx);
      const g = cx.createRadialGradient(nx, ny * (n.rx / n.ry), 0, nx, ny * (n.rx / n.ry), n.rx);
      g.addColorStop(0, `rgba(${nc[0]},${nc[1]},${nc[2]},0.45)`);
      g.addColorStop(0.5, `rgba(${nc[0]},${nc[1]},${nc[2]},0.22)`);
      g.addColorStop(1, "transparent");
      cx.fillStyle = g;
      cx.beginPath();
      cx.arc(nx, ny * (n.rx / n.ry), n.rx, 0, Math.PI * 2);
      cx.fill();
      cx.restore();
    });

    [s1, s2, s3, s4, s5, s6].forEach((layer) => drawStarLayer(layer, st, sc));
    debris.forEach((d) => drawDebrisShape(d, st, warpMult));

    PDEFS_SORTED.forEach((def) => {
      const p = pShift(def.ox * W, def.oy * H, def.z);
      if (def.tile) {
        const mg = def.r * 3;
        drawPlanet(def, wrap(p.x, W + mg * 2) - mg, wrap(p.y, H + mg * 2) - mg);
      } else {
        const mg = def.r * 3.5;
        if (p.x > -mg && p.x < W + mg && p.y > -mg && p.y < H + mg) {
          drawPlanet(def, p.x, p.y);
        }
      }
    });

    GAS_CLOUDS.filter((g) => !g.diffuse).forEach((gc) => {
      const p = pShift(gc.ox * W, gc.oy * H, gc.z);
      const margin = gc.rBase * 2;
      if (p.x > -margin && p.x < W + margin && p.y > -margin && p.y < H + margin) {
        drawGasCloud(gc, p.x, p.y);
      }
    });

    for (let i = shoots.length - 1; i >= 0; i -= 1) {
      const s = shoots[i];
      const prog = s.life / s.maxLife;
      const a = (prog < 0.2 ? prog * 5 : prog > 0.65 ? (1 - prog) / 0.35 : 1) * 0.85;
      const tx = s.x - s.vx * 10;
      const ty = s.y - s.vy * 10;
      const g = cx.createLinearGradient(tx, ty, s.x, s.y);
      g.addColorStop(0, "transparent");
      g.addColorStop(1, ra(curTheme.star, a));
      cx.strokeStyle = g;
      cx.lineWidth = 1.5;
      cx.beginPath();
      cx.moveTo(tx, ty);
      cx.lineTo(s.x, s.y);
      cx.stroke();
      s.x += s.vx;
      s.y += s.vy;
      s.life += 1;
      if (s.life > s.maxLife) shoots.splice(i, 1);
    }

    if (warping) {
      const prog = warpPhase === 1 ? warpT : Math.max(0, 1 - warpT * 1.2);
      cx.save();
      // 2026-06-16: 120 rays (was 200, -40%) batched into ONE path + a single stroke (was 200
      // per-ray strokes). strokeStyle/lineWidth are constant across the burst, so the batch is
      // visually identical but collapses 200 GPU stroke calls/frame down to one.
      const RAYS = 120;
      const base = 18 + prog * 28;
      cx.strokeStyle = `rgba(${st[0]},${st[1]},${st[2]},${prog * 0.85})`;
      cx.lineWidth = 0.3 + prog * 2.2;
      cx.beginPath();
      for (let i = 0; i < RAYS; i += 1) {
        const a = (i / RAYS) * Math.PI * 2;
        const len = prog * prog * (120 + Math.random() * 350);
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        cx.moveTo(VPX + ca * base, VPY + sa * base);
        cx.lineTo(VPX + ca * (base + len), VPY + sa * (base + len));
      }
      cx.stroke();
      if (warpPhase === 2 && warpT < 0.22) {
        const fa = (0.22 - warpT) / 0.22;
        cx.fillStyle = `rgba(240,245,255,${fa * 0.95})`;
        cx.fillRect(0, 0, W, H);
      }
      cx.restore();
    }

    const vig = cx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
    vig.addColorStop(0, "transparent");
    vig.addColorStop(1, "rgba(2,2,4,0.45)");
    cx.fillStyle = vig;
    cx.fillRect(0, 0, W, H);
  }

  function init(native) {
    isNative = !!native;
    if (canvas) return;
    canvas = document.createElement("canvas");
    canvas.id = "galaxyBgCanvas";
    const host = document.getElementById("galaxyView") || document.body;
    canvas.style.cssText = host === document.body
      ? "position:fixed;inset:0;width:100%;height:100%;z-index:0;pointer-events:none;display:none;"
      : "position:absolute;inset:0;width:100%;height:100%;z-index:0;pointer-events:none;display:none;";
    host.appendChild(canvas);
    cx = canvas.getContext("2d");
    resize(window.innerWidth, window.innerHeight);

    const m = isNative ? 0.5 : 1;
    const dustN = isNative ? 350 : 600;
    dust = Array.from({ length: dustN }, () => ({
      ox: (Math.random() - 0.5) * W * 5 + W * 2.5,
      oy: (Math.random() - 0.5) * H * 5 + H * 2.5,
      r: 0.15 + Math.random() * 0.55,
      a: 0.08 + Math.random() * 0.18,
      z: 0.005 + Math.random() * 0.01,
    }));
    nebDefs = [
      { ox: W * 0.15, oy: H * 0.2, rx: 220, ry: 100, z: 0.015 },
      { ox: W * 1.4, oy: H * 0.25, rx: 260, ry: 110, z: 0.015 },
      { ox: W * 0.7, oy: H * 0.75, rx: 200, ry: 80, z: 0.015 },
      { ox: W * 2.2, oy: H * 0.5, rx: 240, ry: 95, z: 0.015 },
      { ox: W * 2.8, oy: H * 0.3, rx: 180, ry: 85, z: 0.015 },
    ];
    s1 = mkStars(400 * m, 0.008, 0.2, 0.5, 0.08, 0.22);
    s2 = mkStars(250 * m, 0.025, 0.3, 0.8, 0.12, 0.32);
    s3 = mkStars(160 * m, 0.06, 0.5, 1.1, 0.20, 0.50);
    s4 = mkStars(90 * m, 0.12, 0.7, 1.5, 0.30, 0.70);
    s5 = mkStars(45 * m, 0.22, 1.0, 2.2, 0.50, 0.90);
    s6 = mkStars(20 * m, 0.40, 1.5, 3.0, 0.70, 1.00);
    debris = mkDebris(isNative ? 20 : 38);
    scrollY = H / 2;
    curTheme = THEMES[0];
    tgtTheme = THEMES[0];
    blend = 1;
    if (shootInterval) clearInterval(shootInterval);
    shootInterval = setInterval(() => {
      if (running && Math.random() < 0.5) spawnShoot();
    }, isNative ? 3500 : 2000);
    window.addEventListener("resize", () => {
      resize(window.innerWidth, window.innerHeight);
    });
  }

  function show() {
    if (canvas) canvas.style.display = "block";
    running = true;
    if (!raf) frame();
  }

  function hide() {
    if (canvas) canvas.style.display = "none";
    running = false;
    cancelAnimationFrame(raf);
    raf = 0;
  }

  function resize(w, h) {
    W = w;
    H = h;
    VPX = W * 0.5;
    VPY = H * 0.42;
    if (!canvas) return;
    canvas.width = w;
    canvas.height = h;
  }

  function setTheme(levelNum) {
    _planetLevel = levelNum; // 2026-06-09: keep planet color in sync with the level
    // 2026-06-15: clamp to the full THEMES range (was 9) so levels 11-15 get their own themes.
    const idx = Math.min(THEMES.length - 1, Math.max(0, levelNum - 1));
    if (idx === themeIdx && blend >= 1) return;
    curTheme = THEMES[idx];
    tgtTheme = THEMES[idx];
    themeIdx = idx;
    blend = 1;
  }

  function setLevel(levelNum) {
    _planetLevel = levelNum; // 2026-06-09: keep planet color in sync with the level
    _levelSpeedMult = Math.min(4, 1.0 + (levelNum - 1) * 0.33);
  }

  function triggerWarp() {
    if (warping) return;
    warping = true;
    warpT = 0;
    warpPhase = 1;
  }

  function setHectic(on) {
    hectic = on;
    if (on) {
      const a = Math.random() * Math.PI * 2;
      const spd = 3 + Math.random() * 2;
      tvX = Math.cos(a) * spd;
      tvY = Math.sin(a) * spd;
    }
  }

  function destroy() {
    hide();
    if (shootInterval) clearInterval(shootInterval);
    shootInterval = null;
    canvas?.remove();
    canvas = null;
    cx = null;
    dust = [];
    s1 = [];
    s2 = [];
    s3 = [];
    s4 = [];
    s5 = [];
    s6 = [];
    debris = [];
    nebDefs = [];
    shoots = [];
  }

  return { init, show, hide, resize, setTheme, setLevel, triggerWarp, setHectic, destroy };
})();

window.galaxyBackground = galaxyBackground;
