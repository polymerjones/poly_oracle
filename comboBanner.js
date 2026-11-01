// comboBanner.js — bakes a combo banner (headline + points) ONCE onto an offscreen canvas.
// 2026-11-01 (Part B of handoffs/2026-11-01-looks-combo-perf.md): the old banner re-laid-out and
// re-stroked text on a full-screen canvas every frame for 2.2s. Baking once means expensive looks
// (gradients, thick outlines, shadowBlur glow) are paid a single time; the game then only animates
// the baked bitmap's scale / alpha / y.
//
// Three candidate styles for Paul to pick from:
//   "chrome" — Arcade chrome: Russo One, metallic gradient, bevel, heavy outline, points plate
//   "neon"   — Neon tube: Orbitron Black, bright core + wide glow in the combo's colours
//   "comic"  — Comic punch: Bangers, tilted, starburst plate behind the text
(function () {
  const FONTS = {
    chrome: { family: "PolyComboChrome", file: "russo-one-400.woff2", weight: "400" },
    neon: { family: "PolyComboNeon", file: "orbitron-900.woff2", weight: "900" },
    comic: { family: "PolyComboComic", file: "bangers-400.woff2", weight: "400" },
  };
  const STYLES = Object.keys(FONTS);
  let fontsPromise = null;

  // Load + warm every style font so a bake never waits on (or silently falls back from) a font.
  function loadFonts(base = "") {
    if (fontsPromise) return fontsPromise;
    if (typeof FontFace === "undefined" || !document.fonts) return (fontsPromise = Promise.resolve());
    fontsPromise = Promise.all(STYLES.map((s) => {
      const f = FONTS[s];
      const face = new FontFace(f.family, `url(${base}assets/fonts/${f.file})`, { weight: f.weight });
      return face.load().then((loaded) => { document.fonts.add(loaded); }).catch(() => {});
    })).then(() => {});
    return fontsPromise;
  }

  const rgb = (c, a = 1) => `rgba(${c},${a})`;
  function mix(c, toward, t) {
    const a = String(c).split(",").map(Number);
    const b = String(toward).split(",").map(Number);
    return a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(",");
  }
  function fontFor(style, px) {
    const f = FONTS[style] || FONTS.chrome;
    return `${f.weight} ${Math.round(px)}px "${f.family}", ui-monospace, Menlo, monospace`;
  }
  // Largest font size (<= maxPx) at which `text` fits in `maxW`.
  function fitSize(ctx, style, text, maxPx, maxW, tracking = 0) {
    ctx.font = fontFor(style, maxPx);
    const w = ctx.measureText(text).width + tracking * maxPx * Math.max(0, text.length - 1);
    return w <= maxW ? maxPx : Math.max(12, Math.floor(maxPx * (maxW / w)));
  }
  function setTracking(ctx, em, px) {
    if ("letterSpacing" in ctx) ctx.letterSpacing = `${(em * px).toFixed(1)}px`;
  }

  function starburst(ctx, cx, cy, rx, ry, points, jag, seed) {
    ctx.beginPath();
    const n = points * 2;
    for (let i = 0; i < n; i += 1) {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      const wobble = 1 + 0.12 * Math.sin(i * 2.3 + seed);
      const r = i % 2 === 0 ? 1 : 1 - jag;
      const x = cx + Math.cos(a) * rx * r * wobble;
      const y = cy + Math.sin(a) * ry * r * wobble;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
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

  // Returns { canvas, width, height } — width/height in CSS px; canvas is width*dpr × height*dpr.
  // The banner's visual centre is the canvas centre.
  function bake({ label, points, colors = ["0,255,209", "186,110,255"], style = "chrome", maxW = 360, dpr = 2 }) {
    if (!FONTS[style]) style = "chrome";
    const c0 = colors[0];
    const c1 = colors[1] || colors[0];
    const headline = String(label || "").toUpperCase();
    const sub = `+${Number(points || 0).toLocaleString("en-US")} PTS`;
    const measure = document.createElement("canvas").getContext("2d");

    let headPx; let subPx; let pad; let w; let h;
    if (style === "chrome") {
      headPx = fitSize(measure, style, headline, 40, maxW - 40, 0.02);
      subPx = Math.round(headPx * 0.56);
      pad = 18;
    } else if (style === "neon") {
      headPx = fitSize(measure, style, headline, 34, maxW - 56, 0.06);
      subPx = Math.round(headPx * 0.6);
      pad = 34;
    } else {
      headPx = fitSize(measure, style, headline, 52, maxW - 70, 0.03);
      subPx = Math.round(headPx * 0.58);
      pad = 26;
    }
    measure.font = fontFor(style, headPx);
    const headW = measure.measureText(headline).width;
    w = Math.ceil(Math.min(maxW, headW + pad * 2 + 24));
    h = Math.ceil(headPx * 1.25 + subPx * 1.55 + pad * 2);
    if (style === "comic") h = Math.ceil(h * 1.18);

    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(w * dpr);
    canvas.height = Math.ceil(h * dpr);
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    const cx = w / 2;
    const headY = pad + headPx * 0.62;
    const subY = headY + headPx * 0.62 + subPx * 0.85;

    if (style === "chrome") {
      // Headline: drop shadow → black outline → metallic gradient fill → bevel highlight.
      ctx.font = fontFor(style, headPx);
      setTracking(ctx, 0.02, headPx);
      ctx.lineWidth = Math.max(6, headPx * 0.24);
      ctx.strokeStyle = "rgba(0,0,0,0.55)";
      ctx.strokeText(headline, cx + 2, headY + 4);
      ctx.strokeStyle = "rgb(6,10,22)";
      ctx.strokeText(headline, cx, headY);
      ctx.lineWidth = Math.max(2, headPx * 0.07);
      ctx.strokeStyle = rgb(mix(c0, "255,255,255", 0.35));
      ctx.strokeText(headline, cx, headY);
      const top = headY - headPx * 0.5;
      const g = ctx.createLinearGradient(0, top, 0, top + headPx);
      g.addColorStop(0, "rgb(255,255,255)");
      g.addColorStop(0.38, rgb(mix(c0, "255,255,255", 0.55)));
      g.addColorStop(0.5, rgb(mix(c0, "0,0,0", 0.25)));
      g.addColorStop(0.56, rgb(c0));
      g.addColorStop(1, rgb(mix(c0, "255,255,255", 0.3)));
      ctx.fillStyle = g;
      ctx.fillText(headline, cx, headY);
      // Bevel: a 1px light line nudged up, clipped to the glyphs' top half via source-atop.
      ctx.save();
      ctx.globalCompositeOperation = "source-atop";
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.fillText(headline, cx, headY - Math.max(1, headPx * 0.04));
      ctx.restore();
      ctx.fillStyle = g;
      ctx.fillText(headline, cx, headY + Math.max(1, headPx * 0.025));
      // Points plate.
      ctx.font = fontFor(style, subPx);
      setTracking(ctx, 0.08, subPx);
      const sw = ctx.measureText(sub).width + subPx * 1.4;
      const sh = subPx * 1.45;
      roundRect(ctx, cx - sw / 2, subY - sh / 2, sw, sh, sh / 2);
      ctx.fillStyle = "rgba(6,10,22,0.86)";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = rgb(c1, 0.95);
      ctx.stroke();
      ctx.fillStyle = rgb(mix(c1, "255,255,255", 0.25));
      ctx.fillText(sub, cx, subY + 1);
    } else if (style === "neon") {
      const core = mix(c0, "255,255,255", 0.72);
      ctx.font = fontFor(style, headPx);
      setTracking(ctx, 0.06, headPx);
      // Wide glow → tight glow → coloured tube → near-white core.
      ctx.shadowColor = rgb(c0, 0.95);
      ctx.shadowBlur = headPx * 0.9;
      ctx.lineWidth = Math.max(3, headPx * 0.12);
      ctx.strokeStyle = rgb(c0, 0.9);
      ctx.strokeText(headline, cx, headY);
      ctx.shadowBlur = headPx * 0.35;
      ctx.strokeText(headline, cx, headY);
      ctx.shadowBlur = 0;
      ctx.lineWidth = Math.max(1.5, headPx * 0.05);
      ctx.strokeStyle = rgb(core);
      ctx.strokeText(headline, cx, headY);
      ctx.fillStyle = rgb(mix(c0, "0,0,0", 0.55), 0.85);
      ctx.fillText(headline, cx, headY);
      ctx.fillStyle = rgb(core, 0.5);
      ctx.fillText(headline, cx, headY);
      // Points line, in the second colour.
      ctx.font = fontFor(style, subPx);
      setTracking(ctx, 0.14, subPx);
      ctx.shadowColor = rgb(c1, 0.9);
      ctx.shadowBlur = subPx * 0.7;
      ctx.fillStyle = rgb(mix(c1, "255,255,255", 0.5));
      ctx.fillText(sub, cx, subY);
      ctx.shadowBlur = 0;
      ctx.fillText(sub, cx, subY);
      // Underline tube between the two lines.
      const lw = Math.min(headW, w - pad * 2) * 0.7;
      const ly = (headY + subY) / 2 + headPx * 0.05;
      ctx.shadowColor = rgb(c0, 0.9);
      ctx.shadowBlur = 10;
      ctx.strokeStyle = rgb(core, 0.9);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - lw / 2, ly);
      ctx.lineTo(cx + lw / 2, ly);
      ctx.stroke();
      ctx.shadowBlur = 0;
    } else {
      // Comic: tilted, starburst plate, hard offset shadow, chunky outline.
      ctx.translate(cx, h / 2);
      ctx.rotate(-0.07);
      ctx.translate(-cx, -h / 2);
      const burstY = h / 2 - subPx * 0.2;
      starburst(ctx, cx + 5, burstY + 6, w * 0.49, h * 0.47, 14, 0.2, 1.7);
      ctx.fillStyle = "rgb(8,8,14)";
      ctx.fill();
      starburst(ctx, cx, burstY, w * 0.48, h * 0.46, 14, 0.2, 1.7);
      const bg = ctx.createRadialGradient(cx, burstY, 4, cx, burstY, w * 0.5);
      bg.addColorStop(0, rgb(mix(c0, "255,255,255", 0.25)));
      bg.addColorStop(1, rgb(mix(c0, "0,0,0", 0.35)));
      ctx.fillStyle = bg;
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgb(8,8,14)";
      ctx.stroke();
      ctx.font = fontFor(style, headPx);
      setTracking(ctx, 0.03, headPx);
      const hy = burstY - subPx * 0.45;
      ctx.lineWidth = Math.max(7, headPx * 0.22);
      ctx.strokeStyle = "rgb(8,8,14)";
      ctx.fillStyle = "rgb(8,8,14)";
      ctx.strokeText(headline, cx + 4, hy + 5);
      ctx.fillText(headline, cx + 4, hy + 5);
      ctx.strokeText(headline, cx, hy);
      const tg = ctx.createLinearGradient(0, hy - headPx / 2, 0, hy + headPx / 2);
      tg.addColorStop(0, "rgb(255,255,235)");
      tg.addColorStop(0.55, "rgb(255,236,90)");
      tg.addColorStop(1, "rgb(255,170,30)");
      ctx.fillStyle = tg;
      ctx.fillText(headline, cx, hy);
      ctx.font = fontFor(style, subPx);
      setTracking(ctx, 0.05, subPx);
      const sy = hy + headPx * 0.58 + subPx * 0.7;
      ctx.lineWidth = Math.max(5, subPx * 0.24);
      ctx.strokeText(sub, cx, sy);
      ctx.fillStyle = "rgb(255,255,255)";
      ctx.fillText(sub, cx, sy);
    }
    return { canvas, width: w, height: h };
  }

  // Animation curve shared by every renderer (PIXI sprite, DOM fallback, Lab preview).
  // t = 0..1 over the banner's life. Returns { scale, alpha, dy, rot }.
  function pose(style, t, fadeStart = 0.62) {
    let scale;
    const slamEnd = 0.14;
    if (t < slamEnd) {
      const k = t / slamEnd;
      scale = 1.6 - 0.6 * (1 - (1 - k) * (1 - k)); // 1.6 → 1.0, decelerating
    } else {
      const k = (t - slamEnd) / (1 - slamEnd);
      scale = 1 + Math.sin(k * Math.PI * 4) * 0.06 * Math.exp(-k * 7); // overshoot wobble that settles
    }
    let alpha = t < fadeStart ? 1 : 1 - (t - fadeStart) / (1 - fadeStart);
    alpha = Math.max(0, Math.min(1, alpha * alpha * (3 - 2 * alpha)));
    if (style === "neon" && t < 0.12) {
      // Tube "strikes": two quick flickers before it holds.
      const f = t / 0.12;
      alpha *= f < 0.25 ? 1 : f < 0.4 ? 0.25 : f < 0.6 ? 1 : f < 0.7 ? 0.4 : 1;
    }
    const rot = style === "comic" && t < 0.3 ? Math.sin((t / 0.3) * Math.PI * 3) * 0.05 * (1 - t / 0.3) : 0;
    return { scale, alpha, dy: -t * 24, rot };
  }

  window.PolyComboBanner = { STYLES, loadFonts, bake, pose };
})();
