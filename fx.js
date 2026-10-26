// fx.js — one-shot visual effects for the FX Lab trials (2026-10-25). Each effect mounts its own
// fixed canvas, runs only while playing, then fully disposes (canvas removed, rAF stopped, WebGL
// context released). Nothing here runs idle. Honors prefers-reduced-motion with a short fade or a
// skip. Hand-ported in the spirit of React Bits (Hyperspeed / Light Tunnel, Shiny / Decrypted / Glitch
// text) as vanilla JS + CSS; no framework.
(function () {
  const reduceMotion = () => !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const isNative = () => !!window.Capacitor?.isNativePlatform?.();
  const effectDpr = () => (isNative() ? 1 : Math.min(1.5, window.devicePixelRatio || 1));

  function mountCanvas(zIndex) {
    const c = document.createElement("canvas");
    const dpr = effectDpr();
    c.width = Math.round(window.innerWidth * dpr);
    c.height = Math.round(window.innerHeight * dpr);
    c.style.cssText = `position:fixed;inset:0;width:100%;height:100%;z-index:${zIndex};pointer-events:none;`;
    c.setAttribute("aria-hidden", "true");
    document.body.appendChild(c);
    return { c, dpr };
  }

  // Runs step(t 0..1, dtSec) on rAF for durMs, then cleanup(). Returns a Promise resolving when done.
  function runFor(durMs, step, cleanup) {
    return new Promise((resolve) => {
      const t0 = performance.now();
      let last = t0;
      let raf = 0;
      const tick = (now) => {
        if (document.hidden) { finish(); return; } // never run behind a backgrounded app
        const t = Math.min(1, (now - t0) / durMs);
        // rAF timestamps are frame-start times and can precede the performance.now() taken at start,
        // so the first dt can be negative — clamp it (a negative dt grew the confetti flash ring's
        // radius below zero → IndexSizeError).
        step(Math.max(0, t), Math.max(0, Math.min(0.05, (now - last) / 1000)));
        last = now;
        if (t >= 1) finish();
        else raf = requestAnimationFrame(tick);
      };
      const finish = () => {
        cancelAnimationFrame(raf);
        try { cleanup(); } catch { /* ignore */ }
        resolve();
      };
      raf = requestAnimationFrame(tick);
    });
  }

  // 2026-10-26: open-ended run for the level warp — fade in, HOLD until `holdUntil` resolves (the
  // level's bg video is on screen) and at least minMs has passed (or maxMs, whichever first), then
  // fade out over outMs. step(fade 0..1, dtSec, elapsedMs).
  function runHeld({ holdUntil, inMs = 180, minMs = 1600, maxMs = 4500, outMs = 900 }, step, cleanup) {
    let released = false;
    Promise.resolve(holdUntil).then(() => { released = true; }, () => { released = true; });
    return new Promise((resolve) => {
      const t0 = performance.now();
      let last = t0;
      let raf = 0;
      let outAt = 0;
      let fadeAtOut = 1;
      let fade = 0;
      const tick = (now) => {
        if (document.hidden) { finish(); return; }
        const el = Math.max(0, now - t0);
        const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
        last = now;
        if (!outAt && ((released && el >= minMs) || el >= maxMs)) { outAt = now; fadeAtOut = fade; }
        if (outAt) fade = fadeAtOut * Math.max(0, 1 - (now - outAt) / outMs);
        else fade = Math.min(1, el / inMs);
        step(fade, dt, el);
        if (outAt && now - outAt >= outMs) finish();
        else raf = requestAnimationFrame(tick);
      };
      const finish = () => {
        cancelAnimationFrame(raf);
        try { cleanup(); } catch { /* ignore */ }
        resolve();
      };
      raf = requestAnimationFrame(tick);
    });
  }

  // ── Level warp: TUNNEL (WebGL hyperspace light tunnel) ───────────────────────────────────────
  const TUNNEL_FRAG = `
    precision mediump float;
    uniform vec2 uRes; uniform float uTime; uniform float uFade; uniform vec3 uTint;
    float hash(float n){ return fract(sin(n)*43758.5453); }
    void main(){
      vec2 uv = (gl_FragCoord.xy - 0.5*uRes) / min(uRes.x, uRes.y);
      float r = length(uv); float a = atan(uv.y, uv.x);
      // streaks: radial lines whose segments rush outward
      float seg = floor(a * 40.0 / 6.2831);
      float rnd = hash(seg);
      float z = fract(1.0/(r+0.05)*0.35 - uTime*(1.6 + rnd*2.4) + rnd);
      float streak = smoothstep(0.92, 1.0, z) * smoothstep(0.02, 0.18, r);
      // tunnel rings
      float rings = pow(0.5 + 0.5*sin(1.0/(r+0.04)*6.0 - uTime*18.0), 18.0) * 0.35 * smoothstep(0.05, 0.4, r);
      vec3 col = uTint * (streak*1.4 + rings) + vec3(1.0) * streak * 0.5;
      float core = exp(-r*9.0) * 0.9;
      col += mix(uTint, vec3(1.0), 0.6) * core;
      gl_FragColor = vec4(col * uFade, clamp((streak + rings + core) * uFade, 0.0, 1.0));
    }`;
  function playTunnel({ durationMs = 1200, tint = [0.0, 1.0, 0.82], zIndex = 25, holdUntil = null, ...hold } = {}) {
    if (reduceMotion()) return Promise.resolve();
    const { c } = mountCanvas(zIndex);
    const gl = c.getContext("webgl", { premultipliedAlpha: false, antialias: false, alpha: true });
    if (!gl) { c.remove(); return playStreaks({ durationMs, zIndex, holdUntil, ...hold }); }
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}"));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, TUNNEL_FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { c.remove(); return playStreaks({ durationMs, zIndex, holdUntil, ...hold }); }
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const uRes = gl.getUniformLocation(prog, "uRes");
    const uTime = gl.getUniformLocation(prog, "uTime");
    const uFade = gl.getUniformLocation(prog, "uFade");
    const uTint = gl.getUniformLocation(prog, "uTint");
    gl.uniform2f(uRes, c.width, c.height);
    gl.uniform3f(uTint, tint[0], tint[1], tint[2]);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    let time = 0;
    const draw = (fade) => {
      gl.viewport(0, 0, c.width, c.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(uTime, time);
      gl.uniform1f(uFade, fade);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    const dispose = () => {
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      c.remove();
    };
    if (holdUntil) {
      // Held warp: full-speed burst, easing to a slower cruise while it waits for the level's bg.
      return runHeld({ holdUntil, ...hold }, (fade, dt, el) => {
        time += dt * (el < 900 ? 1 : Math.max(0.45, 1 - (el - 900) / 1500));
        draw(fade);
      }, dispose);
    }
    return runFor(durationMs, (t, dt) => {
      time += dt;
      draw(t < 0.15 ? t / 0.15 : t > 0.7 ? (1 - t) / 0.3 : 1);
    }, dispose);
  }

  // ── Level warp: STREAKS (canvas 2D star-streak burst; cheaper fallback) ──────────────────────
  function playStreaks({ durationMs = 1100, color = "180,255,240", zIndex = 25, holdUntil = null, ...hold } = {}) {
    if (reduceMotion()) return Promise.resolve();
    const { c, dpr } = mountCanvas(zIndex);
    const x = c.getContext("2d");
    const W = c.width, H = c.height, cx = W / 2, cy = H * 0.45;
    const newStar = () => ({ a: Math.random() * Math.PI * 2, d: Math.random() * 40 * dpr, v: (300 + Math.random() * 900) * dpr });
    const stars = Array.from({ length: 140 }, newStar);
    const maxD = Math.hypot(W, H);
    const frame = (fade, dt) => {
      x.clearRect(0, 0, W, H);
      x.lineCap = "round";
      x.beginPath();
      for (const s of stars) {
        if (holdUntil && s.d > maxD) Object.assign(s, newStar()); // held: keep streaks coming
        s.v *= 1 + dt * 2.2;
        s.d += s.v * dt;
        const len = Math.min(220 * dpr, s.v * 0.08);
        const ca = Math.cos(s.a), sa = Math.sin(s.a);
        x.moveTo(cx + ca * s.d, cy + sa * s.d);
        x.lineTo(cx + ca * (s.d + len), cy + sa * (s.d + len));
      }
      x.strokeStyle = `rgba(${color},${(0.85 * fade).toFixed(3)})`;
      x.lineWidth = 1.6 * dpr;
      x.stroke();
    };
    if (holdUntil) return runHeld({ holdUntil, ...hold }, (fade, dt) => frame(fade, dt), () => c.remove());
    return runFor(durationMs, (t, dt) => frame(t < 0.12 ? t / 0.12 : t > 0.65 ? (1 - t) / 0.35 : 1, dt), () => c.remove());
  }

  // ── Cheat unlock: NUCLEAR HOLOGRAM SPACE CONFETTI ────────────────────────────────────────────
  // Radiation trefoils + iridescent holo shards + sparks bursting from a point, gravity + spin.
  function playNuclearConfetti({ x: ox, y: oy, durationMs = 1900, zIndex = 21000 } = {}) {
    if (reduceMotion()) return Promise.resolve();
    const { c, dpr } = mountCanvas(zIndex);
    const g = c.getContext("2d");
    const W = c.width, H = c.height;
    const sx = (ox ?? window.innerWidth / 2) * dpr, sy = (oy ?? window.innerHeight * 0.45) * dpr;
    const parts = [];
    const N = isNative() ? 70 : 110;
    for (let i = 0; i < N; i++) {
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.7;
      const sp = (380 + Math.random() * 780) * dpr;
      const kind = i % 7 === 0 ? "trefoil" : i % 3 === 0 ? "spark" : "shard";
      parts.push({
        kind, x: sx, y: sy, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
        rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 12,
        size: (kind === "trefoil" ? 11 + Math.random() * 6 : kind === "spark" ? 2 + Math.random() * 2 : 5 + Math.random() * 6) * dpr,
        hue: Math.random() * 360, flip: Math.random() * 6.28,
      });
    }
    const trefoil = (s) => {
      g.beginPath();
      for (let k = 0; k < 3; k++) {
        const a0 = k * (Math.PI * 2 / 3) - Math.PI / 2 - 0.5, a1 = a0 + 1.0;
        g.moveTo(Math.cos(a0) * s * 0.28, Math.sin(a0) * s * 0.28);
        g.arc(0, 0, s, a0, a1);
        g.arc(0, 0, s * 0.28, a1, a0, true);
      }
      g.fill();
      g.beginPath();
      g.arc(0, 0, s * 0.16, 0, Math.PI * 2);
      g.fill();
    };
    let flash = 1;
    return runFor(durationMs, (t, dt) => {
      g.clearRect(0, 0, W, H);
      // opening holo flash ring
      if (flash > 0) {
        flash = Math.max(0, flash - dt * 3.2);
        g.strokeStyle = `rgba(160,255,120,${(flash * 0.8).toFixed(3)})`;
        g.lineWidth = 6 * dpr;
        g.beginPath();
        g.arc(sx, sy, (1 - flash) * 220 * dpr, 0, Math.PI * 2);
        g.stroke();
      }
      const fade = t > 0.7 ? (1 - t) / 0.3 : 1;
      for (const p of parts) {
        p.vy += 900 * dpr * dt * (p.kind === "spark" ? 0.5 : 1);
        p.vx *= 1 - dt * 1.4;
        p.vy *= 1 - dt * 0.9;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        p.flip += dt * 9;
        if (p.y > H + 40) continue;
        g.save();
        g.translate(p.x, p.y);
        g.rotate(p.rot);
        g.globalAlpha = fade;
        if (p.kind === "trefoil") {
          g.shadowColor = "rgba(160,255,60,0.9)";
          g.shadowBlur = isNative() ? 0 : 10 * dpr;
          g.fillStyle = "#c6ff3a";
          trefoil(p.size);
        } else if (p.kind === "spark") {
          g.fillStyle = `hsl(${(p.hue + t * 400) % 360},100%,80%)`;
          g.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        } else {
          // holo shard: iridescent hue that shifts as it "flips" (scaleY = cos(flip))
          g.scale(1, Math.cos(p.flip));
          g.fillStyle = `hsl(${(p.hue + p.flip * 40) % 360},95%,65%)`;
          g.fillRect(-p.size / 2, -p.size * 0.3, p.size, p.size * 0.6);
        }
        g.restore();
      }
    }, () => c.remove());
  }

  // ── Teal spark burst (2026-10-26, reward chest) ──────────────────────────────────────────────
  // Additive teal/cyan streaks drawn along their velocity so they read as "whiz" lines. power 0..1
  // scales count, speed and the flash ring. inward:true spirals the sparks IN to (x,y) instead —
  // the chest's arrival swirl.
  function playTealBurst({ x: ox, y: oy, power = 0.5, inward = false, durationMs = 700, zIndex = 21000 } = {}) {
    if (reduceMotion()) return Promise.resolve();
    const { c, dpr } = mountCanvas(zIndex);
    const g = c.getContext("2d");
    const W = c.width, H = c.height;
    const sx = (ox ?? window.innerWidth / 2) * dpr, sy = (oy ?? window.innerHeight * 0.45) * dpr;
    const p01 = Math.max(0, Math.min(1, power));
    const N = Math.round((isNative() ? 18 : 26) + p01 * (isNative() ? 42 : 64));
    const parts = [];
    for (let i = 0; i < N; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = (220 + Math.random() * 520) * (0.6 + p01 * 0.9) * dpr;
      const r0 = inward ? (140 + Math.random() * 160) * dpr : 0;
      parts.push({
        ang, sp, r: r0, r0, spin: (Math.random() < 0.5 ? -1 : 1) * (1.6 + Math.random() * 2.2),
        x: sx + Math.cos(ang) * r0, y: sy + Math.sin(ang) * r0,
        w: (1.4 + Math.random() * 2.2) * dpr,
        tone: Math.random(), delay: inward ? Math.random() * 0.25 : 0,
      });
    }
    return runFor(durationMs, (t) => {
      g.clearRect(0, 0, W, H);
      g.globalCompositeOperation = "lighter";
      g.lineCap = "round";
      // flash ring on outward bursts, bigger with power
      if (!inward && t < 0.45) {
        const k = t / 0.45;
        g.strokeStyle = `rgba(0,255,209,${((1 - k) * (0.35 + p01 * 0.5)).toFixed(3)})`;
        g.lineWidth = (3 + p01 * 5) * dpr;
        g.beginPath();
        g.arc(sx, sy, (30 + k * (90 + p01 * 160)) * dpr, 0, Math.PI * 2);
        g.stroke();
      }
      for (const p of parts) {
        let px, py, tx, ty, a;
        if (inward) {
          const k = Math.max(0, Math.min(1, (t - p.delay) / (1 - p.delay)));
          const e = k * k * (3 - 2 * k);
          const r = p.r0 * (1 - e);
          const ang = p.ang + p.spin * e;
          px = sx + Math.cos(ang) * r; py = sy + Math.sin(ang) * r;
          const r2 = p.r0 * (1 - Math.max(0, e - 0.08));
          const ang2 = p.ang + p.spin * Math.max(0, e - 0.08);
          tx = sx + Math.cos(ang2) * r2; ty = sy + Math.sin(ang2) * r2;
          a = k <= 0 ? 0 : Math.min(1, k * 4) * (1 - Math.max(0, (k - 0.85) / 0.15));
        } else {
          const e = 1 - (1 - t) * (1 - t); // ease-out travel
          const d = p.sp * (durationMs / 1000) * 0.55 * e;
          px = sx + Math.cos(p.ang) * d; py = sy + Math.sin(p.ang) * d + 60 * dpr * t * t;
          const tail = (18 + p01 * 26) * dpr * (1 - t);
          tx = px - Math.cos(p.ang) * tail; ty = py - Math.sin(p.ang) * tail;
          a = 1 - t;
        }
        if (a <= 0) continue;
        g.strokeStyle = p.tone > 0.8 ? `rgba(235,255,250,${a.toFixed(3)})`
          : p.tone > 0.4 ? `rgba(0,255,209,${a.toFixed(3)})` : `rgba(90,220,255,${a.toFixed(3)})`;
        g.lineWidth = p.w;
        g.beginPath();
        g.moveTo(tx, ty);
        g.lineTo(px, py);
        g.stroke();
      }
      g.globalCompositeOperation = "source-over";
    }, () => c.remove());
  }

  // ── Decrypted text reveal (scramble → settle), for titles ────────────────────────────────────
  const SCRAMBLE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&@$";
  function decryptText(el, { durationMs = 700 } = {}) {
    if (!el || reduceMotion()) return;
    // Mid-reveal the element holds scrambled text, so reuse the stored target; otherwise read fresh
    // (titles change text between menus).
    const target = el.dataset.fxBusy === "1" ? el.dataset.fxText : el.textContent;
    el.dataset.fxText = target;
    el.dataset.fxBusy = "1";
    const t0 = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - t0) / durationMs);
      const settled = Math.floor(target.length * t);
      let out = "";
      for (let i = 0; i < target.length; i++) {
        const ch = target[i];
        out += i < settled || ch === " " ? ch : SCRAMBLE[(Math.random() * SCRAMBLE.length) | 0];
      }
      el.textContent = out;
      if (t < 1) requestAnimationFrame(tick);
      else { el.textContent = target; el.dataset.fxBusy = "0"; }
    };
    requestAnimationFrame(tick);
  }

  // zIndex 25 = just above #galaxyView (fixed, z 20) so a level-start warp shows over the playfield;
  // the FX Lab passes a higher zIndex to preview above its own panel.
  window.polyFx = { playTunnel, playStreaks, playNuclearConfetti, playTealBurst, decryptText };
})();
