import * as PIXI from './vendor/pixi.min.js';

const pixiRenderer = (() => {
  let app = null;
  let initPromise = null;
  let legacyCanvas = null;
  let nativeMode = false;
  let _width = 0;
  let _height = 0;

  let starContainer = null;
  let asteroidContainer = null;
  let ufoContainer = null;
  let particleContainer = null;
  let laserContainer = null;
  let warpRingContainer = null;
  let lightningRingContainer = null;
  let plasmaContainer = null;
  let bombContainer = null;
  let landmineContainer = null;
  let debrisContainer = null;
  let shrapnelContainer = null;
  let flashContainer = null;

  const asteroidSprites = new Map();
  const particleSprites = new Map();
  const asteroidSpritePool = [];
  const particleSpritePool = [];
  const _ufoGlowPool = [];
  const _activeUfoGlows = new Map();

  const textures = {};

  // 2026-06-23: build the L14 neon asteroid skin as a PIXI canvas texture (no file asset exists —
  // it's code-generated). Loads roid01.png, applies the same tritone luminance gradient map used by
  // buildNeonAsteroidSprite() in script.js, and wraps the canvas in a texture. Returns null on any
  // failure (e.g. tainted canvas) so the caller falls back to the silver roid01 sprite.
  // 2026-06-24: generalized from the single neon builder so every code-baked stroid skin (L3 Blue
  // Moon, L8 ice, L12 purple/grey, L14 neon) is produced the identical way on the PIXI/iOS path.
  // shadow/mid/hi are the tritone luminance ramp stops; MUST match buildTintedAsteroidSprite() in
  // script.js so the device and 2D-canvas paths render the same colors.
  function buildTintedAsteroidTexture(shadow, mid, hi, baseSrc = 'astgfx/roid01.png') {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const w = img.naturalWidth;
          const h = img.naturalHeight;
          if (!w || !h) return resolve(null);
          const cv = document.createElement('canvas');
          cv.width = w;
          cv.height = h;
          const c = cv.getContext('2d');
          if (!c) return resolve(null);
          c.drawImage(img, 0, 0);
          let data;
          try { data = c.getImageData(0, 0, w, h); } catch { return resolve(null); }
          const px = data.data;
          for (let i = 0; i < px.length; i += 4) {
            if (px[i + 3] === 0) continue;
            const L = (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) / 255;
            let a0; let a1; let t;
            if (L < 0.5) { a0 = shadow; a1 = mid; t = L / 0.5; }
            else { a0 = mid; a1 = hi; t = (L - 0.5) / 0.5; }
            px[i] = a0[0] + (a1[0] - a0[0]) * t;
            px[i + 1] = a0[1] + (a1[1] - a0[1]) * t;
            px[i + 2] = a0[2] + (a1[2] - a0[2]) * t;
          }
          c.putImageData(data, 0, 0);
          resolve(PIXI.Texture.from(cv));
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = baseSrc;
    });
  }

  let flashFilter = null;
  let flashAlpha = 0;
  let _plasmaBorderFlash = 0;

  let starGraphics = null;
  let starsSeeded = false;
  let starFrame = 0;

  const laserPool = [];
  const activeLasers = new Map();

  const warpRingPool = [];
  const activeWarpRings = new Map();
  const lightningRingPool = [];
  const activeLightningRings = new Map();
  const debrisPool = [];
  const activeBombs = [];
  const activeDebris = [];
  let ufoDisplay = null;
  let ufoFallback = null;
  let ufoGlowFallback = null;
  let plasmaGraphics = null;
  let bombGraphics = null;
  let landmineGraphics = null;
  let glowTexture = null;

  function createGlowTexture(rendererApp, size = 32) {
    const g = new PIXI.Graphics();
    g.beginFill(0xffffff, 0.08);
    g.drawCircle(size / 2, size / 2, size / 2);
    g.endFill();
    g.beginFill(0xffffff, 0.25);
    g.drawCircle(size / 2, size / 2, (size / 2) * 0.65);
    g.endFill();
    g.beginFill(0xffffff, 0.9);
    g.drawCircle(size / 2, size / 2, (size / 2) * 0.3);
    g.endFill();
    const rt = PIXI.RenderTexture.create({
      width: size,
      height: size,
    });
    rendererApp.renderer.render(g, { renderTexture: rt });
    g.destroy();
    return rt;
  }

  async function init(mountEl, width, height, isNative) {
    if (app) return app;
    if (initPromise) return initPromise;
    nativeMode = !!isNative;
    _width = width;
    _height = height;

    initPromise = (async () => {
      app = new PIXI.Application({
        width,
        height,
        backgroundAlpha: 0,
        backgroundColor: 0x000000,
        antialias: !nativeMode,
        resolution: nativeMode ? 1 : Math.min(2, window.devicePixelRatio || 1),
        autoDensity: true,
        powerPreference: 'high-performance',
        hello: false,
      });

      legacyCanvas = document.getElementById('galaxyPlayCanvas');
      if (legacyCanvas && legacyCanvas.parentNode) {
        legacyCanvas.parentNode.insertBefore(app.view, legacyCanvas);
        legacyCanvas.style.opacity = '0';
      } else if (mountEl) {
        mountEl.appendChild(app.view);
      }

      app.view.id = 'pixiGameCanvas';
      app.view.style.position = legacyCanvas?.style.position || 'absolute';
      app.view.style.inset = 'auto';
      app.view.style.left = legacyCanvas?.style.left || '0px';
      app.view.style.top = legacyCanvas?.style.top || '0px';
      app.view.style.width = legacyCanvas?.style.width || `${width}px`;
      app.view.style.height = legacyCanvas?.style.height || `${height}px`;
      app.view.style.pointerEvents = 'none';
      app.view.style.background = 'transparent';
      app.view.style.zIndex = '1';
      app.view.setAttribute('aria-hidden', 'true');
      app.renderer.background.alpha = 0;

      app.ticker.stop();
      glowTexture = createGlowTexture(app, 32);

      const spriteKeys = {
        roid01: 'astgfx/roid01.png',
        roid02: 'astgfx/roid02.png',
        roid03: 'astgfx/roid03.png',
        hotroid01: 'astgfx/hotroid01.png',
        debris: 'astgfx/debris_silver.png',
        debris_ice: 'astgfx/debris_ice.png',
        debris_redhot: 'astgfx/debris_redhot.png',
      };
      await Promise.all(
        Object.entries(spriteKeys).map(async ([key, src]) => {
          try {
            textures[key] = await PIXI.Assets.load(src);
          } catch {
            textures[key] = PIXI.Texture.WHITE;
          }
        }),
      );
      // 2026-07-02: there is no ufo.png asset — the UFO is drawn procedurally (see the null-texture
      // branch below, ufoFallback graphics). Attempting the load only guaranteed a 404 every session
      // (and cluttered the Web Inspector console during profiling). Skip it; leave textures.ufo null.
      textures.ufo = null;

      // 2026-06-23/24: code-generated skins (no file asset) baked here as canvas textures so the
      // iPad/PIXI path shows them — without this the renderer falls back to textures.roid01 (silver).
      // Ramp stops MUST match buildGeneratedAsteroidSprites() in script.js (device + 2D paths in sync).
      const [_neon, _bluemoon, _ice, _purplegrey] = await Promise.all([
        buildTintedAsteroidTexture([4, 0, 10], [57, 255, 20], [168, 70, 255]).catch(() => null),        // L14 neon
        buildTintedAsteroidTexture([3, 10, 38], [28, 96, 235], [188, 222, 255]).catch(() => null),      // L3 Blue Moon (vivid electric blue)
        buildTintedAsteroidTexture([4, 28, 64], [40, 196, 230], [226, 250, 255], 'astgfx/roid03.png').catch(() => null), // L8 ice on roid03
        buildTintedAsteroidTexture([26, 4, 52], [168, 56, 214], [236, 214, 248]).catch(() => null),     // L12 magenta-purple
      ]);
      textures.roidneon = _neon || textures.roid01;
      textures.roidbluemoon = _bluemoon || textures.roid01;
      textures.roidice = _ice || textures.roid01;
      textures.roidpurplegrey = _purplegrey || textures.roid01;

      starContainer = new PIXI.Graphics();
      warpRingContainer = new PIXI.Container();
      lightningRingContainer = new PIXI.Container();
      asteroidContainer = new PIXI.Container();
      ufoContainer = new PIXI.Container();
      particleContainer = new PIXI.ParticleContainer(400, {
        position: true,
        rotation: false,
        uvs: false,
        alpha: true,
        scale: true,
        tint: true,
      });
      particleContainer.blendMode = PIXI.BLEND_MODES.ADD;
      laserContainer = new PIXI.Container();
      plasmaContainer = new PIXI.Container();
      bombContainer = new PIXI.Container();
      landmineContainer = new PIXI.Container();
      debrisContainer = new PIXI.ParticleContainer(80, {
        position: true,
        rotation: true,
        alpha: true,
        scale: true,
        tint: true,
      });
      shrapnelContainer = new PIXI.Container();
      flashContainer = new PIXI.Container();

      app.stage.addChild(starContainer);
      app.stage.addChild(warpRingContainer);
      app.stage.addChild(lightningRingContainer);
      app.stage.addChild(asteroidContainer);
      app.stage.addChild(ufoContainer);
      app.stage.addChild(particleContainer);
      app.stage.addChild(laserContainer);
      app.stage.addChild(plasmaContainer);
      app.stage.addChild(bombContainer);
      app.stage.addChild(landmineContainer);
      app.stage.addChild(debrisContainer);
      app.stage.addChild(shrapnelContainer);
      app.stage.addChild(flashContainer);
      starGraphics = starContainer;
      plasmaGraphics = new PIXI.Graphics();
      plasmaContainer.addChild(plasmaGraphics);
      bombGraphics = new PIXI.Graphics();
      bombGraphics.blendMode = PIXI.BLEND_MODES.ADD; // 2026-06-14: firey explosion (was a black implosion)
      bombContainer.addChild(bombGraphics);
      landmineGraphics = new PIXI.Graphics();
      landmineContainer.addChild(landmineGraphics);

      if (textures.ufo) {
        ufoDisplay = new PIXI.Sprite(textures.ufo);
        ufoDisplay.anchor.set(0.5);
      } else {
        ufoDisplay = new PIXI.Container();
        ufoGlowFallback = new PIXI.Graphics();
        ufoFallback = new PIXI.Graphics();
        ufoDisplay.addChild(ufoGlowFallback, ufoFallback);
      }
      ufoDisplay.visible = false;
      ufoContainer.addChild(ufoDisplay);

      const flashRect = new PIXI.Graphics();
      flashRect.beginFill(0xffffff);
      flashRect.drawRect(0, 0, width, height);
      flashRect.endFill();
      flashRect.alpha = 0;
      flashRect.blendMode = PIXI.BLEND_MODES.SCREEN;
      flashContainer.addChild(flashRect);
      flashContainer._rect = flashRect;
      flashFilter = null;
      flashAlpha = 0;

      starsSeeded = false;
      return app;
    })();

    return initPromise;
  }

  function drawStars(stars, now, prefersReducedMotion, frameBudgetExceeded) {
    if (!app || frameBudgetExceeded) return;
    if (!starGraphics) {
      starGraphics = new PIXI.Graphics();
      app.stage.addChildAt(starGraphics, 0);
    }
    starFrame = (starFrame + 1) & 3;
    if (!starsSeeded || starFrame === 0) {
      starGraphics.clear();
      for (let i = 0; i < stars.length; i += 1) {
        const s = stars[i];
        const twinkle = prefersReducedMotion ? 0 : Math.sin(now * 0.001 * s.twinkleSpeed + s.phase) * 0.2;
        const alpha = Math.max(0.08, Math.min(0.9, s.baseAlpha + twinkle));
        starGraphics.beginFill(0xd6e3ff, alpha);
        starGraphics.drawCircle(s.x, s.y, s.r);
        starGraphics.endFill();
      }
      starsSeeded = true;
    }
  }

  function syncAsteroids(asteroids) {
    if (!asteroidContainer) return;
    const seen = new Set();

    for (let i = 0; i < asteroids.length; i += 1) {
      const a = asteroids[i];
      seen.add(a);

      let sprite = asteroidSprites.get(a);
      if (!sprite) {
        sprite = asteroidSpritePool.pop() || new PIXI.Sprite();
        sprite.anchor.set(0.5);
        asteroidContainer.addChild(sprite);
        asteroidSprites.set(a, sprite);
      }

      const texKey = a.spriteKey || 'roid01';
      const tex = textures[texKey] || textures.roid01 || PIXI.Texture.WHITE;
      if (sprite.texture !== tex) sprite.texture = tex;

      sprite.x = a.x;
      sprite.y = a.y;
      sprite.rotation = a.rot || 0;
      sprite.width = a.r * 2;
      sprite.height = a.r * 2;
      sprite.visible = true;

      if (a._ufoBlasted) {
        const now = performance.now();
        const age = now - a._ufoBlasted;
        const duration = a._ufoBlastedDuration || 4000;
        if (age > duration) {
          delete a._ufoBlasted;
          delete a._ufoBlastedDuration;
          delete a._ufoBlastOriginX;
          delete a._ufoBlastOriginY;
          delete a._ufoBlastIntensity;
        } else {
          const progress = age / duration;
          const pulseSpeed = 6 - progress * 3;
          const pulse = (Math.sin(now * 0.001 * pulseSpeed) + 1) * 0.5;
          const baseAlpha = progress < 0.2 ? 1 : 1 - ((progress - 0.2) / 0.8);
          const glowAlpha = baseAlpha * (0.5 + pulse * 0.5);

          const dx = a.x - (a._ufoBlastOriginX || a.x);
          const dy = a.y - (a._ufoBlastOriginY || a.y);
          const splatAngle = Math.atan2(-dy, -dx);
          const spread = Math.PI * 0.7;
          const arcStart = splatAngle - spread / 2;
          const arcEnd = splatAngle + spread / 2;

          let glowG = _activeUfoGlows.get(a);
          if (!glowG) {
            glowG = _ufoGlowPool.pop() || new PIXI.Graphics();
            _activeUfoGlows.set(a, glowG);
          }
          if (!glowG.parent) {
            asteroidContainer.addChild(glowG);
          }
          glowG.clear();

          const wobble = Math.sin(now * 0.003) * 1.5;

          glowG.lineStyle(12 + pulse * 8, 0x00ffd1, glowAlpha * 0.45);
          glowG.arc(a.x, a.y, a.r + 8 + wobble, arcStart, arcEnd);

          glowG.lineStyle(3.5, 0x00ffcc, glowAlpha * 0.95);
          glowG.arc(a.x, a.y, a.r + 3, arcStart + 0.05, arcEnd - 0.05);

          glowG.lineStyle(1.2, 0xeeffff, glowAlpha * 1.0);
          glowG.arc(a.x, a.y, a.r + 1.5, arcStart + 0.1, arcEnd - 0.1);

          [-1, 1].forEach((side) => {
            const blobAngle = side > 0 ? arcEnd : arcStart;
            const blobX = a.x + Math.cos(blobAngle) * (a.r + 4);
            const blobY = a.y + Math.sin(blobAngle) * (a.r + 4);
            const blobSize = (3 + pulse * 4) * glowAlpha;
            glowG.beginFill(0x00ffd1, glowAlpha * 0.8);
            glowG.drawCircle(blobX, blobY, blobSize);
            glowG.endFill();
            glowG.beginFill(0xeeffff, glowAlpha * 0.95);
            glowG.drawCircle(blobX, blobY, blobSize * 0.5);
            glowG.endFill();
          });

          const midX = a.x + Math.cos(splatAngle) * (a.r + 8 + pulse * 4);
          const midY = a.y + Math.sin(splatAngle) * (a.r + 8 + pulse * 4);
          glowG.beginFill(0x00ffee, glowAlpha * (0.6 + pulse * 0.4));
          glowG.drawCircle(midX, midY, 2.5 + pulse * 4);
          glowG.endFill();
          glowG.beginFill(0xffffff, glowAlpha * (0.4 + pulse * 0.5));
          glowG.drawCircle(midX, midY, 1.5 + pulse * 2);
          glowG.endFill();
        }
      }
    }

    for (const [asteroid, g] of _activeUfoGlows) {
      if (!asteroid._ufoBlasted || !seen.has(asteroid)) {
        g.clear();
        if (g.parent) g.parent.removeChild(g);
        _ufoGlowPool.push(g);
        _activeUfoGlows.delete(asteroid);
      }
    }

    for (const [a, sprite] of asteroidSprites) {
      if (!seen.has(a)) {
        sprite.visible = false;
        asteroidContainer.removeChild(sprite);
        asteroidSpritePool.push(sprite);
        asteroidSprites.delete(a);
      }
    }
  }

  function syncParticles(particles) {
    if (!particleContainer) return;
    const seen = new Set();

    for (let i = 0; i < particles.length; i += 1) {
      const p = particles[i];
      seen.add(p);

      let sprite = particleSprites.get(p);
      if (!sprite) {
        sprite = particleSpritePool.pop() || new PIXI.Sprite(glowTexture || PIXI.Texture.WHITE);
        if (glowTexture) sprite.texture = glowTexture;
        sprite.anchor.set(0.5);
        particleContainer.addChild(sprite);
        particleSprites.set(p, sprite);
      }

      const lifeRatio = 1 - p.life / p.ttl;
      const alpha = Math.max(0, (1 - lifeRatio * lifeRatio) * p.alpha);
      sprite.alpha = alpha;
      sprite.x = p.x;
      sprite.y = p.y;

      const scale = (p.size / 16) * (0.4 + lifeRatio * 0.6);
      sprite.scale.set(scale);

      if (p._pixiTint == null) {
        p._pixiTint = parseRgbaTint(p.color) || 0x6fff80;
      }
      sprite.tint = p._pixiTint;
      sprite.visible = alpha > 0.01;
    }

    for (const [p, sprite] of particleSprites) {
      if (!seen.has(p)) {
        sprite.visible = false;
        sprite.alpha = 0;
        particleSpritePool.push(sprite);
        particleSprites.delete(p);
      }
    }
  }

  function syncLasers(laserBeams, now) {
    if (!laserContainer) return;
    const seen = new Set();

    for (let i = 0; i < laserBeams.length; i += 1) {
      const beam = laserBeams[i];
      seen.add(beam);

      let g = activeLasers.get(beam);
      if (g) {
        const t = Math.max(0, Math.min(1, (now - beam.startedAt) / 150));
        g.alpha = 1 - t;
        g.visible = true;
        continue;
      }

      g = laserPool.pop() || new PIXI.Graphics();
      laserContainer.addChild(g);
      activeLasers.set(beam, g);
      g.alpha = 1;
      g.clear();
      g.lineStyle(2, 0x00ffd1, 0.92);
      g.moveTo(beam.x1, beam.y1);
      g.lineTo(beam.x2, beam.y2);
      g.lineStyle(6, 0x00ffd1, 0.18);
      g.moveTo(beam.x1, beam.y1);
      g.lineTo(beam.x2, beam.y2);
      g.visible = true;
    }

    for (const [beam, g] of activeLasers) {
      if (!seen.has(beam)) {
        g.clear();
        g.alpha = 1;
        g.visible = false;
        laserPool.push(g);
        activeLasers.delete(beam);
      }
    }
  }

  function syncWarpRings(warpRings, frameBudgetExceeded) {
    if (!warpRingContainer) return;
    if (frameBudgetExceeded) {
      warpRingContainer.visible = false;
      return;
    }
    warpRingContainer.visible = true;
    const seen = new Set();

    for (let i = 0; i < warpRings.length; i += 1) {
      const ring = warpRings[i];
      seen.add(ring);

      let g = activeWarpRings.get(ring);
      if (!g) {
        g = warpRingPool.pop() || new PIXI.Graphics();
        warpRingContainer.addChild(g);
        activeWarpRings.set(ring, g);
      }

      const t = ring.life / ring.ttl;
      const radius = ring.baseR + (ring.maxR - ring.baseR) * t;
      const alpha = ring.alpha * (1 - t);
      const color = parseRgbaTint(ring.color) || 0x70ffb2;

      g.clear();
      g.lineStyle(1.8, color, Math.max(0, alpha));
      g.drawCircle(ring.x, ring.y, radius);
      g.visible = true;
    }

    for (const [ring, g] of activeWarpRings) {
      if (!seen.has(ring)) {
        g.clear();
        g.visible = false;
        warpRingPool.push(g);
        activeWarpRings.delete(ring);
      }
    }
  }

  function triggerShockwave(x, y, color, size) {
    if (!app || !warpRingContainer) return;
    const g = warpRingPool.pop() || new PIXI.Graphics();
    warpRingContainer.addChild(g);

    const startTime = performance.now();
    const duration = 280;
    const maxR = size || 40;
    const tint = color || 0x00ffd1;

    const tick = () => {
      const age = performance.now() - startTime;
      const t = Math.min(1, age / duration);
      if (t >= 1) {
        g.clear();
        g.visible = false;
        warpRingPool.push(g);
        app.ticker.remove(tick);
        return;
      }
      const r = maxR * t;
      const alpha = (1 - t) * 0.85;
      g.clear();
      g.lineStyle(2.5, tint, alpha);
      g.drawCircle(x, y, r);
      g.lineStyle(1, 0xffffff, alpha * 0.5);
      g.drawCircle(x, y, r * 0.7);
      g.visible = true;
    };
    app.ticker.add(tick);
  }

  function syncLightningRings(lightningRings, frameBudgetExceeded) {
    if (!lightningRingContainer) return;
    if (frameBudgetExceeded) {
      lightningRingContainer.visible = false;
      return;
    }
    lightningRingContainer.visible = true;
    const seen = new Set();

    for (let i = 0; i < lightningRings.length; i += 1) {
      const ring = lightningRings[i];
      seen.add(ring);

      let g = activeLightningRings.get(ring);
      if (!g) {
        g = lightningRingPool.pop() || new PIXI.Graphics();
        lightningRingContainer.addChild(g);
        activeLightningRings.set(ring, g);
      }

      const t = Math.max(0, Math.min(1, ring.life / ring.ttl));
      const radius = ring.baseR + (ring.maxR - ring.baseR) * t;
      const alpha = Math.max(0, (ring.alpha || 1) * (1 - t));
      const points = Math.max(18, ring.segments || 28);
      const jitter = (ring.jitter || 10) * (1 - t);
      const colorA = parseRgbaTint(ring.colorA || ring.color || 'rgba(0,255,209,1)');
      const colorB = parseRgbaTint(ring.colorB || 'rgba(255,255,255,1)');

      g.clear();
      for (let pass = 0; pass < 2; pass += 1) {
        const color = pass === 0 ? colorA : colorB;
        const width = pass === 0 ? 2.2 : 1;
        const passAlpha = pass === 0 ? alpha * 0.85 : alpha * 0.45;
        g.lineStyle(width, color, passAlpha);
        for (let p = 0; p <= points; p += 1) {
          const angle = (p / points) * Math.PI * 2;
          const seed = Math.sin(angle * 11 + ring.x * 0.03 + ring.life * 0.04) * Math.cos(angle * 7 + ring.y * 0.02);
          const r = radius + seed * jitter;
          const x = ring.x + Math.cos(angle) * r;
          const y = ring.y + Math.sin(angle) * r;
          if (p === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
      }
      g.visible = true;
    }

    for (const [ring, g] of activeLightningRings) {
      if (!seen.has(ring)) {
        g.clear();
        g.visible = false;
        lightningRingPool.push(g);
        activeLightningRings.delete(ring);
      }
    }
  }

  function syncUFO(ufoState) {
    if (!ufoDisplay) return;
    if (!ufoState || !ufoState.alive) {
      ufoDisplay.visible = false;
      return;
    }
    const now = performance.now();
    const damaged = ufoState.hitCount >= 1;
    ufoDisplay.visible = true;
    ufoDisplay.x = ufoState.x + (damaged ? Math.sin(now / 28) * 1.8 : 0);
    ufoDisplay.y = ufoState.y + (damaged ? Math.cos(now / 24) * 1.5 : 0);
    ufoDisplay.rotation = Math.sin((ufoState.x + ufoState.y) * 0.01) * 0.04;
    ufoDisplay.alpha = 0.9 + Math.sin(now * 0.008) * 0.08;
    if (textures.ufo && ufoDisplay instanceof PIXI.Sprite) {
      const r = ufoState.r || 24;
      ufoDisplay.width = r * 3.2;
      ufoDisplay.height = r * 1.8;
    } else if (ufoFallback) {
      drawUFOGraphics(ufoFallback, ufoGlowFallback, ufoState.r || 24, damaged);
    }
  }

  function drawUFOGraphics(g, glowG, r, damaged) {
    g.clear();
    if (glowG) glowG.clear();
    const glowColor = damaged ? 0xff6060 : 0x86ffb0;
    const strokeColor = damaged ? 0xff7c7c : 0x9cffc2;
    const bodyColor = damaged ? 0xff6060 : 0x9aebff;

    const BlurFilter = PIXI.filters?.BlurFilter || PIXI.BlurFilter;
    if (glowG && BlurFilter) {
      glowG.beginFill(glowColor, 0.12);
      glowG.drawCircle(0, 0, r * 2.15);
      glowG.endFill();
      if (!glowG.filters || glowG.filters.length === 0) {
        glowG.filters = [new BlurFilter(10)];
      }
    } else {
      g.beginFill(glowColor, 0.08);
      g.drawCircle(0, 0, r * 2.55);
      g.endFill();
      g.beginFill(glowColor, 0.14);
      g.drawCircle(0, 0, r * 1.35);
      g.endFill();
    }

    g.lineStyle(1.4, strokeColor, damaged ? 0.55 : 0.58);
    g.drawEllipse(0, 0, r * 1.32, r * 0.72);

    g.beginFill(bodyColor, damaged ? 0.94 : 0.92);
    g.drawEllipse(0, 0, r * 1.1, r * 0.55);
    g.endFill();

    g.beginFill(0x242a48, 0.86);
    g.drawEllipse(0, -r * 0.22, r * 0.52, r * 0.28);
    g.endFill();
  }

  function getPlasmaRect(plasmaCage) {
    if (!plasmaCage) return null;
    const x1 = plasmaCage.startX;
    const y1 = plasmaCage.startY;
    const x2 = plasmaCage.currentX;
    const y2 = plasmaCage.currentY;
    if (![x1, y1, x2, y2].every(Number.isFinite)) return null;
    return {
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      w: Math.abs(x2 - x1),
      h: Math.abs(y2 - y1),
    };
  }

  function drawDashedRect(g, x, y, w, h, dashLen, gapLen, offset, lineW, color, alpha) {
    if (w <= 0 || h <= 0 || alpha <= 0) return;
    g.lineStyle(lineW, color, alpha);
    const dashCycle = dashLen + gapLen;
    let dist = ((offset % dashCycle) + dashCycle) % dashCycle;
    const sides = [
      { dx: 1, dy: 0, len: w, sx: x, sy: y },
      { dx: 0, dy: 1, len: h, sx: x + w, sy: y },
      { dx: -1, dy: 0, len: w, sx: x + w, sy: y + h },
      { dx: 0, dy: -1, len: h, sx: x, sy: y + h },
    ];
    for (let s = 0; s < sides.length; s += 1) {
      const side = sides[s];
      let pos = 0;
      while (pos < side.len) {
        const cyclePos = dist % dashCycle;
        const inDash = cyclePos < dashLen;
        const segEnd = Math.min(side.len, pos + (dashCycle - cyclePos));
        if (inDash) {
          g.moveTo(side.sx + side.dx * pos, side.sy + side.dy * pos);
          g.lineTo(side.sx + side.dx * segEnd, side.sy + side.dy * segEnd);
        }
        dist += segEnd - pos;
        pos = segEnd;
      }
    }
  }

  function drawPlasmaGridPixi(g, x, y, w, h, alpha) {
    if (w < 2 || h < 2 || alpha <= 0) return;
    g.lineStyle(1, 0x00ffd1, alpha);
    const spacing = 18;
    const startX = x - ((x % spacing) + spacing);
    const startY = y - ((y % spacing) + spacing);
    for (let lx = startX; lx <= x + w + spacing; lx += spacing) {
      if (lx < x || lx > x + w) continue;
      g.moveTo(lx, y);
      g.lineTo(lx, y + h);
    }
    for (let ly = startY; ly <= y + h + spacing; ly += spacing) {
      if (ly < y || ly > y + h) continue;
      g.moveTo(x, ly);
      g.lineTo(x + w, ly);
    }
  }

  function drawPlasmaCornerBrackets(g, x, y, w, h, now, progress, charged, alpha) {
    const corner = Math.max(12, Math.min(34, Math.min(w, h) * 0.28));
    const bracketAlpha = charged
      ? alpha * (0.7 + 0.3 * Math.sin(now / 70))
      : alpha * (0.42 + progress * 0.58);
    const bracketW = charged ? 3 : 2;
    const color = charged ? 0xdcfff0 : 0x00ffd1;
    const x2 = x + w;
    const y2 = y + h;
    const segs = [
      [x, y, x + corner, y],
      [x, y, x, y + corner],
      [x2, y, x2 - corner, y],
      [x2, y, x2, y + corner],
      [x, y2, x + corner, y2],
      [x, y2, x, y2 - corner],
      [x2, y2, x2 - corner, y2],
      [x2, y2, x2, y2 - corner],
    ];
    g.lineStyle(bracketW, color, bracketAlpha);
    for (let i = 0; i < segs.length; i += 1) {
      g.moveTo(segs[i][0], segs[i][1]);
      g.lineTo(segs[i][2], segs[i][3]);
    }
  }

  function drawPlasmaCageRectPixi(g, rect, now, progress, charged, alpha = 1) {
    if (!rect || rect.w < 2 || rect.h < 2) return;
    const { x, y, w, h } = rect;
    const flashBoost = _plasmaBorderFlash;
    const borderAlpha = Math.max(0.2, Math.min(1, alpha * (0.22 + progress * 0.78) + flashBoost * 0.15));
    const color = flashBoost > 0.1 ? 0xffffff : charged ? 0xdcfff0 : 0x00ffd1;
    const borderWidth = charged ? 2.4 : 1.4 + progress * 1.2;
    const gridAlpha = (charged ? 0.18 : 0.08 + progress * 0.25) * alpha;
    drawPlasmaGridPixi(g, x, y, w, h, gridAlpha);
    drawDashedRect(
      g,
      x,
      y,
      w,
      h,
      10,
      8,
      -(now / 32) % 18,
      borderWidth + flashBoost * 4,
      color,
      borderAlpha,
    );
    drawPlasmaCornerBrackets(g, x, y, w, h, now, progress, charged, alpha);
  }

  function drawPlasmaLayer(plasmaCage, asteroids, now) {
    if (!plasmaGraphics) return;
    plasmaGraphics.clear();
    if (_plasmaBorderFlash > 0) {
      _plasmaBorderFlash = Math.max(0, _plasmaBorderFlash - 0.06);
    }

    const fx = plasmaCage?.releaseFx;
    if (fx) {
      const t = Math.max(0, Math.min(1, (now - fx.start) / fx.ttl));
      if (t >= 1) {
        plasmaCage.releaseFx = null;
      } else {
        const fade = 1 - t;
        if (fx.type === 'fire') {
          drawPlasmaCageRectPixi(plasmaGraphics, fx, now, 1, true, fade);
          plasmaGraphics.beginFill(0xffffff, fade * 0.5);
          plasmaGraphics.drawRect(fx.x, fx.y, fx.w, fx.h);
          plasmaGraphics.endFill();
        } else {
          drawPlasmaCageRectPixi(plasmaGraphics, fx, now, 0.25, false, fade);
        }
      }
    }

    drawPlasmaRecharge(plasmaCage, now);
    if (!plasmaCage?.active) return;
    const rect = getPlasmaRect(plasmaCage);
    if (!rect || rect.w < 2 || rect.h < 2) return;

    const isReady = plasmaCage.charged === true || (now - (plasmaCage.chargeStart || 0)) >= 1000;
    const progress = isReady ? 1 : Math.max(0, Math.min(1, (now - (plasmaCage.chargeStart || now)) / 1000));
    drawPlasmaCageRectPixi(plasmaGraphics, rect, now, progress, isReady, 1);

    if (!isReady) return;
    for (let i = 0; i < asteroids.length; i += 1) {
      const a = asteroids[i];
      if (a.x < rect.x || a.x > rect.x + rect.w || a.y < rect.y || a.y > rect.y + rect.h) continue;
      const r = Math.max(8, a.r + 5 + Math.sin(now * 0.008 + i) * 2);
      plasmaGraphics.lineStyle(7, 0x00ffd1, 0.24);
      plasmaGraphics.drawCircle(a.x, a.y, r);
      plasmaGraphics.lineStyle(1.5, 0xffffff, 0.72);
      plasmaGraphics.drawCircle(a.x, a.y, Math.max(5, a.r + 1));
    }
  }

  function drawPlasmaRecharge(plasmaCage, now) {
    if (!plasmaCage || plasmaCage.active) return;
    if (!plasmaCage.cooldownUntil || plasmaCage.cooldownUntil <= now) return;

    const total = plasmaCage.cooldownUntil - (plasmaCage.cooldownStart || 0);
    const remaining = plasmaCage.cooldownUntil - now;
    const progress = Math.max(0, Math.min(1, 1 - remaining / Math.max(1, total)));
    const cx = _width - 28;
    const cy = _height - 28;

    plasmaGraphics.lineStyle(3, 0x004433, 0.4);
    plasmaGraphics.arc(cx, cy, 22, -Math.PI / 2, Math.PI * 1.5, false);
    plasmaGraphics.lineStyle(3, 0x00ffd1, 0.7);
    plasmaGraphics.arc(cx, cy, 22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress, false);
  }

  function drawLandmine(landmine, now) {
    if (!landmineGraphics) return;
    landmineGraphics.clear();
    if (!landmine) return;

    const x = landmine.x;
    const y = landmine.y;
    const r = landmine.r || 14;
    const armed = landmine.phase === 'armed' || landmine.phase === 'player_armed';
    const playerArmed = landmine.phase === 'player_armed';
    const pulseRate = playerArmed ? 80 : armed ? 120 : 400;
    const pulse = Math.abs(Math.sin(now / pulseRate));
    const ringColor = playerArmed ? 0xff0000 : armed ? 0xff4444 : 0x44ff88;

    landmineGraphics.beginFill(0x2a3a2a, 0.92);
    landmineGraphics.drawCircle(x, y, r);
    landmineGraphics.endFill();
    landmineGraphics.beginFill(0x3a5a3a, 0.6);
    landmineGraphics.drawCircle(x - r * 0.35, y - r * 0.35, r * 0.7);
    landmineGraphics.endFill();

    landmineGraphics.lineStyle(1.2, ringColor, 0.55 + pulse * 0.3);
    landmineGraphics.drawCircle(x, y, r);

    landmineGraphics.lineStyle(1.5, playerArmed ? 0xff6666 : armed ? 0xff4444 : 0x66ffaa, 0.7);
    for (let i = 0; i < 8; i += 1) {
      const angle = (i / 8) * Math.PI * 2;
      landmineGraphics.moveTo(
        x + Math.cos(angle) * r,
        y + Math.sin(angle) * r,
      );
      landmineGraphics.lineTo(
        x + Math.cos(angle) * (r + 5),
        y + Math.sin(angle) * (r + 5),
      );
    }

    landmineGraphics.beginFill(playerArmed ? 0xff0000 : armed ? 0xff2222 : 0x44ff88, 0.8 + pulse * 0.2);
    landmineGraphics.drawCircle(
      x + r * 0.35,
      y - r * 0.35,
      armed ? 4 + pulse * 2 : 3 + pulse,
    );
    landmineGraphics.endFill();

    if (playerArmed && landmine.playerArmedAt) {
      const countT = Math.max(0, Math.min(1, (now - landmine.playerArmedAt) / 6000));
      landmineGraphics.lineStyle(2, 0xff2222, 0.7);
      landmineGraphics.arc(
        x,
        y,
        r + 12,
        -Math.PI / 2,
        -Math.PI / 2 + Math.PI * 2 * countT,
      );
    }
  }

  function triggerBombDetonation(x, y, radius) {
    const effectRadius = Number.isFinite(radius) ? radius : 220;
    const visualRadius = Math.min(280, Math.max(80, effectRadius * 0.4));
    activeBombs.push({
      x,
      y,
      visualRadius,
      start: performance.now(),
      flashTriggered: false,
      debrisSpawned: false,
    });
  }

  function triggerPlasmaRectFlash() {
    _plasmaBorderFlash = 1.0;
  }

  function spawnBombDebris(bomb, now) {
    const colors = [0xff6600, 0xffaa00, 0xffffff, 0x00ffd1];
    for (let i = 0; i < 40; i += 1) {
      const sprite = debrisPool.pop() || new PIXI.Sprite(PIXI.Texture.WHITE);
      const angle = Math.random() * Math.PI * 2;
      const speed = 160 + Math.random() * 520;
      const size = 2 + Math.random() * 4;
      sprite.x = bomb.x;
      sprite.y = bomb.y;
      sprite.width = size;
      sprite.height = size;
      sprite.anchor?.set?.(0.5);
      sprite.tint = colors[(Math.random() * colors.length) | 0];
      sprite.alpha = 1;
      sprite.visible = true;
      debrisContainer.addChild(sprite);
      activeDebris.push({
        sprite,
        x: bomb.x,
        y: bomb.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        start: now,
        ttl: 1200,
        spin: (Math.random() - 0.5) * 0.3,
      });
    }
  }

  function updateBombDebris(now) {
    if (!debrisContainer) return;
    for (let i = activeDebris.length - 1; i >= 0; i -= 1) {
      const d = activeDebris[i];
      const t = (now - d.start) / d.ttl;
      if (t >= 1) {
        d.sprite.visible = false;
        debrisContainer.removeChild(d.sprite);
        debrisPool.push(d.sprite);
        activeDebris.splice(i, 1);
        continue;
      }
      const seconds = (now - d.start) / 1000;
      d.sprite.x = d.x + d.vx * seconds;
      d.sprite.y = d.y + d.vy * seconds + 120 * seconds * seconds;
      d.sprite.rotation += d.spin;
      d.sprite.alpha = 1 - t;
    }
  }

  function updateBombEffects(now) {
    if (!bombGraphics) return;
    bombGraphics.clear();

    for (let i = activeBombs.length - 1; i >= 0; i -= 1) {
      const bomb = activeBombs[i];
      const age = now - bomb.start;
      const r = bomb.visualRadius;

      if (age < 420) {
        // 2026-06-14: expanding FIREBALL (additive) — white-hot core → orange → red glow that
        // grows to the blast radius and fades. Replaces the old black-hole implosion.
        const t = age / 420;
        const grow = Math.pow(t, 0.55); // fast out, ease near the end
        const fade = 1 - t;
        const coreR = r * (0.18 + grow * 0.95);
        // outer red/orange glow
        bombGraphics.beginFill(0xff3300, 0.55 * fade);
        bombGraphics.drawCircle(bomb.x, bomb.y, coreR * 1.35);
        bombGraphics.endFill();
        // mid orange body
        bombGraphics.beginFill(0xff7a00, 0.7 * fade);
        bombGraphics.drawCircle(bomb.x, bomb.y, coreR);
        bombGraphics.endFill();
        // hot yellow inner
        bombGraphics.beginFill(0xffcc33, 0.8 * fade);
        bombGraphics.drawCircle(bomb.x, bomb.y, coreR * 0.6);
        bombGraphics.endFill();
        // white-hot center (brightest at the start)
        bombGraphics.beginFill(0xffffff, 0.9 * (1 - grow));
        bombGraphics.drawCircle(bomb.x, bomb.y, coreR * 0.32);
        bombGraphics.endFill();
        // leading shock edge
        bombGraphics.lineStyle(3, 0xffdd88, 0.6 * fade);
        bombGraphics.drawCircle(bomb.x, bomb.y, coreR * 1.4);
        if (!bomb.flashTriggered) {
          bomb.flashTriggered = true;
          flashAlpha = 1.0;
          if (flashContainer?._rect) {
            flashContainer._rect.tint = 0xfff0d0;
            flashContainer._rect.alpha = flashAlpha;
          }
        }
      } else if (age < 1400) {
        const rings = [
          { delay: 0, from: 0.2, to: 2.5, color: 0xff6600, alpha: 0.8 },
          { delay: 80, from: 0.1, to: 2.0, color: 0xffaa00, alpha: 0.6 },
          { delay: 160, from: 0, to: 3.0, color: 0xffffff, alpha: 0.3 },
          { delay: 240, from: 0, to: 3.5, color: 0x4400ff, alpha: 0.25 },
        ];
        for (let j = 0; j < rings.length; j += 1) {
          const ring = rings[j];
          const rt = Math.max(0, Math.min(1, (age - 420 - ring.delay) / (750 - ring.delay)));
          if (rt <= 0 || rt >= 1) continue;
          const rr = r * (ring.from + (ring.to - ring.from) * rt);
          const alpha = ring.alpha * (1 - rt);
          bombGraphics.lineStyle(j === 0 ? 6 : 4, ring.color, alpha);
          bombGraphics.drawCircle(bomb.x, bomb.y, rr);
          bombGraphics.lineStyle(1, ring.color, alpha * 0.45);
          bombGraphics.drawCircle(bomb.x, bomb.y, rr + 10);
        }
      }

      if (age >= 120 && !bomb.debrisSpawned && debrisContainer) {
        bomb.debrisSpawned = true;
        spawnBombDebris(bomb, now);
      }
      if (age >= 1800) activeBombs.splice(i, 1);
    }

    updateBombDebris(now);
  }

  function updateFlash(canvasFlash) {
    if (!flashContainer?._rect) return;
    const rect = flashContainer._rect;
    if (!nativeMode && canvasFlash && canvasFlash.alpha > 0) {
      rect.tint = (canvasFlash.r << 16) | (canvasFlash.g << 8) | canvasFlash.b;
      rect.alpha = canvasFlash.alpha;
      flashAlpha = canvasFlash.alpha;
    } else if (flashAlpha > 0) {
      rect.tint = 0xffffff;
      rect.alpha = flashAlpha;
      flashAlpha = Math.max(0, flashAlpha - 0.12);
    } else {
      rect.alpha = 0;
      flashAlpha = 0;
    }
  }

  function parseRgbaTint(colorStr) {
    if (!colorStr) return 0xffffff;
    if (colorStr.startsWith('#')) {
      return parseInt(colorStr.slice(1), 16);
    }
    const m = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (m) return (parseInt(m[1], 10) << 16) | (parseInt(m[2], 10) << 8) | parseInt(m[3], 10);
    return 0xffffff;
  }

  function syncViewStyles(width, height) {
    if (!app?.view) return;
    if (legacyCanvas) {
      app.view.style.left = legacyCanvas.style.left || '0px';
      app.view.style.top = legacyCanvas.style.top || '0px';
      app.view.style.width = legacyCanvas.style.width || `${width}px`;
      app.view.style.height = legacyCanvas.style.height || `${height}px`;
    } else {
      app.view.style.width = `${width}px`;
      app.view.style.height = `${height}px`;
    }
  }

  function resize(width, height) {
    _width = width;
    _height = height;
    if (!app) return;
    app.renderer.resize(width, height);
    syncViewStyles(width, height);
    if (flashContainer?._rect) {
      const r = flashContainer._rect;
      r.clear();
      r.beginFill(0xffffff);
      r.drawRect(0, 0, width, height);
      r.endFill();
    }
    starsSeeded = false;
  }

  function syncShrapnel(shrapnel, now) {
    if (!shrapnelContainer) return;
    const oldChildren = shrapnelContainer.removeChildren();
    for (let i = 0; i < oldChildren.length; i += 1) {
      oldChildren[i].destroy();
    }

    for (let i = 0; i < shrapnel.length; i += 1) {
      const sh = shrapnel[i];
      const age = now - sh.startedAt;
      const progress = age / sh.ttl;
      const alpha = progress < 0.1
        ? progress * 10
        : progress > 0.7
          ? (1 - progress) / 0.3
          : 1;
      if (alpha <= 0) continue;

      const g = new PIXI.Graphics();
      shrapnelContainer.addChild(g);

      if (sh.isPulse) {
        g.lineStyle(3, 0x00ffd1, alpha * 0.8);
        g.drawCircle(sh.x, sh.y, sh.r + progress * 20);
        g.lineStyle(1, 0xffffff, alpha * 0.5);
        g.drawCircle(sh.x, sh.y, sh.r);
        g.beginFill(0x00ffd1, alpha * 0.15);
        g.drawCircle(sh.x, sh.y, sh.r);
        g.endFill();
      } else {
        const size = sh.r * (1 - progress * 0.4);
        g.beginFill(0xff6600, alpha * 0.9);
        g.drawCircle(sh.x, sh.y, size);
        g.endFill();
        g.beginFill(0xffffff, alpha * 0.7);
        g.drawCircle(sh.x, sh.y, size * 0.5);
        g.endFill();
        g.lineStyle(size * 2, 0xff4400, alpha * 0.25);
        g.drawCircle(sh.x, sh.y, size);
      }
    }
  }

  function draw(sim, laserBeams, canvasFlash, ufoState, plasmaCage, landmine, bombShrapnel, now) {
    if (!app) return false;
    const frameBudgetExceeded = !!sim._frameBudgetExceeded;
    const prefersReducedMotion = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    drawStars(sim.stars, now, prefersReducedMotion, frameBudgetExceeded);
    syncAsteroids(sim.asteroids);
    syncUFO(ufoState);
    syncParticles(sim.particles);
    syncLasers(laserBeams, now);
    syncWarpRings(sim.warpRings, frameBudgetExceeded);
    syncLightningRings(sim.lightningRings || [], frameBudgetExceeded);
    drawPlasmaLayer(plasmaCage, sim.asteroids, now);
    drawLandmine(landmine, now);
    updateBombEffects(now);
    syncShrapnel(bombShrapnel || [], now);
    updateFlash(canvasFlash);

    app.ticker.update(now);
    app.renderer.render(app.stage);
    return true;
  }

  function destroy() {
    if (!app) return;
    if (legacyCanvas) {
      legacyCanvas.style.opacity = '';
    }
    if (glowTexture) {
      glowTexture.destroy(true);
      glowTexture = null;
    }
    app.destroy(true, { children: true, texture: false });
    app = null;
    initPromise = null;
    legacyCanvas = null;
    starContainer = null;
    asteroidContainer = null;
    ufoContainer = null;
    particleContainer = null;
    laserContainer = null;
    warpRingContainer = null;
    lightningRingContainer = null;
    plasmaContainer = null;
    bombContainer = null;
    landmineContainer = null;
    debrisContainer = null;
    shrapnelContainer = null;
    flashContainer = null;
    starGraphics = null;
    ufoDisplay = null;
    ufoFallback = null;
    ufoGlowFallback = null;
    plasmaGraphics = null;
    bombGraphics = null;
    landmineGraphics = null;
    asteroidSprites.clear();
    particleSprites.clear();
    activeLasers.clear();
    activeWarpRings.clear();
    activeLightningRings.clear();
    activeBombs.length = 0;
    activeDebris.length = 0;
    asteroidSpritePool.length = 0;
    particleSpritePool.length = 0;
    _ufoGlowPool.length = 0;
    _activeUfoGlows.clear();
    laserPool.length = 0;
    warpRingPool.length = 0;
    lightningRingPool.length = 0;
    debrisPool.length = 0;
    starsSeeded = false;
    flashFilter = null;
    flashAlpha = 0;
    _plasmaBorderFlash = 0;
  }

  return { init, draw, resize, destroy, triggerBombDetonation, triggerShockwave, triggerPlasmaRectFlash };
})();

window.pixiRenderer = pixiRenderer;

export default pixiRenderer;
