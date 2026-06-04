import * as PIXI from './vendor/pixi.min.js';

const pixiRenderer = (() => {
  let app = null;
  let initPromise = null;
  let legacyCanvas = null;
  let nativeMode = false;

  let starContainer = null;
  let asteroidContainer = null;
  let particleContainer = null;
  let laserContainer = null;
  let warpRingContainer = null;
  let flashContainer = null;

  const asteroidSprites = new Map();
  const particleSprites = new Map();
  const asteroidSpritePool = [];
  const particleSpritePool = [];

  const textures = {};

  let flashFilter = null;
  let flashAlpha = 0;

  let starGraphics = null;
  let starsSeeded = false;
  let starFrame = 0;

  const laserPool = [];
  const activeLasers = new Map();

  const warpRingPool = [];
  const activeWarpRings = new Map();

  async function init(mountEl, width, height, isNative) {
    if (app) return app;
    if (initPromise) return initPromise;
    nativeMode = !!isNative;

    initPromise = (async () => {
      app = new PIXI.Application({
        width,
        height,
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
      app.view.setAttribute('aria-hidden', 'true');

      app.ticker.stop();

      const spriteKeys = {
        roid01: 'astgfx/roid01.png',
        roid02: 'astgfx/roid02.png',
        roid03: 'astgfx/roid03.png',
        hotroid01: 'astgfx/hotroid01.png',
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

      starContainer = new PIXI.Graphics();
      asteroidContainer = new PIXI.Container();
      particleContainer = new PIXI.ParticleContainer(800, {
        position: true,
        rotation: true,
        alpha: true,
        scale: true,
        tint: true,
      });
      laserContainer = new PIXI.Container();
      warpRingContainer = new PIXI.Container();
      flashContainer = new PIXI.Container();

      app.stage.addChild(starContainer);
      app.stage.addChild(asteroidContainer);
      app.stage.addChild(particleContainer);
      app.stage.addChild(laserContainer);
      app.stage.addChild(warpRingContainer);
      app.stage.addChild(flashContainer);
      starGraphics = starContainer;

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
        sprite = particleSpritePool.pop() || new PIXI.Sprite(PIXI.Texture.WHITE);
        particleContainer.addChild(sprite);
        particleSprites.set(p, sprite);
      }

      const lifeRatio = 1 - p.life / p.ttl;
      sprite.alpha = Math.max(0, lifeRatio * p.alpha);
      sprite.x = p.x - p.size;
      sprite.y = p.y - p.size;
      sprite.width = p.size * 2;
      sprite.height = p.size * 2;

      if (p._pixiTint == null) {
        p._pixiTint = parseRgbaTint(p.color) || 0x6fff80;
      }
      sprite.tint = p._pixiTint;
      sprite.visible = true;
    }

    for (const [p, sprite] of particleSprites) {
      if (!seen.has(p)) {
        sprite.visible = false;
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
      if (!g) {
        g = laserPool.pop() || new PIXI.Graphics();
        laserContainer.addChild(g);
        activeLasers.set(beam, g);
      }

      const t = Math.max(0, Math.min(1, (now - beam.startedAt) / 150));
      const alpha = 1 - t;
      g.clear();
      g.lineStyle(2, 0x00ffd1, 0.92 * alpha);
      g.moveTo(beam.x1, beam.y1);
      g.lineTo(beam.x2, beam.y2);
      g.lineStyle(6, 0x00ffd1, 0.18 * alpha);
      g.moveTo(beam.x1, beam.y1);
      g.lineTo(beam.x2, beam.y2);
      g.visible = true;
    }

    for (const [beam, g] of activeLasers) {
      if (!seen.has(beam)) {
        g.clear();
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

  function updateFlash(canvasFlash) {
    if (!flashContainer?._rect || nativeMode) return;
    const rect = flashContainer._rect;
    if (canvasFlash && canvasFlash.alpha > 0) {
      rect.tint = (canvasFlash.r << 16) | (canvasFlash.g << 8) | canvasFlash.b;
      rect.alpha = canvasFlash.alpha;
      flashAlpha = canvasFlash.alpha;
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

  function draw(sim, laserBeams, canvasFlash, now) {
    if (!app) return false;
    const frameBudgetExceeded = !!sim._frameBudgetExceeded;
    const prefersReducedMotion = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    drawStars(sim.stars, now, prefersReducedMotion, frameBudgetExceeded);
    syncAsteroids(sim.asteroids);
    syncParticles(sim.particles);
    syncLasers(laserBeams, now);
    syncWarpRings(sim.warpRings, frameBudgetExceeded);
    updateFlash(canvasFlash);

    app.renderer.render(app.stage);
    return true;
  }

  function destroy() {
    if (!app) return;
    if (legacyCanvas) {
      legacyCanvas.style.opacity = '';
    }
    app.destroy(true, { children: true, texture: false });
    app = null;
    initPromise = null;
    legacyCanvas = null;
    starContainer = null;
    asteroidContainer = null;
    particleContainer = null;
    laserContainer = null;
    warpRingContainer = null;
    flashContainer = null;
    starGraphics = null;
    asteroidSprites.clear();
    particleSprites.clear();
    activeLasers.clear();
    activeWarpRings.clear();
    asteroidSpritePool.length = 0;
    particleSpritePool.length = 0;
    laserPool.length = 0;
    warpRingPool.length = 0;
    starsSeeded = false;
    flashFilter = null;
    flashAlpha = 0;
  }

  return { init, draw, resize, destroy };
})();

window.pixiRenderer = pixiRenderer;

export default pixiRenderer;
