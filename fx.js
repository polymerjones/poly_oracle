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
        step(t, Math.min(0.05, (now - last) / 1000));
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
  function playTunnel({ durationMs = 1200, tint = [0.0, 1.0, 0.82], zIndex = 25 } = {}) {
    if (reduceMotion()) return Promise.resolve();
    const { c } = mountCanvas(zIndex);
    const gl = c.getContext("webgl", { premultipliedAlpha: false, antialias: false, alpha: true });
    if (!gl) { c.remove(); return playStreaks({ durationMs, zIndex }); }
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}"));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, TUNNEL_FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { c.remove(); return playStreaks({ durationMs, zIndex }); }
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
    return runFor(durationMs, (t, dt) => {
      time += dt;
      const fade = t < 0.15 ? t / 0.15 : t > 0.7 ? (1 - t) / 0.3 : 1;
      gl.viewport(0, 0, c.width, c.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(uTime, time);
      gl.uniform1f(uFade, fade);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }, () => {
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      c.remove();
    });
  }

  // ── Level warp: STREAKS (canvas 2D star-streak burst; cheaper fallback) ──────────────────────
  function playStreaks({ durationMs = 1100, color = "180,255,240", zIndex = 25 } = {}) {
    if (reduceMotion()) return Promise.resolve();
    const { c, dpr } = mountCanvas(zIndex);
    const x = c.getContext("2d");
    const W = c.width, H = c.height, cx = W / 2, cy = H * 0.45;
    const stars = Array.from({ length: 140 }, () => ({ a: Math.random() * Math.PI * 2, d: Math.random() * 40 * dpr, v: (300 + Math.random() * 900) * dpr }));
    return runFor(durationMs, (t, dt) => {
      const fade = t < 0.12 ? t / 0.12 : t > 0.65 ? (1 - t) / 0.35 : 1;
      x.clearRect(0, 0, W, H);
      x.lineCap = "round";
      x.beginPath();
      for (const s of stars) {
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
    }, () => c.remove());
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
  window.polyFx = { playTunnel, playStreaks, playNuclearConfetti, decryptText };
})();
