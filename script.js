let capacitorHaptics = null;
let hapticImpactStyle = { Heavy: "HEAVY", Medium: "MEDIUM", Light: "LIGHT" };
let hapticNotificationType = { Success: "SUCCESS" };
const DISABLE_GAMEPLAY_HAPTICS = true; // perf test - re-enable after Release build comparison
const UFO_BLAST_RADIUS = 220;
const UFO_BLAST_FORCE = 3.5;
const UFO_GLOW_DURATION = 4000;
let _mediaSession = null;
let _mediaSessionInitPromise = null;

function getBrowserMediaSession() {
  if (!navigator.mediaSession) return null;
  return {
    async setMetadata(metadata) {
      if (typeof MediaMetadata !== "function") return;
      navigator.mediaSession.metadata = new MediaMetadata(metadata);
    },
    async setPlaybackState({ playbackState }) {
      navigator.mediaSession.playbackState = playbackState === "none" ? "none" : playbackState;
    },
    async setActionHandler({ action }, handler) {
      navigator.mediaSession.setActionHandler(action, handler);
    },
  };
}

async function initMediaSession() {
  if (!isCapacitorNative) return null;
  if (_mediaSession) return _mediaSession;
  if (_mediaSessionInitPromise) return _mediaSessionInitPromise;

  _mediaSessionInitPromise = (async () => {
    try {
      let MediaSession = globalThis.Capacitor?.Plugins?.MediaSession || null;
      if (!MediaSession) {
        try {
          const mediaSessionModule = await import("@jofr/capacitor-media-session");
          MediaSession = mediaSessionModule.MediaSession;
        } catch {
          MediaSession = getBrowserMediaSession();
        }
      }
      if (!MediaSession) return null;
      _mediaSession = MediaSession;

      await _mediaSession.setMetadata({
        title: "Poly Oracle",
        artist: "POLYVERSE",
        album: "Arcade Mode",
        artwork: [{
          src: "favicon.png",
          sizes: "512x512",
          type: "image/png",
        }],
      });

      await _mediaSession.setPlaybackState({
        playbackState: "playing",
      });

      await _mediaSession.setActionHandler(
        { action: "play" },
        async () => {
          // Music is controlled by the game loop.
        },
      );
      await _mediaSession.setActionHandler(
        { action: "pause" },
        async () => {
          // Music is controlled by the game loop.
        },
      );

      return _mediaSession;
    } catch (e) {
      console.warn("MediaSession unavailable", e);
      return null;
    } finally {
      _mediaSessionInitPromise = null;
    }
  })();

  return _mediaSessionInitPromise;
}

async function updateMediaSessionLevel(levelNum) {
  if (!_mediaSession) return;
  try {
    await _mediaSession.setMetadata({
      title: `Poly Oracle - Level ${levelNum}`,
      artist: "POLYVERSE",
      album: "Arcade Mode",
      artwork: [{
        src: "favicon.png",
        sizes: "512x512",
        type: "image/png",
      }],
    });
    await _mediaSession.setPlaybackState({
      playbackState: "playing",
    });
  } catch (e) {
    // Media session metadata is optional.
  }
}

function loadCapacitorHaptics() {
  try {
    const H = globalThis.Capacitor?.Plugins?.Haptics;
    if (!H) return;
    capacitorHaptics = H;
    const bridge = globalThis.Capacitor?.getPlatform?.();
    if (globalThis.CapacitorHaptics) {
      hapticImpactStyle = globalThis.CapacitorHaptics.ImpactStyle || hapticImpactStyle;
      hapticNotificationType = globalThis.CapacitorHaptics.NotificationType || hapticNotificationType;
    }
  } catch {
    // Haptics unavailable outside native runtime
  }
}
document.addEventListener("DOMContentLoaded", loadCapacitorHaptics);
// 2026-06-09: lock the whole app to portrait permanently — landscape breaks the game.
function lockPortraitOrientation() {
  try {
    const SO = globalThis.Capacitor?.Plugins?.ScreenOrientation;
    if (SO) { SO.lock({ orientation: "portrait" }).catch(() => {}); }
    else { screen.orientation?.lock?.("portrait")?.catch?.(() => {}); }
  } catch { /* orientation lock is optional outside native */ }
}
document.addEventListener("DOMContentLoaded", lockPortraitOrientation);
document.addEventListener("DOMContentLoaded", () => {
  const _bel = document.createElement("div");
  _bel.textContent = "BUILD " + BUILD_TS;
  _bel.style.cssText = "position:fixed;bottom:6px;left:8px;font-family:monospace;font-size:10px;color:rgba(0,255,180,0.55);pointer-events:none;z-index:99999;";
  document.body.appendChild(_bel);
});

function getCapacitorHaptics() {
  return capacitorHaptics || globalThis.Capacitor?.Plugins?.Haptics || null;
}

function triggerHapticImpact(style) {
  try {
    getCapacitorHaptics()?.impact?.({ style })?.catch?.(() => {});
  } catch {
    // Haptics are optional outside a native Capacitor runtime.
  }
}

function triggerGameplayHapticImpact(style) {
  if (DISABLE_GAMEPLAY_HAPTICS) return;
  triggerHapticImpact(style);
}

function triggerHapticNotification(type) {
  try {
    getCapacitorHaptics()?.notification?.({ type })?.catch?.(() => {});
  } catch {
    // Haptics are optional outside a native Capacitor runtime.
  }
}

const APP_VERSION = "v3.3.0";
const storageKey = "poly-oracle-v11-state";
const firstRunHintKey = "poly_oracle_seen_hint_v1_2_1";
const verboseKey = "poly_oracle_verbose_details";
const chaosEnabledKey = "poly_oracle_chaos_theme";
const chaosPaletteKey = "poly_oracle_theme_palette";
const galaxyToolKey = "poly_oracle_galaxy_tool";
const BUILD_TS = "2026-06-12 19:31";
const debugTapsKey = "poly_oracle_debug_taps";
const ufoFxPresetKey = "poly_oracle_ufo_fx_preset";
const STORAGE_BEST_RUN = "poly-oracle-best-run";
const STORAGE_GAME_BEATEN = "poly-oracle-game-beaten";
const DISABLE_VIDEO_BG = false;

const _flashDiv = document.getElementById("screenFlashDiv");
let _flashTimer = null;

function cssFlash(color = "#ffffff", opacity = 0.45, durationMs = 120) {
  if (!_flashDiv) return;
  if (_flashTimer) clearTimeout(_flashTimer);
  _flashDiv.style.background = color;
  _flashDiv.style.transition = "none";
  _flashDiv.style.opacity = String(opacity);
  _flashTimer = setTimeout(() => {
    _flashDiv.style.transition = `opacity ${durationMs}ms ease-out`;
    _flashDiv.style.opacity = "0";
    _flashTimer = null;
  }, 16);
}

const _shakeEl = document.getElementById("galaxyView")
  || document.querySelector(".galaxy-view")
  || document.body;
let _shakeTimer = null;

function cssShake(intensity = 1) {
  if (!_shakeEl || _shakeTimer) return;
  const x = (Math.random() - 0.5) * 8 * intensity;
  const y = (Math.random() - 0.5) * 8 * intensity;
  _shakeEl.style.transform = `translate(${x}px,${y}px)`;
  _shakeTimer = setTimeout(() => {
    _shakeEl.style.transform = "";
    _shakeTimer = null;
  }, 80);
}

let _staticCanvas = document.getElementById("staticCanvas");
if (!_staticCanvas) {
  _staticCanvas = document.createElement("canvas");
  _staticCanvas.id = "staticCanvas";
  _staticCanvas.style.cssText = "position:fixed;inset:0;width:100%;height:100%;z-index:9991;pointer-events:none;opacity:0;";
  document.body.appendChild(_staticCanvas);
}
const _staticCtx = _staticCanvas ? _staticCanvas.getContext("2d") : null;

function cssStatic(duration = 500) {
  if (!_staticCtx || !_staticCanvas) return;
  _staticCanvas.width = window.innerWidth;
  _staticCanvas.height = window.innerHeight;
  const W = _staticCanvas.width;
  const H = _staticCanvas.height;
  let elapsed = 0;
  const startTime = performance.now();

  function drawGlitchFrame() {
    const now = performance.now();
    elapsed = now - startTime;
    if (elapsed > duration) {
      _staticCanvas.style.opacity = "0";
      _staticCtx.clearRect(0, 0, W, H);
      return;
    }

    const progress = elapsed / duration;
    const alpha = progress < 0.4
      ? 0.85
      : 0.85 * (1 - (progress - 0.4) / 0.6);
    _staticCanvas.style.opacity = String(alpha);
    _staticCtx.clearRect(0, 0, W, H);

    const bandCount = 4 + Math.floor(Math.random() * 4);
    for (let b = 0; b < bandCount; b += 1) {
      const bandY = Math.random() * H;
      const bandH = 4 + Math.random() * 32;
      const shiftX = (Math.random() - 0.5) * 40;
      const r = Math.random() < 0.5 ? 0 : 180;
      const g = (200 + Math.random() * 55) | 0;
      const bv = (180 + Math.random() * 55) | 0;
      _staticCtx.fillStyle = `rgba(${r},${g},${bv},0.15)`;
      _staticCtx.fillRect(shiftX, bandY, W, bandH);
      _staticCtx.fillStyle = "rgba(0,255,209,0.4)";
      _staticCtx.fillRect(shiftX, bandY, W, 1);

      for (let d = 0; d < 12; d += 1) {
        const dx = Math.random() * W;
        const dy = bandY + Math.random() * bandH;
        _staticCtx.fillStyle = Math.random() < 0.5
          ? "rgba(0,255,209,0.8)"
          : "rgba(255,255,255,0.6)";
        _staticCtx.fillRect(dx, dy, 1 + Math.random() * 3, 1);
      }
    }

    if (Math.random() < 0.4) {
      const barY = Math.random() * H;
      _staticCtx.fillStyle = "rgba(0,0,0,0.3)";
      _staticCtx.fillRect(0, barY, W, 2 + Math.random() * 6);
    }

    requestAnimationFrame(drawGlitchFrame);
  }
  drawGlitchFrame();
}

function playPlasmaLockSound() {
  try {
    const ctx = audioEngine.ctx;
    if (!ctx || ctx.state !== "running") return;
    const now = ctx.currentTime;

    [0, 0.12].forEach((offset, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(440 + i * 220, now + offset);
      osc.frequency.exponentialRampToValueAtTime(880 + i * 320, now + offset + 0.08);
      gain.gain.setValueAtTime(0, now + offset);
      gain.gain.linearRampToValueAtTime(0.35, now + offset + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.12);
      osc.start(now + offset);
      osc.stop(now + offset + 0.15);
    });

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.type = "square";
    osc2.frequency.setValueAtTime(120, now);
    osc2.frequency.exponentialRampToValueAtTime(60, now + 0.1);
    gain2.gain.setValueAtTime(0.15, now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc2.start(now);
    osc2.stop(now + 0.12);
  } catch (e) {
    // Lock-on sound is optional.
  }
}

const STORAGE = {
  arcadeLevel: "poly_oracle_arcade_level",
  arcadeSaved: "poly_oracle_arcade_saved",
  arcadeHasSave: "poly_oracle_arcade_hasSave",
  arcadeWon: "poly_oracle_arcade_won",
  rewardCelestial: "poly_oracle_reward_celestial",
};

const BG = {
  L1_3: "galaxybg1b-h264.mp4",
  L4_7: "level5-h264.mp4",
  L8_9: "level8-h264.mp4",
  L10: "newbossbg.mp4",
};

function bgKeyForLevel(levelNum) {
  if (levelNum >= 10) return "L10";
  if (levelNum >= 8) return "L8_9";
  if (levelNum >= 4) return "L4_7";
  return "L1_3";
}

const GAME_SFX = {
  orb_tap: "taporb.mp3",
  warp: "assets/newsfx/subswoosh.mp3",
  explosion_big: "gamesfx/explo1.mp3",
  explosion_med: "gamesfx/explo1.mp3",
  explosion_med_alt: "gamesfx/smallboom2.mp3",
  explosion_small: "gamesfx/smallboom1.mp3",
  explosion_small_alt: "gamesfx/smallboom2.mp3",
  reveal_magic: "reveal1.mp3",
  reveal_flash: "reveal4.mp3",
  reveal2: "reveal2.mp3",
  landmine_arm: "gamesfx/arm_bomb1.mp3",
  landmine_boom: "gamesfx/minefinalexplo.mp3",
  // 2026-06-10: powerup/freeze sound pack
  crunch: "gamesfx/crunch.mp3", // stroid grab + bomb grab
  pickup_gold: "gamesfx/pickup_gold.mp3",
  item_pickup2: "gamesfx/item_pickup2.mp3", // unassigned - crunchy item pickup
  freeze: "gamesfx/freeze.mp3",
  unfreeze: "gamesfx/unfreeze.mp3",
  freeze_explode: "gamesfx/freeze_explode.mp3", // frozen asteroid shatter
  blip1: "gamesfx/blip1.mp3",
  blip: "gamesfx/blip.mp3",
  gameover: "gamesfx/gameover.mp3",
  level_up: "gamesfx/level-up-191997.mp3",
  lastlevelstart: "gamesfx/lastlevelstart.mp3",
  astcollide1: "gamesfx/astcollide1.mp3",
  astcollide2: "gamesfx/astcollide2.mp3",
  newreveal001: "gamesfx/newreveal001.mp3",
  newreveal002: "gamesfx/newreveal002.mp3",
  newreveal003: "gamesfx/newreveal003.mp3",
  newreveal004: "gamesfx/newreveal004.mp3",
  newreveal005: "gamesfx/newreveal005.mp3",
  newreveal007: "gamesfx/newreveal007.mp3",
  newreveal008: "gamesfx/newreveal008.mp3",
  reveal1_pool: "reveal1.mp3",
  reveal2_pool: "reveal2.mp3",
  reveal3_pool: "reveal3.mp3",
  reveal4_pool: "reveal4.mp3",
  warning10: "assets/newsfx/newnewwarningloop.mp3",
  plasma_charge: "assets/newsfx/newnewwarningloop.mp3",
  advfire: "newsfx/advfire_lighter.mp3",
  plasmarecharged: "newsfx/plasmarecharged.mp3",
  droneufo: "newsfx/droneufo.mp3",
  reveal4: "reveal4.mp3",
  ufo_spawn: "gamesfx/blip1.mp3",
  ufo_teleport: "assets/newsfx/phantom.mp3",
  ufo_hit1: "gamesfx/astcollide2.mp3",
  ufo_destroy: "newsfxdesigned/ufodeath.mp3",
  life_gain: "gamesfx/popandsparkle.mp3",
  tryagain: "assets/newsfx/tryagain.mp3",
  retry_appear: "assets/newsfx/appear.mp3",
  scorecount: "gamesfx/scorecount2.mp3",
  crack: "gamesfx/crack.mp3",
  crush: "gamesfx/crush.mp3",
  bigbang: "gamesfx/bigbang.mp3",
  distantexplode: "gamesfx/distantexplode.mp3",
  basicb_explo: "gamesfx/basicb_explo.mp3",
  stroidthrow1: "gamesfx/stroidthrow1.mp3",
  stroidthrow2: "gamesfx/stroidthrow2.mp3",
  arm_bomb: "gamesfx/arm_bomb.mp3",
  particle_crackle1: "gamesfx/particle_crackle1.mp3",
  printtext: "gamesfx/printtext.mp3",
  write_on_text_loop: "gamesfx/write_on_text_loop.mp3",
  powexplode: "gamesfx/powexplode.mp3",
  smallblast: "gamesfx/smallblast.mp3",
  plasmarecharged1: "gamesfx/plasmarecharged1.mp3",
};

const PRACTICE_MAX_ASTEROIDS = 40;
const PRACTICE_SPAWN_COOLDOWN_MS = 1000;
const PRACTICE_ENABLED = false;
// 2026-06-12: net charge/highlight response sped up ~20% (1000 → 800) so the cage locks faster.
// The previous 1000ms is the "hard mode" candidate value for a future difficulty setting.
const PLASMA_CAGE_CHARGE_MS = 800;
const PLASMA_CAGE_COOLDOWN_MS = 5000;
const PLASMA_CAGE_DRAG_THRESHOLD = 20;
const PLASMA_CAGE_VOLUME_BOOST = Math.pow(10, 4 / 20);
const STROID_TOSS_HOLD_MS = 500;
const STROID_TOSS_TIMEOUT_MS = 2800; // 2026-06-12: a toss that never connects self-destructs fast (no dwindle, no revert)
const STROID_TOSS_MIN_SPEED = 500;
const STROID_TOSS_MAX_SPEED = 700;
// 2026-06-12: releasing a grabbed stroid with no real flick still tosses it — a slow drift
// (no flame, see FLAME_MIN_SPEED) in its pre-grab direction, instead of dropping dead in place.
const STROID_TOSS_SLOW_SPEED = 120;
// flames/heat-tint only render above this speed, so the slow no-flick toss flies cold while a
// real flick (>= STROID_TOSS_MIN_SPEED) flames. Sits between the slow (120) and flick (500) speeds.
const FLAME_MIN_SPEED = 300;
// 2026-06-11: tossable mines (placed bombs + landmine) — heavy lob physics
const MINE_TOSS_SPEED_FACTOR = 0.45; // bombs launch at 0.45x a stroid's speed
const MINE_TOSS_DECEL = 240; // px/s^2 friction — decelerates a lobbed mine to rest in ~1-1.5s
const MINE_TOSS_REST_SPEED = 40; // below this the toss settles back to normal drift
const CHAOS_THRESHOLD = 60;
const LEVEL_THEMES = {
  1:  { primary: "#00FFD1", name: "Deep Space" },
  2:  { primary: "#9B59FF", name: "Nebula" },
  3:  { primary: "#00E5FF", name: "Ice Field" },
  4:  { primary: "#4B0082", name: "Void" },
  5:  { primary: "#FF8C00", name: "Ember" },
  6:  { primary: "#00C853", name: "Jungle" },
  7:  { primary: "#00BFFF", name: "Storm" },
  8:  { primary: "#FF1744", name: "Blood" },
  9:  { primary: "#AAFF00", name: "Toxic" },
  10: { primary: "#FF1500", name: "Hellfire" },
};
const IOS_NATIVE_MAX_ASTEROIDS = 55;
const MAX_LIVES = 3;
const MAX_BOMB_INVENTORY = 3;
const BOMB_PICKUP_RADIUS = 42;
const LANDMINE_FUSE_MS = 8000; // 2026-06-09: auto-armed ("armed" phase) countdown duration
// 2026-06-09: bomb powerup collectible (separate system from landmines)
const BOMB_POWERUP_INTERVAL_MIN = 25000;
const BOMB_POWERUP_INTERVAL_MAX = 35000;
const BOMB_POWERUP_LIFETIME_MS = 10000;
const MUSIC_MAX_GAIN = 1.0; // 2026-06-10: was 0.9, bumped to full
const MUSIC = {
  L1_3:    "assets/music/E1L1-3.mp3",          // levels 1-2
  // L4_7: "assets/music/E1L4-7.mp3",          // retired - replaced by phonk series
  // L8_9: "assets/music/E1L8-9.mp3",          // retired - replaced by phonk series
  L10:     "assets/music/E1L10BOSS.mp3",        // level 10 boss
  PRACTICE: "assets/music/PRACTICE.mp3",
  TUTORIAL: "assets/music/Stroids_tutorial_instrumental.mp3",
  L3_4:    "assets/music/Stroids_phonk_loop.mp3",
  L5_6:    "assets/music/Stroids_BASS_Phonk.mp3",
  L7_8:    "assets/music/Stroids_Phonk_2.mp3",
  L9:      "assets/music/Stroids_metal_Loop.mp3",
};

function musicKeyForLevel(levelNum) {
  if (levelNum >= 10) return "L10";
  if (levelNum >= 8) return "L8_9";
  if (levelNum >= 4) return "L4_7";
  return "L1_3";
}

function nextMusicKeyForLevel(levelNum) {
  const key = musicKeyForLevel(levelNum);
  if (key === "L1_3") return "L4_7";
  if (key === "L4_7") return "L8_9";
  if (key === "L8_9") return "L10";
  return null;
}

function getMusicForLevel(level) {
  if (level === 0)    return MUSIC.TUTORIAL;
  if (level <= 2)     return MUSIC.L1_3;
  if (level <= 4)     return MUSIC.L3_4;
  if (level <= 6)     return MUSIC.L5_6;
  if (level <= 8)     return MUSIC.L7_8;
  if (level === 9)    return MUSIC.L9;
  if (level >= 10)    return MUSIC.L10;
  return MUSIC.L1_3;
}

const DEBUG_FORCE_LEVEL_SELECT = true; // 2026-06-09: re-enabled for debugging
const DEBUG_SHOW_LEVEL_DROPDOWN = false;
let canvasFlash = null;
const REVEAL_VARIANT_SFX = [
  "newreveal001",
  "newreveal002",
  "newreveal003",
  "newreveal004",
  "newreveal005",
  "newreveal007",
  "newreveal008",
];
const REVEAL_POOL_SFX = ["reveal1_pool", "reveal2_pool", "reveal3_pool", "reveal4_pool"];
const ARCADE_OVERLAY_FADE_MS = 500;
const REVEAL = {
  TAP_BURST_MS: 1500,
  TAP_INTERVAL_MS_START: 60,
  TAP_INTERVAL_MS_END: 180,
  PULSE_MIN: 1.0,
  PULSE_MAX: 1.1,
  GROW_MAX: 1.18,
  FLASH_RATE_MS: 120,
  TOTAL_BASELINE_MS: 8000,
};
const SFX = {
  TAP: "orb_tap",
  MAIN: "newreveal005",
  PRE_A: "reveal_magic",
  PRE_B: "newreveal002",
  POST: "reveal2",
};

// === Level Config ===
const ARCADE_LEVELS = [
  { level: 1, time: 48, totalToClear: 2, startSpawn: 2, spawnEveryMs: 0, maxOnScreen: 12 },
  { level: 2, time: 50, totalToClear: 3, startSpawn: 3, spawnEveryMs: 0, maxOnScreen: 12 },
  { level: 3, time: 52, totalToClear: 7, startSpawn: 3, spawnEveryMs: 2200, maxOnScreen: 12 },
  { level: 4, time: 54, totalToClear: 9, startSpawn: 4, spawnEveryMs: 2200, maxOnScreen: 12 },
  { level: 5, time: 56, totalToClear: 11, startSpawn: 4, spawnEveryMs: 2000, maxOnScreen: 12 },
  { level: 6, time: 58, totalToClear: 13, startSpawn: 5, spawnEveryMs: 1800, maxOnScreen: 13 },
  { level: 7, time: 60, totalToClear: 15, startSpawn: 5, spawnEveryMs: 1800, maxOnScreen: 13 },
  { level: 8, time: 64, totalToClear: 17, startSpawn: 6, spawnEveryMs: 1600, maxOnScreen: 14 },
  { level: 9, time: 68, totalToClear: 20, startSpawn: 6, spawnEveryMs: 1500, maxOnScreen: 14 },
  { level: 10, time: 75, totalToClear: 24, startSpawn: 7, spawnEveryMs: 1400, maxOnScreen: 14 },
];

function getSavedArcadeLevel() {
  try {
    const n = parseInt(localStorage.getItem(STORAGE.arcadeLevel) || "1", 10);
    return Number.isFinite(n) && n >= 1 ? n : 1;
  } catch {
    return 1;
  }
}

function setSavedArcadeLevel(level) {
  try {
    localStorage.setItem(STORAGE.arcadeLevel, String(level));
    localStorage.setItem(STORAGE.arcadeSaved, "1");
    localStorage.setItem(STORAGE.arcadeHasSave, "1");
  } catch {
    // ignore
  }
}

function clearArcadeProgress() {
  try {
    localStorage.removeItem(STORAGE.arcadeLevel);
    localStorage.removeItem(STORAGE.arcadeSaved);
    localStorage.removeItem(STORAGE.arcadeHasSave);
  } catch {
    // ignore
  }
}

function hasArcadeSave() {
  try {
    return localStorage.getItem(STORAGE.arcadeHasSave) === "1";
  } catch {
    return false;
  }
}

function setArcadeWon() {
  try {
    localStorage.setItem(STORAGE.arcadeWon, "1");
  } catch {
    // ignore
  }
}

function hasArcadeWon() {
  try {
    return localStorage.getItem(STORAGE.arcadeWon) === "1";
  } catch {
    return false;
  }
}

function hasBeatenGame() {
  // FIXED 2026-06-08
  try { return localStorage.getItem(STORAGE_GAME_BEATEN) === "true"; }
  catch { return false; }
}

const revealModes = [
  { id: "classic", label: "Classic Fade", duration: 2500 },
  { id: "dramatic", label: "Dramatic Flash", duration: 2500 },
  { id: "mist", label: "Mist Unveil", duration: 2500 },
  { id: "glitch", label: "Glitch Oracle", duration: 2500 },
];

const revealSoundPool = ["reveal1.mp3", "reveal2.mp3", "reveal3.mp3", "reveal4.mp3"];

const canonicalAnswers = [
  "Yes - you know it",
  "Yeppurs",
  "Yeah, buddy",
  "Heck Yes",
  "Nope",
  "I don't think so",
  "That is for God to decide",
  "Ask another day",
  "You're asking the wrong question, think about it and ask another day",
  "Yes",
  "Not today",
  "Heck No",
  "No",
];

const packs = {
  classic: {
    label: "Classic",
    yes: ["The current aligns in your favor.", "The signal is clean. Proceed.", "Momentum says yes."],
    no: ["Not this cycle.", "The signs ask for patience.", "Pause and return with clearer intent."],
  },
  romantic: {
    label: "Romantic",
    yes: ["The heart says yes.", "Love is leaning your way.", "There is warmth ahead."],
    no: ["Not from this person, not today.", "Protect your energy first.", "Wait for reciprocation."],
  },
  business: {
    label: "Business",
    yes: ["The tradeoff is acceptable.", "Green light with discipline.", "Risk-adjusted yes."],
    no: ["Return with better numbers.", "Hold capital for now.", "Not enough edge yet."],
  },
  chaos: {
    label: "Chaos Goblin",
    yes: ["Absolutely. Do it loud.", "Chaos approves.", "Yes, and make it weird."],
    no: ["Nope. Universe said sit down.", "Hard no, tiny mortal.", "Not unless you enjoy drama."],
  },
  stoic: {
    label: "Stoic",
    yes: ["Act with virtue and continue.", "This is within your control.", "Proceed without attachment."],
    no: ["Decline what weakens you.", "Not essential. Let it go.", "Choose restraint."],
  },
};

const defaultPalette = {
  accentA: "#7be2ff",
  accentB: "#f6a7ff",
  accentC: "#8effd0",
  bgNebula1: "rgba(124, 153, 255, 0.14)",
  bgNebula2: "rgba(164, 111, 255, 0.16)",
  bgNebula3: "rgba(120, 208, 255, 0.12)",
  bgNebula4: "rgba(158, 255, 215, 0.09)",
  nebulaPos1: "12% 10%",
  nebulaPos2: "82% 16%",
  nebulaPos3: "56% 96%",
  nebulaPos4: "22% 78%",
  orbGlow: "0 0 36px rgba(124, 223, 255, 0.52), 0 0 92px rgba(196, 127, 255, 0.28)",
};

const prefersReducedMotion =
  typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isIOSWebKit = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isCapacitorNative = !!(globalThis.Capacitor?.isNativePlatform?.());
const isIOSNative = isCapacitorNative && isIOSWebKit;
// FIXED 2026-06-08: Safari desktop blocks AudioContext resume on rapid fire events
const isSafariDesktop = /^((?!chrome|android).)*safari/i.test(navigator.userAgent) && !navigator.userAgent.includes("Mobile");
const MAX_EXPLOSION_PARTICLES = isIOSNative ? 30 : 80;

function nativeCanvasDpr() {
  return isIOSNative ? 1 : Math.max(1, Math.min(2, window.devicePixelRatio || 1));
}

function capIOSNativeAsteroids(value) {
  const safeValue = Math.max(0, Math.floor(value || 0));
  return isIOSNative ? Math.min(safeValue, IOS_NATIVE_MAX_ASTEROIDS) : safeValue;
}

const state = {
  selectedMode: "classic",
  selectedPack: "classic",
  selectedVoice: "",
  userVoiceOverride: false,
  whisper: false,
  minimal: false,
  randomVoiceEachReveal: false,
  multiVoiceQA: false,
  verboseDetails: false,
  chaosThemeEnabled: false,
  themePalette: null,
  vaultFilter: "all",
  vaultSearch: "",
  vault: [],
  currentAnswer: null,
  flip: false,
  settingsOpen: false,
  isRevealing: false,
  sessionTapCount: 0,
  chaosShiftCount: 0,
  tapTimestamps: [],
  galaxyTool: "draw",
  practiceTool: "pencil",
  voiceReadsAnswer: true,
};

const stage = document.getElementById("stage");
const orb = document.getElementById("orb");
const flash = document.getElementById("flash");
const mist = document.getElementById("mist");
const sparkles = document.getElementById("sparkles");
const revealAudio = document.getElementById("revealAudio");
const orbTapAudio = document.getElementById("orbTapAudio");
const revealFxVideo = document.getElementById("revealFxVideo");
const oracleBgVideo = document.getElementById("oracleBgVideo");
const bgStack = document.getElementById("bgStack");
const bgVideoA = document.getElementById("bgA");
const bgVideoB = document.getElementById("bgB");
const bgTint = document.getElementById("bgTint");
const questionInput = document.getElementById("question");
const askButton = document.getElementById("ask");

const answerBox = document.getElementById("answer");
const answerCard = document.getElementById("answerCard");
const answerSimple = document.getElementById("answerSimple");
const answerPolarity = document.getElementById("answerPolarity");
const answerText = document.getElementById("answerText");
const answerMicro = document.getElementById("answerMicro");
const answerMeta = document.getElementById("answerMeta");
const flipAnswer = document.getElementById("flipAnswer");
const favoriteAnswer = document.getElementById("favoriteAnswer");
const shareAnswer = document.getElementById("shareAnswer");

const openSettings = document.getElementById("openSettings");
const closeSettings = document.getElementById("closeSettings");
const settingsPanel = document.getElementById("settingsPanel");
const settingsBackdrop = document.getElementById("settingsBackdrop");
const modeButtons = Array.from(document.querySelectorAll(".segment-btn[data-mode]"));
const packSelect = document.getElementById("packSelect");
const whisperModeToggle = document.getElementById("whisperMode");
const minimalModeToggle = document.getElementById("minimalMode");
const randomVoiceEachRevealToggle = document.getElementById("randomVoiceEachReveal");
const multiVoiceQAToggle = document.getElementById("multiVoiceQA");
const verboseDetailsToggle = document.getElementById("verboseDetails");
const randomVoiceNow = document.getElementById("randomVoiceNow");
const voiceSelect = document.getElementById("voiceSelect");
const previewVoice = document.getElementById("previewVoice");
const previewVoiceStop = document.getElementById("previewVoiceStop");
const voicePersona = document.getElementById("voicePersona");
const openVault = document.getElementById("openVault");
const clearHistory = document.getElementById("clearHistory");
const resetThemeButton = document.getElementById("resetTheme");
const firstRunHint = document.getElementById("firstRunHint");
const chaosToast = document.getElementById("chaosToast");
const titleSparkles = document.getElementById("titleSparkles");
const oracleView = document.getElementById("oracleView");
const galaxyView = document.getElementById("galaxyView");
const openGalaxy = document.getElementById("openGalaxy");
const closeGalaxy = document.getElementById("closeGalaxy");
const toolDraw = document.getElementById("toolDraw");
const toolBoom = document.getElementById("toolBoom");
const clearGalaxy = document.getElementById("clearGalaxy");
const galaxyPlayCanvas = document.getElementById("galaxyPlayCanvas");
const canvasCrosshair = document.getElementById("canvasCrosshair");
const galaxyModeSelect = document.getElementById("galaxyModeSelect");
const btnArcade = document.getElementById("btnArcade");
const btnPractice = document.getElementById("btnPractice");
const btnGalaxyBack = document.getElementById("btnGalaxyBack");
const arcadeMenuPanel = document.getElementById("arcadeMenuPanel");
const arcadeLevelPanel = document.getElementById("arcadeLevelPanel");
const btnArcadeNew = document.getElementById("btnArcadeNew");
const btnArcadeResume = document.getElementById("btnArcadeResume");
const btnArcadeLevelSelect = document.getElementById("btnArcadeLevelSelect");
const btnArcadeScores = document.getElementById("btnArcadeScores");
const btnScores = document.getElementById("btnScores");
const btnArcadeMenuBack = document.getElementById("btnArcadeMenuBack");
const btnArcadeLevelBack = document.getElementById("btnArcadeLevelBack");
const arcadeLevelGrid = document.getElementById("arcadeLevelGrid");
const arcadeHud = document.getElementById("arcadeHud");
const arcadeBack = document.getElementById("arcadeBack");
const hudLevel = document.getElementById("hudLevel");
const hudTimer = document.getElementById("hudTimer");
const hudLives = document.getElementById("hudLives");
const hudScore = document.getElementById("hudScore");
const hudGameTimer = document.getElementById("hudGameTimer");
const hudBombBtn = document.getElementById("hudBombBtn");
const hudFreezeBtn = document.getElementById("hudFreezeBtn");
const hudQuadBadge = document.getElementById("hudQuadBadge");

function formatRunTime(ms) {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
let hudMultiplier = document.getElementById("hudMultiplier");
const arcadeTimerBackdrop = document.getElementById("arcadeTimerBackdrop");
const arcadeTimerGhost = document.getElementById("arcadeTimerGhost");
const arcadeOverlay = document.getElementById("arcadeOverlay");
const arcadeOverlayText = document.getElementById("arcadeOverlayText");
const arcadeOverlaySub = document.getElementById("arcadeOverlaySub");
const arcadeOverlayBtn = document.getElementById("arcadeOverlayBtn");
const arcadeOverlayBtnSecondary = document.getElementById("arcadeOverlayBtnSecondary");

const commBoxController = (() => {
  const FRAMES = {
    idle: "commander/idle_commander.jpg",
    commander: "commander/commander.jpg",
    talk1: "commander/talk1_commander.jpg",
    talk2: "commander/talk2_commander.jpg",
    blink: "commander/blink_commander.jpg",
    angry: "commander/angry_commander.jpg",
    shockd: "commander/shockd_commander.jpg",
    laugh: "commander/laugh_commander.jpg",
    laugh2: "commander/laugh2_commander.jpg",
    smirk: "commander/smirk_commander.jpg",
    smirktalkA: "commander/smirktalkA_commander.jpg",
    smirktalkB: "commander/smirktalkB_commander.jpg",
    exhausted: "commander/exhausted_commander.jpg",
    eyesdown: "commander/eyesdown_commander.jpg",
    lookleft: "commander/lookleft_commander.jpg",
    lookright: "commander/lookright_commander.jpg",
    thinking: "commander/thinking_commander.jpg",
    lightdamage: "commander/lightdamage_commander.jpg",
    lightdamageblink: "commander/lightdamage_blink_commander.jpg",
    lightdamagelook: "commander/lightdamage_lookLeft_commander.jpg",
    lightdamagelookB: "commander/lightdamage_lookLeftB_commander.jpg",
    lightdamagetalkA: "commander/lightdamage_talkA_commander.jpg",
    lightdamagetalkB: "commander/lightdamage_talkB_commander.jpg",
    heavydamage: "commander/heavydamage_commander.jpg",
    heavydamageblink: "commander/heavydamage_blink_commander.jpg",
    heavydamagelook: "commander/heavydamage_lookLeft_commander.jpg",
    heavydamagetalkA: "commander/heavydamage_talkA_commander.jpg",
    heavydamagetalkB: "commander/heavydamage_talkB_commander.jpg",
    coffee: "commander/easteregg_coffee_commander.jpg",
    duckface: "commander/easteregg_duckface_commander.jpg",
    tongueout: "commander/easteregg_tongueout_commander.jpg",
  };

  const preloaded = {};
  Object.entries(FRAMES).forEach(([key, src]) => {
    const img = new Image();
    img.src = src;
    preloaded[key] = img;
  });

  const hud = document.getElementById("commanderHUD");
  const portrait = document.getElementById("commanderImg");
  const ticker = document.getElementById("commanderTicker");
  const tickerText = document.getElementById("commanderTickerText");

  let currentFrame = "idle";
  let damageState = "normal";
  let idleTimer = null;
  let tickerHideTimer = null;
  let voAudio = null;
  let typingToken = 0;
  let mouthFlap = null;
  let tickerVisible = false;
  let hudVisible = false;
  const _voQueue = [];
  let _voPlaying = false;
  let _voQueueTimer = null;
  let _voPlayToken = 0;
  let _voTriggerToken = 0;

  const IDLE_NORMAL = ["idle", "idle", "idle", "blink", "idle", "idle",
    "lookleft", "idle", "lookright", "idle", "idle", "blink", "eyesdown", "idle"];
  const IDLE_LIGHT = ["lightdamage", "lightdamage", "lightdamageblink",
    "lightdamage", "lightdamagelook", "lightdamage", "lightdamageblink"];
  const IDLE_HEAVY = ["heavydamage", "heavydamage", "heavydamageblink",
    "heavydamage", "heavydamagelook", "heavydamage"];

  const EASTER_EGG_FRAMES = ["coffee", "duckface", "tongueout"];
  let idleIndex = 0;
  let easterEggCooldown = 0;

  const GLITCH = "▓░█▒╬╫╪";
  const VO3_FILES = new Set([
    "blast_em_ha_ha.mp3",
    "EHEHAHH.mp3",
    "GET_EM_GET_EM_GET_EM.mp3",
    "GET_EM_GET_EM.mp3",
    "GET_EMMM.mp3",
    "haha_yeah_cadet_thats_what_im_talking_about.mp3",
    "HAHA_yeahh_hahaha.mp3",
    "HAHAAAA_THATS_HOW_ITS_DONE.mp3",
    "HAHAHA_OH_YOU_GOT_EM.mp3",
    "HEHEH_YEAHHHH.mp3",
    "id_be_lost_without_you_cadet_nice_work.mp3",
    "if_these_stroids_were_alive_theyd_be_shook.mp3",
    "MAKE_A_PLASMA_NET.mp3",
    "MAKE_A_PLASMA_NET2.mp3",
    "MAKE_A_PLASMA_NET3.mp3",
    "PLASMA_IS_RECHARGED.mp3",
    "PLASMA_RECHARGED_MAKE_A_PLASMA_NET.mp3",
    "RIGHT_ON.mp3",
    "RIGHT_ON2.mp3",
    "TAP_AND_DRAG_TO_MAKE_A_PLASMA_NET.mp3",
    "that_grinds_my_gears.mp3",
    "THAT_IS_RIGHT.mp3",
    "THATS_HOW_ITS_DONE.mp3",
    "this_definitely_concerns_you_cadet.mp3",
    "this_definitely_concerns_you_cadet2.mp3",
    "way_to_go_man.mp3",
    "WHOOPTHATCHICK_GETEM.mp3",
    "YOU_SHOW_EM_WHOS_BOSS_hahah.mp3",
    "YOU_SHOW_EM_WHOS_BOSSS.mp3",
    "youre_not_doing_so_hot_cadet.mp3",
    "youre_not_doing_so_well_cadet.mp3",
  ]);
  const availableVoFiles = new Set([
    // dump1
    "vo-hairytakeemout.mp3",
    "vo-lets_blast_these_stroids.mp3",
    "vo-welcometothepolyverse.mp3",
    "vo-ufo_spotted_takeemout.mp3",
    // dump2
    // 2026-06-09: danger_loop unregistered (silenced)
    // "danger_loop.mp3",
    "vo-cadet_theres_a_bomb.mp3",
    "vo-detonate_the_bomb.mp3",
    "vo-detonate_the_bomb2.mp3",
    "vo-dont_get_cocky_on_me_kid.mp3",
    "vo-dont_get_cocky_on_me.mp3",
    "vo-excellent_work_cadet.mp3",
    "vo-i_believe_in_you_cadet.mp3",
    "vo-i_believe_in_you_cadet2.mp3",
    "vo-interferenceambience.mp3",
    "vo-lets_go_ahead_blast_em.mp3",
    "vo-lets_show_em_whos_boss_get_out_of_here.mp3",
    "vo-lets_show_the_polyverse_that_you_are_a_force_to_be_reckoned_with.mp3",
    "vo-lets_show_up_and_show_em_whos_boss_kid.mp3",
    "vo-nice_victory.mp3",
    "vo-nice.mp3",
    "vo-nice2.mp3",
    "vo-nice_shot_cadet.mp3",
    "vo-niceone.mp3",
    "vo-phenomenal_work_cadet.mp3",
    "vo-quicklaugh.mp3",
    "vo-that_was_a_nice_shot_cadet.mp3",
    "vo-thats_right_cadet.mp3",
    "vo-theres_a_bomb.mp3",
    "vo-very_nice_shot_cadet.mp3",
    "vo-YES.mp3",
    "vo-you_show_em_whos_boss_cadet.mp3",
    "vo-you_show_em_whos_boss.mp3",
    "vo-you_show_em_whos_boss2.mp3",
    "vo-you_show_em_whos_boss3.mp3",
    ...VO3_FILES,
  ]);

  const _poolIndices = {};
  function pickFromPool(poolKey, arr) {
    if (!_poolIndices[poolKey] || _poolIndices[poolKey] >= arr.length) {
      _poolIndices[poolKey] = 0;
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
    }
    return arr[_poolIndices[poolKey]++];
  }

  const POOL_LEVEL_START = [
    "vo-lets_go_ahead_blast_em.mp3",
    "vo-lets_show_em_whos_boss_get_out_of_here.mp3",
    "vo-lets_show_up_and_show_em_whos_boss_kid.mp3",
    "vo-lets_show_the_polyverse_that_you_are_a_force_to_be_reckoned_with.mp3",
    "vo-lets_blast_these_stroids.mp3",
    "this_definitely_concerns_you_cadet.mp3",
    "this_definitely_concerns_you_cadet2.mp3",
  ];

  const POOL_LEVEL_COMPLETE = [
    "vo-nice_victory.mp3",
    "vo-excellent_work_cadet.mp3",
    "vo-phenomenal_work_cadet.mp3",
    "vo-you_show_em_whos_boss_cadet.mp3",
    "vo-you_show_em_whos_boss.mp3",
    "vo-you_show_em_whos_boss2.mp3",
    "vo-you_show_em_whos_boss3.mp3",
    "HAHAAAA_THATS_HOW_ITS_DONE.mp3",
    "THATS_HOW_ITS_DONE.mp3",
    "THAT_IS_RIGHT.mp3",
    "RIGHT_ON.mp3",
    "RIGHT_ON2.mp3",
    "haha_yeah_cadet_thats_what_im_talking_about.mp3",
    "way_to_go_man.mp3",
    "YOU_SHOW_EM_WHOS_BOSSS.mp3",
    "id_be_lost_without_you_cadet_nice_work.mp3",
    "if_these_stroids_were_alive_theyd_be_shook.mp3",
  ];

  const POOL_NICE_SHOT = [
    "vo-nice.mp3",
    "vo-nice2.mp3",
    "vo-niceone.mp3",
    "vo-nice_shot_cadet.mp3",
    "vo-that_was_a_nice_shot_cadet.mp3",
    "vo-very_nice_shot_cadet.mp3",
    "vo-thats_right_cadet.mp3",
    "vo-YES.mp3",
    "blast_em_ha_ha.mp3",
    "GET_EM_GET_EM_GET_EM.mp3",
    "GET_EM_GET_EM.mp3",
    "GET_EMMM.mp3",
    "WHOOPTHATCHICK_GETEM.mp3",
    "HAHAHA_OH_YOU_GOT_EM.mp3",
  ];

  const POOL_HYPE = [
    "vo-you_show_em_whos_boss_cadet.mp3",
    "vo-you_show_em_whos_boss.mp3",
    "vo-you_show_em_whos_boss2.mp3",
    "vo-you_show_em_whos_boss3.mp3",
    "vo-lets_go_ahead_blast_em.mp3",
    "HAHA_yeahh_hahaha.mp3",
    "HEHEH_YEAHHHH.mp3",
    "EHEHAHH.mp3",
    "YOU_SHOW_EM_WHOS_BOSS_hahah.mp3",
  ];

  const POOL_BOMB = [
    "vo-cadet_theres_a_bomb.mp3",
    "vo-theres_a_bomb.mp3",
  ];

  const POOL_DETONATE = [
    "vo-detonate_the_bomb.mp3",
    "vo-detonate_the_bomb2.mp3",
  ];

  const POOL_LOW_LIVES = [
    "vo-i_believe_in_you_cadet.mp3",
    "vo-i_believe_in_you_cadet2.mp3",
    "youre_not_doing_so_hot_cadet.mp3",
    "youre_not_doing_so_well_cadet.mp3",
    "that_grinds_my_gears.mp3",
  ];

  const POOL_COCKY = [
    "vo-dont_get_cocky_on_me_kid.mp3",
    "vo-dont_get_cocky_on_me.mp3",
  ];

  const POOL_LANDMINE_ARMED = [
    "EHEHAHH.mp3",
    "HAHA_yeahh_hahaha.mp3",
    "HAHAAAA_THATS_HOW_ITS_DONE.mp3",
    "HAHAHA_OH_YOU_GOT_EM.mp3",
    "HEHEH_YEAHHHH.mp3",
    "YOU_SHOW_EM_WHOS_BOSS_hahah.mp3",
  ];

  const POOL_PLASMA_RECHARGED = [
    "PLASMA_IS_RECHARGED.mp3",
    "PLASMA_RECHARGED_MAKE_A_PLASMA_NET.mp3",
  ];

  const POOL_PLASMA_HINT = [
    "TAP_AND_DRAG_TO_MAKE_A_PLASMA_NET.mp3",
    "MAKE_A_PLASMA_NET.mp3",
    "MAKE_A_PLASMA_NET2.mp3",
    "MAKE_A_PLASMA_NET3.mp3",
  ];

  const VO_CAPTIONS = {
    "vo-hairytakeemout.mp3": "IT'S HAIRY OUT THERE. TAKE 'EM OUT.",
    "vo-lets_blast_these_stroids.mp3": "LET'S BLAST THESE 'STROIDS.",
    "vo-welcometothepolyverse.mp3": "WELCOME TO THE POLYVERSE.",
    "vo-ufo_spotted_takeemout.mp3": "UFO SPOTTED. TAKE 'EM OUT.",
    "vo-cadet_theres_a_bomb.mp3": "CADET - THERE'S A BOMB.",
    "vo-theres_a_bomb.mp3": "THERE'S A BOMB.",
    "vo-detonate_the_bomb.mp3": "DETONATE THE BOMB.",
    "vo-detonate_the_bomb2.mp3": "DETONATE THE BOMB.",
    "vo-dont_get_cocky_on_me_kid.mp3": "DON'T GET COCKY ON ME, KID.",
    "vo-dont_get_cocky_on_me.mp3": "DON'T GET COCKY ON ME.",
    "vo-excellent_work_cadet.mp3": "EXCELLENT WORK, CADET.",
    "vo-i_believe_in_you_cadet.mp3": "I BELIEVE IN YOU, CADET.",
    "vo-i_believe_in_you_cadet2.mp3": "I BELIEVE IN YOU.",
    "vo-lets_go_ahead_blast_em.mp3": "LET'S GO AHEAD AND BLAST 'EM.",
    "vo-lets_show_em_whos_boss_get_out_of_here.mp3": "LET'S SHOW 'EM WHO'S BOSS.",
    "vo-lets_show_the_polyverse_that_you_are_a_force_to_be_reckoned_with.mp3": "SHOW THE POLYVERSE YOU'RE A FORCE.",
    "vo-lets_show_up_and_show_em_whos_boss_kid.mp3": "SHOW 'EM WHO'S BOSS, KID.",
    "vo-nice_victory.mp3": "NICE VICTORY.",
    "vo-nice.mp3": "NICE.",
    "vo-nice2.mp3": "NICE.",
    "vo-nice_shot_cadet.mp3": "NICE SHOT, CADET.",
    "vo-niceone.mp3": "NICE ONE.",
    "vo-phenomenal_work_cadet.mp3": "PHENOMENAL WORK, CADET.",
    "vo-quicklaugh.mp3": "HA.",
    "vo-that_was_a_nice_shot_cadet.mp3": "THAT WAS A NICE SHOT, CADET.",
    "vo-thats_right_cadet.mp3": "THAT'S RIGHT, CADET.",
    "vo-very_nice_shot_cadet.mp3": "VERY NICE SHOT, CADET.",
    "vo-YES.mp3": "YES!",
    "vo-you_show_em_whos_boss_cadet.mp3": "YOU SHOW 'EM WHO'S BOSS, CADET.",
    "vo-you_show_em_whos_boss.mp3": "YOU SHOW 'EM WHO'S BOSS.",
    "vo-you_show_em_whos_boss2.mp3": "YOU SHOW 'EM WHO'S BOSS.",
    "vo-you_show_em_whos_boss3.mp3": "YOU SHOW 'EM WHO'S BOSS.",
    "blast_em_ha_ha.mp3": "BLAST 'EM! HA HA!",
    "EHEHAHH.mp3": "EHEHAHH.",
    "GET_EM_GET_EM_GET_EM.mp3": "GET 'EM! GET 'EM! GET 'EM!",
    "GET_EM_GET_EM.mp3": "GET 'EM! GET 'EM!",
    "GET_EMMM.mp3": "GET 'EMMM!",
    "haha_yeah_cadet_thats_what_im_talking_about.mp3": "HAHA YEAH CADET, THAT'S WHAT I'M TALKING ABOUT!",
    "HAHA_yeahh_hahaha.mp3": "HAHA YEAHH HAHAHA!",
    "HAHAAAA_THATS_HOW_ITS_DONE.mp3": "HAHAAAA THAT'S HOW IT'S DONE!",
    "HAHAHA_OH_YOU_GOT_EM.mp3": "HAHAHA OH YOU GOT 'EM!",
    "HEHEH_YEAHHHH.mp3": "HEHEH YEAHHHH!",
    "id_be_lost_without_you_cadet_nice_work.mp3": "I'D BE LOST WITHOUT YOU, CADET. NICE WORK.",
    "if_these_stroids_were_alive_theyd_be_shook.mp3": "IF THESE 'STROIDS WERE ALIVE, THEY'D BE SHOOK.",
    "MAKE_A_PLASMA_NET.mp3": "MAKE A PLASMA NET!",
    "MAKE_A_PLASMA_NET2.mp3": "MAKE A PLASMA NET!",
    "MAKE_A_PLASMA_NET3.mp3": "MAKE A PLASMA NET!",
    "PLASMA_IS_RECHARGED.mp3": "PLASMA IS RECHARGED.",
    "PLASMA_RECHARGED_MAKE_A_PLASMA_NET.mp3": "PLASMA RECHARGED — MAKE A PLASMA NET!",
    "RIGHT_ON.mp3": "RIGHT ON.",
    "RIGHT_ON2.mp3": "RIGHT ON.",
    "TAP_AND_DRAG_TO_MAKE_A_PLASMA_NET.mp3": "TAP AND DRAG TO MAKE A PLASMA NET.",
    "that_grinds_my_gears.mp3": "THAT GRINDS MY GEARS.",
    "THAT_IS_RIGHT.mp3": "THAT IS RIGHT.",
    "THATS_HOW_ITS_DONE.mp3": "THAT'S HOW IT'S DONE!",
    "this_definitely_concerns_you_cadet.mp3": "THIS DEFINITELY CONCERNS YOU, CADET.",
    "this_definitely_concerns_you_cadet2.mp3": "THIS DEFINITELY CONCERNS YOU, CADET.",
    "way_to_go_man.mp3": "WAY TO GO, MAN!",
    "WHOOPTHATCHICK_GETEM.mp3": "WHOOP THAT CHICK — GET 'EM!",
    "YOU_SHOW_EM_WHOS_BOSS_hahah.mp3": "YOU SHOW 'EM WHO'S BOSS! HAHAH!",
    "YOU_SHOW_EM_WHOS_BOSSS.mp3": "YOU SHOW 'EM WHO'S BOSS!",
    "youre_not_doing_so_hot_cadet.mp3": "YOU'RE NOT DOING SO HOT, CADET.",
    "youre_not_doing_so_well_cadet.mp3": "YOU'RE NOT DOING SO WELL, CADET.",
  };

  function setFrame(key) {
    if (!portrait || !FRAMES[key]) return;
    currentFrame = key;
    portrait.src = FRAMES[key];
  }

  function tickIdle() {
    if (mouthFlap) return;
    const now = Date.now();
    if (now > easterEggCooldown && Math.random() < 0.008) {
      easterEggCooldown = now + 120000;
      const egg = EASTER_EGG_FRAMES[Math.floor(Math.random() * EASTER_EGG_FRAMES.length)];
      setFrame(egg);
      setTimeout(() => {
        const seq = damageState === "heavy" ? IDLE_HEAVY
          : damageState === "light" ? IDLE_LIGHT : IDLE_NORMAL;
        setFrame(seq[idleIndex % seq.length]);
      }, 2200);
      return;
    }

    const seq = damageState === "heavy" ? IDLE_HEAVY
      : damageState === "light" ? IDLE_LIGHT : IDLE_NORMAL;
    const nextFrame = seq[idleIndex % seq.length];
    const isBlink = nextFrame.includes("blink");
    setFrame(nextFrame);
    idleIndex++;
    if (isBlink) {
      setTimeout(() => {
        if (!mouthFlap) {
          const baseFrame = damageState === "heavy"
            ? "heavydamage"
            : damageState === "light"
              ? "lightdamage"
              : "idle";
          setFrame(baseFrame);
        }
      }, 120);
    }
  }

  function startIdle() {
    if (idleTimer) return;
    idleTimer = setInterval(tickIdle, 800);
  }

  function stopIdle() {
    clearInterval(idleTimer);
    idleTimer = null;
  }

  function startMouthFlap(talkFrames) {
    stopMouthFlap();
    let i = 0;
    mouthFlap = setInterval(() => {
      setFrame(talkFrames[i % talkFrames.length]);
      i++;
    }, 180);
  }

  function stopMouthFlap() {
    clearInterval(mouthFlap);
    mouthFlap = null;
  }

  function getTalkFrames() {
    if (damageState === "heavy") return ["heavydamagetalkA", "heavydamagetalkB"];
    if (damageState === "light") return ["lightdamagetalkA", "lightdamagetalkB"];
    return ["talk1", "talk2"];
  }

  function typeText(lines) {
    if (!tickerText) return;
    const token = ++typingToken;
    const text = Array.isArray(lines) ? lines.join(" ") : (lines || "");
    tickerText.innerHTML = "";
    let i = 0;

    function step() {
      if (token !== typingToken) return;
      if (i <= text.length) {
        const typed = text.slice(0, i);
        const glitch = i < text.length
          ? Array.from({ length: Math.min(3, text.length - i) },
            () => GLITCH[Math.floor(Math.random() * GLITCH.length)]).join("")
          : "";
        const lead = typed.slice(-1) || "";
        const rest = typed.slice(0, -1);
        tickerText.innerHTML =
          `<span style="color:#00ffee;text-shadow:0 0 6px #00ffee">${lead}</span>` +
          `<span style="color:#00d4d4">${rest}</span>` +
          `<span style="color:#003333;opacity:0.7">${glitch}</span>`;
        i++;
        setTimeout(step, 22 + Math.random() * 18);
      } else {
        tickerText.innerHTML = `<span style="color:#00cccc">${text}</span>`;
        try { window.playGameSfx?.("printtext", 0.5); } catch {}
      }
    }
    step();
  }

  function showTicker() {
    if (!ticker) return;
    configureSignalBars();
    ticker.classList.add("ticker-visible");
    tickerVisible = true;
    document.querySelectorAll(".sigbar")
      .forEach((b) => b.classList.add("sigbar-active"));
  }

  function hideTicker() {
    if (!ticker) return;
    ticker.classList.remove("ticker-visible");
    tickerVisible = false;
    if (tickerText) tickerText.innerHTML = "";
    setTimeout(() => {
      document.querySelectorAll(".sigbar")
        .forEach((b) => b.classList.remove("sigbar-active"));
      configureSignalBars();
    }, 300);
  }

  function configureSignalBars() {
    const bars = document.querySelectorAll(".sigbar");
    const resting = [
      { height: "4px", background: "#00d4d4" },
      { height: "6px", background: "#00d4d4" },
      { height: "9px", background: "#00d4d4" },
      { height: "12px", background: "#00d4d4" },
      { height: "5px", background: "#003333" },
    ];
    bars.forEach((bar, index) => {
      const cfg = resting[index];
      if (!cfg) return;
      bar.style.transition = "height 0.4s ease";
      if (!bar.classList.contains("sigbar-active")) {
        bar.style.height = cfg.height;
      }
      bar.style.background = cfg.background;
    });
  }

  function show() {
    if (!hud) return;
    hud.style.display = "block";
    hudVisible = true;
    setFrame(currentFrame || "idle");
    startIdle();
  }

  function hide() {
    if (!hud) return;
    hud.style.display = "none";
    hudVisible = false;
    stopVO();
    stopIdle();
    stopMouthFlap();
    hideTicker();
  }

  function stopVO() {
    typingToken += 1;
    _voQueue.length = 0;
    _voPlaying = false;
    _voPlayToken += 1;
    _voTriggerToken += 1;
    if (_voQueueTimer) {
      clearTimeout(_voQueueTimer);
      _voQueueTimer = null;
    }
    stopIdle();
    stopMouthFlap();
    hideTicker();
    clearTimeout(tickerHideTimer);
    tickerHideTimer = null;
    if (voAudio) {
      voAudio.pause();
      voAudio = null;
    }
  }

  function setDamageState(state) {
    damageState = state;
  }

  function reactTo(eventType) {
    if (!hudVisible) return;
    const reactions = {
      ufo: "shockd",
      landmine: "shockd",
      landmine_armed: "laugh",
      chaos: "angry",
      commander: "commander",
      angry: "angry",
      smirk: "smirk",
      levelcomplete: ["laugh", "laugh2"],
      lowlives: "exhausted",
      plasmacharged: "smirk",
      plasma_recharged: "smirk",
      boss: "angry",
      thinking: "thinking",
    };
    const r = reactions[eventType];
    if (!r) return;
    stopMouthFlap();
    const frame = Array.isArray(r)
      ? r[Math.floor(Math.random() * r.length)]
      : r;
    setFrame(frame);
    setTimeout(() => {
      if (!mouthFlap) tickIdle();
    }, 2000);
  }

  function commVoSrc(filename) {
    if (!availableVoFiles.has(filename)) return null;
    if (VO3_FILES.has(filename) || /^[A-Z]/.test(filename)) {
      return `assets/vo3/${filename}`;
    }
    return `vo/${filename}`;
  }

  function triggerVO({
    lines = [],
    audioSrc = null,
    duration = 3500,
    frame = null,
    event = null,
    onDone = null,
    _onEnd = null,
  } = {}) {
    if (!hudVisible) show();
    if (!hudVisible) {
      if (_onEnd) _onEnd();
      return;
    }
    const triggerToken = ++_voTriggerToken;

    let resolvedLines = lines;
    if ((!lines || lines.length === 0) && audioSrc) {
      const filename = audioSrc.split("/").pop();
      const caption = VO_CAPTIONS[filename];
      if (caption) resolvedLines = [caption];
    }

    if (tickerHideTimer) {
      clearTimeout(tickerHideTimer);
      tickerHideTimer = null;
    }
    if (voAudio) {
      voAudio.pause();
      voAudio = null;
    }

    stopMouthFlap();
    if (frame) {
      setFrame(frame);
    } else if (event) {
      reactTo(event);
    }

    let doneCalled = false;
    const finish = () => {
      if (doneCalled) return;
      doneCalled = true;
      if (onDone) onDone();
      if (_onEnd) _onEnd();
    };

    let talkingEnded = false;
    const endTalking = () => {
      if (talkingEnded) return;
      talkingEnded = true;
      stopMouthFlap();
      tickIdle();
      tickerHideTimer = setTimeout(() => {
        hideTicker();
        finish();
      }, 1200);
    };

    try {
      const sfx = typeof playGameSfx === "function" ? playGameSfx : window.playGameSfx;
      if (typeof sfx === "function") {
        sfx("blip1", 0.3, { rate: 0.65 });
      }
    } catch (e) {
      // ignore
    }
    const voDelay = 280;

    const beginMainVO = () => {
      if (triggerToken !== _voTriggerToken) return;
      startMouthFlap(getTalkFrames());
      showTicker();
      typeText(resolvedLines);

      if (audioSrc) {
        let audioFallbackTimer = null;
        const finishAudio = () => {
          if (audioFallbackTimer) clearTimeout(audioFallbackTimer);
          endTalking();
        };
        try {
          voAudio = new Audio(audioSrc);
          voAudio.volume = 0.7;
          voAudio.play().catch(() => {
            if (!audioFallbackTimer) audioFallbackTimer = setTimeout(endTalking, duration);
          });
          voAudio.addEventListener("ended", finishAudio);
          audioFallbackTimer = setTimeout(endTalking, duration);
        } catch {
          tickerHideTimer = setTimeout(endTalking, duration);
        }
      } else {
        tickerHideTimer = setTimeout(endTalking, duration);
      }
    };

    setTimeout(beginMainVO, voDelay);
  }

  function playVONow(options = {}) {
    if (_voQueueTimer) {
      clearTimeout(_voQueueTimer);
      _voQueueTimer = null;
    }
    const playToken = ++_voPlayToken;
    _voPlaying = true;
    const onEnd = options._onEnd;
    triggerVO({
      ...options,
      _onEnd: () => {
        if (playToken !== _voPlayToken) return;
        if (onEnd) onEnd();
        _voPlaying = false;
        if (_voQueue.length > 0) {
          const next = _voQueue.shift();
          _voQueueTimer = setTimeout(() => {
            _voQueueTimer = null;
            playVONow(next);
          }, 600);
        }
      },
    });
  }

  function queueVO(options = {}) {
    const highPriority = options.priority === "high";
    if (highPriority) {
      _voQueue.length = 0;
      playVONow(options);
      return;
    }
    if (!_voPlaying) {
      playVONow(options);
    } else if (_voQueue.length < 2) {
      _voQueue.push(options);
    }
  }

  function init() {
    if (hud) hud.style.display = "none";
    configureSignalBars();
    setFrame("idle");
  }

  return {
    init,
    show,
    hide,
    stopVO,
    triggerVO,
    queueVO,
    commVoSrc,
    setDamageState,
    reactTo,
    pickFromPool,
    POOL_LEVEL_START,
    POOL_LEVEL_COMPLETE,
    POOL_NICE_SHOT,
    POOL_HYPE,
    POOL_BOMB,
    POOL_DETONATE,
    POOL_LOW_LIVES,
    POOL_COCKY,
    POOL_LANDMINE_ARMED,
    POOL_PLASMA_RECHARGED,
    POOL_PLASMA_HINT,
  };
})();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => commBoxController.init());
} else {
  commBoxController.init();
}

const vault = document.getElementById("vault");
const closeVault = document.getElementById("closeVault");
const vaultSearch = document.getElementById("vaultSearch");
const vaultList = document.getElementById("vaultList");
const vaultFilterAll = document.getElementById("vaultFilterAll");
const vaultFilterFav = document.getElementById("vaultFilterFav");
const vaultStats = document.getElementById("vaultStats");
const openContact = document.getElementById("openContact");
const contactModal = document.getElementById("contactModal");
const closeContact = document.getElementById("closeContact");
const contactForm = document.getElementById("contactForm");
const contactHoney = document.getElementById("contactHoney");
const contactEmail = document.getElementById("contactEmail");
const contactSubject = document.getElementById("contactSubject");
const contactPlatform = document.getElementById("contactPlatform");
const contactMessage = document.getElementById("contactMessage");
const formspreeEndpoint = String(window.POLY_CONTACT_FORM_ENDPOINT || "").trim();

let audioContext;
let nativeTtsWarned = false;
let hintTimeout;
let chaosToastTimeout;
let crystalOverlayStopTimer = null;
let orbStrobeController = null;
let galaxyController;
let galaxyCanvasController;
let oracleBgController;
let titleSparkleTimer = null;
let mediaPrimed = false;
let speechPrimed = false;
let gamePageActive = false;
let menuOverlayOpen = false;
let gameOverFuzzyInstance = null;
let retryFuzzyInstance = null;
const bgCtl = {
  a: null,
  b: null,
  front: null,
  back: null,
  currentKey: null,
  ready: false,
  token: 0,
};
const orbTapPool = [];
let orbTapPoolIndex = 0;
let lastOrbTapAt = 0;
let lastOrbTouchEndAt = 0;
let orbTapBuffer = null;
let orbTapBufferPromise = null;
let chaosShiftAudio = null;
const boomTimes = [];

function createFuzzyText(canvas, opts = {}) {
  if (!canvas) {
    return { destroy() {} };
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return { destroy() {} };
  }

  const cfg = {
    text: opts?.text || "",
    fontFamily: opts?.fontFamily || "\"Arial Black\", Impact, sans-serif",
    fontWeight: opts?.fontWeight || 900,
    fontSize: opts?.fontSize || 64,
    color: opts?.color || "#ffe9e9",
    enableHover: opts?.enableHover ?? true,
    baseIntensity: opts?.baseIntensity ?? 0.18,
    hoverIntensity: opts?.hoverIntensity ?? 0.5,
    fuzzRange: opts?.fuzzRange ?? 30,
    fps: opts?.fps ?? 60,
    direction: opts?.direction || "horizontal",
    transitionDuration: opts?.transitionDuration ?? 0,
    clickEffect: opts?.clickEffect ?? true,
    glitchMode: opts?.glitchMode ?? false,
    glitchInterval: opts?.glitchInterval ?? 2000,
    glitchDuration: opts?.glitchDuration ?? 200,
    letterSpacing: opts?.letterSpacing ?? 0,
    pulseOnMount: opts?.pulseOnMount ?? false,
    pulseIntensity: opts?.pulseIntensity ?? 1.0,
    pulseMs: opts?.pulseMs ?? 350,
  };

  let raf = 0;
  let destroyed = false;
  let lastFrameAt = 0;
  let isHovering = false;
  let isClicking = false;
  let isGlitching = false;
  let clickUntil = 0;
  let glitchUntil = 0;
  let pulseUntil = 0;
  let targetIntensity = cfg.baseIntensity;
  let currentIntensity = cfg.baseIntensity;
  const frameMs = 1000 / Math.max(20, cfg.fps);
  const offscreen = document.createElement("canvas");
  const offCtx = offscreen.getContext("2d");
  const dpr = nativeCanvasDpr();
  let textW = 0;
  let textH = 0;
  let marginX = 0;

  function setupCanvases() {
    if (!offCtx) return;
    const fontPx = Math.max(28, Number(cfg.fontSize) || 64);
    offCtx.font = `${cfg.fontWeight} ${fontPx}px ${cfg.fontFamily}`;
    offCtx.textBaseline = "alphabetic";

    let totalWidth = 0;
    if (cfg.letterSpacing !== 0) {
      for (const ch of cfg.text) {
        totalWidth += offCtx.measureText(ch).width + cfg.letterSpacing;
      }
      totalWidth -= cfg.letterSpacing;
    } else {
      totalWidth = offCtx.measureText(cfg.text).width;
    }
    const metrics = offCtx.measureText(cfg.text);
    const actualLeft = metrics.actualBoundingBoxLeft ?? 0;
    const actualRight = cfg.letterSpacing !== 0 ? totalWidth : (metrics.actualBoundingBoxRight ?? metrics.width);
    const actualAscent = metrics.actualBoundingBoxAscent ?? fontPx;
    const actualDescent = metrics.actualBoundingBoxDescent ?? fontPx * 0.2;
    textW = Math.ceil(cfg.letterSpacing !== 0 ? totalWidth : actualLeft + actualRight);
    textH = Math.ceil(actualAscent + actualDescent);

    const extraWidthBuffer = 10;
    const xOffset = extraWidthBuffer / 2;
    offscreen.width = textW + extraWidthBuffer;
    offscreen.height = textH;
    offCtx.clearRect(0, 0, offscreen.width, offscreen.height);
    offCtx.font = `${cfg.fontWeight} ${fontPx}px ${cfg.fontFamily}`;
    offCtx.textBaseline = "alphabetic";
    offCtx.fillStyle = cfg.color;
    if (cfg.letterSpacing !== 0) {
      let xPos = xOffset;
      for (const ch of cfg.text) {
        offCtx.fillText(ch, xPos, actualAscent);
        xPos += offCtx.measureText(ch).width + cfg.letterSpacing;
      }
    } else {
      offCtx.fillText(cfg.text, xOffset - actualLeft, actualAscent);
    }

    marginX = cfg.fuzzRange + 20;
    const cssW = offscreen.width + marginX * 2;
    const cssH = textH;
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.translate(marginX, 0);
  }

  function tick(ts) {
    if (destroyed) return;
    if (ts - lastFrameAt < frameMs) {
      raf = requestAnimationFrame(tick);
      return;
    }
    lastFrameAt = ts;

    const nowMs = performance.now();
    if (clickUntil && nowMs >= clickUntil) {
      isClicking = false;
      clickUntil = 0;
    }
    if (glitchUntil && nowMs >= glitchUntil) {
      isGlitching = false;
      glitchUntil = 0;
    }
    if (cfg.glitchMode && !isGlitching && !glitchUntil) {
      glitchUntil = nowMs + cfg.glitchInterval;
    }
    if (cfg.glitchMode && glitchUntil && nowMs >= glitchUntil && !isGlitching) {
      isGlitching = true;
      glitchUntil = nowMs + cfg.glitchDuration;
    }

    if (pulseUntil && nowMs < pulseUntil) {
      targetIntensity = cfg.pulseIntensity;
    } else if (isClicking || isGlitching) {
      targetIntensity = 1;
    } else if (isHovering) {
      targetIntensity = cfg.hoverIntensity;
    } else {
      targetIntensity = cfg.baseIntensity;
    }
    if (cfg.transitionDuration > 0) {
      const step = 1 / (cfg.transitionDuration / frameMs);
      if (currentIntensity < targetIntensity) {
        currentIntensity = Math.min(currentIntensity + step, targetIntensity);
      } else if (currentIntensity > targetIntensity) {
        currentIntensity = Math.max(currentIntensity - step, targetIntensity);
      }
    } else {
      currentIntensity += (targetIntensity - currentIntensity) * 0.22;
    }

    if (isGlitching && glitchUntil && nowMs >= glitchUntil) {
      isGlitching = false;
      glitchUntil = nowMs + cfg.glitchInterval;
    }

    const clearW = offscreen.width + 2 * (cfg.fuzzRange + 24);
    const clearH = textH + 2 * (cfg.fuzzRange + 14);
    ctx.clearRect(-(cfg.fuzzRange + 24), -(cfg.fuzzRange + 14), clearW, clearH);
    if (cfg.direction === "vertical") {
      for (let i = 0; i < offscreen.width; i += 1) {
        const dy = Math.floor(currentIntensity * (Math.random() - 0.5) * cfg.fuzzRange);
        ctx.drawImage(offscreen, i, 0, 1, textH, i, dy, 1, textH);
      }
    } else {
      for (let j = 0; j < textH; j += 1) {
        const dx = Math.floor(currentIntensity * (Math.random() - 0.5) * cfg.fuzzRange);
        ctx.drawImage(offscreen, 0, j, offscreen.width, 1, dx, j, offscreen.width, 1);
      }
    }

    raf = requestAnimationFrame(tick);
  }

  function start() {
    if (destroyed || raf) return;
    raf = requestAnimationFrame(tick);
  }

  const onEnter = () => {
    if (!cfg.enableHover) return;
    isHovering = true;
    start();
  };
  const onLeave = () => {
    if (!cfg.enableHover) return;
    isHovering = false;
    start();
  };
  const onDown = () => {
    if (!cfg.clickEffect) return;
    isClicking = true;
    clickUntil = performance.now() + 130;
    start();
  };
  const onResize = () => {
    setupCanvases();
    start();
  };

  canvas.addEventListener("pointerenter", onEnter);
  canvas.addEventListener("pointerleave", onLeave);
  canvas.addEventListener("pointerdown", onDown);
  window.addEventListener("resize", onResize);

  setupCanvases();
  if (cfg.pulseOnMount) {
    pulseUntil = performance.now() + cfg.pulseMs;
  }
  start();

  return {
    destroy() {
      destroyed = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      canvas.removeEventListener("pointerenter", onEnter);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("pointerdown", onDown);
      window.removeEventListener("resize", onResize);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    },
  };
}

function fuzzyNeonPreset(text) {
  return {
    text,
    fontSize: 64,
    baseIntensity: 0.18,
    hoverIntensity: 0.5,
    fuzzRange: 30,
    fps: 60,
    direction: "horizontal",
    transitionDuration: 0,
    clickEffect: true,
    glitchMode: false,
    glitchInterval: 2000,
    glitchDuration: 200,
    letterSpacing: 0,
    pulseOnMount: false,
    pulseIntensity: 1.0,
    pulseMs: 350,
  };
}

function ensureGameOverFuzzyCanvas() {
  if (!arcadeOverlay) return null;
  let canvas = document.getElementById("gameOverFuzzy");
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.id = "gameOverFuzzy";
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.display = "none";
    canvas.style.width = "min(92vw, 680px)";
    canvas.style.height = "64px";
    canvas.style.margin = "6px auto 4px";
    canvas.style.pointerEvents = "auto";
    arcadeOverlay.insertBefore(canvas, arcadeOverlayBtn || null);
  }
  return canvas;
}

function unmountGameOverFuzzy() {
  if (gameOverFuzzyInstance) {
    gameOverFuzzyInstance.destroy();
    gameOverFuzzyInstance = null;
  }
  const c = document.getElementById("gameOverFuzzy");
  if (c) c.style.display = "none";
}

function mountGameOverFuzzy() {
  const c = ensureGameOverFuzzyCanvas();
  if (!c) return;
  if (gameOverFuzzyInstance) gameOverFuzzyInstance.destroy();

  const preset = fuzzyNeonPreset("You Died. Progress Lost.");
  preset.fontSize = Math.max(30, Math.min(48, Math.floor((window.innerWidth || 390) * 0.082)));
  preset.pulseOnMount = true;
  preset.pulseIntensity = 1.0;
  preset.pulseMs = 360;
  preset.fuzzRange = 22;
  preset.fps = 50;
  preset.enableHover = false;
  preset.clickEffect = false;
  preset.glitchMode = true;
  preset.glitchDuration = 140;
  preset.glitchInterval = 1200;

  c.style.display = "block";
  gameOverFuzzyInstance = createFuzzyText(c, preset);
}

function unmountRetryFuzzy() {
  if (retryFuzzyInstance) {
    retryFuzzyInstance.destroy();
    retryFuzzyInstance = null;
  }
}

function mountRetryFuzzy() {
  const c = ensureGameOverFuzzyCanvas();
  if (!c) return;
  if (retryFuzzyInstance) retryFuzzyInstance.destroy();

  const preset = fuzzyNeonPreset("Try Again?");
  preset.fontSize = Math.max(36, Math.min(52, Math.floor((window.innerWidth || 390) * 0.09)));
  preset.pulseOnMount = false;
  preset.baseIntensity = 0.11;
  preset.hoverIntensity = 0.2;
  preset.fuzzRange = 10;
  preset.fps = 42;
  preset.enableHover = false;
  preset.clickEffect = false;
  preset.glitchMode = false;

  c.style.display = "block";
  retryFuzzyInstance = createFuzzyText(c, preset);
}

let _soundsLoading = false;
let _soundsLoaded = false;
let _soundsLoadPromise = null;
let _musicWasPlaying = false;
let _musicCurrentTime = 0;
let _musicResumeKey = "";
let _musicResumeUrl = "";

const audioEngine = {
  ctx: null,
  masterGain: null,
  musicGain: null,
  musicBuffers: new Map(),
  currentMusic: null,
  currentMusicHtml: null,
  buffers: new Map(),
  loops: new Map(),
  htmlAudioPool: new Map(),
  voices: new Map(),
  maxVoicesPerSound: 8,
  unlocked: false,
  ensureContext() {
    if (this.ctx) return this.ctx;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.75;
    this.masterGain.connect(this.ctx.destination);
    return this.ctx;
  },
  async unlock() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (ctx.state !== "running") {
      try {
        await ctx.resume();
      } catch {
        // ignore
      }
    }
    this.unlocked = ctx.state === "running";
  },
  resume() {
    return this.unlock();
  },
  async loadSound(name, url) {
    if (this.buffers.has(name)) return this.buffers.get(name);
    const ctx = this.ensureContext();
    if (!ctx) return null;
    let resolvedUrl;
    try {
      resolvedUrl = new URL(url, document.baseURI).href;
    } catch {
      resolvedUrl = url;
    }
    try {
      const arr = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("GET", resolvedUrl, true);
        xhr.responseType = "arraybuffer";
        xhr.timeout = 5000;
        xhr.onload = () => {
          if (xhr.status === 200 || xhr.status === 0) {
            resolve(xhr.response);
          } else {
            reject(new Error(`XHR ${xhr.status}`));
          }
        };
        xhr.onerror = () => reject(new Error("XHR network error"));
        xhr.ontimeout = () => reject(new Error("XHR timeout"));
        xhr.send();
      });
      const decoded = await ctx.decodeAudioData(arr.slice(0));
      this.buffers.set(name, decoded);
      return decoded;
    } catch {
      return null;
    }
  },
  loadMany(mapNameToUrl) {
    if (_soundsLoaded) return Promise.resolve();
    if (_soundsLoading) return _soundsLoadPromise || Promise.resolve();
    const soundMap = mapNameToUrl || {};
    const priorityKeys = [
      "explosion_med",
      "explosion_big",
      "advfire",
      "ufo_destroy",
      "landmine_boom",
      "plasmarecharged",
    ];
    const orderedKeys = [
      ...priorityKeys.filter((key) => soundMap[key]),
      ...Object.keys(soundMap).filter((key) => !priorityKeys.includes(key)),
    ];
    _soundsLoading = true;
    _soundsLoadPromise = (async () => {
      try {
        for (let i = 0; i < orderedKeys.length; i += 1) {
          const name = orderedKeys[i];
          try {
            await this.loadSound(name, soundMap[name]);
          } catch {
            // Skip individual failed sounds and continue loading the rest.
          }
        }
        _soundsLoaded = true;
      } finally {
        _soundsLoading = false;
      }
    })();
    return _soundsLoadPromise;
  },
  enforcePolyphony(name, maxVoices = this.maxVoicesPerSound, mode = "drop_newest") {
    const voices = this.voices.get(name);
    if (!voices || voices.length < maxVoices) return true;
    if (mode === "steal_oldest") {
      const dropCount = voices.length - maxVoices + 1;
      for (let i = 0; i < dropCount; i += 1) {
        const oldest = voices.shift();
        if (!oldest?.source) continue;
        try {
          oldest.source.stop();
        } catch {
          // ignore
        }
      }
      if (!voices.length) this.voices.delete(name);
      return true;
    }
    // Do not cut currently playing voices on spam; drop newest trigger instead.
    return false;
  },
  releaseVoice(name, source) {
    const voices = this.voices.get(name);
    if (!voices || !voices.length) return;
    const index = voices.findIndex((voice) => voice.source === source);
    if (index >= 0) voices.splice(index, 1);
    if (!voices.length) this.voices.delete(name);
  },
  playHtmlAudio(name, { volume = 1, rate = 1, loop = false } = {}) {
    const src = GAME_SFX?.[name];
    if (!src) return { stop() {}, ended: Promise.resolve() };
    const pool = this.htmlAudioPool.get(src) || [];
    let node = null;
    for (let i = 0; i < pool.length; i += 1) {
      if (pool[i].paused || pool[i].ended) {
        node = pool[i];
        break;
      }
    }
    if (!node) {
      node = new Audio(src);
      node.preload = "auto";
      node.playsInline = true;
      pool.push(node);
      this.htmlAudioPool.set(src, pool);
    }
    node.loop = !!loop;
    node.playbackRate = clamp(rate, 0.5, 2);
    node.volume = clamp(volume, 0, 1);
    try {
      node.currentTime = 0;
    } catch {
      // ignore
    }
    const ended = new Promise((resolve) => {
      if (loop) {
        resolve();
        return;
      }
      const finish = () => {
        node.removeEventListener("ended", finish);
        node.removeEventListener("error", finish);
        resolve();
      };
      node.addEventListener("ended", finish, { once: true });
      node.addEventListener("error", finish, { once: true });
    });
    node.play().catch(() => {});
    return {
      stop() {
        node.pause();
      },
      ended,
    };
  },
  play(name, { volume = 1, rate = 1, detune = 0 } = {}) {
    const ctx = this.ensureContext();
    if (!ctx || !this.unlocked) {
      return this.playHtmlAudio(name, { volume, rate, loop: false });
    }
    const buffer = this.buffers.get(name);
    if (!buffer) {
      return this.playHtmlAudio(name, { volume, rate, loop: false });
    }
    const isExplosionLike = name === "explosion_big"
      || name === "explosion_med"
      || name === "explosion_small"
      || name === "landmine_boom"
      || name === "astcollide1"
      || name === "astcollide2";
    const maxVoices = name === "orb_tap"
      ? 10
      : (isExplosionLike ? (isIOSWebKit ? 24 : 16) : this.maxVoicesPerSound);
    const mode = name === "orb_tap" ? "drop_newest" : (isExplosionLike ? "steal_oldest" : "drop_newest");
    if (!this.enforcePolyphony(name, maxVoices, mode)) {
      return { source: null, ended: Promise.resolve() };
    }
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    source.detune.value = detune;
    gain.gain.value = clamp(volume, 0, 1);
    source.connect(gain);
    gain.connect(this.masterGain);
    const voices = this.voices.get(name) || [];
    voices.push({ source, startedAt: ctx.currentTime });
    this.voices.set(name, voices);
    const ended = new Promise((resolve) => {
      source.onended = () => {
        this.releaseVoice(name, source);
        resolve();
      };
    });
    source.start(0);
    return { source, ended };
  },
  playLoop(name, { volume = 1, rate = 1, detune = 0 } = {}) {
    const ctx = this.ensureContext();
    if (!ctx || !this.unlocked) {
      if (isIOSNative) return null;
      return this.playHtmlAudio(name, { volume, rate, loop: true });
    }
    if (this.loops.has(name)) return this.loops.get(name);
    const buffer = this.buffers.get(name);
    if (!buffer) {
      if (isIOSNative) return null;
      return this.playHtmlAudio(name, { volume, rate, loop: true });
    }
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = buffer;
    source.loop = true;
    source.playbackRate.value = rate;
    source.detune.value = detune;
    gain.gain.value = clamp(volume, 0, 1);
    source.connect(gain);
    gain.connect(this.masterGain);
    let endedResolve;
    const ended = new Promise((resolve) => {
      endedResolve = resolve;
    });
    const handle = {
      source,
      stop: () => {
        try {
          source.stop();
        } catch {
          // ignore
        }
        this.loops.delete(name);
        if (endedResolve) endedResolve();
      },
      ended,
    };
    source.onended = () => {
      this.loops.delete(name);
      if (endedResolve) endedResolve();
    };
    source.start(0);
    this.loops.set(name, handle);
    return handle;
  },
  ensureMusic() {
    this.ensureContext();
    if (!this.ctx) return;
    if (!this.musicGain) {
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = MUSIC_MAX_GAIN;
      if (this.masterGain) this.musicGain.connect(this.masterGain);
      else this.musicGain.connect(this.ctx.destination);
    }
  },
  async loadMusicBuffer(url) {
    this.ensureMusic();
    if (!this.ctx) return null;
    if (this.musicBuffers.has(url)) return this.musicBuffers.get(url);
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      const arr = await response.arrayBuffer();
      const decoded = await this.ctx.decodeAudioData(arr.slice(0));
      this.musicBuffers.set(url, decoded);
      return decoded;
    } catch {
      return null;
    }
  },
  async playMusic(key, url, { crossfadeMs = 250 } = {}) {
    if (!url) return;
    this.ensureMusic();
    if (!this.unlocked) {
      try {
        await this.unlock();
      } catch {
        // ignore
      }
    }
    if (this.currentMusic && this.currentMusic.key === key) return;
    if (this.currentMusicHtml && this.currentMusicHtml.key === key) return;
    const buffer = await this.loadMusicBuffer(url);
    if (!buffer || !this.ctx || !this.unlocked) {
      const prev = this.currentMusicHtml;
      if (prev && prev.key === key) return;
      if (prev && prev.node) {
        prev.node.pause();
      }
      const node = new Audio(url);
      node.preload = "auto";
      node.loop = true;
      node.playsInline = true;
      node.volume = state.whisper ? 0.43 : MUSIC_MAX_GAIN;
      node.play().catch(() => {});
      this.currentMusicHtml = { key, url, node };
      return;
    }
    if (this.currentMusicHtml?.node) {
      this.currentMusicHtml.node.pause();
      this.currentMusicHtml = null;
    }
    const source = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    source.buffer = buffer;
    source.loop = true;
    gain.gain.value = 0;
    source.connect(gain);
    gain.connect(this.musicGain || this.masterGain || this.ctx.destination);
    const now = this.ctx.currentTime;
    source.start(now);
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + crossfadeMs / 1000);
    if (this.currentMusic) {
      const old = this.currentMusic;
      try {
        old.gain.gain.cancelScheduledValues(now);
        old.gain.gain.setValueAtTime(old.gain.gain.value, now);
        old.gain.gain.linearRampToValueAtTime(0, now + crossfadeMs / 1000);
        setTimeout(() => {
          try {
            old.source.stop();
          } catch {
            // ignore
          }
        }, crossfadeMs + 60);
      } catch {
        // ignore
      }
    }
    this.currentMusic = { key, url, source, gain, startedAt: performance.now(), ctxStartedAt: this.ctx.currentTime };
  },
  stopMusic() {
    _musicWasPlaying = false;
    _musicCurrentTime = 0;
    _musicResumeKey = "";
    _musicResumeUrl = "";
    if (this.currentMusicHtml?.node) {
      this.currentMusicHtml.node.pause();
      this.currentMusicHtml = null;
    }
    if (!this.currentMusic) return;
    try {
      this.currentMusic.source.stop();
    } catch {
      // ignore
    }
    this.currentMusic = null;
  },
  setMusicDim(dimOn) {
    if (this.currentMusicHtml?.node) {
      const full = state.whisper ? 0.43 : MUSIC_MAX_GAIN;
      this.currentMusicHtml.node.volume = dimOn ? (full * 0.3) : full;
    }
    this.ensureMusic();
    if (!this.musicGain || !this.ctx) return;
    const target = dimOn ? MUSIC_MAX_GAIN * 0.3 : MUSIC_MAX_GAIN;
    const now = this.ctx.currentTime;
    this.musicGain.gain.cancelScheduledValues(now);
    this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, now);
    this.musicGain.gain.linearRampToValueAtTime(target, now + 0.12);
  },
  stopLoop(name) {
    const loop = this.loops.get(name);
    if (loop) loop.stop();
  },
  stopAllLoops() {
    const names = Array.from(this.loops.keys());
    for (let i = 0; i < names.length; i += 1) this.stopLoop(names[i]);
  },
  getDuration(name, rate = 1) {
    const buffer = this.buffers.get(name);
    if (!buffer) return 0;
    return buffer.duration / Math.max(0.01, rate || 1);
  },
};

function saveBackgroundMusicState() {
  const htmlMusic = audioEngine.currentMusicHtml?.node
    || document.querySelector('audio[src*="Kaleidoscope"]')
    || window._bgMusicAudio;
  if (htmlMusic && !htmlMusic.paused) {
    _musicWasPlaying = true;
    _musicCurrentTime = htmlMusic.currentTime || 0;
    _musicResumeKey = audioEngine.currentMusicHtml?.key || _musicResumeKey;
    _musicResumeUrl = audioEngine.currentMusicHtml?.url || htmlMusic.currentSrc || htmlMusic.src || _musicResumeUrl;
    return;
  }

  if (audioEngine.currentMusic) {
    _musicWasPlaying = true;
    _musicResumeKey = audioEngine.currentMusic.key || _musicResumeKey;
    _musicResumeUrl = audioEngine.currentMusic.url || _musicResumeUrl;
    const startedAt = audioEngine.currentMusic.ctxStartedAt || 0;
    const elapsed = Math.max(0, (audioEngine.ctx?.currentTime || startedAt) - startedAt);
    const buffer = _musicResumeUrl ? audioEngine.musicBuffers.get(_musicResumeUrl) : null;
    _musicCurrentTime = buffer?.duration ? elapsed % buffer.duration : elapsed;
  }
}

function resumeBackgroundMusic() {
  if (!_musicWasPlaying) return;
  const htmlMusic = audioEngine.currentMusicHtml?.node
    || document.querySelector('audio[src*="Kaleidoscope"]')
    || window._bgMusicAudio;
  if (htmlMusic) {
    if (htmlMusic.paused) {
      try {
        if (Number.isFinite(_musicCurrentTime)) htmlMusic.currentTime = _musicCurrentTime;
      } catch {
        // Some platforms reject currentTime while media is not ready.
      }
      htmlMusic.play().catch(() => {});
    }
    return;
  }

  if (audioEngine.currentMusic) return;
  if (_musicResumeKey && _musicResumeUrl) {
    audioEngine.playMusic(_musicResumeKey, _musicResumeUrl, { crossfadeMs: 0 }).catch?.(() => {});
  }
}

function preloadSfx() {
  audioEngine.loadMany(GAME_SFX);
}

async function playSfxAndWait(name, { volume = 1, rate = 1, detune = 0, maxWaitMs = 8000 } = {}) {
  const handle = audioEngine.play(name, { volume, rate, detune });
  const durationMs = audioEngine.getDuration(name, rate) * 1000;
  const waitMs = clamp(durationMs || 300, 180, maxWaitMs);
  await Promise.race([handle?.ended || Promise.resolve(), delay(waitMs)]);
}

init();

function init() {
  setVh();
  resetUiOverlayState();
  loadState();
  preloadSfx();
  initGalaxyBackground();
  initGalaxyCanvas();
  initBackgroundVideos();
  applyTheme();
  buildPackSelect();
  warmVoices();
  populateVoices();
  applySettingsToUi();
  renderVault();
  setIntentState();
  setupFirstRunHint();
  initTitleSparkles();
  initOrbTapPool();
  addListeners();
  setGalaxyTool(state.galaxyTool);
}

function addListeners() {
  window.addEventListener("resize", setVh);
  window.addEventListener("orientationchange", setVh);
  questionInput.addEventListener("focus", setVh);
  questionInput.addEventListener("blur", setVh);

  const primeMediaOnGesture = () => {
    if (mediaPrimed) return;
    mediaPrimed = true;
    audioEngine.unlock();
    primeBackgroundMedia();
  };
  document.addEventListener("pointerdown", primeMediaOnGesture, { once: true });
  document.addEventListener("touchstart", primeMediaOnGesture, { once: true, passive: true });
  document.addEventListener("keydown", primeMediaOnGesture, { once: true });
  const resumeAudioOnGesture = () => {
    audioEngine.resume();
    try {
      if ("speechSynthesis" in window) window.speechSynthesis.resume();
    } catch {
      // ignore
    }
  };
  document.addEventListener("pointerdown", resumeAudioOnGesture, { passive: true });
  document.addEventListener("touchstart", resumeAudioOnGesture, { passive: true });
  document.addEventListener("keydown", resumeAudioOnGesture);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      if (audioEngine?.ctx?.state === "suspended") {
        audioEngine.ctx.resume().catch(() => {});
      }
      audioEngine.resume();
      resumeBackgroundMusic();
      try {
        if ("speechSynthesis" in window) window.speechSynthesis.resume();
      } catch {
        // ignore
      }
    } else {
      saveBackgroundMusicState();
      audioEngine.stopAllLoops();
    }
  });
  window.addEventListener("focus", () => {
    if (audioEngine?.ctx?.state === "suspended") {
      audioEngine.ctx.resume().catch(() => {});
    }
    audioEngine.resume();
    resumeBackgroundMusic();
    try {
      if ("speechSynthesis" in window) window.speechSynthesis.resume();
    } catch {
      // ignore
    }
  });

  questionInput.addEventListener("input", () => {
    setIntentState();
    hapticTap();
  });

  questionInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !askButton.disabled && !state.isRevealing) {
      revealAnswer();
    }
  });

  askButton.addEventListener("click", revealAnswer);

  const onOrbTap = (event) => {
    if (event.cancelable) event.preventDefault();
    audioEngine.unlock();
    const now = performance.now();
    // Keep only a tiny dedupe window so rapid intentional taps still sound on iOS.
    const tapCooldownMs = isIOSWebKit ? 24 : 24;
    if (now - lastOrbTapAt >= tapCooldownMs) {
      lastOrbTapAt = now;
      const intensity = registerOrbTap();
      const safeIntensity = isIOSWebKit
        ? {
            ...intensity,
            burstCount: Math.min(intensity.burstCount, 8),
            sizeMultiplier: Math.min(intensity.sizeMultiplier, 1.5),
            brightnessMultiplier: Math.min(intensity.brightnessMultiplier, 1.5),
          }
        : intensity;
      if (intensity.shouldShiftTheme) {
        triggerChaosTheme();
      }
      playPixySound(safeIntensity);
      spawnSparkles(safeIntensity.burstCount, safeIntensity.sizeMultiplier, safeIntensity.brightnessMultiplier);
    }
    // Orb tap is ambient feedback only (sparkles + sound + the input shake) — same
    // behavior whether or not the question field has text. Reveal is triggered only by
    // the Ask button / Enter, never by tapping the orb.
    shakeQuestionInput();
  };
  if ("PointerEvent" in window) {
    orb.addEventListener("pointerdown", onOrbTap);
    orb.addEventListener("touchend", (event) => {
      const now = performance.now();
      if (now - lastOrbTouchEndAt < 320 && event.cancelable) event.preventDefault();
      lastOrbTouchEndAt = now;
    }, { passive: false });
    orb.addEventListener("dblclick", (event) => {
      if (event.cancelable) event.preventDefault();
    }, { passive: false });
  } else {
    orb.addEventListener("touchstart", onOrbTap, { passive: false });
    orb.addEventListener("touchend", (event) => {
      const now = performance.now();
      if (now - lastOrbTouchEndAt < 320 && event.cancelable) event.preventDefault();
      lastOrbTouchEndAt = now;
    }, { passive: false });
    orb.addEventListener("mousedown", onOrbTap);
  }

  flipAnswer.addEventListener("click", () => {
    if (!state.currentAnswer) return;
    state.flip = !state.flip;
    renderAnswerCard();
  });

  favoriteAnswer.addEventListener("click", () => {
    if (!state.currentAnswer) return;
    const entry = state.vault.find((item) => item.id === state.currentAnswer.id);
    if (!entry) return;
    entry.favorite = !entry.favorite;
    renderAnswerCard();
    renderVault();
    saveState();
  });

  shareAnswer.addEventListener("click", () => {
    if (!state.currentAnswer) return;
    shareCurrentCard();
  });

  openSettings.addEventListener("click", () => {
    setSettingsOpen(true);
  });

  closeSettings.addEventListener("click", () => {
    setSettingsOpen(false);
  });

  settingsBackdrop.addEventListener("click", () => {
    setSettingsOpen(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (!galaxyView.hidden) {
        closeGalaxyView();
        return;
      }
      setSettingsOpen(false);
      vault.hidden = true;
    }
  });

  openGalaxy.addEventListener("click", () => {
    openGalaxyView();
  });

  closeGalaxy.addEventListener("click", () => {
    galaxyCanvasController?.showModeSelect?.({ preserveArcade: true, openArcadeMenu: true });
  });

  toolDraw.addEventListener("click", () => {
    if (galaxyCanvasController?.isArcade?.()) return;
    setGalaxyTool("draw");
  });

  toolBoom.addEventListener("click", () => {
    setGalaxyTool("boom");
  });

  if (clearGalaxy) {
    clearGalaxy.addEventListener("click", () => {
      if (!galaxyCanvasController?.clear) return;
      galaxyCanvasController.clear();
    });
  }

  if (btnArcade) {
    btnArcade.textContent = "Arcade";
    btnArcade.addEventListener("click", () => {
      galaxyCanvasController?.openArcadeMenu?.();
    });
  }
  if (btnPractice) {
    btnPractice.textContent = "Practice";
    if (!PRACTICE_ENABLED) {
      btnPractice.disabled = true;
      btnPractice.classList.add("is-disabled");
      btnPractice.setAttribute("aria-disabled", "true");
      btnPractice.title = "Practice mode temporarily unavailable";
    } else {
      btnPractice.addEventListener("click", () => {
        galaxyCanvasController?.startPractice?.();
      });
    }
  }
  if (btnGalaxyBack) {
    btnGalaxyBack.textContent = "\u2190 Oracle";
    btnGalaxyBack.addEventListener("click", () => closeGalaxyView());
  }
  if (arcadeBack) {
    arcadeBack.addEventListener("click", () => {
      galaxyCanvasController?.showModeSelect?.({ preserveArcade: true, openArcadeMenu: true });
    });
  }
  if (hudBombBtn) {
    hudBombBtn.addEventListener("click", () => {
      // 2026-06-09: arm aim mode; the next tap on the play area deploys the bomb there
      galaxyCanvasController?.toggleBombAim?.();
    });
  }
  if (hudFreezeBtn) {
    hudFreezeBtn.addEventListener("click", () => {
      galaxyCanvasController?.activateFreeze?.();
    });
  }
  if (btnArcadeNew) {
    btnArcadeNew.addEventListener("click", () => galaxyCanvasController?.startArcadeNew?.());
  }
  if (btnArcadeResume) {
    btnArcadeResume.addEventListener("click", () => galaxyCanvasController?.startArcadeResume?.());
  }
  if (btnArcadeLevelSelect) {
    btnArcadeLevelSelect.addEventListener("click", () => galaxyCanvasController?.openArcadeLevelSelect?.());
  }
  if (btnArcadeScores) {
    btnArcadeScores.hidden = true;
    btnArcadeScores.style.display = "none";
    btnArcadeScores.setAttribute("aria-hidden", "true");
    btnArcadeScores.addEventListener("click", () => showLeaderboard());
  }
  if (btnScores) {
    btnScores.textContent = "Scores";
    btnScores.addEventListener("click", () => showLeaderboard());
  }
  if (btnArcadeMenuBack) {
    btnArcadeMenuBack.addEventListener("click", () => galaxyCanvasController?.showModeSelect?.());
  }
  if (btnArcadeLevelBack) {
    btnArcadeLevelBack.addEventListener("click", () => galaxyCanvasController?.openArcadeMenu?.());
  }
  if (openContact && contactModal) {
    openContact.addEventListener("click", () => {
      contactModal.hidden = false;
      contactModal.setAttribute("aria-hidden", "false");
    });
  }
  if (closeContact && contactModal) {
    closeContact.addEventListener("click", () => {
      contactModal.hidden = true;
      contactModal.setAttribute("aria-hidden", "true");
    });
  }
  if (contactModal) {
    contactModal.addEventListener("click", (event) => {
      if (event.target === contactModal) {
        contactModal.hidden = true;
        contactModal.setAttribute("aria-hidden", "true");
      }
    });
  }
  if (contactForm) {
    contactForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const payload = {
        fromEmail: contactEmail?.value?.trim() || "",
        subject: contactSubject?.value?.trim() || "",
        platform: contactPlatform?.value || "desktop",
        message: contactMessage?.value?.trim() || "",
        website: contactHoney?.value || "",
        userAgent: navigator.userAgent,
        ts: Date.now(),
      };
      try {
        let sent = false;
        const response = await fetch("/api/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (response.ok) {
          sent = true;
        } else {
          const body = await response.json().catch(() => ({}));
          if (body?.fallback && formspreeEndpoint) {
            const fsRes = await fetch(formspreeEndpoint, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
              },
              body: JSON.stringify({
                email: payload.fromEmail,
                subject: payload.subject,
                platform: payload.platform,
                message: payload.message,
                userAgent: payload.userAgent,
                ts: payload.ts,
              }),
            });
            sent = fsRes.ok;
          }
        }
        if (!sent) throw new Error("send failed");
        showChaosToast("Message sent.");
        contactModal.hidden = true;
        contactModal.setAttribute("aria-hidden", "true");
        contactForm.reset();
      } catch {
        const qs = new URLSearchParams({
          subject: `[Poly Oracle Contact] ${payload.subject} (${payload.platform})`,
          body: `From: ${payload.fromEmail}\nPlatform: ${payload.platform}\n\n${payload.message}`,
        });
        window.location.href = `mailto:?${qs.toString()}`;
      }
    });
  }

  modeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const next = button.getAttribute("data-mode");
      if (!next) return;
      state.selectedMode = next;
      saveState();
      applySettingsToUi();
    });
  });

  packSelect.addEventListener("change", (event) => {
    state.selectedPack = event.target.value;
    saveState();
  });

  whisperModeToggle.addEventListener("change", (event) => {
    state.whisper = !!event.target.checked;
    applySettingsToUi();
    saveState();
  });

  minimalModeToggle.addEventListener("change", (event) => {
    state.minimal = !!event.target.checked;
    applySettingsToUi();
    saveState();
  });

  randomVoiceEachRevealToggle.addEventListener("change", (event) => {
    state.randomVoiceEachReveal = !!event.target.checked;
    saveState();
  });

  multiVoiceQAToggle.addEventListener("change", (event) => {
    state.multiVoiceQA = !!event.target.checked;
    saveState();
  });

  verboseDetailsToggle.addEventListener("change", (event) => {
    state.verboseDetails = !!event.target.checked;
    applySettingsToUi();
    saveState();
  });

  randomVoiceNow.addEventListener("click", () => {
    const voice = pickRandomVoiceName();
    if (!voice) return;
    state.selectedVoice = voice;
    state.userVoiceOverride = true;
    voiceSelect.value = voice;
    updatePersonaChip();
    saveState();
  });

  voiceSelect.addEventListener("change", (event) => {
    state.selectedVoice = event.target.value;
    state.userVoiceOverride = true;
    updatePersonaChip();
    saveState();
  });

  previewVoice.addEventListener("click", () => {
    playVoicePreview();
  });

  if (previewVoiceStop) {
    previewVoiceStop.addEventListener("click", () => {
      stopVoicePreview();
    });
  }

  openVault.addEventListener("click", () => {
    setSettingsOpen(false);
    vault.hidden = false;
    renderVault();
  });

  clearHistory.addEventListener("click", () => {
    const ok = window.confirm("Clear all history and favorites? This cannot be undone.");
    if (!ok) return;
    state.vault = [];
    state.currentAnswer = null;
    answerBox.hidden = true;
    saveState();
    renderVault();
  });

  if (resetThemeButton) {
    resetThemeButton.addEventListener("click", () => {
      resetChaosTheme();
    });
  }

  closeVault.addEventListener("click", () => {
    vault.hidden = true;
  });

  vault.addEventListener("click", (event) => {
    if (event.target === vault) {
      vault.hidden = true;
    }
  });

  vaultSearch.addEventListener("input", (event) => {
    state.vaultSearch = event.target.value.trim().toLowerCase();
    renderVault();
  });

  vaultFilterAll.addEventListener("click", () => {
    state.vaultFilter = "all";
    renderVault();
    saveState();
  });

  vaultFilterFav.addEventListener("click", () => {
    state.vaultFilter = "fav";
    renderVault();
    saveState();
  });
}

function setupFirstRunHint() {
  if (!firstRunHint) return;

  let seen = false;
  try {
    seen = localStorage.getItem(firstRunHintKey) === "1";
  } catch {
    seen = true;
  }

  if (seen) {
    firstRunHint.classList.add("hidden");
    return;
  }

  try {
    localStorage.setItem(firstRunHintKey, "1");
  } catch {
    // ignore
  }

  firstRunHint.classList.remove("hidden");
  firstRunHint.classList.add("show");
  hintTimeout = setTimeout(hideFirstRunHint, 2200);
}

// HARDEN overlays
function showBackdrop(el) {
  if (!el) return;
  if (el.__hideTimer) {
    clearTimeout(el.__hideTimer);
    el.__hideTimer = null;
  }
  el.hidden = false;
  el.style.display = "block";
  el.style.pointerEvents = "auto";
  requestAnimationFrame(() => {
    el.style.opacity = "1";
  });
}

function hideBackdrop(el) {
  if (!el) return;
  el.style.opacity = "0";
  el.style.pointerEvents = "none";
  if (el.__hideTimer) clearTimeout(el.__hideTimer);
  el.__hideTimer = setTimeout(() => {
    el.style.display = "none";
    el.hidden = true;
    el.__hideTimer = null;
  }, 180);
}

function resetUiOverlayState() {
  document.body.classList.remove("settings-open", "overlay-open", "is-revealing", "galaxy-open");
  hideBackdrop(settingsBackdrop);
}

function hideFirstRunHint() {
  if (!firstRunHint || firstRunHint.classList.contains("hidden")) return;
  firstRunHint.classList.remove("show");
  firstRunHint.classList.add("hidden");
  if (hintTimeout) {
    clearTimeout(hintTimeout);
    hintTimeout = null;
  }
}

function setSettingsOpen(open) {
  state.settingsOpen = open;
  if (open) {
    vault.hidden = true;
    hideFirstRunHint();
  }
  if (open) {
    showBackdrop(settingsBackdrop);
    settingsPanel.hidden = false;
    settingsPanel.style.display = "block";
    settingsPanel.style.pointerEvents = "auto";
    settingsPanel.classList.add("open");
  } else {
    hideBackdrop(settingsBackdrop);
    settingsPanel.classList.remove("open");
    settingsPanel.style.pointerEvents = "none";
    settingsPanel.style.display = "none";
    settingsPanel.hidden = true;
  }
  document.body.style.overflow = open ? "hidden" : "";
}

/* v1.2.4 iOS mobile patch */
function setVh() {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty("--vh", `${vh}px`);
  if (!galaxyView.hidden && galaxyCanvasController?.relayout) {
    galaxyCanvasController.relayout();
  }
}

function _parseFlashColor(color) {
  if (!color || color === "#ffffff") return { r: 255, g: 255, b: 255 };
  if (color.startsWith("#")) {
    const hex = color.slice(1);
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    };
  }
  const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (m) return { r: +m[1], g: +m[2], b: +m[3] };
  return { r: 255, g: 255, b: 255 };
}

function flashScreen(color = "#ffffff", ms = 250, peak = 0.9) {
  if (isIOSNative) return;
  if (!canvasFlash) return;
  const { r, g, b } = _parseFlashColor(color);
  const safePeak = clamp(peak, 0, 1);
  const safeMs = Math.max(40, ms);
  canvasFlash.r = r;
  canvasFlash.g = g;
  canvasFlash.b = b;
  canvasFlash.alpha = safePeak;
  canvasFlash.peak = safePeak;
  canvasFlash.decayPerMs = safePeak / safeMs;
}

function openGalaxyView() {
  setSettingsOpen(false);
  vault.hidden = true;
  oracleView.hidden = true;
  galaxyView.hidden = false;
  gamePageActive = true;
  menuOverlayOpen = true;
  galaxyView.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  if (!prefersReducedMotion) {
    if (oracleBgController) oracleBgController.stop();
    if (!DISABLE_VIDEO_BG) {
      initGalaxyBackgroundStack();
    }
  }
  if (galaxyCanvasController) {
    requestAnimationFrame(() => galaxyCanvasController.showModeSelect?.());
  }
  // 2026-06-09: orientation stays locked to portrait globally (see lockPortraitOrientation);
  // no per-view unlock — landscape gameplay broke the game.
}

function closeGalaxyView() {
  gamePageActive = false;
  menuOverlayOpen = false;
  audioEngine.stopMusic();
  stopGalaxyBackground();
  galaxyView.hidden = true;
  galaxyView.setAttribute("aria-hidden", "true");
  oracleView.hidden = false;
  document.body.style.overflow = "";
  if (!prefersReducedMotion) {
    if (oracleBgController) oracleBgController.start();
  }
  if (galaxyCanvasController) galaxyCanvasController.stop?.();
  commBoxController.hide(); // FIXED 2026-06-08: clear comm popup when returning to Oracle
  // 2026-06-09: portrait lock is now global (lockPortraitOrientation on startup); no per-view lock.
}

function initTitleSparkles() {
  if (!titleSparkles || prefersReducedMotion) return;
  clearInterval(titleSparkleTimer);
  titleSparkleTimer = setInterval(() => {
    if (oracleView.hidden) return;
    spawnTitleSparkles(1 + Math.floor(Math.random() * 2));
  }, 1150);
}

function spawnTitleSparkles(count = 2) {
  if (!titleSparkles) return;
  const width = titleSparkles.clientWidth || 240;
  const height = titleSparkles.clientHeight || 66;

  for (let i = 0; i < count; i += 1) {
    const sparkle = document.createElement("span");
    sparkle.className = "title-sparkle";
    const x = Math.random() * width;
    const y = Math.random() * height * 0.72;
    const size = 4 + Math.random() * 4;
    sparkle.style.left = `${x}px`;
    sparkle.style.top = `${y}px`;
    sparkle.style.width = `${size}px`;
    sparkle.style.height = `${size}px`;
    sparkle.style.animationDelay = `${Math.random() * 0.18}s`;
    titleSparkles.appendChild(sparkle);
    sparkle.addEventListener("animationend", () => sparkle.remove());
  }
}

function setGalaxyTool(tool) {
  if (galaxyCanvasController?.isArcade?.()) return;
  state.galaxyTool = tool === "boom" ? "boom" : "draw";
  state.practiceTool = state.galaxyTool === "boom" ? "boom" : "pencil";
  toolDraw.classList.toggle("active", state.galaxyTool === "draw");
  toolBoom.classList.toggle("active", state.galaxyTool === "boom");
  try {
    localStorage.setItem(galaxyToolKey, state.galaxyTool);
  } catch {
    // ignore
  }
}

function setIntentState() {
  const value = questionInput.value.trim();
  askButton.disabled = value.length < 2 || state.isRevealing;
  stage.classList.toggle("intent", value.length >= 2);
}

function normalizeQuestion(text) {
  const trimmed = text.trim();
  if (!trimmed) return "";
  return trimmed.endsWith("?") ? trimmed : `${trimmed}?`;
}

function effectiveModeId() {
  if (prefersReducedMotion) return "classic";
  if (state.minimal && state.selectedMode === "glitch") return "classic";
  return state.selectedMode;
}

function buildPackSelect() {
  packSelect.innerHTML = "";
  Object.entries(packs).forEach(([id, pack]) => {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = pack.label;
    packSelect.appendChild(option);
  });
  if (!packs[state.selectedPack]) state.selectedPack = "classic";
  packSelect.value = state.selectedPack;
}

function applySettingsToUi() {
  modeButtons.forEach((button) => {
    button.classList.toggle("active", button.getAttribute("data-mode") === state.selectedMode);
  });

  packSelect.value = state.selectedPack;
  whisperModeToggle.checked = state.whisper;
  minimalModeToggle.checked = state.minimal;
  randomVoiceEachRevealToggle.checked = state.randomVoiceEachReveal;
  multiVoiceQAToggle.checked = state.multiVoiceQA;
  verboseDetailsToggle.checked = state.verboseDetails;

  document.body.classList.toggle("whisper", state.whisper);
  document.body.classList.toggle("minimal", state.minimal);
  document.body.classList.toggle("verbose-details", state.verboseDetails);

  revealAudio.volume = state.whisper ? 0.32 : 0.82;
  if (galaxyController) galaxyController.setMinimal(state.minimal);
}

function setRevealing(revealing) {
  state.isRevealing = revealing;
  document.body.classList.toggle("is-revealing", revealing);
  questionInput.disabled = revealing;
  askButton.disabled = revealing || questionInput.value.trim().length < 2;
  askButton.classList.toggle("loading", revealing);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function flashBackground(intensity = 1, ms = 160) {
  if (!stage) return;
  stage.style.setProperty("--ritualFlashOpacity", String(clamp(intensity, 0, 1)));
  stage.classList.remove("ritual-flash");
  void stage.offsetWidth;
  stage.classList.add("ritual-flash");
  setTimeout(() => stage.classList.remove("ritual-flash"), ms);
}

function darkenStage(on) {
  if (!stage) return;
  stage.classList.toggle("ritual-dark", !!on);
}

async function speakLine(text, { rate = 1, pitch = 1.1, voiceName = "", timeoutMs = 6000 } = {}) {
  if (!text) return;
  const nativeSpoken = await speakNativeText(text, { rate, pitch, voiceName });
  if (nativeSpoken) return;
  if (!("speechSynthesis" in window)) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  synth.resume();
  const voices = getWebVoices();
  const speakAttempt = (useFallbackVoice = false) => new Promise((resolve) => {
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = rate;
    utter.pitch = pitch;
    utter.volume = state.whisper ? 0.5 : 1;
    if (!useFallbackVoice) {
      const selected = voices.find((voice) => voice.name === (voiceName || state.selectedVoice));
      if (selected) utter.voice = selected;
    }
    let done = false;
    let started = false;
    const finish = (result) => {
      if (done) return;
      done = true;
      resolve(result);
    };
    const tid = setTimeout(() => finish({ started, reason: "timeout" }), timeoutMs);
    utter.onstart = () => {
      started = true;
    };
    utter.onend = () => {
      clearTimeout(tid);
      finish({ started, reason: "end" });
    };
    utter.onerror = () => {
      clearTimeout(tid);
      finish({ started, reason: "error" });
    };
    synth.speak(utter);
    setTimeout(() => {
      if (!synth.speaking && !synth.pending) {
        clearTimeout(tid);
        finish({ started, reason: "no-start" });
      }
    }, 500);
  });
  const first = await speakAttempt(false);
  if (!first?.started) {
    await speakAttempt(true);
  }
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function getCrystalOverlay() {
  return revealFxVideo || document.getElementById("crystalOverlayVideo");
}

async function startCrystalOverlay() {
  const video = getCrystalOverlay();
  if (!video) return;
  if (crystalOverlayStopTimer) {
    clearTimeout(crystalOverlayStopTimer);
    crystalOverlayStopTimer = null;
  }
  const desiredSrc = "crystalballfx.mp4";
  if (!video.getAttribute("src") || !video.getAttribute("src").includes("crystalballfx.mp4")) {
    video.setAttribute("src", desiredSrc);
  }
  try {
    video.currentTime = 0;
  } catch {
    // ignore seek errors
  }
  video.classList.remove("fading");
  video.classList.add("active", "on");
  try {
    await video.play();
  } catch {
    // ignore autoplay errors
  }
}

function stopCrystalOverlay(fadeMs = 620) {
  const video = getCrystalOverlay();
  if (!video) return;
  if (crystalOverlayStopTimer) {
    clearTimeout(crystalOverlayStopTimer);
    crystalOverlayStopTimer = null;
  }
  video.classList.add("fading");
  crystalOverlayStopTimer = setTimeout(() => {
    video.classList.remove("active", "on", "fading");
    video.pause();
    crystalOverlayStopTimer = null;
  }, Math.max(220, fadeMs));
}

function triggerOrbSparkle(intensity = 1) {
  spawnSparkles(Math.round(5 + intensity * 5), 1 + intensity * 0.12, 1 + intensity * 0.18);
}

function triggerScreenShake(intensity = 1) {
  stage.classList.remove("pre-reveal-shake");
  void stage.offsetWidth;
  stage.classList.add("pre-reveal-shake");
  setTimeout(() => stage.classList.remove("pre-reveal-shake"), Math.round(130 + intensity * 70));
}

function triggerBgFlashPinkPurple(intensity = 1) {
  flashBackground(clamp(0.35 + intensity * 0.65, 0.15, 1), Math.round(90 + intensity * 90));
}

function setOrbScale(mult) {
  if (!orb) return;
  orb.style.transform = `scale(${clamp(mult, 0.86, 1.35).toFixed(3)})`;
}

function startOrbStrobeCadence(baseScale = REVEAL.GROW_MAX * 0.99) {
  if (orbStrobeController) {
    orbStrobeController.stop(true);
    orbStrobeController = null;
  }

  const startAt = performance.now();
  const cycleMs = 1320;
  let raf = 0;
  let stopping = false;
  let stopAt = 0;
  let stopResolve = null;

  const pickPhase = (elapsed) => {
    const t = elapsed % cycleMs;
    if (t < 360) return { speed: 0.085, amp: 0.048 }; // fast
    if (t < 900) return { speed: 0.042, amp: 0.032 }; // slower
    return { speed: 0.078, amp: 0.044 }; // fast again
  };

  const finish = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    setOrbScale(1);
    if (stopResolve) stopResolve();
  };

  const frame = (now) => {
    if (stopping) {
      const t = clamp((now - stopAt) / 460, 0, 1);
      const eased = 1 - Math.pow(1 - t, 2);
      const amp = 0.03 * (1 - eased);
      const scaleBase = lerp(baseScale, 1, eased);
      const scale = scaleBase + Math.sin(now * 0.062) * amp;
      setOrbScale(scale);
      if (t >= 1) {
        finish();
        return;
      }
    } else {
      const phase = pickPhase(now - startAt);
      const scale = baseScale + Math.sin(now * phase.speed) * phase.amp;
      setOrbScale(scale);
    }
    raf = requestAnimationFrame(frame);
  };

  raf = requestAnimationFrame(frame);
  orbStrobeController = {
    stop(immediate = false) {
      if (!raf) return Promise.resolve();
      if (immediate) {
        finish();
        return Promise.resolve();
      }
      if (!stopping) {
        stopping = true;
        stopAt = performance.now();
      }
      return new Promise((resolve) => {
        stopResolve = resolve;
      });
    },
  };
}

function stopOrbStrobeCadence(immediate = false) {
  if (!orbStrobeController) {
    if (immediate) setOrbScale(1);
    return Promise.resolve();
  }
  const ctrl = orbStrobeController;
  orbStrobeController = null;
  return ctrl.stop(immediate);
}

function setRevealBusy(on) {
  setRevealing(!!on);
}

function setRevealBgStrobe(on) {
  document.body.classList.toggle("reveal-bg-strobe", !!on);
}

function triggerLargeScreenShake() {
  document.body.classList.remove("reveal-screen-shake");
  void document.body.offsetWidth;
  document.body.classList.add("reveal-screen-shake");
  setTimeout(() => document.body.classList.remove("reveal-screen-shake"), 1000);
}

function hideAnswerBar() {
  if (!answerBox) return;
  answerBox.hidden = false;
  answerBox.classList.remove("on");
}

function fadeInAnswerBar() {
  if (!answerBox) return;
  answerBox.hidden = false;
  requestAnimationFrame(() => answerBox.classList.add("on"));
}

function setAnswerTextVisible(on) {
  answerSimple?.classList.toggle("on", !!on);
  answerText?.classList.toggle("on", !!on);
}

function triggerAnswerTextRevealFx() {
  [answerSimple, answerText].forEach((el) => {
    if (!el) return;
    el.classList.remove("shimmer");
    void el.offsetWidth;
    el.classList.add("shimmer");
  });
  spawnAnswerSparkles(prefersReducedMotion ? 8 : 18, prefersReducedMotion ? 1 : 1.18);
  if (!prefersReducedMotion) {
    setTimeout(() => spawnAnswerSparkles(10, 1.08), 120);
    setTimeout(() => spawnAnswerSparkles(8, 1), 240);
  }
}

async function speakAnswer(text, voiceName = "") {
  if (!text) return;
  await speakLine(text, {
    rate: state.whisper ? 0.96 : 1.04,
    pitch: 1.14,
    voiceName,
    timeoutMs: 6500,
  });
}

window.triggerOrbSparkle = triggerOrbSparkle;
window.triggerScreenShake = triggerScreenShake;
window.triggerBgFlashPinkPurple = triggerBgFlashPinkPurple;
window.setOrbScale = setOrbScale;
window.setRevealBusy = setRevealBusy;
window.fadeInAnswerBar = fadeInAnswerBar;
window.hideAnswerBar = hideAnswerBar;
window.setAnswerTextVisible = setAnswerTextVisible;
window.speakAnswer = speakAnswer;

async function runTapBurst() {
  const t0 = performance.now();
  const endAt = t0 + REVEAL.TAP_BURST_MS;
  let nextAt = t0;
  while (performance.now() < endAt) {
    const now = performance.now();
    const progress = Math.min(1, (now - t0) / REVEAL.TAP_BURST_MS);
    const interval = lerp(REVEAL.TAP_INTERVAL_MS_START, REVEAL.TAP_INTERVAL_MS_END, progress);
    if (now >= nextAt) {
      audioEngine.play(SFX.TAP, { volume: 0.45, rate: 0.96 + Math.random() * 0.1 });
      triggerOrbSparkle(1);
      triggerBgFlashPinkPurple(0.35);
      nextAt = now + interval;
    }
    const pulse = lerp(REVEAL.PULSE_MIN, REVEAL.PULSE_MAX, 0.5 + 0.5 * Math.sin(now / 90));
    const grow = lerp(1, REVEAL.GROW_MAX, progress);
    setOrbScale(pulse * grow);
    await new Promise(requestAnimationFrame);
  }
  setOrbScale(REVEAL.GROW_MAX * 0.98);
}

function shakeQuestionInput() {
  questionInput.classList.remove("shake");
  void questionInput.offsetWidth;
  questionInput.classList.add("shake");
  setTimeout(() => questionInput.classList.remove("shake"), 320);
}

async function revealAnswer() {
  if (state.isRevealing) return;

  const normalizedQuestion = normalizeQuestion(questionInput.value);
  if (!normalizedQuestion) {
    shakeQuestionInput();
    return;
  }

  questionInput.value = normalizedQuestion;

  const answerLine = pick(canonicalAnswers);
  const polarity = inferPolarity(answerLine);
  const microLine = pick(packs[state.selectedPack][polarity]);
  const modeId = effectiveModeId();
  const mode = revealModes.find((item) => item.id === modeId) || revealModes[0];
  const baseVoice = resolvePrimaryVoiceName();
  const revealVoice = state.randomVoiceEachReveal ? (pickRandomVoiceName() || baseVoice) : baseVoice;
  const questionVoice = state.multiVoiceQA ? (pickRandomVoiceName() || revealVoice) : revealVoice;
  const answerVoice = state.multiVoiceQA ? (pickDifferentRandomVoiceName(questionVoice) || revealVoice) : revealVoice;

  hapticReveal();
  primeSpeechFromGesture();
  await audioEngine.unlock();
  setRevealBusy(true);
  setRevealBgStrobe(true);
  triggerLargeScreenShake();
  try {
    setAnswerTextVisible(false);
    hideAnswerBar();

    startCrystalOverlay();
    audioEngine.play(SFX.MAIN, { volume: 0.9, rate: 1.0 });

    const burstPromise = runTapBurst();
    const burstFlashInterval = setInterval(() => {
      triggerScreenShake(0.45);
      triggerBgFlashPinkPurple(0.55);
      triggerOrbSparkle(0.9);
    }, REVEAL.FLASH_RATE_MS);
    await burstPromise;
    clearInterval(burstFlashInterval);
    startOrbStrobeCadence(REVEAL.GROW_MAX * 0.99);

    await speakLine(normalizedQuestion, {
      rate: state.whisper ? 0.92 : 1,
      pitch: 1.1,
      voiceName: questionVoice,
      timeoutMs: 6500,
    });

    const pre = Math.random() < 0.5 ? SFX.PRE_A : SFX.PRE_B;
    audioEngine.play(pre, { volume: 0.85, rate: 1.0 });
    const tensionEnd = performance.now() + 700;
    while (performance.now() < tensionEnd) {
      const now = performance.now();
      triggerBgFlashPinkPurple(0.45);
      triggerOrbSparkle(0.6);
      await new Promise(requestAnimationFrame);
    }

    for (let i = 0; i < 6; i += 1) {
      triggerScreenShake(1);
      triggerBgFlashPinkPurple(1);
      triggerOrbSparkle(1.3);
      await delay(60);
    }

    fadeInAnswerBar();
    const barRevealHandle = audioEngine.play(SFX.PRE_B, { volume: 0.95, rate: 1.0 }); // FIXED 2026-06-08: was PRE_A (duplicate)
    // Keep sparkling continuously right up until the answer pops — no bare spot
    // between the last sparkle and the reveal. Cleared after the text is shown below.
    const postSpark = setInterval(() => triggerOrbSparkle(0.7), 140);
    await Promise.race([barRevealHandle?.ended || Promise.resolve(), delay(2000)]);

    finishReveal({
      normalizedQuestion,
      polarity,
      answerLine,
      microLine,
      revealVoice,
    });
    // FIXED 2026-06-08: early stopCrystalOverlay() removed — finally block handles it
    await stopOrbStrobeCadence(false);
    await delay(420);
    clearInterval(postSpark);
    setAnswerTextVisible(true);
    setRevealBgStrobe(false);
    triggerAnswerTextRevealFx();
    audioEngine.play(SFX.POST, { volume: 0.95, rate: 1.0 });
    await delay(620);

    if (state.voiceReadsAnswer !== false) {
      await speakAnswer(answerLine, answerVoice);
    }
  } finally {
    darkenStage(false);
    stopOrbStrobeCadence(true);
    setOrbScale(1);
    stopCrystalOverlay();
    setRevealBgStrobe(false);
    setRevealBusy(false);
    setIntentState();
  }
}

function runRitualSequence(mode, onDone) {
  triggerRevealFx();
  orb.classList.remove("reveal");
  void orb.offsetWidth;
  orb.classList.add("reveal");

  performRitualPulse(0.8);

  setTimeout(() => performRitualPulse(1.05), 400);
  setTimeout(() => performRitualPulse(1.25), 900);
  setTimeout(() => performRitualPulse(1.45), 1600);
  setTimeout(() => triggerPreRevealAccent(), Math.max(0, mode.duration - 280));
  setTimeout(() => onDone(), mode.duration);
}

function runReducedRitualSequence(mode, onDone) {
  triggerRevealFx({ reduced: true });
  orb.classList.remove("reveal");
  void orb.offsetWidth;
  orb.classList.add("reveal");

  mist.classList.remove("active");
  void mist.offsetWidth;
  mist.classList.add("active");
  spawnSparkles(4, 1, 1);
  setTimeout(() => triggerPreRevealAccent({ reduced: true }), Math.max(0, mode.duration - 260));

  setTimeout(onDone, mode.duration);
}

function triggerPreRevealAccent({ reduced = false } = {}) {
  stage.classList.remove("pre-reveal-shake");
  void stage.offsetWidth;
  stage.classList.add("pre-reveal-shake");

  if (reduced) {
    mist.classList.remove("active");
    void mist.offsetWidth;
    mist.style.opacity = "0.22";
    mist.classList.add("active");
    spawnSparkles(4, 0.95, 0.9);
  } else {
    performRitualPulse(1.7);
  }

  setTimeout(() => {
    stage.classList.remove("pre-reveal-shake");
  }, 240);
}

function performRitualPulse(level = 1) {
  flash.classList.remove("active");
  mist.classList.remove("active");
  void flash.offsetWidth;

  if (!state.minimal) {
    flash.style.opacity = `${Math.min(0.5, 0.18 * level)}`;
    flash.classList.add("active");
  }

  mist.style.opacity = `${Math.min(0.5, 0.16 * level)}`;
  mist.classList.add("active");

  spawnSparkles(Math.round(6 + level * 5), 1 + level * 0.15, 1 + level * 0.2);
  if (level > 1.2) {
    hapticTap();
  }
}

async function finishReveal({ normalizedQuestion, polarity, answerLine, microLine, revealVoice }) {
  stage.classList.remove("pre-reveal-shake");
  spawnSparkles(prefersReducedMotion ? 5 : 18, 1.2, 1.35);
  flash.classList.remove("active");
  mist.classList.remove("active");
  flash.style.opacity = "";
  mist.style.opacity = "";

  const entry = {
    id: makeId(),
    question: normalizedQuestion,
    polarity,
    answer: answerLine,
    micro: microLine,
    mode: state.selectedMode,
    pack: state.selectedPack,
    voice: revealVoice || "Default",
    favorite: false,
    timestamp: Date.now(),
  };

  state.currentAnswer = entry;
  state.flip = false;
  state.vault.unshift(entry);
  state.vault = state.vault.slice(0, 200);

  renderAnswerCard();
  triggerAnswerRevealImpact();
  renderVault();
  saveState();
}

function triggerAnswerRevealImpact() {
  // Bright purple flash at answer reveal.
  flash.classList.remove("answer-hit");
  void flash.offsetWidth;
  flash.classList.add("answer-hit");
  setTimeout(() => {
    flash.classList.remove("answer-hit");
  }, prefersReducedMotion ? 180 : 320);

  // Sparkle burst around the revealed answer card.
  spawnAnswerSparkles(prefersReducedMotion ? 8 : 20, prefersReducedMotion ? 1 : 1.25);
}

function renderAnswerCard() {
  if (!state.currentAnswer) return;

  const sourcePolarity = state.flip
    ? state.currentAnswer.polarity === "yes"
      ? "no"
      : "yes"
    : state.currentAnswer.polarity;

  const answerValue =
    sourcePolarity === state.currentAnswer.polarity
      ? state.currentAnswer.answer
      : pick(canonicalAnswersByPolarity(sourcePolarity));

  const microValue = sourcePolarity === state.currentAnswer.polarity
    ? state.currentAnswer.micro
    : pick(packs[state.currentAnswer.pack][sourcePolarity]);

  answerSimple.textContent = answerValue;
  answerPolarity.textContent = sourcePolarity.toUpperCase();
  answerPolarity.classList.toggle("yes", sourcePolarity === "yes");
  answerPolarity.classList.toggle("no", sourcePolarity === "no");
  answerText.textContent = answerValue;
  answerMicro.textContent = microValue;

  const when = new Date(state.currentAnswer.timestamp).toLocaleString();
  answerMeta.textContent = `${packs[state.currentAnswer.pack]?.label || state.currentAnswer.pack} • ${state.currentAnswer.mode} • ${when}`;

  const favorite = state.vault.find((item) => item.id === state.currentAnswer.id)?.favorite;
  favoriteAnswer.textContent = favorite ? "Unfavorite" : "Favorite";

  answerBox.hidden = false;
  answerCard.classList.remove("reveal");
  void answerCard.offsetWidth;
  answerCard.classList.add("reveal");
}

function renderVault() {
  const all = state.vault;
  const filtered = all.filter((item) => {
    if (state.vaultFilter === "fav" && !item.favorite) return false;
    if (!state.vaultSearch) return true;
    return (
      item.question.toLowerCase().includes(state.vaultSearch) ||
      item.answer.toLowerCase().includes(state.vaultSearch) ||
      (item.micro || "").toLowerCase().includes(state.vaultSearch)
    );
  });

  vaultFilterAll.classList.toggle("active", state.vaultFilter === "all");
  vaultFilterFav.classList.toggle("active", state.vaultFilter === "fav");

  const rituals = all.length;
  const days = new Set(all.map((item) => new Date(item.timestamp).toDateString())).size;
  vaultStats.textContent = `Rituals: ${rituals} • Active days: ${days}`;

  if (!filtered.length) {
    vaultList.innerHTML = `<div class=\"vault-item\">No entries yet.</div>`;
    return;
  }

  vaultList.innerHTML = filtered
    .map((item) => {
      const when = new Date(item.timestamp).toLocaleString();
      return `
        <article class="vault-item" data-id="${item.id}">
          <div class="vault-q">${escapeHtml(item.question)}</div>
          <div class="vault-a">${item.polarity.toUpperCase()}: ${escapeHtml(item.answer)}</div>
          <div class="vault-meta">
            <span>${escapeHtml(packs[item.pack]?.label || item.pack)} • ${escapeHtml(item.mode)}</span>
            <span>${escapeHtml(when)}</span>
          </div>
          <div class="vault-details" data-details hidden>
            Voice: ${escapeHtml(item.voice || "Default")}<br />
            Pack: ${escapeHtml(packs[item.pack]?.label || item.pack)}<br />
            Reveal Mode: ${escapeHtml(item.mode)}
          </div>
          <div class="vault-actions">
            <button class="ghost small" data-action="details">View details</button>
            <button class="ghost small" data-action="fav">${item.favorite ? "Unfavorite" : "Favorite"}</button>
            <button class="ghost small" data-action="load">Load</button>
            <button class="ghost small" data-action="delete">Delete</button>
          </div>
        </article>
      `;
    })
    .join("");

  vaultList.querySelectorAll(".vault-item").forEach((node) => {
    const id = node.getAttribute("data-id");
    node.querySelector('[data-action="details"]').addEventListener("click", () => toggleVaultDetails(node));
    node.querySelector('[data-action="fav"]').addEventListener("click", () => toggleFavorite(id));
    node.querySelector('[data-action="load"]').addEventListener("click", () => loadFromVault(id));
    node.querySelector('[data-action="delete"]').addEventListener("click", () => removeFromVault(id));
  });
}

function toggleVaultDetails(node) {
  const details = node.querySelector("[data-details]");
  if (!details) return;
  details.hidden = !details.hidden;
}

function toggleFavorite(id) {
  const entry = state.vault.find((item) => item.id === id);
  if (!entry) return;
  entry.favorite = !entry.favorite;
  saveState();
  renderVault();
  renderAnswerCard();
}

function loadFromVault(id) {
  const entry = state.vault.find((item) => item.id === id);
  if (!entry) return;

  state.currentAnswer = { ...entry };
  state.selectedMode = revealModes.some((mode) => mode.id === entry.mode) ? entry.mode : state.selectedMode;
  state.selectedPack = packs[entry.pack] ? entry.pack : state.selectedPack;
  state.flip = false;
  applySettingsToUi();
  renderAnswerCard();
  saveState();
  vault.hidden = true;
}

function removeFromVault(id) {
  state.vault = state.vault.filter((item) => item.id !== id);
  if (state.currentAnswer?.id === id) {
    state.currentAnswer = null;
    answerBox.hidden = true;
  }
  saveState();
  renderVault();
}

function registerOrbTap() {
  const now = Date.now();
  state.sessionTapCount += 1;
  state.tapTimestamps.push(now);
  state.tapTimestamps = state.tapTimestamps.filter((stamp) => now - stamp <= 2000);

  const spamTapCount = state.tapTimestamps.length;
  const sizeMultiplier = clamp(1 + spamTapCount * 0.05, 1, 2.5);
  const brightnessMultiplier = clamp(1 + spamTapCount * 0.07, 1, 3);
  const burstCount = Math.round(clamp(6 + spamTapCount, 6, 34));
  const shouldShiftTheme = state.sessionTapCount % 20 === 0;

  return { spamTapCount, sizeMultiplier, brightnessMultiplier, burstCount, shouldShiftTheme };
}

function triggerChaosTheme() {
  state.chaosThemeEnabled = true;
  state.chaosShiftCount += 1;
  state.themePalette = createRandomPalette(state.chaosShiftCount);
  applyTheme();
  saveThemeSettings();
  showChaosToast();
}

function resetChaosTheme() {
  state.chaosThemeEnabled = false;
  state.themePalette = null;
  state.chaosShiftCount = 0;
  applyTheme();
  saveThemeSettings();
}

function createRandomPalette(shiftCount = 1) {
  const level = clamp(shiftCount, 1, 12);
  const heat = clamp(level / 10, 0.1, 1.3);
  const satBoost = Math.round(88 + heat * 8);
  const lightness = Math.round(clamp(70 + heat * 10, 70, 84));
  const nebulaAlpha = clamp(0.18 + heat * 0.12, 0.18, 0.36);

  const hueA = Math.floor(Math.random() * 360);
  const hueB = (hueA + 70 + Math.floor(Math.random() * 70)) % 360;
  const hueC = (hueA + 150 + Math.floor(Math.random() * 90)) % 360;
  const hueD = (hueA + 210 + Math.floor(Math.random() * 80)) % 360;

  const pos1 = `${Math.round(8 + Math.random() * 22)}% ${Math.round(6 + Math.random() * 24)}%`;
  const pos2 = `${Math.round(64 + Math.random() * 28)}% ${Math.round(8 + Math.random() * 26)}%`;
  const pos3 = `${Math.round(12 + Math.random() * 76)}% ${Math.round(60 + Math.random() * 34)}%`;
  const pos4 = `${Math.round(12 + Math.random() * 72)}% ${Math.round(30 + Math.random() * 56)}%`;

  return {
    accentA: `hsl(${hueA} ${satBoost}% ${lightness}%)`,
    accentB: `hsl(${hueB} ${Math.max(86, satBoost - 5)}% ${Math.max(70, lightness - 2)}%)`,
    accentC: `hsl(${hueC} ${Math.max(84, satBoost - 8)}% ${Math.max(69, lightness - 3)}%)`,
    bgNebula1: `hsla(${hueA} 96% 72% / ${nebulaAlpha.toFixed(2)})`,
    bgNebula2: `hsla(${hueB} 95% 70% / ${nebulaAlpha.toFixed(2)})`,
    bgNebula3: `hsla(${hueC} 94% 68% / ${(nebulaAlpha * 0.95).toFixed(2)})`,
    bgNebula4: `hsla(${hueD} 92% 70% / ${(nebulaAlpha * 0.84).toFixed(2)})`,
    nebulaPos1: pos1,
    nebulaPos2: pos2,
    nebulaPos3: pos3,
    nebulaPos4: pos4,
    orbGlow: `0 0 ${Math.round(34 + heat * 26)}px hsla(${hueA} 98% 74% / ${clamp(0.56 + heat * 0.18, 0.56, 0.88).toFixed(2)}), 0 0 ${Math.round(96 + heat * 90)}px hsla(${hueB} 94% 72% / ${clamp(0.32 + heat * 0.14, 0.32, 0.62).toFixed(2)})`,
  };
}

function applyTheme() {
  const palette = state.chaosThemeEnabled && state.themePalette ? state.themePalette : defaultPalette;
  const root = document.documentElement;

  root.style.setProperty("--accentA", palette.accentA);
  root.style.setProperty("--accentB", palette.accentB);
  root.style.setProperty("--accentC", palette.accentC);
  root.style.setProperty("--bgNebula1", palette.bgNebula1);
  root.style.setProperty("--bgNebula2", palette.bgNebula2);
  root.style.setProperty("--bgNebula3", palette.bgNebula3 || defaultPalette.bgNebula3);
  root.style.setProperty("--bgNebula4", palette.bgNebula4 || defaultPalette.bgNebula4);
  root.style.setProperty("--nebulaPos1", palette.nebulaPos1 || defaultPalette.nebulaPos1);
  root.style.setProperty("--nebulaPos2", palette.nebulaPos2 || defaultPalette.nebulaPos2);
  root.style.setProperty("--nebulaPos3", palette.nebulaPos3 || defaultPalette.nebulaPos3);
  root.style.setProperty("--nebulaPos4", palette.nebulaPos4 || defaultPalette.nebulaPos4);
  root.style.setProperty("--orbGlow", palette.orbGlow);
}

function showChaosToast() {
  if (!chaosToast) return;
  chaosToast.textContent = "✨ Oracle changed realities.";
  const intensity = clamp(1 + state.chaosShiftCount * 0.12, 1, 2.2);
  chaosToast.style.setProperty("--chaos-intensity", intensity.toFixed(2));
  playChaosShiftSound();
  chaosToast.hidden = false;
  chaosToast.classList.remove("show");
  void chaosToast.offsetWidth;
  chaosToast.classList.add("show");
  clearTimeout(chaosToastTimeout);
  chaosToastTimeout = setTimeout(() => {
    chaosToast.classList.remove("show");
    chaosToast.hidden = true;
  }, 1900);
}

function playChaosShiftSound() {
  try {
    if (!chaosShiftAudio) {
      chaosShiftAudio = new Audio("reveal3.mp3");
      chaosShiftAudio.preload = "auto";
    }
    chaosShiftAudio.currentTime = 0;
    chaosShiftAudio.volume = state.whisper ? 0.3 : 0.75;
    chaosShiftAudio.play().catch(() => {});
  } catch {
    // ignore audio errors
  }
}

function spawnSparkles(count, sizeMultiplier = 1, brightnessMultiplier = 1) {
  if (!sparkles) return;
  if (sparkles.childElementCount > 120) return;
  const stageRect = stage.getBoundingClientRect();
  const orbRect = orb.getBoundingClientRect();
  const centerX = orbRect.left - stageRect.left + orbRect.width / 2;
  const centerY = orbRect.top - stageRect.top + orbRect.height / 2;
  const radius = orbRect.width / 2;

  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * radius * 0.95;
    const x = centerX + Math.cos(angle) * distance;
    const y = centerY + Math.sin(angle) * distance;
    const sparkle = document.createElement("span");
    const size = (4 + Math.random() * 7) * sizeMultiplier;
    const alpha = clamp(0.25 * brightnessMultiplier, 0.25, 1);

    sparkle.className = "sparkle";
    sparkle.style.left = `${x}px`;
    sparkle.style.top = `${y}px`;
    sparkle.style.width = `${size}px`;
    sparkle.style.height = `${size}px`;
    sparkle.style.opacity = `${alpha}`;
    sparkle.style.animationDelay = `${Math.random() * 0.12}s`;
    sparkles.appendChild(sparkle);
    sparkle.addEventListener("animationend", () => sparkle.remove());
  }
}

function spawnAnswerSparkles(count = 14, scale = 1) {
  if (!sparkles || !answerCard || answerBox.hidden) return;
  const stageRect = stage.getBoundingClientRect();
  const cardRect = answerCard.getBoundingClientRect();
  const centerX = cardRect.left - stageRect.left + cardRect.width / 2;
  const centerY = cardRect.top - stageRect.top + cardRect.height / 2;
  const radiusX = cardRect.width * 0.52;
  const radiusY = cardRect.height * 0.55;

  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const jitter = 0.55 + Math.random() * 0.5;
    const x = centerX + Math.cos(angle) * radiusX * jitter;
    const y = centerY + Math.sin(angle) * radiusY * jitter;
    const sparkle = document.createElement("span");
    const size = (4 + Math.random() * 6) * scale;

    sparkle.className = "sparkle answer-sparkle";
    sparkle.style.left = `${x}px`;
    sparkle.style.top = `${y}px`;
    sparkle.style.width = `${size}px`;
    sparkle.style.height = `${size}px`;
    sparkle.style.opacity = prefersReducedMotion ? "0.5" : "0.82";
    sparkle.style.animationDelay = `${Math.random() * 0.09}s`;
    sparkles.appendChild(sparkle);
    sparkle.addEventListener("animationend", () => sparkle.remove());
  }
}

function playRevealSoundAndWait() {
  const selectedSfx = pick(REVEAL_POOL_SFX);
  const volume = state.whisper ? 0.32 : 0.82;
  const handle = selectedSfx ? audioEngine.play(selectedSfx, { volume, rate: 1 }) : { source: null, ended: Promise.resolve() };
  const sfxDurationMs = selectedSfx ? audioEngine.getDuration(selectedSfx, 1) * 1000 : 0;
  if (handle?.source) {
    const waitMs = Math.min(2400, Math.max(750, Math.round(sfxDurationMs || 1250)));
    return Promise.race([handle.ended || Promise.resolve(), delay(waitMs)]);
  }
  if (!revealAudio) return Promise.resolve();
  const nextRevealSound = pick(revealSoundPool);
  if (nextRevealSound && revealAudio.getAttribute("src") !== nextRevealSound) {
    revealAudio.setAttribute("src", nextRevealSound);
    revealAudio.load();
  }
  revealAudio.currentTime = 0;
  const fallbackMs = Math.min(
    2400,
    Math.max(
      750,
      Number.isFinite(revealAudio.duration) && revealAudio.duration > 0 ? Math.round(revealAudio.duration * 1000) : 1250,
    ),
  );
  return new Promise((resolve) => {
    let done = false;
    let timeoutId = null;
    const finish = () => {
      if (done) return;
      done = true;
      if (timeoutId) clearTimeout(timeoutId);
      revealAudio.removeEventListener("ended", finish);
      revealAudio.removeEventListener("error", finish);
      resolve();
    };
    revealAudio.addEventListener("ended", finish, { once: true });
    revealAudio.addEventListener("error", finish, { once: true });
    timeoutId = setTimeout(finish, fallbackMs);
    revealAudio.play().catch(() => {
      setTimeout(finish, 220);
    });
  });
}

function triggerRevealFx({ reduced = false } = {}) {
  if (!revealFxVideo) return;
  revealFxVideo.classList.add("active");
  revealFxVideo.volume = state.whisper ? 0.4 : 0.85;

  try {
    revealFxVideo.currentTime = 0;
  } catch {
    // ignore seek errors
  }

  revealFxVideo.play().catch(() => {});

  const hold = reduced || prefersReducedMotion ? 600 : 1200;
  setTimeout(() => {
    revealFxVideo.classList.remove("active");
  }, hold);
}

function playPixySound(intensity) {
  if (state.minimal) return;
  const volume = state.whisper ? 0.38 : clamp(0.58 * intensity.brightnessMultiplier, 0.32, 0.9);
  audioEngine.play("orb_tap", {
    volume,
    rate: clamp(0.94 + intensity.sizeMultiplier * 0.08, 0.92, 1.08),
  });
}

function warmVoices() {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.getVoices();
}

function getWebVoices() {
  if (!("speechSynthesis" in window)) return [];
  return window.speechSynthesis.getVoices() || [];
}

function pickRandomVoiceName() {
  const voices = getWebVoices();
  if (!voices.length) return "";
  return pick(voices).name;
}

function pickDifferentRandomVoiceName(excludeVoice = "") {
  const voices = getWebVoices();
  if (!voices.length) return "";
  const filtered = excludeVoice ? voices.filter((voice) => voice.name !== excludeVoice) : voices;
  const pool = filtered.length ? filtered : voices;
  return pick(pool).name;
}

function resolvePrimaryVoiceName() {
  if (state.selectedVoice) return state.selectedVoice;
  const voices = getWebVoices();
  return voices[0]?.name || "";
}

function populateVoices() {
  if (!("speechSynthesis" in window)) {
    voiceSelect.innerHTML = "<option value=''>Voice unavailable</option>";
    voiceSelect.disabled = true;
    previewVoice.disabled = true;
    return;
  }

  const synth = window.speechSynthesis;
  const load = () => {
    const voices = getWebVoices();
    voiceSelect.innerHTML = "";

    voices.forEach((voice) => {
      const option = document.createElement("option");
      option.value = voice.name;
      option.textContent = `${voice.name} (${voice.lang})`;
      voiceSelect.appendChild(option);
    });

    if (!voices.length) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "Loading voices...";
      voiceSelect.appendChild(option);
      return;
    }

    const preferred =
      voices.find((voice) => voice.name === "Daniel" && voice.lang === "en-GB") ||
      voices.find((voice) => voice.name === "Daniel") ||
      voices.find((voice) => /en-GB/i.test(voice.lang)) ||
      voices.find((voice) => /en/i.test(voice.lang)) ||
      voices[0];

    const currentExists = voices.some((voice) => voice.name === state.selectedVoice);
    if (!state.userVoiceOverride || !currentExists) {
      state.selectedVoice = preferred.name;
      state.userVoiceOverride = false;
    }

    voiceSelect.value = state.selectedVoice;
    updatePersonaChip();
    saveState();
  };

  synth.onvoiceschanged = load;
  load();
}

function updatePersonaChip() {
  const name = (state.selectedVoice || "").toLowerCase();
  let persona = "Calm";
  if (name.includes("siri") || name.includes("narrator")) persona = "Deadpan";
  else if (name.includes("daniel") || name.includes("fred")) persona = "Mystical";
  else if (name.includes("junior") || name.includes("good news")) persona = "Hype";
  voicePersona.textContent = `Persona: ${persona}`;
}

async function speakText(text, { rate = 1, pitch = 1.2, preview = false, voiceName = "" } = {}) {
  if (!text) return;

  const nativeSpoken = await speakNativeText(text, { rate, pitch, voiceName });
  if (nativeSpoken) return;

  speakWebText(text, { rate, pitch, preview, voiceName });
}

function setVoicePreviewPlaying(playing) {
  if (previewVoiceStop) previewVoiceStop.hidden = !playing;
}

async function playVoicePreview() {
  setVoicePreviewPlaying(true);
  const text = "Question: The Oracle is listening. Answer: Proceed.";
  const opts = {
    rate: state.whisper ? 0.95 : 1.02,
    pitch: 1.2,
    voiceName: state.selectedVoice,
  };

  // Native TTS resolves when playback finishes; hide Stop once it returns.
  const spokenNatively = await speakNativeText(text, opts);
  if (spokenNatively) {
    setVoicePreviewPlaying(false);
    return;
  }

  // Web speech: hide Stop when the utterance ends or errors.
  speakWebText(text, { ...opts, preview: true, onEnd: () => setVoicePreviewPlaying(false) });
}

function stopVoicePreview() {
  if ("speechSynthesis" in window) {
    try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
  }
  const plugin = getNativeTtsPlugin();
  if (plugin && typeof plugin.stop === "function") {
    try { plugin.stop(); } catch { /* ignore */ }
  }
  setVoicePreviewPlaying(false);
}

function primeSpeechFromGesture() {
  if (!("speechSynthesis" in window)) return;
  try {
    const synth = window.speechSynthesis;
    synth.resume();
    synth.getVoices();
    if (!speechPrimed) {
      speechPrimed = true;
      const warm = new SpeechSynthesisUtterance(".");
      warm.volume = 0;
      warm.rate = 1;
      warm.pitch = 1;
      synth.cancel();
      synth.speak(warm);
    }
  } catch {
    // ignore priming errors
  }
}

async function speakNativeText(text, { rate = 1, pitch = 1.2, voiceName = "" } = {}) {
  const plugin = getNativeTtsPlugin();
  if (!plugin) return false;

  try {
    if (typeof plugin.stop === "function") await plugin.stop();
    const selectedVoiceName = voiceName || resolvePrimaryVoiceName();
    const selectedVoice = getWebVoices().find((voice) => voice.name === selectedVoiceName);

    await plugin.speak({
      text,
      lang: selectedVoice?.lang || "en-US",
      voice: selectedVoiceName || undefined,
      rate: Math.max(0.2, Math.min(2, rate)),
      pitch: Math.max(0.5, Math.min(2, pitch)),
      volume: state.whisper ? 0.5 : 1,
      category: "ambient",
    });
    return true;
  } catch (error) {
    if (!nativeTtsWarned) {
      nativeTtsWarned = true;
      console.warn("Native TTS unavailable, falling back to web speech.", error);
    }
    return false;
  }
}

function speakWebText(text, { rate = 1, pitch = 1.2, preview = false, voiceName = "", onEnd = null } = {}) {
  if (!("speechSynthesis" in window)) {
    if (onEnd) onEnd();
    return;
  }
  const synth = window.speechSynthesis;
  synth.resume();
  if (!preview) synth.cancel();

  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = rate;
  utter.pitch = pitch;
  utter.volume = state.whisper ? 0.5 : 1;
  if (onEnd) {
    utter.onend = onEnd;
    utter.onerror = onEnd;
  }

  const voices = getWebVoices();
  const selected = voices.find((voice) => voice.name === (voiceName || state.selectedVoice));
  if (selected) utter.voice = selected;
  synth.speak(utter);

  // Safari/iOS reliability fallback: if queued speech does not begin, retry with default voice.
  setTimeout(() => {
    if (synth.speaking || synth.pending) return;
    const retry = new SpeechSynthesisUtterance(text);
    retry.rate = rate;
    retry.pitch = pitch;
    retry.volume = state.whisper ? 0.5 : 1;
    if (onEnd) {
      retry.onend = onEnd;
      retry.onerror = onEnd;
    }
    synth.speak(retry);
  }, 220);
}

function getNativeTtsPlugin() {
  const cap = window.Capacitor;
  if (!cap || typeof cap.isNativePlatform !== "function") return null;
  if (!cap.isNativePlatform()) return null;

  const plugin = cap?.Plugins?.TextToSpeech;
  return plugin && typeof plugin.speak === "function" ? plugin : null;
}

async function shareCurrentCard() {
  const entry = state.currentAnswer;
  if (!entry) return;

  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 1500;
  const ctx = canvas.getContext("2d");

  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#0a1023");
  gradient.addColorStop(0.55, "#122042");
  gradient.addColorStop(1, "#2b1f4f");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.beginPath();
  ctx.arc(600, 450, 230, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#f3f6ff";
  ctx.font = "700 80px Inter";
  ctx.textAlign = "center";
  ctx.fillText("POLY ORACLE", 600, 170);

  ctx.font = "500 44px Inter";
  drawWrappedText(ctx, `Q: ${entry.question}`, 600, 820, 920, 56);

  ctx.font = "700 96px Inter";
  ctx.fillStyle = entry.polarity === "yes" ? "#8effd0" : "#ffc0d0";
  ctx.fillText(entry.polarity.toUpperCase(), 600, 1020);

  ctx.font = "600 56px Inter";
  ctx.fillStyle = "#ffffff";
  drawWrappedText(ctx, entry.answer, 600, 1120, 860, 62);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) return;

  const file = new File([blob], "oracle-card.png", { type: "image/png" });
  const shareData = {
    title: "Poly Oracle",
    text: `${entry.question} -> ${entry.answer}`,
    files: [file],
  };

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share(shareData);
      return;
    } catch {
      // ignore cancel
    }
  }

  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "oracle-card.png";
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function drawWrappedText(ctx, text, centerX, startY, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  let y = startY;
  words.forEach((word) => {
    const test = `${line}${word} `;
    if (ctx.measureText(test).width > maxWidth && line.length) {
      ctx.fillText(line.trim(), centerX, y);
      line = `${word} `;
      y += lineHeight;
    } else {
      line = test;
    }
  });
  if (line.trim()) ctx.fillText(line.trim(), centerX, y);
}

function hapticTap() {
  if (state.minimal) return;
  if (navigator.vibrate) navigator.vibrate(8);
}

function hapticReveal() {
  if (state.minimal) return;
  if (navigator.vibrate) navigator.vibrate(state.whisper ? [10, 12, 14] : [18, 24, 30]);
}

function loadState() {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const saved = JSON.parse(raw);
      state.selectedMode = revealModes.some((mode) => mode.id === saved.selectedMode) ? saved.selectedMode : state.selectedMode;
      state.selectedPack = packs[saved.selectedPack] ? saved.selectedPack : state.selectedPack;
      state.selectedVoice = saved.selectedVoice || "";
      state.userVoiceOverride = !!saved.userVoiceOverride;
      state.whisper = !!saved.whisper;
      state.minimal = !!saved.minimal;
      state.randomVoiceEachReveal = !!saved.randomVoiceEachReveal;
      state.multiVoiceQA = !!saved.multiVoiceQA;
      state.vault = Array.isArray(saved.vault) ? saved.vault.slice(0, 200) : [];
      state.vaultFilter = saved.vaultFilter === "fav" ? "fav" : "all";
      state.vaultSearch = typeof saved.vaultSearch === "string" ? saved.vaultSearch : "";
    }
  } catch {
    // ignore
  }

  try {
    state.verboseDetails = localStorage.getItem(verboseKey) === "1";
  } catch {
    state.verboseDetails = false;
  }

  state.chaosThemeEnabled = false;
  state.themePalette = null;
  state.randomVoiceEachReveal = false;
  state.verboseDetails = false;
  try {
    const savedTool = localStorage.getItem(galaxyToolKey);
    state.galaxyTool = savedTool === "boom" ? "boom" : "draw";
  } catch {
    state.galaxyTool = "draw";
  }
}

function saveState() {
  const payload = {
    selectedMode: state.selectedMode,
    selectedPack: state.selectedPack,
    selectedVoice: state.selectedVoice,
    userVoiceOverride: state.userVoiceOverride,
    whisper: state.whisper,
    minimal: state.minimal,
    randomVoiceEachReveal: state.randomVoiceEachReveal,
    multiVoiceQA: state.multiVoiceQA,
    vault: state.vault,
    vaultFilter: state.vaultFilter,
    vaultSearch: state.vaultSearch,
    version: APP_VERSION,
  };

  try {
    localStorage.setItem(storageKey, JSON.stringify(payload));
    localStorage.setItem(verboseKey, state.verboseDetails ? "1" : "0");
  } catch {
    // ignore
  }

  saveThemeSettings();
}

function saveThemeSettings() {
  try {
    localStorage.setItem(chaosEnabledKey, state.chaosThemeEnabled ? "1" : "0");
    if (state.themePalette) {
      localStorage.setItem(chaosPaletteKey, JSON.stringify(state.themePalette));
    } else {
      localStorage.removeItem(chaosPaletteKey);
    }
  } catch {
    // ignore
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function inferPolarity(answer) {
  const text = String(answer || "").toLowerCase();
  if (
    text === "no" ||
    text.includes("nope") ||
    text.includes("no ") ||
    text.includes("not ") ||
    text.includes("heck no") ||
    text.includes("don't")
  ) {
    return "no";
  }
  return "yes";
}

function canonicalAnswersByPolarity(polarity) {
  const filtered = canonicalAnswers.filter((answer) => inferPolarity(answer) === polarity);
  return filtered.length ? filtered : canonicalAnswers;
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

let leaderboardDb = null;
let leaderboardOverlay = null;
let leaderboardHighlightId = "";

const firebaseConfig = globalThis.POLY_FIREBASE_CONFIG && typeof globalThis.POLY_FIREBASE_CONFIG === "object"
  ? { ...globalThis.POLY_FIREBASE_CONFIG }
  : null;

const firebaseCompatScriptUrls = [
  "https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js",
];
let firebaseCompatScriptsPromise = null;

function loadExternalScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing?.dataset.loaded === "true") {
      resolve();
      return;
    }
    const script = existing || document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.leaderboardFirebase = "true";
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      resolve();
    }, { once: true });
    script.addEventListener("error", () => reject(new Error(`Could not load ${src}`)), { once: true });
    if (!existing) document.head.appendChild(script);
  });
}

async function loadFirebaseCompatScripts() {
  if (globalThis.firebase?.initializeApp && globalThis.firebase?.firestore) return;
  if (!firebaseCompatScriptsPromise) {
    firebaseCompatScriptsPromise = firebaseCompatScriptUrls
      .reduce((promise, src) => promise.then(() => loadExternalScript(src)), Promise.resolve())
      .catch((error) => {
        firebaseCompatScriptsPromise = null;
        throw error;
      });
  }
  await firebaseCompatScriptsPromise;
}

async function initLeaderboardFirestore() {
  if (leaderboardDb) return leaderboardDb;
  try {
    await loadFirebaseCompatScripts();
    const fb = globalThis.firebase;
    if (!fb?.initializeApp || !fb?.firestore) return leaderboardDb;
    if (!firebaseConfig?.apiKey) {
      console.warn("[leaderboard] Missing Firebase config");
      return leaderboardDb;
    }
    if (!fb.apps.length) fb.initializeApp(firebaseConfig);
    leaderboardDb = fb.firestore();
    // TODO before public launch: tighten Firestore rules so only valid initials/score/timestamp writes are accepted.
  } catch (error) {
    console.warn("[leaderboard] Firebase init failed", error);
  }
  return leaderboardDb;
}

function ensureLeaderboardStyles() {
  if (document.getElementById("leaderboardStyles")) return;
  const style = document.createElement("style");
  style.id = "leaderboardStyles";
  style.textContent = `
    .leaderboardOverlay{position:fixed;inset:0;z-index:-1;display:none;visibility:hidden;pointer-events:none;align-items:center;justify-content:center;padding:24px;background:radial-gradient(circle at 50% 18%,rgba(0,255,209,.16),rgba(4,9,22,.96) 42%,rgba(0,0,0,.98));color:#dff;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace}
    .leaderboardOverlay.show{z-index:10000;display:flex;visibility:visible;pointer-events:auto}
    .leaderboardPanel{position:relative;width:min(560px,94vw);max-height:min(760px,92vh);overflow:hidden;padding:26px;border:1px solid rgba(0,255,209,.52);border-radius:20px;background:linear-gradient(180deg,rgba(5,18,32,.94),rgba(2,8,18,.98));box-shadow:0 0 36px rgba(0,255,209,.22),inset 0 0 32px rgba(0,255,209,.08)}
    .leaderboardPanel::after{content:"";position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(180deg,rgba(255,255,255,.045) 0 1px,transparent 1px 7px);mix-blend-mode:screen;opacity:.36}
    .leaderboardTitle{position:relative;z-index:1;margin:0 0 18px;text-align:center;font-size:clamp(1.5rem,6vw,2.6rem);letter-spacing:.18em;color:#dffff8;text-shadow:0 0 10px #00FFD1,0 0 28px rgba(0,255,209,.5)}
    .leaderboardSub{position:relative;z-index:1;text-align:center;color:rgba(210,255,248,.76);margin:0 0 18px}
    .initialsForm{position:relative;z-index:1;display:grid;gap:14px;justify-items:center}
    .initialsInput{width:8ch;text-align:center;text-transform:uppercase;font:700 2rem ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.24em;color:#fff;background:rgba(0,255,209,.08);border:1px solid rgba(0,255,209,.72);border-radius:12px;padding:10px 8px;box-shadow:0 0 18px rgba(0,255,209,.22);caret-color:#00FFD1;text-shadow:0 0 8px rgba(0,255,209,.6);animation:caretGlow 800ms ease-in-out infinite}
    .initialsInput::placeholder{color:rgba(0,255,209,.4)}
    .leaderboardBtn{position:relative;z-index:1;border:1px solid rgba(0,255,209,.7);border-radius:999px;background:rgba(0,255,209,.1);color:#eafffb;padding:10px 18px;text-transform:uppercase;letter-spacing:.12em;box-shadow:0 0 16px rgba(0,255,209,.18);cursor:pointer}
    .leaderboardBtn:hover{background:rgba(0,255,209,.2)}
    .leaderboardRows{position:relative;z-index:1;display:grid;gap:8px;margin:18px 0}
    .leaderboardRow{display:grid;grid-template-columns:3ch 1fr 7ch;gap:12px;align-items:center;padding:9px 12px;border:1px solid rgba(0,255,209,.18);background:rgba(0,255,209,.045);border-radius:10px;color:rgba(225,255,250,.88);transform:translateY(-16px);opacity:0;animation:scoreRowIn 360ms ease forwards;animation-delay:calc(var(--row-index,0)*65ms)}
    .leaderboardRow.highlight{color:#fff;border-color:rgba(220,255,250,.95);background:rgba(0,255,209,.16);box-shadow:0 0 22px rgba(0,255,209,.42);animation:scoreRowIn 360ms ease forwards,scorePulse 1.2s ease-in-out infinite}
    .leaderboardRank{color:#00FFD1}.leaderboardInitials{font-weight:800;letter-spacing:.18em}.leaderboardScore{text-align:right;color:#fff}
    .leaderboardActions{position:relative;z-index:1;display:flex;justify-content:center;gap:10px;flex-wrap:wrap}
    .leaderboardStatus{position:relative;z-index:1;text-align:center;color:rgba(220,255,248,.8);min-height:1.2em}
    @keyframes scoreRowIn{to{transform:translateY(0);opacity:1}}
    @keyframes scorePulse{0%,100%{text-shadow:0 0 8px rgba(0,255,209,.45)}50%{text-shadow:0 0 18px rgba(255,255,255,.95)}}
    @keyframes caretGlow{0%,100%{caret-color:#00FFD1}50%{caret-color:rgba(0,255,209,.3)}}
  `;
  document.head.appendChild(style);
}

function ensureLeaderboardOverlay() {
  ensureLeaderboardStyles();
  if (leaderboardOverlay) return leaderboardOverlay;
  leaderboardOverlay = document.createElement("div");
  leaderboardOverlay.id = "leaderboardOverlay";
  leaderboardOverlay.className = "leaderboardOverlay";
  leaderboardOverlay.setAttribute("aria-hidden", "true");
  leaderboardOverlay.hidden = true;
  leaderboardOverlay.style.display = "none";
  leaderboardOverlay.style.visibility = "hidden";
  leaderboardOverlay.style.pointerEvents = "none";
  leaderboardOverlay.style.zIndex = "-1";
  document.body.appendChild(leaderboardOverlay);
  return leaderboardOverlay;
}

function setLeaderboardOverlayVisible(visible) {
  const overlay = ensureLeaderboardOverlay();
  overlay.classList.toggle("show", visible);
  overlay.hidden = !visible;
  overlay.style.display = visible ? "flex" : "none";
  overlay.style.visibility = visible ? "visible" : "hidden";
  overlay.style.pointerEvents = visible ? "auto" : "none";
  overlay.style.zIndex = visible ? "10000" : "-1";
  overlay.setAttribute("aria-hidden", visible ? "false" : "true");
  return overlay;
}

function closeLeaderboardOverlay() {
  setLeaderboardOverlayVisible(false);
  galaxyCanvasController?.showModeSelect?.({ preserveArcade: false });
}

function renderLeaderboardShell(title, bodyHtml, status = "") {
  const overlay = setLeaderboardOverlayVisible(true);
  overlay.innerHTML = `
    <div class="leaderboardPanel" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
      <h2 class="leaderboardTitle">${escapeHtml(title)}</h2>
      ${bodyHtml}
      <div class="leaderboardStatus">${escapeHtml(status)}</div>
    </div>
  `;
  return overlay;
}

async function fetchLeaderboardRows() {
  const db = await initLeaderboardFirestore();
  if (!db) throw new Error("Firebase unavailable");
  const snap = await db.collection("scores").orderBy("score", "desc").limit(12).get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

function renderLeaderboardRows(rows, highlightId = "") {
  if (!rows.length) return `<p class="leaderboardSub">No scores yet. Claim the first slot.</p>`;
  return `
    <div class="leaderboardRows">
      ${rows.map((row, index) => `
        <div class="leaderboardRow ${row.id === highlightId ? "highlight" : ""}" style="--row-index:${index}">
          <span class="leaderboardRank">${index + 1}</span>
          <span class="leaderboardInitials">${escapeHtml(row.initials || "---")}</span>
          <span class="leaderboardScore">${Number(row.score || 0)}</span>
        </div>
      `).join("")}
    </div>
  `;
}

async function showLeaderboard({ highlightId = leaderboardHighlightId, afterSubmit = false } = {}) {
  const closeText = afterSubmit ? "Done" : "Back";
  renderLeaderboardShell("POLYVERSE SCOREBOARD", `<p class="leaderboardSub">Loading global scores...</p>`);
  try {
    const rows = await fetchLeaderboardRows();
    const overlay = renderLeaderboardShell("POLYVERSE SCOREBOARD", `
      ${renderLeaderboardRows(rows, highlightId)}
      <div class="leaderboardActions">
        <button id="leaderboardClose" class="leaderboardBtn" type="button">${closeText}</button>
      </div>
    `);
    overlay.querySelector("#leaderboardClose")?.addEventListener("click", closeLeaderboardOverlay);
  } catch (error) {
    const overlay = renderLeaderboardShell("POLYVERSE SCOREBOARD", `
      <p class="leaderboardSub">Scores unavailable offline. Connect to the internet to view the Polyverse Scoreboard.</p>
      <div class="leaderboardActions">
        <button id="leaderboardRetry" class="leaderboardBtn" type="button">Retry</button>
        <button id="leaderboardClose" class="leaderboardBtn" type="button">${closeText}</button>
      </div>
    `, error.message || "Offline");
    overlay.querySelector("#leaderboardRetry")?.addEventListener("click", () => showLeaderboard({ highlightId, afterSubmit }));
    overlay.querySelector("#leaderboardClose")?.addEventListener("click", closeLeaderboardOverlay);
  }
}

async function submitLeaderboardScore(initials, score) {
  const db = await initLeaderboardFirestore();
  if (!db) throw new Error("Firebase unavailable");
  const cleanInitials = String(initials || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3).padEnd(3, "-");
  const doc = await db.collection("scores").add({
    initials: cleanInitials,
    score: Math.max(0, Math.floor(Number(score) || 0)),
    timestamp: globalThis.firebase.firestore.FieldValue.serverTimestamp(),
  });
  leaderboardHighlightId = doc.id;
  return doc.id;
}

function showInitialsEntry(score, runMsg = "") {
  const safeScore = Math.max(0, Math.floor(Number(score) || 0));
  const overlay = renderLeaderboardShell("POLYVERSE SCOREBOARD", `
    <form id="initialsForm" class="initialsForm">
      <p class="leaderboardSub">Score ${safeScore}. Enter initials.${runMsg ? ` ${runMsg}` : ""}</p>
      <input id="leaderboardInitials" class="initialsInput" maxlength="3" minlength="3" placeholder="AAA" inputmode="latin" autocomplete="off" aria-label="Three initials" />
      <button class="leaderboardBtn" type="submit">Submit Score</button>
      <button id="leaderboardSkip" class="leaderboardBtn" type="button">Skip</button>
    </form>
  `);
  const input = overlay.querySelector("#leaderboardInitials");
  const form = overlay.querySelector("#initialsForm");
  const skip = overlay.querySelector("#leaderboardSkip");
  input?.focus();
  input?.addEventListener("input", () => {
    input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3);
  });
  skip?.addEventListener("click", () => showLeaderboard());
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const initials = input?.value || "";
    if (initials.length !== 3) {
      input?.focus();
      return;
    }
    const button = form.querySelector("button[type='submit']");
    if (button) button.disabled = true;
    try {
      const id = await submitLeaderboardScore(initials, safeScore);
      await showLeaderboard({ highlightId: id, afterSubmit: true });
    } catch (error) {
      // FIXED 2026-06-08: distinguish network/unavailable errors with a clear user message
      const isNetworkError = !navigator.onLine
        || /unavailable|network|offline|failed to fetch|firebaseerror/i.test(error?.message || "");
      const subMsg = isNetworkError
        ? "Score saved locally — could not connect to leaderboard."
        : "Score saved locally could not be sent.";
      renderLeaderboardShell("POLYVERSE SCOREBOARD", `
        <p class="leaderboardSub">${subMsg}</p>
        <div class="leaderboardActions">
          <button id="leaderboardRetry" class="leaderboardBtn" type="button">Try Again</button>
          <button id="leaderboardClose" class="leaderboardBtn" type="button">Back</button>
        </div>
      `, error.message || "Submit failed");
      document.getElementById("leaderboardRetry")?.addEventListener("click", () => showInitialsEntry(safeScore));
      document.getElementById("leaderboardClose")?.addEventListener("click", closeLeaderboardOverlay);
    }
  });
}

function makeId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function initBackgroundVideos() {
  oracleBgController = createLoopVideoController(oracleBgVideo);

  // FIXED 2026-06-08: fade in oracle bg video after first frame to prevent black flash
  if (oracleBgVideo) {
    const onVideoReady = () => {
      oracleBgVideo.style.opacity = "";
    };
    oracleBgVideo.addEventListener("canplay", onVideoReady, { once: true });
    oracleBgVideo.addEventListener("loadeddata", onVideoReady, { once: true });
  }

  if (!DISABLE_VIDEO_BG) {
    initGalaxyBackgroundStack();
  }

  if (prefersReducedMotion) {
    if (oracleBgVideo) oracleBgVideo.currentTime = 0;
  } else {
    if (oracleBgController) oracleBgController.start();
    stopGalaxyBackground();
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (oracleBgController) oracleBgController.stop();
      stopGalaxyBackground();
      return;
    }

    if (prefersReducedMotion) return;

    if (!galaxyView.hidden) {
      // foreground gameplay start handles key selection and playback
      if (!DISABLE_VIDEO_BG) {
        initGalaxyBackgroundStack();
      }
    } else {
      if (oracleBgController) oracleBgController.start();
    }
  });
}

function primeBackgroundMedia() {
  [oracleBgVideo, bgVideoA, bgVideoB].forEach((video) => {
    if (!video) return;
    if (DISABLE_VIDEO_BG && (video === bgVideoA || video === bgVideoB)) return;
    video.play().then(() => {
      if (video !== oracleBgVideo || galaxyView.hidden) video.pause();
    }).catch(() => {});
  });
}

function initOrbTapPool() {
  orbTapPool.length = 0;
  if (!orbTapAudio) return;
  for (let i = 0; i < 8; i += 1) {
    const node = i === 0 ? orbTapAudio : orbTapAudio.cloneNode(true);
    node.preload = "auto";
    node.load();
    orbTapPool.push(node);
  }
  primeOrbTapBuffer();
}

function primeOrbTapBuffer() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx || orbTapBuffer || orbTapBufferPromise) return;
  if (!audioContext) audioContext = new AudioCtx();

  const src = orbTapAudio?.getAttribute("src") || "taporb.mp3";
  orbTapBufferPromise = fetch(src)
    .then((response) => response.arrayBuffer())
    .then((arr) => audioContext.decodeAudioData(arr.slice(0)))
    .then((decoded) => {
      orbTapBuffer = decoded;
    })
    .catch(() => {
      orbTapBuffer = null;
    })
    .finally(() => {
      orbTapBufferPromise = null;
    });
}

function createLoopVideoController(video) {
  if (!video) return null;
  let watchdog = null;

  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = "auto";
  try {
    video.load();
  } catch {
    // ignore load errors
  }
  video.addEventListener("ended", () => {
    try {
      video.currentTime = 0;
    } catch {
      // ignore
    }
    video.play().catch(() => {});
  });

  return {
    start() {
      video.loop = true;
      video.play().catch(() => {});
      if (watchdog) clearInterval(watchdog);
      watchdog = setInterval(() => {
        if (video.paused) {
          video.play().catch(() => {});
        }
      }, 1800);
    },
    stop() {
      video.pause();
      if (watchdog) {
        clearInterval(watchdog);
        watchdog = null;
      }
    },
  };
}

function initGalaxyBackgroundStack() {
  if (DISABLE_VIDEO_BG) {
    [bgVideoA, bgVideoB].forEach((video) => {
      if (!video) return;
      video.pause();
      video.removeAttribute("src");
      video.style.display = "none";
      video.style.opacity = "0";
      video.classList.remove("isOn");
    });
    bgCtl.ready = false;
    bgCtl.currentKey = null;
    return;
  }
  if (bgCtl.ready) return;
  if (!bgVideoA || !bgVideoB) return;
  bgCtl.a = bgVideoA;
  bgCtl.b = bgVideoB;
  bgCtl.front = bgVideoA;
  bgCtl.back = bgVideoB;
  [bgCtl.a, bgCtl.b].forEach((video) => {
    video.style.display = "";
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = "auto";
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
  });
  bgCtl.ready = true;
}

function waitVideoReady(video) {
  return new Promise((resolve) => {
    if (!video) {
      resolve(false);
      return;
    }
    if (video.readyState >= 2) {
      resolve(true);
      return;
    }
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      video.removeEventListener("loadeddata", onReady);
      video.removeEventListener("canplay", onReady);
      resolve(ok);
    };
    const onReady = () => finish(true);
    video.addEventListener("loadeddata", onReady, { once: true });
    video.addEventListener("canplay", onReady, { once: true });
    setTimeout(() => finish(false), 2500);
  });
}

function setGalaxyBackgroundDim(ratio = 0) {
  if (!bgTint) return;
  const safe = clamp(ratio, 0, 1);
  const alpha = (0.14 + safe * 0.34).toFixed(3);
  const vignette = (0.22 + safe * 0.18).toFixed(3);
  bgTint.style.background = `radial-gradient(circle at 50% 32%, rgba(140, 90, 255, ${alpha}), rgba(0, 0, 0, 0.54)), radial-gradient(circle at 50% 50%, rgba(0,0,0,0), rgba(0,0,0,${vignette}))`;
}

async function setGalaxyBackgroundKey(key, opts = {}) {
  if (DISABLE_VIDEO_BG) return;
  initGalaxyBackgroundStack();
  if (!bgCtl.ready) return;
  if (!key || !BG[key]) return;

  const fadeMs = opts.fadeMs ?? 450;
  const fadeInSeconds = opts.fadeInSeconds ?? 20;
  const immediate = opts.immediate ?? false;
  const entryOpacity = immediate ? 1 : 0.34;

  if (bgCtl.currentKey === key && bgCtl.front) {
    try {
      await bgCtl.front.play();
    } catch {
      // ignore autoplay block
    }
    return;
  }

  const token = ++bgCtl.token;
  const src = BG[key];
  const back = bgCtl.back;
  const front = bgCtl.front;

  back.classList.remove("isOn");
  back.style.transition = "none";
  back.style.opacity = "0";

  const currentSrc = back.getAttribute("src") || "";
  if (currentSrc !== src) {
    back.setAttribute("src", src);
    try {
      back.load();
    } catch {
      // ignore
    }
  }

  await waitVideoReady(back);
  if (token !== bgCtl.token) return;

  try {
    await back.play();
  } catch {
    // ignore autoplay block
  }

  if (!front || !bgCtl.currentKey) {
    back.style.transition = `opacity ${fadeMs}ms ease`;
    back.classList.add("isOn");
    back.style.opacity = String(entryOpacity);
    bgCtl.front = back;
    bgCtl.back = front || (back === bgCtl.a ? bgCtl.b : bgCtl.a);
    bgCtl.currentKey = key;
    if (!immediate && fadeInSeconds > 0) {
      requestAnimationFrame(() => {
        back.style.transition = `opacity ${fadeInSeconds}s linear`;
        back.style.opacity = "1";
      });
    }
    return;
  }

  back.style.transition = `opacity ${fadeMs}ms ease`;
  front.style.transition = `opacity ${fadeMs}ms ease`;
  back.classList.add("isOn");
  requestAnimationFrame(() => {
    back.style.opacity = String(entryOpacity);
    front.style.opacity = "0";
  });

  setTimeout(() => {
    if (token !== bgCtl.token) return;
    try {
      front.pause();
    } catch {
      // ignore
    }
    front.classList.remove("isOn");
    front.style.opacity = "0";
    bgCtl.front = back;
    bgCtl.back = front;
    bgCtl.currentKey = key;
    if (!immediate && fadeInSeconds > 0) {
      requestAnimationFrame(() => {
        bgCtl.front.style.transition = `opacity ${fadeInSeconds}s linear`;
        bgCtl.front.style.opacity = "1";
      });
    }
  }, fadeMs + 40);
}

function preloadGalaxyBackgroundKey(key) {
  if (DISABLE_VIDEO_BG) return;
  initGalaxyBackgroundStack();
  if (!bgCtl.ready || !key || !BG[key]) return;
  const src = BG[key];
  const back = bgCtl.back;
  const currentSrc = back.getAttribute("src") || "";
  if (currentSrc === src) return;
  back.setAttribute("src", src);
  try {
    back.load();
  } catch {
    // ignore
  }
}

function stopGalaxyBackground() {
  if (!bgCtl.ready) return;
  [bgCtl.a, bgCtl.b].forEach((video) => {
    try {
      video.pause();
    } catch {
      // ignore
    }
    video.classList.remove("isOn");
    video.style.opacity = "0";
  });
  bgCtl.currentKey = null;
  bgCtl.token += 1;
}

// === Arcade Mode ===
function initGalaxyCanvas() {
  if (!galaxyPlayCanvas) return;
  const ctx = galaxyPlayCanvas.getContext("2d", {
    alpha: false,
    desynchronized: true,
    willReadFrequently: false,
  });
  if (!ctx) return;
  const plasmaOverlayCanvas = document.createElement("canvas");
  const plasmaCtx = plasmaOverlayCanvas.getContext("2d", {
    alpha: true,
    desynchronized: true,
    willReadFrequently: false,
  });
  const timerPerimeterCanvas = document.createElement("canvas");
  const timerPerimeterCtx = timerPerimeterCanvas.getContext("2d", {
    alpha: true,
    desynchronized: true,
    willReadFrequently: false,
  });
  const ufoFxCanvas = document.createElement("canvas");
  const ufoFxCtx = ufoFxCanvas.getContext("2d", {
    alpha: true,
    desynchronized: true,
    willReadFrequently: false,
  });
  plasmaOverlayCanvas.setAttribute("aria-hidden", "true");
  plasmaOverlayCanvas.style.position = "absolute";
  plasmaOverlayCanvas.style.pointerEvents = "none";
  plasmaOverlayCanvas.style.zIndex = "2";
  plasmaOverlayCanvas.style.inset = "auto";
  galaxyView.appendChild(plasmaOverlayCanvas);
  timerPerimeterCanvas.setAttribute("aria-hidden", "true");
  timerPerimeterCanvas.style.position = "absolute";
  timerPerimeterCanvas.style.pointerEvents = "none";
  timerPerimeterCanvas.style.zIndex = "2";
  timerPerimeterCanvas.style.inset = "auto";
  galaxyView.appendChild(timerPerimeterCanvas);
  ufoFxCanvas.setAttribute("aria-hidden", "true");
  ufoFxCanvas.style.position = "absolute";
  ufoFxCanvas.style.pointerEvents = "none";
  ufoFxCanvas.style.zIndex = "3";
  ufoFxCanvas.style.inset = "auto";
  galaxyView.appendChild(ufoFxCanvas);
  [bgVideoA, bgVideoB].forEach((video) => {
    if (video) video.style.zIndex = "0";
  });

  const debugTaps = (() => {
    try {
      return localStorage.getItem(debugTapsKey) === "1";
    } catch {
      return false;
    }
  })();
  if (debugTaps) document.body.classList.add("debug");

  const EPS = 0.01;
  const MIN_SPEED = 10;
  const plasmaCage = {
    active: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    chargeStart: 0,
    charged: false,
    cooldownUntil: 0,
    cooldownStart: 0,
    lastPulseAt: 0,
    releaseFx: null,
    chargeLoopHandle: null,
    chargeLoopRate: 0,
    readySoundPlayed: false,
    highlightBlipPlayed: false,
    rechargeSoundPlayed: true,
    lastRectCx: 0,
    lastRectCy: 0,
    lastRechargeVoAt: 0,
  };
  const laserBeams = [];
  let tapBlasts = []; // 2026-06-09: localized X blast for iOS touch taps (replaces laser)
  const _bombShrapnel = [];
  // 2026-06-11: fire trail behind in-flight tossed asteroids — dedicated overlay array
  // (the sim.particles pool renders through PIXI on device; this draws on the ufoFx overlay).
  const flameTrail = [];
  const FLAME_TRAIL_MAX = 60;
  const FLAME_COLORS = ["255,102,0", "255,170,0", "255,51,0"]; // #ff6600 / #ffaa00 / #ff3300
  const FLAME_ICE_COLORS = ["170,238,255", "136,221,255", "200,245,255"]; // frozen-toss ice trail
  // 2026-06-11: second, larger trail — overlapping additive flame blobs (reads as a fire plume
  // rather than discrete circle sparks). Ices over while a freeze is active.
  const fireBlobs = [];
  const FIRE_BLOB_MAX = 46;
  let _fpsOverlay = null;
  let _fpsFrames = 0;
  let _fpsLastTime = 0;
  let _fpsAvg = 60;
  let _fpsWorst = 60;
  let _fpsWorstReset = 0;
  let _timeBonusFlash = null;
  canvasFlash = { r: 0, g: 255, b: 255, peak: 0, alpha: 0, decayPerMs: 0 };
  window.galaxyBackground?.init(isIOSNative);

  const sim = {
    dpr: 1,
    width: 0,
    height: 0,
    last: 0,
    stars: [],
    asteroids: [],
    particles: [],
    warpRings: [],
    lightningRings: [],
    shooting: null,
    tossedAsteroid: null,
    shootingTimer: null,
    maxAsteroids: 120,
    lastTapAt: 0,
    nextDrawAt: 0,
    asteroidPool: [],
    particlePool: [],
    ringPool: [],
  };

  const stroidToss = {
    active: false,
    asteroidIndex: -1,
    asteroid: null,
    mine: null, // 2026-06-11: grab state is shared with tossable mines (placed bombs + landmine)
    holdStart: 0,
    grabbed: false,
    dragX: 0,
    dragY: 0,
    pointerId: null,
    grabX: 0,
    grabY: 0,
    startX: 0,
    startY: 0,
    lastHapticAt: 0,
    lastSparkAt: 0,
    samples: [], // 2026-06-10: recent pointer positions {x,y,t} — throw follows the flick
  };

  function ensureFpsOverlay() {
    if (_fpsOverlay) return;
    _fpsOverlay = document.createElement("div");
    _fpsOverlay.style.cssText = `
      position:fixed;top:8px;right:8px;
      background:rgba(0,0,0,0.7);
      color:#00ffee;font-family:monospace;
      font-size:11px;padding:4px 8px;
      border-radius:3px;z-index:99999;
      pointer-events:none;line-height:1.6;
    `;
    document.body.appendChild(_fpsOverlay);
  }

  function showFpsOverlay() {
    return; // hidden permanently
    ensureFpsOverlay();
    if (_fpsOverlay) _fpsOverlay.style.display = "block";
  }

  function hideFpsOverlay() {
    if (_fpsOverlay) _fpsOverlay.style.display = "none";
  }

  function showTimeBonusFlash(points) {
    if (!galaxyView || points <= 0) return;
    if (!_timeBonusFlash) {
      _timeBonusFlash = document.createElement("div");
      _timeBonusFlash.setAttribute("aria-hidden", "true");
      _timeBonusFlash.style.cssText = `
        position:fixed;left:50%;top:50%;z-index:4;pointer-events:none !important;
        transform:translate(-50%,-50%) scale(1);
        font:800 clamp(2.4rem,9vw,6rem) ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace;
        line-height:0.95;letter-spacing:0;color:#00FFD1;text-align:center;
        text-shadow:0 0 10px rgba(0,255,209,.86),0 0 28px rgba(0,255,209,.62);
        opacity:0;transition:opacity 260ms ease,transform 260ms cubic-bezier(.2,1.4,.4,1);
      `;
      _timeBonusFlash.style.setProperty("pointer-events", "none", "important");
      galaxyView.appendChild(_timeBonusFlash);
    }
    _timeBonusFlash.textContent = `TIME BONUS +${points}`;
    _timeBonusFlash.style.opacity = "0";
    _timeBonusFlash.style.transform = "translate(-50%,-50%) scale(1.35)";
    requestAnimationFrame(() => {
      if (!_timeBonusFlash) return;
      _timeBonusFlash.style.opacity = "1";
      _timeBonusFlash.style.transform = "translate(-50%,-50%) scale(1)";
    });
    setTimeout(() => {
      if (!_timeBonusFlash) return;
      _timeBonusFlash.style.opacity = "0";
      _timeBonusFlash.style.transform = "translate(-50%,-50%) scale(0.96)";
    }, 1500);
  }

  function trackFpsOverlay() {
    const _fpsNow = performance.now();
    if (_fpsLastTime > 0) {
      const _fpsDt = _fpsNow - _fpsLastTime;
      const _fpsInstant = Math.round(1000 / _fpsDt);
      _fpsAvg = _fpsAvg * 0.9 + _fpsInstant * 0.1;
      if (_fpsDt > (1000 / _fpsWorst)) _fpsWorst = Math.round(1000 / _fpsDt);
      if (_fpsNow - _fpsWorstReset > 3000) {
        _fpsWorst = _fpsInstant;
        _fpsWorstReset = _fpsNow;
      }
    }
    _fpsLastTime = _fpsNow;
    _fpsFrames++;

    if (_fpsFrames % 30 === 0 && _fpsOverlay) {
      const avg = Math.round(_fpsAvg);
      const color = avg >= 50 ? "#00ffee" : avg >= 30 ? "#ffaa00" : "#ff4444";
      _fpsOverlay.style.color = color;
      _fpsOverlay.innerHTML =
        `FPS: ${avg}<br>` +
        `WORST: ${_fpsWorst}<br>` +
        `PARTS: ${sim?.particles?.length || 0}<br>` +
        `ROIDS: ${sim?.asteroids?.length || 0}<br>` +
        `LASERS: ${laserBeams?.length || 0}`;
    }
  }

  const asteroidSpritePaths = {
    roid01: "astgfx/roid01.png",
    roid02: "astgfx/roid02.png",
    roid03: "astgfx/roid03.png",
    hotroid01: "astgfx/hotroid01.png",
  };
  const asteroidSprites = {};
  Object.keys(asteroidSpritePaths).forEach((key) => {
    const img = new Image();
    img.decoding = "async";
    img.src = asteroidSpritePaths[key];
    asteroidSprites[key] = img;
  });

  // 2026-06-10: powerup sprites (256px source, transparent bg, baked-in glow) — drawn ~56px.
  // The bomb powerup keeps its canvas-drawn ring + glyph for now.
  const POWERUP_SPRITE_SIZE = 56;
  const powerupSpritePaths = {
    goldbars: "powerups/powerup_goldbars.png",
    quadshot: "powerups/powerup_quadshot.png",
    timer: "powerups/powerup_timer.png",
    snowflake: "powerups/powerup_freeze.png",
  };
  const powerupSprites = {};
  Object.keys(powerupSpritePaths).forEach((key) => {
    const img = new Image();
    img.decoding = "async";
    img.src = powerupSpritePaths[key];
    powerupSprites[key] = img;
  });

  let galaxyRaf = 0;
  let galaxyRunning = false;
  let engineMode = "menu"; // menu | practice | arcade
  let worldLockEnabled = false;
  let worldLockWidth = 0;
  let worldLockHeight = 0;
  let overlayTimer = null;
  let bgPreRolledForLevel = false;

  let arcadeActive = false;
  let currentLevelIndex = 0;
  let _levelPrimaryColor = "#00FFD1";
  let levelEndsAt = 0;
  let levelDurationMs = 0;
  let levelRunStartAt = 0;
  let arcadePausedUntil = 0;
  let nextSpawnAt = Infinity;
  let spawnQueue = 0;
  let totalToSpawn = 0;
  let spawnedTotal = 0;
  let maxOnScreen = 12;
  let landmine = null;
  // 2026-06-10: player-placed bombs — separate from the single level-scheduled landmine so
  // both can coexist. Same entity shape/phases; updated/drawn/exploded by the shared helpers.
  let placedBombs = [];
  let landmineSpawnedThisLevel = false;
  let playerBombInventory = 0;
  // 2026-06-10: multi-type powerup system (generalized from the single bomb powerup).
  // Types: timer (+30s), goldbars (+1000), quadshot (cluster fire), snowflake (freeze), bomb.
  let powerups = [];
  const POWERUP_MAX_ONSCREEN = 2;
  const POWERUP_WEIGHTS = [
    { type: "goldbars", weight: 15 }, // DEBUG: revert before release (normally 30)
    { type: "timer", weight: 25 },
    { type: "quadshot", weight: 25 },
    { type: "snowflake", weight: 40 }, // DEBUG: revert before release (normally 10)
    { type: "bomb", weight: 10 },
  ];
  const POWERUP_COLORS = {
    bomb: "#00ffcc",
    timer: "#ffaa00",
    goldbars: "#ffd700",
    quadshot: "#cc66ff",
    snowflake: "#88ddff",
  };
  let quadShotUntil = 0;
  let freezeUntil = 0;
  const QUADSHOT_SEEK_RADIUS = 120;
  // 2026-06-10: freeze is now a collectible inventory item activated from the HUD (like bombs)
  let playerFreezeInventory = 0;
  const MAX_FREEZE_INVENTORY = 3;
  const FREEZE_DURATION_MS = 12000;
  let _freezeWasActive = false; // edge-detects freeze expiry for the unfreeze sound
  let goldbarsForceSpawnedThisLevel = false; // DEBUG: revert before release
  let bombAimMode = false;
  let nextBombPowerupAt = performance.now()
    + BOMB_POWERUP_INTERVAL_MIN
    + Math.random() * (BOMB_POWERUP_INTERVAL_MAX - BOMB_POWERUP_INTERVAL_MIN);

  function pickPowerupType() {
    const total = POWERUP_WEIGHTS.reduce((s, w) => s + w.weight, 0);
    let roll = Math.random() * total;
    for (let i = 0; i < POWERUP_WEIGHTS.length; i += 1) {
      roll -= POWERUP_WEIGHTS[i].weight;
      if (roll <= 0) return POWERUP_WEIGHTS[i].type;
    }
    return "bomb";
  }
  let arcadeResumeAvailable = false;
  let pausedLevelRemainingMs = 0;
  let pausedLandmineRemainingMs = 0;
  let landmineFlashUntil = 0;
  let _dangerLoopAudio = null;
  let _streakCount = 0;
  let _streakTimer = null;
  let _praiseCount = 0;
  let _level1ChatterToggle = false; // 2026-06-10: halves praise VO frequency on level 1
  let _lastPraiseAt = 0;
  let lastNiceShotVoAt = 0;
  let lastHypeVoAt = 0;
  let lastPlasmaRechargedVoAt = 0;
  let lastKillStreakVoAt = 0;
  let _timerWarnedAt60 = false;
  let _timerWarnedAt10 = false;
  let _timerNumberVisible = false;
  let _timerSlammed = false;
  let _timerRemainingMs = 0;
  let _timerRatio = 1;
  let _iosAudioFrameBudget = 0;
  let _iosAudioLastFrame = 0;
  // 2026-06-10: set while a quadshot tap resolves its hits — several destruction sounds land
  // in the same frame and the 2-per-frame native budget was silently dropping all but the
  // first two (the UFO destroy sound most noticeably)
  let _sfxBudgetExempt = false;
  let lastAsteroidCollisionSfxAt = 0;
  let suppressAstCollisionSfxUntil = 0;
  let _lastExplosionSoundAt = 0;
  let scoreRenderRaf = 0;
  let warningActive = false;
  let warningLoopHandle = null;
  let warningHapticInterval = null;
  let arcadeLives = 0;
  let arcadeScore = 0;
  let shotsFired = 0;
  let shotsHit = 0;
  let ufosKilledThisLevel = 0;
  let ufo = null;
  let ufoDroneLoopHandle = null;
  let arcadeUfoSpawnAt = 0;
  let retryPending = false;
  const gameTimer = { startedAt: 0, elapsed: 0, running: false, bestTime: null, levelTimes: [] };
  try {
    const _raw = localStorage.getItem(STORAGE_BEST_RUN);
    if (_raw) gameTimer.bestTime = Number(_raw) || null;
  } catch {}
  let debugLevelUnlocked = false;
  let debugModeTapCount = 0;
  let debugModeTapLastAt = 0;
  const initialUfoFxPreset = (() => {
    try {
      return localStorage.getItem(ufoFxPresetKey) || "cyan";
    } catch {
      return "cyan";
    }
  })();
  const ufoDeathFx = typeof window.UfoDeathEffect === "function"
    ? new window.UfoDeathEffect({ maxParticles: 320, preset: initialUfoFxPreset })
    : null;
  const effects = {
    triggerUfoDeath(x, y, presetName = "") {
      ufoDeathFx?.trigger(x, y, presetName);
    },
    update(dtMs) {
      ufoDeathFx?.update(dtMs, sim.width, sim.height);
    },
    draw(drawCtx) {
      ufoDeathFx?.draw(drawCtx, sim.width, sim.height);
    },
  };
  window.setUfoFxPreset = (name) => {
    const preset = ufoDeathFx?.setPreset?.(name) || "cyan";
    try {
      localStorage.setItem(ufoFxPresetKey, preset);
    } catch {
      // ignore
    }
    return preset;
  };
  window.getUfoFxPreset = () => ufoDeathFx?.getPreset?.() || initialUfoFxPreset || "cyan";
  window.listUfoFxPresets = () => (window.UfoDeathEffect?.PRESETS ? [...window.UfoDeathEffect.PRESETS] : ["cyan", "red", "white"]);

  const galaxyModeTitleEl = document.getElementById("galaxyModeTitle");
  const debugLevelPanel = document.getElementById("debugLevelPanel");
  const debugLevelSelect = document.getElementById("debugLevelSelect");
  const btnDebugStartLevel = document.getElementById("btnDebugStartLevel");
  const galaxyTopbar = galaxyView.querySelector(".galaxy-topbar");
  const galaxyHint = galaxyView.querySelector(".galaxy-hint");
  const galaxyTools = galaxyView.querySelector(".galaxy-tools");
  let practiceDebugEl = document.getElementById("practiceDebug");
  if (!practiceDebugEl) {
    practiceDebugEl = document.createElement("div");
    practiceDebugEl.id = "practiceDebug";
    practiceDebugEl.className = "practiceDebug";
    galaxyView.appendChild(practiceDebugEl);
  }
  if (!hudMultiplier && arcadeHud) {
    hudMultiplier = document.createElement("div");
    hudMultiplier.id = "hudMultiplier";
    hudMultiplier.className = hudScore?.className || "hudLives";
    hudMultiplier.textContent = "3.0x";
    if (hudScore?.parentNode) {
      hudScore.parentNode.insertBefore(hudMultiplier, hudScore.nextSibling);
    } else {
      arcadeHud.appendChild(hudMultiplier);
    }
  }

  const playfield = { x: 0, y: 0, w: 0, h: 0, pad: 12, topPad: 0, bottomPad: 0 };
  const canShowCrosshair = typeof window.matchMedia === "function"
    && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  let debugDots = [];
  let practiceLastInput = "idle";
  let practiceTapMarker = null;
  let lastPrimaryPointerAt = 0;

  function showEl(el) {
    if (!el) return;
    el.classList.remove("hidden", "pe-none");
    el.classList.add("pe-auto");
  }

  function hideEl(el) {
    if (!el) return;
    el.classList.add("hidden", "pe-none");
    el.classList.remove("pe-auto");
  }

  function getSafeInsets() {
    const cs = getComputedStyle(document.documentElement);
    const top = parseFloat(cs.getPropertyValue("--sat") || "0") || 0;
    const bottom = parseFloat(cs.getPropertyValue("--sab") || "0") || 0;
    return { top, bottom };
  }

  function setGalaxyViewMode(mode) {
    galaxyView.classList.toggle("mode-menu", mode === "menu");
    galaxyView.classList.toggle("mode-practice", mode === "practice");
    galaxyView.classList.toggle("mode-arcade", mode === "arcade");
    if (mode === "menu") {
      worldLockEnabled = false;
      worldLockWidth = 0;
      worldLockHeight = 0;
      showEl(galaxyModeSelect);
      hideEl(arcadeHud);
      hideEl(galaxyTopbar);
      hideEl(galaxyHint);
      setMenuOverlayOpen(true);
    } else if (mode === "arcade") {
      hideEl(galaxyModeSelect);
      showEl(arcadeHud);
      hideEl(galaxyTopbar);
      hideEl(galaxyHint);
      setMenuOverlayOpen(false);
    } else {
      hideEl(galaxyModeSelect);
      hideEl(arcadeHud);
      showEl(galaxyTopbar);
      showEl(galaxyHint);
      setMenuOverlayOpen(false);
    }
    if (galaxyModeSelect) galaxyModeSelect.setAttribute("aria-hidden", mode === "menu" ? "false" : "true");
    if (arcadeHud) arcadeHud.setAttribute("aria-hidden", mode === "arcade" ? "false" : "true");
  }

  function renderLives() {
    if (!hudLives) return;
    hudLives.textContent = `Lives: ${arcadeLives}`;
  }

  function renderScore() {
    if (!hudScore) return;
    hudScore.textContent = `Score: ${arcadeScore}`;
  }

  function updateHudBombInventory() {
    if (!hudBombBtn) return;
    // 2026-06-09: always visible — grayed-out empty slot at 0, full + count when stocked.
    const hasBombs = playerBombInventory > 0;
    hudBombBtn.style.display = "";
    hudBombBtn.textContent = `\u{1F4A3} \xD7${playerBombInventory}`;
    hudBombBtn.disabled = !hasBombs;
    hudBombBtn.classList.toggle("has-bombs", hasBombs);
    // pulse for attention only when bombs are available and not currently aiming
    hudBombBtn.classList.toggle("bomb-attention", hasBombs && !bombAimMode);
  }

  // 2026-06-10: freeze inventory button — ice-blue twin of the bomb button.
  function updateHudFreezeInventory() {
    if (!hudFreezeBtn) return;
    const hasFreezes = playerFreezeInventory > 0;
    hudFreezeBtn.style.display = "";
    hudFreezeBtn.textContent = `❄ \xD7${playerFreezeInventory}`;
    hudFreezeBtn.disabled = !hasFreezes;
    hudFreezeBtn.classList.toggle("has-freezes", hasFreezes);
  }

  // 2026-06-10: quadshot HUD badge — violet Q with seconds remaining while the effect runs.
  // Called every update frame; only touches the DOM when the displayed second changes.
  function updateHudQuadBadge() {
    if (!hudQuadBadge) return;
    const remaining = quadShotUntil - performance.now();
    const active = remaining > 0;
    hudQuadBadge.classList.toggle("active", active);
    if (active) {
      const label = `Q ${Math.ceil(remaining / 1000)}s`;
      if (hudQuadBadge.textContent !== label) hudQuadBadge.textContent = label;
    }
  }

  function getArcadeScoreMultiplier(now = performance.now()) {
    if (engineMode !== "arcade" || !levelDurationMs) return 1;
    const elapsed = clamp(now - levelRunStartAt, 0, levelDurationMs);
    const progress = elapsed / levelDurationMs;
    return 3 - progress * 2;
  }

  function arcadeMultiplierPoints(basePoints) {
    const safeBase = Math.floor(basePoints || 0);
    if (engineMode !== "arcade") return safeBase;
    return Math.round(safeBase * getArcadeScoreMultiplier());
  }

  function renderScoreMultiplier(now = performance.now()) {
    if (!hudMultiplier) return;
    const multiplier = engineMode === "arcade" ? getArcadeScoreMultiplier(now) : 1;
    hudMultiplier.textContent = `${multiplier.toFixed(1)}x`;
  }

  function scheduleScoreRender() {
    if (isIOSNative) {
      if (scoreRenderRaf) return;
      scoreRenderRaf = requestAnimationFrame(() => {
        scoreRenderRaf = 0;
        renderScore();
        renderScoreMultiplier();
      });
      return;
    }
    renderScore();
    renderScoreMultiplier();
  }

  function addArcadeScore(points) {
    if (engineMode !== "arcade") return;
    arcadeScore = Math.max(0, arcadeScore + Math.floor(points || 0));
    scheduleScoreRender();
  }

  function stopWarningState() {
    warningActive = false;
    galaxyView.classList.remove("warning");
    if (warningLoopHandle) {
      warningLoopHandle.stop();
      warningLoopHandle = null;
    }
    if (warningHapticInterval) {
      clearInterval(warningHapticInterval);
      warningHapticInterval = null;
    }
    audioEngine.stopLoop("warning10");
  }

  function setMenuOverlayOpen(open) {
    menuOverlayOpen = !!open;
    if (!gamePageActive) return;
    audioEngine.setMusicDim(menuOverlayOpen);
  }

  function playArcadeMusicForLevel(levelNum) {
    audioEngine.unlock();
    const url = getMusicForLevel(levelNum);
    audioEngine.playMusic(url, url, { crossfadeMs: 250 });
    const nextUrl = getMusicForLevel(levelNum + 1);
    if (nextUrl && nextUrl !== url) {
      audioEngine.loadMusicBuffer(nextUrl).catch(() => {});
    }
  }

  function formatMs(ms) {
    const safe = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(safe / 60);
    const s = safe % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function resetArcadeTimerVisuals() {
    _timerNumberVisible = false;
    _timerSlammed = false;
    _timerRemainingMs = levelDurationMs;
    _timerRatio = 1;
    if (hudTimer) {
      hudTimer.textContent = "";
      hudTimer.classList.remove("visible", "slam", "warning", "critical");
      hudTimer.style.left = "";
      hudTimer.style.top = "";
    }
    if (arcadeTimerGhost) arcadeTimerGhost.textContent = "";
    if (arcadeTimerBackdrop) {
      arcadeTimerBackdrop.style.opacity = "0";
      arcadeTimerBackdrop.classList.remove("danger");
    }
    drawTimerPerimeterOverlay(performance.now());
  }

  function positionHudTimerOnCanvas() {
    if (!hudTimer || !galaxyPlayCanvas) return;
    const rect = galaxyPlayCanvas.getBoundingClientRect();
    hudTimer.style.left = `${rect.left + rect.width / 2}px`;
    hudTimer.style.top = `${rect.top + rect.height / 2}px`;
  }

  function updateGameTimerHud(now) {
    if (!hudGameTimer) return;
    const elapsed = gameTimer.running
      ? gameTimer.elapsed + (now - gameTimer.startedAt)
      : gameTimer.elapsed;
    hudGameTimer.textContent = `RUN ${formatRunTime(elapsed)}`;
  }

  function updateArcadeHud(now) {
    const remainingMs = levelEndsAt - now;
    const safeRemaining = Math.max(0, remainingMs);
    _timerRemainingMs = safeRemaining;
    _timerRatio = levelDurationMs > 0 ? clamp(safeRemaining / levelDurationMs, 0, 1) : 0;
    updateGameTimerHud(now);
    if (hudLevel) hudLevel.textContent = `LEVEL ${ARCADE_LEVELS[currentLevelIndex]?.level || 1}`;
    renderLives();
    renderScore();
    renderScoreMultiplier(now);
    if (hudTimer) {
      positionHudTimerOnCanvas();
      const showNumber = engineMode === "arcade" && arcadeActive && safeRemaining <= 20000 && safeRemaining > 0;
      hudTimer.textContent = showNumber ? String(Math.ceil(safeRemaining / 1000)) : "";
      hudTimer.classList.toggle("visible", showNumber);
      hudTimer.classList.toggle("warning", showNumber && safeRemaining <= 10000 && safeRemaining > 5000);
      hudTimer.classList.toggle("critical", showNumber && safeRemaining <= 5000);
      if (showNumber && !_timerSlammed) {
        _timerSlammed = true;
        _timerNumberVisible = true;
        hudTimer.classList.remove("slam");
        void hudTimer.offsetWidth;
        hudTimer.classList.add("slam");
      } else if (!showNumber) {
        _timerNumberVisible = false;
        _timerSlammed = false;
        hudTimer.classList.remove("slam", "warning", "critical");
      }
    }
    if (arcadeTimerGhost) arcadeTimerGhost.textContent = "";
    if (arcadeTimerBackdrop) {
      const ratio = levelDurationMs > 0 ? 1 - safeRemaining / levelDurationMs : 0;
      arcadeTimerBackdrop.style.opacity = "0";
      arcadeTimerBackdrop.classList.remove("danger");
      setGalaxyBackgroundDim(ratio);
    }
    if (engineMode === "arcade" && arcadeActive && safeRemaining <= 10000 && safeRemaining > 0) {
      if (!warningActive) {
        warningActive = true;
        galaxyView.classList.add("warning");
        warningLoopHandle = audioEngine.playLoop("warning10", { volume: state.whisper ? 0.28 : 0.6, rate: 1 });
        triggerGameplayHapticImpact(hapticImpactStyle.Medium);
        warningHapticInterval = setInterval(() => {
          if (!warningActive) return;
          triggerGameplayHapticImpact(hapticImpactStyle.Medium);
        }, 600);
      }
      if (!bgPreRolledForLevel) {
        bgPreRolledForLevel = true;
        const currentLevelNum = ARCADE_LEVELS[currentLevelIndex]?.level || 1;
        const nextLevelNum = currentLevelNum + 1;
        const currentKey = bgKeyForLevel(currentLevelNum);
        const nextKey = bgKeyForLevel(nextLevelNum);
        if (nextKey && nextKey !== currentKey) {
          setGalaxyBackgroundKey(nextKey, { fadeMs: 600, fadeInSeconds: 20, immediate: false });
        }
      }
    } else if (warningActive) {
      stopWarningState();
    }
  }

  function syncArcadeEntryLabel() {
    if (!btnArcade) return;
    btnArcade.textContent = "Arcade";
  }

  function setArcadeSubmenu(mode = "root") {
    const showRoot = mode === "root";
    const showArcade = mode === "arcade";
    const showLevels = mode === "levels";
    if (btnArcade) btnArcade.style.display = showRoot ? "" : "none";
    if (btnPractice) btnPractice.style.display = showRoot ? "" : "none";
    if (debugLevelPanel) debugLevelPanel.style.display = "none";
    if (arcadeMenuPanel) {
      arcadeMenuPanel.hidden = !showArcade;
      arcadeMenuPanel.classList.toggle("show", showArcade);
      arcadeMenuPanel.setAttribute("aria-hidden", showArcade ? "false" : "true");
    }
    if (arcadeLevelPanel) {
      arcadeLevelPanel.hidden = !showLevels;
      arcadeLevelPanel.classList.toggle("show", showLevels);
      arcadeLevelPanel.setAttribute("aria-hidden", showLevels ? "false" : "true");
    }
  }

  function buildArcadeLevelSelect() {
    if (!arcadeLevelGrid) return;
    if (arcadeLevelGrid.children.length) return;
    for (let i = 0; i < ARCADE_LEVELS.length; i += 1) {
      const level = ARCADE_LEVELS[i].level;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "arcadeLevelBtn";
      button.textContent = String(level);
      button.addEventListener("click", () => {
        setSavedArcadeLevel(level);
        startArcadeAtLevel(level);
      });
      arcadeLevelGrid.appendChild(button);
    }
  }

  function syncArcadeMenuButtons() {
    if (btnArcadeResume) btnArcadeResume.disabled = !(arcadeResumeAvailable || hasArcadeSave());
    if (btnArcadeLevelSelect) {
      const levelSelectUnlocked = DEBUG_FORCE_LEVEL_SELECT || hasArcadeWon() || hasBeatenGame();
      btnArcadeLevelSelect.disabled = !(DEBUG_FORCE_LEVEL_SELECT || hasArcadeWon());
      // 2026-06-09: .locked sets pointer-events:none, which blocked the button even when
      // debug-unlocked. Keep it locked only when there's genuinely no access.
      btnArcadeLevelSelect.classList.toggle("locked", !levelSelectUnlocked);
    }
  }

  function syncDebugLevelPanel() {
    if (!debugLevelPanel) return;
    debugLevelPanel.hidden = true;
    debugLevelPanel.classList.remove("unlocked");
    debugLevelPanel.setAttribute("aria-hidden", "true");
  }

  function buildDebugLevelSelect() {
    if (!debugLevelSelect) return;
    if (debugLevelSelect.options.length > 0) return;
    for (let i = 0; i < ARCADE_LEVELS.length; i += 1) {
      const level = ARCADE_LEVELS[i].level;
      const option = document.createElement("option");
      option.value = String(level);
      option.textContent = `Level ${level}`;
      debugLevelSelect.appendChild(option);
    }
    debugLevelSelect.value = "1";
  }

  function registerDebugLevelUnlockTap() {
    if (!DEBUG_SHOW_LEVEL_DROPDOWN || engineMode !== "menu") return;
    const now = performance.now();
    if (now - debugModeTapLastAt > 1600) debugModeTapCount = 0;
    debugModeTapLastAt = now;
    debugModeTapCount += 1;
    if (debugModeTapCount >= 7) {
      debugModeTapCount = 0;
      debugLevelUnlocked = true;
      syncDebugLevelPanel();
    }
  }

  function showArcadeOverlay(text, sub = "", durationMs = 0, opts = null) {
    if (!arcadeOverlay || !arcadeOverlayText || !arcadeOverlaySub || !arcadeOverlayBtn) return;
    if (overlayTimer) {
      clearTimeout(overlayTimer);
      overlayTimer = null;
    }
    arcadeOverlayText.textContent = text || "";
    arcadeOverlaySub.textContent = sub || "";
    arcadeOverlayBtn.style.display = opts?.buttonText ? "inline-block" : "none";
    arcadeOverlayBtn.textContent = opts?.buttonText || "";
    arcadeOverlayBtn.onclick = opts?.buttonAction || null;
    if (arcadeOverlayBtnSecondary) {
      arcadeOverlayBtnSecondary.style.display = opts?.secondaryButtonText ? "inline-block" : "none";
      arcadeOverlayBtnSecondary.textContent = opts?.secondaryButtonText || "";
      arcadeOverlayBtnSecondary.onclick = opts?.secondaryButtonAction || null;
    }
    const normalizedText = String(text || "").trim().toUpperCase();
    const isGameOver = normalizedText === "GAME OVER";
    const isRetryOverlay = normalizedText === "TIME'S UP";
    if (isGameOver) {
      arcadeOverlaySub.textContent = "";
      unmountRetryFuzzy();
      mountGameOverFuzzy();
    } else if (isRetryOverlay) {
      playGameSfx("tryagain", 0.96);
      unmountGameOverFuzzy();
      mountRetryFuzzy();
    } else {
      unmountGameOverFuzzy();
      unmountRetryFuzzy();
    }
    showEl(arcadeOverlay);
    arcadeOverlay.classList.add("show");
    if (durationMs > 0) {
      overlayTimer = setTimeout(() => {
        arcadeOverlay.classList.remove("show");
        overlayTimer = null;
      }, durationMs);
    }
  }

  function hideArcadeOverlay() {
    if (!arcadeOverlay || !arcadeOverlayText) return;
    if (overlayTimer) {
      clearTimeout(overlayTimer);
      overlayTimer = null;
    }
    arcadeOverlay.classList.remove("show");
    arcadeOverlayText.classList.remove("show", "fadeOut");
    unmountGameOverFuzzy();
    unmountRetryFuzzy();
    hideEl(arcadeOverlay);
    if (arcadeOverlayBtn) {
      arcadeOverlayBtn.style.display = "none";
      arcadeOverlayBtn.onclick = null;
    }
    if (arcadeOverlayBtnSecondary) {
      arcadeOverlayBtnSecondary.style.display = "none";
      arcadeOverlayBtnSecondary.onclick = null;
    }
  }

  function showLevelIntro(levelNum) {
    if (!arcadeOverlay || !arcadeOverlayText || !arcadeOverlaySub || !arcadeOverlayBtn) return;
    if (overlayTimer) clearTimeout(overlayTimer);

    showEl(arcadeOverlay);
    arcadeOverlay.classList.add("show");
    arcadeOverlay.setAttribute("aria-hidden", "false");
    arcadeOverlayBtn.style.display = "none";
    if (arcadeOverlayBtnSecondary) arcadeOverlayBtnSecondary.style.display = "none";
    arcadeOverlaySub.textContent = "";
    arcadeOverlayText.textContent = `LEVEL ${levelNum}`;
    arcadeOverlayText.classList.remove("fadeOut");
    void arcadeOverlayText.offsetWidth;
    arcadeOverlayText.classList.add("show");

    overlayTimer = setTimeout(() => {
      arcadeOverlayText.classList.add("fadeOut");
      overlayTimer = setTimeout(() => {
        arcadeOverlay.classList.remove("show");
        arcadeOverlay.setAttribute("aria-hidden", "true");
        arcadeOverlayText.classList.remove("show", "fadeOut");
        hideEl(arcadeOverlay);
        overlayTimer = null;
      }, ARCADE_OVERLAY_FADE_MS);
    }, 400);
  }

  function getAsteroid() {
    return sim.asteroidPool.pop() || {};
  }

  function releaseAsteroid(a) {
    a.shape = null;
    a.tossed = false;
    a.tossedAt = 0;
    a._stroidHeld = false;
    delete a._preTossVx;
    delete a._preTossVy;
    sim.asteroidPool.push(a);
  }

  function getParticle() {
    return sim.particlePool.pop() || {};
  }

  function releaseParticle(p) {
    p.flicker = false;
    sim.particlePool.push(p);
  }

  function getRing() {
    return sim.ringPool.pop() || {};
  }

  function releaseRing(ring) {
    sim.ringPool.push(ring);
  }

  function randomVelocity(min, max) {
    const angle = Math.random() * Math.PI * 2;
    const speed = min + Math.random() * (max - min);
    return { vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed };
  }

  function makeShape(pointCount) {
    const points = [];
    for (let i = 0; i < pointCount; i += 1) {
      points.push({
        angle: (Math.PI * 2 * i) / pointCount,
        offset: 0.74 + Math.random() * 0.4,
      });
    }
    return points;
  }

  function getAsteroidSpriteForLevel(levelNum) {
    if (levelNum >= 10) return asteroidSprites.hotroid01;
    if (levelNum >= 7) return asteroidSprites.roid03;
    if (levelNum >= 4) return asteroidSprites.roid02;
    return asteroidSprites.roid01;
  }

  function getAsteroidTintForLevel(level) {
    if (level <= 2)  return null;
    if (level <= 4)  return "rgba(200,80,40,0.18)";
    if (level <= 6)  return "rgba(0,180,160,0.18)";
    if (level <= 8)  return "rgba(140,60,200,0.18)";
    if (level === 9) return "rgba(200,160,0,0.18)";
    return null;
  }

  function getAsteroidSpriteKeyForLevel(levelNum) {
    if (levelNum >= 10) return "hotroid01";
    if (levelNum >= 7) return "roid03";
    if (levelNum >= 4) return "roid02";
    if (levelNum === 2) return Math.random() < 0.5 ? "roid01" : "roid02";
    return "roid01";
  }

  function setGalaxyBackgroundForLevel(levelNum) {
    const key = bgKeyForLevel(levelNum);
    setGalaxyBackgroundKey(key, { fadeMs: 450, fadeInSeconds: 20 });
    const nextKey = bgKeyForLevel(levelNum + 1);
    if (nextKey && nextKey !== key) preloadGalaxyBackgroundKey(nextKey);
  }

  function applyLevelTheme(levelNum) {
    const theme = LEVEL_THEMES[levelNum] ?? LEVEL_THEMES[1];
    _levelPrimaryColor = theme.primary;
    galaxyView?.style.setProperty("--level-primary", theme.primary);
    window.galaxyBackground?.setTheme(levelNum);
  }

  function computePlayfield() {
    const viewRect = galaxyView.getBoundingClientRect();
    const hudRect = arcadeHud && arcadeHud.offsetParent !== null ? arcadeHud.getBoundingClientRect() : null;
    const hudBottom = hudRect ? Math.max(0, Math.ceil(hudRect.bottom - viewRect.top)) : 0;
    const topBar = galaxyView.querySelector(".galaxy-topbar");
    const topBarRect = topBar && topBar.offsetParent !== null ? topBar.getBoundingClientRect() : null;
    const topBarBottom = topBarRect ? Math.max(0, Math.ceil(topBarRect.bottom - viewRect.top)) : 0;
    const hint = galaxyView.querySelector(".galaxy-hint");
    const hintRect = hint && hint.offsetParent !== null ? hint.getBoundingClientRect() : null;
    const hintHeight = hintRect ? Math.ceil(hintRect.height) : 0;
    const safe = getSafeInsets();
    const pad = 12;
    const topPad = Math.max(hudBottom, topBarBottom) + safe.top + pad;
    const bottomPad = hintHeight + safe.bottom + 44 + pad;

    playfield.x = pad;
    playfield.y = topPad;
    playfield.w = Math.max(120, sim.width - pad * 2);
    playfield.h = Math.max(200, sim.height - topPad - bottomPad);
    playfield.pad = pad;
    playfield.topPad = topPad;
    playfield.bottomPad = bottomPad;
  }

  function randomPerimeterPoint() {
    const edge = Math.floor(Math.random() * 4);
    const left = playfield.x;
    const top = playfield.y;
    const right = playfield.x + playfield.w;
    const bottom = playfield.y + playfield.h;
    const inset = 4;
    if (edge === 0) return { x: left + Math.random() * playfield.w, y: top + inset };
    if (edge === 1) return { x: right - inset, y: top + Math.random() * playfield.h };
    if (edge === 2) return { x: left + Math.random() * playfield.w, y: bottom - inset };
    return { x: left + inset, y: top + Math.random() * playfield.h };
  }

  function clampSpeed(entity) {
    const s = Math.hypot(entity.vx, entity.vy);
    if (!Number.isFinite(s)) {
      entity.vx = 30;
      entity.vy = 20;
      return;
    }
    if (s < MIN_SPEED) {
      const ang = Math.random() * Math.PI * 2;
      entity.vx = Math.cos(ang) * MIN_SPEED;
      entity.vy = Math.sin(ang) * MIN_SPEED;
    }
  }

  function wrapEntity(entity) {
    const left = playfield.x;
    const top = playfield.y;
    const right = playfield.x + playfield.w;
    const bottom = playfield.y + playfield.h;

    if (entity.x < left - entity.r) entity.x = right + entity.r - EPS;
    else if (entity.x > right + entity.r) entity.x = left - entity.r + EPS;
    if (entity.y < top - entity.r) entity.y = bottom + entity.r - EPS;
    else if (entity.y > bottom + entity.r) entity.y = top - entity.r + EPS;
  }

  function wrapEntityToCanvas(entity) {
    const left = 0;
    const top = 0;
    const right = sim.width;
    const bottom = sim.height;
    if (entity.x < left - entity.r) entity.x = right + entity.r - EPS;
    else if (entity.x > right + entity.r) entity.x = left - entity.r + EPS;
    if (entity.y < top - entity.r) entity.y = bottom + entity.r - EPS;
    else if (entity.y > bottom + entity.r) entity.y = top - entity.r + EPS;
  }

  function applyMotionHealth(entity, now) {
    const moved = Math.hypot(entity.x - entity.lastX, entity.y - entity.lastY);
    if (moved > 0.2) {
      entity.lastX = entity.x;
      entity.lastY = entity.y;
      entity.lastMoveAt = now;
      return;
    }
    if (now - entity.lastMoveAt > 600) {
      const ang = Math.random() * Math.PI * 2;
      entity.vx += Math.cos(ang) * 15;
      entity.vy += Math.sin(ang) * 15;
      entity.lastMoveAt = now;
    }
  }

  function boomStackVolume(baseVolume, { minRatio = 0.58, windowMs = 220, attenuation = 0.2 } = {}) {
    const now = performance.now();
    while (boomTimes.length && now - boomTimes[0] > windowMs) boomTimes.shift();
    const count = boomTimes.length;
    boomTimes.push(now);
    const scaled = baseVolume * (1 / (1 + count * attenuation));
    return Math.max(baseVolume * minRatio, scaled);
  }

  function playGameSfx(name, volume = 0.9, opts = {}) {
    if (state.minimal) return;
    const iosBoost = isIOSWebKit
      ? ({
        explosion_small: 1.35,
        explosion_small_alt: 1.35,
        explosion_med: 1.25,
        explosion_med_alt: 1.25,
        explosion_big: 1.12,
      }[name] || 1)
      : 1;
    const finalVolume = clamp(volume * (state.whisper ? 0.55 : 1) * iosBoost, 0, 1);
    // 2026-06-09: `important` one-shots (e.g. the plasma net blast) bypass the per-frame
    // budget — otherwise the asteroid-vaporize booms fired in the same frame exhaust the
    // 2-sounds/16ms cap and the plasma blast gets silently dropped on the native app.
    if (isIOSNative && !opts.important && !_sfxBudgetExempt) {
      const frameNow = performance.now();
      if (frameNow - _iosAudioLastFrame < 16) {
        if (_iosAudioFrameBudget >= 2) return;
        _iosAudioFrameBudget++;
      } else {
        _iosAudioFrameBudget = 1;
        _iosAudioLastFrame = frameNow;
      }
    }
    if (opts.forceHtmlOnIOS && isIOSWebKit && !isIOSNative) {
      audioEngine.playHtmlAudio(name, {
        volume: finalVolume,
        rate: opts.rate || 1,
        loop: false,
      });
      return;
    }
    audioEngine.play(name, {
      volume: finalVolume,
      rate: opts.rate || 1,
      detune: opts.detune || 0,
    });
  }
  window.playGameSfx = playGameSfx;

  function resolveGameSfxKey(...keys) {
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      if (GAME_SFX[key]) return key;
    }
    return "";
  }

  function playPlayerFireSound() {
    // FIXED 2026-06-08: Safari desktop needs HTML Audio path — WebAudio context stalls on rapid fire
    if (isSafariDesktop) {
      audioEngine.playHtmlAudio("advfire", { volume: clamp(0.86 * (state.whisper ? 0.55 : 1), 0, 1), rate: 1 });
      return;
    }
    // 2026-06-09: ensure the AudioContext is resumed (Chrome desktop can stay suspended until a gesture)
    if (!audioEngine.unlocked) audioEngine.unlock();
    playGameSfx("advfire", 0.86);
  }

  function startUfoDrone() {
    if (state.minimal) return;
    if (ufoDroneLoopHandle) return;
    ufoDroneLoopHandle = audioEngine.playLoop("droneufo", {
      volume: state.whisper ? 0.18 : 0.38,
      rate: 1,
    });
  }

  function stopUfoDrone() {
    if (ufoDroneLoopHandle) {
      ufoDroneLoopHandle.stop();
      ufoDroneLoopHandle = null;
    }
    audioEngine.stopLoop("droneufo");
  }

  function playAsteroidExplosionBoom(kind, volume, rate) {
    if (isIOSNative) {
      const now = performance.now();
      if (now - _lastExplosionSoundAt < 80) return;
      _lastExplosionSoundAt = now;
    }
    const mediumKeys = ["explosion_med", "explosion_med_alt"];
    const smallKeys = ["explosion_small", "explosion_small_alt"];
    const key = kind >= 3 ? "explosion_big" : kind === 2 ? pick(mediumKeys) : pick(smallKeys);
    playGameSfx(key, volume * 1.8, { rate, forceHtmlOnIOS: true });
  }

  // === Warp Spawns ===
  function playWarpSound() {
    if (prefersReducedMotion || state.minimal) return;
    playGameSfx("warp", 0.48, { rate: 0.98 + Math.random() * 0.08 });
  }

  function playArmSound() {
    playGameSfx("landmine_arm", 0.84);
  }

  function playBigBoomSound() {
    playGameSfx("landmine_boom", 1.8);
    if (isIOSNative) {
      setTimeout(() => playGameSfx("explosion_big", 1.26), 100);
    } else {
      setTimeout(() => playGameSfx("explosion_big", 1.53), 80);
    }
  }

  function playParticleCrackle() {
    try {
      const ctx = audioEngine.ensureContext?.() || audioEngine.ctx;
      if (!ctx || ctx.state === "suspended") return;
      const buffer = audioEngine.buffers.get("particle_crackle1");
      if (!buffer) return;
      const maxOffset = Math.max(0, buffer.duration - 0.5);
      const offset = Math.random() * Math.min(maxOffset, 1.5);
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      source.buffer = buffer;
      gain.gain.value = clamp(0.4 * (state.whisper ? 0.55 : 1), 0, 1);
      source.connect(gain);
      gain.connect(audioEngine.masterGain || ctx.destination);
      source.start(0, offset, 0.5);
    } catch {}
  }

  function triggerLandmineScreenFlash() {
    landmineFlashUntil = performance.now() + 220;
  }

  function triggerAsteroidImpactFlash(intensity = 1) {
    if (intensity < 0.3) return;
    cssFlash("#fff8e8", Math.min(0.15, intensity * 0.15), 100);
  }

  function triggerLevel10AsteroidFlash(big = false) {
    void big;
  }

  function addLightningRing(x, y, opts = {}) {
    sim.lightningRings.push({
      x,
      y,
      life: 0,
      ttl: opts.ttl || 460,
      radius: opts.radius || 64,
      thickness: opts.thickness || 3,
      arcCount: opts.arcCount || (isIOSWebKit ? 10 : 16),
      jitter: opts.jitter || 10,
      spin: Math.random() * Math.PI * 2,
      colorA: opts.colorA || "rgba(215,248,255,0.95)",
      colorB: opts.colorB || "rgba(160,235,255,0.65)",
      glow: opts.glow || "rgba(185,240,255,0.75)",
    });
  }

  function addWarpRing(x, y, color = "rgba(112,255,178,1)") {
    if (isIOSNative && sim.warpRings.length >= 3) {
      sim.warpRings.shift();
    }
    const ring = getRing();
    ring.x = x;
    ring.y = y;
    ring.life = 0;
    ring.ttl = prefersReducedMotion ? 300 : 450;
    ring.baseR = prefersReducedMotion ? 8 : 10;
    ring.maxR = prefersReducedMotion ? 36 : 54;
    ring.alpha = prefersReducedMotion ? 0.24 : 0.42;
    ring.color = color;
    sim.warpRings.push(ring);
  }

  function spawnAsteroid(x, y, kind = 3, warp = true) {
    if (sim.asteroids.length >= sim.maxAsteroids) return null;
    const a = getAsteroid();
    const r = kind === 3 ? 26 + Math.random() * 12 : kind === 2 ? 18 + Math.random() * 8 : 10 + Math.random() * 6;
    const speed = kind === 3 ? 18 + Math.random() * 20 : kind === 2 ? 28 + Math.random() * 27 : 45 + Math.random() * 35;
    const v = randomVelocity(speed * 0.8, speed);
    a.x = x;
    a.y = y;
    a.vx = v.vx;
    a.vy = v.vy;
    a.r = r;
    a.mass = r * r;
    a.kind = kind;
    const levelNum = engineMode === "arcade" ? (ARCADE_LEVELS[currentLevelIndex]?.level || 1) : 1;
    a.spriteKey = getAsteroidSpriteKeyForLevel(levelNum);
    a.rot = Math.random() * Math.PI * 2;
    a.spin = (Math.random() - 0.5) * 0.06;
    a.shape = makeShape(8 + Math.floor(Math.random() * 4));
    a.lastX = x;
    a.lastY = y;
    a.lastMoveAt = performance.now();
    // 2026-06-10: spawn stamp — bomb shrapnel only damages asteroids that existed when the
    // blast detonated (shrapnel pieces linger ~2s and were killing later spawns).
    a.spawnedAtMs = performance.now();
    sim.asteroids.push(a);
    if (warp) {
      playWarpSound();
      addWarpRing(x, y);
    }
    return a;
  }

  function spawnLandmine() {
    let x = playfield.x + playfield.w * (0.25 + Math.random() * 0.5);
    let y = playfield.y + playfield.h * (0.25 + Math.random() * 0.5);
    const r = 14;
    // 2026-06-09: keep the mine clear of the ship (screen center). The 25–75% spawn band
    // includes the center, so it could land inside the pickup radius and be auto-collected
    // the instant it appeared (wrong "pickup" blip, then vanishes). Push it outward to a
    // safe distance, clamped to the playfield.
    const shipX = sim.width / 2;
    const shipY = sim.height / 2;
    const minDist = r + BOMB_PICKUP_RADIUS + 90;
    let dx = x - shipX;
    let dy = y - shipY;
    let dist = Math.hypot(dx, dy);
    if (dist < minDist) {
      if (dist < 1) { dx = 1; dy = 0; dist = 1; }
      x = clamp(shipX + (dx / dist) * minDist, playfield.x + r, playfield.x + playfield.w - r);
      y = clamp(shipY + (dy / dist) * minDist, playfield.y + r, playfield.y + playfield.h - r);
    }
    landmine = createMineEntity(x, y);
    commBoxController.reactTo("landmine");
    playGameSfx("blip1", 0.8, { rate: 1.05 });
    addWarpRing(x, y, "rgba(124,255,91,1)");
  }

  // 2026-06-10: shared landmine entity shape — used by level mines and player-placed bombs.
  function createMineEntity(x, y) {
    const r = 14;
    return {
      x,
      y,
      r,
      mass: r * r * 2,
      vx: (Math.random() < 0.5 ? -1 : 1) * (25 + Math.random() * 25),
      vy: (Math.random() < 0.5 ? -1 : 1) * (25 + Math.random() * 25),
      phase: "spawned",
      spawnedAt: performance.now(),
      armedAt: 0,
      playerArmedAt: 0,
      lastX: x,
      lastY: y,
      lastMoveAt: performance.now(),
    };
  }

  // 2026-06-10: bomb deploy places an unarmed landmine at the tap point (was an instant blast).
  function placeBombFromInventory(x, y) {
    if (playerBombInventory <= 0) return false;
    if (placedBombs.length >= MAX_BOMB_INVENTORY) return false;
    const r = 14;
    const px = clamp(x, playfield.x + r, playfield.x + playfield.w - r);
    const py = clamp(y, playfield.y + r, playfield.y + playfield.h - r);
    placedBombs.push(createMineEntity(px, py));
    playerBombInventory--;
    updateHudBombInventory();
    playGameSfx("blip1", 0.85);
    addWarpRing(px, py, "rgba(124,255,91,1)");
    return true;
  }

  function levelHasLandmine(levelNum) {
    // 2026-06-10: progressive introduction — L1 clean, L2 first landmine, L3 UFOs, L4 powerups.
    if (levelNum < 2) return false;
    return levelNum === 2 || levelNum === 3 || levelNum === 5 || levelNum === 8;
  }

  function setupUfoSpawnForLevel(cfg) {
    arcadeUfoSpawnAt = 0;
    stopUfoDrone();
    ufo = null;
    if (engineMode !== "arcade") return;
    // 2026-06-10: progressive introduction — no UFOs before level 3.
    if ((cfg?.level || 1) < 3) return;
    // Spawn one UFO 10s into the level.
    arcadeUfoSpawnAt = performance.now() + 10000;
  }

  function spawnUfo() {
    const x = playfield.x + playfield.w * (0.15 + Math.random() * 0.7);
    const y = playfield.y + playfield.h * (0.15 + Math.random() * 0.7);
    ufo = {
      x,
      y,
      r: 16,
      mass: 16 * 16 * 2.2,
      vx: (Math.random() < 0.5 ? -1 : 1) * (120 + Math.random() * 60),
      vy: (Math.random() < 0.5 ? -1 : 1) * (120 + Math.random() * 60),
      alive: true,
      spawnedAt: performance.now(),
      despawnAt: performance.now() + 20000,
      teleportAt: performance.now() + (900 + Math.random() * 500),
      hitCount: 0,
      damagedAt: 0,
      lastX: x,
      lastY: y,
      lastMoveAt: performance.now(),
    };
    playGameSfx("ufo_spawn", 0.6);
    startUfoDrone();
    commBoxController.reactTo("ufo");
    // FIXED 2026-06-08: removed priority:"high" so UFO comm queues rather than cutting current comm
    commBoxController.queueVO({
      audioSrc: commBoxController.commVoSrc("vo-ufo_spotted_takeemout.mp3"),
      event: "ufo",
    });
    addWarpRing(x, y, "rgba(160,255,255,1)");
  }

  function isPointOnUfo(x, y) {
    if (!ufo || !ufo.alive) return false;
    return Math.hypot(ufo.x - x, ufo.y - y) <= ufo.r + 10;
  }

  function hitUfo() {
    if (!ufo || !ufo.alive) return;
    const x = ufo.x;
    const y = ufo.y;
    ufo.hitCount += 1;
    shotsHit += 1;
    if (ufo.hitCount === 1) {
      ufo.damagedAt = performance.now();
      playGameSfx("ufo_hit1", 0.72);
      return;
    }
    if (isIOSNative) {
      playGameSfx("ufo_destroy", 0.9);
      spawnExplosion(x, y, 8, false, 1.0);
      setTimeout(() => {
        effects.triggerUfoDeath(x, y);
      }, 32);
    } else {
      playGameSfx("ufo_destroy", 0.84);
      playGameSfx("life_gain", 0.84);
      effects.triggerUfoDeath(x, y);
      spawnExplosion(x, y, 18, false, 1.4);
    }
    const ufoX = ufo.x;
    const ufoY = ufo.y;
    const blastTime = performance.now();
    for (let i = 0; i < sim.asteroids.length; i += 1) {
      const a = sim.asteroids[i];
      const dx = a.x - ufoX;
      const dy = a.y - ufoY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > UFO_BLAST_RADIUS) continue;
      const falloff = 1 - (dist / UFO_BLAST_RADIUS);
      const force = UFO_BLAST_FORCE * falloff;
      const nx = dist > 0 ? dx / dist : Math.random() - 0.5;
      const ny = dist > 0 ? dy / dist : Math.random() - 0.5;
      a.vx += nx * force;
      a.vy += ny * force;
      const speed = Math.sqrt(a.vx * a.vx + a.vy * a.vy);
      if (speed > 8) {
        a.vx = (a.vx / speed) * 8;
        a.vy = (a.vy / speed) * 8;
      }
      a._ufoBlasted = blastTime;
      a._ufoBlastedDuration = UFO_GLOW_DURATION;
      a._ufoBlastOriginX = ufoX;
      a._ufoBlastOriginY = ufoY;
      a._ufoBlastIntensity = falloff;
    }
    cssFlash("#00ffee", 0.3, 250);
    cssShake(1.0);
    addWarpRing(x, y, "rgba(172,255,214,1)");
    playGameSfx("blip", 0.65);
    stopUfoDrone();
    ufosKilledThisLevel += 1;
    ufo = null;
    commBoxController.queueVO({
      audioSrc: commBoxController.commVoSrc("vo-quicklaugh.mp3"),
      event: "levelcomplete",
    });
    plasmaCage.cooldownUntil = 0;
    plasmaCage.rechargeSoundPlayed = true;
    addArcadeScore(100);
    arcadeLives = clamp(arcadeLives + 1, 0, MAX_LIVES);
    renderLives();
  }

  function spawnExplosion(x, y, count = 14, fire = false, blastScale = 1, ttlScale = 1, asteroidKind = 3, spriteKey = "roid01") {
    if (isIOSNative && sim.particles.length >= MAX_EXPLOSION_PARTICLES) return;
    const isLarge = asteroidKind >= 2;
    const isSmallAsteroid = asteroidKind === 1 && !fire;
    const isMediumAsteroid = asteroidKind === 2 && !fire;
    const particleCount = isIOSNative
      ? (isLarge ? Math.ceil(count / 2) : Math.ceil(count / 3))
      : count;
    const emitCount = prefersReducedMotion ? Math.min(6, particleCount) : particleCount;
    function pushAsteroidChunk() {
      if (isIOSNative && sim.particles.length >= MAX_EXPLOSION_PARTICLES) return;
      if (sim.particles.length >= MAX_EXPLOSION_PARTICLES) return;
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 80;
      const p = getParticle();
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.life = 0;
      p.ttl = (600 + Math.random() * 200) * (isMediumAsteroid ? 1.2 : 1);
      p.size = (2.5 + Math.random() * 2) * (isMediumAsteroid ? 1.3 : 1);
      p.alpha = 0.8 + Math.random() * 0.2;
      if (Math.random() < 0.72) {
        p.color = `rgba(${245 + Math.floor(Math.random() * 10)},${238 + Math.floor(Math.random() * 14)},${210 + Math.floor(Math.random() * 24)},`;
      } else {
        p.color = `rgba(${242 + Math.floor(Math.random() * 13)},${188 + Math.floor(Math.random() * 44)},${70 + Math.floor(Math.random() * 50)},`;
      }
      sim.particles.push(p);
    }
    function sparkColorForSprite() {
      if (spriteKey === "roid02") {
        return Math.random() < 0.5 ? "rgba(120,80,255," : "rgba(60,140,255,";
      }
      if (spriteKey === "roid03") {
        return Math.random() < 0.5 ? "rgba(255,200,0," : "rgba(255,140,0,";
      }
      if (spriteKey === "hotroid01") {
        const roll = Math.random();
        if (roll < 0.4) return "rgba(255,60,0,";
        if (roll < 0.8) return "rgba(255,200,50,";
        return "rgba(255,255,180,";
      }
      return "rgba(0,255,209,";
    }
    function pushSpriteSpark() {
      if (isIOSNative && sim.particles.length >= MAX_EXPLOSION_PARTICLES) return;
      if (sim.particles.length >= MAX_EXPLOSION_PARTICLES) return;
      const angle = Math.random() * Math.PI * 2;
      const hot = spriteKey === "hotroid01";
      const speed = hot ? 220 + Math.random() * 100 : 180 + Math.random() * 100;
      const p = getParticle();
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.life = 0;
      p.ttl = 120 + Math.random() * 80;
      p.size = 1.0 + Math.random();
      p.alpha = 0.9;
      p.color = sparkColorForSprite();
      p.flicker = true;
      sim.particles.push(p);
    }
    for (let i = 0; i < emitCount; i += 1) {
      if (isIOSNative && sim.particles.length >= MAX_EXPLOSION_PARTICLES) break;
      if (sim.particles.length >= MAX_EXPLOSION_PARTICLES) break;
      const angle = Math.random() * Math.PI * 2;
      const speed = isSmallAsteroid ? 60 + Math.random() * 140 : 30 + Math.random() * 110;
      const p = getParticle();
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.life = 0;
      p.ttl = (isSmallAsteroid ? 480 + Math.random() * 220 : 320 + Math.random() * 180) * ttlScale * (isMediumAsteroid ? 1.2 : 1);
      p.size = (isSmallAsteroid ? 1.7 + Math.random() * 2.4 : 1.7 + Math.random() * 2.4) * blastScale * (isMediumAsteroid ? 1.3 : 1);
      p.alpha = 0.45 + Math.random() * 0.4;
      if (fire) {
        p.color = `rgba(${220 + Math.floor(Math.random() * 35)},${100 + Math.floor(Math.random() * 90)},${30 + Math.floor(Math.random() * 40)},`;
      } else {
        const tone = Math.random();
        if (tone < (isSmallAsteroid ? 0.65 : 0.48)) {
          p.color = `rgba(${245 + Math.floor(Math.random() * 10)},${238 + Math.floor(Math.random() * 14)},${210 + Math.floor(Math.random() * 24)},`;
        } else if (tone < 0.84) {
          p.color = `rgba(${242 + Math.floor(Math.random() * 13)},${188 + Math.floor(Math.random() * 44)},${70 + Math.floor(Math.random() * 50)},`;
        } else {
          p.color = `rgba(${12 + Math.floor(Math.random() * 18)},${10 + Math.floor(Math.random() * 18)},${8 + Math.floor(Math.random() * 18)},`;
          p.ttl += 520 + Math.random() * 260;
          p.size *= 1.35;
          p.vx *= 0.42;
          p.vy *= 0.42;
          p.alpha = Math.max(p.alpha, 0.62);
        }
      }
      sim.particles.push(p);
    }
    if (isSmallAsteroid || isMediumAsteroid) {
      const chunkCount = isSmallAsteroid ? 2 : 3;
      for (let i = 0; i < chunkCount; i += 1) {
        pushAsteroidChunk();
      }
    }
    const sparkCount = spriteKey === "hotroid01" ? 8 : 5 + Math.floor(Math.random() * 2);
    for (let i = 0; i < sparkCount; i += 1) {
      pushSpriteSpark();
    }
  }

  function playBoomSound(intensity = 1) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx || state.minimal) return;
    if (!audioContext) audioContext = new AudioCtx();
    const now = audioContext.currentTime;
    const master = audioContext.createGain();
    const osc = audioContext.createOscillator();
    const noise = audioContext.createOscillator();
    const toneGain = audioContext.createGain();
    const noiseGain = audioContext.createGain();
    master.connect(audioContext.destination);
    osc.connect(toneGain);
    noise.connect(noiseGain);
    toneGain.connect(master);
    noiseGain.connect(master);
    const peak = clamp((state.whisper ? 0.08 : 0.26) * intensity, 0.06, 0.42);
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(peak, now + 0.02);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
    osc.type = "triangle";
    osc.frequency.setValueAtTime(170, now);
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.2);
    toneGain.gain.setValueAtTime(0.4, now);
    toneGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    noise.type = "square";
    noise.frequency.setValueAtTime(40, now);
    noiseGain.gain.setValueAtTime(0.2, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    osc.start(now);
    noise.start(now);
    osc.stop(now + 0.24);
    noise.stop(now + 0.2);
  }

  function resolveCircleCollision(a, b, restitution = 0.92, playCollisionSfx = true) {
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    const minDist = a.r + b.r;
    let distSq = dx * dx + dy * dy;
    if (distSq >= minDist * minDist) return;

    if (distSq <= EPS) {
      const ang = Math.random() * Math.PI * 2;
      dx = Math.cos(ang);
      dy = Math.sin(ang);
      distSq = 1;
    }

    const dist = Math.sqrt(distSq);
    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = minDist - dist;
    const massA = Number.isFinite(a.mass) && a.mass > 0 ? a.mass : Math.max(1, (a.r || 1) * (a.r || 1));
    const massB = Number.isFinite(b.mass) && b.mass > 0 ? b.mass : Math.max(1, (b.r || 1) * (b.r || 1));
    const totalMass = massA + massB;
    const pushA = overlap * (massB / totalMass);
    const pushB = overlap * (massA / totalMass);
    a.x -= nx * pushA;
    a.y -= ny * pushA;
    b.x += nx * pushB;
    b.y += ny * pushB;

    const rvx = b.vx - a.vx;
    const rvy = b.vy - a.vy;
    const velAlongNormal = rvx * nx + rvy * ny;
    if (velAlongNormal > 0) return;

    const impulse = (-(1 + restitution) * velAlongNormal) / (1 / massA + 1 / massB);
    const ix = impulse * nx;
    const iy = impulse * ny;
    a.vx -= ix / massA;
    a.vy -= iy / massA;
    b.vx += ix / massB;
    b.vy += iy / massB;

    if (playCollisionSfx) {
      const now = performance.now();
      if (now < suppressAstCollisionSfxUntil) return;
      const impact = Math.abs(velAlongNormal);
      if (impact > 8 && now - lastAsteroidCollisionSfxAt > 95) {
        const isBigCollision = (a.kind || 1) >= 3 || (b.kind || 1) >= 3;
        playGameSfx(isBigCollision ? "astcollide2" : "astcollide1", 0.44);
        lastAsteroidCollisionSfxAt = now;
      }
    }
  }

  // === Collisions ===
  const _collGrid = { cells: {}, cellSize: 120 };
  function _gridKey(cx, cy) {
    return (cx << 16) ^ cy;
  }

  function resolveAsteroidCollisions() {
    const count = sim.asteroids.length;
    if (count < 2) return;
    if (count > 40 && engineMode !== "arcade") return;

    const cs = _collGrid.cellSize;
    const cells = _collGrid.cells;
    for (const k in cells) cells[k] = null;

    for (let i = 0; i < count; i += 1) {
      const a = sim.asteroids[i];
      const cx = Math.floor(a.x / cs);
      const cy = Math.floor(a.y / cs);
      for (let ox = -1; ox <= 1; ox += 1) {
        for (let oy = -1; oy <= 1; oy += 1) {
          const key = _gridKey(cx + ox, cy + oy);
          if (!cells[key]) cells[key] = [];
          cells[key].push(i);
        }
      }
    }

    const checked = new Set();
    for (let i = 0; i < count; i += 1) {
      const a = sim.asteroids[i];
      const cx = Math.floor(a.x / cs);
      const cy = Math.floor(a.y / cs);
      const bucket = cells[_gridKey(cx, cy)];
      if (!bucket) continue;
      for (let k = 0; k < bucket.length; k += 1) {
        const j = bucket[k];
        if (j <= i) continue;
        const pairKey = (i << 12) ^ j;
        if (checked.has(pairKey)) continue;
        checked.add(pairKey);
        const b = sim.asteroids[j];
        if (a.tossed || b.tossed || a._stroidHeld || b._stroidHeld) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        if ((dx * dx) + (dy * dy) > 40000) continue;
        resolveCircleCollision(a, b, 0.92);
      }
    }
    for (let i = 0; i < sim.asteroids.length; i += 1) {
      wrapEntity(sim.asteroids[i]);
      clampSpeed(sim.asteroids[i]);
    }
  }

  function collideMineWithAsteroids(mine) {
    if (!mine) return;
    for (let i = 0; i < sim.asteroids.length; i += 1) {
      resolveCircleCollision(mine, sim.asteroids[i], 0.9, false);
    }
    wrapEntity(mine);
    clampSpeed(mine);
  }

  function collideLandmineWithAsteroids() {
    collideMineWithAsteroids(landmine);
  }

  function findHitAsteroidIndex(x, y) {
    let best = -1;
    let bestDist = Infinity;
    for (let i = 0; i < sim.asteroids.length; i += 1) {
      const a = sim.asteroids[i];
      const dx = a.x - x;
      const dy = a.y - y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d <= a.r + 10 && d < bestDist) {
        best = i;
        bestDist = d;
      }
    }
    return best;
  }

  // 2026-06-10: nearest asteroid center within maxDist of (x, y), or -1 — quadshot target seek.
  function findNearestAsteroidIndex(x, y, maxDist) {
    let best = -1;
    let bestDist = maxDist;
    for (let i = 0; i < sim.asteroids.length; i += 1) {
      const d = Math.hypot(sim.asteroids[i].x - x, sim.asteroids[i].y - y);
      if (d <= bestDist) {
        best = i;
        bestDist = d;
      }
    }
    return best;
  }

  function resetStroidToss() {
    if (stroidToss.asteroid) {
      stroidToss.asteroid._stroidHeld = false;
    }
    if (stroidToss.mine) {
      stroidToss.mine._stroidHeld = false;
    }
    stroidToss.active = false;
    stroidToss.asteroidIndex = -1;
    stroidToss.asteroid = null;
    stroidToss.mine = null;
    stroidToss.holdStart = 0;
    stroidToss.grabbed = false;
    galaxyPlayCanvas.style.cursor = "";
    stroidToss.dragX = 0;
    stroidToss.dragY = 0;
    stroidToss.pointerId = null;
    stroidToss.grabX = 0;
    stroidToss.grabY = 0;
    stroidToss.startX = 0;
    stroidToss.startY = 0;
    stroidToss.lastHapticAt = 0;
    stroidToss.lastSparkAt = 0;
    stroidToss.samples.length = 0;
  }

  function startStroidToss(index, point, pointerId, now) {
    const asteroid = sim.asteroids[index];
    // 2026-06-11: an in-flight (flaming) tossed stroid can't be grabbed again — re-grabbing
    // pinned it in place (grab zeroes velocity), which is what stalled upward tosses.
    if (!asteroid || asteroid.kind < 2 || asteroid.tossed) return false;
    resetStroidToss();
    stroidToss.active = true;
    stroidToss.asteroidIndex = index;
    stroidToss.asteroid = asteroid;
    stroidToss.holdStart = now;
    stroidToss.grabbed = false;
    stroidToss.dragX = point.x;
    stroidToss.dragY = point.y;
    stroidToss.pointerId = pointerId ?? null;
    stroidToss.grabX = point.x;
    stroidToss.grabY = point.y;
    stroidToss.startX = asteroid.x;
    stroidToss.startY = asteroid.y;
    stroidToss.lastHapticAt = now;
    stroidToss.lastSparkAt = 0;
    stroidToss.samples.length = 0;
    stroidToss.samples.push({ x: point.x, y: point.y, t: performance.now() });
    asteroid._stroidHeld = true;
    asteroid.tossed = false;
    asteroid.tossedAt = 0;
    delete asteroid.tossHealth;
    asteroid._preTossVx = asteroid.vx;
    asteroid._preTossVy = asteroid.vy;
    asteroid.vx = 0;
    asteroid.vy = 0;
    triggerGameplayHapticImpact(hapticImpactStyle.Light);
    return true;
  }

  // 2026-06-11: nearest grabbable mine (placed bomb or level landmine) under (x, y), or null.
  // Any phase is grabbable. Mines take grab priority over stroids at an overlapping point.
  function findGrabbableMineAt(x, y) {
    let best = null;
    let bestDist = Infinity;
    const consider = (mine) => {
      if (!mine) return;
      const d = Math.hypot(mine.x - x, mine.y - y);
      if (d <= mine.r + 12 && d < bestDist) {
        best = mine;
        bestDist = d;
      }
    };
    consider(landmine);
    for (let i = 0; i < placedBombs.length; i += 1) consider(placedBombs[i]);
    return best;
  }

  // 2026-06-11: begin a grab on a mine — mirrors startStroidToss but the mine keeps its fuse
  // running (no kind gate; grabbable mid-countdown). Reuses the shared stroidToss state so the
  // drag/hold/launch path is identical.
  function startMineToss(mine, point, pointerId, now) {
    if (!mine) return false;
    resetStroidToss();
    stroidToss.active = true;
    stroidToss.mine = mine;
    stroidToss.holdStart = now;
    stroidToss.grabbed = false;
    stroidToss.dragX = point.x;
    stroidToss.dragY = point.y;
    stroidToss.pointerId = pointerId ?? null;
    stroidToss.grabX = point.x;
    stroidToss.grabY = point.y;
    stroidToss.startX = mine.x;
    stroidToss.startY = mine.y;
    stroidToss.lastHapticAt = now;
    stroidToss.lastSparkAt = 0;
    stroidToss.samples.length = 0;
    stroidToss.samples.push({ x: point.x, y: point.y, t: performance.now() });
    mine._stroidHeld = true;
    mine._tossActive = false;
    mine._preTossVx = mine.vx;
    mine._preTossVy = mine.vy;
    mine.vx = 0;
    mine.vy = 0;
    triggerGameplayHapticImpact(hapticImpactStyle.Light);
    return true;
  }

  function getStroidTossAsteroid() {
    if (!stroidToss.active || !stroidToss.asteroid) return null;
    if (!sim.asteroids.includes(stroidToss.asteroid)) {
      resetStroidToss();
      return null;
    }
    return stroidToss.asteroid;
  }

  // 2026-06-11: the grabbed entity for the shared drag/hold/launch path — an asteroid OR a
  // mine. Mines live in placedBombs / landmine (not sim.asteroids); a held mine that detonates
  // in-hand (fuse expiry) vanishes from its container, so self-heal the grab when that happens.
  function getGrabbedEntity() {
    if (!stroidToss.active) return null;
    if (stroidToss.mine) {
      const m = stroidToss.mine;
      if (m !== landmine && !placedBombs.includes(m)) {
        resetStroidToss();
        return null;
      }
      return m;
    }
    return getStroidTossAsteroid();
  }

  function updateStroidTossDrag(point) {
    const asteroid = getGrabbedEntity();
    if (!asteroid) return;
    stroidToss.dragX = point.x;
    stroidToss.dragY = point.y;
    // 2026-06-10: ring buffer of recent pointer samples for flick-direction throws
    stroidToss.samples.push({ x: point.x, y: point.y, t: performance.now() });
    if (stroidToss.samples.length > 8) stroidToss.samples.shift();
    asteroid.vx = 0;
    asteroid.vy = 0;
    const dx = point.x - stroidToss.startX;
    const dy = point.y - stroidToss.startY;
    const len = Math.hypot(dx, dy);
    if (len > 0.1) {
      asteroid.x = point.x - (dx / len) * asteroid.r;
      asteroid.y = point.y - (dy / len) * asteroid.r;
    } else {
      asteroid.x = stroidToss.startX;
      asteroid.y = stroidToss.startY;
    }
  }

  function updateStroidTossHold(now) {
    const asteroid = getGrabbedEntity();
    if (!asteroid) return;
    // 2026-06-11: self-heal an orphaned grab. If the owning pointer gesture is gone (replaced
    // by a stray tap, or never released), the grab would otherwise pin the stroid in place
    // forever — release it so the stroid resumes motion (this was sticking tossed stroids).
    if (!galaxyGesture || galaxyGesture.mode !== "stroidToss") {
      cancelStroidToss();
      return;
    }
    if (!stroidToss.grabbed) {
      asteroid.vx = 0;
      asteroid.vy = 0;
      if (now - stroidToss.lastHapticAt >= 200) {
        stroidToss.lastHapticAt = now;
        triggerGameplayHapticImpact(hapticImpactStyle.Light);
      }
      if (now - stroidToss.holdStart >= STROID_TOSS_HOLD_MS) {
        stroidToss.grabbed = true;
        galaxyPlayCanvas.style.cursor = "grabbing";
        stroidToss.lastSparkAt = 0;
        triggerGameplayHapticImpact(hapticImpactStyle.Heavy);
        // 2026-06-10: grab crunch — at the grabbed transition, not pointerdown, so plain
        // taps on asteroids don't crunch before their destruction boom
        playGameSfx("crunch", 0.85);
      }
    }
  }

  function cancelStroidToss() {
    // restore the pre-grab drift on whichever entity was held (asteroid or mine)
    const entity = stroidToss.asteroid || stroidToss.mine;
    if (entity) {
      entity._stroidHeld = false;
      entity.vx = entity._preTossVx ?? entity.vx;
      entity.vy = entity._preTossVy ?? entity.vy;
      delete entity._preTossVx;
      delete entity._preTossVy;
    }
    resetStroidToss();
  }

  function launchStroidToss(now) {
    // 2026-06-11: shared launch for stroids AND mines. The flick sampling / guards are
    // identical; only the launch speed scale and the per-entity finalization differ.
    const entity = getGrabbedEntity();
    if (!entity) return false;
    const isMine = !!stroidToss.mine;
    // 2026-06-10: throw direction comes from the LAST ≤200ms of pointer movement, not the
    // total drag delta — a fast flick that curved or ended near the grab point used to throw
    // backwards (the old <12px fallback even reused the asteroid's random pre-grab drift).
    // 200ms (was 120) keeps the grab-time seed sample in range for sub-200ms flicks.
    // 2026-06-12: a grabbed stroid released with no/minimal flick gets a slow cold toss (no
    // flame) in its pre-grab drift direction (or straight up) instead of dropping dead in place.
    // Mines keep their drop-in-place lob. Quick taps (never grabbed) fall through to handleArcadeTap.
    const slowTossFallback = () => {
      if (isMine || !stroidToss.grabbed) return false;
      const pvx = entity._preTossVx || 0;
      const pvy = entity._preTossVy || 0;
      const pl = Math.hypot(pvx, pvy);
      let dnx = 0;
      let dny = -1; // default: straight up from the grab point
      if (pl > 1) { dnx = pvx / pl; dny = pvy / pl; }
      entity.vx = dnx * STROID_TOSS_SLOW_SPEED;
      entity.vy = dny * STROID_TOSS_SLOW_SPEED;
      entity._stroidHeld = false;
      delete entity._preTossVx;
      delete entity._preTossVy;
      entity.tossed = true;
      entity.tossedAt = now;
      entity.tossHealth = 3;
      sim.tossedAsteroid = entity;
      playGameSfx(Math.random() < 0.5 ? "stroidthrow1" : "stroidthrow2", 0.5);
      resetStroidToss();
      return true;
    };
    const releaseT = performance.now();
    let ref = null;
    for (let i = 0; i < stroidToss.samples.length; i += 1) {
      if (releaseT - stroidToss.samples[i].t <= 200) {
        ref = stroidToss.samples[i]; // oldest sample within the window
        break;
      }
    }
    if (!ref) return slowTossFallback(); // no recent movement — slow cold toss instead of dropping
    const dx = stroidToss.dragX - ref.x;
    const dy = stroidToss.dragY - ref.y;
    const len = Math.hypot(dx, dy);
    if (len < 10) return slowTossFallback(); // insufficient flick — slow cold toss in the drift direction
    const nx = dx / len;
    const ny = dy / len;
    // bombs are heavy: launch at 0.45x a stroid's speed so they lob rather than zoom
    const baseSpeed = STROID_TOSS_MIN_SPEED + Math.random() * (STROID_TOSS_MAX_SPEED - STROID_TOSS_MIN_SPEED);
    const speed = isMine ? baseSpeed * MINE_TOSS_SPEED_FACTOR : baseSpeed;
    entity.vx = nx * speed;
    entity.vy = ny * speed;
    entity._stroidHeld = false;
    delete entity._preTossVx;
    delete entity._preTossVy;
    if (isMine) {
      // heavy lob: friction in updateMineEntity decelerates it to a stop in ~1-1.5s
      entity._tossActive = true;
      entity.lastMoveAt = now; // don't let applyMotionHealth nudge it mid-flight
      playGameSfx("crunch", 0.7);
      playGameSfx(Math.random() < 0.5 ? "stroidthrow1" : "stroidthrow2", 0.6);
    } else {
      entity.tossed = true;
      entity.tossedAt = now;
      entity.tossHealth = 3;
      sim.tossedAsteroid = entity;
      playGameSfx(Math.random() < 0.5 ? "stroidthrow1" : "stroidthrow2", 0.85);
    }
    resetStroidToss();
    return true;
  }

  function pushStroidChargeSpark(asteroid) {
    if (!asteroid) return;
    if (isIOSNative && sim.particles.length >= MAX_EXPLOSION_PARTICLES) return;
    if (sim.particles.length >= MAX_EXPLOSION_PARTICLES) return;
    const angle = Math.random() * Math.PI * 2;
    const speed = 150 + Math.random() * 180;
    const p = getParticle();
    p.x = asteroid.x + Math.cos(angle) * asteroid.r;
    p.y = asteroid.y + Math.sin(angle) * asteroid.r;
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed;
    p.life = 0;
    p.ttl = 120 + Math.random() * 90;
    p.size = 0.9 + Math.random() * 1.3;
    p.alpha = 0.9;
    p.color = "rgba(255,255,255,";
    p.flicker = true;
    sim.particles.push(p);
  }

  function emitStroidChargeSparks(now) {
    const asteroid = getStroidTossAsteroid();
    if (!asteroid || !stroidToss.grabbed || now - stroidToss.lastSparkAt < 70) return;
    stroidToss.lastSparkAt = now;
    const count = 6 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i += 1) {
      pushStroidChargeSpark(asteroid);
    }
  }

  function getAsteroidSpriteGlowColor(spriteKey, alpha = 0.82) {
    const a = clamp(alpha, 0, 1).toFixed(3);
    if (spriteKey === "roid02") return `rgba(120,80,255,${a})`;
    if (spriteKey === "roid03") return `rgba(255,190,0,${a})`;
    if (spriteKey === "hotroid01") return `rgba(255,70,20,${a})`;
    return `rgba(0,255,209,${a})`;
  }

  function removeAsteroidRef(asteroid) {
    const index = sim.asteroids.indexOf(asteroid);
    if (index < 0) return false;
    const removed = removeAsteroidAt(index);
    if (removed) releaseAsteroid(removed);
    return true;
  }

  function getStroidTossImpactCost(asteroid) {
    if (!asteroid) return 1;
    if (asteroid.kind <= 1) return 0.5;
    if (asteroid.kind === 2) return 1;
    return 1.5;
  }

  function destroyTossImpactTarget(target) {
    if (!target) return false;
    const kind = target.kind || 1;
    const bigBlast = kind === 3;
    const mediumBlast = kind === 2;
    const x = target.x;
    const y = target.y;
    const spriteKey = target.spriteKey;
    if (!removeAsteroidRef(target)) return false;
    spawnExplosion(x, y, bigBlast ? 32 : 16, false, bigBlast ? 1.8 : 1.15, mediumBlast ? 1.18 : 1, kind, spriteKey);
    addFrozenShatterFx(x, y); // small (kind-1) frozen toss targets shatter too (no-op unless frozen)
    triggerAsteroidSizeFeedback(kind);
    playAsteroidExplosionBoom(kind, boomStackVolume(bigBlast ? 0.9 : mediumBlast ? 0.9 : 0.76), 0.92 + Math.random() * 0.14);
    addArcadeScore(arcadeMultiplierPoints(kind >= 2 ? 25 : 10));
    trackKillStreak();
    return true;
  }

  // 2026-06-11: a tossed stroid that flies the full STROID_TOSS_TIMEOUT_MS without connecting
  // burns out and self-destructs — crackle + mine-final-explosion layered (both `important`
  // so the native per-frame audio budget doesn't drop one).
  function selfDestructTossedAsteroid(tossed) {
    if (!tossed) return;
    const x = tossed.x;
    const y = tossed.y;
    const kind = tossed.kind || 3;
    const spriteKey = tossed.spriteKey;
    spawnExplosion(x, y, 46, true, 2.4, 1, kind, spriteKey);
    addFrozenShatterFx(x, y); // ice burst if it fizzles out mid-freeze (no-op otherwise)
    addWarpRing(x, y, "rgba(255,160,60,1)");
    cssShake(1.0);
    cssFlash("#ffaa44", 0.25, 220);
    triggerGameplayHapticImpact(hapticImpactStyle.Heavy);
    playGameSfx("particle_crackle1", 0.9, { important: true });
    playGameSfx("landmine_boom", 1.0, { important: true }); // minefinalexplo.mp3
    removeAsteroidRef(tossed);
    if (sim.tossedAsteroid === tossed) sim.tossedAsteroid = null;
  }

  function detonateTossedAsteroid(tossed) {
    if (!tossed) return;
    const x = tossed.x;
    const y = tossed.y;
    const kind = tossed.kind || 3;
    const spriteKey = tossed.spriteKey;
    spawnExplosion(x, y, 50, true, 3.0, 1, kind, spriteKey);
    addFrozenShatterFx(x, y); // a frozen tossed stroid bursts with the ice shatter (no-op unless frozen)
    cssShake(1.0);
    flashScreen("#ff2a1f", 320, 0.7);
    triggerGameplayHapticImpact(hapticImpactStyle.Heavy);
    playAsteroidExplosionBoom(3, 1.0, 0.88 + Math.random() * 0.12);
    playGameSfx("distantexplode", 1.8);
    removeAsteroidRef(tossed);
    // only clear the tracked slot if it was THIS stroid — multiple tosses can be airborne
    if (sim.tossedAsteroid === tossed) sim.tossedAsteroid = null;
  }

  function handleTossedAsteroidImpact(tossed, target) {
    if (!tossed || !target || tossed === target) return;
    const impactCost = getStroidTossImpactCost(target);
    if (!Number.isFinite(tossed.tossHealth)) tossed.tossHealth = 3;
    // 2026-06-10: big/medium targets split into children like a normal blast (kind 3 → kind 2s,
    // kind 2 → kind 1s) instead of being fully destroyed; only small (kind 1) targets vaporize.
    if ((target.kind || 1) >= 2) {
      const idx = sim.asteroids.indexOf(target);
      if (idx < 0) return;
      splitAsteroidByIndex(idx);
      // splitAsteroidByIndex counts an aimed-shot hit; a toss impact isn't one — keep accuracy honest
      if (engineMode === "arcade") shotsHit = Math.max(0, shotsHit - 1);
    } else if (!destroyTossImpactTarget(target)) {
      return;
    }
    tossed.tossHealth -= impactCost;
    addArcadeScore(150);
    // 2026-06-09: every thrown-stroid impact rumbles like a big hit, regardless of what it hit
    cssShake(1.1);
    triggerGameplayHapticImpact(tossed.tossHealth <= 0 ? hapticImpactStyle.Heavy : hapticImpactStyle.Medium);
    if (tossed.tossHealth <= 0) {
      detonateTossedAsteroid(tossed);
      return;
    }
    const _now = performance.now();
    if (_now - lastHypeVoAt > 15000) {
      lastHypeVoAt = _now;
      commBoxController.queueVO({
        audioSrc: commBoxController.commVoSrc(
          commBoxController.pickFromPool("hype", commBoxController.POOL_HYPE),
        ),
        event: "smirk",
      });
    }
  }

  function updateTossedAsteroidCollision(now) {
    // 2026-06-11: handle EVERY in-flight tossed asteroid, not just sim.tossedAsteroid. The old
    // single-slot tracking orphaned the first throw when a second was launched — orphans keep
    // tossed=true (so resolveAsteroidCollisions skips them) yet were no longer collision-checked,
    // so they flew through and overlapped other stroids. Snapshot first because an impact can
    // detonate (splice) the tossed stroid mid-iteration.
    const tossedList = [];
    for (let i = 0; i < sim.asteroids.length; i += 1) {
      if (sim.asteroids[i].tossed) tossedList.push(sim.asteroids[i]);
    }
    for (let ti = 0; ti < tossedList.length; ti += 1) {
      const tossed = tossedList[ti];
      if (!sim.asteroids.includes(tossed)) continue; // removed by an earlier detonation this frame
      const tossAge = now - tossed.tossedAt;
      // 2026-06-12: a tossed stroid that never connects self-destructs at the timeout — it does
      // NOT revert to a normal drifter and no longer dwindles; it just flies fast and blows up.
      if (tossAge > STROID_TOSS_TIMEOUT_MS) {
        selfDestructTossedAsteroid(tossed);
        continue;
      }
      for (let i = 0; i < sim.asteroids.length; i += 1) {
        const other = sim.asteroids[i];
        if (!other || other === tossed) continue;
        // 2026-06-10: 250ms spawn grace — split children appear at the impact point and would
        // otherwise be re-hit on the next frame, chain-splitting everything instantly.
        if (other.spawnedAtMs && now - other.spawnedAtMs < 250) continue;
        const dist = Math.hypot(other.x - tossed.x, other.y - tossed.y);
        if (dist > tossed.r + other.r) continue;
        if (other.tossed) {
          // 2026-06-11: two airborne tosses meeting head-on both detonate. Require a short
          // airborne grace on BOTH so stroids launched from overlapping spots don't blow up
          // the instant they're released.
          if (now - tossed.tossedAt < 150 || now - other.tossedAt < 150) continue;
          detonateTossedAsteroid(tossed);
          detonateTossedAsteroid(other);
        } else {
          handleTossedAsteroidImpact(tossed, other);
        }
        break; // this tossed stroid resolves one impact per frame
      }
    }
  }

  function findAsteroidAt(x, y, hit = 26) {
    let best = -1;
    let bestDist = Infinity;
    for (let i = 0; i < sim.asteroids.length; i += 1) {
      const a = sim.asteroids[i];
      const d = Math.hypot(a.x - x, a.y - y);
      if (d <= (a.r + hit) && d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    return best;
  }

  function updatePracticeDebug() {
    if (!practiceDebugEl) return;
    practiceDebugEl.textContent = `${engineMode} • ${state.practiceTool} • asteroids ${sim.asteroids.length}/${PRACTICE_MAX_ASTEROIDS} • ${practiceLastInput}`;
    practiceDebugEl.classList.toggle("hidden", engineMode !== "practice");
  }

  function debugPing(x, y) {
    debugDots.push({ x, y, t: performance.now() });
    if (debugDots.length > 12) debugDots.shift();
    updatePracticeDebug();
  }

  function setPracticeToolUI() {
    const pencilActive = state.practiceTool === "pencil";
    toolDraw.classList.toggle("active", pencilActive);
    toolBoom.classList.toggle("active", !pencilActive);
    updatePracticeDebug();
  }

  function isPointOnMine(mine, x, y) {
    if (!mine) return false;
    const d = Math.hypot(mine.x - x, mine.y - y);
    return d <= mine.r + 10;
  }

  function isPointOnLandmine(x, y) {
    return isPointOnMine(landmine, x, y);
  }

  function stopDangerLoop() {
    if (!_dangerLoopAudio) return;
    _dangerLoopAudio.loop = false;
    _dangerLoopAudio.pause();
    _dangerLoopAudio.currentTime = 0;
    _dangerLoopAudio = null;
  }

  function startDangerLoop() {
    if (_dangerLoopAudio) return;
    _dangerLoopAudio = new Audio(commBoxController.commVoSrc("danger_loop.mp3"));
    _dangerLoopAudio.loop = true;
    _dangerLoopAudio.volume = 0.4;
    _dangerLoopAudio.play().catch(() => {});
  }

  function landminePhaseDuration(phase) {
    if (phase === "spawned") return 10000;
    if (phase === "armed") return 8000;
    if (phase === "player_armed") return 6000;
    return 0;
  }

  function getLandmineRemainingMs(now = performance.now()) {
    if (!landmine) return 0;
    if (landmine.phase === "spawned") {
      return Math.max(0, landminePhaseDuration("spawned") - (now - landmine.spawnedAt));
    }
    if (landmine.phase === "armed") {
      return Math.max(0, landminePhaseDuration("armed") - (now - landmine.armedAt));
    }
    if (landmine.phase === "player_armed") {
      return Math.max(0, landminePhaseDuration("player_armed") - (now - landmine.playerArmedAt));
    }
    return 0;
  }

  function restoreLandmineTimer(remainingMs, now = performance.now()) {
    if (!landmine) return;
    if (landmine.phase === "spawned") {
      landmine.spawnedAt = now - Math.max(0, landminePhaseDuration("spawned") - remainingMs);
    } else if (landmine.phase === "armed") {
      landmine.armedAt = now - Math.max(0, landminePhaseDuration("armed") - remainingMs);
    } else if (landmine.phase === "player_armed") {
      landmine.playerArmedAt = now - Math.max(0, landminePhaseDuration("player_armed") - remainingMs);
    }
  }

  function resetKillStreak() {
    _streakCount = 0;
    clearTimeout(_streakTimer);
    _streakTimer = null;
  }

  function resetPraiseState() {
    resetKillStreak();
    _praiseCount = 0;
    _lastPraiseAt = 0;
    lastNiceShotVoAt = 0;
    lastHypeVoAt = 0;
    lastPlasmaRechargedVoAt = 0;
    lastKillStreakVoAt = 0;
  }

  function trackKillStreak() {
    _streakCount++;
    clearTimeout(_streakTimer);
    _streakTimer = setTimeout(() => {
      _streakCount = 0;
    }, 3000);

    const now2 = performance.now();
    if (_streakCount >= 4 && now2 - _lastPraiseAt > 6000) {
      // 2026-06-10: level 1 stays quieter — skip every other praise trigger (~50% less chatter)
      const _curLevel = engineMode === "arcade" ? (ARCADE_LEVELS[currentLevelIndex]?.level || 1) : 1;
      if (_curLevel === 1) {
        _level1ChatterToggle = !_level1ChatterToggle;
        if (!_level1ChatterToggle) {
          _streakCount = 0;
          return;
        }
      }
      _lastPraiseAt = now2;
      _praiseCount++;

      if (_praiseCount % 3 === 0) {
        if (now2 - lastKillStreakVoAt > 15000) {
          lastKillStreakVoAt = now2;
          setTimeout(() => {
            commBoxController.queueVO({
              audioSrc: commBoxController.commVoSrc(
                commBoxController.pickFromPool("cocky", commBoxController.POOL_COCKY),
              ),
              event: "angry",
            });
          }, 1200);
        }
      } else {
        if (now2 - lastNiceShotVoAt > 12000) {
          lastNiceShotVoAt = now2;
          commBoxController.queueVO({
            audioSrc: commBoxController.commVoSrc(
              commBoxController.pickFromPool("niceshot", commBoxController.POOL_NICE_SHOT),
            ),
            event: "smirk",
          });
        }
      }
      _streakCount = 0;
    }
  }

  function removeAsteroidAt(index) {
    const a = sim.asteroids[index];
    if (!a) return null;
    const last = sim.asteroids.length - 1;
    sim.asteroids[index] = sim.asteroids[last];
    sim.asteroids.pop();
    return a;
  }

  function triggerAsteroidSizeFeedback(kind) {
    if (kind === 3) {
      cssShake(1.2);
      cssFlash("#ff6600", 0.22, 160);
      triggerGameplayHapticImpact(hapticImpactStyle.Heavy);
      setTimeout(() => triggerGameplayHapticImpact(hapticImpactStyle.Medium), 80);
    } else if (kind === 2) {
      cssShake(0.9); // 2026-06-09: bumped so every destruction has a visible rumble
      cssFlash("#ffaa44", 0.12, 100);
      triggerGameplayHapticImpact(hapticImpactStyle.Medium);
    } else if (kind === 1) {
      cssShake(0.6); // 2026-06-09: was 0.2 (≈0.8px, invisible); now a noticeable pop
      cssFlash("#ffffff", 0.05, 60);
      triggerGameplayHapticImpact(hapticImpactStyle.Light);
    }
  }

  function splitAsteroidByIndex(targetIndex) {
    const a = removeAsteroidAt(targetIndex);
    if (!a) return;
    if (engineMode === "arcade") shotsHit += 1;

    const wasKind = a.kind;
    const baseX = a.x;
    const baseY = a.y;
    const parentSpeed = Math.sqrt(a.vx * a.vx + a.vy * a.vy);
    addArcadeScore(arcadeMultiplierPoints(wasKind >= 2 ? 25 : 10));
    releaseAsteroid(a);
    trackKillStreak();

    if (wasKind > 1) {
      const childCount = wasKind === 3 ? (3 + Math.floor(Math.random() * 3)) : (2 + Math.floor(Math.random() * 2));
      const spawnSplitChild = () => {
        if (sim.asteroids.length >= sim.maxAsteroids) return false;
        const child = spawnAsteroid(baseX, baseY, wasKind - 1, false);
        if (!child) return false;
        const boost = 1.5 + Math.random() * 0.7;
        child.vx += (child.vx / Math.max(1, Math.abs(child.vx))) * parentSpeed * 0.2 * boost;
        child.vy += (child.vy / Math.max(1, Math.abs(child.vy))) * parentSpeed * 0.2 * boost;
        return true;
      };
      for (let i = 0; i < childCount; i += 1) {
        if (!spawnSplitChild()) break;
      }
    }

    const levelNum = ARCADE_LEVELS[currentLevelIndex]?.level || 1;
    const isLevel10 = levelNum === 10;
    const bigBlast = wasKind === 3;
    const mediumBlast = wasKind === 2;
    const ttlScale = bigBlast ? 1.4 : mediumBlast ? 1.18 : 1;
    spawnExplosion(baseX, baseY, bigBlast ? 32 : 16, false, bigBlast ? 1.8 : 1.15, ttlScale, wasKind, a.spriteKey);
    addFrozenShatterFx(baseX, baseY);
    triggerAsteroidSizeFeedback(wasKind);
    const baseBoomVol = wasKind === 3 ? 0.9 : wasKind === 2 ? 0.92 : 0.78;
    const minBoomRatio = wasKind === 3 ? 0.62 : wasKind === 2 ? 0.8 : 0.9;
    playAsteroidExplosionBoom(
      wasKind,
      boomStackVolume(baseBoomVol, { minRatio: minBoomRatio }),
      0.92 + Math.random() * 0.16,
    );
    if (wasKind === 1) {
      cssFlash(_levelPrimaryColor, 0.09, 55);
      // FIXED 2026-06-09: route through HTML Audio on iOS WebKit — WebAudio buffers can fail silently
      playGameSfx("smallblast", 1.0, { forceHtmlOnIOS: true });
      setTimeout(() => { playGameSfx("crack", 1.0, { forceHtmlOnIOS: true }); playParticleCrackle(); }, 50);
    } else {
      if (wasKind === 2) playGameSfx("crush", 1.08);
      playParticleCrackle();
    }
    suppressAstCollisionSfxUntil = performance.now() + 180;
    if (isLevel10) {
      triggerLevel10AsteroidFlash(bigBlast);
      if (bigBlast) {
        addLightningRing(baseX, baseY, {
          radius: 60,
          ttl: 520,
          arcCount: isIOSWebKit ? 10 : 16,
          jitter: 11,
          colorA: "rgba(255,110,30,0.95)",
          colorB: "rgba(255,38,20,0.72)",
          glow: "rgba(255,138,50,0.86)",
        });
      }
    }
    if (bigBlast) {
      triggerAsteroidImpactFlash(1);
    } else if (mediumBlast) {
      triggerAsteroidImpactFlash(0.5);
      setTimeout(() => {
        triggerAsteroidImpactFlash(0.4);
      }, 90);
    } else {
      triggerAsteroidImpactFlash(0.2);
    }
  }

  function vaporizeAsteroidByIndex(targetIndex, suppressBoom = false) {
    const a = removeAsteroidAt(targetIndex);
    if (!a) return;
    const levelNum = ARCADE_LEVELS[currentLevelIndex]?.level || 1;
    const isLevel10 = levelNum === 10;
    const bigBlast = a.kind === 3;
    const mediumBlast = a.kind === 2;
    addArcadeScore(arcadeMultiplierPoints(a.kind >= 2 ? 25 : 10));
    trackKillStreak();
    spawnExplosion(a.x, a.y, bigBlast ? 24 : 14, false, bigBlast ? 1.6 : 1.1, 1, a.kind, a.spriteKey);
    addFrozenShatterFx(a.x, a.y);
    triggerAsteroidSizeFeedback(a.kind);
    // 2026-06-09: plasma net suppresses per-asteroid booms so the single basicb_explo blast
    // isn't drowned out / dropped by the native frame-budget behind a wall of explosion sounds.
    if (!suppressBoom) {
      const baseBoomVol = bigBlast ? 0.9 : mediumBlast ? 0.9 : 0.76;
      const minBoomRatio = bigBlast ? 0.62 : mediumBlast ? 0.82 : 0.9;
      playAsteroidExplosionBoom(
        a.kind,
        boomStackVolume(baseBoomVol, { minRatio: minBoomRatio }),
        0.92 + Math.random() * 0.14,
      );
    }
    if (isLevel10) {
      triggerLevel10AsteroidFlash(bigBlast);
      if (bigBlast) {
        addLightningRing(a.x, a.y, {
          radius: 56,
          ttl: 500,
          arcCount: isIOSWebKit ? 10 : 16,
          jitter: 10,
          colorA: "rgba(255,110,30,0.95)",
          colorB: "rgba(255,38,20,0.72)",
          glow: "rgba(255,138,50,0.86)",
        });
      }
    }
    releaseAsteroid(a);
  }

  function getPlasmaRect(source = plasmaCage) {
    const x = Math.min(source.startX, source.currentX);
    const y = Math.min(source.startY, source.currentY);
    const w = Math.abs(source.currentX - source.startX);
    const h = Math.abs(source.currentY - source.startY);
    return { x, y, w, h };
  }

  function resetPlasmaCageGesture() {
    plasmaCage.active = false;
    plasmaCage.startX = 0;
    plasmaCage.startY = 0;
    plasmaCage.currentX = 0;
    plasmaCage.currentY = 0;
    plasmaCage.chargeStart = 0;
    plasmaCage.charged = false;
    plasmaCage.lastPulseAt = 0;
    plasmaCage.chargeLoopRate = 0;
    plasmaCage.readySoundPlayed = false;
    plasmaCage.highlightBlipPlayed = false;
    plasmaCage.rechargeSoundPlayed = false;
  }

  function isPlasmaCageReady(now = performance.now()) {
    if (plasmaCage.active) {
      const ready = plasmaCage.charged || now - plasmaCage.chargeStart >= PLASMA_CAGE_CHARGE_MS;
      if (!plasmaCage.highlightBlipPlayed && ready) {
        plasmaCage.highlightBlipPlayed = true;
        playPlasmaLockSound();
      }
      return ready;
    }
    return now >= plasmaCage.cooldownUntil;
  }

  function beginPlasmaCage(start, current, now) {
    if (!isPlasmaCageReady(now)) return false;
    plasmaCage.active = true;
    plasmaCage.startX = start.x;
    plasmaCage.startY = start.y;
    plasmaCage.currentX = current.x;
    plasmaCage.currentY = current.y;
    plasmaCage.chargeStart = now;
    plasmaCage.charged = false;
    plasmaCage.readySoundPlayed = false;
    plasmaCage.highlightBlipPlayed = false;
    plasmaCage.lastPulseAt = now;
    updatePlasmaChargeSound(now);
    return true;
  }

  function updatePlasmaCageCharge(now) {
    if (!plasmaCage.active || plasmaCage.charged) return;
    if (now - plasmaCage.chargeStart >= PLASMA_CAGE_CHARGE_MS) {
      plasmaCage.charged = true;
      if (!plasmaCage.readySoundPlayed) {
        plasmaCage.readySoundPlayed = true;
        const readyKey = resolveGameSfxKey("plasma_ready", "reveal4");
        if (readyKey) playGameSfx(readyKey, 1.0);
        commBoxController.reactTo("plasmacharged");
      }
      return;
    }
    if (now - plasmaCage.lastPulseAt >= 250) {
      plasmaCage.lastPulseAt = now;
      triggerGameplayHapticImpact(hapticImpactStyle.Light);
    }
  }

  function stopPlasmaChargeSound() {
    if (plasmaCage.chargeLoopHandle) {
      plasmaCage.chargeLoopHandle.stop();
      plasmaCage.chargeLoopHandle = null;
    }
    audioEngine.stopLoop("plasma_charge");
    plasmaCage.chargeLoopRate = 0;
  }

  function updatePlasmaChargeSound(now) {
    if (!plasmaCage.active) return;
    const progress = clamp((now - plasmaCage.chargeStart) / PLASMA_CAGE_CHARGE_MS, 0, 1);
    const steppedRate = Math.round((0.8 + progress * 0.6) * 10) / 10;
    if (plasmaCage.chargeLoopHandle && plasmaCage.chargeLoopRate === steppedRate) return;
    stopPlasmaChargeSound();
    plasmaCage.chargeLoopRate = steppedRate;
    plasmaCage.chargeLoopHandle = audioEngine.playLoop("plasma_charge", {
      volume: state.whisper ? 0.22 : 0.55,
      rate: steppedRate,
    });
  }

  function updatePlasmaRechargeSound(now) {
    if (plasmaCage.active) return;
    if (plasmaCage.cooldownUntil <= 0) return;
    if (now < plasmaCage.cooldownUntil) return;
    if (plasmaCage.rechargeSoundPlayed) return;
    if (now - plasmaCage.lastRechargeVoAt < 2000) return;
    if (retryPending || !arcadeActive) return;
    plasmaCage.rechargeSoundPlayed = true;
    plasmaCage.lastRechargeVoAt = now;
    playGameSfx(Math.random() < 0.5 ? "plasmarecharged" : "plasmarecharged1", 1.0);
    playGameSfx("blip", 0.6);
    commBoxController.reactTo("plasma_recharged");
    if (now - lastPlasmaRechargedVoAt > 20000) {
      lastPlasmaRechargedVoAt = now;
      function fireRechargeComm() {
        // FIXED 2026-06-08: bail if UFO kill reset cooldownUntil to 0 after this was scheduled
        if (plasmaCage.cooldownUntil <= 0) return;
        // FIX 2026-06-09: bail if the cage is mid-gesture or was re-depleted by a new
        // plasma net blast after this callback was scheduled — avoids a false "recharged" VO.
        if (plasmaCage.active || performance.now() < plasmaCage.cooldownUntil) return;
        const ticker = document.getElementById("commanderTicker");
        const isActive = ticker?.classList.contains("ticker-visible");
        if (isActive) {
          setTimeout(fireRechargeComm, 800);
          return;
        }
        commBoxController.queueVO({
          audioSrc: commBoxController.commVoSrc(
            commBoxController.pickFromPool("plasmarecharged", commBoxController.POOL_PLASMA_RECHARGED),
          ),
          duration: 2500,
          event: "plasma_recharged",
        });
      }
      setTimeout(fireRechargeComm, 400);
    }
  }

  function destroyAsteroidsInPlasmaCage(rect) {
    const toDestroy = [];
    const plasmaKillPositions = [];
    for (let i = 0; i < sim.asteroids.length; i += 1) {
      const a = sim.asteroids[i];
      if (a.x >= rect.x && a.x <= rect.x + rect.w && a.y >= rect.y && a.y <= rect.y + rect.h) {
        toDestroy.push(i);
        plasmaKillPositions.push({ x: a.x, y: a.y, r: a.r, kind: a.kind });
      }
    }
    for (let i = toDestroy.length - 1; i >= 0; i -= 1) {
      vaporizeAsteroidByIndex(toDestroy[i], true); // suppressBoom: plasma uses one basicb_explo blast
    }
    plasmaKillPositions.forEach((pos) => {
      for (let p = 0; p < 12; p += 1) {
        if (sim.particles.length >= MAX_EXPLOSION_PARTICLES) break;
        const angle = Math.random() * Math.PI * 2;
        const speed = 80 + Math.random() * 180;
        const particle = getParticle();
        particle.x = pos.x;
        particle.y = pos.y;
        particle.vx = Math.cos(angle) * speed;
        particle.vy = Math.sin(angle) * speed;
        particle.life = 0;
        particle.ttl = 400 + Math.random() * 400;
        particle.size = 2 + Math.random() * (pos.r * 0.4);
        particle.alpha = 0.9 + Math.random() * 0.1;
        particle.color = Math.random() < 0.6 ? "rgba(0,255,209," : "rgba(150,255,235,";
        particle.startedAt = performance.now();
        sim.particles.push(particle);
      }
    });
    return toDestroy.length;
  }

  function releasePlasmaCage(now) {
    if (!plasmaCage.active) return false;
    updatePlasmaCageCharge(now);
    const rect = getPlasmaRect();
    const charged = plasmaCage.charged;
    plasmaCage.lastRectCx = rect.x + rect.w / 2;
    plasmaCage.lastRectCy = rect.y + rect.h / 2;
    stopPlasmaChargeSound();
    resetPlasmaCageGesture();
    if (charged) {
      const destroyedCount = destroyAsteroidsInPlasmaCage(rect);
      window.pixiRenderer?.triggerPlasmaRectFlash?.();
      const fireKey = destroyedCount > 0 ? resolveGameSfxKey("plasma_fire", "ufo_destroy") : "";
      // FIXED 2026-06-09: forceHtmlOnIOS covers iOS Safari; `important` bypasses the native
      // frame-budget so the blast isn't dropped behind the asteroid booms on the native app.
      // The blast only fires when asteroids were actually caught (otherwise a charged release
      // over empty space stays silent).
      if (destroyedCount > 0) {
        if (fireKey) playGameSfx(fireKey, 0.92, { forceHtmlOnIOS: true, important: true });
        playGameSfx("basicb_explo", 1.62, { forceHtmlOnIOS: true, important: true });
      }
      // 2026-06-09: any plasma kill rumbles; bigger nets shake harder
      if (destroyedCount >= 1) cssShake(Math.min(1.3, 0.7 + destroyedCount * 0.12));
      if (destroyedCount >= 3) {
        cssFlash("#00ffd1", Math.min(0.35, 0.1 + destroyedCount * 0.04), 200);
      }
      if (destroyedCount >= 2) {
        cssStatic(450);
      }
      triggerGameplayHapticImpact(hapticImpactStyle.Heavy);
      plasmaCage.cooldownStart = now;
      plasmaCage.cooldownUntil = now + PLASMA_CAGE_COOLDOWN_MS;
      plasmaCage.rechargeSoundPlayed = false;
      plasmaCage.releaseFx = { ...rect, type: "fire", start: now, ttl: 220 };
    } else {
      plasmaCage.releaseFx = { ...rect, type: "fizzle", start: now, ttl: 200 };
    }
    return true;
  }

  function resizePlasmaOverlayCanvas() {
    if (!plasmaCtx) return;
    plasmaOverlayCanvas.style.left = galaxyPlayCanvas.style.left;
    plasmaOverlayCanvas.style.top = galaxyPlayCanvas.style.top;
    plasmaOverlayCanvas.style.width = galaxyPlayCanvas.style.width;
    plasmaOverlayCanvas.style.height = galaxyPlayCanvas.style.height;
    plasmaOverlayCanvas.width = galaxyPlayCanvas.width;
    plasmaOverlayCanvas.height = galaxyPlayCanvas.height;
    plasmaCtx.setTransform(sim.dpr, 0, 0, sim.dpr, 0, 0);
  }

  function resizeTimerPerimeterCanvas() {
    if (!timerPerimeterCtx) return;
    timerPerimeterCanvas.style.left = galaxyPlayCanvas.style.left;
    timerPerimeterCanvas.style.top = galaxyPlayCanvas.style.top;
    timerPerimeterCanvas.style.width = galaxyPlayCanvas.style.width;
    timerPerimeterCanvas.style.height = galaxyPlayCanvas.style.height;
    timerPerimeterCanvas.width = galaxyPlayCanvas.width;
    timerPerimeterCanvas.height = galaxyPlayCanvas.height;
    timerPerimeterCtx.setTransform(sim.dpr, 0, 0, sim.dpr, 0, 0);
    positionHudTimerOnCanvas();
  }

  function resizeUfoFxCanvas() {
    if (!ufoFxCtx) return;
    ufoFxCanvas.style.left = galaxyPlayCanvas.style.left;
    ufoFxCanvas.style.top = galaxyPlayCanvas.style.top;
    ufoFxCanvas.style.width = galaxyPlayCanvas.style.width;
    ufoFxCanvas.style.height = galaxyPlayCanvas.style.height;
    ufoFxCanvas.width = galaxyPlayCanvas.width;
    ufoFxCanvas.height = galaxyPlayCanvas.height;
    ufoFxCtx.setTransform(sim.dpr, 0, 0, sim.dpr, 0, 0);
  }

  function setPlasmaOverlayVisible(visible) {
    plasmaOverlayCanvas.style.display = visible ? "" : "none";
  }

  function setTimerPerimeterVisible(visible) {
    timerPerimeterCanvas.style.display = visible ? "" : "none";
  }

  function strokeTimerPerimeterPath(ctxToDraw, progress, x, y, w, h) {
    const safeProgress = clamp(progress, 0, 1);
    const perimeter = Math.max(1, 2 * (w + h));
    let remaining = perimeter * safeProgress;
    let cx = x;
    let cy = y;
    const drawSegment = (nextX, nextY, len) => {
      if (remaining <= 0) return;
      const use = Math.min(remaining, len);
      const t = len > 0 ? use / len : 0;
      const px = cx + (nextX - cx) * t;
      const py = cy + (nextY - cy) * t;
      ctxToDraw.lineTo(px, py);
      cx = nextX;
      cy = nextY;
      remaining -= use;
    };

    ctxToDraw.beginPath();
    ctxToDraw.moveTo(x, y);
    drawSegment(x + w, y, w);
    drawSegment(x + w, y + h, h);
    drawSegment(x, y + h, w);
    drawSegment(x, y, h);
  }

  function drawTimerPerimeterOverlay(now) {
    if (!timerPerimeterCtx) return;
    timerPerimeterCtx.clearRect(0, 0, sim.width, sim.height);
    const showTimer = engineMode === "arcade" && arcadeActive && levelDurationMs > 0;
    setTimerPerimeterVisible(showTimer);
    if (!showTimer) return;

    const remaining = Math.max(0, _timerRemainingMs || Math.max(0, levelEndsAt - now));
    const progress = levelDurationMs > 0 ? clamp(remaining / levelDurationMs, 0, 1) : _timerRatio;
    const inset = 2.5;
    const x = inset;
    const y = inset;
    const w = Math.max(0, sim.width - inset * 2);
    const h = Math.max(0, sim.height - inset * 2);
    if (w <= 0 || h <= 0) return;

    timerPerimeterCtx.save();
    timerPerimeterCtx.lineWidth = 3;
    timerPerimeterCtx.lineJoin = "round";
    timerPerimeterCtx.lineCap = "round";
    timerPerimeterCtx.strokeStyle = "rgba(180,190,205,0.1)";
    timerPerimeterCtx.strokeRect(x, y, w, h);

    let color = remaining <= 5000 ? "#ff4444" : remaining <= 10000 ? "#ffaa00" : _levelPrimaryColor;
    // 2026-06-10: freeze strobe — alternate white at ~3Hz while frozen, theme color returns
    // automatically when freezeUntil lapses.
    if (now < freezeUntil && Math.floor(now / 167) % 2 === 0) color = "#ffffff";
    timerPerimeterCtx.strokeStyle = color;
    if (!isIOSNative) {
      timerPerimeterCtx.shadowColor = color;
      timerPerimeterCtx.shadowBlur = 6;
    }
    strokeTimerPerimeterPath(timerPerimeterCtx, progress, x, y, w, h);
    timerPerimeterCtx.stroke();
    timerPerimeterCtx.restore();
  }

  function drawUfoFxOverlay(fallbackCtx) {
    if (ufoFxCtx) {
      ufoFxCtx.clearRect(0, 0, sim.width, sim.height);
      effects.draw(ufoFxCtx);
    } else {
      effects.draw(fallbackCtx);
    }
  }

  function drawPlasmaGrid(rect, alpha) {
    if (!plasmaCtx || rect.w < 2 || rect.h < 2) return;
    plasmaCtx.save();
    plasmaCtx.beginPath();
    plasmaCtx.rect(rect.x, rect.y, rect.w, rect.h);
    plasmaCtx.clip();
    plasmaCtx.globalAlpha = alpha;
    plasmaCtx.strokeStyle = "#00FFD1";
    plasmaCtx.lineWidth = 1;
    const spacing = 18;
    const startX = rect.x - ((rect.x % spacing) + spacing);
    const startY = rect.y - ((rect.y % spacing) + spacing);
    for (let x = startX; x <= rect.x + rect.w + spacing; x += spacing) {
      plasmaCtx.beginPath();
      plasmaCtx.moveTo(x, rect.y);
      plasmaCtx.lineTo(x, rect.y + rect.h);
      plasmaCtx.stroke();
    }
    for (let y = startY; y <= rect.y + rect.h + spacing; y += spacing) {
      plasmaCtx.beginPath();
      plasmaCtx.moveTo(rect.x, y);
      plasmaCtx.lineTo(rect.x + rect.w, y);
      plasmaCtx.stroke();
    }
    plasmaCtx.restore();
  }

  function drawPlasmaCageRect(rect, now, progress, charged, alpha = 1, scale = 1) {
    if (!plasmaCtx || rect.w < 2 || rect.h < 2) return;
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    const w = rect.w * scale;
    const h = rect.h * scale;
    const x = cx - w / 2;
    const y = cy - h / 2;
    const corner = Math.max(12, Math.min(34, Math.min(w, h) * 0.28));
    const glow = charged ? 18 : 5 + progress * 12;
    const borderAlpha = alpha * (0.18 + progress * 0.82);
    const color = charged ? "rgba(220,255,250,1)" : "#00FFD1";
    drawPlasmaGrid({ x, y, w, h }, (charged ? 0.18 : 0.08 + progress * 0.25) * alpha);
    plasmaCtx.save();
    plasmaCtx.globalAlpha = borderAlpha;
    if (!isIOSNative) {
      plasmaCtx.shadowColor = "#00FFD1";
      plasmaCtx.shadowBlur = glow;
    }
    plasmaCtx.strokeStyle = color;
    plasmaCtx.lineWidth = charged ? 2.4 : 1.4 + progress * 1.2;
    plasmaCtx.setLineDash([10, 8]);
    plasmaCtx.lineDashOffset = -(now / 32) % 18;
    plasmaCtx.strokeRect(x, y, w, h);
    plasmaCtx.setLineDash([]);
    if (charged) {
      plasmaCtx.globalAlpha = alpha * (0.7 + 0.3 * Math.sin(now / 70));
      plasmaCtx.lineWidth = 3;
    } else {
      plasmaCtx.globalAlpha = alpha * (0.42 + progress * 0.58);
      plasmaCtx.lineWidth = 2;
    }
    const x2 = x + w;
    const y2 = y + h;
    const segments = [
      [x, y, x + corner, y], [x, y, x, y + corner],
      [x2, y, x2 - corner, y], [x2, y, x2, y + corner],
      [x, y2, x + corner, y2], [x, y2, x, y2 - corner],
      [x2, y2, x2 - corner, y2], [x2, y2, x2, y2 - corner],
    ];
    for (let i = 0; i < segments.length; i += 1) {
      const s = segments[i];
      plasmaCtx.beginPath();
      plasmaCtx.moveTo(s[0], s[1]);
      plasmaCtx.lineTo(s[2], s[3]);
      plasmaCtx.stroke();
    }
    plasmaCtx.restore();
  }

  function drawPlasmaCooldown(now) {
    if (window.pixiRenderer) return;
    if (!plasmaCtx || now >= plasmaCage.cooldownUntil) return;
    const total = Math.max(1, plasmaCage.cooldownUntil - plasmaCage.cooldownStart);
    const progress = clamp((now - plasmaCage.cooldownStart) / total, 0, 1);
    const x = sim.width - 28;
    const y = sim.height - 28;
    plasmaCtx.save();
    plasmaCtx.lineWidth = 3;
    plasmaCtx.strokeStyle = "rgba(0,255,209,0.22)";
    plasmaCtx.beginPath();
    plasmaCtx.arc(x, y, 14, 0, Math.PI * 2);
    plasmaCtx.stroke();
    plasmaCtx.strokeStyle = "rgba(0,255,209,0.9)";
    if (!isIOSNative) {
      plasmaCtx.shadowColor = "#00FFD1";
      plasmaCtx.shadowBlur = 8;
    }
    plasmaCtx.beginPath();
    plasmaCtx.arc(x, y, 14, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
    plasmaCtx.stroke();
    plasmaCtx.restore();
  }

  function drawStroidTossOverlay(now) {
    if (!plasmaCtx || !stroidToss.active) return;
    // 2026-06-11: aim reticle + throw arrow for the grabbed entity, stroid or mine
    const asteroid = getGrabbedEntity();
    if (!asteroid) return;
    const holdProgress = clamp((now - stroidToss.holdStart) / STROID_TOSS_HOLD_MS, 0, 1);
    const pulse = Math.abs(Math.sin(now / (stroidToss.grabbed ? 62 : 140)));
    const ringRadius = asteroid.r * (stroidToss.grabbed ? 1.45 + pulse * 0.16 : 0.35 + holdProgress * 1.1);
    const alpha = stroidToss.grabbed ? 0.65 + pulse * 0.28 : holdProgress * 0.8;

    plasmaCtx.save();
    plasmaCtx.globalCompositeOperation = "lighter";
    plasmaCtx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
    plasmaCtx.lineWidth = stroidToss.grabbed ? 3 : 2;
    if (!isIOSNative) {
      plasmaCtx.shadowColor = "#ffffff";
      plasmaCtx.shadowBlur = stroidToss.grabbed ? 16 : 8;
    }
    plasmaCtx.beginPath();
    plasmaCtx.arc(asteroid.x, asteroid.y, ringRadius, 0, Math.PI * 2);
    plasmaCtx.stroke();

    if (stroidToss.grabbed) {
      const dx = stroidToss.dragX - stroidToss.grabX;
      const dy = stroidToss.dragY - stroidToss.grabY;
      const len = Math.hypot(dx, dy);
      if (len > 8) {
        const nx = dx / len;
        const ny = dy / len;
        const endLen = Math.min(220, Math.max(70, len));
        const arrowX = asteroid.x + nx * endLen;
        const arrowY = asteroid.y + ny * endLen;
        const tint = getAsteroidSpriteGlowColor(asteroid.spriteKey, 0.86);
        plasmaCtx.globalAlpha = 0.9;
        plasmaCtx.setLineDash([5, 8]);
        plasmaCtx.lineDashOffset = -(now / 40) % 13;
        plasmaCtx.lineWidth = 6;
        plasmaCtx.strokeStyle = tint;
        if (!isIOSNative) {
          plasmaCtx.shadowColor = tint;
          plasmaCtx.shadowBlur = 14;
        }
        plasmaCtx.beginPath();
        plasmaCtx.moveTo(asteroid.x, asteroid.y);
        plasmaCtx.lineTo(arrowX, arrowY);
        plasmaCtx.stroke();
        plasmaCtx.lineWidth = 3;
        plasmaCtx.strokeStyle = "rgba(255,255,255,0.96)";
        if (!isIOSNative) {
          plasmaCtx.shadowColor = "#ffffff";
          plasmaCtx.shadowBlur = 12;
        }
        plasmaCtx.beginPath();
        plasmaCtx.moveTo(asteroid.x, asteroid.y);
        plasmaCtx.lineTo(arrowX, arrowY);
        plasmaCtx.stroke();
        plasmaCtx.setLineDash([]);
      }
      emitStroidChargeSparks(now);
    }
    plasmaCtx.restore();
  }

  function drawPlasmaOverlay(now) {
    if (!plasmaCtx) return;
    plasmaCtx.clearRect(0, 0, sim.width, sim.height);
    updatePlasmaCageCharge(now);
    updatePlasmaChargeSound(now);
    for (let i = laserBeams.length - 1; i >= 0; i -= 1) {
      const beam = laserBeams[i];
      const age = now - beam.startedAt;
      if (age > 150) {
        laserBeams.splice(i, 1);
        continue;
      }
      const t = clamp(age / 150, 0, 1);
      plasmaCtx.save();
      plasmaCtx.globalAlpha = 1 - t;
      plasmaCtx.strokeStyle = _levelPrimaryColor;
      plasmaCtx.lineWidth = 2;
      if (!isIOSNative) {
        plasmaCtx.shadowColor = _levelPrimaryColor;
        plasmaCtx.shadowBlur = 12;
      }
      plasmaCtx.beginPath();
      plasmaCtx.moveTo(beam.x1, beam.y1);
      plasmaCtx.lineTo(beam.x2, beam.y2);
      plasmaCtx.stroke();
      plasmaCtx.restore();
    }
    if (laserBeams.length > 8) {
      laserBeams.splice(0, laserBeams.length - 8);
    }
    if (plasmaCage.active) {
      const progress = clamp((now - plasmaCage.chargeStart) / PLASMA_CAGE_CHARGE_MS, 0, 1);
      drawPlasmaCageRect(getPlasmaRect(), now, progress, plasmaCage.charged);
    }
    if (plasmaCage.releaseFx) {
      const fx = plasmaCage.releaseFx;
      const t = clamp((now - fx.start) / fx.ttl, 0, 1);
      if (t >= 1) {
        plasmaCage.releaseFx = null;
      } else if (fx.type === "fire") {
        const flash = 1 - t;
        drawPlasmaCageRect(fx, now, 1, true, flash, 1 - t * 0.82);
        plasmaCtx.save();
        plasmaCtx.globalAlpha = flash * 0.5;
        plasmaCtx.fillStyle = "rgba(255,255,255,1)";
        plasmaCtx.fillRect(fx.x, fx.y, fx.w, fx.h);
        plasmaCtx.restore();
      } else {
        drawPlasmaCageRect(fx, now, 0.25, false, 1 - t, 1);
      }
    }
    drawPlasmaCooldown(now);
    drawStroidTossOverlay(now);
  }

  // 2026-06-10: shared tap behavior for any mine entity. explodeFn handles removal.
  function armMineEntity(mine, explodeFn) {
    if (!mine) return false;
    const now = performance.now();

    // 2026-06-09: tapping an already-armed mine (auto-armed red countdown, or player-armed)
    // detonates it immediately rather than re-arming. Only a freshly "spawned" mine arms.
    if (mine.phase === "armed" || mine.phase === "player_armed") {
      explodeFn({ halfRadius: false });
      return true;
    }

    if (mine.phase === "spawned") {
      mine.phase = "player_armed";
      mine.playerArmedAt = now;
      playGameSfx("landmine_arm", 1.0);
      playGameSfx("arm_bomb", 0.8);
      // startDangerLoop(); // 2026-06-09: danger_loop silenced
      commBoxController.queueVO({
        audioSrc: commBoxController.commVoSrc(
          commBoxController.pickFromPool("detonate", commBoxController.POOL_DETONATE),
        ),
        event: "landmine",
        priority: "high",
      });
      return true;
    }

    return false;
  }

  function armLandmine() {
    return armMineEntity(landmine, (opts) => explodeLandmine(opts));
  }

  // 2026-06-11: true if an armed mine overlaps an asteroid, the UFO, or another mine — the
  // trigger for collision detonation. Spawned (unarmed) mines never call this; they bounce.
  function armedMineHitsSomething(mine) {
    for (let i = 0; i < sim.asteroids.length; i += 1) {
      const a = sim.asteroids[i];
      if (a.spawnedAtMs && performance.now() - a.spawnedAtMs < 250) continue; // split-child grace
      if (Math.hypot(a.x - mine.x, a.y - mine.y) <= mine.r + a.r) return true;
    }
    if (ufo && ufo.alive && Math.hypot(ufo.x - mine.x, ufo.y - mine.y) <= mine.r + (ufo.r || 24)) return true;
    if (mine !== landmine && landmine && Math.hypot(landmine.x - mine.x, landmine.y - mine.y) <= mine.r + landmine.r) return true;
    for (let i = 0; i < placedBombs.length; i += 1) {
      const b = placedBombs[i];
      if (b !== mine && Math.hypot(b.x - mine.x, b.y - mine.y) <= mine.r + b.r) return true;
    }
    return false;
  }

  // 2026-06-10: per-frame physics + phase transitions for any mine entity.
  // Returns true if the mine exploded this frame. explodeFn handles removal.
  function updateMineEntity(mine, dt, now, explodeFn, { quietArm = false, frozen = false } = {}) {
    // 2026-06-10: snowflake freeze skips position physics; arm/detonate timers keep running.
    // 2026-06-11: a held (grabbed) mine is positioned by the drag — skip physics, fuse runs on.
    const held = mine._stroidHeld === true;
    const armed = mine.phase === "armed" || mine.phase === "player_armed";
    if (!frozen && !held) {
      // heavy-toss friction: decelerate a lobbed mine to rest, then hand back to normal drift
      if (mine._tossActive) {
        const sp = Math.hypot(mine.vx, mine.vy);
        const nsp = Math.max(0, sp - MINE_TOSS_DECEL * (dt / 1000));
        if (sp > 0) { mine.vx = (mine.vx / sp) * nsp; mine.vy = (mine.vy / sp) * nsp; }
        if (nsp <= MINE_TOSS_REST_SPEED) { mine._tossActive = false; mine.lastMoveAt = now; }
      }
      mine.x += mine.vx * (dt / 1000);
      mine.y += mine.vy * (dt / 1000);
      wrapEntity(mine);
      if (armed) {
        // armed mines (tossed OR drifting) detonate on contact; chains via explodeMineEntity
        if (armedMineHitsSomething(mine)) {
          explodeFn({ halfRadius: mine.phase === "armed" });
          return true;
        }
      } else {
        // spawned (unarmed): physical object — bounce off asteroids, keep drifting
        if (!mine._tossActive) {
          clampSpeed(mine);
          applyMotionHealth(mine, now);
        }
        collideMineWithAsteroids(mine);
      }
    }

    if (mine.phase === "spawned" && now - mine.spawnedAt >= 10000) {
      mine.phase = "armed";
      mine.armedAt = now;
      playGameSfx("landmine_arm", 0.96);
      if (!quietArm) {
        commBoxController.reactTo("landmine_armed");
        commBoxController.queueVO({
          audioSrc: commBoxController.commVoSrc(
            commBoxController.pickFromPool("landminearmed", commBoxController.POOL_LANDMINE_ARMED),
          ),
          event: "landmine_armed",
          priority: "high",
        });
      }
      // startDangerLoop(); // 2026-06-09: danger_loop silenced
    }
    if (mine.phase === "armed" && now - mine.armedAt >= 8000) {
      explodeFn({ halfRadius: true });
      return true;
    }
    if (mine.phase === "player_armed" && now - mine.playerArmedAt >= 6000) {
      explodeFn({ halfRadius: false });
      return true;
    }
    return false;
  }

  // 2026-06-11: an exploding armed mine triggers any other armed mine within range (recursion
  // bounded by depth). Each victim removes itself from its container via its own explode path.
  let _mineChainDepth = 0;
  function chainDetonateMines(x, y, radius) {
    if (_mineChainDepth > 6) return;
    const victims = [];
    const inRange = (m) => m
      && (m.phase === "armed" || m.phase === "player_armed")
      && Math.hypot(m.x - x, m.y - y) <= radius;
    if (inRange(landmine)) victims.push(landmine);
    for (let i = 0; i < placedBombs.length; i += 1) {
      if (inRange(placedBombs[i])) victims.push(placedBombs[i]);
    }
    for (let i = 0; i < victims.length; i += 1) {
      const m = victims[i];
      if (m === landmine) explodeLandmine({ halfRadius: true });
      else explodePlacedBomb(m, { halfRadius: true });
    }
  }

  // 2026-06-10: shared explosion effects for any mine entity (level landmine or placed bomb).
  // Removal from its container is the caller's job.
  function explodeMineEntity(mine, { halfRadius = false } = {}) {
    if (!mine) return;
    const x = mine.x;
    const y = mine.y;
    const radius = halfRadius ? 350 : 700;
    spawnBombShrapnel(x, y);
    window.pixiRenderer?.triggerBombDetonation?.(x, y, radius);
    addWarpRing(x, y, "rgba(255,90,90,1)");
    spawnExplosion(x, y, 80, true);
    triggerLandmineScreenFlash();
    cssFlash("#ffffff", 0.55, 300);
    cssShake(1.8);
    setTimeout(() => cssShake(1.0), 120);
    window.galaxyBackground?.setHectic(true);
    setTimeout(() => window.galaxyBackground?.setHectic(false), 3000);
    playBigBoomSound();
    playGameSfx("bigbang", 1.62);
    // chain: detonate other armed mines caught in the blast (the just-exploded mine is already
    // removed from its container by the caller, so it can't re-trigger itself)
    _mineChainDepth += 1;
    chainDetonateMines(x, y, radius * 0.6);
    _mineChainDepth -= 1;
  }

  function explodeLandmine(opts = {}) {
    if (!landmine) return;
    const mine = landmine;
    landmine = null;
    stopDangerLoop();
    explodeMineEntity(mine, opts);
  }

  function explodePlacedBomb(mine, opts = {}) {
    const i = placedBombs.indexOf(mine);
    if (i >= 0) placedBombs.splice(i, 1);
    explodeMineEntity(mine, opts);
  }

  function detonateInventoryBomb(aimX, aimY) {
    if (playerBombInventory <= 0) return;
    playerBombInventory--;
    updateHudBombInventory();
    // 2026-06-09: deploy at the aimed tap point (falls back to center if none given)
    const x = Number.isFinite(aimX) ? aimX : sim.width / 2;
    const y = Number.isFinite(aimY) ? aimY : sim.height / 2;
    spawnBombShrapnel(x, y);
    window.pixiRenderer?.triggerBombDetonation?.(x, y, 1050);
    addWarpRing(x, y, "rgba(255,90,90,1)");
    spawnExplosion(x, y, 80, true);
    triggerLandmineScreenFlash();
    cssFlash("#ffffff", 0.55, 300);
    cssShake(1.8);
    setTimeout(() => cssShake(1.0), 120);
    window.galaxyBackground?.setHectic(true);
    setTimeout(() => window.galaxyBackground?.setHectic(false), 3000);
    playBigBoomSound();
    playGameSfx("bigbang", 1.62);
  }

  function spawnBombShrapnel(x, y) {
    const count = 24;
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.3;
      const speed = 500 + Math.random() * 400;
      _bombShrapnel.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: 6 + Math.random() * 6,
        life: 0,
        ttl: 1800 + Math.random() * 600,
        startedAt: performance.now(),
        hit: false,
      });
    }
    for (let i = 0; i < 12; i += 1) {
      const angle = (i / 12) * Math.PI * 2;
      const speed = 250 + Math.random() * 150;
      _bombShrapnel.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: 14 + Math.random() * 8,
        life: 0,
        ttl: 2200,
        startedAt: performance.now(),
        hit: false,
        isPulse: true,
      });
    }
  }

  function pointFromEvent(event) {
    const rect = galaxyPlayCanvas.getBoundingClientRect();
    const clientX = event.touches?.[0]?.clientX ?? event.changedTouches?.[0]?.clientX ?? event.clientX;
    const clientY = event.touches?.[0]?.clientY ?? event.changedTouches?.[0]?.clientY ?? event.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function clearGameplayEntities() {
    resetStroidToss();
    sim.tossedAsteroid = null;
    while (sim.asteroids.length) releaseAsteroid(sim.asteroids.pop());
    while (sim.particles.length) releaseParticle(sim.particles.pop());
    while (sim.warpRings.length) releaseRing(sim.warpRings.pop());
    sim.lightningRings.length = 0;
    sim.shooting = null;
    landmine = null;
    placedBombs.length = 0; // 2026-06-10: placed bombs don't carry across levels/menu
    stopDangerLoop();
    landmineSpawnedThisLevel = false;
    // 2026-06-10: clear powerups, active effects, and aim state on level transitions / menu exit
    powerups.length = 0;
    quadShotUntil = 0;
    freezeUntil = 0;
    _freezeWasActive = false; // no unfreeze sound on level transitions / menu exit
    goldbarsForceSpawnedThisLevel = false;
    playerFreezeInventory = 0;
    updateHudFreezeInventory();
    updateHudQuadBadge();
    bombAimMode = false;
    hudBombBtn?.classList.remove("hudBombBtn--aiming");
    stopUfoDrone();
    ufo = null;
    arcadeUfoSpawnAt = 0;
    resetPlasmaCageGesture();
    plasmaCage.releaseFx = null;
    plasmaCage.rechargeSoundPlayed = true;
    laserBeams.length = 0;
    tapBlasts.length = 0;
    _bombShrapnel.length = 0;
    flameTrail.length = 0;
    fireBlobs.length = 0;
    stopPlasmaChargeSound();
    stopWarningState();
  }

  let _lsrStylesInjected = false;
  function ensureLsrStyles() {
    if (_lsrStylesInjected) return;
    _lsrStylesInjected = true;
    const s = document.createElement("style");
    s.id = "lsrStyles";
    s.textContent = `
      #levelScoreReport{position:fixed;inset:0;z-index:9000;display:flex;align-items:center;justify-content:center;pointer-events:auto;}
      .lsr-panel{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace;color:#dff;background:linear-gradient(180deg,rgba(5,18,32,.96),rgba(2,8,18,.99));border:1px solid rgba(0,255,209,.42);border-radius:16px;padding:36px 48px;min-width:min(420px,92vw);box-shadow:0 0 48px rgba(0,255,209,.16),inset 0 0 24px rgba(0,255,209,.06);animation:lsrSlam 250ms cubic-bezier(.2,1.4,.4,1) both;}
      @keyframes lsrSlam{from{transform:scale(2);opacity:0}to{transform:scale(1);opacity:1}}
      @keyframes lsrRowIn{from{opacity:0;transform:translateX(-16px)}to{opacity:1;transform:none}}
      @keyframes lsrBlink{0%,100%{opacity:.4}50%{opacity:.85}}
      .lsr-title{font-size:1.4rem;letter-spacing:.18em;color:#00FFD1;text-align:center;margin-bottom:12px;text-shadow:0 0 10px rgba(0,255,209,.6);}
      .lsr-div{color:rgba(0,255,209,.25);font-size:1.1rem;margin:8px 0;text-align:center;letter-spacing:.04em;opacity:0;transform:translateX(-16px);}
      .lsr-row{display:flex;justify-content:space-between;align-items:baseline;gap:32px;margin:5px 0;font-size:1.2rem;letter-spacing:.08em;opacity:0;transform:translateX(-16px);}
      .lsr-div.in,.lsr-row.in{animation:lsrRowIn 250ms ease forwards;}
      .lsr-lbl{color:rgba(183,201,255,.65);}
      .lsr-val{color:#fff;font-weight:700;}
      .lsr-total .lsr-lbl{color:#b7c9ff;}
      .lsr-total .lsr-val{color:#00FFD1;font-size:1.4rem;}
      .lsr-hint{text-align:center;margin-top:14px;font-size:1rem;letter-spacing:.2em;color:rgba(183,201,255,.4);opacity:0;transform:translateX(-16px);}
      .lsr-hint.in{animation:lsrRowIn 250ms ease forwards,lsrBlink 1.2s 250ms ease-in-out infinite;}
      .score-tick-flash{text-shadow:0 0 12px #00ffcc,0 0 24px #00ffcc;transition:text-shadow 80ms ease;}
      .score-final-flash{text-shadow:0 0 30px #ffffff,0 0 60px #00ffcc;transition:text-shadow 300ms ease;}
      .hudBombBtn--aiming{box-shadow:0 0 12px #00ffcc,0 0 24px #00ffcc;border-color:#00ffcc;animation:pulse-aim 0.6s ease-in-out infinite alternate;}
      @keyframes pulse-aim{from{box-shadow:0 0 8px #00ffcc;}to{box-shadow:0 0 20px #00ffcc,0 0 40px #00ffaa;}}
    `;
    document.head.appendChild(s);
  }

  function showLevelScoreReport({ levelNum, levelTimeMs, timeBonus, accuracy, accuracyBonus, ufosKilled, scoreBefore, scoreAfter, onDismiss }) {
    ensureLsrStyles();
    document.getElementById("levelScoreReport")?.remove();

    const overlay = document.createElement("div");
    overlay.id = "levelScoreReport";
    overlay.setAttribute("aria-hidden", "true");

    const acStr = accuracyBonus > 0 ? ` +${accuracyBonus}` : "";
    const tbStr = timeBonus > 0 ? `+${timeBonus}` : "—";
    const panel = document.createElement("div");
    panel.className = "lsr-panel";
    panel.innerHTML = `
      <div class="lsr-title">LEVEL ${levelNum} COMPLETE</div>
      <div class="lsr-div">─────────────────</div>
      <div class="lsr-row"><span class="lsr-lbl">SCORE</span><span class="lsr-val" id="lsrScoreVal">${scoreBefore}</span></div>
      <div class="lsr-row"><span class="lsr-lbl">LEVEL TIME</span><span class="lsr-val">${formatRunTime(levelTimeMs)}</span></div>
      <div class="lsr-row"><span class="lsr-lbl">ACCURACY</span><span class="lsr-val">${accuracy}%${acStr}</span></div>
      <div class="lsr-row"><span class="lsr-lbl">UFOs</span><span class="lsr-val">${ufosKilled}</span></div>
      <div class="lsr-row"><span class="lsr-lbl">TIME BONUS</span><span class="lsr-val">${tbStr}</span></div>
      <div class="lsr-div">─────────────────</div>
      <div class="lsr-row lsr-total"><span class="lsr-lbl">TOTAL</span><span class="lsr-val" id="lsrTotalVal">${scoreBefore}</span></div>
      <div class="lsr-hint">TAP TO CONTINUE</div>
    `;
    overlay.appendChild(panel);
    (galaxyView || document.body).appendChild(overlay);

    // FIX 2026-06-09: make sure a UFO doesn't linger behind the scorecard
    if (ufo) {
      stopUfoDrone();
      ufo = null;
    }

    // FIX 2026-06-09: duck music to 0.75 while the scorecard is up, restore on dismiss
    const scorecardMusicGainBefore = audioEngine.musicGain?.gain?.value ?? MUSIC_MAX_GAIN;
    const scorecardMusicHtmlVolBefore = audioEngine.currentMusicHtml?.node?.volume ?? MUSIC_MAX_GAIN;
    function rampScorecardMusic(gainTarget, htmlVol) {
      if (audioEngine.musicGain && audioEngine.ctx) {
        const t = audioEngine.ctx.currentTime;
        audioEngine.musicGain.gain.cancelScheduledValues(t);
        audioEngine.musicGain.gain.setValueAtTime(audioEngine.musicGain.gain.value, t);
        audioEngine.musicGain.gain.linearRampToValueAtTime(gainTarget, t + 0.25);
      }
      if (audioEngine.currentMusicHtml?.node) {
        audioEngine.currentMusicHtml.node.volume = htmlVol;
      }
    }
    rampScorecardMusic(0.75, 0.75);

    const shownAt = performance.now();
    let dismissed = false;
    let lastTapAt = 0;
    let autoTimer = null;
    const tallyTimers = [];
    let tallyDone = false;
    let writeLoopHandle = null;
    let countupRaf = 0;

    function stopWriteLoop() {
      if (writeLoopHandle) {
        try { audioEngine.stopLoop("write_on_text_loop"); } catch {}
        writeLoopHandle = null;
      }
    }

    function dismiss() {
      if (dismissed) return;
      dismissed = true;
      // FIX 2026-06-09: restore music to its pre-scorecard level as gameplay resumes
      rampScorecardMusic(scorecardMusicGainBefore, scorecardMusicHtmlVolBefore);
      stopWriteLoop();
      if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
      tallyTimers.forEach(t => clearTimeout(t));
      tallyTimers.length = 0;
      if (countupRaf) { cancelAnimationFrame(countupRaf); countupRaf = 0; }
      overlay.style.transition = "opacity 180ms ease";
      overlay.style.opacity = "0";
      setTimeout(() => { overlay.remove(); onDismiss?.(); }, 190);
    }

    overlay.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      const tapNow = performance.now();
      const isDoubleTap = tapNow - lastTapAt < 350;
      lastTapAt = tapNow;
      if (isDoubleTap || tapNow - shownAt >= 2000) dismiss();
    }, { passive: false });

    autoTimer = setTimeout(dismiss, 7000);

    // Row-by-row tally reveal: dividers + rows appear one at a time, 200ms apart
    const revealEls = Array.from(panel.querySelectorAll(".lsr-div, .lsr-row"));
    writeLoopHandle = audioEngine.playLoop("write_on_text_loop", { volume: state.whisper ? 0.2 : 0.38 });
    revealEls.forEach((el, i) => {
      tallyTimers.push(setTimeout(() => {
        if (dismissed) return;
        el.classList.add("in");
        if (el.classList.contains("lsr-row")) playGameSfx("scorecount", 0.3);
        if (i === revealEls.length - 1) {
          stopWriteLoop();
          // Hint appears concurrently while countup is still running
          tallyTimers.push(setTimeout(() => {
            if (!dismissed) panel.querySelector(".lsr-hint")?.classList.add("in");
          }, 400));
          // Score countup from scoreBefore → scoreAfter over ~1500ms
          const totalEl = panel.querySelector("#lsrTotalVal");
          if (totalEl && scoreAfter > scoreBefore) {
            const countupDuration = 1500;
            const countupStart = performance.now();
            let display = scoreBefore;
            let lastBlipAt = 0;
            function countupTick(now) {
              if (dismissed) { countupRaf = 0; return; }
              const elapsed = now - countupStart;
              const framesLeft = Math.max(1, Math.round((1 - Math.min(1, elapsed / countupDuration)) * 90));
              const step = Math.max(1, Math.ceil((scoreAfter - display) / framesLeft));
              display = Math.min(scoreAfter, display + step);
              totalEl.textContent = display;
              totalEl.classList.add("score-tick-flash");
              setTimeout(() => totalEl.classList.remove("score-tick-flash"), 80);
              if (now - lastBlipAt >= 40) {
                lastBlipAt = now;
                playGameSfx("scorecount", 0.18);
              }
              if (display < scoreAfter) {
                countupRaf = requestAnimationFrame(countupTick);
              } else {
                countupRaf = 0;
                totalEl.classList.remove("score-tick-flash");
                totalEl.classList.add("score-final-flash");
                setTimeout(() => totalEl.classList.remove("score-final-flash"), 300);
                if (!tallyDone) { tallyDone = true; }
                playGameSfx("level_up", 0.9);
                cssFlash("#00FFD1", 0.3, 300);
              }
            }
            countupRaf = requestAnimationFrame(countupTick);
          } else {
            // No score gain — set total immediately and flash
            if (totalEl) {
              totalEl.textContent = scoreAfter;
              totalEl.classList.add("score-final-flash");
              setTimeout(() => totalEl.classList.remove("score-final-flash"), 300);
            }
            if (!tallyDone) {
              tallyDone = true;
              playGameSfx("level_up", 0.9);
              cssFlash("#00FFD1", 0.3, 300);
            }
          }
        }
      }, 150 + i * 200));
    });
  }

  function levelComplete() {
    arcadeActive = false;
    retryPending = false;
    stopWarningState();
    arcadeResumeAvailable = false;
    syncArcadeEntryLabel();
    const timeUsed = performance.now() - levelRunStartAt;
    const timeBonus = Math.max(0, Math.floor((levelDurationMs - timeUsed) / 1000) * 50);
    const accuracy = Math.round(shotsHit / Math.max(1, shotsFired) * 100);
    const accuracyBonus = accuracy >= 90 ? 500 : accuracy >= 75 ? 250 : accuracy >= 50 ? 100 : 0;
    const scoreBefore = arcadeScore;
    if (timeBonus > 0) addArcadeScore(timeBonus);
    addArcadeScore(500);
    if (accuracyBonus > 0) addArcadeScore(accuracyBonus);
    const scoreAfter = arcadeScore;
    triggerHapticNotification(hapticNotificationType.Success);
    commBoxController.reactTo("levelcomplete");
    commBoxController.queueVO({
      audioSrc: commBoxController.commVoSrc(
        commBoxController.pickFromPool("levelcomplete", commBoxController.POOL_LEVEL_COMPLETE),
      ),
      event: "levelcomplete",
    });
    const cfg = ARCADE_LEVELS[currentLevelIndex];
    const nextLevel = cfg.level + 1;
    if (nextLevel <= ARCADE_LEVELS.length) {
      const _lcNow = performance.now();
      if (gameTimer.running) {
        const _lvMs = _lcNow - gameTimer.startedAt;
        gameTimer.elapsed += _lvMs;
        gameTimer.levelTimes.push(_lvMs);
        gameTimer.running = false;
      }
      showLevelScoreReport({
        levelNum: cfg.level,
        levelTimeMs: timeUsed,
        timeBonus,
        accuracy,
        accuracyBonus,
        ufosKilled: ufosKilledThisLevel,
        scoreBefore,
        scoreAfter,
        onDismiss: () => {
          setSavedArcadeLevel(nextLevel);
          // 2026-06-12: the "LEVEL X" slam-in fires ONCE, from startLevel() once the next level
          // is fully loaded — not here on dismiss (that double-slammed: once pre-load, once post).
          setTimeout(() => startLevel(currentLevelIndex + 1), 420);
        },
      });
      return;
    }
    const _winNow = performance.now();
    if (gameTimer.running) {
      const _lvMs = _winNow - gameTimer.startedAt;
      gameTimer.elapsed += _lvMs;
      gameTimer.levelTimes.push(_lvMs);
      gameTimer.running = false;
    }
    let _runMsg = `Run: ${formatRunTime(gameTimer.elapsed)}`;
    if (gameTimer.bestTime === null || gameTimer.elapsed < gameTimer.bestTime) {
      gameTimer.bestTime = gameTimer.elapsed;
      _runMsg += " — NEW RECORD!";
      try { localStorage.setItem(STORAGE_BEST_RUN, String(gameTimer.elapsed)); } catch {}
    }
    setArcadeWon();
    try { localStorage.setItem(STORAGE_GAME_BEATEN, "true"); } catch {}
    clearArcadeProgress();
    syncArcadeMenuButtons();
    try {
      localStorage.setItem(STORAGE.rewardCelestial, "1");
    } catch {
      // ignore
    }
    // 2026-06-12: "YOU WIN" celebration — screen-wide boom barrage + bold slam-in text held
    // over the still-running level-10 music (ducked), then hand off to the score/initials screen.
    playWinSequence(() => {
      galaxyView?.classList.remove("level-10");
      audioEngine.stopMusic();
      stopGalaxyBackground();
      if (arcadeScore > 0) {
        showInitialsEntry(arcadeScore, _runMsg);
        return;
      }
      showArcadeOverlay("YOU WIN", `You Win Control of the Polyverse — ${_runMsg}`, 0, {
        buttonText: "Back to Modes",
        buttonAction: () => showModeSelect(),
      });
    });
  }

  // Plays the ~3s game-completion celebration, then invokes onComplete() to transition to the
  // score/initials screen. Reuses spawnExplosion + cssShake + the arcade slam-text overlay.
  function playWinSequence(onComplete) {
    // Duck the level-10 music to 0.4 for the sequence (kept playing for drama; stopped on handoff).
    if (audioEngine.musicGain && audioEngine.ctx) {
      const t = audioEngine.ctx.currentTime;
      audioEngine.musicGain.gain.cancelScheduledValues(t);
      audioEngine.musicGain.gain.setValueAtTime(audioEngine.musicGain.gain.value, t);
      audioEngine.musicGain.gain.linearRampToValueAtTime(0.4 * MUSIC_MAX_GAIN, t + 0.3);
    }
    if (audioEngine.currentMusicHtml?.node) {
      audioEngine.currentMusicHtml.node.volume = 0.4;
    }

    // Triumphant chime layered over the boom barrage.
    playGameSfx("level_up", 0.95);

    // 7 large explosions at random spots across the screen, staggered ~180ms over ~1.3s.
    const EXPLOSION_COUNT = 7;
    const boomKeys = ["explosion_big", "explosion_med", "explosion_med_alt"];
    for (let i = 0; i < EXPLOSION_COUNT; i += 1) {
      setTimeout(() => {
        const x = sim.width * (0.12 + Math.random() * 0.76);
        const y = sim.height * (0.15 + Math.random() * 0.6);
        spawnExplosion(x, y, 60, true, 2.4, 1.2, 3, "roid01");
        cssShake(i === 0 ? 1.5 : 0.8);
        playGameSfx(boomKeys[i % boomKeys.length], 1.1 + Math.random() * 0.2, { important: true });
      }, i * 180);
    }

    // "YOU WIN" slam-in — same overlay element as the level intro, bigger/bolder via .winBig.
    if (arcadeOverlay && arcadeOverlayText) {
      if (overlayTimer) { clearTimeout(overlayTimer); overlayTimer = null; }
      showEl(arcadeOverlay);
      arcadeOverlay.classList.add("show");
      arcadeOverlay.setAttribute("aria-hidden", "false");
      if (arcadeOverlayBtn) arcadeOverlayBtn.style.display = "none";
      if (arcadeOverlayBtnSecondary) arcadeOverlayBtnSecondary.style.display = "none";
      if (arcadeOverlaySub) arcadeOverlaySub.textContent = "";
      arcadeOverlayText.textContent = "YOU WIN";
      arcadeOverlayText.classList.remove("fadeOut");
      arcadeOverlayText.classList.add("winBig");
      void arcadeOverlayText.offsetWidth;
      arcadeOverlayText.classList.add("show");
    }

    // Hold ~1.5s after the slam, fade out, then hand off (~2.9s total).
    setTimeout(() => {
      if (arcadeOverlayText) arcadeOverlayText.classList.add("fadeOut");
      setTimeout(() => {
        if (arcadeOverlay) {
          arcadeOverlay.classList.remove("show");
          arcadeOverlay.setAttribute("aria-hidden", "true");
        }
        if (arcadeOverlayText) {
          arcadeOverlayText.classList.remove("show", "fadeOut", "winBig");
        }
        onComplete();
      }, ARCADE_OVERLAY_FADE_MS);
    }, 2400);
  }

  function promptRetryOrGameOver() {
    retryPending = true;
    commBoxController.stopVO();
    setMenuOverlayOpen(true);
    showArcadeOverlay("TIME'S UP", "Use 1 life to retry this level?", 0, {
      buttonText: "Retry (1 Life)",
      buttonAction: () => {
        playGameSfx("retry_appear", 1);
        flashScreen("#00ff3b", 1500, 1);
        retryPending = false;
        setMenuOverlayOpen(false);
        arcadeLives = clamp(arcadeLives - 1, 0, MAX_LIVES);
        renderLives();
        if (arcadeLives === 1) {
          commBoxController.queueVO({
            audioSrc: commBoxController.commVoSrc(
              commBoxController.pickFromPool("lowlives", commBoxController.POOL_LOW_LIVES),
            ),
            event: "lowlives",
            priority: "high",
          });
        }
        hideArcadeOverlay();
        startLevel(currentLevelIndex);
      },
      secondaryButtonText: "Game Over",
      secondaryButtonAction: () => {
        retryPending = false;
        triggerGameOver();
      },
    });
  }

  function triggerGameOver() {
    arcadeActive = false;
    retryPending = false;
    if (gameTimer.running) {
      gameTimer.elapsed += performance.now() - gameTimer.startedAt;
      gameTimer.running = false;
    }
    commBoxController.stopVO();
    audioEngine.stopMusic();
    stopGalaxyBackground();
    stopWarningState();
    arcadeResumeAvailable = false;
    syncArcadeEntryLabel();
    clearArcadeProgress();
    syncArcadeMenuButtons();
    playGameSfx("gameover", 0.96);
    if (arcadeScore > 0) {
      showInitialsEntry(arcadeScore);
      return;
    }
    showArcadeOverlay("GAME OVER", "You Died. Progress Lost.", 0, {
      buttonText: "Back to Modes",
      buttonAction: () => showModeSelect(),
    });
  }

  function startLevel(idx) {
    const safeIdx = clamp(idx, 0, ARCADE_LEVELS.length - 1);
    audioEngine.unlock?.();
    audioEngine.loadMany?.(GAME_SFX);
    currentLevelIndex = safeIdx;
    const cfg = ARCADE_LEVELS[safeIdx];
    const now = performance.now();
    setSavedArcadeLevel(cfg.level);
    initMediaSession().then(() => updateMediaSessionLevel(cfg.level));
    galaxyView?.classList.toggle("level-10", cfg.level === 10);
    applyLevelTheme(cfg.level);

    clearGameplayEntities();
    shotsFired = 0;
    shotsHit = 0;
    ufosKilledThisLevel = 0;
    commBoxController.show();
    commBoxController.setDamageState("normal");
    showFpsOverlay();
    resetPraiseState();
    totalToSpawn = cfg.totalToClear;
    spawnedTotal = 0;
    spawnQueue = Math.max(0, cfg.totalToClear - cfg.startSpawn);
    maxOnScreen = capIOSNativeAsteroids(cfg.maxOnScreen);
    sim.maxAsteroids = capIOSNativeAsteroids(cfg.maxOnScreen);
    levelDurationMs = cfg.time * 1000;
    levelRunStartAt = now + 400;
    arcadePausedUntil = levelRunStartAt;
    levelEndsAt = levelRunStartAt + levelDurationMs;
    nextSpawnAt = cfg.spawnEveryMs > 0 ? levelRunStartAt + cfg.spawnEveryMs : Infinity;
    landmine = null;
    placedBombs.length = 0; // 2026-06-10: placed bombs don't carry across levels
    stopDangerLoop();
    landmineSpawnedThisLevel = false;
    ufo = null;
    setupUfoSpawnForLevel(cfg);
    pausedLevelRemainingMs = 0;
    pausedLandmineRemainingMs = 0;
    arcadeResumeAvailable = false;
    bgPreRolledForLevel = false;
    _timerWarnedAt60 = false;
    _timerWarnedAt10 = false;
    resetArcadeTimerVisuals();
    syncArcadeEntryLabel();
    setGalaxyBackgroundForLevel(cfg.level);
    window.galaxyBackground?.show();
    window.galaxyBackground?.setTheme(cfg.level);
    window.galaxyBackground?.setLevel(cfg.level);
    if (currentLevelIndex > 0) {
      window.galaxyBackground?.triggerWarp();
    }
    playArcadeMusicForLevel(cfg.level);
    if (cfg.level === 10) {
      playGameSfx("lastlevelstart", 0.96);
    }
    for (let i = 0; i < cfg.startSpawn; i += 1) {
      const p = randomPerimeterPoint();
      spawnAsteroid(p.x, p.y, 3, false);
      spawnedTotal += 1;
    }

    arcadeActive = true;
    retryPending = false;
    if (currentLevelIndex === 0 && !gameTimer.running) {
      gameTimer.startedAt = now;
      gameTimer.elapsed = 0;
      gameTimer.running = true;
      gameTimer.levelTimes = [];
    } else if (!gameTimer.running) {
      gameTimer.startedAt = now;
      gameTimer.running = true;
    }
    updateArcadeHud(now);
    showLevelIntro(cfg.level);

    const levelNum = cfg.level;
    let levelStartVO = null;

    if (levelNum === 1) {
      levelStartVO = "vo-welcometothepolyverse.mp3";
    } else if (levelNum === 5) {
      levelStartVO = "vo-hairytakeemout.mp3";
    } else {
      levelStartVO = commBoxController.pickFromPool(
        "levelstart",
        commBoxController.POOL_LEVEL_START,
      );
    }

    commBoxController.queueVO({
      audioSrc: commBoxController.commVoSrc(levelStartVO),
      event: "commander",
    });

    if (levelNum === 1) {
      function fireSecondVO() {
        const ticker = document.getElementById("commanderTicker");
        const isActive = ticker?.classList.contains("ticker-visible");
        if (isActive) {
          setTimeout(fireSecondVO, 400);
          return;
        }
        commBoxController.queueVO({
          audioSrc: commBoxController.commVoSrc("vo-lets_blast_these_stroids.mp3"),
        });
      }
      setTimeout(fireSecondVO, 800);
    }
  }

  function startArcadeFromSave() {
    audioEngine.unlock?.();
    audioEngine.loadMany?.(GAME_SFX);
    hideArcadeOverlay();
    if (arcadeResumeAvailable && arcadeActive) {
      const now = performance.now();
      levelEndsAt = now + pausedLevelRemainingMs;
      restoreLandmineTimer(pausedLandmineRemainingMs, now);
      engineMode = "arcade";
      setMenuOverlayOpen(false);
      setGalaxyViewMode("arcade");
      setGalaxyTool("draw");
      resizeGalaxyCanvas();
      computePlayfield();
      setTimeout(computePlayfield, 50);
      startGalaxyLoop();
      const resumeLevel = ARCADE_LEVELS[currentLevelIndex]?.level || 1;
      playArcadeMusicForLevel(resumeLevel);
      arcadeResumeAvailable = false;
      syncArcadeEntryLabel();
      return;
    }
    arcadeScore = 0;
    renderScore();
    engineMode = "arcade";
    arcadeActive = true;
    retryPending = false;
    setMenuOverlayOpen(false);
    setGalaxyViewMode("arcade");
    setGalaxyTool("draw");
    resizeGalaxyCanvas();
    computePlayfield();
    setTimeout(computePlayfield, 50);
    const saved = getSavedArcadeLevel();
    const idx = clamp(saved - 1, 0, ARCADE_LEVELS.length - 1);
    startLevel(idx);
    startGalaxyLoop();
  }

  function startArcadeNew() {
    tapBlasts = [];
    clearArcadeProgress();
    setSavedArcadeLevel(1);
    arcadeLives = 0;
    arcadeScore = 0;
    playerBombInventory = 0;
    // 2026-06-10: reset powerup + active effect state
    powerups.length = 0;
    quadShotUntil = 0;
    freezeUntil = 0;
    playerFreezeInventory = 0;
    updateHudFreezeInventory();
    updateHudQuadBadge();
    bombAimMode = false;
    hudBombBtn?.classList.remove("hudBombBtn--aiming");
    nextBombPowerupAt = performance.now() + BOMB_POWERUP_INTERVAL_MIN
      + Math.random() * (BOMB_POWERUP_INTERVAL_MAX - BOMB_POWERUP_INTERVAL_MIN);
    renderLives();
    renderScore();
    updateHudBombInventory();
    startArcadeAtLevel(1);
  }

  function startArcadeResume() {
    startArcadeFromSave();
  }

  function openArcadeMenu() {
    setArcadeSubmenu("arcade");
    syncArcadeMenuButtons();
  }

  function openArcadeLevelSelect() {
    if (!(DEBUG_FORCE_LEVEL_SELECT || hasArcadeWon())) return;
    buildArcadeLevelSelect();
    setArcadeSubmenu("levels");
  }

  function startArcadeAtLevel(levelNum) {
    audioEngine.unlock?.();
    audioEngine.loadMany?.(GAME_SFX);
    hideArcadeOverlay();
    arcadeScore = 0;
    renderScore();
    engineMode = "arcade";
    arcadeActive = true;
    retryPending = false;
    setMenuOverlayOpen(false);
    arcadeResumeAvailable = false;
    syncArcadeEntryLabel();
    setGalaxyViewMode("arcade");
    setGalaxyTool("draw");
    resizeGalaxyCanvas();
    computePlayfield();
    setTimeout(computePlayfield, 50);
    const numericLevel = Math.floor(Number(levelNum));
    const idx = clamp((Number.isFinite(numericLevel) ? numericLevel : 1) - 1, 0, ARCADE_LEVELS.length - 1);
    startLevel(idx);
    startGalaxyLoop();
  }

  function startPracticeMode() {
    if (!PRACTICE_ENABLED) return;
    audioEngine.unlock?.();
    audioEngine.loadMany?.(GAME_SFX);
    hideArcadeOverlay();
    stopWarningState();
    engineMode = "practice";
    arcadeActive = false;
    arcadeResumeAvailable = false;
    retryPending = false;
    resetArcadeTimerVisuals();
    galaxyView?.classList.remove("level-10");
    setMenuOverlayOpen(false);
    syncArcadeEntryLabel();
    setGalaxyViewMode("practice");
    sim.maxAsteroids = capIOSNativeAsteroids(PRACTICE_MAX_ASTEROIDS);
    setGalaxyBackgroundForLevel(1);
    window.galaxyBackground?.show();
    if (engineMode !== "arcade") window.galaxyBackground?.setTheme(1);
    window.galaxyBackground?.setLevel(1);
    setGalaxyTool("draw");
    state.practiceTool = "pencil";
    setPracticeToolUI();
    sim.nextDrawAt = 0;
    clearGameplayEntities();
    commBoxController.show();
    commBoxController.setDamageState("normal");
    showFpsOverlay();
    updatePracticeDebug();
    audioEngine.stopMusic();
    audioEngine.playMusic(MUSIC.TUTORIAL, getMusicForLevel(0), { crossfadeMs: 200 });
    resizeGalaxyCanvas();
    computePlayfield();
    setTimeout(computePlayfield, 50);
    startGalaxyLoop();
  }

  function showModeSelect({ preserveArcade = false, openArcadeMenu = false } = {}) {
    hideArcadeOverlay();
    retryPending = false;
    stopWarningState();
    const canPreserve = preserveArcade && engineMode === "arcade" && arcadeActive;
    if (canPreserve) {
      const now = performance.now();
      pausedLevelRemainingMs = Math.max(0, levelEndsAt - now);
      pausedLandmineRemainingMs = getLandmineRemainingMs(now);
      arcadeResumeAvailable = true;
    } else {
      commBoxController.hide();
      clearGameplayEntities();
      arcadeActive = false;
      arcadeResumeAvailable = false;
      audioEngine.stopMusic();
      setGalaxyBackgroundDim(0);
      galaxyView?.classList.remove("level-10");
    }
    engineMode = "menu";
    syncArcadeEntryLabel();
    setArcadeSubmenu(canPreserve && openArcadeMenu ? "arcade" : "root");
    syncArcadeMenuButtons();
    setGalaxyViewMode("menu");
    setMenuOverlayOpen(true);
    sim.maxAsteroids = capIOSNativeAsteroids(sim.width < 700 ? 80 : 120);
    setGalaxyTool("draw");
    setPracticeToolUI();
    if (!canPreserve) {
      setGalaxyBackgroundForLevel(1);
    }
    if (arcadeTimerBackdrop) {
      arcadeTimerBackdrop.style.opacity = "0";
      arcadeTimerBackdrop.classList.remove("danger");
    }
    resetArcadeTimerVisuals();
    resizeGalaxyCanvas();
    computePlayfield();
    updateArcadeHud(performance.now());
    if (debugLevelSelect) {
      const fallbackLevel = ARCADE_LEVELS[currentLevelIndex]?.level || getSavedArcadeLevel();
      debugLevelSelect.value = String(fallbackLevel);
    }
    syncDebugLevelPanel();
    startGalaxyLoop();
    draw(performance.now());
  }

  function resizeGalaxyCanvas() {
    sim.dpr = nativeCanvasDpr();
    const rect = galaxyPlayCanvas.getBoundingClientRect();
    const rawWidth = Math.max(1, Math.floor(rect.width || window.innerWidth));
    const rawHeight = Math.max(1, Math.floor(rect.height || window.innerHeight));
    const gameplayMode = engineMode === "arcade" || engineMode === "practice";
    if (gameplayMode && !worldLockEnabled) {
      worldLockEnabled = true;
      worldLockWidth = rawWidth;
      worldLockHeight = rawHeight;
    }
    const width = gameplayMode && worldLockEnabled ? worldLockWidth : rawWidth;
    const height = gameplayMode && worldLockEnabled ? worldLockHeight : rawHeight;
    sim.width = width;
    sim.height = height;
    galaxyPlayCanvas.style.inset = "auto";
    galaxyPlayCanvas.style.right = "auto";
    galaxyPlayCanvas.style.bottom = "auto";
    galaxyPlayCanvas.style.left = `${Math.max(0, Math.floor((rawWidth - width) * 0.5))}px`;
    galaxyPlayCanvas.style.top = `${Math.max(0, Math.floor((rawHeight - height) * 0.5))}px`;
    galaxyPlayCanvas.style.width = `${width}px`;
    galaxyPlayCanvas.style.height = `${height}px`;
    galaxyPlayCanvas.width = Math.floor(width * sim.dpr);
    galaxyPlayCanvas.height = Math.floor(height * sim.dpr);
    ctx.setTransform(sim.dpr, 0, 0, sim.dpr, 0, 0);
    resizePlasmaOverlayCanvas();
    resizeTimerPerimeterCanvas();
    resizeUfoFxCanvas();
    window.galaxyBackground?.resize(sim.width, sim.height);
    sim.maxAsteroids = capIOSNativeAsteroids(
      engineMode === "practice" ? PRACTICE_MAX_ASTEROIDS : (engineMode === "arcade" ? sim.maxAsteroids : (sim.width < 700 ? 80 : 120)),
    );
    seedStars();
    computePlayfield();
    if (worldLockEnabled && window.pixiRenderer) {
      window.pixiRenderer.init(galaxyPlayCanvas.parentElement, sim.width, sim.height, isIOSNative).catch?.(() => {});
      window.pixiRenderer.resize(sim.width, sim.height);
    } else {
      setPlasmaOverlayVisible(true);
    }
  }

  function relayoutGalaxyCanvas() {
    resizeGalaxyCanvas();
    computePlayfield();
    if (!galaxyView.hidden) draw(performance.now());
  }

  function seedStars() {
    const target = Math.max(90, Math.min(190, Math.round((sim.width * sim.height) / 10000)));
    sim.stars = Array.from({ length: target }, () => ({
      x: Math.random() * sim.width,
      y: Math.random() * sim.height,
      r: 0.5 + Math.random() * 1.4,
      baseAlpha: 0.18 + Math.random() * 0.5,
      twinkleSpeed: 0.4 + Math.random(),
      phase: Math.random() * Math.PI * 2,
      driftX: prefersReducedMotion ? 0 : (Math.random() - 0.5) * 0.003,
      driftY: prefersReducedMotion ? 0 : (Math.random() - 0.5) * 0.003,
    }));
  }

  function spawnShootingStar() {
    if (prefersReducedMotion || !galaxyRunning || state.minimal) return;
    const startX = Math.random() * sim.width * 0.8;
    const startY = Math.random() * sim.height * 0.5;
    const speed = 0.9 + Math.random() * 0.7;
    sim.shooting = {
      x: startX,
      y: startY,
      vx: 0.95 * speed,
      vy: 0.55 * speed,
      length: 70 + Math.random() * 50,
      life: 0,
      ttl: 650 + Math.random() * 450,
    };
  }

  function scheduleShootingStar() {
    if (prefersReducedMotion || state.minimal) return;
    clearTimeout(sim.shootingTimer);
    const delay = 10000 + Math.random() * 15000;
    sim.shootingTimer = setTimeout(() => {
      spawnShootingStar();
      scheduleShootingStar();
    }, delay);
  }

  function update(dt, now) {
    const _frameBudgetExceeded = isIOSNative && dt > 32;
    sim._frameBudgetExceeded = _frameBudgetExceeded;
    updatePlasmaRechargeSound(now);
    const driftScale = prefersReducedMotion ? 0 : 1;
    for (let i = 0; i < sim.stars.length; i += 1) {
      const s = sim.stars[i];
      s.x += s.driftX * dt * driftScale;
      s.y += s.driftY * dt * driftScale;
      if (s.x < 0) s.x += sim.width;
      if (s.y < 0) s.y += sim.height;
      if (s.x > sim.width) s.x -= sim.width;
      if (s.y > sim.height) s.y -= sim.height;
    }

    if (engineMode === "arcade" && arcadeActive) {
      const cfg = ARCADE_LEVELS[currentLevelIndex];
      // 2026-06-10: an active freeze pauses the level clock — shift every time anchor by dt
      // each frozen frame so remaining/elapsed (and the perimeter line) hold their position.
      const frozenNow = now < freezeUntil;
      if (frozenNow) {
        levelEndsAt += dt;
        levelRunStartAt += dt;
        if (Number.isFinite(nextSpawnAt)) nextSpawnAt += dt;
      } else if (_freezeWasActive) {
        playGameSfx("unfreeze", 0.85); // freeze just lapsed — movement resumes this frame
      }
      _freezeWasActive = frozenNow;
      const remainingMs = levelEndsAt - now;
      updateArcadeHud(now);

      if (remainingMs <= 0) {
        arcadeActive = false;
        stopWarningState();
        if (arcadeLives > 0 && !retryPending) {
          promptRetryOrGameOver();
        } else if (!retryPending) {
          triggerGameOver();
        }
      }

      if (arcadeActive && now >= arcadePausedUntil) {
        if (cfg.spawnEveryMs > 0 && spawnQueue > 0 && now >= nextSpawnAt) {
          if (sim.asteroids.length < maxOnScreen) {
            const p = randomPerimeterPoint();
            spawnAsteroid(p.x, p.y, 3, true);
            spawnQueue -= 1;
            spawnedTotal += 1;
            nextSpawnAt += cfg.spawnEveryMs;
          } else {
            nextSpawnAt = now + 180;
          }
        }

        // Keep gameplay visually alive between stagger waves.
        if (cfg.spawnEveryMs > 0 && spawnQueue > 0 && sim.asteroids.length === 0) {
          const p = randomPerimeterPoint();
          spawnAsteroid(p.x, p.y, 3, true);
          spawnQueue -= 1;
          spawnedTotal += 1;
          nextSpawnAt = Math.max(nextSpawnAt, now + Math.max(350, cfg.spawnEveryMs));
        }

        const elapsedMs = Math.max(0, now - levelRunStartAt);
        const levelRemainingMs = levelDurationMs - elapsedMs;
        if (!_timerWarnedAt60 && levelRemainingMs <= 20000
            && levelRemainingMs > 0 && engineMode === "arcade") {
          _timerWarnedAt60 = true;
          commBoxController.setDamageState("light");
          commBoxController.queueVO({
            audioSrc: commBoxController.commVoSrc(
              commBoxController.pickFromPool("lowlives", commBoxController.POOL_LOW_LIVES),
            ),
            event: "lowlives",
            priority: "high",
          });
        }

        if (!_timerWarnedAt10 && levelRemainingMs <= 10000
            && levelRemainingMs > 0 && engineMode === "arcade") {
          _timerWarnedAt10 = true;
          commBoxController.setDamageState("heavy");
          commBoxController.queueVO({
            audioSrc: commBoxController.commVoSrc("vo-hairytakeemout.mp3"),
            event: "chaos",
          });
        }

        if (!landmineSpawnedThisLevel && levelHasLandmine(cfg.level) && elapsedMs >= levelDurationMs / 2) {
          spawnLandmine();
          landmineSpawnedThisLevel = true;
        }

        // 2026-06-10: periodically spawn a collectible powerup (weighted random type).
        // Progressive introduction — no powerups before level 4. Spawn zone keeps clear of
        // the top HUD (140px) and the commander portrait/comm box (160px).
        // DEBUG: revert before release — gate is normally cfg.level >= 4
        if (powerups.length < POWERUP_MAX_ONSCREEN && cfg.level >= 1 && now >= nextBombPowerupAt) {
          powerups.push({
            type: pickPowerupType(),
            x: 80 + Math.random() * Math.max(1, sim.width - 160),
            y: 140 + Math.random() * Math.max(1, sim.height - 300),
            r: 22,
            spawnedAt: now,
            opacity: 1.0,
          });
          playGameSfx("blip", 0.8);
          nextBombPowerupAt = now + BOMB_POWERUP_INTERVAL_MIN
            + Math.random() * (BOMB_POWERUP_INTERVAL_MAX - BOMB_POWERUP_INTERVAL_MIN);
        }
        // expire after lifetime (powerup expiry keeps running even during a snowflake freeze)
        for (let pi = powerups.length - 1; pi >= 0; pi -= 1) {
          if (now - powerups[pi].spawnedAt > BOMB_POWERUP_LIFETIME_MS) powerups.splice(pi, 1);
        }
        // DEBUG: revert before release — force a goldbars spawn in the level's final 15s
        // (once per level, normal margins) so the gold pickup is easy to test.
        if (!goldbarsForceSpawnedThisLevel && levelRemainingMs <= 15000 && levelRemainingMs > 0
            && !powerups.some((p) => p.type === "goldbars")) {
          goldbarsForceSpawnedThisLevel = true;
          powerups.push({
            type: "goldbars",
            x: 80 + Math.random() * Math.max(1, sim.width - 160),
            y: 140 + Math.random() * Math.max(1, sim.height - 300),
            r: 22,
            spawnedAt: now,
            opacity: 1.0,
          });
          playGameSfx("blip", 0.8);
        }
        updateHudQuadBadge();
      }

      if (!ufo && arcadeUfoSpawnAt && now >= arcadeUfoSpawnAt && now >= arcadePausedUntil) {
        spawnUfo();
        arcadeUfoSpawnAt = 0;
      }

      if (spawnQueue === 0 && spawnedTotal >= totalToSpawn && sim.asteroids.length === 0) {
        levelComplete();
      }

      if (engineMode === "arcade"
          && sim.asteroids.length >= CHAOS_THRESHOLD
          && now - (sim._lastChaosTrigger || 0) > 45000) {
        sim._lastChaosTrigger = now;
        commBoxController.reactTo("chaos");
        window.galaxyBackground?.setHectic(true);
        setTimeout(() => window.galaxyBackground?.setHectic(false), 5000);
        commBoxController.queueVO({
          audioSrc: commBoxController.commVoSrc("vo-hairytakeemout.mp3"),
          event: "chaos",
        });
      }
    }

    const gameplayAllowed = engineMode === "practice" || (engineMode === "arcade" && arcadeActive && now >= arcadePausedUntil);
    if (gameplayAllowed) {
      const now_s = performance.now();
      for (let si = _bombShrapnel.length - 1; si >= 0; si -= 1) {
        const sh = _bombShrapnel[si];
        const age = now_s - sh.startedAt;
        const dt_s = 1 / 60;
        sh.x += sh.vx * dt_s;
        sh.y += sh.vy * dt_s;
        sh.life = age;

        if (!sh.hit || sh.isPulse) {
          for (let ai = sim.asteroids.length - 1; ai >= 0; ai -= 1) {
            const a = sim.asteroids[ai];
            // 2026-06-10: only damage asteroids that existed at the detonation moment —
            // shrapnel lingers ~2s and was destroying asteroids spawned after the blast.
            if ((a.spawnedAtMs || 0) > sh.startedAt) continue;
            // 2026-06-10: track already-hit asteroids by object ref, not array index
            // (indices shift as asteroids are removed, so index tracking hit wrong ones).
            if (sh.hitSet && sh.hitSet.has(a)) continue;
            const dx = a.x - sh.x;
            const dy = a.y - sh.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const hitRadius = sh.isPulse
              ? a.r + sh.r * 3.5
              : a.r + sh.r * 1.8;
            if (dist < hitRadius) {
              if (sh.isPulse) {
                if (!sh.hitSet) sh.hitSet = new Set();
                sh.hitSet.add(a);
              } else {
                sh.hit = true;
              }
              spawnExplosion(a.x, a.y, a.kind === 3 ? 16 : 10, false, 1.2, 1, a.kind, a.spriteKey);
              cssShake(0.4);
              playAsteroidExplosionBoom(a.kind, 0.7, 1.0);
              const idx = sim.asteroids.indexOf(a);
              if (idx >= 0) {
                vaporizeAsteroidByIndex(idx);
              }
              if (!sh.isPulse) break;
            }
          }
        }

        if (age > sh.ttl || (sh.hit && age > 200)) {
          _bombShrapnel.splice(si, 1);
        }
      }

      // 2026-06-10: snowflake freeze — entity positions hold but rotation keeps running.
      // Firing, the level timer, and powerup expiry are deliberately not frozen.
      const simFrozen = now < freezeUntil;
      for (let i = 0; i < sim.asteroids.length; i += 1) {
        const a = sim.asteroids[i];
        // 2026-06-11: a tossed (flaming) stroid is NEVER held — held and tossed are mutually
        // exclusive states. Clear any stray held flag so a tossed stroid can never be pinned in
        // place (this was the flaming-stroid-stuck-at-edge bug). Only a non-tossed stroid that
        // is the current grab target stays pinned; any other stray held flag is cleared too.
        if (a.tossed) {
          a._stroidHeld = false;
        } else if (a._stroidHeld) {
          if (a === stroidToss.asteroid) {
            a.vx = 0;
            a.vy = 0;
            continue;
          }
          a._stroidHeld = false;
        }
        a.rot += a.spin * (dt / 16);
        // 2026-06-11: a tossed stroid keeps flying during a freeze (player action) — you can
        // hurl one through the frozen field and shatter it. Only idle drift is frozen.
        if (simFrozen && !a.tossed) continue;
        a.x += a.vx * (dt / 1000);
        a.y += a.vy * (dt / 1000);
        if (engineMode === "practice") wrapEntityToCanvas(a);
        else wrapEntity(a);
        // 2026-06-12: a tossed stroid keeps its launch velocity untouched — no clampSpeed, no
        // speed floor. The old floor re-pointed a slowed toss in a RANDOM direction at 180px/s,
        // which turned an upward toss into a slow sideways drift that never climbed far enough
        // to wrap (the "stuck at the top, won't wrap" bug). Restoring the baseline behaviour
        // (fast, straight flight) makes it wrap cleanly; the short self-destruct timeout is what
        // now guarantees a toss can never linger.
        if (!a.tossed) clampSpeed(a);
        applyMotionHealth(a, now);
      }
      updateStroidTossHold(now);
      updateTossedAsteroidCollision(now);
      stepFlameTrail(dt, now);
      if (!simFrozen) resolveAsteroidCollisions();

      if (landmine) {
        if (updateMineEntity(landmine, dt, now, (opts) => explodeLandmine(opts), { quietArm: false, frozen: simFrozen })) {
          return;
        }
      }
      // 2026-06-10: player-placed bombs run the exact same physics/phase logic; iterate
      // backwards because an explosion splices the array. quietArm skips the commander VO
      // (three placed bombs auto-arming would spam it) — the arm sfx still plays.
      for (let bi = placedBombs.length - 1; bi >= 0; bi -= 1) {
        const bomb = placedBombs[bi];
        updateMineEntity(bomb, dt, now, (opts) => explodePlacedBomb(bomb, opts), { quietArm: true, frozen: simFrozen });
      }

      if (ufo && ufo.alive) {
        if (now >= ufo.despawnAt) {
          stopUfoDrone();
          ufo = null;
        } else {
          // 2026-06-10: snowflake freeze holds the UFO too (movement, teleport, shoves);
          // the despawn timer above keeps running.
          if (!simFrozen) {
            ufo.x += ufo.vx * (dt / 1000);
            ufo.y += ufo.vy * (dt / 1000);
            wrapEntity(ufo);
            clampSpeed(ufo);
            applyMotionHealth(ufo, now);
            if (now >= ufo.teleportAt) {
              ufo.x = playfield.x + playfield.w * (0.1 + Math.random() * 0.8);
              ufo.y = playfield.y + playfield.h * (0.1 + Math.random() * 0.8);
              ufo.teleportAt = now + (900 + Math.random() * 500);
              playGameSfx("ufo_teleport", 0.62);
              addWarpRing(ufo.x, ufo.y, "rgba(160,255,255,0.9)");
            }
            for (let i = 0; i < sim.asteroids.length; i += 1) {
              resolveCircleCollision(ufo, sim.asteroids[i], 0.92, false);
            }
          }
          if (ufo.hitCount >= 1 && !prefersReducedMotion && now - ufo.damagedAt < 20000 && Math.random() < 0.2) {
            const p = getParticle();
            p.x = ufo.x + (Math.random() - 0.5) * 8;
            p.y = ufo.y + (Math.random() - 0.5) * 8;
            p.vx = (Math.random() - 0.5) * 18;
            p.vy = -14 - Math.random() * 16;
            p.life = 0;
            p.ttl = 460 + Math.random() * 240;
            p.size = 2 + Math.random() * 3;
            p.alpha = 0.34 + Math.random() * 0.2;
            p.color = "rgba(140,140,140,";
            sim.particles.push(p);
          }
        }
      }
    }

    for (let i = sim.particles.length - 1; i >= 0; i -= 1) {
      const p = sim.particles[i];
      p.life += dt;
      p.x += p.vx * (dt / 1000);
      p.y += p.vy * (dt / 1000);
      if (p.life >= p.ttl) {
        sim.particles[i] = sim.particles[sim.particles.length - 1];
        sim.particles.pop();
        releaseParticle(p);
      }
    }

    for (let i = sim.warpRings.length - 1; i >= 0; i -= 1) {
      const ring = sim.warpRings[i];
      ring.life += dt;
      if (ring.life >= ring.ttl) {
        sim.warpRings[i] = sim.warpRings[sim.warpRings.length - 1];
        sim.warpRings.pop();
        releaseRing(ring);
      }
    }
    for (let i = sim.lightningRings.length - 1; i >= 0; i -= 1) {
      const ring = sim.lightningRings[i];
      ring.life += dt;
      ring.spin += dt * 0.004;
      if (ring.life >= ring.ttl) {
        sim.lightningRings[i] = sim.lightningRings[sim.lightningRings.length - 1];
        sim.lightningRings.pop();
      }
    }

    if (sim.shooting) {
      sim.shooting.life += dt;
      sim.shooting.x += sim.shooting.vx * dt;
      sim.shooting.y += sim.shooting.vy * dt;
      if (sim.shooting.life >= sim.shooting.ttl) sim.shooting = null;
    }

    if (canvasFlash?.alpha > 0) {
      canvasFlash.alpha = Math.max(0, canvasFlash.alpha - canvasFlash.decayPerMs * dt);
    }

    effects.update(dt);
    draw(now);
  }

  // 2026-06-09: localized X blast that replaces the laser on iOS touch taps.
  function drawTapBlast(tctx, x, y, life) {
    // Layer 1 — radial flash (only while bright)
    if (life > 0.6) {
      const flashAlpha = (life - 0.6) / 0.4;
      const flashR = (1 - life) * 40 + 6;
      const grad = tctx.createRadialGradient(x, y, 0, x, y, flashR);
      grad.addColorStop(0, `rgba(160,255,230,${(flashAlpha * 0.9).toFixed(3)})`);
      grad.addColorStop(0.5, `rgba(0,255,200,${(flashAlpha * 0.4).toFixed(3)})`);
      grad.addColorStop(1, "rgba(0,200,160,0)");
      tctx.save();
      tctx.fillStyle = grad;
      tctx.beginPath();
      tctx.arc(x, y, flashR, 0, Math.PI * 2);
      tctx.fill();
      tctx.restore();
    }

    // Layer 2 — ghost X (outer, expands, low opacity)
    const ghostSize = 10 + (1 - life) * 14;
    tctx.save();
    tctx.globalAlpha = life * 0.18;
    tctx.strokeStyle = "#00ffcc";
    tctx.lineWidth = 6;
    tctx.beginPath();
    tctx.moveTo(x - ghostSize, y - ghostSize);
    tctx.lineTo(x + ghostSize, y + ghostSize);
    tctx.moveTo(x + ghostSize, y - ghostSize);
    tctx.lineTo(x - ghostSize, y + ghostSize);
    tctx.stroke();
    tctx.restore();

    // Layer 3 — main X (crisp teal)
    const size = 8 + (1 - life) * 5;
    tctx.save();
    tctx.globalAlpha = life * 0.95;
    tctx.strokeStyle = "#00ffcc";
    tctx.lineWidth = 2.5;
    tctx.lineCap = "round";
    tctx.beginPath();
    tctx.moveTo(x - size, y - size);
    tctx.lineTo(x + size, y + size);
    tctx.moveTo(x + size, y - size);
    tctx.lineTo(x - size, y + size);
    tctx.stroke();
    tctx.restore();

    // Layer 4 — tip sparks at the 4 arm tips of the main X
    const sparkR = Math.max(0, 1.8 * life);
    tctx.save();
    tctx.globalAlpha = life * 0.9;
    tctx.fillStyle = "#ffffff";
    const tips = [
      [x - size, y - size],
      [x + size, y - size],
      [x - size, y + size],
      [x + size, y + size],
    ];
    for (let i = 0; i < tips.length; i += 1) {
      tctx.beginPath();
      tctx.arc(tips[i][0], tips[i][1], sparkR, 0, Math.PI * 2);
      tctx.fill();
    }
    tctx.restore();
  }

  // Renders + advances active tap blasts. Called once per frame (only one render
  // path runs per frame). Targets the ufoFx overlay so it shows above the PIXI layer.
  function drawAndStepTapBlasts(tctx) {
    if (!tctx || tapBlasts.length === 0) return;
    for (let i = tapBlasts.length - 1; i >= 0; i -= 1) {
      const b = tapBlasts[i];
      drawTapBlast(tctx, b.x, b.y, b.life);
      b.life -= 0.055;
      if (b.life <= 0) tapBlasts.splice(i, 1);
    }
  }

  // 2026-06-11: spawn + advance the fire trail behind an in-flight tossed asteroid. Stepped
  // from update() (dt-based) so it never double-advances when draw() runs more than once.
  function stepFlameTrail(dt, now) {
    // 2026-06-11: trail EVERY in-flight tossed asteroid (multiple can be airborne at once).
    // While a freeze is active the trail is ice particles instead of flames; the colour is
    // fixed at spawn so a particle keeps its look as it fades.
    const frozen = now < freezeUntil;
    const palette = frozen ? FLAME_ICE_COLORS : FLAME_COLORS;
    for (let ai = 0; ai < sim.asteroids.length; ai += 1) {
      const tossed = sim.asteroids[ai];
      if (!tossed.tossed) continue;
      const speed = Math.hypot(tossed.vx, tossed.vy);
      if (speed < FLAME_MIN_SPEED) continue; // slow no-flick tosses fly cold (no flame trail)
      const nx = tossed.vx / speed;
      const ny = tossed.vy / speed;
      const count = 2 + (Math.random() < 0.5 ? 1 : 0); // 2-3 per frame
      for (let i = 0; i < count && flameTrail.length < FLAME_TRAIL_MAX; i += 1) {
        // emit at the trailing edge (opposite the velocity direction)
        const tx = tossed.x - nx * tossed.r;
        const ty = tossed.y - ny * tossed.r;
        flameTrail.push({
          x: tx + (Math.random() - 0.5) * tossed.r * 0.6,
          y: ty + (Math.random() - 0.5) * tossed.r * 0.6,
          vx: -nx * 24 + (Math.random() - 0.5) * 44, // drift back + slight scatter
          vy: -ny * 24 + (Math.random() - 0.5) * 44,
          life: 0,
          ttl: 240 + Math.random() * 140, // ~300ms
          r: 2 + Math.random() * 3,
          color: palette[(Math.random() * palette.length) | 0],
        });
      }
      // big fire-plume blobs — 2/frame, sized to the stroid, emitted close to its tail
      for (let i = 0; i < 2 && fireBlobs.length < FIRE_BLOB_MAX; i += 1) {
        const bx = tossed.x - nx * tossed.r * 0.8;
        const by = tossed.y - ny * tossed.r * 0.8;
        fireBlobs.push({
          x: bx + (Math.random() - 0.5) * tossed.r * 0.5,
          y: by + (Math.random() - 0.5) * tossed.r * 0.5,
          vx: -nx * 55 + (Math.random() - 0.5) * 36,
          vy: -ny * 55 + (Math.random() - 0.5) * 36,
          life: 0,
          ttl: 320 + Math.random() * 200,
          r: tossed.r * (0.7 + Math.random() * 0.5), // big, scaled to the stroid
          ice: frozen,
        });
      }
    }
    for (let i = flameTrail.length - 1; i >= 0; i -= 1) {
      const f = flameTrail[i];
      f.life += dt;
      f.x += f.vx * (dt / 1000);
      f.y += f.vy * (dt / 1000);
      if (f.life >= f.ttl) flameTrail.splice(i, 1);
    }
    for (let i = fireBlobs.length - 1; i >= 0; i -= 1) {
      const f = fireBlobs[i];
      f.life += dt;
      f.x += f.vx * (dt / 1000);
      f.y += f.vy * (dt / 1000);
      if (f.life >= f.ttl) fireBlobs.splice(i, 1);
    }
  }

  // 2026-06-11: the big fire plume + a heat tint over each airborne tossed stroid. Additive
  // ("lighter") compositing makes overlapping warm blobs read as continuous flame, and 3
  // concentric fills per blob fake a flame gradient cheaply (no per-particle radial gradients,
  // which are costly on iOS). Ices over to a cool cyan glow while a freeze is active.
  function drawTossedFireFx(tctx) {
    if (!tctx) return;
    const nowF = performance.now();
    const frozen = nowF < freezeUntil;
    tctx.save();
    tctx.globalCompositeOperation = "lighter";
    // plume blobs (drawn first so they sit behind the stroid)
    for (let i = 0; i < fireBlobs.length; i += 1) {
      const f = fireBlobs[i];
      const k = Math.max(0, 1 - f.life / f.ttl);
      const r = f.r * (0.35 + k * 0.65); // shrink as it fades → the plume tapers
      if (f.ice) {
        tctx.globalAlpha = k * 0.42; tctx.fillStyle = "rgba(120,200,255,1)"; fillCircle(tctx, f.x, f.y, r);
        tctx.globalAlpha = k * 0.5; tctx.fillStyle = "rgba(190,235,255,1)"; fillCircle(tctx, f.x, f.y, r * 0.55);
        tctx.globalAlpha = k * 0.55; tctx.fillStyle = "rgba(235,250,255,1)"; fillCircle(tctx, f.x, f.y, r * 0.28);
      } else {
        tctx.globalAlpha = k * 0.4; tctx.fillStyle = "rgba(255,60,0,1)"; fillCircle(tctx, f.x, f.y, r);
        tctx.globalAlpha = k * 0.5; tctx.fillStyle = "rgba(255,160,0,1)"; fillCircle(tctx, f.x, f.y, r * 0.58);
        tctx.globalAlpha = k * 0.6; tctx.fillStyle = "rgba(255,240,180,1)"; fillCircle(tctx, f.x, f.y, r * 0.3);
      }
    }
    // heat tint over the whole stroid (the freeze overlay already ice-tints frozen stroids)
    if (!frozen) {
      for (let i = 0; i < sim.asteroids.length; i += 1) {
        const a = sim.asteroids[i];
        if (!a.tossed) continue;
        if (Math.hypot(a.vx, a.vy) < FLAME_MIN_SPEED) continue; // slow no-flick tosses stay cold
        const flick = 0.22 + 0.12 * Math.abs(Math.sin(nowF / 60 + a.x * 0.05));
        tctx.globalAlpha = flick; tctx.fillStyle = "rgba(255,80,0,1)"; fillCircle(tctx, a.x, a.y, a.r * 1.2);
        tctx.globalAlpha = flick * 1.1; tctx.fillStyle = "rgba(255,180,40,1)"; fillCircle(tctx, a.x, a.y, a.r * 0.7);
      }
    }
    tctx.restore();
  }

  function fillCircle(tctx, x, y, r) {
    tctx.beginPath();
    tctx.arc(x, y, r, 0, Math.PI * 2);
    tctx.fill();
  }

  // 2026-06-11: render the flame trail on the ufoFx overlay (advance happens in stepFlameTrail).
  function drawFlameTrail(tctx) {
    if (!tctx || flameTrail.length === 0) return;
    tctx.save();
    for (let i = 0; i < flameTrail.length; i += 1) {
      const f = flameTrail[i];
      const k = Math.max(0, 1 - f.life / f.ttl); // 1 → 0 fade
      tctx.globalAlpha = k * 0.9;
      tctx.fillStyle = `rgba(${f.color},1)`;
      tctx.beginPath();
      tctx.arc(f.x, f.y, f.r * (0.5 + k * 0.5), 0, Math.PI * 2);
      tctx.fill();
    }
    tctx.restore();
  }

  // 2026-06-10: draw all collectible powerups. Timer/goldbars/quadshot/snowflake render
  // their sprite (baked-in glow); bomb keeps the canvas-drawn ring + glyph. Rendered on the
  // ufoFx overlay (like the tap blasts) so they show above the PIXI layer. Expiry is handled
  // in update(). In the final 3s the powerup blinks red (~3 blinks/sec) to warn the player.
  function drawPowerups(tctx) {
    if (!tctx || powerups.length === 0) return;
    const nowP = performance.now();
    for (let i = 0; i < powerups.length; i += 1) {
      const pu = powerups[i];
      const remaining = BOMB_POWERUP_LIFETIME_MS - (nowP - pu.spawnedAt);
      const opacity = remaining < 500 ? Math.max(0, remaining / 500) : 1.0;
      // quadshot pulses slightly harder than the rest so it still stands out (was a spin)
      const pulse = pu.type === "quadshot"
        ? 0.92 + 0.08 * Math.sin(nowP / 250)
        : 0.95 + 0.05 * Math.sin(nowP / 300);
      const blinkRed = remaining < 3000 && Math.floor(nowP / 167) % 2 === 0;
      tctx.save();
      tctx.globalAlpha = opacity;
      tctx.translate(pu.x, pu.y);
      tctx.scale(pulse, pulse);
      const sprite = powerupSprites[pu.type];
      if (pu.type !== "bomb" && sprite && sprite.complete && sprite.naturalWidth > 0) {
        tctx.drawImage(
          sprite,
          -POWERUP_SPRITE_SIZE / 2,
          -POWERUP_SPRITE_SIZE / 2,
          POWERUP_SPRITE_SIZE,
          POWERUP_SPRITE_SIZE,
        );
        if (blinkRed) {
          // red warning tint over the sprite — normal compositing; multiply would also
          // darken whatever the overlay already drew underneath the circle
          tctx.fillStyle = "rgba(255,51,51,0.38)";
          tctx.beginPath();
          tctx.arc(0, 0, POWERUP_SPRITE_SIZE / 2, 0, Math.PI * 2);
          tctx.fill();
        }
        tctx.restore();
        continue;
      }
      // bomb look — also the fallback ring for the first frames while a sprite decodes
      const baseColor = POWERUP_COLORS[pu.type] || "#00ffcc";
      const ringColor = blinkRed ? "#ff3333" : baseColor;
      // outer glow ring
      tctx.beginPath();
      tctx.arc(0, 0, pu.r, 0, Math.PI * 2);
      tctx.strokeStyle = ringColor;
      tctx.lineWidth = 2;
      tctx.shadowColor = ringColor;
      tctx.shadowBlur = 12;
      tctx.stroke();
      // inner fill
      tctx.beginPath();
      tctx.arc(0, 0, pu.r - 3, 0, Math.PI * 2);
      tctx.fillStyle = "rgba(0,30,30,0.7)";
      tctx.fill();
      if (pu.type === "bomb") {
        tctx.shadowBlur = 0;
        tctx.textAlign = "center";
        tctx.textBaseline = "middle";
        tctx.font = "18px sans-serif";
        tctx.fillStyle = "#ffffff";
        tctx.fillText("\u{1F4A3}", 0, 0);
      }
      tctx.restore();
    }
  }

  // 2026-06-10: snowflake freeze visual — translucent ice tint over the playfield. Drawn on
  // the overlay because asteroids render through PIXI on device (the 2D multiply-tint path
  // never runs there), so tinting individual asteroids isn't reliable.
  function drawFreezeOverlay(tctx) {
    if (!tctx || performance.now() >= freezeUntil) return;
    tctx.save();
    tctx.fillStyle = "rgba(136,221,255,0.12)";
    tctx.fillRect(0, 0, sim.width, sim.height);
    // ice casing per asteroid — drawn here (not via PIXI tint) for the same reason as the
    // playfield tint above: the 2D multiply-tint path never runs on device.
    tctx.fillStyle = "rgba(136,221,255,0.35)";
    for (let i = 0; i < sim.asteroids.length; i += 1) {
      const a = sim.asteroids[i];
      tctx.beginPath();
      tctx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
      tctx.fill();
    }
    tctx.restore();
  }

  // 2026-06-09: red depleting countdown ring around an auto-armed landmine. Drawn on the
  // ufoFx overlay so it shows over the PIXI layer (PIXI only draws the player_armed ring).
  function drawLandmineCountdownOverlay(tctx) {
    if (!tctx || !landmine || landmine.phase !== "armed" || !landmine.armedAt) return;
    const now = performance.now();
    const progress = Math.max(0, 1 - (now - landmine.armedAt) / LANDMINE_FUSE_MS);
    tctx.save();
    tctx.beginPath();
    tctx.arc(landmine.x, landmine.y, (landmine.r || 14) + 5, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
    tctx.strokeStyle = "#ff2222";
    tctx.lineWidth = 2.5;
    tctx.stroke();
    tctx.restore();
  }

  // 2026-06-10: player-placed bombs are drawn on the ufoFx overlay (PIXI only knows the
  // single level landmine). Same visual language: hull, phase-colored pulsing ring, blink
  // light, and the armed/player_armed countdown rings.
  function drawPlacedBombsOverlay(tctx) {
    if (!tctx || placedBombs.length === 0) return;
    const now = performance.now();
    for (let i = 0; i < placedBombs.length; i += 1) {
      const mine = placedBombs[i];
      const r = mine.r || 14;
      const armed = mine.phase === "armed" || mine.phase === "player_armed";
      const playerArmed = mine.phase === "player_armed";
      const pulseRate = playerArmed ? 80 : armed ? 120 : 400;
      const pulse = Math.abs(Math.sin(now / pulseRate));
      tctx.save();
      tctx.translate(mine.x, mine.y);
      // hull
      const hull = tctx.createRadialGradient(-r * 0.35, -r * 0.35, 2, 0, 0, r * 1.15);
      hull.addColorStop(0, armed ? "rgba(92,44,44,0.98)" : "rgba(56,58,66,0.98)");
      hull.addColorStop(0.6, armed ? "rgba(38,28,28,0.98)" : "rgba(26,30,40,0.98)");
      hull.addColorStop(1, "rgba(12,16,24,0.98)");
      tctx.beginPath();
      tctx.arc(0, 0, r, 0, Math.PI * 2);
      tctx.fillStyle = hull;
      tctx.fill();
      // phase ring
      tctx.strokeStyle = playerArmed
        ? `rgba(255,0,0,${(0.55 + pulse * 0.3).toFixed(3)})`
        : armed
          ? `rgba(255,68,68,${(0.55 + pulse * 0.3).toFixed(3)})`
          : `rgba(68,255,136,${(0.55 + pulse * 0.3).toFixed(3)})`;
      tctx.lineWidth = 1.4;
      tctx.stroke();
      // blink light
      const blink = Math.sin(now / 120) > 0 ? 1 : 0;
      tctx.beginPath();
      tctx.arc(r * 0.35, -r * 0.35, (armed ? 4 + pulse * 2 : 3 + pulse), 0, Math.PI * 2);
      tctx.fillStyle = armed
        ? `rgba(255,80,80,${(0.6 + 0.4 * blink).toFixed(3)})`
        : `rgba(124,255,91,${(0.5 + 0.5 * blink).toFixed(3)})`;
      tctx.fill();
      tctx.restore();
      // countdown rings (drawn unrotated/untranslated like the landmine's)
      if (mine.phase === "armed" && mine.armedAt) {
        const progress = Math.max(0, 1 - (now - mine.armedAt) / LANDMINE_FUSE_MS);
        tctx.save();
        tctx.beginPath();
        tctx.arc(mine.x, mine.y, r + 5, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
        tctx.strokeStyle = "#ff2222";
        tctx.lineWidth = 2.5;
        tctx.stroke();
        tctx.restore();
      } else if (playerArmed && mine.playerArmedAt) {
        const countT = Math.max(0, Math.min(1, (now - mine.playerArmedAt) / 6000));
        tctx.save();
        tctx.beginPath();
        tctx.arc(mine.x, mine.y, r + 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * countT);
        tctx.strokeStyle = "rgba(255,34,34,0.8)";
        tctx.lineWidth = 2;
        tctx.stroke();
        tctx.restore();
      }
    }
  }

  function draw(now) {
    drawTimerPerimeterOverlay(now);
    if ((engineMode === "arcade" || engineMode === "practice") && window.pixiRenderer?.draw(sim, laserBeams, canvasFlash, ufo, plasmaCage, landmine, _bombShrapnel, now)) {
      setPlasmaOverlayVisible(stroidToss.active);
      if (stroidToss.active) drawPlasmaOverlay(now);
      drawUfoFxOverlay(ctx);
      drawTossedFireFx(ufoFxCtx || ctx);
      drawFlameTrail(ufoFxCtx || ctx);
      drawPowerups(ufoFxCtx || ctx);
      drawLandmineCountdownOverlay(ufoFxCtx || ctx);
      drawPlacedBombsOverlay(ufoFxCtx || ctx);
      drawFreezeOverlay(ufoFxCtx || ctx);
      drawAndStepTapBlasts(ufoFxCtx || ctx);
      return;
    }
    setPlasmaOverlayVisible(true);

    const _frameBudgetExceeded = !!sim._frameBudgetExceeded;
    ctx.clearRect(0, 0, sim.width, sim.height);

    if (engineMode === "practice" && practiceTapMarker) {
      const age = now - practiceTapMarker.t;
      if (age > 450) {
        practiceTapMarker = null;
      } else {
        ctx.save();
        ctx.globalAlpha = 1 - (age / 450);
        ctx.beginPath();
        ctx.arc(practiceTapMarker.x, practiceTapMarker.y, 10, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(190,120,255,0.9)";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }
    }

    if (debugDots.length) {
      debugDots = debugDots.filter((d) => now - d.t < 450);
      for (let i = 0; i < debugDots.length; i += 1) {
        const d = debugDots[i];
        ctx.beginPath();
        ctx.arc(d.x, d.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(190,120,255,0.9)";
        ctx.fill();
      }
    }

    if (!prefersReducedMotion && !_frameBudgetExceeded) {
      sim._starFrame = ((sim._starFrame || 0) + 1) & 3;
      if (sim._starFrame === 0) {
        for (let i = 0; i < sim.stars.length; i += 1) {
          const s = sim.stars[i];
          s._cachedAlpha = Math.max(0.08, Math.min(0.9, s.baseAlpha + Math.sin(now * 0.001 * s.twinkleSpeed + s.phase) * 0.2));
        }
      }
    }
    if (!_frameBudgetExceeded) {
      for (let i = 0; i < sim.stars.length; i += 1) {
        const s = sim.stars[i];
        const alpha = prefersReducedMotion ? s.baseAlpha : (s._cachedAlpha ?? s.baseAlpha);
        ctx.beginPath();
        ctx.fillStyle = `rgba(214,227,255,${alpha.toFixed(3)})`;
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const _plasmaActive = plasmaCage.active;
    const _plasmaRect = _plasmaActive ? getPlasmaRect() : null;
    const _plasmaCharge = _plasmaActive ? clamp((now - plasmaCage.chargeStart) / PLASMA_CAGE_CHARGE_MS, 0, 1) : 0;
    const _plasmaCharged = _plasmaActive && isPlasmaCageReady(now);
    const _levelNum = engineMode === "arcade" ? (ARCADE_LEVELS[currentLevelIndex]?.level || 1) : 1;
    const _plasmaGlowAsteroids = [];

    for (let i = 0; i < sim.asteroids.length; i += 1) {
      const a = sim.asteroids[i];
      const sprite = asteroidSprites[a.spriteKey] || getAsteroidSpriteForLevel(_levelNum);
      if (sprite && sprite.complete && sprite.naturalWidth > 0) {
        const d = a.r * 2;
        ctx.save();
        ctx.translate(a.x, a.y);
        ctx.rotate(a.rot);
        ctx.drawImage(sprite, -a.r, -a.r, d, d);
        ctx.restore();
        const _tint = getAsteroidTintForLevel(_levelNum);
        if (_tint) {
          ctx.save();
          ctx.globalCompositeOperation = "multiply";
          ctx.fillStyle = _tint;
          ctx.beginPath();
          ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      } else {
        ctx.beginPath();
        for (let j = 0; j < a.shape.length; j += 1) {
          const point = a.shape[j];
          const px = a.x + Math.cos(point.angle + a.rot) * a.r * point.offset;
          const py = a.y + Math.sin(point.angle + a.rot) * a.r * point.offset;
          if (j === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        const fill = a.kind === 3 ? "rgba(145,106,68,0.82)" : a.kind === 2 ? "rgba(126,92,61,0.82)" : "rgba(112,84,58,0.82)";
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.strokeStyle = "rgba(246,220,184,0.2)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      if (_plasmaCharged && _plasmaRect
          && a.x >= _plasmaRect.x && a.x <= _plasmaRect.x + _plasmaRect.w
          && a.y >= _plasmaRect.y && a.y <= _plasmaRect.y + _plasmaRect.h) {
        _plasmaGlowAsteroids.push(a);
      }
    }

    if (_plasmaGlowAsteroids.length > 0) {
      ctx.save();
      ctx.strokeStyle = "rgba(0,255,209,1)";
      ctx.globalAlpha = _plasmaCharge * 0.28;
      ctx.lineWidth = 7;
      for (let i = 0; i < _plasmaGlowAsteroids.length; i += 1) {
        const a = _plasmaGlowAsteroids[i];
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.r + 7, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = _plasmaCharge * 0.85;
      ctx.lineWidth = 1.5;
      for (let i = 0; i < _plasmaGlowAsteroids.length; i += 1) {
        const a = _plasmaGlowAsteroids[i];
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.r + 5, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    if (!window.pixiRenderer && landmine) {
      ctx.save();
      ctx.translate(landmine.x, landmine.y);
      const armed = landmine.phase === "armed" || landmine.phase === "player_armed";
      const playerArmed = landmine.phase === "player_armed";
      const pulseRate = playerArmed ? 80 : armed ? 120 : 400;
      const pulse = Math.abs(Math.sin(now / pulseRate));
      const hullGradient = ctx.createRadialGradient(-landmine.r * 0.35, -landmine.r * 0.35, 2, 0, 0, landmine.r * 1.15);
      hullGradient.addColorStop(0, armed ? "rgba(92,44,44,0.98)" : "rgba(56,58,66,0.98)");
      hullGradient.addColorStop(0.6, armed ? "rgba(38,28,28,0.98)" : "rgba(26,30,40,0.98)");
      hullGradient.addColorStop(1, "rgba(12,16,24,0.98)");
      ctx.beginPath();
      ctx.arc(0, 0, landmine.r, 0, Math.PI * 2);
      ctx.fillStyle = hullGradient;
      ctx.fill();
      ctx.strokeStyle = armed ? "rgba(255,90,90,0.4)" : "rgba(255,255,255,0.16)";
      ctx.stroke();

      const blink = Math.sin(now / 120) > 0 ? 1 : 0;
      const lightColor = armed
        ? `rgba(255,80,80,${0.6 + 0.4 * blink})`
        : `rgba(255,220,80,${0.5 + 0.5 * blink})`;

      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(230,238,255,0.16)";
      for (let i = 0; i < 4; i += 1) {
        const ang = (Math.PI * 2 * i) / 4 + now * 0.0002;
        const x1 = Math.cos(ang) * (landmine.r * 0.25);
        const y1 = Math.sin(ang) * (landmine.r * 0.25);
        const x2 = Math.cos(ang) * (landmine.r * 0.85);
        const y2 = Math.sin(ang) * (landmine.r * 0.85);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      ctx.fillStyle = "rgba(30,36,48,0.95)";
      for (let i = 0; i < 6; i += 1) {
        const ang = (Math.PI * 2 * i) / 6 + 0.35;
        const bx = Math.cos(ang) * (landmine.r * 0.68);
        const by = Math.sin(ang) * (landmine.r * 0.68);
        ctx.beginPath();
        ctx.arc(bx, by, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(landmine.r * 0.35, -landmine.r * 0.35, 4 + 2 * pulse, 0, Math.PI * 2);
      ctx.fillStyle = lightColor;
      ctx.fill();

      if (playerArmed && landmine.playerArmedAt) {
        const countT = Math.max(0, Math.min(1, (now - landmine.playerArmedAt) / 6000));
        ctx.beginPath();
        ctx.arc(0, 0, landmine.r + 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * countT);
        ctx.strokeStyle = "rgba(255,34,34,0.8)";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.restore();
    }

    if (ufo && ufo.alive) {
      ctx.save();
      const damaged = ufo.hitCount >= 1;
      const shakeX = ufo.hitCount >= 1 ? Math.sin(now / 28) * 1.8 : 0;
      const shakeY = ufo.hitCount >= 1 ? Math.cos(now / 24) * 1.5 : 0;
      ctx.translate(ufo.x + shakeX, ufo.y + shakeY);

      // Restored UFO halo/glow pass for clearer presence on iOS and desktop.
      const glowGrad = ctx.createRadialGradient(0, 0, ufo.r * 0.2, 0, 0, ufo.r * (damaged ? 2.2 : 2.6));
      if (damaged) {
        glowGrad.addColorStop(0, "rgba(255,96,96,0.34)");
        glowGrad.addColorStop(0.65, "rgba(255,96,96,0.12)");
        glowGrad.addColorStop(1, "rgba(255,96,96,0)");
      } else {
        glowGrad.addColorStop(0, "rgba(134,255,176,0.32)");
        glowGrad.addColorStop(0.3, "rgba(114,245,166,0.22)");
        glowGrad.addColorStop(0.55, "rgba(94,235,148,0.12)");
        glowGrad.addColorStop(0.78, "rgba(94,235,148,0.04)");
        glowGrad.addColorStop(1, "rgba(94,235,148,0)");
      }
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(0, 0, ufo.r * (damaged ? 2.2 : 2.6), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";

      ctx.strokeStyle = damaged ? "rgba(255,124,124,0.55)" : "rgba(156,255,194,0.58)";
      ctx.lineWidth = 1.4;
      if (!isIOSNative) {
        ctx.shadowBlur = prefersReducedMotion ? 0 : 14;
        ctx.shadowColor = damaged ? "rgba(255,110,110,0.75)" : "rgba(112,245,166,0.8)";
      }
      ctx.beginPath();
      ctx.ellipse(0, 0, ufo.r * 1.32, ufo.r * 0.72, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.fillStyle = damaged ? "rgba(255,96,96,0.94)" : "rgba(154,235,255,0.92)";
      ctx.beginPath();
      ctx.ellipse(0, 0, ufo.r * 1.1, ufo.r * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      if (!damaged) {
        // Add green energy tint onto the UFO skin itself.
        const skinGlow = ctx.createRadialGradient(0, 0, ufo.r * 0.08, 0, 0, ufo.r * 1.2);
        skinGlow.addColorStop(0, "rgba(198,255,214,0.34)");
        skinGlow.addColorStop(0.5, "rgba(128,245,166,0.2)");
        skinGlow.addColorStop(1, "rgba(96,235,148,0)");
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = skinGlow;
        ctx.beginPath();
        ctx.ellipse(0, 0, ufo.r * 1.1, ufo.r * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";
      }
      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.lineWidth = 1.3;
      ctx.stroke();
      ctx.fillStyle = "rgba(36,42,72,0.86)";
      ctx.beginPath();
      ctx.ellipse(0, -ufo.r * 0.22, ufo.r * 0.52, ufo.r * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (!_frameBudgetExceeded) {
      for (let i = 0; i < sim.warpRings.length; i += 1) {
        const ring = sim.warpRings[i];
        const t = ring.life / ring.ttl;
        const radius = ring.baseR + (ring.maxR - ring.baseR) * t;
        const alpha = ring.alpha * (1 - t);
        const base = ring.color || "rgba(112,255,178,1)";
        ctx.beginPath();
        ctx.strokeStyle = base.replace(/[\d.]+\)$/u, `${Math.max(0, alpha).toFixed(3)})`);
        ctx.lineWidth = prefersReducedMotion ? 1.2 : 1.8;
        ctx.arc(ring.x, ring.y, radius, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    for (let i = 0; i < sim.lightningRings.length; i += 1) {
      const ring = sim.lightningRings[i];
      const t = ring.life / ring.ttl;
      const alpha = 1 - t;
      const radius = ring.radius + t * 24;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.lineWidth = ring.thickness + (1 - t) * 1.8;
      if (!isIOSNative) {
        ctx.shadowBlur = 18;
        ctx.shadowColor = ring.glow.replace(/[\d.]+\)$/u, `${(0.9 * alpha).toFixed(3)})`);
      }
      ctx.strokeStyle = ring.colorA.replace(/[\d.]+\)$/u, `${(0.95 * alpha).toFixed(3)})`);
      const seed = ((ring.life * 0.03) | 0) % 997;
      for (let j = 0; j < ring.arcCount; j += 1) {
        const a0 = ring.spin + (j / ring.arcCount) * Math.PI * 2;
        const arcLen = 0.16 + (((seed + j * 17) % 100) / 100) * 0.18;
        const a1 = a0 + arcLen;
        const n0 = Math.sin((seed + j * 1.7) * 0.18);
        const n1 = Math.sin((seed + j * 2.3) * 0.21);
        const nMid = Math.sin((seed + j * 2.9) * 0.24);
        const r0 = radius + n0 * ring.jitter;
        const r1 = radius + n1 * ring.jitter;
        const rMid = radius + nMid * ring.jitter * 1.6;
        const am = (a0 + a1) * 0.5;
        const x0 = ring.x + Math.cos(a0) * r0;
        const y0 = ring.y + Math.sin(a0) * r0;
        const xm = ring.x + Math.cos(am) * rMid;
        const ym = ring.y + Math.sin(am) * rMid;
        const x1 = ring.x + Math.cos(a1) * r1;
        const y1 = ring.y + Math.sin(a1) * r1;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.quadraticCurveTo(xm, ym, x1, y1);
        ctx.stroke();
      }
      ctx.lineWidth = 1.4;
      ctx.shadowBlur = 0;
      ctx.strokeStyle = ring.colorB.replace(/[\d.]+\)$/u, `${(0.28 * alpha).toFixed(3)})`);
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    drawUfoFxOverlay(ctx);
    drawTossedFireFx(ufoFxCtx || ctx);
    drawFlameTrail(ufoFxCtx || ctx);
    drawPowerups(ufoFxCtx || ctx);
    drawLandmineCountdownOverlay(ufoFxCtx || ctx);
    drawPlacedBombsOverlay(ufoFxCtx || ctx);
    drawFreezeOverlay(ufoFxCtx || ctx);
    drawAndStepTapBlasts(ufoFxCtx || ctx);

    const particleLimit = _frameBudgetExceeded ? Math.min(40, sim.particles.length) : sim.particles.length;
    for (let i = 0; i < particleLimit; i += 1) {
      const p = sim.particles[i];
      let alpha = (1 - p.life / p.ttl) * p.alpha;
      if (p.flicker) {
        alpha *= 0.4 + 0.6 * Math.abs(Math.sin(p.life * 0.08));
      }
      if (alpha <= 0) continue;
      ctx.fillStyle = `${p.color || "rgba(111,255,128,"}${alpha.toFixed(3)})`;
      if (p.size <= 2.5) {
        const s = p.size * 2;
        ctx.fillRect(p.x - p.size, p.y - p.size, s, s);
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (landmineFlashUntil > now) {
      const t = (landmineFlashUntil - now) / 220;
      const alpha = Math.max(0, Math.min(1, t)) * 0.45;
      ctx.fillStyle = `rgba(255,214,170,${alpha.toFixed(3)})`;
      ctx.fillRect(0, 0, sim.width, sim.height);
    }
    if (sim.shooting && !prefersReducedMotion && !state.minimal) {
      const progress = sim.shooting.life / sim.shooting.ttl;
      const fade = progress < 0.2 ? progress / 0.2 : 1 - (progress - 0.2) / 0.8;
      ctx.strokeStyle = `rgba(255,255,255,${Math.max(0, fade).toFixed(3)})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(sim.shooting.x, sim.shooting.y);
      ctx.lineTo(sim.shooting.x - sim.shooting.length, sim.shooting.y - sim.shooting.length * 0.55);
      ctx.stroke();
    }
    if (canvasFlash?.alpha > 0 && !isIOSNative) {
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.fillStyle = `rgba(${canvasFlash.r},${canvasFlash.g},${canvasFlash.b},${canvasFlash.alpha.toFixed(3)})`;
      ctx.fillRect(0, 0, sim.width, sim.height);
      ctx.restore();
    }
    drawPlasmaOverlay(now);
  }

  function frame(now) {
    if (!galaxyRunning) return;
    trackFpsOverlay();
    if (now - sim.last < 16) {
      galaxyRaf = requestAnimationFrame(frame);
      return;
    }
    const rawDt = sim.last ? now - sim.last : 16;
    const dt = Math.min(rawDt, 33);
    sim.last = now;
    update(dt, now);
    galaxyRaf = requestAnimationFrame(frame);
  }

  function pointerToCanvas(event) {
    const rect = galaxyPlayCanvas.getBoundingClientRect();
    const clientX = event.touches?.[0]?.clientX ?? event.changedTouches?.[0]?.clientX ?? event.clientX;
    const clientY = event.touches?.[0]?.clientY ?? event.changedTouches?.[0]?.clientY ?? event.clientY;
    const scaleX = rect.width > 0 ? galaxyPlayCanvas.width / rect.width : 1;
    const scaleY = rect.height > 0 ? galaxyPlayCanvas.height / rect.height : 1;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  }

  function getPointerWorld(event) {
    const p = pointerToCanvas(event);
    return { x: p.x / (sim.dpr || 1), y: p.y / (sim.dpr || 1) };
  }

  function markTap(x, y) {
    practiceTapMarker = { x, y, t: performance.now() };
  }

  function handleArcadeTap(x, y, now, isTouch = false) {
    // 2026-06-09: bomb deployment (two-tap aim) consumes the tap — no laser/fire.
    if (bombAimMode) {
      // 2026-06-10: deploy now PLACES an unarmed landmine at the tap point (tap it to arm,
      // tap again to detonate) instead of exploding instantly.
      placeBombFromInventory(x, y); // decrements inventory + updates HUD internally
      bombAimMode = false;
      hudBombBtn?.classList.remove("hudBombBtn--aiming");
      updateHudBombInventory(); // refresh count + restore attention pulse if bombs remain
      return;
    }
    // 2026-06-10: tap to collect a powerup — consumes the tap (bomb aim mode above wins).
    for (let pi = 0; pi < powerups.length; pi += 1) {
      const pu = powerups[pi];
      if (Math.hypot(x - pu.x, y - pu.y) <= pu.r * 1.8) {
        powerups.splice(pi, 1);
        collectPowerup(pu);
        return;
      }
    }
    playPlayerFireSound();
    // 2026-06-10: while quadshot is active a single tap can destroy several things at once —
    // exempt the whole hit resolution from the native per-frame sound budget so every hit's
    // destruction sound layers instead of being dropped.
    const quadActive = performance.now() < quadShotUntil;
    _sfxBudgetExempt = quadActive;
    const hitSomething = resolveShotAt(x, y, now, isTouch);
    // 2026-06-10: quadshot — 3 extra shots clustered around the tap point while active.
    // Each extra shot seeks the nearest live asteroid within QUADSHOT_SEEK_RADIUS and fires
    // at its center through the same hit pipeline. Pure random 30-80px offsets almost never
    // landed inside an asteroid's collision radius (r 10-38 + 10 slop), so the cluster
    // visuals overlapped asteroids without ever destroying them.
    let extraHit = false;
    if (quadActive) {
      for (let i = 0; i < 3; i += 1) {
        let ex;
        let ey;
        // re-seek every shot: earlier extra shots splice destroyed asteroids, and split
        // children spawned this same instant become valid targets for the next shot
        const ti = findNearestAsteroidIndex(x, y, QUADSHOT_SEEK_RADIUS);
        if (ti >= 0) {
          ex = sim.asteroids[ti].x;
          ey = sim.asteroids[ti].y;
        } else {
          const ang = Math.random() * Math.PI * 2;
          const dist = 30 + Math.random() * 50;
          ex = clamp(x + Math.cos(ang) * dist, 0, sim.width);
          ey = clamp(y + Math.sin(ang) * dist, 0, sim.height);
        }
        if (resolveShotAt(ex, ey, now, isTouch)) extraHit = true;
      }
    }
    _sfxBudgetExempt = false;
    if (hitSomething || extraHit) draw(now);
  }

  // 2026-06-10: resolves one shot at (sx, sy) — visual (X-blast on iOS touch, laser on
  // desktop) plus the standard hit checks. Extracted from handleArcadeTap so quadshot can
  // fire extra cluster shots through the identical path. Returns true if it hit anything.
  function resolveShotAt(sx, sy, now, isTouch) {
    if (isIOSWebKit && isTouch) {
      tapBlasts.push({ x: sx, y: sy, life: 1.0 });
    } else {
      laserBeams.push({
        x1: sim.width / 2,
        y1: sim.height / 2,
        x2: sx,
        y2: sy,
        startedAt: now,
      });
    }
    shotsFired += 1;
    if (landmine && isPointOnMine(landmine, sx, sy)) {
      triggerCrosshairFire();
      armLandmine();
      return true;
    }
    // 2026-06-10: placed bombs use the same tap behavior (spawned → arm, armed → detonate)
    const tappedBomb = placedBombs.find((b) => isPointOnMine(b, sx, sy));
    if (tappedBomb) {
      triggerCrosshairFire();
      armMineEntity(tappedBomb, (opts) => explodePlacedBomb(tappedBomb, opts));
      return true;
    }
    if (ufo && isPointOnUfo(sx, sy)) {
      triggerCrosshairFire();
      hitUfo();
      return true;
    }
    const hitIndex = findHitAsteroidIndex(sx, sy);
    if (hitIndex >= 0) {
      triggerCrosshairFire();
      splitAsteroidByIndex(hitIndex);
      return true;
    }
    return false;
  }

  // 2026-06-10: per-type powerup collection effects.
  function collectPowerup(pu) {
    // gold bars get their own pickup sound; everything else keeps the generic blip
    if (pu.type === "goldbars") playGameSfx("pickup_gold", 0.9);
    else playGameSfx("blip", 0.9);
    if (pu.type === "bomb") {
      if (playerBombInventory < MAX_BOMB_INVENTORY) {
        playerBombInventory++;
        updateHudBombInventory();
        playGameSfx("life_gain", 0.7);
        cssFlash("#00ffcc", 0.15, 200);
      }
      return;
    }
    if (pu.type === "timer") {
      // +30s, capped at the level's full duration so the perimeter never over-fills.
      // The perimeter derives from (levelEndsAt - now) / levelDurationMs each frame,
      // so it reflects the new remaining time automatically.
      const nowP = performance.now();
      levelEndsAt = Math.min(levelEndsAt + 30000, nowP + levelDurationMs);
      playGameSfx("life_gain", 0.7); // chime
      cssFlash("#ffffff", 0.2, 250);
      return;
    }
    if (pu.type === "goldbars") {
      addArcadeScore(1000);
      cssFlash("#ffd700", 0.22, 250);
      return;
    }
    if (pu.type === "quadshot") {
      quadShotUntil = performance.now() + 12000;
      cssFlash("#cc66ff", 0.22, 250);
      return;
    }
    if (pu.type === "snowflake") {
      // 2026-06-10: snowflake now stocks the freeze inventory; the HUD button activates it
      if (playerFreezeInventory < MAX_FREEZE_INVENTORY) {
        playerFreezeInventory++;
        updateHudFreezeInventory();
        cssFlash("#88ddff", 0.15, 200);
      }
    }
  }

  // 2026-06-10: player-activated freeze (HUD ❄ button) — flash + shake, then 12s of frozen
  // positions via the existing freezeUntil logic. Ignored while a freeze is already running.
  function activateFreezeFromInventory() {
    const nowF = performance.now();
    if (playerFreezeInventory <= 0 || nowF < freezeUntil) return;
    playerFreezeInventory--;
    updateHudFreezeInventory();
    cssFlash("#88ddff", 0.25, 300);
    cssShake(0.8);
    freezeUntil = nowF + FREEZE_DURATION_MS;
    playGameSfx("freeze", 0.9);
  }

  // 2026-06-10: frozen-asteroid destruction — glass-break layer over the normal boom plus
  // ice debris. Runs for any destruction path while a freeze is active.
  function addFrozenShatterFx(x, y) {
    if (performance.now() >= freezeUntil) return;
    playGameSfx("freeze_explode", 0.9);
    const count = 8 + Math.floor(Math.random() * 5);
    for (let i = 0; i < count; i += 1) {
      if (sim.particles.length >= MAX_EXPLOSION_PARTICLES) break;
      const ang = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 160;
      const p = getParticle();
      p.x = x;
      p.y = y;
      p.vx = Math.cos(ang) * speed;
      p.vy = Math.sin(ang) * speed;
      p.life = 0;
      p.ttl = 380 + Math.random() * 280;
      p.size = 1.2 + Math.random() * 2.2;
      p.alpha = 0.85;
      p.color = "rgba(170,238,255,";
      p.flicker = true;
      sim.particles.push(p);
    }
  }

  function handlePracticeTap(x, y, now) {
    practiceLastInput = `tap ${Math.round(x)},${Math.round(y)}`;
    markTap(x, y);
    debugPing(x, y);
    const idx = findAsteroidAt(x, y, 28);
    if (idx >= 0) {
      triggerCrosshairFire();
      splitAsteroidByIndex(idx);
      updatePracticeDebug();
      draw(now);
      return;
    }
    if (now < sim.nextDrawAt) return;
    sim.nextDrawAt = now + PRACTICE_SPAWN_COOLDOWN_MS;
    if (sim.asteroids.length >= PRACTICE_MAX_ASTEROIDS) return;
    triggerCrosshairFire();
    spawnAsteroid(x, y, 3, true);
    updatePracticeDebug();
    draw(now);
  }

  let galaxyGesture = null;

  function onGalaxyPointerDown(event) {
    const now = performance.now();
    if (event.type === "click") return;
    if (event.type === "pointerdown" || event.type === "mousedown" || event.type === "touchstart") {
      lastPrimaryPointerAt = now;
    }
    const target = event.target;
    const uiBlocker = target?.closest?.(".galaxyModeSelect:not(.hidden), .arcadeHud:not(.hidden), .arcadeOverlay.show:not(.hidden), .galaxy-topbar:not(.hidden)");
    if (uiBlocker) {
      practiceLastInput = "blocked by ui";
      updatePracticeDebug();
      return;
    }
    if (event.cancelable) event.preventDefault();
    const overlayVisible = arcadeOverlay && arcadeOverlay.classList.contains("show") && !arcadeOverlay.classList.contains("hidden");
    if (overlayVisible) {
      practiceLastInput = "blocked by overlay";
      updatePracticeDebug();
      return;
    }
    const point = getPointerWorld(event);
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      practiceLastInput = "invalid point";
      updatePracticeDebug();
      return;
    }
    if (point.x < 0 || point.x > sim.width || point.y < 0 || point.y > sim.height) {
      practiceLastInput = `out ${Math.round(point.x)},${Math.round(point.y)}`;
      updatePracticeDebug();
      return;
    }
    let mode = "tap";
    if (engineMode === "arcade" && arcadeActive) {
      // 2026-06-11: mines take grab priority over stroids at an overlapping point (rarer,
      // more deliberate). A plain tap that never becomes a hold/flick falls back to the tap
      // path below (arm/detonate for mines, split for stroids) via launchStroidToss → cancel.
      const grabMine = findGrabbableMineAt(point.x, point.y);
      if (grabMine && startMineToss(grabMine, point, event.pointerId, now)) {
        mode = "stroidToss";
      } else {
        const hitIndex = findHitAsteroidIndex(point.x, point.y);
        const hitAsteroid = hitIndex >= 0 ? sim.asteroids[hitIndex] : null;
        if (hitAsteroid && hitAsteroid.kind >= 2 && startStroidToss(hitIndex, point, event.pointerId, now)) {
          mode = "stroidToss";
        }
      }
    }
    galaxyGesture = {
      start: point,
      current: point,
      mode,
      canceled: false,
      pointerId: event.pointerId ?? null,
      // 2026-06-09: track touch vs mouse so iOS taps can use the X blast
      isTouch: event.pointerType === "touch" || event.type === "touchstart",
    };
    if (typeof galaxyPlayCanvas.setPointerCapture === "function" && event.pointerId != null) {
      try {
        galaxyPlayCanvas.setPointerCapture(event.pointerId);
      } catch {
        // ignore capture failures
      }
    }
  }

  function onGalaxyPointerMove(event) {
    updateCrosshairPosition(event);
    if (!galaxyGesture) return;
    const now = performance.now();
    const point = getPointerWorld(event);
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
    galaxyGesture.current = point;
    if (event.cancelable) event.preventDefault();
    if (galaxyGesture.mode === "stroidToss") {
      updateStroidTossDrag(point);
      updateStroidTossHold(now);
      return;
    }
    const dx = point.x - galaxyGesture.start.x;
    const dy = point.y - galaxyGesture.start.y;
    const dragged = Math.hypot(dx, dy) > PLASMA_CAGE_DRAG_THRESHOLD;
    if (engineMode === "arcade" && arcadeActive && dragged) {
      if (!plasmaCage.active && galaxyGesture.mode !== "cage") {
        galaxyGesture.mode = "cage";
        galaxyGesture.canceled = !beginPlasmaCage(galaxyGesture.start, point, now);
      } else if (plasmaCage.active) {
        plasmaCage.currentX = point.x;
        plasmaCage.currentY = point.y;
      }
    }
  }

  // 2026-06-11: a canceled pointer/touch (iOS edge gestures, system interruptions) must release
  // any in-progress grab and clear the gesture, or the grabbed stroid stays pinned in place.
  function onGalaxyPointerCancel() {
    if (stroidToss.active) cancelStroidToss();
    if (plasmaCage.active) resetPlasmaCageGesture();
    galaxyGesture = null;
  }

  function onGalaxyPointerUp(event) {
    if (!galaxyGesture) return;
    const now = performance.now();
    // 2026-06-09: capture before the gesture is cleared so taps know the input type
    const gestureIsTouch = galaxyGesture.isTouch === true;
    const point = getPointerWorld(event);
    if (Number.isFinite(point.x) && Number.isFinite(point.y)) {
      galaxyGesture.current = point;
      if (plasmaCage.active) {
        plasmaCage.currentX = point.x;
        plasmaCage.currentY = point.y;
      }
    }
    if (event.cancelable) event.preventDefault();
    if (typeof galaxyPlayCanvas.releasePointerCapture === "function" && galaxyGesture.pointerId != null) {
      try {
        galaxyPlayCanvas.releasePointerCapture(galaxyGesture.pointerId);
      } catch {
        // ignore capture failures
      }
    }
    if (plasmaCage.active) {
      releasePlasmaCage(now);
      galaxyGesture = null;
      draw(now);
      return;
    }
    if (galaxyGesture.mode === "stroidToss") {
      const tapPoint = galaxyGesture.start;
      updateStroidTossDrag(galaxyGesture.current);
      updateStroidTossHold(now);
      // 2026-06-10: no minimum hold before a toss — a quick flick released in <500ms used to
      // fail the grabbed/hold-time gate and drop the stroid. launchStroidToss's own guards
      // (recent sample + ≥10px movement) already separate a flick from a static tap.
      const didLaunch = stroidToss.active ? launchStroidToss(now) : false;
      if (!didLaunch) {
        cancelStroidToss();
      }
      galaxyGesture = null;
      if (!didLaunch && now - sim.lastTapAt >= 55) {
        sim.lastTapAt = now;
        handleArcadeTap(tapPoint.x, tapPoint.y, now, gestureIsTouch);
      } else {
        draw(now);
      }
      return;
    }
    const shouldTap = !galaxyGesture.canceled && galaxyGesture.mode === "tap" && now - sim.lastTapAt >= 55;
    const tapPoint = galaxyGesture.current;
    galaxyGesture = null;
    if (!shouldTap) return;
    sim.lastTapAt = now;
    if (tapPoint.x < 0 || tapPoint.x > sim.width || tapPoint.y < 0 || tapPoint.y > sim.height) return;
    if (engineMode === "practice") {
      handlePracticeTap(tapPoint.x, tapPoint.y, now);
    } else if (engineMode === "arcade") {
      handleArcadeTap(tapPoint.x, tapPoint.y, now, gestureIsTouch);
    }
  }

  function setCrosshairVisible(visible) {
    if (!canvasCrosshair || !canShowCrosshair) return;
    canvasCrosshair.style.display = visible ? "block" : "none";
  }

  function updateCrosshairPosition(event) {
    if (!canvasCrosshair || !canShowCrosshair) return;
    const clientX = event.clientX;
    const clientY = event.clientY;
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return;
    canvasCrosshair.style.left = `${clientX}px`;
    canvasCrosshair.style.top = `${clientY}px`;
  }

  function triggerCrosshairFire() {
    if (!canvasCrosshair || !canShowCrosshair) return;
    canvasCrosshair.classList.remove("fire");
    void canvasCrosshair.offsetWidth;
    canvasCrosshair.classList.add("fire");
    setTimeout(() => canvasCrosshair.classList.remove("fire"), 110);
  }

  function startGalaxyLoop() {
    if (galaxyRunning) return;
    galaxyRunning = true;
    sim.last = 0;
    if (!prefersReducedMotion) scheduleShootingStar();
    galaxyRaf = requestAnimationFrame(frame);
  }

  function stopGalaxyLoop() {
    galaxyRunning = false;
    stopWarningState();
    stopDangerLoop();
    if (galaxyRaf) cancelAnimationFrame(galaxyRaf);
    galaxyRaf = 0;
    clearTimeout(sim.shootingTimer);
    sim.shootingTimer = null;
    hideFpsOverlay();
    setPlasmaOverlayVisible(true);
    window.pixiRenderer?.destroy();
    window.galaxyBackground?.hide();
    _mediaSession?.setPlaybackState?.({
      playbackState: "none",
    })?.catch?.(() => {});
  }

  function stopAndMenu() {
    commBoxController.hide();
    stopGalaxyLoop();
    showModeSelect({ preserveArcade: false });
    stopGalaxyLoop();
  }

  if (!galaxyPlayCanvas.__polyPointerBound) {
    galaxyPlayCanvas.__polyPointerBound = true;
    if ("PointerEvent" in window) {
      galaxyPlayCanvas.addEventListener("pointerdown", onGalaxyPointerDown, { passive: false });
      galaxyPlayCanvas.addEventListener("pointermove", onGalaxyPointerMove, { passive: false });
      galaxyPlayCanvas.addEventListener("pointerup", onGalaxyPointerUp, { passive: false });
      // 2026-06-11: iOS cancels touches near screen edges (e.g. an upward flick to the top) —
      // without this the grab orphaned and the stroid stayed pinned. Release the grab on cancel.
      galaxyPlayCanvas.addEventListener("pointercancel", onGalaxyPointerCancel, { passive: false });
      galaxyPlayCanvas.addEventListener("click", onGalaxyPointerDown, { passive: false });
    } else {
      galaxyPlayCanvas.addEventListener("touchstart", onGalaxyPointerDown, { passive: false });
      galaxyPlayCanvas.addEventListener("touchmove", onGalaxyPointerMove, { passive: false });
      galaxyPlayCanvas.addEventListener("touchend", onGalaxyPointerUp, { passive: false });
      galaxyPlayCanvas.addEventListener("touchcancel", onGalaxyPointerCancel, { passive: false });
      galaxyPlayCanvas.addEventListener("mousedown", onGalaxyPointerDown, { passive: false });
      galaxyPlayCanvas.addEventListener("mousemove", onGalaxyPointerMove, { passive: false });
      galaxyPlayCanvas.addEventListener("mouseup", onGalaxyPointerUp, { passive: false });
    }
  }
  galaxyPlayCanvas.addEventListener("pointerenter", (event) => {
    setCrosshairVisible(true);
    updateCrosshairPosition(event);
  });
  galaxyPlayCanvas.addEventListener("pointerleave", () => setCrosshairVisible(false));

  window.addEventListener("resize", relayoutGalaxyCanvas);
  const delayedRelayout = () => {
    relayoutGalaxyCanvas();
    setTimeout(relayoutGalaxyCanvas, 120);
    setTimeout(relayoutGalaxyCanvas, 420);
  };
  window.addEventListener("orientationchange", delayedRelayout);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", delayedRelayout, { passive: true });
  }
  // FIXED 2026-06-08: auto-pause on app switch; music to 10%; do not auto-resume
  let _bgMusicGainBeforePause = MUSIC_MAX_GAIN;
  let _wasLoopRunningOnHide = false;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      // 2026-06-09: clear any in-progress plasma net (a mid-drag gesture left a stuck cage
      // on screen on return) and remember whether the loop was actually running.
      if (plasmaCage.active) releasePlasmaCage(performance.now());
      setPlasmaOverlayVisible(false);
      _wasLoopRunningOnHide = galaxyRunning;
      // 2026-06-09: freeze the level/landmine countdowns while backgrounded so they
      // don't drain in real time and desync the game on return.
      if (engineMode === "arcade" && arcadeActive) {
        const nowP = performance.now();
        pausedLevelRemainingMs = Math.max(0, levelEndsAt - nowP);
        pausedLandmineRemainingMs = getLandmineRemainingMs(nowP);
      }
      stopGalaxyLoop();
      // Dim music to 10% so audio doesn't blare in background
      _bgMusicGainBeforePause = audioEngine.musicGain?.gain?.value ?? MUSIC_MAX_GAIN;
      if (audioEngine.musicGain && audioEngine.ctx) {
        const now = audioEngine.ctx.currentTime;
        audioEngine.musicGain.gain.cancelScheduledValues(now);
        audioEngine.musicGain.gain.setValueAtTime(audioEngine.musicGain.gain.value, now);
        audioEngine.musicGain.gain.linearRampToValueAtTime(0.1, now + 0.25);
      }
      if (audioEngine.currentMusicHtml?.node) {
        audioEngine.currentMusicHtml.node.volume = 0.1;
      }
    } else if (!galaxyView.hidden) {
      setPlasmaOverlayVisible(false); // safety: never return with a stuck cage overlay
      resizeGalaxyCanvas();
      computePlayfield();
      // Restore music volume
      if (audioEngine.musicGain && audioEngine.ctx) {
        const now = audioEngine.ctx.currentTime;
        audioEngine.musicGain.gain.cancelScheduledValues(now);
        audioEngine.musicGain.gain.setValueAtTime(audioEngine.musicGain.gain.value, now);
        audioEngine.musicGain.gain.linearRampToValueAtTime(_bgMusicGainBeforePause, now + 0.25);
      }
      if (audioEngine.currentMusicHtml?.node) {
        audioEngine.currentMusicHtml.node.volume = _bgMusicGainBeforePause;
      }
      resumeBackgroundMusic();
      // 2026-06-09: cleanly resume gameplay. stopGalaxyLoop() destroyed PIXI and froze the
      // loop; resizeGalaxyCanvas() above re-inits PIXI. Restore timers, drop any leftover
      // gesture, and restart the loop — but only if it was running and the user hadn't
      // already paused to the menu (engineMode would be "menu" in that case).
      if (engineMode === "arcade" && arcadeActive) {
        const nowP = performance.now();
        levelEndsAt = nowP + pausedLevelRemainingMs;
        restoreLandmineTimer(pausedLandmineRemainingMs, nowP);
        stopPlasmaChargeSound();
        resetPlasmaCageGesture();
        plasmaCage.releaseFx = null;
        cancelStroidToss();
        galaxyGesture = null;
        if (_wasLoopRunningOnHide && !galaxyRunning) startGalaxyLoop();
        // 2026-06-09: stopGalaxyLoop() hid the canvas background and iOS may have paused the
        // bg video — restart both AFTER the loop is running so the background reappears.
        window.galaxyBackground?.show();
        try {
          const frontVid = bgCtl?.front;
          if (frontVid && frontVid.paused) frontVid.play().catch(() => {});
        } catch { /* bg video resume is best-effort */ }
      }
    }
  });

  resizeGalaxyCanvas();
  computePlayfield();
  buildArcadeLevelSelect();
  buildDebugLevelSelect();
  syncDebugLevelPanel();
  renderLives();
  renderScore();
  if (galaxyModeTitleEl) {
    galaxyModeTitleEl.addEventListener("pointerdown", registerDebugLevelUnlockTap);
  }
  if (btnDebugStartLevel) {
    btnDebugStartLevel.addEventListener("click", () => {
      const selected = parseInt(debugLevelSelect?.value || "1", 10);
      startArcadeAtLevel(selected);
    });
  }
  draw(performance.now());

  galaxyCanvasController = {
    showModeSelect(opts = { preserveArcade: false, openArcadeMenu: false }) {
      resizeGalaxyCanvas();
      computePlayfield();
      setTimeout(computePlayfield, 50);
      setTimeout(computePlayfield, 250);
      showModeSelect(opts);
    },
    startPractice() {
      if (!PRACTICE_ENABLED) return;
      startPracticeMode();
    },
    startArcadeFromSave() {
      startArcadeFromSave();
    },
    startArcadeNew() {
      startArcadeNew();
    },
    startArcadeResume() {
      startArcadeResume();
    },
    openArcadeMenu() {
      openArcadeMenu();
    },
    openArcadeLevelSelect() {
      openArcadeLevelSelect();
    },
    startArcadeAtLevel(levelNum) {
      startArcadeAtLevel(levelNum);
    },
    triggerBoom() {
      // no-op in current arcade interaction model
    },
    detonateInventoryBomb() {
      if (!arcadeActive || engineMode !== "arcade") return;
      detonateInventoryBomb();
    },
    // 2026-06-09: HUD bomb button toggles aim mode; the next canvas tap deploys at that point.
    toggleBombAim() {
      if (!arcadeActive || engineMode !== "arcade") return;
      ensureLsrStyles(); // guarantees the .hudBombBtn--aiming glow CSS is present
      if (playerBombInventory <= 0) {
        bombAimMode = false;
        hudBombBtn?.classList.remove("hudBombBtn--aiming");
        return;
      }
      bombAimMode = !bombAimMode;
      hudBombBtn?.classList.toggle("hudBombBtn--aiming", bombAimMode);
      updateHudBombInventory(); // suppress/restore the attention pulse based on aim state
      if (bombAimMode) playGameSfx("blip", 0.6);
    },
    // 2026-06-10: HUD freeze button — activate a stocked freeze
    activateFreeze() {
      if (!arcadeActive || engineMode !== "arcade") return;
      activateFreezeFromInventory();
    },
    isArcade() {
      return engineMode === "arcade";
    },
    stopAndMenu,
    stop: stopGalaxyLoop,
    relayout: relayoutGalaxyCanvas,
    clear() {
      if (engineMode === "arcade") return;
      clearGameplayEntities();
      setGalaxyTool("draw");
      draw(performance.now());
    },
  };
}

// v1.2.2 galaxy bg
function initGalaxyBackground() {
  const canvas = document.getElementById("galaxyCanvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const galaxy = {
    canvas,
    ctx,
    width: 0,
    height: 0,
    dpr: 1,
    stars: [],
    raf: null,
    last: 0,
    shooting: null,
    shootingTimer: null,
    paused: false,
    minimal: state.minimal,
  };

  galaxyController = {
    setMinimal(value) {
      galaxy.minimal = value;
    },
  };

  function starCountForSize(width, height) {
    const area = width * height;
    return Math.max(80, Math.min(140, Math.round(area / 13000)));
  }

  function randomStar() {
    return {
      x: Math.random() * galaxy.width,
      y: Math.random() * galaxy.height,
      r: 0.6 + Math.random() * 1.7,
      baseAlpha: 0.2 + Math.random() * 0.55,
      twinkleSpeed: 0.35 + Math.random() * 1.25,
      twinkleRange: 0.07 + Math.random() * 0.2,
      phase: Math.random() * Math.PI * 2,
      dx: (Math.random() - 0.5) * 0.012,
      dy: (Math.random() - 0.5) * 0.012,
    };
  }

  function resize() {
    galaxy.dpr = nativeCanvasDpr();
    galaxy.width = Math.floor(window.innerWidth);
    galaxy.height = Math.floor(window.innerHeight);

    canvas.width = Math.floor(galaxy.width * galaxy.dpr);
    canvas.height = Math.floor(galaxy.height * galaxy.dpr);
    canvas.style.width = `${galaxy.width}px`;
    canvas.style.height = `${galaxy.height}px`;
    ctx.setTransform(galaxy.dpr, 0, 0, galaxy.dpr, 0, 0);

    const targetCount = starCountForSize(galaxy.width, galaxy.height);
    galaxy.stars = Array.from({ length: targetCount }, randomStar);
    draw(performance.now());
  }

  function spawnShootingStar() {
    if (prefersReducedMotion || galaxy.paused) return;
    const startX = Math.random() * galaxy.width * 0.75;
    const startY = Math.random() * galaxy.height * 0.45;
    const speed = 0.9 + Math.random() * 0.8;
    galaxy.shooting = {
      x: startX,
      y: startY,
      vx: 0.95 * speed,
      vy: 0.55 * speed,
      length: 90 + Math.random() * 70,
      life: 0,
      maxLife: 760 + Math.random() * 420,
      alpha: 0.75,
    };
  }

  function scheduleShootingStar() {
    if (prefersReducedMotion) return;
    clearTimeout(galaxy.shootingTimer);
    const nextIn = 12000 + Math.random() * 13000;
    galaxy.shootingTimer = setTimeout(() => {
      spawnShootingStar();
      scheduleShootingStar();
    }, nextIn);
  }

  function update(dt, now) {
    if (!prefersReducedMotion) {
      galaxy.stars.forEach((star) => {
        star.x += star.dx * dt;
        star.y += star.dy * dt;
        if (star.x < -2) star.x = galaxy.width + 2;
        if (star.y < -2) star.y = galaxy.height + 2;
        if (star.x > galaxy.width + 2) star.x = -2;
        if (star.y > galaxy.height + 2) star.y = -2;
      });
    }

    if (galaxy.shooting) {
      galaxy.shooting.life += dt;
      galaxy.shooting.x += galaxy.shooting.vx * dt;
      galaxy.shooting.y += galaxy.shooting.vy * dt;
      if (galaxy.shooting.life >= galaxy.shooting.maxLife) galaxy.shooting = null;
    }

    draw(now);
  }

  function draw(now) {
    ctx.clearRect(0, 0, galaxy.width, galaxy.height);

    const minimalFactor = galaxy.minimal ? 0.56 : 1;
    const reducedFactor = prefersReducedMotion ? 0.88 : 1;

    galaxy.stars.forEach((star) => {
      let alpha = star.baseAlpha;
      if (!prefersReducedMotion) {
        alpha += Math.sin(now * 0.001 * star.twinkleSpeed + star.phase) * star.twinkleRange;
      }
      alpha = Math.max(0.08, Math.min(0.95, alpha * minimalFactor * reducedFactor));

      ctx.beginPath();
      ctx.fillStyle = `rgba(210,226,255,${alpha.toFixed(3)})`;
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();
    });

    if (galaxy.shooting && !prefersReducedMotion) {
      const shoot = galaxy.shooting;
      const progress = shoot.life / shoot.maxLife;
      const fade = progress < 0.2 ? progress / 0.2 : 1 - (progress - 0.2) / 0.8;
      const alpha = Math.max(0, fade * shoot.alpha * (galaxy.minimal ? 0.5 : 1));

      const grad = ctx.createLinearGradient(shoot.x, shoot.y, shoot.x - shoot.length, shoot.y - shoot.length * 0.55);
      grad.addColorStop(0, `rgba(255,255,255,${alpha.toFixed(3)})`);
      grad.addColorStop(1, "rgba(255,255,255,0)");

      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(shoot.x, shoot.y);
      ctx.lineTo(shoot.x - shoot.length, shoot.y - shoot.length * 0.55);
      ctx.stroke();
    }
  }

  function frame(now) {
    if (galaxy.paused) return;
    if (now - galaxy.last < 33) {
      galaxy.raf = requestAnimationFrame(frame);
      return;
    }

    const dt = galaxy.last ? now - galaxy.last : 16;
    galaxy.last = now;
    update(dt, now);
    galaxy.raf = requestAnimationFrame(frame);
  }

  function pause() {
    galaxy.paused = true;
    if (galaxy.raf) cancelAnimationFrame(galaxy.raf);
    galaxy.raf = null;
  }

  function resume() {
    if (galaxy.paused === false && galaxy.raf) return;
    galaxy.paused = false;
    galaxy.last = 0;
    if (!prefersReducedMotion) galaxy.raf = requestAnimationFrame(frame);
    else draw(performance.now());
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pause();
    else resume();
  });

  window.addEventListener("resize", resize);
  resize();

  if (!prefersReducedMotion) {
    scheduleShootingStar();
    resume();
  } else {
    draw(performance.now());
  }
}
