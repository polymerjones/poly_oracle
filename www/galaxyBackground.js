const galaxyBackground = (() => {
  const THEMES = [
    {
      sky: "#020408",
      neb: [[0, 40, 90], [55, 0, 100], [0, 65, 85]],
      star: [220, 230, 255],
      planets: [
        { col: [18, 32, 52], atmo: [0, 50, 110], ring: false, ringCol: null },
        { col: [38, 18, 58], atmo: [70, 0, 150], ring: false, ringCol: null },
        { col: [12, 48, 68], atmo: [0, 110, 155], ring: true, ringCol: [0, 85, 105] },
        { col: [42, 12, 68], atmo: [110, 0, 190], ring: true, ringCol: [75, 15, 130] },
        { col: [58, 28, 12], atmo: [170, 75, 0], ring: false, ringCol: null },
      ],
    },
    {
      sky: "#040208",
      neb: [[80, 0, 120], [50, 0, 100], [100, 20, 80]],
      star: [220, 200, 255],
      planets: [
        { col: [30, 10, 50], atmo: [80, 0, 160], ring: false, ringCol: null },
        { col: [50, 5, 80], atmo: [120, 0, 200], ring: false, ringCol: null },
        { col: [20, 5, 60], atmo: [60, 0, 140], ring: true, ringCol: [100, 20, 160] },
        { col: [60, 10, 90], atmo: [140, 0, 220], ring: true, ringCol: [100, 0, 180] },
        { col: [40, 5, 70], atmo: [160, 20, 100], ring: false, ringCol: null },
      ],
    },
    {
      sky: "#020608",
      neb: [[0, 80, 100], [0, 60, 120], [20, 80, 90]],
      star: [200, 240, 255],
      planets: [
        { col: [10, 40, 60], atmo: [0, 120, 180], ring: false, ringCol: null },
        { col: [5, 55, 75], atmo: [0, 160, 200], ring: false, ringCol: null },
        { col: [8, 45, 70], atmo: [0, 140, 190], ring: true, ringCol: [0, 160, 200] },
        { col: [15, 60, 80], atmo: [0, 180, 220], ring: true, ringCol: [0, 180, 210] },
        { col: [20, 50, 65], atmo: [0, 160, 180], ring: false, ringCol: null },
      ],
    },
    {
      sky: "#010104",
      neb: [[20, 0, 40], [10, 0, 30], [30, 5, 50]],
      star: [180, 180, 220],
      planets: [
        { col: [15, 8, 25], atmo: [40, 0, 80], ring: false, ringCol: null },
        { col: [25, 5, 40], atmo: [60, 0, 100], ring: false, ringCol: null },
        { col: [10, 5, 30], atmo: [30, 0, 70], ring: true, ringCol: [50, 0, 90] },
        { col: [30, 8, 50], atmo: [70, 0, 120], ring: true, ringCol: [60, 0, 110] },
        { col: [20, 5, 35], atmo: [50, 10, 60], ring: false, ringCol: null },
      ],
    },
    {
      sky: "#080200",
      neb: [[120, 20, 0], [160, 40, 0], [100, 10, 10]],
      star: [255, 180, 100],
      planets: [
        { col: [80, 20, 5], atmo: [200, 60, 0], ring: false, ringCol: null },
        { col: [100, 30, 10], atmo: [220, 80, 10], ring: false, ringCol: null },
        { col: [90, 25, 8], atmo: [210, 70, 5], ring: true, ringCol: [180, 50, 0] },
        { col: [110, 35, 15], atmo: [230, 90, 20], ring: true, ringCol: [200, 60, 10] },
        { col: [70, 15, 5], atmo: [190, 50, 0], ring: false, ringCol: null },
      ],
    },
  ];

  const PDEFS = [
    { ox: 0.28, oy: 0.22, r: 7, z: 0.022, cr: [{ x: -2, y: -1, r: 1.5 }, { x: 2, y: 2, r: 1 }], b: 2 },
    { ox: 1.10, oy: 0.65, r: 16, z: 0.055, cr: [{ x: -5, y: 3, r: 3 }, { x: 5, y: -4, r: 2 }], b: 3 },
    { ox: 0.60, oy: 0.18, r: 18, z: 0.008, cr: [{ x: -5, y: 3, r: 3 }, { x: 5, y: -4, r: 2 }], b: 3 },
    { ox: 1.85, oy: 0.55, r: 52, z: 0.21, cr: [], b: 6 },
    { ox: 2.70, oy: 0.82, r: 88, z: 0.39, cr: [{ x: -18, y: 8, r: 8 }, { x: 14, y: -16, r: 6 }], b: 5 },
  ];

  let canvas = null;
  let cx = null;
  let W = 0;
  let H = 0;
  let themeIdx = 0;
  let curTheme = THEMES[0];
  let tgtTheme = THEMES[0];
  let blend = 1;
  let scrollX = 0;
  let scrollY = 0;
  let velX = 0.35;
  let velY = 0.12;
  let tvX = 0.35;
  let tvY = 0.12;
  let driftT = 0;
  let hectic = false;
  let t = 0;
  let warping = false;
  let warpT = 0;
  let warpPhase = 0;
  let raf = 0;
  let running = false;
  let isNative = false;
  let dust = [];
  let nebDefs = [];
  let sFar = [];
  let sMid = [];
  let sFg = [];
  let shoots = [];
  let shootInterval = null;

  function wrap(v, r) {
    return ((v % r) + r) % r;
  }

  function lerp(a, b, p) {
    return a + (b - a) * p;
  }

  function lc(a, b, p) {
    if (!a || !b) return a || b || [0, 0, 0];
    return [lerp(a[0], b[0], p), lerp(a[1], b[1], p), lerp(a[2], b[2], p)];
  }

  function ra(arr, a) {
    if (!arr) return "rgba(0,0,0,0)";
    return `rgba(${arr[0] | 0},${arr[1] | 0},${arr[2] | 0},${a})`;
  }

  function makeStars(n, z, r0, r1, a0, a1) {
    return Array.from({ length: Math.floor(n) }, () => ({
      ox: Math.random() * W * 4,
      oy: Math.random() * H * 4,
      r: r0 + Math.random() * (r1 - r0),
      a: a0 + Math.random() * (a1 - a0),
      tw: Math.random() * Math.PI * 2,
      ts: 0.2 + Math.random() * 1.5,
      z,
      sp: Math.random() < 0.07,
    }));
  }

  function spawnShoot() {
    if (!running || !W || !H) return;
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

  function getPC(i) {
    const c = curTheme.planets[i];
    const tg = tgtTheme.planets[i];
    if (blend >= 1) return { col: c.col, atmo: c.atmo, ring: c.ring, ringCol: c.ringCol };
    return {
      col: lc(c.col, tg.col, blend),
      atmo: lc(c.atmo, tg.atmo, blend),
      ring: tg.ring,
      ringCol: tg.ringCol ? lc(c.ringCol || c.col, tg.ringCol, blend) : null,
    };
  }

  function drawPlanet(def, pc, px, py) {
    const r = def.r;
    const col = pc.col;
    const atm = pc.atmo;
    const ag = cx.createRadialGradient(px, py, r * 0.7, px, py, r * 2.5);
    ag.addColorStop(0, ra(atm, 0.22));
    ag.addColorStop(1, "transparent");
    cx.fillStyle = ag;
    cx.beginPath();
    cx.arc(px, py, r * 2.5, 0, Math.PI * 2);
    cx.fill();

    if (pc.ring && pc.ringCol) {
      cx.save();
      cx.translate(px, py);
      cx.scale(1, 0.26);
      cx.beginPath();
      cx.arc(0, 0, r * 2.2, Math.PI, Math.PI * 2);
      cx.arc(0, 0, r * 1.28, Math.PI * 2, Math.PI, true);
      cx.closePath();
      const rg = cx.createRadialGradient(0, 0, r * 1.28, 0, 0, r * 2.2);
      rg.addColorStop(0, ra(pc.ringCol, 0.38));
      rg.addColorStop(0.55, ra(pc.ringCol, 0.18));
      rg.addColorStop(1, "transparent");
      cx.fillStyle = rg;
      cx.fill();
      cx.restore();
    }

    const pg = cx.createRadialGradient(px - r * 0.3, py - r * 0.3, r * 0.05, px, py, r);
    pg.addColorStop(0, `rgb(${(col[0] + 55) | 0},${(col[1] + 55) | 0},${(col[2] + 55) | 0})`);
    pg.addColorStop(0.5, `rgb(${col[0] | 0},${col[1] | 0},${col[2] | 0})`);
    pg.addColorStop(1, `rgb(${(col[0] / 2) | 0},${(col[1] / 2) | 0},${(col[2] / 2) | 0})`);
    cx.beginPath();
    cx.arc(px, py, r, 0, Math.PI * 2);
    cx.fillStyle = pg;
    cx.fill();

    cx.save();
    cx.beginPath();
    cx.arc(px, py, r, 0, Math.PI * 2);
    cx.clip();
    for (let b = 0; b < def.b; b += 1) {
      cx.fillStyle = "rgba(255,255,255,0.032)";
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

    if (pc.ring && pc.ringCol) {
      cx.save();
      cx.translate(px, py);
      cx.scale(1, 0.26);
      cx.beginPath();
      cx.arc(0, 0, r * 2.2, 0, Math.PI);
      cx.arc(0, 0, r * 1.28, Math.PI, 0, true);
      cx.closePath();
      const rg = cx.createRadialGradient(0, 0, r * 1.28, 0, 0, r * 2.2);
      rg.addColorStop(0, ra(pc.ringCol, 0.38));
      rg.addColorStop(0.55, ra(pc.ringCol, 0.18));
      rg.addColorStop(1, "transparent");
      cx.fillStyle = rg;
      cx.fill();
      cx.restore();
    }
  }

  function frame() {
    if (!running || !cx) return;
    t += 0.01;
    raf = requestAnimationFrame(frame);

    if (blend < 1) {
      blend = Math.min(1, blend + 0.007);
      if (blend >= 1) curTheme = tgtTheme;
    }

    let warpMult = 1;
    if (warping) {
      warpT += 0.04;
      if (warpPhase === 1) {
        warpMult = 1 + warpT * warpT * 60;
        if (warpT > 0.8) {
          warpPhase = 2;
          warpT = 0;
          const next = (themeIdx + 1) % THEMES.length;
          themeIdx = next;
          tgtTheme = THEMES[next];
          curTheme = THEMES[next];
          blend = 1;
        }
      } else if (warpPhase === 2) {
        warpMult = Math.max(1, (1 - warpT) * 40);
        if (warpT > 0.9) {
          warping = false;
          warpPhase = 0;
          warpT = 0;
        }
      }
    }

    driftT += 0.004;
    if (!hectic) {
      tvX = Math.cos(driftT) * 0.5 + Math.cos(driftT * 0.37) * 0.22;
      tvY = Math.sin(driftT * 0.7) * 0.32 + Math.sin(driftT * 0.41) * 0.14;
      const spd = Math.sqrt(tvX * tvX + tvY * tvY);
      if (spd < 0.2) {
        tvX *= 0.2 / spd;
        tvY *= 0.2 / spd;
      }
    }
    velX += (tvX - velX) * 0.025;
    velY += (tvY - velY) * 0.025;
    scrollX += velX * warpMult;
    scrollY += velY * warpMult;

    cx.fillStyle = curTheme.sky;
    cx.fillRect(0, 0, W, H);

    const st = curTheme.star;
    const starColor = `rgb(${st[0]},${st[1]},${st[2]})`;
    dust.forEach((s) => {
      const sx = wrap(s.ox - scrollX * 0.007, W * 4);
      const sy = wrap(s.oy - scrollY * 0.007, H * 4);
      if (sx > W + 1 || sy > H + 1) return;
      cx.globalAlpha = s.a;
      cx.fillStyle = starColor;
      cx.beginPath();
      cx.arc(sx, sy, s.r, 0, Math.PI * 2);
      cx.fill();
    });
    cx.globalAlpha = 1;

    nebDefs.forEach((n, i) => {
      const nc = curTheme.neb[i % curTheme.neb.length];
      const nx = wrap(n.ox - scrollX * n.z, W * 4);
      const ny = wrap(n.oy - scrollY * n.z, H * 4);
      if (nx > W + 280 || ny > H + 150) return;
      cx.save();
      cx.scale(1, n.ry / n.rx);
      const gy = ny * (n.rx / n.ry);
      const g = cx.createRadialGradient(nx, gy, 0, nx, gy, n.rx);
      g.addColorStop(0, `rgba(${nc[0]},${nc[1]},${nc[2]},0.2)`);
      g.addColorStop(0.5, `rgba(${nc[0]},${nc[1]},${nc[2]},0.09)`);
      g.addColorStop(1, "transparent");
      cx.fillStyle = g;
      cx.beginPath();
      cx.arc(nx, gy, n.rx, 0, Math.PI * 2);
      cx.fill();
      cx.restore();
    });

    sFar.forEach((s) => {
      const sx = wrap(s.ox - scrollX * s.z, W * 4);
      const sy = wrap(s.oy - scrollY * s.z, H * 4);
      if (sx > W + 1 || sy > H + 1) return;
      cx.globalAlpha = Math.max(0.02, s.a + Math.sin(t * s.ts + s.tw) * 0.1);
      cx.fillStyle = starColor;
      cx.beginPath();
      cx.arc(sx, sy, s.r, 0, Math.PI * 2);
      cx.fill();
    });
    cx.globalAlpha = 1;

    [...PDEFS.map((d, i) => ({ d, i }))].sort((a, b) => a.d.z - b.d.z).forEach(({ d, i }) => {
      const px = wrap(d.ox * W - scrollX * d.z, W * 4);
      const py = wrap(d.oy * H - scrollY * d.z, H * 4);
      const mg = d.r * 3;
      if (px > W + mg || px < -mg || py > H + mg || py < -mg) return;
      drawPlanet(d, getPC(i), px, py);
    });

    [...sMid, ...sFg].forEach((s) => {
      const sx = wrap(s.ox - scrollX * s.z, W * 4);
      const sy = wrap(s.oy - scrollY * s.z, H * 4);
      if (sx > W + 3 || sy > H + 3) return;
      const tw = Math.sin(t * s.ts + s.tw) * 0.2;
      const a = Math.max(0.05, s.a + tw);
      cx.globalAlpha = a;
      cx.fillStyle = starColor;
      cx.beginPath();
      cx.arc(sx, sy, s.r, 0, Math.PI * 2);
      cx.fill();
      if (s.sp && s.r > 1.4) {
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

    for (let i = shoots.length - 1; i >= 0; i -= 1) {
      const s = shoots[i];
      const prog = s.life / s.maxLife;
      const a = (prog < 0.2 ? prog * 5 : prog > 0.65 ? (1 - prog) / 0.35 : 1) * 0.85;
      const tx = s.x - s.vx * 10;
      const ty = s.y - s.vy * 10;
      const g = cx.createLinearGradient(tx, ty, s.x, s.y);
      g.addColorStop(0, "transparent");
      g.addColorStop(1, `rgba(255,255,255,${a})`);
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
      for (let i = 0; i < 180; i += 1) {
        const a = (i / 180) * Math.PI * 2;
        const base = 20 + prog * 30;
        const len = prog * prog * (150 + Math.random() * 400);
        cx.strokeStyle = `rgba(${st[0]},${st[1]},${st[2]},${prog * 0.8})`;
        cx.lineWidth = 0.4 + prog * 2;
        cx.beginPath();
        cx.moveTo(W / 2 + Math.cos(a) * base, H / 2 + Math.sin(a) * base);
        cx.lineTo(W / 2 + Math.cos(a) * (base + len), H / 2 + Math.sin(a) * (base + len));
        cx.stroke();
      }
      if (warpPhase === 2 && warpT < 0.25) {
        const fa = (0.25 - warpT) / 0.25;
        cx.fillStyle = `rgba(240,245,255,${fa * 0.95})`;
        cx.fillRect(0, 0, W, H);
      }
      cx.restore();
    }

    const vig = cx.createRadialGradient(W / 2, H / 2, H * 0.22, W / 2, H / 2, H * 0.85);
    vig.addColorStop(0, "transparent");
    vig.addColorStop(1, "rgba(2,2,4,0.72)");
    cx.fillStyle = vig;
    cx.fillRect(0, 0, W, H);
  }

  function resize(w, h) {
    W = Math.max(1, Math.floor(w || window.innerWidth || 1));
    H = Math.max(1, Math.floor(h || window.innerHeight || 1));
    if (!canvas) return;
    canvas.width = W;
    canvas.height = H;
  }

  function init(native) {
    isNative = !!native;
    if (canvas) {
      resize(window.innerWidth, window.innerHeight);
      return;
    }
    const host = document.getElementById("galaxyView") || document.body;
    canvas = document.createElement("canvas");
    canvas.id = "galaxyBgCanvas";
    canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;z-index:0;pointer-events:none;display:none;";
    host.appendChild(canvas);
    cx = canvas.getContext("2d");
    resize(window.innerWidth, window.innerHeight);

    const dustCount = isNative ? 300 : 500;
    dust = Array.from({ length: dustCount }, () => ({
      ox: Math.random() * W * 4,
      oy: Math.random() * H * 4,
      r: 0.2 + Math.random() * 0.7,
      a: 0.03 + Math.random() * 0.08,
    }));
    nebDefs = [
      { ox: W * 0.2, oy: H * 0.2, rx: 200, ry: 90, z: 0.018 },
      { ox: W * 1.5, oy: H * 0.3, rx: 240, ry: 100, z: 0.018 },
      { ox: W * 0.8, oy: H * 0.8, rx: 180, ry: 75, z: 0.018 },
      { ox: W * 2.5, oy: H * 0.5, rx: 200, ry: 90, z: 0.018 },
    ];
    const starMult = isNative ? 0.5 : 1;
    sFar = makeStars(350 * starMult, 0.012, 0.2, 0.6, 0.06, 0.18);
    sMid = makeStars(200 * starMult, 0.055, 0.5, 1.1, 0.2, 0.55);
    sFg = makeStars(65 * starMult, 0.20, 0.9, 2.2, 0.5, 0.95);
    scrollY = H / 2;
    curTheme = THEMES[0];
    tgtTheme = THEMES[0];
    blend = 1;

    if (shootInterval) clearInterval(shootInterval);
    shootInterval = setInterval(() => {
      if (running && Math.random() < 0.5) spawnShoot();
    }, isNative ? 3500 : 2200);

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

  function setTheme(levelNum) {
    let idx = 0;
    if (levelNum >= 10) idx = 4;
    else if (levelNum >= 7) idx = 3;
    else if (levelNum >= 5) idx = 2;
    else if (levelNum >= 3) idx = 1;
    if (idx === themeIdx) return;
    tgtTheme = THEMES[idx];
    themeIdx = idx;
    blend = 0;
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
      const spd = 2 + Math.random() * 1.5;
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
    nebDefs = [];
    sFar = [];
    sMid = [];
    sFg = [];
    shoots = [];
  }

  return { init, show, hide, resize, setTheme, triggerWarp, setHectic, destroy };
})();

window.galaxyBackground = galaxyBackground;
