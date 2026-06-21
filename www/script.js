let capacitorHaptics = null;
let hapticImpactStyle = { Heavy: "HEAVY", Medium: "MEDIUM", Light: "LIGHT" };
let hapticNotificationType = { Success: "SUCCESS" };
const DISABLE_GAMEPLAY_HAPTICS = false; // 2026-06-12: gameplay haptics re-enabled after perf test
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
          sizes: "256x256",
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
        sizes: "256x256",
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

// 2026-06-12: "huge" haptic for bombs + the plasma-net blast. Capacitor impacts top out at
// HEAVY, so layer two HEAVY hits with a Medium tail (~130ms total) for a punchy, sustained
// boom instead of a single tick. Also fires the Vibration API where supported (Android/web).
function triggerHugeHaptic() {
  if (DISABLE_GAMEPLAY_HAPTICS) return;
  triggerHapticImpact(hapticImpactStyle.Heavy);
  setTimeout(() => triggerHapticImpact(hapticImpactStyle.Heavy), 60);
  setTimeout(() => triggerHapticImpact(hapticImpactStyle.Medium), 130);
  try { navigator.vibrate?.([40, 30, 60]); } catch { /* Vibration API optional */ }
}

function triggerHapticNotification(type) {
  try {
    getCapacitorHaptics()?.notification?.({ type })?.catch?.(() => {});
  } catch {
    // Haptics are optional outside a native Capacitor runtime.
  }
}

const APP_VERSION = "v4.0.0";
const storageKey = "poly-oracle-v11-state";
const firstRunHintKey = "poly_oracle_seen_hint_v1_2_1";
const verboseKey = "poly_oracle_verbose_details";
const chaosEnabledKey = "poly_oracle_chaos_theme";
const chaosPaletteKey = "poly_oracle_theme_palette";
const galaxyToolKey = "poly_oracle_galaxy_tool";
const BUILD_TS = "2026-06-21 13:50";
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

// 2026-06-15: Stunt Mode tutorial completion gate — unlocks the Stunt-Practice button.
const STUNT_TRAINING_DONE_KEY = "poly_stunt_training_complete";
function isStuntTrainingComplete() {
  try { return localStorage.getItem(STUNT_TRAINING_DONE_KEY) === "1"; }
  catch { return false; }
}

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
  bling: "gamesfx/bling.mp3", // powerup appears
  pickup_weapon: "gamesfx/pickup_weapon.mp3", // layered on quadshot pickup
  weaponclick_pickupbomb: "gamesfx/weaponclick_pickupbomb.mp3", // layered on bomb pickup
  // 2026-06-14: homing missile powerup sound pack
  missile_lockon: "gamesfx/missile_lockon.mp3", // crosshair placed / target acquired
  missile_fired: "gamesfx/missile_fired.mp3", // launch
  missile_prehit: "gamesfx/missile_prehit.mp3", // ~last 15% of flight
  missile_explo: "gamesfx/missile_explo.mp3", // impact
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
// 2026-06-14: an ARMED bomb only detonates on contact while it's in a decently HARD toss above
// this speed. A drifting armed bomb (never tossed, or a toss bled down below this) bounces off
// asteroids instead of blowing up on any incidental touch.
const MINE_TOSS_DETONATE_MIN_SPEED = 120;
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
  // 2026-06-15: levels 11-15 — primary drives the perimeter timer line + plasma color (Part 7).
  11: { primary: "#FFFFFF", name: "Void Grey" },
  12: { primary: "#00FFFF", name: "Boom Cadet" },
  13: { primary: "#FF0000", name: "Boom Pt 2" },
  14: { primary: "#00FF44", name: "Critical Mass" },
  15: { primary: "#FF8800", name: "The Gauntlet" },
};
// 2026-06-15 (Part 6): per-level explosion spark palettes (levels 11-15). Stored as the
// "rgba(r,g,b," prefix that sparkColorForSprite() returns — the caller appends the alpha.
const LEVEL_SPARK_COLORS = {
  11: ["rgba(255,255,255,", "rgba(170,170,170,", "rgba(204,204,204,"], // white / grey
  12: ["rgba(0,255,255,",   "rgba(255,0,204,",   "rgba(153,0,255,"],   // cyan / magenta / purple
  13: ["rgba(255,0,0,",     "rgba(136,0,0,",     "rgba(204,0,0,"],     // red only
  14: ["rgba(0,255,68,",    "rgba(170,255,0,",   "rgba(68,204,0,"],    // green / lime
  15: ["rgba(255,255,255,", "rgba(255,102,0,",   "rgba(255,221,0,"],   // white-hot / orange / yellow
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
  ARCADE_MENU: "assets/music/STROIDS_THEME.mp3",
  L3_4:    "assets/music/Stroids_phonk_loop.mp3",
  L5_6:    "assets/music/Stroids_BASS_Phonk.mp3",
  L7_8:    "assets/music/Stroids_Phonk_2.mp3",
  L9:      "assets/music/Stroids_metal_Loop.mp3",
  L11_SWARM: "assets/music/L11_Swarm.mp3",       // levels 11+
  L12_BOOM:     "assets/music/L12_BoomCadet.mp3", // level 12 — chain reaction
  L13_BOOM_PT2: "assets/music/L13_Boom_pt2.mp3",  // level 13 — escalation
  L14_CRITICAL: "assets/music/L14_critical.mp3",  // PLACEHOLDER — track not yet supplied
  L15_GAUNTLET: "assets/music/L15_gauntlet.mp3",  // PLACEHOLDER — track not yet supplied
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
  if (level === 10)   return MUSIC.L10;
  if (level === 11)   return MUSIC.L11_SWARM;
  if (level === 12)   return MUSIC.L12_BOOM;       // cfg.musicKey "L12_BOOM"
  if (level === 13)   return MUSIC.L13_BOOM_PT2;   // cfg.musicKey "L13_BOOM_PT2"
  // 2026-06-15: L14/L15 tracks not yet supplied — fall back per the level brief
  // (L14 → L13, L15 → L10 boss). Swap these to MUSIC.L14_CRITICAL / MUSIC.L15_GAUNTLET
  // once the real files land in assets/music/ (the keys are already defined above).
  if (level === 14)   return MUSIC.L13_BOOM_PT2;   // cfg.musicKey "L14_CRITICAL" (fallback)
  if (level === 15)   return MUSIC.L10;            // cfg.musicKey "L15_GAUNTLET" (fallback)
  if (level >= 11)    return MUSIC.L11_SWARM;
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
  SHIMMER: "reveal_flash", // soft bed under the answer-box sparkle bridge
};

// === Level Config ===
const ARCADE_LEVELS = [
  // 2026-06-15: early levels bumped denser (were 2/3/7/9 to-clear) so the opening doesn't read
  // empty. L1/L2 have no trickle (spawnEveryMs 0), so totalToClear MUST equal startSpawn there.
  { level: 1, time: 48, totalToClear: 4, startSpawn: 4, spawnEveryMs: 0, maxOnScreen: 12 },
  { level: 2, time: 50, totalToClear: 6, startSpawn: 6, spawnEveryMs: 0, maxOnScreen: 12 },
  { level: 3, time: 52, totalToClear: 10, startSpawn: 5, spawnEveryMs: 2000, maxOnScreen: 12 },
  { level: 4, time: 54, totalToClear: 12, startSpawn: 6, spawnEveryMs: 2000, maxOnScreen: 12 },
  { level: 5, time: 56, totalToClear: 13, startSpawn: 5, spawnEveryMs: 2000, maxOnScreen: 12,
    guaranteedSpawn: [{ type: "bomb", atMs: 8000 }, { type: "bomb", atMs: 18000 }] }, // 2026-06-17: two early bomb drops
  { level: 6, time: 58, totalToClear: 14, startSpawn: 5, spawnEveryMs: 1800, maxOnScreen: 13,
    musicVolume: 1.15 }, // 2026-06-17: +15% music gain for this level
  { level: 7, time: 60, totalToClear: 16, startSpawn: 5, spawnEveryMs: 1800, maxOnScreen: 13 },
  { level: 8, time: 64, totalToClear: 18, startSpawn: 6, spawnEveryMs: 1600, maxOnScreen: 14 },
  { level: 9, time: 68, totalToClear: 21, startSpawn: 6, spawnEveryMs: 1500, maxOnScreen: 14,
    guaranteedSpawn: [
      { type: "bomb", atMs: 8000 },
      { type: "bomb", atMs: 20000 },
      { type: "quadshot", atMs: 12000 },
    ] }, // 2026-06-17: two bombs + a quadshot near the start
  { level: 10, time: 75, totalToClear: 24, startSpawn: 7, spawnEveryMs: 1400, maxOnScreen: 14,
    powerupOverride: ["freeze", "goldbars", "bomb"] }, // 2026-06-16: boss-level support kit
  // 2026-06-15: second act — the run no longer ends at level 10. Levels 11-15 reuse the
  // level-10 boss music + background (musicForLevel/bgKeyForLevel both clamp at >=10) and the
  // hotroid sprites, ramping density/time. "YOU WIN" now fires after clearing level 15.
  { level: 11, time: 78, totalToClear: 27, startSpawn: 7, spawnEveryMs: 1350, maxOnScreen: 15,
    guaranteedSpawn: [{ type: "quadshot", atMs: 12000 }] }, // 2026-06-16: early quadshot drop
  // 2026-06-15: levels 12-15 are the "second act" with per-level mechanics. New config fields
  // (asteroidKinds, asteroidSpeedMult, mineLaunch/mineCount/mineFuseMs, noUfo, ufoSpawnAt,
  // powerupOverride, powerupIntervalMs, label, musicKey) are honored by the engine. dualUfo and
  // waves are declared but NOT yet wired — see the TODO stubs in startLevel/setupUfoSpawnForLevel.
  {
    level: 12,
    label: "BOOM CADET",
    time: 55,
    totalToClear: 18,
    startSpawn: 6,
    spawnEveryMs: 8000,
    maxOnScreen: 10,
    asteroidKinds: [3, 3, 2],   // large + medium only — tight clusters
    noUfo: false,
    ufoSpawnAt: 25,             // UFO arrives mid-level to disrupt chains
    mineLaunch: true,
    mineCount: 4,              // 4 mines spawn at level start
    mineFuseMs: 5000,          // shorter fuse than normal (normally 8000)
    musicKey: "L12_BOOM",
  },
  {
    level: 13,
    label: "BOOM PT 2",
    time: 50,
    totalToClear: 22,
    startSpawn: 8,
    spawnEveryMs: 6000,
    maxOnScreen: 12,
    asteroidKinds: [3, 2, 2, 1], // mix of all sizes
    asteroidSpeedMult: 1.4,       // 40% faster than normal
    noUfo: false,
    ufoSpawnAt: 15,               // UFO arrives early
    mineLaunch: true,
    mineCount: 3,
    mineFuseMs: 5000,
    powerupOverride: ["missile", "missile", "goldbars"], // 2026-06-16: missile-weighted pool
    musicKey: "L13_BOOM_PT2",
  },
  {
    level: 14,
    label: "CRITICAL MASS",
    time: 25,                    // very short timer
    totalToClear: 40,            // lots of small fast asteroids
    startSpawn: 15,
    spawnEveryMs: 4000,
    maxOnScreen: 20,
    asteroidKinds: [1],          // ONLY kind 1 small asteroids
    asteroidSpeedMult: 1.6,      // 60% faster
    noUfo: true,
    noLandmines: true,
    powerupOverride: ["freeze", "quadshot", "timer", "timer"], // 2026-06-16: timer-weighted support
    powerupIntervalMs: 10000,    // spawn every 10s
    musicKey: "L14_CRITICAL",
  },
  {
    level: 15,
    label: "THE GAUNTLET",
    time: 60,
    totalToClear: 50,
    startSpawn: 10,
    spawnEveryMs: 5000,
    maxOnScreen: 16,
    asteroidKinds: [3, 3, 2, 2, 1],
    asteroidSpeedMult: 1.3,
    noUfo: false,
    ufoSpawnAt: 10,
    dualUfo: true,               // NOT yet wired — see setupUfoSpawnForLevel TODO
    mineLaunch: true,
    mineCount: 2,
    waves: [
      { count: 10, triggerAtRemaining: 20 }, // NOT yet wired — see startLevel TODO
    ],
    // 2026-06-16: missile-heavy mix with every type available, dropping every 12s.
    powerupOverride: ["missile", "missile", "timer", "freeze", "quadshot", "bomb"],
    powerupIntervalMs: 12000,
    speedEscalation: true,       // 2026-06-16: live asteroids ramp speed over the level (cap 2.5x)
    musicKey: "L15_GAUNTLET",
  },
];

// Stunt (tutorial) Mode — a no-fail SPC-guided walkthrough of the core verbs. The phase script
// and engine live inside the galaxyCanvasController closure (TUTORIAL_PHASES / runTutorial),
// since they need direct access to the spawn + sim internals.

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
  "Without a doubt",
  "Signs point to yes",
  "Nope",
  "I don't think so",
  "Don't count on it",
  "That is for God to decide",
  "Ask another day",
  "The stars say wait",
  "You're asking the wrong question, think about it and ask another day",
  "Yes",
  "Not today",
  "Heck No",
  "No",
];

// 2026-06-15: weighted reveal odds. Default weight is 1; the deflection / non-answers are
// dialed down so a real yes/no lands far more often. The "wrong question" line in particular
// was ~1-in-13 (too frequent) — now it's rare. Used by pickCanonicalAnswer() on reveal.
const ANSWER_WEIGHTS = {
  "You're asking the wrong question, think about it and ask another day": 0.18,
  "That is for God to decide": 0.5,
  "Ask another day": 0.6,
  "The stars say wait": 0.7,
};

function pickWeighted(list, weightOf) {
  let total = 0;
  for (const item of list) total += Math.max(0, weightOf(item));
  if (total <= 0) return pick(list);
  let r = Math.random() * total;
  for (const item of list) {
    r -= Math.max(0, weightOf(item));
    if (r < 0) return item;
  }
  return list[list.length - 1];
}

function pickCanonicalAnswer() {
  return pickWeighted(canonicalAnswers, (a) => ANSWER_WEIGHTS[a] ?? 1);
}

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
const btnArcadeStunt = document.getElementById("btnArcadeStunt");
const stuntModeMenuPanel = document.getElementById("stuntModeMenuPanel");
const btnStuntTraining = document.getElementById("btnStuntTraining");
const btnStuntPractice = document.getElementById("btnStuntPractice");
const btnStuntBack = document.getElementById("btnStuntBack");
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
// 2026-06-21: debounce the freeze HUD button so a fast double-tap can't toggle
// freeze on-then-off and waste a charge (guards the shared toggleFreezeFromInventory path).
let _lastFreezeToggleAt = 0;
const hudMissileBtn = document.getElementById("hudMissileBtn");
const hudMissileCount = document.getElementById("hudMissileCount");
const hudMissileReload = document.getElementById("hudMissileReload");
const hudQuadBadge = document.getElementById("hudQuadBadge");
const hudQuadTime = document.getElementById("hudQuadTime");

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

  // 2026-06-16: SPC (Specialist) animated portrait — the Stunt Mode tutorial swaps the comm
  // portrait to SPC and drives these frames via setSpcFrame / spcSpeakStart / blink (see below).
  // Parallel structure to the commander FRAMES map above.
  const SPC_FRAMES = {
    idle:          "vo/spc_idle_smile.png",
    idle_smile:    "vo/spc_idle_smile.png", // canonical rest pose (alias of idle)
    idle_neutral:  "vo/spc_idle_neutral.png",
    idle_smirk:    "vo/spc_idle_smirk.png",
    idle_smirk2:   "vo/spc_idle_smirk2.png", // pursed-lips dry-wit smirk
    idle_gentle:   "vo/spc_idle_gentle.png",
    idle_soft:     "vo/spc_idle_soft.png",
    idle_warm:     "vo/spc_idle_warm.png",
    talk:          "vo/spc_talk_neutral.png",
    talk_calm:     "vo/spc_talk_calm.png",
    talk_friendly: "vo/spc_talk_friendly.png",
    talk_happy:    "vo/spc_talk_happy.png",
    talk_smile:    "vo/spc_talk_smile.png",
    talk_neutral:  "vo/spc_talk_neutral.png",
    talk_st:       "vo/spc_talk_st.png",  // phoneme: S/T mouth shape
    talk_ah:       "vo/spc_talk_ah.png",  // phoneme: open AH vowel
    talk_mid:      "vo/spc_talk_mid.png", // phoneme: mid/neutral open
    smile_wide:    "vo/spc_idle_smile_wide.png",
    smile_open:    "vo/spc_smile_open.png",
    laugh:         "vo/spc_laugh.png",
    praise:        "vo/spc_praise.png",
    alert:         "vo/spc_alert.png",
    blink:         "vo/spc_blink.png",
    blink_down:    "vo/spc_blink_down.png",
    impressed_smile:  "vo/spc_impressed_smile.png",
    impressed_ah:     "vo/spc_impressed_ah.png",
    impressed_blink1: "vo/spc_impressed_blink1.png",
    impressed_blink2: "vo/spc_impressed_blink2.png",
    shades:        "vo/spc_shades.png",
    shades_blink:  "vo/spc_shades_blink.png",
  };

  const spcImages = {};
  Object.entries(SPC_FRAMES).forEach(([key, src]) => {
    const img = new Image();
    img.decoding = "async";
    img.src = src;
    spcImages[key] = img;
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
  let voAudioFxCleanup = null;
  let typingToken = 0;
  let mouthFlap = null;
  let tickerVisible = false;
  let hudVisible = false;
  // 2026-06-17: level 14 silences CMDR voice lines (captions + all SFX/music still play). Set via
  // setMuteCmdrVO() from startLevel; reset in clearGameplayEntities on every level transition/exit.
  let muteCmdrVO = false;
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

  // 2026-06-17: SPC (Specialist) bonus VO. On levels where SPC owns the comm portrait (currently
  // L14; _spcMode), praise / timer / struggle lines swap to her recorded bonus files instead of
  // CMDR's. Files live in vo/SPC_*.mp3. spcBonusVoSrc() returns a path only while SPC is on-screen,
  // so callers fall back to the CMDR line everywhere else. POOL_SPC_PRAISE shuffles like CMDR pools.
  const SPC_BONUS_AVAILABLE = new Set([
    "SPC_crushing_it.mp3",
    "SPC_boom_like_that.mp3",
    "SPC_there_you_go.mp3",
    "SPC_amazing.mp3",
    "SPC_show_boss.mp3",
    "SPC_lets_get_after_it.mp3",
    "SPC_timer_warning.mp3",
    "SPC_not_doing_hot.mp3",
  ]);
  const POOL_SPC_PRAISE = [
    "SPC_crushing_it.mp3",
    "SPC_boom_like_that.mp3",
    "SPC_there_you_go.mp3",
    "SPC_amazing.mp3",
    "SPC_show_boss.mp3",
    "SPC_lets_get_after_it.mp3",
  ];

  const VO_CAPTIONS = {
    // 2026-06-17: SPC bonus-line captions (shown on the comm ticker while her audio plays).
    "SPC_crushing_it.mp3": "YOU'RE CRUSHING IT, CADET.",
    "SPC_boom_like_that.mp3": "BOOM! I LIKE THAT!",
    "SPC_there_you_go.mp3": "THERE YOU GO!",
    "SPC_amazing.mp3": "AMAZING!",
    "SPC_show_boss.mp3": "YOU SHOW HIM WHO'S BOSS.",
    "SPC_lets_get_after_it.mp3": "LET'S GET AFTER IT, CADET!",
    "SPC_timer_warning.mp3": "YOU'RE RUNNING OUT OF TIME, CADET.",
    "SPC_not_doing_hot.mp3": "YOU'RE NOT DOING SO HOT, CADET.",
    // 2026-06-15: level 15 finale (Part 8). Audio is a placeholder (Poly records gauntlet_intro.mp3);
    // until then this caption shows in the comm box.
    "gauntlet_intro.mp3": "THIS IS IT CADET. THE GAUNTLET. GIVE IT EVERYTHING YOU'VE GOT.",
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

  // 2026-06-15: Stunt Mode swaps the commander portrait for SPC. While an override is set,
  // the normal frame cycling (idle/talk/react) is a no-op so the SPC image stays pinned.
  let portraitOverride = null;
  const callsignEl = () => document.getElementById("commanderCallsign");

  // 2026-06-16: SPC animated-portrait state. `_spcMode` is true while the SPC override owns the
  // portrait; speech runs a mouth-flap through talk frames, and an idle blink ticks between lines.
  let _spcMode = false;
  let _spcRestFrame = "smile_wide";    // idle frame returned to after a line / blink
  let _spcLastFrameHint = null;        // frameHint of the most recently started line (for spcSpeakEnd)
  let _spcSpeaking = false;
  let _spcMouthFlap = null;
  let _spcBlinkTimer = null;
  // Pending blink/rest restorations from _spcDoBlink — tracked so _spcStopBlink can cancel them.
  // Without this, a comm interrupting mid-blink leaves the portrait stuck on the blink frame.
  let _spcBlinkTimeouts = [];
  // The base talking cycle (mouth-flap) when no expression hint is supplied.
  // 2026-06-18: phoneme cycling (NOT true lip-sync) — cycle mouth-shape frames while audio plays.
  // Amplitude/AnalyserNode-driven lip-sync is a deferred post-ship upgrade.
  const SPC_TALK_CYCLE = ["talk_happy", "talk_mid", "talk_neutral", "talk_st"];
  // Weighted random picker for default-mode flap. Expression-hinted flaps bypass this.
  function _spcPickTalkFrame() {
    const r = Math.random();
    if (r < 0.22) return "talk_happy";
    if (r < 0.44) return "talk_mid";
    if (r < 0.66) return "talk_neutral";
    if (r < 0.88) return "talk_st";
    if (r < 0.98) return "idle_neutral"; // occasional closed-mouth rest beat
    return "idle_gentle";                // rare blink-while-talking
  }
  // Expression hints flap between the emotion frame and a matching talk frame so the portrait
  // both holds the mood AND moves its mouth while the line plays. Single-entry sets are held.
  // All mouth frames must exist on disk (talk_calm/friendly/ah/smile are missing — not used here).
  const SPC_EXPR_FLAP = {
    // 2026-06-20 (Item 6): praise was a 2-frame ["praise","talk_happy"] loop — too fast at 125ms and
    // the brow delta between the two frames read as erratic eyebrows. Give it the same closed-mouth
    // multi-frame treatment the talk_* hints use: hold the impressed/happy brow, open the mouth, then
    // rest closed before reopening, so the talking reads naturally into the impressed end-settle.
    praise:      ["praise", "talk_happy", "impressed_smile", "impressed_smile", "talk_happy"],
    smile_wide:  ["smile_wide", "talk_happy"],
    smile_open:  ["smile_open", "talk_happy"],
    idle_smirk:  ["idle_smirk", "talk_neutral"],
    idle_gentle: ["idle_gentle", "talk_neutral"],
    idle_soft:   ["idle_soft", "talk_neutral"],
    idle_warm:   ["idle_warm", "talk_happy"],
    alert:       ["alert", "talk_neutral"],
    laugh:       ["laugh", "talk_happy"],
    shades:      ["shades"], // held "cool" closing pose — no flap
  };

  // Part 4: set a single SPC frame directly (no-op unless SPC owns the portrait + frame loaded).
  // 2026-06-20 (Items 4/5): treat a *failed-to-load* frame as missing too. A broken Image still
  // has a truthy .src, so the old `!img.src` guard let setSpcFrame assign a 404'd URL — which
  // tripped portrait.onerror → SPC_PLACEHOLDER (the teal "SPC" box). Detecting `complete &&
  // naturalWidth === 0` makes any absent frame fall back to the rest pose instead.
  const _spcImgBroken = (img) => !img || !img.src || (img.complete && img.naturalWidth === 0);
  function setSpcFrame(key) {
    if (!_spcMode || !portrait) return;
    let img = spcImages[key];
    if (_spcImgBroken(img)) img = spcImages.smile_wide; // missing/broken frame → rest pose
    if (_spcImgBroken(img)) return;
    portrait.src = img.src;
  }

  function _spcStopFlap() {
    if (_spcMouthFlap) { clearInterval(_spcMouthFlap); _spcMouthFlap = null; }
  }
  function _spcStopBlink() {
    if (_spcBlinkTimer) { clearTimeout(_spcBlinkTimer); _spcBlinkTimer = null; }
    for (const t of _spcBlinkTimeouts) clearTimeout(t);
    _spcBlinkTimeouts.length = 0;
  }
  // Part 6: periodic blink while idle (every 3-5s, 120ms), only when not speaking.
  // One blink "event" — weighted toward a single blink, occasionally a double/triple flutter.
  function _spcDoBlink() {
    if (!_spcMode || _spcSpeaking) return;
    const base = _spcRestFrame || "smile_wide";
    const at = (fn, t) => _spcBlinkTimeouts.push(setTimeout(fn, t)); // tracked so it's cancellable
    const rest = () => { if (_spcMode && !_spcSpeaking) setSpcFrame(base); };
    if (base === "shades") {
      // shades_blink is a single composite frame — no mid/down split
      const blink = () => { if (_spcMode && !_spcSpeaking) setSpcFrame("shades_blink"); };
      const r = Math.random();
      if (r < 0.6) { blink(); at(rest, 120); }
      else if (r < 0.9) { blink(); at(rest, 120); at(blink, 220); at(rest, 340); }
      else { blink(); at(rest, 120); at(blink, 200); at(rest, 320); at(blink, 400); at(rest, 520); }
      return;
    }
    // Two-phase blink: "blink" (mid/half-closed, transition down) → "blink_down" (eyes fully closed).
    const mid  = () => { if (_spcMode && !_spcSpeaking) setSpcFrame("blink"); };
    const down = () => { if (_spcMode && !_spcSpeaking) setSpcFrame("blink_down"); };
    const r = Math.random();
    if (r < 0.6) {
      // single (60%): mid→down→rest
      mid(); at(down, 40); at(rest, 130);
    } else if (r < 0.9) {
      // double (30%)
      mid(); at(down, 40); at(rest, 130); at(mid, 230); at(down, 270); at(rest, 360);
    } else {
      // triple (10%)
      mid(); at(down, 40); at(rest, 130); at(mid, 230); at(down, 270); at(rest, 360); at(mid, 430); at(down, 470); at(rest, 560);
    }
  }

  function _spcStartBlink() {
    _spcStopBlink();
    if (!_spcMode) return;
    const schedule = () => {
      _spcBlinkTimer = setTimeout(() => {
        _spcDoBlink();
        schedule();
      }, 3000 + Math.random() * 2000);
    };
    schedule();
  }

  // Part 4/5: begin the talking animation for one SPC line. `frameHint` picks the mood.
  function spcSpeakStart(frameHint) {
    if (!_spcMode) return;
    _spcStopBlink();
    _spcStopFlap();
    _spcSpeaking = true;
    _spcLastFrameHint = frameHint || null;
    _spcRestFrame = "smile_wide"; // default rest; idle_* hints (below) make the mood linger after the line
    let frames;
    if (frameHint && SPC_EXPR_FLAP[frameHint]) {
      frames = SPC_EXPR_FLAP[frameHint];
      if (frameHint.indexOf("idle_") === 0 || frameHint === "shades") _spcRestFrame = frameHint;
    } else if (frameHint && spcImages[frameHint]) {
      // a talk_* (or other loaded) hint: lead with it, vary the mouth, include a closed-mouth rest beat.
      // idle_neutral is repeated so the closed mouth holds for 2 ticks (~250ms) — a single 125ms tick
      // is too brief to read clearly as "mouth closed".
      frames = [frameHint, "talk_neutral", "idle_neutral", "idle_neutral", "talk_happy"];
    } else {
      frames = SPC_TALK_CYCLE;
    }
    setSpcFrame(frames[0]);
    if (frames.length === 1) return; // held expression — no mouth flap
    let i = 0;
    // 2026-06-20: ~125ms (8fps) phoneme cycle while the line plays (cleared by spcSpeakEnd on audio end).
    // Was 120ms — slowed slightly so the flap reads as natural speech rather than a fast flutter.
    _spcMouthFlap = setInterval(() => {
      if (frames === SPC_TALK_CYCLE) {
        setSpcFrame(_spcPickTalkFrame());
      } else {
        i += 1;
        setSpcFrame(frames[i % frames.length]);
      }
    }, 125);
  }

  // End of a line (or whole queue): stop the flap, settle on the rest frame, resume blinking.
  function spcSpeakEnd() {
    _spcStopFlap();
    _spcSpeaking = false;
    const wasPraise = _spcLastFrameHint === "praise";
    _spcLastFrameHint = null;
    if (wasPraise) {
      // Impressed end sequence: settle on a reaction frame, blink 2-4 times with the
      // "impressed" blink pair, then return to default idle and resume normal blinking.
      const settleFrame = Math.random() < 0.5 ? "impressed_smile" : "impressed_ah";
      setSpcFrame(settleFrame);
      const numBlinks = 2 + Math.floor(Math.random() * 3); // 2, 3, or 4
      let delay = 400; // pause before first blink
      for (let bi = 0; bi < numBlinks; bi += 1) {
        const blinkFr = bi % 2 === 0 ? "impressed_blink1" : "impressed_blink2";
        _spcBlinkTimeouts.push(setTimeout(() => { if (_spcMode) setSpcFrame(blinkFr); }, delay));
        delay += 150;
        _spcBlinkTimeouts.push(setTimeout(() => { if (_spcMode) setSpcFrame(settleFrame); }, delay));
        delay += 300;
      }
      _spcBlinkTimeouts.push(setTimeout(() => {
        if (!_spcMode) return;
        _spcRestFrame = "smile_wide";
        setSpcFrame("smile_wide");
        _spcStartBlink();
      }, delay + 150));
    } else {
      setSpcFrame(_spcRestFrame || "smile_wide");
      _spcStartBlink();
    }
  }

  // 2026-06-16: pin SPC to a held idle pose (e.g. "shades") with no dialogue and resume the
  // matching blink cycle (_spcStartBlink reads _spcRestFrame → "shades" blinks via shades_blink).
  // Practice mode uses this to keep SPC sitting "cool" while the player practices.
  function setSpcIdle(key) {
    if (!_spcMode) return;
    _spcStopFlap();
    _spcSpeaking = false;
    _spcRestFrame = key || "smile_wide";
    setSpcFrame(_spcRestFrame);
    _spcStartBlink();
  }

  // teal placeholder shown if vo/spc_portrait.png is missing (data-URI so no extra request)
  const SPC_PLACEHOLDER =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      "<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'>" +
      "<rect width='120' height='120' fill='#031313'/>" +
      "<rect x='3' y='3' width='114' height='114' fill='none' stroke='#00d4d4' stroke-width='2'/>" +
      "<text x='60' y='70' font-family='monospace' font-size='30' font-weight='bold' " +
      "fill='#00e8e8' text-anchor='middle'>SPC</text></svg>",
    );

  function setPortraitOverride(src, callsign = "SPC") {
    portraitOverride = src || SPC_PLACEHOLDER;
    _spcMode = true;
    _spcRestFrame = "smile_wide";
    _spcSpeaking = false;
    const cs = callsignEl();
    if (cs) cs.textContent = callsign;
    if (portrait) {
      portrait.onerror = () => { portrait.onerror = null; portrait.src = SPC_PLACEHOLDER; };
      // prefer the animated SPC idle frame when available; fall back to the static override src
      portrait.src = (spcImages.smile_wide && spcImages.smile_wide.src) ? spcImages.smile_wide.src : portraitOverride;
    }
    // 2026-06-18: stop any already-running CMDR idle loop — its tickIdle() feeds idle/blink frames
    // through setFrame → spcSpeakEnd() and would kill the SPC mouth-flap mid-line. SPC runs its own
    // blink via _spcStartBlink. (show() also gates startIdle while portraitOverride is set.)
    stopIdle();
    _spcStartBlink();
  }

  function clearPortraitOverride() {
    portraitOverride = null;
    _spcMode = false;
    _spcSpeaking = false;
    _spcStopFlap();
    _spcStopBlink();
    if (portrait) portrait.onerror = null;
    const cs = callsignEl();
    if (cs) cs.textContent = "CMDR";
    setFrame("idle");
    // 2026-06-18: CMDR is back — resume its idle loop if the HUD is showing (mirrors the stopIdle in
    // setPortraitOverride). startIdle() no-ops if already running.
    if (hudVisible) startIdle();
  }

  function isVOActive() {
    return _voPlaying || _voQueue.length > 0;
  }

  // 2026-06-15: tutorial "cutscene" — slide the whole comm HUD to screen-center, then back to
  // its normal bottom-left dock. The base position lives in the inline style (bottom:20px;left:16px).
  function setCommCenter(on) {
    if (!hud) return;
    hud.style.transition = "left .55s ease, top .55s ease, bottom .55s ease, transform .55s ease";
    if (on) {
      hud.style.left = "50%";
      hud.style.bottom = "auto";
      hud.style.top = "34%";
      hud.style.transform = "translate(-50%, -50%) scale(1.06)";
      // 2026-06-15: the ticker is absolutely anchored to the RIGHT of the portrait (left:128px),
      // and it's position:absolute so it doesn't count toward the HUD's width — centering the HUD
      // only centered the 120px portrait, leaving the 260px ticker hanging off the right edge.
      // For the centered cutscene, dock the ticker BELOW the portrait, centered under it, so it
      // stays fully on-screen. setCommCenter(false) restores the normal right-dock.
      if (ticker) {
        ticker.style.transition =
          "left .55s ease, top .55s ease, bottom .55s ease, opacity .2s ease, transform .2s ease";
        ticker.style.left = "-70px"; // (120/2) - (260/2): center the 260px ticker under the 120px portrait
        // 2026-06-20 (Item 3b): derive the gap from the portrait's rendered height (SPC frame caps
        // at max-height:180px → 192px) instead of hardcoding, so it tracks the portrait. Fall back
        // to 180 if the image hasn't laid out yet (offsetHeight 0) so we never collapse to 12px.
        ticker.style.top = `${(portrait?.offsetHeight || 180) + 12}px`;
        ticker.style.bottom = "auto";
      }
    } else {
      hud.style.left = "16px";
      hud.style.top = "auto";
      hud.style.bottom = "20px";
      hud.style.transform = "none";
      if (ticker) {
        ticker.style.left = "128px";
        ticker.style.top = "auto";
        ticker.style.bottom = "0";
      }
    }
  }

  // 2026-06-20: dim/hide the comm box while a pause overlay is up. The comm box is z-index:9000
  // (above the arcade pause overlay), so on the first training step — where setCommCenter(true)
  // centers it — the centered portrait paints OVER the "Resume" button, hiding it. Fading the HUD
  // to opacity:0 lets the overlay/Resume button read cleanly; resume restores it. Opacity (not
  // display:none) preserves the centered/docked layout so no position state needs tracking.
  function setHudDimmed(on) {
    if (!hud) return;
    hud.style.transition = "opacity .2s ease";
    hud.style.opacity = on ? "0" : "1";
  }

  function setFrame(key) {
    if (portraitOverride) {
      // 2026-06-16: on SPC levels (13/14) the CMDR VO mouth-flap drives the portrait through
      // setFrame(); instead of no-oping, route those calls into the SPC talking loop so SPC's
      // mouth actually moves while CMDR lines play. Talk frames → SPC talk cycle; everything
      // else (idle/blink/reaction) → settle back to idle_smile + blink. The _spcSpeaking guard
      // keeps the 180ms CMDR flap from restarting the SPC flap on every tick.
      if (_spcMode) {
        const talking = typeof key === "string" && key.indexOf("talk") !== -1;
        if (talking) {
          if (!_spcSpeaking) spcSpeakStart();
        } else if (_spcSpeaking) {
          spcSpeakEnd();
        }
      }
      return;
    }
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

  // 2026-06-20 (Item 5): parse **bold** markers into visible-text segments. The marker chars are
  // NOT visible and never enter the char-by-char slice math, so the type-on reveal can't land
  // mid-tag. Marker-free strings collapse to a single non-bold segment (zero change for CMDR/etc.).
  function parseTickerSegments(str) {
    const segs = [];
    const re = /\*\*([^*]+)\*\*/g;
    let last = 0, m;
    while ((m = re.exec(str))) {
      if (m.index > last) segs.push({ text: str.slice(last, m.index), bold: false });
      segs.push({ text: m[1], bold: true });
      last = m.index + m[0].length;
    }
    if (last < str.length) segs.push({ text: str.slice(last), bold: false });
    if (segs.length === 0) segs.push({ text: str, bold: false });
    return segs;
  }

  function typeText(lines) {
    if (!tickerText) return;
    const token = ++typingToken;
    const raw = Array.isArray(lines) ? lines.join(" ") : (lines || "");
    const segments = parseTickerSegments(raw);
    const total = segments.reduce((n, s) => n + s.text.length, 0);
    tickerText.innerHTML = "";
    let i = 0;
    // Part 2: the printtext SFX fires once at the START of the type-on animation (not the end),
    // at 80% of its prior volume (0.5 → 0.4) so it underscores the line beginning to print.
    if (total) { try { window.playGameSfx?.("printtext", 0.4); } catch {} }

    // Build HTML for the first n VISIBLE chars. Bold runs are wrapped in <b>…</b> within this single
    // build (always balanced — never mid-tag); the n-th char gets the glowing lead style, earlier
    // chars the dim color (same look as the prior clean typewriter).
    function render(n) {
      let out = "";
      let shown = 0;
      for (const seg of segments) {
        if (shown >= n) break;
        const take = Math.min(seg.text.length, n - shown);
        const chunk = seg.text.slice(0, take);
        const start = shown;
        shown += take;
        const leadHere = (n - 1) >= start && (n - 1) < start + take;
        // 2026-06-20 redesign: white fill on the new dark panel (the cyan glow is
        // inherited from #commanderTickerText in CSS); bold weapon names get pure
        // white + extra glow via #commanderTickerText b. Lead char keeps a bright pop.
        const bodyColor = seg.bold ? "#ffffff" : "#EFFFFF";
        let html;
        if (leadHere) {
          const rest = chunk.slice(0, -1);
          const lead = chunk.slice(-1);
          html =
            `<span style="color:${bodyColor}">${rest}</span>` +
            `<span style="color:#ffffff;text-shadow:0 0 8px #00ffee">${lead}</span>`;
        } else {
          html = `<span style="color:${bodyColor}">${chunk}</span>`;
        }
        out += seg.bold ? `<b>${html}</b>` : html;
      }
      tickerText.innerHTML = out;
    }

    function step() {
      if (token !== typingToken) return;
      if (i <= total) {
        render(i);
        i++;
        setTimeout(step, 22 + Math.random() * 18);
      } else {
        // final static state: full text, white fill (cyan glow from CSS), bold runs wrapped
        let out = "";
        for (const seg of segments) {
          const html = `<span style="color:${seg.bold ? "#ffffff" : "#EFFFFF"}">${seg.text}</span>`;
          out += seg.bold ? `<b>${html}</b>` : html;
        }
        tickerText.innerHTML = out;
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

  // 2026-06-13: Stunt Mode — show a ticker line that stays put (cancels any pending auto-hide)
  // so a tutorial instruction persists until the step is done. `isTickerVisible` lets the
  // stunt loop re-pin the line if anything (e.g. a future VO ending) hides it.
  function pinTicker(text) {
    if (tickerHideTimer) { clearTimeout(tickerHideTimer); tickerHideTimer = null; }
    showTicker();
    typeText(text);
  }

  function isTickerVisible() {
    return tickerVisible;
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
    // 2026-06-18: while SPC owns the portrait, don't restore the CMDR frame here. currentFrame is
    // stale at a non-talk frame ("idle") the whole time portraitOverride is set (setFrame early-
    // returns under override without updating currentFrame), so setFrame(currentFrame) routes into
    // the SPC branch → spcSpeakEnd() → kills the mouth-flap. pumpSpc() calls show() before EVERY
    // line, so this tore the flap down on every line boundary (verified on-device). SPC manages its
    // own frames; only restore the CMDR frame in normal mode.
    if (!portraitOverride) setFrame(currentFrame || "idle");
    // 2026-06-18: likewise don't run the CMDR idle loop while SPC owns the portrait — tickIdle's
    // idle/blink frames route through setFrame → spcSpeakEnd() and kill the flap. SPC drives its own
    // blink via _spcStartBlink. L13/14 still settles via the explicit tickIdle() at the end of a
    // CMDR VO line; normal CMDR mode is unchanged.
    if (!portraitOverride) startIdle();
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
      if (voAudioFxCleanup) { voAudioFxCleanup(); voAudioFxCleanup = null; }
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

  // 2026-06-17: SPC bonus-line source. Returns a vo/SPC_*.mp3 path ONLY while SPC owns the
  // portrait (_spcMode), so gameplay callers transparently fall back to CMDR off SPC levels.
  function spcBonusVoSrc(filename) {
    if (!_spcMode) return null;
    return SPC_BONUS_AVAILABLE.has(filename) ? `vo/${filename}` : null;
  }

  function triggerVO({
    lines = [],
    audioSrc = null,
    duration = 3500,
    frame = null,
    event = null,
    onDone = null,
    _onEnd = null,
    _spc = false,
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
      if (voAudioFxCleanup) { voAudioFxCleanup(); voAudioFxCleanup = null; }
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
      if (triggerToken !== _voTriggerToken) return;
      if (talkingEnded) return;
      talkingEnded = true;
      if (voAudioFxCleanup) { voAudioFxCleanup(); voAudioFxCleanup = null; }
      voAudio = null;
      stopMouthFlap();
      tickIdle();
      tickerHideTimer = setTimeout(() => {
        hideTicker();
        finish();
      }, 1800); // Part 3: +50% so captions linger longer before auto-hiding
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
          voAudio.preload = "auto";
          voAudio.playsInline = true;
          // 2026-06-17: L14 mutes CMDR voice (caption still types), but SPC's own bonus lines
          // (_spc) bypass the mute so the Specialist is actually heard on her level.
          voAudio.volume = (muteCmdrVO && !_spc) ? 0 : (_spc ? 0.85 : 0.7);
          voAudioFxCleanup = applyCommRadioEffect(voAudio, { enabled: !(muteCmdrVO && !_spc) });
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

  // 2026-06-15: while Stunt Mode owns the comm box, only SPC speaks — drop every other
  // (CMDR) line so gameplay praise/reactions never interleave with the tutorial.
  let _exclusiveSpeaker = false;
  function setExclusiveSpeaker(on) {
    _exclusiveSpeaker = !!on;
    if (on) { _voQueue.length = 0; }
  }

  // 2026-06-21 (Item 1b): level-end VO lock. From the "level complete" trigger until the next
  // level actually starts, the ONLY line allowed through is the single levelcomplete praise —
  // every incidental line (plasma recharged, UFO spotted, ambient praise, queue stragglers, and
  // any scheduled-timer VO that fires during the scorecard) is dropped at this chokepoint.
  let _levelEndLock = false;
  function setLevelEndLock(on) {
    _levelEndLock = !!on;
    if (on) { _voQueue.length = 0; } // flush incidental stragglers queued before the level ended
  }

  function queueVO(options = {}) {
    if (_exclusiveSpeaker && !options._spc) return;
    // Level-end window: let only the one levelcomplete praise speak (see setLevelEndLock).
    if (_levelEndLock && options.event !== "levelcomplete") return;
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
    spcBonusVoSrc,
    isSpcMode: () => _spcMode,
    setMuteCmdrVO: (on) => { muteCmdrVO = !!on; },
    pinTicker,
    hideTicker,
    isTickerVisible,
    setPortraitOverride,
    clearPortraitOverride,
    setSpcFrame,
    setSpcIdle,
    spcSpeakStart,
    spcSpeakEnd,
    setExclusiveSpeaker,
    setLevelEndLock,
    setCommCenter,
    setHudDimmed,
    isVOActive,
    setDamageState,
    reactTo,
    pickFromPool,
    POOL_LEVEL_START,
    POOL_LEVEL_COMPLETE,
    POOL_NICE_SHOT,
    POOL_HYPE,
    POOL_SPC_PRAISE,
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
  _freezeFilter: null,  // 2026-06-17: highpass (low-cut) in the freeze bandpass chain
  _freezeFilter2: null, // 2026-06-17: lowpass (high-cut) in the freeze bandpass chain
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
  async playMusic(key, url, { crossfadeMs = 250, volume = 1 } = {}) {
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
      node.volume = state.whisper ? 0.43 : Math.min(1, MUSIC_MAX_GAIN * volume);
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
    gain.gain.linearRampToValueAtTime(volume, now + crossfadeMs / 1000);
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
    // 2026-06-16: pause / Modes overlay ducks the music to 0.4 (not silent) so it stays present
    // under the menu; the app-switch (visibilitychange hide) path dims harder, to 0.1.
    if (this.currentMusicHtml?.node) {
      const full = state.whisper ? 0.43 : MUSIC_MAX_GAIN;
      this.currentMusicHtml.node.volume = dimOn ? (full * 0.4) : full;
    }
    this.ensureMusic();
    if (!this.musicGain || !this.ctx) return;
    const target = dimOn ? MUSIC_MAX_GAIN * 0.4 : MUSIC_MAX_GAIN;
    const now = this.ctx.currentTime;
    this.musicGain.gain.cancelScheduledValues(now);
    this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, now);
    this.musicGain.gain.linearRampToValueAtTime(target, now + 0.12);
  },
  // 2026-06-17: freeze music FX — splice a bandpass chain (highpass 50Hz → lowpass 600Hz)
  // into musicGain→masterGain so the music sounds icy/muffled while the field is frozen.
  // Only the Web Audio path is filtered; the HTML-audio fallback is unaffected.
  applyFreezeFilter() {
    this.ensureMusic();
    if (!this.ctx || !this.musicGain || this._freezeFilter) return;
    const dest = this.masterGain || this.ctx.destination;
    const hp = this.ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 50;
    hp.Q.value = 0.7;
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 600;
    lp.Q.value = 0.7;
    hp.connect(lp);
    lp.connect(dest);
    try { this.musicGain.disconnect(dest); } catch { /* ignore */ }
    this.musicGain.connect(hp);
    this._freezeFilter = hp;
    this._freezeFilter2 = lp;
  },
  removeFreezeFilter() {
    if (!this._freezeFilter || !this.ctx || !this.musicGain) {
      this._freezeFilter = null;
      this._freezeFilter2 = null;
      return;
    }
    const dest = this.masterGain || this.ctx.destination;
    try { this.musicGain.disconnect(this._freezeFilter); } catch { /* ignore */ }
    try { this._freezeFilter.disconnect(); } catch { /* ignore */ }
    try { this._freezeFilter2?.disconnect(); } catch { /* ignore */ }
    this.musicGain.connect(dest);
    this._freezeFilter = null;
    this._freezeFilter2 = null;
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

function makeCommRadioCurve(amount = 18) {
  const samples = 256;
  const curve = new Float32Array(samples);
  const deg = Math.PI / 180;
  for (let i = 0; i < samples; i += 1) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
  }
  return curve;
}

function applyCommRadioEffect(audioNode, { enabled = true } = {}) {
  if (!enabled || !audioNode) return null;
  try {
    const ctx = audioEngine.ensureContext?.();
    if (!ctx || !audioEngine.masterGain) return null;
    if (ctx.state !== "running") return null;
    const source = ctx.createMediaElementSource(audioNode);
    const highpass = ctx.createBiquadFilter();
    const lowpass = ctx.createBiquadFilter();
    const drive = ctx.createWaveShaper();
    const compressor = ctx.createDynamicsCompressor();
    const output = ctx.createGain();

    highpass.type = "highpass";
    highpass.frequency.value = 420;
    highpass.Q.value = 0.7;
    lowpass.type = "lowpass";
    lowpass.frequency.value = 3600;
    lowpass.Q.value = 0.9;
    drive.curve = makeCommRadioCurve(14);
    drive.oversample = "2x";
    compressor.threshold.value = -24;
    compressor.knee.value = 18;
    compressor.ratio.value = 5;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.12;
    output.gain.value = 0.92;

    source.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(drive);
    drive.connect(compressor);
    compressor.connect(output);
    output.connect(audioEngine.masterGain);

    return () => {
      try { source.disconnect(); } catch {}
      try { highpass.disconnect(); } catch {}
      try { lowpass.disconnect(); } catch {}
      try { drive.disconnect(); } catch {}
      try { compressor.disconnect(); } catch {}
      try { output.disconnect(); } catch {}
    };
  } catch {
    return null;
  }
}

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
  // 2026-06-16: procedural Oracle starfield removed — the Oracle page background is now the
  // looping MP4 (#oracleBgVideo → assets/video/oracle_bg.mp4). initGalaxyBackground() (and its
  // #galaxyCanvas element) are gone; the gameplay level-video stack is unaffected.
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
      if (!state.minimal) triggerHapticImpact(hapticImpactStyle.Medium);
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
    orb.addEventListener("pointerdown", onOrbRubStart);
    orb.addEventListener("pointermove", onOrbRubMove, { passive: false });
    orb.addEventListener("pointerup", onOrbRubEnd);
    orb.addEventListener("pointercancel", onOrbRubEnd);
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
    orb.addEventListener("touchstart", onOrbRubStart, { passive: false });
    orb.addEventListener("touchmove", onOrbRubMove, { passive: false });
    orb.addEventListener("touchend", (event) => {
      const now = performance.now();
      if (now - lastOrbTouchEndAt < 320 && event.cancelable) event.preventDefault();
      lastOrbTouchEndAt = now;
    }, { passive: false });
    orb.addEventListener("touchcancel", onOrbRubEnd);
    orb.addEventListener("mousedown", onOrbTap);
  }
  orb.addEventListener("touchend", onOrbRubEnd);

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
    // During training the Modes button pauses (with a Resume) instead of tearing the session down.
    if (galaxyCanvasController?.isTutorialActive?.()) {
      galaxyCanvasController.pauseTutorial?.();
      return;
    }
    // During endless Practice the Modes button exits straight back to the Stunt Mode menu (Part 8).
    if (galaxyCanvasController?.isPracticeEndless?.()) {
      galaxyCanvasController.exitStuntPractice?.();
      return;
    }
    galaxyCanvasController?.showModeSelect?.({ preserveArcade: true, openArcadeMenu: true });
  });

  // Auto-pause training when the app is backgrounded (fixes the "came back to limbo" case).
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (galaxyCanvasController?.isTutorialActive?.()
          && !galaxyCanvasController?.isTutorialPaused?.()) {
        galaxyCanvasController.pauseTutorial?.();
      }
      return;
    }
    // Returning to foreground — re-prime audio so SFX/VO aren't silent in training/practice (Part 6).
    galaxyCanvasController?.onAppForeground?.();
  });

  // While training is paused, the pause overlay accepts a double-tap OR a downward swipe to resume.
  if (arcadeOverlay) {
    let _ovTapAt = 0;
    let _ovSwipeY = null;
    const ovResume = () => {
      if (galaxyCanvasController?.isTutorialPaused?.()) galaxyCanvasController.resumeTutorial?.();
    };
    arcadeOverlay.addEventListener("pointerdown", (e) => {
      if (!galaxyCanvasController?.isTutorialPaused?.()) return;
      _ovSwipeY = e.clientY;
      const t = performance.now();
      if (t - _ovTapAt < 320) { _ovTapAt = 0; ovResume(); } else { _ovTapAt = t; }
    });
    arcadeOverlay.addEventListener("pointerup", (e) => {
      if (!galaxyCanvasController?.isTutorialPaused?.() || _ovSwipeY == null) return;
      if (e.clientY - _ovSwipeY > 70) ovResume(); // downward swipe
      _ovSwipeY = null;
    });
  }

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
      const nowF = performance.now();
      if (nowF - _lastFreezeToggleAt < 500) return; // 500ms debounce
      _lastFreezeToggleAt = nowF;
      galaxyCanvasController?.activateFreeze?.();
    });
  }
  if (hudMissileBtn) {
    hudMissileBtn.addEventListener("click", () => {
      // 2026-06-14: arm missile aim mode; the next tap on the play area sets the target.
      galaxyCanvasController?.toggleMissileAim?.();
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
  if (btnArcadeStunt) {
    // 2026-06-15: Stunt Mode now opens a sub-menu (Training / Practice) instead of launching directly.
    btnArcadeStunt.addEventListener("click", () => galaxyCanvasController?.showStuntModeMenu?.());
  }
  if (btnStuntTraining) {
    btnStuntTraining.addEventListener("click", () => galaxyCanvasController?.startStuntMode?.());
  }
  if (btnStuntPractice) {
    btnStuntPractice.addEventListener("click", () => galaxyCanvasController?.startStuntPractice?.());
  }
  if (btnStuntBack) {
    btnStuntBack.addEventListener("click", () => galaxyCanvasController?.showModeSelect?.());
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
    // Closing settings: kill any in-progress voice preview so it doesn't
    // keep playing after the panel is gone.
    stopVoicePreview();
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
  // 2026-06-18: the "← Oracle" back button bypassed tutorial/practice teardown — commBoxController.hide()
  // only flushes the CMDR VO queue, leaving the SPC queue/audio playing and the portrait hijacked.
  // Route a live tutorial/practice through the canonical teardown (cleanupTutorial + clearPortraitOverride).
  if (galaxyCanvasController?.isTutorialActive?.() || galaxyCanvasController?.isPracticeEndless?.()) {
    galaxyCanvasController.showModeSelect?.({ preserveArcade: false });
  }
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

  revealAudio.volume = state.whisper ? 0.3 : 0.72;
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

  const answerLine = pickCanonicalAnswer();
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
    // 2026-06-15: reveal SFX levels pulled down a touch and normalized so the spoken
    // question/answer (TTS at full volume, fired after these) reads clearly over the bed.
    audioEngine.play(SFX.MAIN, { volume: 0.82, rate: 1.0 });

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
    audioEngine.play(pre, { volume: 0.78, rate: 1.0 });
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
    const barRevealHandle = audioEngine.play(SFX.PRE_B, { volume: 0.82, rate: 1.0 }); // FIXED 2026-06-08: was PRE_A (duplicate)
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
    // Bridge the dead air inside the answer box: finishReveal fires one sparkle burst,
    // then keep the box sparkling continuously through the strobe wind-down + hold so it
    // never sits blank before the answer pops with the big sparkle + sound below.
    const answerSpark = setInterval(
      () => spawnAnswerSparkles(prefersReducedMotion ? 4 : 8, 1.05),
      130,
    );
    // Soft shimmer bed under the sparkle bridge — rings out into the POST hit on reveal.
    audioEngine.play(SFX.SHIMMER, { volume: 0.4, rate: 0.96 });
    // FIXED 2026-06-08: early stopCrystalOverlay() removed — finally block handles it
    await stopOrbStrobeCadence(false);
    await delay(420);
    clearInterval(postSpark);
    clearInterval(answerSpark);
    setAnswerTextVisible(true);
    setRevealBgStrobe(false);
    triggerAnswerTextRevealFx();
    audioEngine.play(SFX.POST, { volume: 0.85, rate: 1.0 });
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

// === Orb "rub" interaction =================================================
// Press and drag on the orb: a bright tip follows the finger and leaves behind
// glow marks that bloom and fade over a couple seconds, while a low magical drone
// pulses until release. Additive to the existing orb tap; reveal is untouched.
const ORB_RUB_PULSE_EDGE = 1.25; // drone/haptic pulse Hz at the orb edge (slow)
const ORB_RUB_PULSE_CENTER = 3.2; // pulse Hz dead-center (fast)
const orbRub = document.getElementById("orbRub");
let orbRubbing = false;
let orbRubLastX = 0;
let orbRubLastY = 0;
let orbRubTravel = 0;
let orbRubDroneTimer = null;
let orbRubHapticTimer = null;
let orbRubPulseHz = ORB_RUB_PULSE_EDGE;

// A self-contained Web Audio drone: low oscillators warmed by a lowpass filter,
// amplitude pulsed by a slow LFO (the "WOOM…WOOM" swell). Routed through the
// engine's masterGain so it respects master volume / whisper.
const orbRubDrone = {
  nodes: null,
  start() {
    if (this.nodes) return;
    const ctx = audioEngine.ensureContext?.();
    if (!ctx || !audioEngine.masterGain) return;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const now = ctx.currentTime;

    const out = ctx.createGain();
    out.gain.value = 0;
    out.connect(audioEngine.masterGain);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 480;
    filter.Q.value = 7;
    filter.connect(out);

    // Tremolo gain swung by the LFO -> the pulse.
    const trem = ctx.createGain();
    trem.gain.value = 0.55;
    trem.connect(filter);

    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = orbRubPulseHz; // pulse rate (Hz) — varies with finger position
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.42; // pulse depth
    lfo.connect(lfoGain);
    lfoGain.connect(trem.gain);

    const osc1 = ctx.createOscillator();
    osc1.type = "sine";
    osc1.frequency.value = 60; // deep woom
    const osc2 = ctx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.value = 90; // body
    osc2.detune.value = -7;
    const osc3 = ctx.createOscillator();
    osc3.type = "triangle";
    osc3.frequency.value = 121; // faint shimmer harmonic
    const osc3Gain = ctx.createGain();
    osc3Gain.gain.value = 0.16;

    osc1.connect(trem);
    osc2.connect(trem);
    osc3.connect(osc3Gain);
    osc3Gain.connect(trem);

    const target = state.whisper ? 0.18 : 0.36;
    out.gain.setValueAtTime(0, now);
    out.gain.linearRampToValueAtTime(target, now + 0.28);

    [osc1, osc2, osc3, lfo].forEach((o) => o.start(now));
    this.nodes = { ctx, out, osc1, osc2, osc3, lfo };
  },
  setPulseRate(hz) {
    const n = this.nodes;
    if (!n) return;
    try {
      n.lfo.frequency.setTargetAtTime(hz, n.ctx.currentTime, 0.08);
    } catch { /* ignore */ }
  },
  stop() {
    const n = this.nodes;
    if (!n) return;
    this.nodes = null;
    const { ctx, out } = n;
    const now = ctx.currentTime;
    out.gain.cancelScheduledValues(now);
    out.gain.setValueAtTime(out.gain.value, now);
    out.gain.linearRampToValueAtTime(0, now + 0.24);
    const stopAt = now + 0.28;
    [n.osc1, n.osc2, n.osc3, n.lfo].forEach((o) => { try { o.stop(stopAt); } catch { /* ignore */ } });
    setTimeout(() => { try { out.disconnect(); } catch { /* ignore */ } }, 500);
  },
};

function orbRubPoint(event) {
  const rect = orb.getBoundingClientRect();
  const touch = event.touches?.[0] || event.changedTouches?.[0];
  const clientX = event.clientX ?? touch?.clientX ?? 0;
  const clientY = event.clientY ?? touch?.clientY ?? 0;
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  const cx = rect.width / 2;
  const cy = rect.height / 2;
  const radius = Math.min(cx, cy) || 1;
  // 0 = dead center, 1 = at/past the orb edge.
  const centerRatio = clamp(Math.hypot(x - cx, y - cy) / radius, 0, 1);
  return { clientX, clientY, x, y, centerRatio };
}

// Closer to the center → faster pulse. Updates both the drone LFO and haptic cadence.
function updateOrbRubPulse(centerRatio) {
  orbRubPulseHz = ORB_RUB_PULSE_CENTER + (ORB_RUB_PULSE_EDGE - ORB_RUB_PULSE_CENTER) * centerRatio;
  orbRubDrone.setPulseRate(orbRubPulseHz);
}

function scheduleRubHaptic() {
  orbRubHapticTimer = setTimeout(() => {
    orbRubHapticTimer = null;
    if (!orbRubbing) return;
    if (!state.minimal) triggerHapticImpact(hapticImpactStyle.Heavy);
    scheduleRubHaptic();
  }, Math.max(120, 1000 / orbRubPulseHz));
}

// 2026-06-15: a second looping layer (orb_rub2.mp3) sits on top of the synth drone for a
// richer rub texture. Plain looping <audio> (matches revealAudio); volume respects whisper.
// Halved from the first cut (was 0.45/0.18) and long-ramped in/out so it never cuts off.
// Each NEW rub restarts the clip from the top (a paused <audio> resumes mid-clip otherwise);
// the seek is done while silenced so the restart isn't audible. `orbRub2Active` keeps the
// continuous-rub case (beginRubFeedback fires repeatedly on drag) from re-seeking → stutter.
let orbRub2Audio = null;
let orbRub2FadeTimer = null;
let orbRub2Active = false;
const orbRub2TargetVol = () => (state.whisper ? 0.063 : 0.154); // 2026-06-17: -30% on the rub layer
const ORB_RUB2_FADE_IN_MS = 750;
const ORB_RUB2_FADE_OUT_MS = 950;

// Ramp orbRub2 volume toward `target` over `ms` (setInterval — <audio>.volume has no ramp).
function fadeOrbRub2(target, ms, onDone) {
  if (!orbRub2Audio) return;
  if (orbRub2FadeTimer) { clearInterval(orbRub2FadeTimer); orbRub2FadeTimer = null; }
  const stepMs = 30;
  const start = orbRub2Audio.volume;
  const steps = Math.max(1, Math.round(ms / stepMs));
  let i = 0;
  orbRub2FadeTimer = setInterval(() => {
    i += 1;
    const t = Math.min(1, i / steps);
    if (orbRub2Audio) orbRub2Audio.volume = clamp(start + (target - start) * t, 0, 1);
    if (t >= 1) {
      clearInterval(orbRub2FadeTimer);
      orbRub2FadeTimer = null;
      onDone?.();
    }
  }, stepMs);
}

function startOrbRub2Loop() {
  try {
    if (!orbRub2Audio) {
      orbRub2Audio = new Audio("gamesfx/orb_rub2.mp3");
      orbRub2Audio.loop = true;
    }
    if (orbRub2Active) return; // already running this rub — let the loop continue, don't re-seek
    orbRub2Active = true;
    if (orbRub2FadeTimer) { clearInterval(orbRub2FadeTimer); orbRub2FadeTimer = null; }
    orbRub2Audio.volume = 0;             // silence first so the restart-from-top seek is inaudible
    try { orbRub2Audio.currentTime = 0; } catch { /* ignore */ }
    if (orbRub2Audio.paused) orbRub2Audio.play().catch(() => {});
    fadeOrbRub2(orbRub2TargetVol(), ORB_RUB2_FADE_IN_MS); // long fade in
  } catch { /* ignore */ }
}
function stopOrbRub2Loop() {
  if (!orbRub2Audio || !orbRub2Active) return;
  orbRub2Active = false;
  fadeOrbRub2(0, ORB_RUB2_FADE_OUT_MS, () => {
    // Only pause if another rub didn't start during the fade-out (which flips Active back on).
    if (!orbRub2Active) { try { orbRub2Audio.pause(); } catch { /* ignore */ } }
  });
}

// Start the drone + the synced hard-pulse haptic loop (both idempotent).
function beginRubFeedback() {
  orbRubDrone.start();
  startOrbRub2Loop();
  if (!orbRubHapticTimer) scheduleRubHaptic();
}

function stopRubFeedback() {
  orbRubDrone.stop();
  stopOrbRub2Loop();
  clearTimeout(orbRubHapticTimer);
  orbRubHapticTimer = null;
}

function placeOrbRubGlow(x, y) {
  if (!orbRub) return;
  orbRub.style.left = `${x}px`;
  orbRub.style.top = `${y}px`;
}

// Drop a glow mark (orb-relative coords) that blooms + fades, then removes itself.
function spawnRubMark(x, y) {
  if (!orb) return;
  const mark = document.createElement("span");
  mark.className = "orb-rub-mark";
  mark.style.left = `${x}px`;
  mark.style.top = `${y}px`;
  orb.appendChild(mark);
  mark.addEventListener("animationend", () => mark.remove());
}

function onOrbRubStart(event) {
  if (state.isRevealing || !orbRub) return;
  const p = orbRubPoint(event);
  orbRubbing = true;
  orbRubLastX = p.x;
  orbRubLastY = p.y;
  orbRubTravel = 0;
  // 2026-06-15: each rub gets a fresh random hue + linger time. The glow + trail marks read
  // these CSS vars (hue-rotates the base cyan/purple gradient; sets the mark fade duration),
  // so every rub feels different.
  orb.style.setProperty("--rub-hue", `${Math.floor(Math.random() * 360)}deg`);
  orb.style.setProperty("--rub-fade", `${(1.3 + Math.random() * 2.4).toFixed(2)}s`);
  orbRubPulseHz = ORB_RUB_PULSE_CENTER + (ORB_RUB_PULSE_EDGE - ORB_RUB_PULSE_CENTER) * p.centerRatio;
  placeOrbRubGlow(p.x, p.y);
  orb.classList.add("rubbing");
  spawnRubMark(p.x, p.y);
  audioEngine.unlock();
  // Bring the drone + haptic in on a short hold (or first movement) so quick taps stay silent.
  clearTimeout(orbRubDroneTimer);
  orbRubDroneTimer = setTimeout(() => { if (orbRubbing) beginRubFeedback(); }, 150);
  if (event.pointerId !== undefined && orb.setPointerCapture) {
    try { orb.setPointerCapture(event.pointerId); } catch { /* ignore */ }
  }
}

function onOrbRubMove(event) {
  if (!orbRubbing) return;
  if (event.cancelable) event.preventDefault();
  const p = orbRubPoint(event);
  placeOrbRubGlow(p.x, p.y);
  updateOrbRubPulse(p.centerRatio); // faster pulse toward the center
  const dist = Math.hypot(p.x - orbRubLastX, p.y - orbRubLastY);
  orbRubLastX = p.x;
  orbRubLastY = p.y;
  orbRubTravel += dist;
  // Every ~20px of travel: leave a lingering glow mark + a fingertip sparkle.
  if (orbRubTravel >= 20) {
    orbRubTravel = 0;
    spawnRubMark(p.x, p.y);
    if (!prefersReducedMotion) spawnRubSparkle(p.clientX, p.clientY);
    // Movement means a real rub — bring feedback in now if the hold timer hasn't.
    clearTimeout(orbRubDroneTimer);
    beginRubFeedback();
  }
}

function onOrbRubEnd(event) {
  if (!orbRubbing) return;
  orbRubbing = false;
  orb.classList.remove("rubbing");
  clearTimeout(orbRubDroneTimer);
  stopRubFeedback();
  if (event?.pointerId !== undefined && orb.releasePointerCapture) {
    try { orb.releasePointerCapture(event.pointerId); } catch { /* ignore */ }
  }
}

function spawnRubSparkle(clientX, clientY) {
  if (!sparkles || sparkles.childElementCount > 120) return;
  const stageRect = stage.getBoundingClientRect();
  const x = clientX - stageRect.left + (Math.random() - 0.5) * 14;
  const y = clientY - stageRect.top + (Math.random() - 0.5) * 14;
  const sparkle = document.createElement("span");
  const size = 4 + Math.random() * 6;
  sparkle.className = "sparkle";
  sparkle.style.left = `${x}px`;
  sparkle.style.top = `${y}px`;
  sparkle.style.width = `${size}px`;
  sparkle.style.height = `${size}px`;
  sparkle.style.opacity = "0.55";
  sparkle.style.animationDelay = `${Math.random() * 0.1}s`;
  sparkles.appendChild(sparkle);
  sparkle.addEventListener("animationend", () => sparkle.remove());
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
  galaxyCanvasController?.playArcadeMenuMusic?.();
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
  galaxyCanvasController?.playArcadeMenuMusic?.();
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
    // 2026-06-15: don't reload if the element's `autoplay` has already begun fetching/decoding —
    // calling load() here aborts that head start and reintroduces the ~1s first-frame delay on the
    // oracle screen. Only force a load when nothing has started yet (readyState HAVE_NOTHING).
    if (video.readyState === 0) video.load();
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
  // 2026-06-14: normal asteroid drift tops out well under this. Anything flung faster (e.g. by a
  // missile blast knockback) eases back down to this ceiling instead of drifting fast forever.
  const KNOCKBACK_DRIFT_MAX = 90;
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
    missile: "powerups/powerup_missile.png",
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
  // 2026-06-13/2026-06-15: Stunt (tutorial) Mode — gates the timed level loop off (via
  // `stuntActive`) and runs an async phase engine (SPC tutorial) in its place.
  let stuntActive = false;
  let stuntAdvancing = false; // retained: brief lockout used by exit/menu teardown paths
  // 2026-06-15: tutorial phase engine state (see TUTORIAL_PHASES / runTutorial below)
  let tutorialPhase = -1;          // -1 = not running
  let tutorialState = {};          // per-phase mutable scratch
  const tutorialEvents = {};       // event-id -> count, fed by stuntNotify(), read by waitEvent()
  let _tutRunToken = 0;            // bumped on any exit to abort in-flight async phase chains
  let _tutWaiters = [];            // [{ pred, resolve, reject }] polled each frame by updateStunt
  let _tutTimers = [];             // pending waitMs timeouts, cleared on abort
  // SPC voice — captions are pinned directly to the comm ticker (no hide/show flicker between
  // lines) and advance on a tight timer (or audio end when recorded).
  let _spcQueue = [];
  let _spcPlaying = false;
  let _spcTimer = null;
  let _spcAudio = null;
  let _spcAudioFxCleanup = null;
  const SPC_VO_PLAYBACK_RATE = 1.08;
  // 2026-06-20: tail padding added AFTER the rate-adjusted clip length before advancing. Now that
  // the timer is anchored to actual playback start (the 'playing' event), this is true post-audio
  // padding — bumped 250→450ms to absorb iOS media-start jitter. Tune after device testing.
  const SPC_VO_TAIL_MS = 450;
  // 2026-06-17: per-line watchdog — if a line never fires its end/timer (iOS audio quirk), the
  // updateStunt watchdog force-advances via _spcAdvanceFn after _spcLineStartedAt + _spcLineWatchdogMs.
  // 2026-06-18: watchdog is now DYNAMIC — set from the real clip duration once metadata loads, so a
  // long VO (>8s) is never guillotined mid-sentence (the old fixed 8s cut them off).
  let _spcLineStartedAt = 0;
  let _spcAdvanceFn = null;
  let _spcLineWatchdogMs = 8000;
  // Tap-to-skip rework (2026-06-16): the skip hint is subtle + rare — only shown once SPC has been
  // chattering for >3s over a pending player action and the cadet hasn't just interacted.
  let _spcContinuousStartAt = 0;       // when SPC's current uninterrupted talking run began (0 = silent)
  let _spcLinesCompletedThisPhase = 0; // full VO lines finished in the active phase
  let _lastTutInteractionAt = 0;       // last gameplay interaction (play-area press / skip tap)
  let _spcGrabSmallAt = 0;             // 2026-06-17: rate-limit (8s) the "can't grab small stroids" SPC line
  let _skipHintShown = false;          // is the hint currently faded-in?
  let _skipHintHideTimer = null;       // pending 500ms fade-out when SPC goes quiet
  let tutorialBlockPlasmaToss = false; // Phase 2: only the laser is taught — block net/toss
  let tutorialSmallGrabHintEnabled = false; // True only during the dedicated toss instruction.
  let tutorialPaused = false;          // pause menu / app-switch
  let tutorialTimerRunning = false;    // intro: perimeter visibly counts down until timer powerup
  let tutorialTimerStartedAt = 0;
  // Stunt → Practice: endless arcade gameplay (no timer, no level-complete, score not submitted).
  const PRACTICE_ASTEROID_SPRITE_KEYS = ["roid01", "roid02", "roid03", "hotroid01"];
  const PRACTICE_ASTEROID_UNLOCK_MS = 25000;
  const PRACTICE_THEME_INTERVAL_MS = 30000;
  const PRACTICE_POWERUP_INTERVAL_MS = 8000;
  const PRACTICE_POWERUP_POOL = ["bomb", "bomb", "missile", "quadshot", "snowflake"];
  let practiceEndless = false;
  let practiceStartedAt = 0;
  let nextPracticeMineAt = 0; // Part 8: practice drops a fresh landmine on this 60s cadence
  // Practice background theme cycling: blend to the next level's color theme every 30s.
  let practiceThemeIndex = 1; // starts on the L1 theme; cycles 1→2→…→15→1
  let nextThemeCycleAt = 0;
  // SPC_xx.mp3 audio is recorded later; until a key is listed here, the line is text-only.
  // 2026-06-17: SPC VO is recorded — register every vo/SPC_*.mp3 (key = filename minus the
  // SPC_ prefix and .mp3 suffix, e.g. SPC_08-09.mp3 → "08-09"). spcVoSrc() plays vo/SPC_<key>.mp3.
  const SPC_VO_AVAILABLE = new Set([
    "01", "02", "03-04", "05-06a", "06b", "07", "08", "08b", "08c", "12", "13-14", "15-16", "15-16_release", "17", "17b", "18", "19",
    "one_of_our_most_useful_weapons_plasma_net", "to_fire_a_plasma_net_tap_and_drag",
    "20", "21", "22", "23", "24", "25", "26", "27", "28-30", "28-30_part2", "31", "32", "33",
    "34", "35", "36", "35-36", "37", "38", "39", "40", "41", "42-43", "44-45", "46", "47", "48", "49",
    "50", "51", "50-51", "52", "53", "54", "54_alt", "52-54", "55-56", "57", "58", "59", "60", "59-60", "61", "62",
    "62_part1", "63", "63b", "63b_part1", "63b_part2", "64", "65", "66", "67", "68", "69", "70",
    "amazing", "boom_like_that", "crushing_it", "freeze_toggle", "grab_small", "lets_get_after_it",
    "not_doing_hot", "peeing_pants", "show_boss", "there_you_go", "timer_warning",
    "BONUS_001", "BONUS_002", "BONUS_003", "BONUS_006", "BONUS_011", "BONUS_012", "BONUS_016",
    "BONUS_039", "BONUS_057", "BONUS_063", "BONUS_066", "BONUS_075",
  ]);
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
    // 2026-06-14: goldbars dropped 5 to make room for the missile's 15.
    { type: "goldbars", weight: 10 }, // DEBUG: revert before release (normally 25)
    { type: "timer", weight: 25 },
    { type: "quadshot", weight: 25 },
    { type: "snowflake", weight: 40 }, // DEBUG: revert before release (normally 10)
    { type: "bomb", weight: 10 },
    { type: "missile", weight: 15 }, // 2026-06-14: homing missile powerup
  ];
  const POWERUP_COLORS = {
    bomb: "#00ffcc",
    timer: "#ffaa00",
    goldbars: "#ffd700",
    quadshot: "#cc66ff",
    snowflake: "#88ddff",
    missile: "#ffd700", // gold ring glow
  };
  let quadShotUntil = 0;
  const QUADSHOT_SEEK_RADIUS = 120;
  // 2026-06-10: freeze is now a collectible inventory item activated from the HUD (like bombs)
  let playerFreezeInventory = 0;
  const MAX_FREEZE_INVENTORY = 3;
  const FREEZE_DURATION_MS = 12000;
  // 2026-06-21: freeze is a PAUSABLE TIMER, not an on/off toggle. Spending one charge banks
  // FREEZE_DURATION_MS of freeze time; tapping pauses (time stays banked) / resumes (no new charge);
  // the freeze fully ends only when the bank drains to 0 (auto-expiry) or the level resets.
  let _freezeBankMs = 0;        // remaining banked freeze time (ms); 0 == nothing to resume
  let _freezeActive = false;    // true == freeze running (clock paused); false == paused or empty
  let _freezeSessionId = 0;     // bumped only on a fresh activation (NOT on resume) — cold-toss gliders
  let goldbarsForceSpawnedThisLevel = false; // DEBUG: revert before release
  let bombAimMode = false;
  // 2026-06-14: homing missile powerup — inventory, targeting + single in-flight missile.
  let playerMissileInventory = 0;
  const MAX_MISSILE_INVENTORY = 3;
  let missileReloadUntil = 0;
  const MISSILE_RELOAD_MS = 1500;
  let missileAimMode = false;
  let missileCrosshair = null; // { x, y, placedAt } flashing blast-zone target marker
  let activeMissile = null; // single in-flight missile entity (max 1)
  // 2026-06-14: asteroids caught in a missile blast are split a few per frame (not all at once)
  // to avoid the single-frame hitch — entries are { a, cx, cy, r }. Drained by stepMissileSplitQueue.
  let missileSplitQueue = [];
  const MISSILE_SPLITS_PER_FRAME = 2;
  // 2026-06-16: deferred mine-chain queue. A detonating mine used to recursively explode every
  // mine it caught (explodeMineEntity → chainDetonateMines → explodeMineEntity → …). On the dense
  // L12/L15 clusters — and whenever a missile/bomb caught several mines at once — that nesting
  // overflowed the stack and froze the game. Now a caught mine is removed from its container
  // immediately and queued here; processPendingExplosions() drains it in the update loop, so each
  // blast fully completes before the next begins (flat iteration, never nested).
  const pendingExplosions = []; // entries: { mine, source: "landmine" | "placed" }
  const MINE_CHAIN_PER_FRAME = 2;
  let missileImpactFlash = null; // { x, y, start } localized impact flash, drawn in drawMissileFx
  let missileForceSpawnedThisLevel = false; // DEBUG: revert before release
  // 2026-06-16: per-level emergency timer drop — on the listed levels, when the clock first
  // dips under 20s with no timer powerup on screen, force one out (reset in clearGameplayEntities).
  let emergencyTimerSpawned = false;
  const EMERGENCY_TIMER_LEVELS = [6, 9, 11, 14, 15];
  // 2026-06-16: cfg.guaranteedSpawn = [{type, atMs}] — force-spawn a powerup once its atMs elapses.
  // Tracks which entries (by index) have already fired this level.
  const firedGuaranteedSpawns = new Set();
  // 2026-06-16: cfg.speedEscalation (L15) — live asteroids ramp speed with elapsed time. We track
  // the last-applied factor and scale all asteroids by the per-tick delta ratio (clamped to 2.5x).
  let appliedSpeedEscalation = 1;
  // missile blast = 50% of the bomb's full blast radius (explodeMineEntity uses 700)
  const MISSILE_BLAST_RADIUS = 350;
  // DEBUG: revert before release — missile unlocks at level >= 5 (currently >= 1)
  const missileUnlocked = (level) => level >= 1;
  let nextBombPowerupAt = performance.now()
    + BOMB_POWERUP_INTERVAL_MIN
    + Math.random() * (BOMB_POWERUP_INTERVAL_MAX - BOMB_POWERUP_INTERVAL_MIN);

  function pickPowerupType(level = 99) {
    // 2026-06-14: the missile only enters the pool once unlocked for this level.
    const pool = POWERUP_WEIGHTS.filter(
      (w) => w.type !== "missile" || missileUnlocked(level),
    );
    const total = pool.reduce((s, w) => s + w.weight, 0);
    let roll = Math.random() * total;
    for (let i = 0; i < pool.length; i += 1) {
      roll -= pool[i].weight;
      if (roll <= 0) return pool[i].type;
    }
    return "bomb";
  }

  // 2026-06-15: a level can restrict the powerup pool via cfg.powerupOverride (a list of types,
  // e.g. ["timer","quadshot"] or ["missile"]). When set, pick uniformly from that list and bypass
  // the normal weights/missile gate. Otherwise fall back to the weighted pool.
  function pickPowerupForLevel(cfg) {
    const override = cfg?.powerupOverride;
    if (Array.isArray(override) && override.length > 0) {
      return override[(Math.random() * override.length) | 0];
    }
    return pickPowerupType(cfg?.level ?? 99);
  }

  // 2026-06-16: shared powerup spawn helper. Powerups were previously pushed inline in several
  // places (normal cadence, debug force-spawns); this centralizes the entity shape and accepts the
  // human-friendly "freeze" alias for the snowflake (freeze) powerup used in level powerupOverrides.
  function spawnPowerupAt(type, pt = randomPowerupPoint()) {
    const normalized = type === "freeze" ? "snowflake" : type;
    powerups.push({
      type: normalized,
      x: pt.x,
      y: pt.y,
      r: 22,
      spawnedAt: performance.now(),
      opacity: 1.0,
    });
    return powerups[powerups.length - 1];
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
  // 2026-06-16: recurring mid-level mine drops on the mineLaunch levels (L12/L13/L15) — set in
  // startLevel after the initial launch, checked in the main spawn-timer block.
  let nextMineRespawnAt = 0;
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
    // Keep enabled while there's banked time to pause/resume, even with empty inventory.
    hudFreezeBtn.disabled = !hasFreezes && _freezeBankMs <= 0;
    hudFreezeBtn.classList.toggle("has-freezes", hasFreezes);
  }

  // 2026-06-14: homing missile inventory button — count, gray/active/pulse states, plus a
  // thin reload progress bar (0→full over MISSILE_RELOAD_MS). Called on collect/fire and every
  // arcade frame so the reload bar + ready-pulse stay live.
  function updateHudMissileInventory() {
    if (!hudMissileBtn) return;
    const nowM = performance.now();
    const count = playerMissileInventory;
    const has = count > 0;
    const reloading = nowM < missileReloadUntil;
    hudMissileBtn.style.display = "";
    const label = `\u{1F680} \xD7${count}`;
    if (hudMissileCount && hudMissileCount.textContent !== label) {
      hudMissileCount.textContent = label;
    }
    // can't fire with no stock, while reloading, or while a missile is already in flight
    hudMissileBtn.disabled = !has || reloading || !!activeMissile;
    hudMissileBtn.classList.toggle("has-missiles", has && !reloading);
    hudMissileBtn.classList.toggle("reloading", reloading);
    // pulse only when reload is complete, a missile is stocked, none in flight, not aiming
    hudMissileBtn.classList.toggle(
      "missile-ready",
      has && !reloading && !activeMissile && !missileAimMode,
    );
    if (hudMissileReload) {
      const prog = reloading
        ? clamp(1 - (missileReloadUntil - nowM) / MISSILE_RELOAD_MS, 0, 1)
        : (has ? 1 : 0);
      hudMissileReload.style.width = `${(prog * 100).toFixed(1)}%`;
    }
  }

  // Quadshot HUD badge — existing powerup art with seconds remaining while the effect runs.
  // Called every update frame; only touches the DOM when the displayed second changes.
  function updateHudQuadBadge() {
    if (!hudQuadBadge) return;
    const remaining = quadShotUntil - performance.now();
    const active = remaining > 0;
    hudQuadBadge.classList.toggle("active", active);
    hudQuadBadge.setAttribute("aria-hidden", active ? "false" : "true");
    if (active && hudQuadTime) {
      const label = `${Math.ceil(remaining / 1000)}s`;
      if (hudQuadTime.textContent !== label) hudQuadTime.textContent = label;
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
    // 2026-06-17: a level can boost its music via cfg.musicVolume (e.g. L6 = 1.15).
    const volume = ARCADE_LEVELS.find((l) => l.level === levelNum)?.musicVolume || 1;
    audioEngine.playMusic(url, url, { crossfadeMs: 250, volume });
    const nextUrl = getMusicForLevel(levelNum + 1);
    if (nextUrl && nextUrl !== url) {
      audioEngine.loadMusicBuffer(nextUrl).catch(() => {});
    }
  }

  function playArcadeMenuMusic() {
    audioEngine.unlock();
    audioEngine.playMusic("ARCADE_MENU", MUSIC.ARCADE_MENU, { crossfadeMs: 250, volume: 1 });
    audioEngine.loadMusicBuffer(getMusicForLevel(1)).catch(() => {});
    audioEngine.loadMusicBuffer(getMusicForLevel(0)).catch(() => {});
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
    // Part 8: Practice shows "PRACTICE" where the level number normally goes.
    if (hudLevel) hudLevel.textContent = practiceEndless
      ? "PRACTICE"
      : `LEVEL ${ARCADE_LEVELS[currentLevelIndex]?.level || 1}`;
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
    const showStunt = mode === "stunt";
    if (btnArcade) btnArcade.style.display = showRoot ? "" : "none";
    if (btnPractice) btnPractice.style.display = showRoot ? "" : "none";
    // 2026-06-14: Stunt Mode is a top-level mode now (Select Mode menu), not under Arcade
    if (btnArcadeStunt) btnArcadeStunt.style.display = showRoot ? "" : "none";
    if (btnScores) btnScores.style.display = showRoot ? "" : "none";
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
    if (stuntModeMenuPanel) {
      stuntModeMenuPanel.hidden = !showStunt;
      stuntModeMenuPanel.classList.toggle("show", showStunt);
      stuntModeMenuPanel.setAttribute("aria-hidden", showStunt ? "false" : "true");
    }
  }

  // 2026-06-15: Stunt Mode sub-menu — Training (always available) + Practice (unlocked after
  // training completes, tracked via localStorage poly_stunt_training_complete).
  function showStuntModeMenu() {
    setArcadeSubmenu("stunt");
    if (btnStuntPractice) {
      const unlocked = isStuntTrainingComplete();
      btnStuntPractice.disabled = !unlocked;
      btnStuntPractice.classList.toggle("locked", !unlocked);
    }
    // 2026-06-16: play the tutorial track while the Stunt Mode menu is open. playMusic is a no-op
    // when the same track is already current, so it carries seamlessly into Training (which also
    // calls playArcadeMusicForLevel(0)). Back → showModeSelect() stops the music on exit.
    playArcadeMusicForLevel(0);
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
    // 2026-06-15: show the level's label (e.g. "BOOM CADET") under the LEVEL number when set.
    const introCfg = ARCADE_LEVELS.find((l) => l.level === levelNum);
    arcadeOverlaySub.textContent = introCfg?.label || "";
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
    a._coldTossSession = 0;
    delete a._preTossVx;
    delete a._preTossVy;
    delete a._tutLaserBoosted; // tutorial laser-phase low-count speed boost flag (must not persist on pool reuse)
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
    // 2026-06-15: second-act per-level tints (Part 3). Level 10 stays untinted (hotroid sprite).
    if (level === 11) return "rgba(160,160,160,0.25)"; // void grey
    if (level === 12) return "rgba(0,255,200,0.22)";   // cyberpunk cyan
    if (level === 13) return "rgba(220,0,0,0.30)";     // virtual boy red
    if (level === 14) return "rgba(0,180,60,0.22)";    // forest green
    if (level === 15) return "rgba(255,140,0,0.30)";   // inferno orange
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

  // 2026-06-15: a point inside the playfield, clear of the center where the ship sits, so a
  // freshly-seeded asteroid never spawns on top of the player. Used to mix interior spawns
  // into the early levels (they used to enter only from the rim, which read as empty).
  function randomInteriorPoint(minCenterDist = 130) {
    const cx = sim.width / 2;
    const cy = sim.height / 2;
    const inset = 30;
    const minX = playfield.x + inset;
    const maxX = playfield.x + playfield.w - inset;
    const minY = playfield.y + inset;
    const maxY = playfield.y + playfield.h - inset;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const x = minX + Math.random() * Math.max(1, maxX - minX);
      const y = minY + Math.random() * Math.max(1, maxY - minY);
      if (Math.hypot(x - cx, y - cy) >= minCenterDist) return { x, y };
    }
    const ang = Math.random() * Math.PI * 2;
    return {
      x: clamp(cx + Math.cos(ang) * minCenterDist, minX, maxX),
      y: clamp(cy + Math.sin(ang) * minCenterDist, minY, maxY),
    };
  }

  // 2026-06-15: powerups used to spawn at a hardcoded y:140 margin that ignored the real HUD
  // height + safe-area inset, so on notched devices a powerup (e.g. the missile) could land
  // UNDER the HUD where its collect-tap is eaten by the HUD overlay. Spawn inside the computed
  // playfield (already HUD-aware) instead, inset by the sprite's half-size so it stays fully
  // tappable.
  function randomPowerupPoint(r = POWERUP_SPRITE_SIZE / 2) {
    const margin = r + 10;
    const minX = playfield.x + margin;
    const maxX = playfield.x + playfield.w - margin;
    const minY = playfield.y + margin;
    const maxY = playfield.y + playfield.h - margin;
    return {
      x: minX + Math.random() * Math.max(1, maxX - minX),
      y: minY + Math.random() * Math.max(1, maxY - minY),
    };
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

  function spawnAsteroid(x, y, kind = 3, warp = true, spriteKeyOverride = null) {
    if (sim.asteroids.length >= sim.maxAsteroids) return null;
    const a = getAsteroid();
    const r = kind === 3 ? 26 + Math.random() * 12 : kind === 2 ? 18 + Math.random() * 8 : 10 + Math.random() * 6;
    // 2026-06-15: per-level asteroidSpeedMult (levels 13-15 ramp this up). Defaults to 1.
    const levelCfg = engineMode === "arcade" ? ARCADE_LEVELS[currentLevelIndex] : null;
    // 2026-06-16: on speedEscalation levels (L15) mid-level spawns join at the current ramp factor
    // so they aren't conspicuously slower than the asteroids already on screen.
    const escMult = levelCfg?.speedEscalation ? appliedSpeedEscalation : 1;
    const speedMult = (levelCfg?.asteroidSpeedMult || 1) * escMult;
    const speed = (kind === 3 ? 18 + Math.random() * 20 : kind === 2 ? 28 + Math.random() * 27 : 45 + Math.random() * 35) * speedMult;
    const v = randomVelocity(speed * 0.8, speed);
    a.x = x;
    a.y = y;
    a.vx = v.vx;
    a.vy = v.vy;
    a.r = r;
    a.mass = r * r;
    a.kind = kind;
    const levelNum = engineMode === "arcade" ? (ARCADE_LEVELS[currentLevelIndex]?.level || 1) : 1;
    a.spriteKey = spriteKeyOverride || getAsteroidSpriteKeyForLevel(levelNum);
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

  // 2026-06-15: pick a spawn kind from cfg.asteroidKinds (repeats in the array act as weights,
  // e.g. [3,3,2] = mostly large). Falls back to kind 3 (large) when a level declares no kinds.
  function pickAsteroidKind(cfg) {
    const kinds = cfg?.asteroidKinds;
    if (Array.isArray(kinds) && kinds.length > 0) {
      return kinds[(Math.random() * kinds.length) | 0];
    }
    return 3;
  }

  // Practice rotates asteroid ART independently of numeric kind, which remains size/physics only.
  // Unlock one additional sprite every 25 seconds, then pick uniformly from all unlocked art.
  function pickPracticeAsteroidSpriteKey(now = performance.now()) {
    const elapsedMs = Math.max(0, now - practiceStartedAt);
    const unlockedKindCount = clamp(
      1 + Math.floor(elapsedMs / PRACTICE_ASTEROID_UNLOCK_MS),
      1,
      PRACTICE_ASTEROID_SPRITE_KEYS.length,
    );
    return PRACTICE_ASTEROID_SPRITE_KEYS[(Math.random() * unlockedKindCount) | 0];
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
  function createMineEntity(x, y, fuseMs = LANDMINE_FUSE_MS) {
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
      // 2026-06-15: per-mine armed→detonation fuse (level mines can override via mineFuseMs).
      fuseMs,
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
    // 2026-06-15: a level can explicitly suppress UFOs (cfg.noUfo, e.g. level 14).
    if (cfg?.noUfo) return;
    const level = cfg?.level || 1;
    // 2026-06-10: progressive introduction — no UFOs before level 3, unless a level explicitly
    // schedules one via cfg.ufoSpawnAt.
    if (level < 3 && cfg?.ufoSpawnAt == null) return;
    // 2026-06-15: cfg.ufoSpawnAt is the spawn time in SECONDS into the level (default 10s).
    const delaySec = cfg?.ufoSpawnAt != null ? cfg.ufoSpawnAt : 10;
    arcadeUfoSpawnAt = performance.now() + delaySec * 1000;
    // TODO: dualUfo — requires multi-entity UFO refactor (future session)
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
    // 2026-06-15: during the tutorial only SPC speaks — suppress the CMDR UFO callout.
    if (!stuntActive) {
      commBoxController.reactTo("ufo");
      // FIXED 2026-06-08: removed priority:"high" so UFO comm queues rather than cutting current comm
      commBoxController.queueVO({
        audioSrc: commBoxController.commVoSrc("vo-ufo_spotted_takeemout.mp3"),
        event: "ufo",
      });
    }
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
    // SPC levels: "There you go!" on a UFO kill; CMDR's quick laugh everywhere else.
    if (!queueSpcBonusVO("SPC_there_you_go.mp3")) {
      commBoxController.queueVO({
        audioSrc: commBoxController.commVoSrc("vo-quicklaugh.mp3"),
        event: "levelcomplete",
      });
    }
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
      // 2026-06-15 (Part 6): per-level explosion spark palettes for the second act. Returns the
      // "rgba(r,g,b," prefix (alpha is appended by the caller), matching the sprite branches below.
      const _lvl = engineMode === "arcade" ? (ARCADE_LEVELS[currentLevelIndex]?.level || 1) : 1;
      const lvlPalette = LEVEL_SPARK_COLORS[_lvl];
      if (lvlPalette) return lvlPalette[(Math.random() * lvlPalette.length) | 0];
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

    // 2026-06-16: arcade levels peak at ~13-16 on-screen stroids, where a direct pairwise sweep
    // is both faster AND allocation-free. The spatial grid below churns a fresh `new Set()` plus
    // brand-new bucket arrays (`cells[key] = []`) every frame — GC pressure that only earns its
    // keep at large N. That churn was a contributor to the L6 hitch (first level stacking UFO +
    // mines + powerups on the field). Use the grid only when the field is genuinely crowded.
    if (count <= 48) {
      for (let i = 0; i < count; i += 1) {
        const a = sim.asteroids[i];
        if (a.tossed || a._stroidHeld) continue;
        for (let j = i + 1; j < count; j += 1) {
          const b = sim.asteroids[j];
          if (b.tossed || b._stroidHeld) continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          if ((dx * dx) + (dy * dy) > 40000) continue;
          resolveCircleCollision(a, b, 0.92);
        }
      }
      for (let i = 0; i < count; i += 1) {
        wrapEntity(sim.asteroids[i]);
        clampSpeed(sim.asteroids[i]);
      }
      return;
    }

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
    if (tutorialBlockPlasmaToss) return false; // tutorial laser step only teaches the laser
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
    // flame) instead of dropping dead in place. Mines keep their drop-in-place lob. Quick taps
    // (never grabbed) fall through to handleArcadeTap.
    // 2026-06-13: the cold toss drifts in the AIM ARROW direction (grab→drag vector, exactly what
    // the on-screen arrow draws), falling back to the pre-grab drift, then straight up. It becomes
    // a plain cold DRIFTER — NOT a `tossed` projectile — so it neither flames nor self-destructs on
    // the toss timeout the way a real flick does; it just floats off and wraps like any asteroid.
    const slowTossFallback = () => {
      if (isMine || !stroidToss.grabbed) return false;
      let dnx = 0;
      let dny = -1; // default: straight up from the grab point
      const adx = stroidToss.dragX - stroidToss.grabX;
      const ady = stroidToss.dragY - stroidToss.grabY;
      const al = Math.hypot(adx, ady);
      if (al > 8) {
        dnx = adx / al; dny = ady / al; // aim arrow direction
      } else {
        const pvx = entity._preTossVx || 0;
        const pvy = entity._preTossVy || 0;
        const pl = Math.hypot(pvx, pvy);
        if (pl > 1) { dnx = pvx / pl; dny = pvy / pl; } // pre-grab drift
      }
      entity.vx = dnx * STROID_TOSS_SLOW_SPEED;
      entity.vy = dny * STROID_TOSS_SLOW_SPEED;
      entity._stroidHeld = false;
      delete entity._preTossVx;
      delete entity._preTossVy;
      // 2026-06-13: a cold drift released DURING a snowflake freeze must still glide (it's a
      // deliberate player action, like a flicked toss flying through a frozen field) instead of
      // hanging motionless. Tag it with the current freeze session so it glides through THIS freeze
      // only (pause/resume keep the same session); a brand-new freeze (new session id) re-freezes it.
      entity._coldTossSession = _freezeSessionId;
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

  // 2026-06-13: full-destroy a stroid on the ice (no split) — shared by the cold-glide-vs-frozen
  // overlap below. playSound=false on the second of a pair so freeze_explode only fires once.
  function shatterFrozenStroid(a, playSound) {
    const x = a.x;
    const y = a.y;
    const kind = a.kind || 1;
    const spriteKey = a.spriteKey;
    if (!removeAsteroidRef(a)) return false;
    spawnExplosion(x, y, kind >= 3 ? 28 : kind === 2 ? 18 : 12, false, kind >= 3 ? 1.6 : 1.1, 1, kind, spriteKey);
    addFrozenShatterFx(x, y, playSound); // ice particles (+ freeze_explode when playSound)
    addArcadeScore(arcadeMultiplierPoints(kind >= 2 ? 25 : 10));
    trackKillStreak();
    return true;
  }

  // 2026-06-13: while the field is frozen, idle stroids are stationary and resolveAsteroidCollisions
  // is skipped — so a cold-drift toss gliding through (see _coldTossSession) would silently OVERLAP a
  // frozen rock. Instead, shatter BOTH on the ice: freeze_explode + ice flash + ice particles.
  function updateColdTossFreezeCollision(now) {
    for (let i = 0; i < sim.asteroids.length; i += 1) {
      const g = sim.asteroids[i];
      // not a live cold glider: needs an active freeze AND a session tag matching the current freeze
      if (g.tossed || !_freezeActive || g._coldTossSession !== _freezeSessionId) continue;
      for (let j = 0; j < sim.asteroids.length; j += 1) {
        const other = sim.asteroids[j];
        if (!other || other === g) continue;
        // split children appear at the impact point — don't instantly re-shatter them
        if (other.spawnedAtMs && now - other.spawnedAtMs < 250) continue;
        if (Math.hypot(other.x - g.x, other.y - g.y) > g.r + other.r) continue;
        cssFlash("rgba(170,238,255,1)", 0.22, 200);
        cssShake(0.7);
        triggerGameplayHapticImpact(hapticImpactStyle.Medium);
        shatterFrozenStroid(g, true);
        shatterFrozenStroid(other, false);
        break; // g is gone — stop scanning targets for it
      }
    }
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
      // SPC levels: her praise pool stands in for the CMDR "hype" line.
      if (!queueSpcPraiseVO()) {
        commBoxController.queueVO({
          audioSrc: commBoxController.commVoSrc(
            commBoxController.pickFromPool("hype", commBoxController.POOL_HYPE),
          ),
          event: "smirk",
        });
      }
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

  // 2026-06-17: SPC bonus VO helpers. On SPC levels (currently L14) the Specialist's recorded
  // bonus lines stand in for the CMDR praise/timer/struggle lines. Each returns true when it has
  // handled the moment with an SPC line, so the caller skips its CMDR queueVO; returns false off
  // SPC levels so CMDR plays as before.
  function suppressIncidentalVO() {
    return stuntActive || practiceEndless;
  }
  function queueSpcBonusVO(filename, opts = {}) {
    if (suppressIncidentalVO()) return true;
    const src = commBoxController.spcBonusVoSrc(filename);
    if (!src) return false;
    commBoxController.queueVO({ audioSrc: src, _spc: true, priority: opts.priority });
    return true;
  }
  function queueSpcPraiseVO() {
    if (!commBoxController.isSpcMode()) return false;
    const file = commBoxController.pickFromPool("spcPraise", commBoxController.POOL_SPC_PRAISE);
    return queueSpcBonusVO(file);
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
    if (stuntActive) return;
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
            // SPC levels: her praise pool stands in for the CMDR "cocky" line.
            if (queueSpcPraiseVO()) return;
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
          // SPC levels: her praise pool stands in for the CMDR "nice shot" line.
          if (!queueSpcPraiseVO()) {
            commBoxController.queueVO({
              audioSrc: commBoxController.commVoSrc(
                commBoxController.pickFromPool("niceshot", commBoxController.POOL_NICE_SHOT),
              ),
              event: "smirk",
            });
          }
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
    const parentSpriteKey = a.spriteKey;
    const parentSpeed = Math.sqrt(a.vx * a.vx + a.vy * a.vy);
    addArcadeScore(arcadeMultiplierPoints(wasKind >= 2 ? 25 : 10));
    releaseAsteroid(a);
    trackKillStreak();

    if (wasKind > 1) {
      const childCount = wasKind === 3 ? (3 + Math.floor(Math.random() * 3)) : (2 + Math.floor(Math.random() * 2));
      const spawnSplitChild = () => {
        if (sim.asteroids.length >= sim.maxAsteroids) return false;
        const child = spawnAsteroid(
          baseX,
          baseY,
          wasKind - 1,
          false,
          practiceEndless ? parentSpriteKey : null,
        );
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
    spawnExplosion(baseX, baseY, bigBlast ? 32 : 16, false, bigBlast ? 1.8 : 1.15, ttlScale, wasKind, parentSpriteKey);
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
        triggerGameplayHapticImpact(hapticImpactStyle.Medium); // 2026-06-12: net locks on = haptic
      }
      return ready;
    }
    return now >= plasmaCage.cooldownUntil;
  }

  function beginPlasmaCage(start, current, now) {
    if (tutorialBlockPlasmaToss) return false; // tutorial laser step only teaches the laser
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
    playGameSfx("blip", 0.36); // 2026-06-17: -40% so the gun-cock recharge sound stays dominant
    commBoxController.reactTo("plasma_recharged");
    if (now - lastPlasmaRechargedVoAt > 20000 && !suppressIncidentalVO()) {
      // 2026-06-20 (Item 4a): never schedule the orphan recharge-VO timer during training/practice —
      // those modes drive their own VO and the stray timer leaked into the CMDR menu on exit.
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
      if (destroyedCount > 0) stuntNotify("plasma");
      else stuntNotify("plasma_miss"); // tutorial Phase 3 coaching on an empty net
      // In the tutorial a MISSED net stays hot so the cadet can retry immediately — but a
      // SUCCESSFUL net runs the real cooldown so the recharge step (10999-11003) has something
      // to teach. (Force-recharging every net made "let the plasma recharge" resolve instantly.)
      if (stuntActive && destroyedCount === 0) rechargePlasmaNow();
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
      triggerHugeHaptic(); // 2026-06-12: plasma-net blast = big hard rumble
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
    // automatically when the freeze pauses/ends.
    if (_freezeActive && Math.floor(now / 167) % 2 === 0) color = "#ffffff";
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
      // 2026-06-14: an armed bomb detonates on contact ONLY during a decently HARD toss. A
      // drifting armed bomb (never tossed, or a toss that's bled down to a gentle drift) is a
      // physical object that bounces off asteroids — same as an unarmed mine — instead of
      // blowing up on any incidental touch.
      const hardToss = mine._tossActive
        && Math.hypot(mine.vx, mine.vy) >= MINE_TOSS_DETONATE_MIN_SPEED;
      if (armed && hardToss) {
        // chains via explodeMineEntity
        if (armedMineHitsSomething(mine)) {
          explodeFn({ halfRadius: mine.phase === "armed" });
          return true;
        }
      } else {
        // unarmed, or armed-but-drifting: physical object — bounce off asteroids, keep drifting
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
    if (mine.phase === "armed" && now - mine.armedAt >= (mine.fuseMs || 8000)) {
      explodeFn({ halfRadius: true });
      return true;
    }
    if (mine.phase === "player_armed" && now - mine.playerArmedAt >= 6000) {
      explodeFn({ halfRadius: false });
      return true;
    }
    return false;
  }

  // 2026-06-11: an exploding armed mine triggers any other armed mine within range.
  // 2026-06-16: this used to explode each victim INLINE (explodePlacedBomb → explodeMineEntity →
  // chainDetonateMines → …), which recursed and overflowed the stack on dense clusters. It now
  // removes each caught mine from its container immediately (so it can't be re-found, keep running
  // its fuse, or re-trigger itself) and QUEUES it; processPendingExplosions() detonates the queue
  // in the update loop, one batch per frame, with no nesting.
  function chainDetonateMines(x, y, radius) {
    const inRange = (m) => m
      && (m.phase === "armed" || m.phase === "player_armed")
      && Math.hypot(m.x - x, m.y - y) <= radius;
    if (inRange(landmine)) {
      const m = landmine;
      landmine = null;
      stopDangerLoop();
      pendingExplosions.push({ mine: m, source: "landmine" });
    }
    for (let i = placedBombs.length - 1; i >= 0; i -= 1) {
      if (inRange(placedBombs[i])) {
        const m = placedBombs[i];
        placedBombs.splice(i, 1);
        pendingExplosions.push({ mine: m, source: "placed" });
      }
    }
  }

  // 2026-06-16: drain the deferred mine-chain queue from the update loop. Each entry's mine was
  // already pulled from its container at enqueue time, so explodeMineEntity() detonates it directly
  // (and may queue further victims — picked up next frame). Capped per frame so a big chain cascades
  // over a few frames instead of hitching, and can never recurse.
  function processPendingExplosions() {
    let budget = MINE_CHAIN_PER_FRAME;
    while (budget > 0 && pendingExplosions.length) {
      budget -= 1;
      const { mine, source } = pendingExplosions.shift();
      explodeMineEntity(mine, { halfRadius: true });
      if (source === "placed") stuntNotify("bomb");
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
    triggerHugeHaptic(); // 2026-06-12: bomb blast = huge haptic
    playBigBoomSound();
    playGameSfx("bigbang", 1.62);
    // chain: queue other armed mines caught in the blast (the just-exploded mine is already
    // removed from its container by the caller, so it can't re-trigger itself). chainDetonateMines
    // enqueues rather than recursing — processPendingExplosions() detonates them in the update loop.
    chainDetonateMines(x, y, radius * 0.6);
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
    stuntNotify("bomb");
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
    triggerHugeHaptic(); // 2026-06-12: bomb blast = huge haptic
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
    pendingExplosions.length = 0; // 2026-06-16: drop any queued chain detonations
    commBoxController.setMuteCmdrVO(false); // 2026-06-17: un-mute CMDR voice when leaving an SPC level (13/14)
    stopDangerLoop();
    landmineSpawnedThisLevel = false;
    // 2026-06-10: clear powerups, active effects, and aim state on level transitions / menu exit
    powerups.length = 0;
    quadShotUntil = 0;
    // 2026-06-21: discard any banked freeze on level transition (bank does NOT persist across
    // levels). Silent — no unfreeze SFX on a level/menu change — but still tear down the lingering
    // FX (icy music filter + HUD glow) so a level that ends mid-freeze doesn't carry them forward.
    _freezeBankMs = 0;
    _freezeActive = false;
    audioEngine.removeFreezeFilter();
    hudFreezeBtn?.classList.remove("hudFreezeBtn--active");
    goldbarsForceSpawnedThisLevel = false;
    emergencyTimerSpawned = false; // 2026-06-16: re-arm the under-20s emergency timer drop
    firedGuaranteedSpawns.clear(); // 2026-06-16: re-arm cfg.guaranteedSpawn entries
    appliedSpeedEscalation = 1; // 2026-06-16: reset L15 speed ramp
    // 2026-06-14: freeze inventory PERSISTS across levels (matches bomb) — collected freezes
    // carry forward; only a full game reset (startArcadeNew / startStuntMode) zeroes it.
    updateHudFreezeInventory();
    updateHudQuadBadge();
    bombAimMode = false;
    hudBombBtn?.classList.remove("hudBombBtn--aiming");
    // 2026-06-14: clear in-flight homing-missile state on level transitions / menu exit, but the
    // missile INVENTORY persists across levels (matches bomb) — only a full game reset
    // (startArcadeNew / startStuntMode) zeroes it.
    missileReloadUntil = 0;
    missileAimMode = false;
    activeMissile = null;
    missileCrosshair = null;
    missileSplitQueue.length = 0; // drop stale asteroid refs from a queued blast
    missileImpactFlash = null;
    missileForceSpawnedThisLevel = false;
    hudMissileBtn?.classList.remove("hudMissileBtn--aiming");
    updateHudMissileInventory();
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
  let _lvlTransWatch = null;

  function startLevelTransitionWatch(levelIndex) {
    if (_lvlTransWatch?.reportTimer) clearTimeout(_lvlTransWatch.reportTimer);
    _lvlTransWatch = {
      startedAt: performance.now(),
      levelIndex,
      overBudgetFrames: 0,
      droppedFrames: 0,
      worstFrameMs: 0,
      reportTimer: null,
    };
    console.log(`[lvltrans] frame watcher start levelIndex=${levelIndex}`);
  }

  function sampleLevelTransitionFrame(dt, now) {
    const watch = _lvlTransWatch;
    if (!watch || dt <= 32) return;
    watch.overBudgetFrames += 1;
    watch.droppedFrames += Math.max(1, Math.round(dt / (1000 / 60)) - 1);
    watch.worstFrameMs = Math.max(watch.worstFrameMs, dt);
    console.log(`[lvltrans] slow frame dt=${dt.toFixed(1)}ms elapsed=${(now - watch.startedAt).toFixed(1)}ms`);
  }

  function scheduleLevelTransitionReport(delayMs = 500) {
    const watch = _lvlTransWatch;
    if (!watch) return;
    watch.reportTimer = setTimeout(() => {
      if (_lvlTransWatch !== watch) return;
      console.log(
        `[lvltrans] frame watcher report elapsed=${(performance.now() - watch.startedAt).toFixed(1)}ms `
        + `worst=${watch.worstFrameMs.toFixed(1)}ms over32=${watch.overBudgetFrames} dropped=${watch.droppedFrames}`,
      );
      _lvlTransWatch = null;
    }, delayMs);
  }

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
    console.log(`[lvltrans] scorecard overlay appeared level=${levelNum}`);

    // FIX 2026-06-09: make sure a UFO doesn't linger behind the scorecard
    // 2026-06-13: clear ALL gameplay entities (asteroids, flames, powerups, particles, mines…)
    // the moment the scorecard appears so the playfield is empty behind it — they used to linger,
    // still rendering, until the next startLevel() cleared them on dismiss. Idempotent with that.
    clearGameplayEntities();

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
      console.log(`[lvltrans] scorecard dismiss elapsed=${(performance.now() - shownAt).toFixed(1)}ms`);
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
    console.log(`[lvltrans] levelComplete entry levelIndex=${currentLevelIndex}`);
    startLevelTransitionWatch(currentLevelIndex);
    arcadeActive = false;
    retryPending = false;
    // 2026-06-21 (Item 1b): lock the comm box to a single praise line for the whole level-end
    // window (scorecard → next level start). Set BEFORE the levelcomplete VO is queued below so
    // that one line passes; everything else is suppressed. Cleared in startLevel().
    commBoxController.setLevelEndLock(true);
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
    // Final level has no following startLevel(); cover the win transition, then retire the watcher.
    scheduleLevelTransitionReport(3500);
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
          // SPC levels: "You're not doing so hot, Cadet." in place of CMDR's low-lives line.
          if (!queueSpcBonusVO("SPC_not_doing_hot.mp3", { priority: "high" })) {
            commBoxController.queueVO({
              audioSrc: commBoxController.commVoSrc(
                commBoxController.pickFromPool("lowlives", commBoxController.POOL_LOW_LIVES),
              ),
              event: "lowlives",
              priority: "high",
            });
          }
        }
        hideArcadeOverlay();
        // 2026-06-16: the render loop + PIXI can be torn down while the fail overlay is up — e.g.
        // the app is backgrounded at the TIME'S UP screen, where the visibilitychange restore is
        // skipped because it's gated on arcadeActive (false here). startLevel() alone never
        // re-inits the renderer or restarts the loop, so the retried level renders blank (most
        // visible on L15, which is effectively always failed-on-time). Re-init before respawning.
        if (!galaxyRunning) {
          resizeGalaxyCanvas();
          computePlayfield();
        }
        startLevel(currentLevelIndex);
        startGalaxyLoop();
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
    commBoxController.clearPortraitOverride(); // 2026-06-16: restore CMDR if we failed on an SPC level (13/14)
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
    const _lvlTransStartAt = performance.now();
    console.log(`[lvltrans] startLevel entry requestedIndex=${idx}`);
    stuntActive = false; // a real arcade level is never a stunt session
    practiceEndless = false; // ...nor an endless practice session (Stunt Practice re-sets this after)
    commBoxController.setLevelEndLock(false); // 2026-06-21 (Item 1b): next level live — end the level-end VO lock
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
    // 2026-06-15: cfg.powerupIntervalMs gives a level a fixed powerup cadence (e.g. L14 every 10s);
    // otherwise fall back to the default randomized bomb-powerup interval.
    nextBombPowerupAt = cfg.powerupIntervalMs
      ? levelRunStartAt + cfg.powerupIntervalMs
      : levelRunStartAt + BOMB_POWERUP_INTERVAL_MIN
        + Math.random() * (BOMB_POWERUP_INTERVAL_MAX - BOMB_POWERUP_INTERVAL_MIN);
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
    console.log(`[lvltrans] after triggerWarp invoked=${currentLevelIndex > 0}`);
    playArcadeMusicForLevel(cfg.level);
    if (cfg.level === 10) {
      playGameSfx("lastlevelstart", 0.96);
    }
    // 2026-06-15: early levels felt empty when every starting asteroid entered from the rim.
    // Seed a share of them in the interior (clear of the center ship) so the field reads full
    // from the first second. Tapers to 0 once the later levels are naturally busy.
    const _spawnWorkStartAt = performance.now();
    console.log(`[lvltrans] before synchronous spawn work level=${cfg.level} startSpawn=${cfg.startSpawn} mines=${cfg.mineLaunch ? (cfg.mineCount || 1) : 0}`);
    const interiorShare = cfg.level <= 2 ? 0.5 : cfg.level <= 4 ? 0.35 : 0;
    for (let i = 0; i < cfg.startSpawn; i += 1) {
      const p = Math.random() < interiorShare ? randomInteriorPoint() : randomPerimeterPoint();
      spawnAsteroid(p.x, p.y, pickAsteroidKind(cfg), false);
      spawnedTotal += 1;
    }

    // 2026-06-15: cfg.mineLaunch spawns cfg.mineCount mines at level start (into the shared
    // placedBombs array, which already auto-arms + chain-detonates them via updateMineEntity).
    // cfg.mineFuseMs overrides the armed→detonation fuse. This is what powers the L12/L13/L15
    // chain-reaction layouts. Player-placed bombs coexist in the same array.
    if (cfg.mineLaunch) {
      const mineCount = Math.max(1, cfg.mineCount || 1);
      for (let i = 0; i < mineCount; i += 1) {
        const mx = playfield.x + playfield.w * (0.2 + Math.random() * 0.6);
        const my = playfield.y + playfield.h * (0.2 + Math.random() * 0.6);
        const mine = createMineEntity(mx, my, cfg.mineFuseMs || LANDMINE_FUSE_MS);
        // 2026-06-17: stagger spawnedAt so the mines auto-arm in a rolling wave (each arms 4s
        // after the previous) instead of all reaching the 10s auto-arm threshold together.
        mine.spawnedAt = now + i * 4000;
        placedBombs.push(mine);
        addWarpRing(mx, my, "rgba(124,255,91,1)");
      }
      commBoxController.reactTo("landmine");
      playGameSfx("blip1", 0.8, { rate: 1.05 });
      // 2026-06-16: arm the first mid-level mine respawn 20-30s out (recurring drip in the
      // main loop keeps the chain-reaction field replenished after the opening salvo clears).
      nextMineRespawnAt = now + 20000 + Math.random() * 10000;
    }
    console.log(`[lvltrans] after synchronous spawn work duration=${(performance.now() - _spawnWorkStartAt).toFixed(1)}ms asteroids=${sim.asteroids.length} mines=${placedBombs.length}`);

    // TODO: waves — see Level 11 wave system for pattern (cfg.waves not yet wired)

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

    // 2026-06-17: levels 13 & 14 swap the CMDR portrait for SPC. SPC owns the comm box (her bonus
    // VO pool fires via isSpcMode/_spcMode) and CMDR voice lines are muted (see muteCmdrVO below).
    // Every other level clears the override so CMDR is restored (handles in/out + retry/restart).
    const isSpcLevel = cfg.level === 13 || cfg.level === 14;
    if (isSpcLevel) {
      commBoxController.setPortraitOverride(null, "SPC");
      commBoxController.setSpcFrame("smile_wide");
    } else {
      commBoxController.clearPortraitOverride();
    }
    // 2026-06-17: silence CMDR voice on the SPC levels (SPC's face, no CMDR voice). Captions still
    // type, all SFX/music unaffected. Reset to false on every level transition in clearGameplayEntities().
    commBoxController.setMuteCmdrVO(isSpcLevel);

    const levelNum = cfg.level;
    let levelStartVO = null;

    if (levelNum === 1) {
      levelStartVO = "vo-welcometothepolyverse.mp3";
    } else if (levelNum === 5) {
      levelStartVO = "vo-hairytakeemout.mp3";
    } else if (levelNum === 15) {
      // 2026-06-15 (Part 8): final-level commander line. Placeholder audio (vo/gauntlet_intro.mp3)
      // falls back to the VO_CAPTIONS caption until Poly records it.
      levelStartVO = "gauntlet_intro.mp3";
    } else {
      levelStartVO = commBoxController.pickFromPool(
        "levelstart",
        commBoxController.POOL_LEVEL_START,
      );
    }

    // 2026-06-17: delay the first VO 800ms so the level-intro animation finishes before SPC/CMDR
    // starts talking (the comm box was popping up before the level had visually settled).
    setTimeout(() => {
      // 2026-06-17: levels 13 & 14 — SPC owns the comm box and CMDR voice is muted, so greet the
      // cadet with her own intro line ("Let's get after it, Cadet!") instead of the muted CMDR line.
      const spcIntro = (levelNum === 13 || levelNum === 14)
        ? commBoxController.spcBonusVoSrc("SPC_lets_get_after_it.mp3")
        : null;
      if (spcIntro) {
        commBoxController.queueVO({ audioSrc: spcIntro, _spc: true });
      } else {
        commBoxController.queueVO({
          audioSrc: commBoxController.commVoSrc(levelStartVO),
          event: "commander",
        });
      }
    }, 800);

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
    console.log(`[lvltrans] end startLevel duration=${(performance.now() - _lvlTransStartAt).toFixed(1)}ms level=${cfg.level}`);
    scheduleLevelTransitionReport();
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
    _freezeBankMs = 0;
    _freezeActive = false;
    playerFreezeInventory = 0;
    updateHudFreezeInventory();
    updateHudQuadBadge();
    bombAimMode = false;
    hudBombBtn?.classList.remove("hudBombBtn--aiming");
    // 2026-06-14: reset homing-missile state on a fresh run
    playerMissileInventory = 0;
    missileReloadUntil = 0;
    missileAimMode = false;
    activeMissile = null;
    missileCrosshair = null;
    missileForceSpawnedThisLevel = false;
    nextMineRespawnAt = 0; // 2026-06-16: recurring mine timer re-armed per level in startLevel
    pendingExplosions.length = 0; // 2026-06-16: no queued chain detonations carry into a fresh run
    hudMissileBtn?.classList.remove("hudMissileBtn--aiming");
    updateHudMissileInventory();
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
    playArcadeMenuMusic();
  }

  function openArcadeLevelSelect() {
    if (!(DEBUG_FORCE_LEVEL_SELECT || hasArcadeWon())) return;
    buildArcadeLevelSelect();
    setArcadeSubmenu("levels");
    playArcadeMenuMusic();
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

  // ──────────────────────────────────────────────────────────────────────────
  // Stunt (tutorial) Mode — a no-fail walkthrough. Reuses the arcade game loop,
  // physics, input and rendering, but the timed-level logic in update() is gated
  // OFF (see `stuntActive` branch). Progression is driven entirely by completing
  // each step's action, detected via stuntNotify() calls at the existing
  // action-completion sites (shoot / plasma / toss / bomb / freeze).
  // ──────────────────────────────────────────────────────────────────────────
  function startStuntMode() {
    audioEngine.unlock?.();
    audioEngine.loadMany?.(GAME_SFX);
    hideArcadeOverlay();
    tapBlasts = [];
    // fresh, pressure-free state
    arcadeScore = 0;
    arcadeLives = 0;
    playerBombInventory = 0;
    playerFreezeInventory = 0;
    quadShotUntil = 0;
    _freezeBankMs = 0;
    _freezeActive = false;
    bombAimMode = false;
    hudBombBtn?.classList.remove("hudBombBtn--aiming");
    // 2026-06-14: keep the missile button grayed/empty in Stunt Mode
    playerMissileInventory = 0;
    missileReloadUntil = 0;
    missileAimMode = false;
    activeMissile = null;
    missileCrosshair = null;
    hudMissileBtn?.classList.remove("hudMissileBtn--aiming");
    updateHudMissileInventory();
    currentLevelIndex = 0;
    // 2026-06-15: show the perimeter timer FULL + paused so Phase 0 can teach it. The timed-level
    // update block is gated off by stuntActive (no depletion / game-over), and the perimeter draw
    // reads _timerRemainingMs — pinned to levelDurationMs by resetArcadeTimerVisuals() below.
    levelDurationMs = 60000;
    levelEndsAt = performance.now() + levelDurationMs;
    retryPending = false;
    arcadeResumeAvailable = false;

    engineMode = "arcade";
    arcadeActive = true;
    stuntActive = true;
    stuntAdvancing = false;

    setMenuOverlayOpen(false);
    syncArcadeEntryLabel();
    setGalaxyViewMode("arcade");
    setGalaxyTool("draw");
    galaxyView?.classList.remove("level-10");
    resetArcadeTimerVisuals();
    clearGameplayEntities();
    setGalaxyBackgroundForLevel(1);
    window.galaxyBackground?.show();
    window.galaxyBackground?.setTheme(1);
    window.galaxyBackground?.setLevel(1);
    // 2026-06-15: Stunt (tutorial) Mode uses the dedicated tutorial track. Passing level 0 to
    // musicForLevel returns MUSIC.TUTORIAL (Stroids_tutorial_instrumental) instead of the
    // level-1 arcade loop.
    playArcadeMusicForLevel(0);

    commBoxController.show();
    commBoxController.setDamageState("normal");
    showFpsOverlay();
    if (hudLevel) hudLevel.textContent = "STUNT MODE";
    renderLives();
    renderScore();
    updateHudBombInventory();
    updateHudFreezeInventory();
    updateHudQuadBadge();

    resizeGalaxyCanvas();
    computePlayfield();
    setTimeout(computePlayfield, 50);
    startGalaxyLoop();

    arcadePausedUntil = performance.now(); // gameplay allowed immediately
    // 2026-06-15: swap the commander portrait for SPC (Specialist) and silence CMDR for the
    // whole tutorial so only SPC speaks (Part 7).
    commBoxController.setPortraitOverride("vo/spc_portrait.png", "SPC");
    commBoxController.setExclusiveSpeaker(true);
    // Intro cutscene: comm box starts centered, the perimeter timer counts down, and two neon
    // arrows point at the comm box while SPC explains it. The timer powerup ends the cutscene.
    tutorialPaused = false;
    tutorialTimerRunning = true;
    tutorialTimerStartedAt = performance.now();
    _timerRemainingMs = levelDurationMs;
    commBoxController.setCommCenter(true);
    // 2026-06-15: no comm-pointing arrows at the very start — they cluttered the intro and aren't
    // needed (SPC is just talking about the perimeter timer). hideCommArrows() stays wired in the
    // timer phase + cleanup as harmless no-ops.
    // The skip hint is now governed entirely by updateSkipHint() each frame (no forced show here).
    runTutorial();
  }

  // ════════════════════════════════════════════════════════════════════════
  // TUTORIAL ENGINE (Stunt Mode → Training). An async phase script drives SPC's
  // walkthrough; each phase awaits player actions detected by polling game state
  // (waitFor) or counting events fed through stuntNotify().
  // ════════════════════════════════════════════════════════════════════════
  const TUT_ABORT = "tut-abort";
  let tutorialFireBlocked = false; // Phase 0 mutes the laser while SPC talks

  // ── async primitives, all abortable via _tutRunToken ──────────────────────
  function waitMs(ms) {
    return new Promise((resolve, reject) => {
      const entry = { reject };
      entry.id = setTimeout(() => {
        const i = _tutTimers.indexOf(entry);
        if (i >= 0) _tutTimers.splice(i, 1);
        resolve();
      }, ms);
      _tutTimers.push(entry);
    });
  }
  function waitFor(pred, opts) {
    return new Promise((resolve, reject) => {
      try { if (pred()) { resolve(); return; } } catch { /* keep waiting */ }
      // voOnly waiters are pure "let SPC finish" gates — they don't count as a pending player
      // action, so the tap-to-skip hint stays hidden while we're only waiting on dialogue.
      _tutWaiters.push({ pred, resolve, reject, voOnly: !!(opts && opts.voOnly) });
    });
  }
  function waitEvent(name, n = 1) {
    const base = tutorialEvents[name] || 0;
    return waitFor(() => (tutorialEvents[name] || 0) >= base + n);
  }
  function waitVOIdle() {
    return waitFor(() => !_spcPlaying && _spcQueue.length === 0, { voOnly: true });
  }
  function waitPowerupCollected(type) {
    return waitFor(() => !powerups.some((p) => p.type === type));
  }
  function abortTutorialAsync({ preserveSpc = false } = {}) {
    _tutWaiters.forEach((w) => { try { w.reject(TUT_ABORT); } catch {} });
    _tutWaiters = [];
    _tutTimers.forEach((t) => { clearTimeout(t.id); try { t.reject(TUT_ABORT); } catch {} });
    _tutTimers = [];
    if (!preserveSpc) spcFlush();
  }

  // ── SPC voice (Part 3) — captions pinned to the comm ticker; lines advance on a tight timer
  // (or on audio-end once SPC_*.mp3 exist). No hide/show between lines = no flicker. ──
  function spcVoSrc(key) {
    return SPC_VO_AVAILABLE.has(key) ? `vo/SPC_${key}.mp3` : null;
  }
  function spcFlush() {
    _spcQueue = [];
    _spcPlaying = false;
    _spcContinuousStartAt = 0; // talking run ended
    _spcAdvanceFn = null;
    _spcLineStartedAt = 0;
    if (_spcTimer) { clearTimeout(_spcTimer); _spcTimer = null; }
    if (_spcAudioFxCleanup) { _spcAudioFxCleanup(); _spcAudioFxCleanup = null; }
    if (_spcAudio) { try { _spcAudio.pause(); } catch {} _spcAudio = null; }
    commBoxController.spcSpeakEnd?.();
  }
  function spcVO(key, text, frameHint) {
    _spcQueue.push({ key, text, frameHint });
    pumpSpc();
  }
  function pumpSpc() {
    if (_spcPlaying || _spcQueue.length === 0) return;
    const { key, text, frameHint } = _spcQueue.shift();
    _spcPlaying = true;
    // Start the "continuous talking" clock at the first line of an uninterrupted run; following
    // lines start immediately so the run is unbroken until the queue empties (see advance()).
    if (_spcContinuousStartAt === 0) _spcContinuousStartAt = performance.now();
    commBoxController.show();
    commBoxController.spcSpeakStart?.(frameHint); // animate the SPC portrait first so the mouth-flap starts immediately
    commBoxController.pinTicker(text); // types text + keeps ticker visible (cancels auto-hide)
    const src = spcVoSrc(key);
    const dur = Math.max(1200, Math.min(4600, (text.length * 46) / SPC_VO_PLAYBACK_RATE));
    const advance = () => {
      if (!_spcPlaying) return; // idempotent: orphaned timer / watchdog / onerror+onended race can't double-advance
      if (_spcTimer) { clearTimeout(_spcTimer); _spcTimer = null; }
      if (_spcAudioFxCleanup) { _spcAudioFxCleanup(); _spcAudioFxCleanup = null; }
      // 2026-06-18: pause before nulling — a forced advance (watchdog/skip/fallback) must not
      // leave the previous clip audible under the next line.
      if (_spcAudio) { try { _spcAudio.pause(); } catch {} }
      _spcAudio = null;
      _spcPlaying = false;
      _spcAdvanceFn = null;
      _spcLineStartedAt = 0;
      _spcLinesCompletedThisPhase += 1; // a full VO line just finished (gates the skip hint)
      // settle the portrait to idle (+ resume blink) only when nothing else is queued; a
      // following line starts its own mouth-flap immediately, so no idle flicker between lines.
      if (_spcQueue.length === 0) {
        commBoxController.spcSpeakEnd?.();
        _spcContinuousStartAt = 0;
        if (_pendingTaskInstruction) {
          const _pt = _pendingTaskInstruction;
          _pendingTaskInstruction = null;
          showTaskInstruction(_pt);
        }
      }
      pumpSpc();
    };
    _spcAdvanceFn = advance;                 // watchdog target (see updateStunt)
    _spcLineStartedAt = performance.now();
    _spcLineWatchdogMs = 8000;              // dynamic — tightened to real duration once metadata loads
    if (src) {
      try {
        _spcAudio = new Audio(src);
        _spcAudio.preload = "auto";
        _spcAudio.playsInline = true;
        _spcAudio.volume = 0.85;
        _spcAudio.playbackRate = SPC_VO_PLAYBACK_RATE;
        _spcAudioFxCleanup = applyCommRadioEffect(_spcAudio);
        _spcAudio.onerror = (e) => {
          // 2026-06-17: surface load failures on device — relative path is correct for
          // capacitor://localhost, so an error here means the file is missing from the bundle
          // or the codec/MIME failed to decode. Falls back to text-only caption (advance()).
          const code = _spcAudio && _spcAudio.error ? _spcAudio.error.code : "?";
          console.warn("[SPC] audio error", { key, src, code, e });
          advance();
        };
        // 2026-06-18: iOS WKWebView does NOT reliably fire 'ended' on a media element routed
        // through a Web Audio graph (applyCommRadioEffect). So the PRIMARY advance is a timer
        // computed from the REAL clip duration, rate-adjusted to actual playtime. 'onended' stays
        // as a nice-to-have early trigger when it does fire. Both go through the idempotent advance().
        _spcAudio.onended = () => { console.log("[SPC] ended", key); advance(); };

        // 2026-06-20: anchor the advance timer to ACTUAL playback start, not metadata-load.
        // Previously the timer was armed in onloadedmetadata, which fires (and starts counting)
        // before play() produces audible output; on iOS, createMediaElementSource adds real start
        // latency, so the fixed tail was eaten before sound began and nearly every clip lost its
        // last word. Now: compute playMs at metadata, but ARM the timer only when playback truly
        // begins — the 'playing' event (primary) or the play() promise resolving (backup), once.
        let _spcPlayMs = 0;            // rate-adjusted real playtime (ms), known at metadata
        let _armedPlayTimer = false;   // idempotent: arm the precise timer exactly once
        let _playStartedAt = 0;        // perf clock at audible start (rate-honoring probe)

        const computePlayMs = () => {
          const d = isFinite(_spcAudio?.duration) ? _spcAudio.duration : 0;
          if (d <= 0) return 0;
          _spcPlayMs = (d / SPC_VO_PLAYBACK_RATE) * 1000; // 1.08x faster than recorded
          _spcLineWatchdogMs = _spcPlayMs + 2000;         // watchdog can't fire before the clip ends
          return _spcPlayMs;
        };

        const armPlayTimer = () => {
          if (_armedPlayTimer || !_spcPlaying || !_spcAudio) return;
          _armedPlayTimer = true;
          _playStartedAt = performance.now();
          const playMs = _spcPlayMs > 0 ? _spcPlayMs : computePlayMs();
          if (_spcTimer) clearTimeout(_spcTimer);          // drop the coarse pre-start backstop
          const ms = (playMs > 0 ? playMs : dur) + SPC_VO_TAIL_MS; // dur = text-length fallback
          _spcTimer = setTimeout(advance, ms);
          console.log("[SPC] playing", key, "playMs", Math.round(playMs), "-> advance in", Math.round(ms), "ms");
        };

        // Metadata: pre-compute playMs (do NOT arm the timer here anymore).
        _spcAudio.onloadedmetadata = () => { if (_spcPlaying) computePlayMs(); };
        if (_spcAudio.readyState >= 1 && isFinite(_spcAudio.duration) && _spcAudio.duration > 0) computePlayMs();

        // PRIMARY anchor: 'playing' fires when audible output actually begins (survives Web Audio routing).
        _spcAudio.onplaying = armPlayTimer;

        // Diagnostic (#3): confirm playbackRate=1.08 is actually honored through MediaElementSource.
        // Compare media currentTime vs wall-clock once we're a little way in (≈1.08 honored, ≈1.0 ignored).
        _spcAudio.ontimeupdate = () => {
          if (!_playStartedAt || !_spcAudio) return;
          const ct = _spcAudio.currentTime || 0;
          if (ct < 0.5) return;
          const wall = (performance.now() - _playStartedAt) / 1000;
          if (wall > 0.05) console.log("[SPC] rate-check", key, "observed", (ct / wall).toFixed(3), "expected", SPC_VO_PLAYBACK_RATE);
          _spcAudio.ontimeupdate = null; // one-shot
        };

        // Pre-START backstop: if neither 'playing' nor play() resolves, don't stall on the 8s
        // watchdog. armPlayTimer() replaces this with the precise timer the instant playback starts.
        _spcTimer = setTimeout(advance, 9000);
        const p = _spcAudio.play();
        console.log("[SPC] play", key, src);
        if (p && typeof p.then === "function") {
          // SECONDARY anchor: play() resolving also means playback began (covers iOS cases where
          // 'playing' is unreliable). Idempotent with onplaying via _armedPlayTimer.
          p.then(armPlayTimer).catch((err) => {
            console.warn("[SPC] audio play() rejected", { key, src, err });
            if (_spcTimer) clearTimeout(_spcTimer);
            _spcTimer = setTimeout(advance, dur);
          });
        }
      } catch { _spcTimer = setTimeout(advance, dur); }
    } else {
      _spcTimer = setTimeout(advance, dur);
    }
  }

  // ── HUD pointer (Part 4) ──────────────────────────────────────────────────
  let _hudPointerEl = null;
  let _hudPointerTimer = null;
  function ensureTutorialPointerCss() {
    if (document.getElementById("tutorialPointerCss")) return;
    const s = document.createElement("style");
    s.id = "tutorialPointerCss";
    s.textContent =
      "#tutorialPointer{position:fixed;z-index:9999;color:#00ffcc;font-size:28px;font-weight:bold;"
      + "pointer-events:none;text-shadow:0 0 8px #00ffcc,0 0 16px #00ffcc;display:none;"
      + "animation:tutorialPulse 0.6s ease-in-out infinite alternate;}"
      + "@keyframes tutorialPulse{from{transform:scale(0.9);}to{transform:scale(1.1);}}";
    document.head.appendChild(s);
  }
  function showHudPointer(targetElementId, durationMs = 5000) {
    ensureTutorialPointerCss();
    const target = document.getElementById(targetElementId);
    if (!target) return;
    if (!_hudPointerEl) {
      _hudPointerEl = document.createElement("div");
      _hudPointerEl.id = "tutorialPointer";
      document.body.appendChild(_hudPointerEl);
    }
    const r = target.getBoundingClientRect();
    // HUD weapon buttons sit low on the screen → point down from just above them.
    const arrowDown = r.top > window.innerHeight * 0.5;
    _hudPointerEl.textContent = arrowDown ? "↓" : "↑";
    _hudPointerEl.style.left = `${r.left + r.width / 2 - 14}px`;
    _hudPointerEl.style.top = arrowDown ? `${r.top - 38}px` : `${r.bottom + 8}px`;
    _hudPointerEl.style.display = "block";
    if (_hudPointerTimer) clearTimeout(_hudPointerTimer);
    if (durationMs > 0) _hudPointerTimer = setTimeout(hideHudPointer, durationMs);
  }
  function hideHudPointer() {
    if (_hudPointerTimer) { clearTimeout(_hudPointerTimer); _hudPointerTimer = null; }
    if (_hudPointerEl) _hudPointerEl.style.display = "none";
  }

  // ── perimeter-timer arrow (Part 5) ─────────────────────────────────────────
  // A pulsing teal "↑" anchored to the TOP edge of the playfield, pointing at the perimeter
  // timer line. Shown during the intro once SPC has described the timer; hidden when Phase 1 runs.
  let _timerArrowEl = null;
  function showTimerArrow() {
    // 2026-06-20: temporarily disabled. The static "↑" points at the timer line conceptually wrong;
    // it needs a redesign as a comet/dot travelling ALONG the perimeter timer (separate future task).
    // No-op for now — hideTimerArrow() stays safe to call (it just no-ops when nothing is shown).
    return;
    ensureTutorialPointerCss(); // provides the @keyframes tutorialPulse used by #timerArrow
    ensureTutorialChromeCss();
    if (!galaxyPlayCanvas) return;
    if (!_timerArrowEl) {
      _timerArrowEl = document.createElement("div");
      _timerArrowEl.id = "timerArrow";
      _timerArrowEl.textContent = "↑";
      document.body.appendChild(_timerArrowEl);
    }
    const rect = galaxyPlayCanvas.getBoundingClientRect();
    const scaleY = sim.height ? rect.height / sim.height : 1;
    const topY = rect.top + 2.5 * scaleY; // timer line draws at canvas-space y=2.5 (inset), not playfield.y
    _timerArrowEl.style.left = "50%";
    _timerArrowEl.style.top = `${topY + 8}px`;
    _timerArrowEl.style.transform = "translateX(-50%)";
    _timerArrowEl.style.display = "block";
  }
  function hideTimerArrow() {
    if (_timerArrowEl) _timerArrowEl.style.display = "none";
  }

  // 2026-06-17 (Part 4): teal arrow pointing at the plasma recharge indicator (the cooldown arc
  // drawn at canvas (sim.width-28, sim.height-28), bottom-right). Reuses the .tutCommArrow style.
  let _plasmaArrowEl = null;
  function showPlasmaRechargeArrow() {
    ensureTutorialChromeCss();
    if (!galaxyPlayCanvas) return;
    if (!_plasmaArrowEl) {
      _plasmaArrowEl = document.createElement("div");
      _plasmaArrowEl.className = "tutCommArrow";
      _plasmaArrowEl.id = "plasmaRechargeArrow";
      _plasmaArrowEl.textContent = "↘";
      document.body.appendChild(_plasmaArrowEl);
    }
    const rect = galaxyPlayCanvas.getBoundingClientRect();
    const scaleX = sim.width  ? rect.width  / sim.width  : 1;
    const scaleY = sim.height ? rect.height / sim.height : 1;
    const ix = rect.left + (sim.width - 28) * scaleX;
    const iy = rect.top + (sim.height - 28) * scaleY;
    _plasmaArrowEl.style.left = `${ix - 44}px`; // sit up-left of the indicator, glyph points into it
    _plasmaArrowEl.style.top = `${iy - 44}px`;
    _plasmaArrowEl.style.display = "block";
  }
  function hidePlasmaRechargeArrow() {
    if (_plasmaArrowEl) _plasmaArrowEl.style.display = "none";
  }

  // ── one-time CSS for the tutorial overlays (tooltip + comm-pointing arrows) ──
  function ensureTutorialChromeCss() {
    if (document.getElementById("tutorialChromeCss")) return;
    const s = document.createElement("style");
    s.id = "tutorialChromeCss";
    s.textContent =
      // Tap-to-skip rework (2026-06-16): subtle, static (no strobe/pulse), gently fading in/out via
      // an opacity transition. The hint text IS the tap target — 16px padding makes it easy to hit on
      // mobile. Default 0.35 opacity, 0.65 on touch/hover.
      "#tutorialSkipHint{position:fixed;z-index:9999;"
      + "font-family:monospace;font-size:10px;font-weight:400;letter-spacing:3px;color:#00ffcc;"
      + "pointer-events:none;display:none;opacity:0;padding:16px;white-space:nowrap;"
      + "text-shadow:0 0 6px rgba(0,255,204,.5);transition:opacity 0.5s ease;}"
      + "#tutorialSkipHint:hover,#tutorialSkipHint:active{opacity:.65 !important;}"
      + ".tutCommArrow{position:fixed;z-index:9998;font-size:34px;font-weight:bold;color:#00ffcc;"
      + "pointer-events:none;display:none;text-shadow:0 0 10px #00ffcc,0 0 20px #00ffcc;"
      + "animation:tutArrowBob 0.8s ease-in-out infinite alternate;}"
      + "@keyframes tutArrowBob{from{opacity:.55;}to{opacity:1;}}"
      // Part 5: pulsing teal arrow that points at the perimeter timer line (top playfield edge).
      + "#timerArrow{position:fixed;z-index:9999;color:#00d4d4;font-size:30px;font-weight:bold;"
      + "pointer-events:none;display:none;text-shadow:0 0 8px #00d4d4,0 0 16px #00d4d4;"
      + "animation:tutorialPulse 0.6s ease-in-out infinite alternate;}";
    document.head.appendChild(s);
  }

  // ── "TAP TO SKIP" hint above the comm box (tap-to-skip rework 2026-06-16) ────
  // The hint text itself is the tap target (pointer-events:auto), with 16px padding for an easy
  // mobile hit. No separate hitbox div. Visibility is driven each frame by updateSkipHint().
  let _skipHintEl = null;
  function _ensureSkipUi() {
    ensureTutorialChromeCss();
    if (!_skipHintEl) {
      _skipHintEl = document.createElement("div");
      _skipHintEl.id = "tutorialSkipHint";
      _skipHintEl.textContent = "TAP TO SKIP";
      // single tap on the hint skips the chatter (pointerdown = touch + mouse)
      _skipHintEl.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        tutorialSkip();
      });
      document.body.appendChild(_skipHintEl);
    }
  }
  // Center the hint just above the comm box's top edge. The 16px padding sits outside this anchor
  // point (text-centered), so the visible glyphs land ~8px above the box. Tracks centered⇄docked.
  function _positionSkipUi() {
    const box = document.getElementById("commanderTicker");
    if (!box || !_skipHintEl) return;
    const r = box.getBoundingClientRect();
    if (!r.width) return;
    _skipHintEl.style.left = `${r.left + r.width / 2}px`;
    _skipHintEl.style.transform = "translate(-50%, -100%)";
    _skipHintEl.style.top = `${r.top + 4}px`; // padding(16) - 4 ≈ 12px visible gap above the box
  }
  // Fade the hint in to its resting opacity (0.35). Idempotent — re-running while shown only keeps
  // the position fresh and cancels any pending fade-out.
  function showSkipHint() {
    return; // 2026-06-17: "TAP TO SKIP" disabled — no-op so the hint never appears (element stays in DOM, unused)
    // eslint-disable-next-line no-unreachable
    _ensureSkipUi();
    if (_skipHintHideTimer) { clearTimeout(_skipHintHideTimer); _skipHintHideTimer = null; }
    if (_skipHintShown) { _positionSkipUi(); return; }
    _skipHintShown = true;
    _positionSkipUi();
    _skipHintEl.style.display = "block";
    _skipHintEl.style.pointerEvents = "auto";
    // defer one frame so display:block → opacity:.35 actually transitions (gentle 0.5s fade-in)
    requestAnimationFrame(() => {
      if (_skipHintShown && _skipHintEl) _skipHintEl.style.opacity = "0.35";
    });
  }
  // Hide the hint. fade=true → gentle 0.5s opacity fade-out (used when SPC simply goes quiet);
  // otherwise snap it away instantly (skip tap, phase advance, any gameplay action).
  function hideSkipHint(fade = false) {
    if (!_skipHintShown && !(_skipHintEl && _skipHintEl.style.display === "block")) return;
    _skipHintShown = false;
    if (!_skipHintEl) return;
    _skipHintEl.style.pointerEvents = "none";
    if (fade) {
      if (_skipHintHideTimer) return; // already fading
      _skipHintEl.style.opacity = "0";
      _skipHintHideTimer = setTimeout(() => {
        _skipHintHideTimer = null;
        if (!_skipHintShown && _skipHintEl) _skipHintEl.style.display = "none";
      }, 500);
    } else {
      if (_skipHintHideTimer) { clearTimeout(_skipHintHideTimer); _skipHintHideTimer = null; }
      _skipHintEl.style.opacity = "0";
      _skipHintEl.style.display = "none";
    }
  }

  // Per-frame gate (called from updateStunt). Show "TAP TO SKIP" only when ALL hold: SPC has been
  // talking >3s continuously, the cadet has heard ≥1 full line this phase, a player action is
  // pending (a non-voOnly waiter), and there was no interaction in the last 2s.
  function updateSkipHint(now) {
    // keep the task-instruction banner glued above the comm box as it docks / reorients
    if (_taskInstrEl && _taskInstrEl.style.display === "block") _positionTaskInstr();
    const speaking = _spcPlaying || _spcQueue.length > 0;
    const spokenLongEnough = _spcContinuousStartAt > 0 && (now - _spcContinuousStartAt) > 3000;
    const heardFullLine = _spcLinesCompletedThisPhase >= 1;
    const actionWaiting = _tutWaiters.some((w) => !w.voOnly);
    const recentlyInteracted = (now - _lastTutInteractionAt) < 2000;
    if (speaking && spokenLongEnough && heardFullLine && actionWaiting && !recentlyInteracted) {
      showSkipHint();
    } else {
      // fade only when SPC has simply gone quiet; every other reason hides instantly.
      hideSkipHint(!speaking && !recentlyInteracted);
    }
  }

  // single tap on the hint → jump to the END of the queue (play only the last line, dropping the
  // intermediate chatter). The player action requirement is untouched — this just shortcuts SPC.
  function tutorialSkip() {
    if (!stuntActive || tutorialPaused) return;
    _lastTutInteractionAt = performance.now();
    hideSkipHint(false); // instant hide on the skip tap
    if (_spcQueue.length > 0) {
      const last = _spcQueue[_spcQueue.length - 1];
      spcFlush();
      spcVO(last.key, last.text, last.frameHint);
    }
    window.pixiRenderer?.triggerPlasmaRectFlash?.();
    playGameSfx("printtext", 0.6);
  }

  // ── task-instruction line (Part 2): a bold, unmissable directive. 2026-06-17: moved OUT of the
  // comm box and up to a standalone fixed banner that floats just ABOVE the comm box (mirrors
  // #tutorialSkipHint's placement). The comm box now shows only SPC dialogue. Unlike VO captions
  // this never auto-hides — it persists until the action completes / the phase advances
  // (hideTaskInstruction) or the tutorial tears down. ──
  let _taskInstrEl = null;
  let _pendingTaskInstruction = null; // text queued to show once SPC VO drains
  function _ensureTaskInstrEl() {
    if (_taskInstrEl) return _taskInstrEl;
    _taskInstrEl = document.createElement("div");
    _taskInstrEl.id = "commanderTaskInstruction";
    // 2026-06-17 (Part 2): screen-centered + clamped to 90vw so the banner never clips off the
    // left edge on narrow viewports. Short lines stay on one line (nowrap, set in showTaskInstruction);
    // long lines wrap and center. left:50% + translateX(-50%) keeps it screen-centered, not box-relative.
    _taskInstrEl.style.cssText =
      "position:fixed;z-index:9997;display:none;pointer-events:none;left:50%;"
      + "max-width:90vw;box-sizing:border-box;"
      + "font-family:monospace;font-size:13px;font-weight:700;color:#ffffff;"
      + "letter-spacing:1px;text-transform:uppercase;line-height:1.15;text-align:center;"
      + "background:rgba(0,0,0,0.5);padding:6px 16px;border-radius:6px;"
      + "transform:translate(-50%,-100%);";
    document.body.appendChild(_taskInstrEl);
    return _taskInstrEl;
  }
  // 2026-06-17 (Part 2): horizontally screen-centered (left:50% in CSS) so it can't clip off the
  // left edge; we only track the vertical position to rest its bottom edge 8px above the HUD's top.
  function _positionTaskInstr() {
    const hudEl = document.getElementById("commanderHUD");
    if (!hudEl || !_taskInstrEl) return;
    const r = hudEl.getBoundingClientRect();
    if (!r.width) return;
    _taskInstrEl.style.top = `${r.top - 8}px`;
  }
  function showTaskInstruction(text) {
    const el = _ensureTaskInstrEl();
    if (!el) return;
    el.textContent = text;
    el.style.whiteSpace = text.length > 22 ? "normal" : "nowrap";
    _positionTaskInstr();
    const wasHidden = el.style.display === "none" || !el.style.display;
    if (wasHidden) {
      // Fade up from invisible, then strobe to keep drawing attention.
      el.style.animation = "";
      el.style.opacity = "0";
      el.style.transition = "opacity 350ms ease";
      el.style.display = "block";
      requestAnimationFrame(() => requestAnimationFrame(() => {
        el.style.opacity = "1";
        setTimeout(() => {
          el.style.transition = "";
          el.style.animation = "taskInstrStrobe 1.4s ease-in-out infinite";
        }, 380);
      }));
    } else {
      el.style.display = "block"; // already visible — update text only, don't restart animation
    }
  }
  // Show instruction deferred until SPC VO finishes; if already visible, update immediately.
  function showTaskInstructionDeferred(text) {
    if (_taskInstrEl && _taskInstrEl.style.display === "block") {
      showTaskInstruction(text); // update visible instruction immediately
    } else if (!_spcPlaying && _spcQueue.length === 0) {
      showTaskInstruction(text); // VO is already idle — show immediately with fade
    } else {
      _pendingTaskInstruction = text; // will be shown when the VO queue drains
    }
  }
  function hideTaskInstruction() {
    _pendingTaskInstruction = null;
    if (_taskInstrEl) {
      _taskInstrEl.style.display = "none";
      _taskInstrEl.style.animation = "";
      _taskInstrEl.style.opacity = "";
      _taskInstrEl.style.transition = "";
      _taskInstrEl.textContent = "";
    }
  }

  // ── two neon arrows pointing at the (centered) comm box during the intro (#2) ──
  let _commArrowTop = null;
  let _commArrowBot = null;
  function showCommArrows() {
    ensureTutorialChromeCss();
    if (!_commArrowTop) {
      _commArrowTop = document.createElement("div");
      _commArrowTop.className = "tutCommArrow";
      _commArrowTop.textContent = "↓";
      _commArrowTop.style.transform = "rotate(-45deg)";
      document.body.appendChild(_commArrowTop);
    }
    if (!_commArrowBot) {
      _commArrowBot = document.createElement("div");
      _commArrowBot.className = "tutCommArrow";
      _commArrowBot.textContent = "↑";
      _commArrowBot.style.transform = "rotate(-45deg)";
      document.body.appendChild(_commArrowBot);
    }
    // comm box sits centered at ~(50%, 34%) during the intro cutscene; the ticker is docked
    // directly below the portrait (see setCommCenter), so the arrows frame the whole unit:
    // top arrow above the portrait, bottom arrow below the ticker (~cy+144 bottom edge).
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight * 0.34;
    _commArrowTop.style.left = `${cx - 17}px`;
    _commArrowTop.style.top = `${cy - 130}px`;
    _commArrowBot.style.left = `${cx - 17}px`;
    _commArrowBot.style.top = `${cy + 158}px`;
    _commArrowTop.style.display = "block";
    _commArrowBot.style.display = "block";
  }
  function hideCommArrows() {
    if (_commArrowTop) _commArrowTop.style.display = "none";
    if (_commArrowBot) _commArrowBot.style.display = "none";
  }

  // ── pause / resume training (#4) ───────────────────────────────────────────
  function pauseTutorial() {
    if (!stuntActive || tutorialPaused) return;
    tutorialPaused = true;
    arcadePausedUntil = Infinity;          // freeze gameplay physics
    if (_spcTimer) { clearTimeout(_spcTimer); _spcTimer = null; }
    if (_spcAudioFxCleanup) { _spcAudioFxCleanup(); _spcAudioFxCleanup = null; }
    if (_spcAudio) { try { _spcAudio.pause(); } catch {} _spcAudio = null; }
    _spcPlaying = false; // discard the interrupted line; queued narration resumes after Resume
    _spcAdvanceFn = null;
    _spcLineStartedAt = 0;
    _spcContinuousStartAt = 0; // restart the >3s talk window after resume
    commBoxController.spcSpeakEnd?.(); // settle the SPC portrait while paused (no flap behind overlay)
    commBoxController.setHudDimmed?.(true); // fade the comm box so it can't paint over the Resume button
    hideSkipHint();
    showArcadeOverlay("TRAINING PAUSED", "Double-tap or swipe down to resume", 0, {
      buttonText: "Resume",
      buttonAction: () => resumeTutorial(),
      secondaryButtonText: "Quit Training",
      secondaryButtonAction: () => exitStuntMode(),
    });
  }
  function resumeTutorial() {
    if (!tutorialPaused) return;
    tutorialPaused = false;
    hideArcadeOverlay();
    commBoxController.setHudDimmed?.(false); // restore the comm box after the pause overlay clears
    arcadePausedUntil = performance.now();
    // skip hint re-appears on its own via updateSkipHint() once conditions are met again
    _spcPlaying = false;
    pumpSpc();                              // continue any queued narration
  }

  // ── tutorial entity helpers (Part 5) ──────────────────────────────────────
  // 2026-06-20 (Item 3a): the comm box docks bottom-left during tutorial gameplay. Compute its
  // footprint in sim/world coords so random stroid spawns can avoid warping in under it (where
  // they'd be hidden + hard to reach). World coords ≈ CSS px from the canvas origin (see
  // getPointerWorld), so map the DOM rect by subtracting the canvas rect and scaling. Returns null
  // when the comm box isn't laid out.
  function commBoxExclusionSim() {
    const hudEl = document.getElementById("commanderHUD");
    if (!galaxyPlayCanvas || !hudEl || hudEl.offsetParent === null) return null;
    const cr = galaxyPlayCanvas.getBoundingClientRect();
    if (cr.width <= 0 || cr.height <= 0) return null;
    const sx = sim.width / cr.width;   // client px -> sim px (≈1)
    const sy = sim.height / cr.height;
    const tickerEl = document.getElementById("commanderTicker");
    const rects = [hudEl.getBoundingClientRect()];
    if (tickerEl && tickerEl.classList.contains("ticker-visible")) rects.push(tickerEl.getBoundingClientRect());
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
    for (const r of rects) {
      if (r.width <= 0 || r.height <= 0) continue;
      left = Math.min(left, r.left); top = Math.min(top, r.top);
      right = Math.max(right, r.right); bottom = Math.max(bottom, r.bottom);
    }
    if (!Number.isFinite(left)) return null;
    const pad = 48; // asteroid radius + breathing room
    return {
      x: (left - cr.left) * sx - pad,
      y: (top - cr.top) * sy - pad,
      w: (right - left) * sx + pad * 2,
      h: (bottom - top) * sy + pad * 2,
    };
  }

  function tutZonePoint(zone) {
    const cx = playfield.x + playfield.w / 2;
    const cy = playfield.y + playfield.h / 2;
    if (zone === "top") {
      return { x: cx + (Math.random() - 0.5) * playfield.w * 0.5, y: playfield.y + playfield.h * 0.18 };
    }
    if (zone === "center") return { x: cx, y: cy };
    // default ("random"): scatter in the central ~55% of the playfield, never on the edges —
    // tutorial stroids should be easy to see and reach. Reject samples that land in the comm-box
    // footprint (Item 3a) and resample; fall back to the upper-central band if every try collides.
    const excl = commBoxExclusionSim();
    const sample = () => ({
      x: cx + (Math.random() - 0.5) * playfield.w * 0.55,
      y: cy + (Math.random() - 0.5) * playfield.h * 0.5,
    });
    const inExcl = (p) => excl && p.x >= excl.x && p.x <= excl.x + excl.w && p.y >= excl.y && p.y <= excl.y + excl.h;
    for (let tries = 0; tries < 16; tries += 1) {
      const p = sample();
      if (!inExcl(p)) return p;
    }
    return { x: cx + (Math.random() - 0.5) * playfield.w * 0.55, y: cy - playfield.h * 0.25 };
  }
  function spawnTutorialAsteroids(count, kind = 2, options = {}) {
    const refs = [];
    // Part 9: warp tutorial stroids in like normal gameplay — a warp ring + warp sound at each
    // point (spawnAsteroid's warp:true path) plus a subtle screen flash, staggered 50ms apart so
    // a batch doesn't all pop in at once.
    const spawnOne = () => {
      const p = tutZonePoint(options.positionZone || "random");
      const a = spawnAsteroid(p.x, p.y, kind, true); // warp:true → playWarpSound + addWarpRing
      if (a) {
        if (options.fast) { a.vx *= 1.7; a.vy *= 1.7; }
        refs.push(a);
      }
      return a;
    };
    // First spawns synchronously so the field is never momentarily empty (a delayed spawn could
    // otherwise let waitFor(tutorialAsteroidsAllCleared) resolve before it lands); stagger the rest.
    spawnOne();
    cssFlash("#00ffd1", 0.1, 120); // gentle teal acknowledgement of the spawn-in
    for (let i = 1; i < count; i += 1) {
      setTimeout(() => { if (stuntActive) spawnOne(); }, i * 50);
    }
    return refs;
  }
  function spawnTutorialUFO() {
    spawnUfo();
    if (ufo) {
      ufo.tutorial = true;     // skips teleport + auto-despawn (see UFO update block)
      ufo.vx *= 0.5;
      ufo.vy *= 0.5;
      ufo.despawnAt = Infinity;
    }
    return ufo;
  }
  function spawnTutorialPowerup(type, position) {
    const p = position || { x: playfield.x + playfield.w / 2, y: playfield.y + playfield.h / 2 };
    const pu = { type, x: p.x, y: p.y, r: 22, spawnedAt: performance.now(), opacity: 1.0 };
    powerups.push(pu);
    playGameSfx("bling", 0.8);
    return pu;
  }
  function spawnTutorialLandmine(position) {
    const p = position || { x: playfield.x + playfield.w * 0.5, y: playfield.y + playfield.h * 0.5 };
    landmine = createMineEntity(p.x, p.y);
    playGameSfx("blip1", 0.8, { rate: 1.05 });
    addWarpRing(p.x, p.y, "rgba(124,255,91,1)");
    return landmine;
  }
  function clearTutorialField() {
    for (const a of sim.asteroids) spawnExplosion(a.x, a.y, 14, false, 1.1, 1, a.kind, a.spriteKey);
    if (ufo && ufo.alive) spawnExplosion(ufo.x, ufo.y, 18, true, 1.4);
    if (landmine) spawnExplosion(landmine.x, landmine.y, 18, true, 1.4);
    for (const b of placedBombs) spawnExplosion(b.x, b.y, 14, false, 1.1);
    playGameSfx("ufo_destroy", 0.6);
    clearGameplayEntities();
    powerups.length = 0;
    return waitMs(450);
  }
  function tutorialAsteroidsAllCleared() {
    return sim.asteroids.length === 0;
  }
  function rechargePlasmaNow() {
    // Phase 3: after a missed net, keep the weapon hot so the cadet can retry immediately.
    plasmaCage.charged = true;
    plasmaCage.chargeStart = performance.now() - 1e9;
  }

  // ── per-verb retry sub-loops ──────────────────────────────────────────────
  // Resolves on the first net that destroys ≥1 stroid. Coaches on empty nets, and re-stocks the
  // field (via respawn) if the cadet clears it with the laser instead — never a soft-lock.
  async function tutorialPlasmaSuccess(respawn) {
    const baseHit = tutorialEvents.plasma || 0;
    for (;;) {
      const baseMiss = tutorialEvents.plasma_miss || 0;
      await waitFor(() =>
        (tutorialEvents.plasma || 0) > baseHit
        || (tutorialEvents.plasma_miss || 0) > baseMiss
        || tutorialAsteroidsAllCleared());
      if ((tutorialEvents.plasma || 0) > baseHit) return;
      if ((tutorialEvents.plasma_miss || 0) > baseMiss) {
        tutorialState.plasmaMisses = (tutorialState.plasmaMisses || 0) + 1;
        if (tutorialState.plasmaMisses === 1) {
          spcVO("20", "Make sure the **Stroids** are targeted first.", "alert");
          spcVO("21", "Try it again.", "alert");
        } else {
          spcVO("22", "Take your time — get them highlighted before you release.", "alert");
        }
        rechargePlasmaNow();
      } else if (respawn) {
        respawn(); // field emptied by laser — give them stroids to net
        rechargePlasmaNow();
      }
    }
  }

  // ── the 10-phase script (Part 6) ──────────────────────────────────────────
  const TUTORIAL_PHASES = [
    { id: "intro", run: async () => {
      tutorialFireBlocked = true;
      spcVO("01", "Hi there Cadet, welcome to the Polyverse simulator.", "talk_friendly");
      spcVO("02", "Let me show you the ropes before the real battle.", "talk_friendly");
      spcVO("03-04", "First — the perimeter timer. That line around the screen edges shows how long you have to clear the field.", "talk_friendly");
      showTimerArrow(); // Part 5: point at the perimeter timer while SPC describes it
      await waitVOIdle();
    } },
    { id: "timer", run: async () => {
      // The powerup appearing ends the cutscene: comm box docks to the bottom, arrows clear.
      commBoxController.setCommCenter(false);
      hideCommArrows();
      spcVO("05-06a", "Every so often a **Timer** power-up appears. Grab it to buy time.", "talk_calm");
      spcVO("06b", "Tap it now.", "talk_calm");
      spawnTutorialPowerup("timer", tutZonePoint("center"));
      showTaskInstructionDeferred("TAP THE TIMER POWERUP");
      await waitPowerupCollected("timer");
      hideTimerArrow(); // Part 5: hide once the cadet has actually collected the timer powerup
      hideTaskInstruction();
      // Collected: perimeter snapped back to full (collectPowerup) — now hold it there, paused.
      tutorialTimerRunning = false;
      _timerRemainingMs = levelDurationMs;
      spcVO("07", "Great! From here, the timer is paused while you train.", "talk_calm");
      await waitVOIdle();
    } },
    { id: "laser", run: async () => {
      tutorialFireBlocked = false;
      tutorialBlockPlasmaToss = true; // only the laser this step
      spawnTutorialAsteroids(1, 3);
      const baseShots = tutorialEvents.shoot || 0;
      spcVO("08", "These are the **Stroids** — our job is to clear them from the Polyverse.", "talk_friendly");
      spcVO("08b", "Tap to fire your laser and blast the **Stroid** and all its pieces.", "talk_calm");
      showTaskInstructionDeferred("TAP TO FIRE — DESTROY THE STROID");
      await waitVOIdle();
      await waitMs(800);
      if (!stuntActive) return;
      commBoxController.hide();
      waitFor(() => (tutorialEvents.shoot || 0) > baseShots)
        .then(() => { if (stuntActive) showTaskInstruction("DESTROY ALL THE STROIDS"); })
        .catch(() => {});
      await waitFor(tutorialAsteroidsAllCleared);
      hideTaskInstruction();
      // Praise fires only once the objective is met (all stroids cleared), not before.
      spcVO("08c", "Fantastic, Cadet — you'll show these **Stroids** who's boss.", "praise");
      await waitVOIdle();
      await waitMs(700);
    },
    // 2026-06-21 (Item 2): when the field thins to its last 1-2 stroids, a slow drifter can crawl
    // behind the comm box and look like the game has hung. Give each surviving stroid a one-time
    // 1.5x speed nudge so it clears the comm-box footprint quickly. Per-asteroid flag (cleared on
    // pool release) means it scales each piece exactly once, never frame-over-frame. Laser phase
    // only — no effect on arcade/practice or any other tutorial step.
    onUpdate: () => {
      if (sim.asteroids.length > 2) return;
      for (const a of sim.asteroids) {
        if (a._tutLaserBoosted) continue;
        a._tutLaserBoosted = true;
        a.vx *= 1.5;
        a.vy *= 1.5;
      }
    } },
    { id: "plasma", run: async () => {
      tutorialBlockPlasmaToss = false; // net + toss unlocked from here on
      spawnTutorialAsteroids(2, 2);
      spcVO("one_of_our_most_useful_weapons_plasma_net", "One of our most useful weapons is the **Plasma Net**.");
      spcVO("to_fire_a_plasma_net_tap_and_drag", "To fire a **Plasma Net**, tap and drag a net across the screen.");
      spcVO("15-16", "When **Stroids** glow they're targeted. Release to fire.");
      // 2026-06-20: hold the objective text until the intro VO finishes (deferred-until-VO-idle,
      // same as the other steps) — the onUpdate hook below is gated on plasmaObjectiveMode, so we
      // only arm it after the lines drain instead of letting it flash up under the narration.
      await waitVOIdle();
      // Part 3 (2026-06-17): two-stage objective — set, then release. The phase's onUpdate hook
      // (below) keeps the text in sync with plasmaCage.active each frame, so it re-arms back to
      // "TAP AND DRAG" whenever a gesture resets (miss/cancel/fire) instead of sticking on RELEASE.
      tutorialState.plasmaObjectiveMode = "setfire";
      tutorialState.plasmaObjectiveShown = "";
      tutorialState.plasmaMisses = 0;
      await tutorialPlasmaSuccess(() => spawnTutorialAsteroids(2, 2));
      tutorialState.plasmaObjectiveMode = null;
      hideTaskInstruction(); // net fired successfully
      spcVO("17", "Great work, Cadet!", "praise");
      spcVO("18", "Now let the plasma recharge and do it again!", "talk_friendly");
      // 2026-06-20 (Item 1): hold the recharge arrow until the praise + recharge VO drains
      // (deferred-until-VO-idle) so it no longer pops up over the "Great work, Cadet!" line.
      await waitVOIdle();
      // Wait for the real cooldown to elapse (not the in-drag `charged` flag, which a new drag
      // would satisfy instantly) so the recharge lesson actually plays out. Guarded so the arrow
      // never flashes for a frame if the cooldown already lapsed while the VO played.
      if (performance.now() < plasmaCage.cooldownUntil) {
        showPlasmaRechargeArrow(); // Part 4: point at the recharge indicator while it refills
        await waitFor(() => performance.now() >= plasmaCage.cooldownUntil);
        hidePlasmaRechargeArrow();
      }
      spcVO("19", "Plasma is recharged.");
      spawnTutorialAsteroids(3, 2);
      // second round — re-run the two-stage objective (same onUpdate-driven re-arming text)
      tutorialState.plasmaObjectiveMode = "setfire";
      tutorialState.plasmaObjectiveShown = "";
      tutorialState.plasmaMisses = 0;
      await tutorialPlasmaSuccess(() => spawnTutorialAsteroids(3, 2));
      tutorialState.plasmaObjectiveMode = null;
      hideTaskInstruction();
      spcVO("17b", "Great work, Cadet!", "praise");
      await clearTutorialField();
      await waitMs(350);
    },
    // Drive the objective text off plasmaCage.active each frame while a "setfire" round is live,
    // so it re-arms to "TAP AND DRAG" whenever the gesture resets (Part 3 fix, 2026-06-17).
    onUpdate: () => {
      if (tutorialState.plasmaObjectiveMode !== "setfire") return;
      const want = plasmaCage.active
        ? "RELEASE TO FIRE PLASMA NET"
        : "TAP AND DRAG TO SET PLASMA NET";
      if (tutorialState.plasmaObjectiveShown !== want) {
        tutorialState.plasmaObjectiveShown = want;
        showTaskInstruction(want);
      }
    } },
    { id: "ufo", run: async () => {
      spawnTutorialAsteroids(3, 2);
      spawnTutorialUFO();
      spcVO("23", "UFO spotted, Cadet!", "alert");
      spcVO("24", "Shoot it twice to take it out!", "alert");
      showTaskInstructionDeferred("SHOOT THE UFO TWICE");
      waitFor(() => ufo && ufo.hitCount >= 1)
        .then(() => { if (stuntActive) spcVO("25", "Direct hit! Do it again!", "praise"); })
        .catch(() => {});
      await waitFor(() => !ufo);
      hideTaskInstruction();
      spcVO("26", "Wow, there you go.", "laugh");
      spcVO("27", "Destroying a UFO instantly recharges your plasma.");
      spcVO("28-30", "So net the **Stroids** when a UFO shows up.");
      await clearTutorialField();
      spawnTutorialAsteroids(3, 2);
      // Net step first — UFO withheld until the net lands so the sequence is taught in order.
      spcVO("31", "Use your **Plasma Net** on those **Stroids**.", "talk_friendly");
      showTaskInstructionDeferred("NET THE STROIDS");
      tutorialState.plasmaMisses = 0;
      const baseComboPlasma = tutorialEvents.plasma || 0;
      for (;;) {
        const baseComboMiss = tutorialEvents.plasma_miss || 0;
        await waitFor(() =>
          (tutorialEvents.plasma || 0) > baseComboPlasma
          || (tutorialEvents.plasma_miss || 0) > baseComboMiss
          || tutorialAsteroidsAllCleared());
        if ((tutorialEvents.plasma || 0) > baseComboPlasma) break; // net landed ✓
        if ((tutorialEvents.plasma_miss || 0) > baseComboMiss) {
          tutorialState.plasmaMisses += 1;
          if (tutorialState.plasmaMisses === 1) spcVO("20", "Make sure the **Stroids** are targeted first.", "alert");
          else spcVO("22", "Take your time — get them highlighted before you release.", "alert");
          rechargePlasmaNow();
        } else {
          spawnTutorialAsteroids(3, 2); // field emptied with the laser — restock
          rechargePlasmaNow();
        }
      }
      // Net confirmed — now the UFO appears
      spawnTutorialUFO();
      spcVO("32", "Now destroy the UFO quickly!", "alert");
      hideTaskInstruction();
      await waitFor(() => !ufo);
      spawnTutorialAsteroids(4, 2);
      spcVO("33", "Plasma recharged — make another net!");
      await tutorialPlasmaSuccess(() => spawnTutorialAsteroids(4, 2));
      spcVO("34", "Nice work, Cadet. You learn fast.", "praise");
      await clearTutorialField();
      await waitMs(350);
    } },
    { id: "toss", run: async () => {
      spawnTutorialAsteroids(3, 3);
      spcVO("35-36", "Next — the **Stroid Toss**. Tap and hold a **Stroid** to grab it.", "talk_calm");
      showTaskInstructionDeferred("TAP AND HOLD A STROID — SWIPE TO TOSS");
      tutorialState.tossFailures = 0;
      const baseToss = tutorialEvents.toss || 0;
      tutorialSmallGrabHintEnabled = true;
      try {
        while ((tutorialEvents.toss || 0) <= baseToss) {
          const baseFail = tutorialEvents.toss_fail || 0;
          await waitFor(() =>
            (tutorialEvents.toss || 0) > baseToss
            || (tutorialEvents.toss_fail || 0) > baseFail
            || tutorialAsteroidsAllCleared());
          if ((tutorialEvents.toss || 0) > baseToss) break;
          if ((tutorialEvents.toss_fail || 0) > baseFail) {
            tutorialState.tossFailures += 1;
            if (tutorialState.tossFailures === 1) spcVO("38", "You have to swipe or flick to toss it.", "idle_smirk");
            else spcVO("39", "Give it a good flick, Cadet — put some effort in!", "idle_smirk");
          } else {
            spawnTutorialAsteroids(3, 3); // cleared them with the laser — give grabbable stroids back
          }
        }
      } finally {
        tutorialSmallGrabHintEnabled = false;
      }
      hideTaskInstruction();
      spcVO("40", "Very good, Cadet.", "praise");
      spawnTutorialAsteroids(6, 2);
      spcVO("41", "Things will get hectic out there.");
      await waitMs(900);
    } },
    { id: "landmine", run: async () => {
      spawnTutorialLandmine(tutZonePoint("center"));
      spcVO("42-43", "When you see a bomb, tap it to arm it.", "talk_calm");
      spcVO("44-45", "The bomb explodes soon, but to detonate it yourself, just tap it again.", "talk_calm");
      showTaskInstructionDeferred("TAP THE BOMB TO ARM IT");
      tutorialState.mineTapBase = tutorialEvents.mine_tap || 0;
      for (;;) {
        await waitFor(() => !landmine);
        if ((tutorialEvents.mine_tap || 0) > tutorialState.mineTapBase) break; // player engaged it
        // auto-detonated before the cadet touched it — coach + respawn
        spcVO("46", "Okay Cadet, let's detonate the bomb ourselves.", "talk_calm");
        spcVO("47", "Tap the armed bomb to detonate it.", "talk_calm");
        tutorialState.mineTapBase = tutorialEvents.mine_tap || 0;
        spawnTutorialLandmine(tutZonePoint("center"));
        if (tutorialAsteroidsAllCleared()) spawnTutorialAsteroids(2, 2);
      }
      hideTaskInstruction();
      spcVO("48", "Boom. That was fantastic, Cadet.", "praise");
      spcVO("49", "Bombs can save you from some hairy situations.");
      await clearTutorialField();
      await waitMs(350);
    } },
    { id: "bombInventory", run: async () => {
      spawnTutorialPowerup("bomb", tutZonePoint("center"));
      spcVO("50-51", "Sometimes a bomb powerup appears — tap it to add it to your HUD.", "talk_calm");
      await waitPowerupCollected("bomb");

      // 2026-06-20 (Item 5): the old all-at-once "52-54" line is replaced by 4 action-gated steps.
      // Step 1 — arm via the HUD bomb icon (enters bomb-aim mode).
      spcVO("52", "When you see a bomb, tap it to arm it.", "talk_calm");
      showHudPointer("hudBombBtn", 6000);
      showTaskInstructionDeferred("TAP THE 💣 IN YOUR HUD");
      await waitFor(() => bombAimMode);
      hideHudPointer();
      hideTaskInstruction();

      // Step 2 — place it on the field (the next tap drops the bomb).
      spcVO("53", "Now tap the screen where you want to place it.", "talk_calm");
      showTaskInstructionDeferred("TAP TO PLACE THE BOMB");
      await waitFor(() => placedBombs.length > 0);
      hideTaskInstruction();

      // Step 3 — arm the placed bomb. AUDIO TODO: no VO recorded yet for this line — the unknown
      // key falls back to a text-only caption (spcVoSrc returns null). Record SPC for "Tap the
      // bomb to arm it." and add the key to SPC_VO_AVAILABLE when available.
      spcVO("arm_placed_bomb", "Tap the bomb to arm it.", "talk_calm");
      showTaskInstructionDeferred("TAP THE BOMB TO ARM IT");
      await waitFor(() => placedBombs.some((b) => b.phase === "player_armed"));
      hideTaskInstruction();

      // Step 4 — detonate it (tap the armed bomb again). "bomb" event fires on detonation.
      spcVO("54", "To detonate it yourself, tap it again.", "talk_calm");
      showTaskInstructionDeferred("TAP THE BOMB AGAIN TO DETONATE");
      await waitEvent("bomb");
      hideTaskInstruction();
      await clearTutorialField();
      await waitMs(350);
    } },
    { id: "quadshot", run: async () => {
      spawnTutorialPowerup("quadshot", tutZonePoint("center"));
      spcVO("55-56", "That's the **Quad Shot** power-up. Pick it up!", "talk_calm");
      await waitPowerupCollected("quadshot");
      spawnTutorialAsteroids(3, 2);
      spcVO("57", "Blast those **Stroids** with the **Quad Shot**!", "smile_open");
      showTaskInstructionDeferred("BLAST THE STROIDS");
      await waitFor(tutorialAsteroidsAllCleared);
      if (!stuntActive) return;
      // 2026-06-20 (Item 8): "Keep firing" used to fire every restock loop (3-4x for a fast
      // player). Gate it to exactly once per training session.
      let keepFiringSaid = false;
      while (performance.now() < quadShotUntil) {
        await waitFor(() => tutorialAsteroidsAllCleared() || performance.now() >= quadShotUntil);
        if (performance.now() >= quadShotUntil) break;
        spawnTutorialAsteroids(3, 2);
        if (!keepFiringSaid) { spcVO("58", "Keep firing, Cadet!", "smile_open"); keepFiringSaid = true; }
      }
      hideTaskInstruction();
      await clearTutorialField();
      await waitMs(350);
    } },
    { id: "freeze", run: async () => {
      spawnTutorialPowerup("snowflake", tutZonePoint("center"));
      // 2026-06-20 (Item 9): split the combined 59-60 line so the "tap the freeze button" guidance
      // only plays AFTER the powerup is actually collected (was telling the cadet to activate it
      // before they'd even picked it up).
      spcVO("59", "Pick up the freeze powerup.", "idle_gentle");
      await waitPowerupCollected("snowflake");
      spawnTutorialAsteroids(3, 2);
      spcVO("60", "Tap the freeze button on your HUD to activate it.", "idle_gentle");
      showHudPointer("hudFreezeBtn", 6000);
      showTaskInstructionDeferred("TAP ❄ IN YOUR HUD TO ACTIVATE");
      await waitEvent("freeze");
      hideHudPointer();
      hideTaskInstruction();
      spcVO("61", "Objects are frozen for a short time. Blast 'em!", "idle_gentle");
      spcVO("freeze_toggle", "Freeze can be enabled and disabled by tapping the freeze icon on your HUD.", "idle_gentle");
      await waitVOIdle();
      await clearTutorialField();
      await waitMs(350);
    } },
    { id: "freeze_toss", run: async () => {
      spawnTutorialAsteroids(3, 2);
      spcVO("62", "Frozen **Stroids** can be tossed too. Grab one and toss it.", "idle_gentle");
      showTaskInstructionDeferred("GRAB AND TOSS A FROZEN STROID");
      // If freeze time carried over from the activation step (bank still has time, whether running
      // or paused) — skip straight to the toss loop. Only re-prompt with a fresh powerup when the
      // bank is fully empty.
      if (_freezeBankMs <= 0) {
        if (!stuntActive) return;
        spawnTutorialPowerup("snowflake", tutZonePoint("center"));
        spcVO("63b", "Freeze expired — grab another one and try the toss.", "idle_gentle");
        await waitPowerupCollected("snowflake");
        showHudPointer("hudFreezeBtn", 6000);
        await waitEvent("freeze");
        hideHudPointer();
      }
      tutorialState.frozenTossBase = tutorialEvents.toss || 0;
      while ((tutorialEvents.toss || 0) <= tutorialState.frozenTossBase) {
        await waitFor(() =>
          (tutorialEvents.toss || 0) > tutorialState.frozenTossBase
          || tutorialAsteroidsAllCleared()
          || _freezeBankMs <= 0); // bank fully drained (a pause keeps time banked — lesson continues)
        if ((tutorialEvents.toss || 0) > tutorialState.frozenTossBase) break;
        if (tutorialAsteroidsAllCleared()) {
          // cleared the field with the laser — restock + re-freeze so the toss can be practiced
          spawnTutorialAsteroids(3, 2);
          _freezeBankMs = FREEZE_DURATION_MS; // fresh full bank, running
          _freezeActive = true;
          _freezeSessionId++; // new session so prior gliders re-freeze
          onFreezeStart(); // re-freeze with the full FX set (icy music filter + HUD glow)
          spcVO("63", "Good shooting — but try grabbing and tossing a frozen **Stroid**.", "idle_gentle");
        } else {
          // freeze expired before the cadet tossed one — wait a beat, drop a fresh powerup
          await waitMs(1000);
          if (!stuntActive) return;
          spawnTutorialPowerup("snowflake", tutZonePoint("center"));
          if (tutorialAsteroidsAllCleared()) spawnTutorialAsteroids(3, 2);
          spcVO("63b", "Freeze expired — grab another one and try the toss.", "idle_gentle");
          await waitPowerupCollected("snowflake");
          showHudPointer("hudFreezeBtn", 6000);
          await waitEvent("freeze"); // re-arm the freeze bank before re-checking for the toss
          hideHudPointer();
        }
      }
      // "toss" event fires the instant the stroid is flicked — wait for it to fully resolve
      // (collide + detonate, or self-destruct) so the cadet sees the destruction first.
      await waitFor(() => !sim.asteroids.some((a) => a.tossed));
      await waitMs(300); // let the blast read before SPC chimes in
      spcVO("64", "Very cool, Cadet.", "praise");
      await clearTutorialField();
      await waitMs(350);
    } },
    { id: "missile", run: async () => {
      spawnTutorialPowerup("missile", tutZonePoint("center"));
      spawnTutorialAsteroids(4, 2);
      spcVO("65", "Pick up the missiles, Cadet.", "talk_calm");
      await waitPowerupCollected("missile");
      spcVO("66", "Tap the missile weapon in the HUD to arm a missile.", "alert");
      showHudPointer("hudMissileBtn", 6000);
      showTaskInstructionDeferred("TAP 🚀 IN YOUR HUD");
      await waitFor(() => missileAimMode);
      hideHudPointer();
      spcVO("67", "Now tap to set a target and watch the destruction.", "alert");
      showTaskInstructionDeferred("TAP THE SCREEN TO SET YOUR TARGET");
      await waitFor(() => activeMissile);
      hideTaskInstruction();
      await waitFor(() => !activeMissile);
      spcVO("68", "Excellent work, Cadet.", "laugh");
      spcVO("69", "This concludes our training for today.", "praise");
      // 2026-06-21 (Item 3): persist completion HERE, the moment training is functionally done —
      // not only inside endTutorial() after the outro hold. Previously the unlock key was written
      // only after the trailing hold, so bailing during that silent window left Practice locked.
      // endTutorial() still writes it too (idempotent).
      try { localStorage.setItem(STUNT_TRAINING_DONE_KEY, "1"); } catch {}
      await waitVOIdle();
      await waitMs(350);
      spcVO("70", "Go practice if you like — the Polyverse awaits.", "shades");
      // Practice goes live as this final line starts. Preserve SPC's active audio/caption during
      // the state handoff; a timer docks/hides the caption after the requested outro hold.
      startStuntPractice({ fromTutorial: true, preserveSpcOutro: true });
    } },
  ];

  // Drives the phase array start-to-finish; aborts cleanly if the session ends mid-phase.
  async function runTutorial() {
    const token = ++_tutRunToken;
    abortTutorialAsync(); // drop any stragglers from a prior session
    for (const k of Object.keys(tutorialEvents)) delete tutorialEvents[k];
    tutorialFireBlocked = false;
    tutorialBlockPlasmaToss = false;
    tutorialSmallGrabHintEnabled = false;
    tutorialState = {};
    try {
      for (tutorialPhase = 0; tutorialPhase < TUTORIAL_PHASES.length; tutorialPhase += 1) {
        if (token !== _tutRunToken) return;
        tutorialState = {};
        _spcLinesCompletedThisPhase = 0; // skip hint only after ≥1 full line of THIS phase is heard
        hideTaskInstruction();           // clear any directive left over from the previous phase
        await TUTORIAL_PHASES[tutorialPhase].run();
      }
    } catch (e) {
      if (e === TUT_ABORT || token !== _tutRunToken) return; // expected on exit
      console.warn("[tutorial] phase error", e);
    }
    if (token !== _tutRunToken) return;
    endTutorial();
  }

  function endTutorial() {
    try { localStorage.setItem(STUNT_TRAINING_DONE_KEY, "1"); } catch {}
    tutorialPhase = -1;
    hideHudPointer();
    startStuntPractice({ fromTutorial: true }); // seamless hand-off — no transition, keep music/bg/SPC
  }

  // stuntNotify: lightweight event counter fed from the existing action sites. No-op outside
  // a tutorial session; the phase script reads these counts via waitEvent().
  function stuntNotify(eventId) {
    if (!stuntActive) return;
    tutorialEvents[eventId] = (tutorialEvents[eventId] || 0) + 1;
  }

  // Called each frame while stuntActive — resolves satisfied async waiters + runs the active
  // phase's optional onUpdate hook. (Level timer / spawns stay off via the stuntActive gate.)
  function updateStunt(now) {
    // Keep tutorial powerups perpetually fresh so an app-switch (or any long pause) never makes
    // them blink red + expire — they live until collected.
    for (let i = 0; i < powerups.length; i += 1) powerups[i].spawnedAt = now;
    // Intro: the perimeter visibly counts down until the cadet grabs the timer powerup (#2).
    if (tutorialTimerRunning) {
      _timerRemainingMs = Math.max(0, levelDurationMs - (now - tutorialTimerStartedAt));
    }
    if (tutorialPaused) return; // frozen: no waiter resolution, no phase progress
    // Subtle, rare "TAP TO SKIP" hint — driven each frame off SPC/queue/waiter/interaction state.
    updateSkipHint(now);
    // 2026-06-17: safety watchdog — if an SPC line never fires its end/timer, force-advance so the
    // tutorial can't hang on a single line. 2026-06-18: _spcLineWatchdogMs is DYNAMIC (set from the
    // real clip duration in pumpSpc), so a long VO is never cut off mid-sentence; only a genuinely
    // stuck line (no metadata, default 8s) trips it.
    if (_spcPlaying && _spcAdvanceFn && performance.now() - _spcLineStartedAt > _spcLineWatchdogMs) _spcAdvanceFn();
    if (_tutWaiters.length) {
      let resolvedAction = false;
      for (let i = _tutWaiters.length - 1; i >= 0; i -= 1) {
        const w = _tutWaiters[i];
        let ok = false;
        try { ok = w.pred(); } catch { ok = false; }
        if (ok) { _tutWaiters.splice(i, 1); w.resolve(); resolvedAction = true; }
      }
      // The player just completed/triggered something — drop any still-queued instructional VO
      // so the next line (usually the success/transition beat) plays immediately. No dead air.
      if (resolvedAction) spcFlush();
    }
    const ph = TUTORIAL_PHASES[tutorialPhase];
    if (ph && ph.onUpdate) { try { ph.onUpdate(now); } catch {} }
  }

  // Part 10: tear down all tutorial state. Idempotent — safe to call from any exit path.
  function cleanupTutorial() {
    _tutRunToken += 1;        // abort any in-flight phase chain
    abortTutorialAsync();
    hideHudPointer();
    hideTimerArrow();
    hidePlasmaRechargeArrow();
    tutorialPhase = -1;
    tutorialState = {};
    for (const k of Object.keys(tutorialEvents)) delete tutorialEvents[k];
    tutorialFireBlocked = false;
    tutorialBlockPlasmaToss = false;
    tutorialSmallGrabHintEnabled = false;
    tutorialPaused = false;
    tutorialTimerRunning = false;
    hideSkipHint();
    hideTaskInstruction();
    hideCommArrows();
    commBoxController.setExclusiveSpeaker(false);
    commBoxController.stopVO(); // 2026-06-20 (Item 4b): flush any in-flight/queued VO on every tutorial exit path
    commBoxController.setCommCenter(false); // dock back to bottom-left
    commBoxController.hideTicker();
    commBoxController.clearPortraitOverride();
  }

  // Tutorial → Practice needs the state/UI teardown above without touching the active SPC line.
  // In particular, do not stop VO, hide the ticker, change comm position, or clear the portrait.
  function cleanupTutorialStateForPractice() {
    _tutRunToken += 1;
    abortTutorialAsync({ preserveSpc: true });
    hideHudPointer();
    hideTimerArrow();
    hidePlasmaRechargeArrow();
    tutorialPhase = -1;
    tutorialState = {};
    for (const k of Object.keys(tutorialEvents)) delete tutorialEvents[k];
    tutorialFireBlocked = false;
    tutorialBlockPlasmaToss = false;
    tutorialSmallGrabHintEnabled = false;
    tutorialPaused = false;
    tutorialTimerRunning = false;
    hideSkipHint();
    hideTaskInstruction();
    hideCommArrows();
  }

  function exitStuntMode() {
    cleanupTutorial();
    stuntActive = false;
    stuntAdvancing = false;
    hideArcadeOverlay();
    commBoxController.hideTicker();
    showModeSelect();   // tears down the arcade session (engineMode → menu) and lands on root
    showStuntModeMenu(); // reopen the Stunt Mode sub-menu where Training/Practice live
  }

  // Part 8: leave an endless Practice session via the Modes button — no score submission, lands
  // back on the Stunt Mode sub-menu (Training / Practice) rather than the arcade menu.
  function exitStuntPractice() {
    practiceEndless = false;
    commBoxController.clearPortraitOverride(); // SPC sat on the portrait through Practice — restore CMDR now
    commBoxController.setExclusiveSpeaker(false); // re-enable CMDR VO outside Practice
    hideArcadeOverlay();
    showModeSelect();   // tears down the arcade session (engineMode → menu)
    showStuntModeMenu();
  }

  // Part 9: Practice = endless arcade gameplay. Reached from the tutorial's end (fromTutorial:
  // true → seamless, no transition) or the Stunt Mode → Practice button (cold start). SPC stays
  // on the portrait the whole time, sitting "cool" in shades — CMDR is NOT restored until exit.
  //
  // 2026-06-16: NO level transition. When handed off from training the field just opens up under
  // the same tutorial background + music — no warp, no level-slam text, no music/theme change.
  // We pin the level-4 spawn config (currentLevelIndex = 3) so the endless update block reads a
  // moderate-density cfg (continuous spawnEveryMs trickle; L1/L2 have spawnEveryMs:0 → empty), but
  // we copy those values directly instead of calling startLevel()/startArcadeAtLevel().
  function startStuntPractice({ fromTutorial = false, preserveSpcOutro = false } = {}) {
    if (preserveSpcOutro) cleanupTutorialStateForPractice();
    else cleanupTutorial();
    stuntActive = false;

    // ── full gameplay reset (mirrors startArcadeNew minus its startArcadeAtLevel(1) launch) ──
    tapBlasts = [];
    clearArcadeProgress();
    setSavedArcadeLevel(1);
    arcadeLives = 0;
    arcadeScore = 0;
    playerBombInventory = 0;
    quadShotUntil = 0;
    _freezeBankMs = 0;
    _freezeActive = false;
    playerFreezeInventory = 0;
    playerMissileInventory = 0;
    missileReloadUntil = 0;
    missileAimMode = false;
    activeMissile = null;
    missileCrosshair = null;
    missileForceSpawnedThisLevel = false;
    nextMineRespawnAt = 0;
    pendingExplosions.length = 0;
    bombAimMode = false;
    hudBombBtn?.classList.remove("hudBombBtn--aiming");
    hudMissileBtn?.classList.remove("hudMissileBtn--aiming");
    updateHudMissileInventory();
    updateHudFreezeInventory();
    updateHudQuadBadge();
    updateHudBombInventory();
    renderLives();
    renderScore();

    // ── cold start (Practice menu button, no tutorial behind us): stand up the same arcade
    //    environment the tutorial uses — tutorial backdrop + music, SPC portrait, running loop.
    //    When handed off from training, all of this is already live, so we leave it untouched
    //    (no music/theme change = seamless continuation). ──
    if (!fromTutorial) {
      audioEngine.unlock?.();
      audioEngine.loadMany?.(GAME_SFX);
      hideArcadeOverlay();
      engineMode = "arcade";
      setMenuOverlayOpen(false);
      setGalaxyViewMode("arcade");
      setGalaxyTool("draw");
      galaxyView?.classList.remove("level-10");
      resizeGalaxyCanvas();
      computePlayfield();
      setTimeout(computePlayfield, 50);
      setGalaxyBackgroundForLevel(1);
      window.galaxyBackground?.show();
      window.galaxyBackground?.setTheme(1);
      window.galaxyBackground?.setLevel(1);
      playArcadeMusicForLevel(0); // level 0 → MUSIC.TUTORIAL (same track as training)
      commBoxController.show();
      commBoxController.setDamageState("normal");
      showFpsOverlay();
      startGalaxyLoop();
    }

    // ── SPC stays put, looking cool: re-pin the portrait override (cleanupTutorial cleared it)
    //    and settle on the shades idle pose. No exclusive-speaker, no centered comm, ticker hidden
    //    — she just sits there blinking (shades ↔ shades_blink) while the player practices. ──
    commBoxController.setPortraitOverride("vo/spc_portrait.png", "SPC");
    // 2026-06-16: Practice shows SPC's mug only — no ticker text, no CMDR voice lines. Exclusive
    // speaker drops every non-SPC queueVO so gameplay praise/reactions stay silent throughout.
    commBoxController.setExclusiveSpeaker(true);
    if (!preserveSpcOutro) {
      commBoxController.setCommCenter(false);
      commBoxController.hideTicker();
      commBoxController.setSpcIdle("shades");
    }

    // ── open the field: level-4 spawn config, endless, NO transition animation ──
    const cfg = ARCADE_LEVELS[3]; // level 4: spawnEveryMs 2000, maxOnScreen 12, all sizes
    currentLevelIndex = 3;        // the endless update block reads ARCADE_LEVELS[currentLevelIndex]
    clearGameplayEntities();      // clear the field (asteroids, mines, ufo, powerups, fx)
    const nowP = performance.now();
    practiceStartedAt = nowP;
    levelDurationMs = cfg.time * 1000; // HUD timer label; the endless loop holds it full each frame
    levelEndsAt = Infinity;            // (re-pinned to now+levelDurationMs by the endless update block)
    levelRunStartAt = nowP;
    arcadePausedUntil = nowP;          // gameplay/spawns allowed immediately
    maxOnScreen = capIOSNativeAsteroids(cfg.maxOnScreen);
    sim.maxAsteroids = capIOSNativeAsteroids(cfg.maxOnScreen);
    totalToSpawn = cfg.totalToClear;
    spawnedTotal = 0;
    spawnQueue = 2;                    // endless loop keeps this topped up
    nextSpawnAt = nowP + 2000;         // first asteroid ~2s in, then every cfg.spawnEveryMs
    resetArcadeTimerVisuals();
    arcadeActive = true;
    retryPending = false;
    arcadeResumeAvailable = false;

    // never-ending: the update loop holds the timer full + re-arms spawns, recurs the UFO, and
    // drips landmines while practiceEndless is set (see the arcade update block).
    practiceEndless = true;
    arcadeUfoSpawnAt = nowP + 30000;   // first UFO ~30s in (then respawns 45s after each kill)
    nextPracticeMineAt = nowP + 60000; // first landmine at 60s, every 60s after
    // Practice powerups: first drop at 8s, then a steady 8s cadence (see the endless update block).
    nextBombPowerupAt = nowP + 8000;
    // Background theme cycling: hold L1 theme, blend to the next every 30s.
    practiceThemeIndex = 1;
    nextThemeCycleAt = nowP + PRACTICE_THEME_INTERVAL_MS;
    if (hudLevel) hudLevel.textContent = "PRACTICE";

    if (preserveSpcOutro) {
      setTimeout(() => {
        if (!practiceEndless) return;
        commBoxController.setCommCenter(false);
        commBoxController.hideTicker();
        commBoxController.setSpcIdle("shades");
      }, 10000);
    }
  }

  function startPracticeMode() {
    if (!PRACTICE_ENABLED) return;
    stuntActive = false;
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
    commBoxController.setLevelEndLock(false); // 2026-06-21 (Item 1b): never carry the level-end VO lock into menus (e.g. the final-level win path bypasses startLevel)
    // 2026-06-13: leaving Stunt Mode by any path is always a clean exit — never preserve it as a
    // resumable arcade session, and clear the flag so a later real game runs its level logic.
    if (stuntActive) {
      cleanupTutorial();
      stuntActive = false;
      stuntAdvancing = false;
      commBoxController.hideTicker();
      preserveArcade = false;
    }
    // 2026-06-15: endless Practice is never a resumable arcade save — always a clean exit.
    if (practiceEndless) {
      practiceEndless = false;
      preserveArcade = false;
      commBoxController.clearPortraitOverride(); // 2026-06-16: SPC owned the portrait in Practice — restore CMDR
      commBoxController.setExclusiveSpeaker(false); // Practice silenced CMDR — re-enable on exit
    }
    const canPreserve = preserveArcade && engineMode === "arcade" && arcadeActive;
    if (canPreserve) {
      const now = performance.now();
      pausedLevelRemainingMs = Math.max(0, levelEndsAt - now);
      pausedLandmineRemainingMs = getLandmineRemainingMs(now);
      arcadeResumeAvailable = true;
    } else {
      commBoxController.hide();
      commBoxController.clearPortraitOverride(); // 2026-06-16: clean exit restores CMDR (SPC owns L13/14)
      clearGameplayEntities();
      arcadeActive = false;
      arcadeResumeAvailable = false;
      if (gamePageActive) playArcadeMenuMusic();
      else audioEngine.stopMusic();
      setGalaxyBackgroundDim(0);
      galaxyView?.classList.remove("level-10");
    }
    engineMode = "menu";
    syncArcadeEntryLabel();
    setArcadeSubmenu(canPreserve && openArcadeMenu ? "arcade" : "root");
    syncArcadeMenuButtons();
    if (!canPreserve) playArcadeMenuMusic();
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

    // 2026-06-13: Stunt Mode runs its own step machine in place of the timed level logic.
    // It deliberately skips the whole arcade block below (no timer, no auto-spawn, no
    // levelComplete, no game-over) while leaving the gameplayAllowed physics/input block active.
    if (stuntActive) updateStunt(now);

    // Arcade, endless Practice, and Training all use quadShotUntil as the active-effect source.
    if (engineMode === "arcade" && arcadeActive) updateHudQuadBadge();

    if (engineMode === "arcade" && arcadeActive && !stuntActive) {
      const cfg = ARCADE_LEVELS[currentLevelIndex];
      // 2026-06-15 (Part 9): Practice is endless — hold the timer full, suppress the low-timer
      // warnings + final-15s gold force, keep a steady spawn stream, and recur UFOs.
      if (practiceEndless) {
        levelEndsAt = now + levelDurationMs;
        levelRunStartAt = now;
        if (spawnQueue < 2) spawnQueue = 2;
        // UFO recurs: respawns 45s after each kill (the 30s first-spawn is armed in startStuntPractice).
        if (!ufo && !arcadeUfoSpawnAt) arcadeUfoSpawnAt = now + 45000;
        // Landmine drip every 60s (only while none is on the field).
        if (!landmine && now >= nextPracticeMineAt) {
          spawnLandmine();
          nextPracticeMineAt = now + 60000;
        }
        // Theme cycle every 30s — setTheme() crossfades via its own blend/tgt system.
        if (now >= nextThemeCycleAt) {
          practiceThemeIndex = (practiceThemeIndex % 15) + 1;
          window.galaxyBackground?.setTheme(practiceThemeIndex);
          nextThemeCycleAt = now + PRACTICE_THEME_INTERVAL_MS;
        }
      }
      // 2026-06-21: a RUNNING freeze drains the bank and pauses the level clock — shift every time
      // anchor by dt each frozen frame so remaining/elapsed (and the perimeter line) hold. dt is
      // clamped to 33ms upstream (script.js Math.min(rawDt,33)), so a huge dt on foreground return
      // can't nuke the bank in one frame. When the bank hits 0, auto-end silently. A PAUSE leaves
      // _freezeActive=false with bank intact — the clock simply resumes ticking (no special case).
      if (_freezeActive) {
        _freezeBankMs -= dt;
        if (_freezeBankMs <= 0) {
          endFreeze(false); // bank drained — silent unfreeze (drops music filter + HUD glow)
        } else {
          levelEndsAt += dt;
          levelRunStartAt += dt;
          if (Number.isFinite(nextSpawnAt)) nextSpawnAt += dt;
          if (nextMineRespawnAt) nextMineRespawnAt += dt; // 2026-06-16: hold mine drip during freeze
        }
      }
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
            spawnAsteroid(
              p.x,
              p.y,
              pickAsteroidKind(cfg),
              true,
              practiceEndless ? pickPracticeAsteroidSpriteKey(now) : null,
            );
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
          spawnAsteroid(
            p.x,
            p.y,
            pickAsteroidKind(cfg),
            true,
            practiceEndless ? pickPracticeAsteroidSpriteKey(now) : null,
          );
          spawnQueue -= 1;
          spawnedTotal += 1;
          nextSpawnAt = Math.max(nextSpawnAt, now + Math.max(350, cfg.spawnEveryMs));
        }

        // 2026-06-16: recurring mid-level mine drops on mineLaunch levels (L12/L13/L15). Only
        // refills when fewer than 2 mines remain on the field, so the chain-reaction layout
        // replenishes without ever stacking up. Re-arms 20-30s out after each drip.
        if (cfg.mineLaunch && now >= nextMineRespawnAt && placedBombs.length < 2) {
          const count = Math.min(2, Math.ceil((cfg.mineCount || 1) / 2));
          for (let i = 0; i < count; i += 1) {
            const mx = playfield.x + playfield.w * (0.2 + Math.random() * 0.6);
            const my = playfield.y + playfield.h * (0.2 + Math.random() * 0.6);
            const mine = createMineEntity(mx, my, cfg.mineFuseMs || LANDMINE_FUSE_MS);
            // 2026-06-17: stagger a 2-mine drip so the pair doesn't auto-arm/detonate together.
            mine.spawnedAt = now + i * 3000;
            placedBombs.push(mine);
            addWarpRing(mx, my, "rgba(124,255,91,1)");
          }
          playGameSfx("blip1", 0.8, { rate: 1.05 });
          nextMineRespawnAt = now + 20000 + Math.random() * 10000;
        }

        const elapsedMs = Math.max(0, now - levelRunStartAt);
        const levelRemainingMs = levelDurationMs - elapsedMs;
        if (!_timerWarnedAt60 && levelRemainingMs <= 20000
            && levelRemainingMs > 0 && engineMode === "arcade") {
          _timerWarnedAt60 = true;
          commBoxController.setDamageState("light");
          // SPC levels: "You're running out of time, Cadet." in place of CMDR's low-time line.
          if (!queueSpcBonusVO("SPC_timer_warning.mp3", { priority: "high" })) {
            commBoxController.queueVO({
              audioSrc: commBoxController.commVoSrc(
                commBoxController.pickFromPool("lowlives", commBoxController.POOL_LOW_LIVES),
              ),
              event: "lowlives",
              priority: "high",
            });
          }
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

        // 2026-06-16: emergency timer drop — on the listed levels, the first time the clock dips
        // under 20s with no timer powerup already on screen, force one out (ignores the on-screen
        // cap on purpose so the lifeline always lands).
        if (!emergencyTimerSpawned
            && EMERGENCY_TIMER_LEVELS.includes(cfg.level)
            && levelRemainingMs < 20000 && levelRemainingMs > 0
            && !powerups.some((p) => p.type === "timer")) {
          emergencyTimerSpawned = true;
          spawnPowerupAt("timer", randomPowerupPoint());
          playGameSfx("bling", 0.8);
        }

        // 2026-06-16: cfg.guaranteedSpawn = [{type, atMs}] — force-drop a powerup once its atMs of
        // level time has elapsed (each entry fires once; re-armed per level in clearGameplayEntities).
        if (Array.isArray(cfg.guaranteedSpawn)) {
          for (let gi = 0; gi < cfg.guaranteedSpawn.length; gi += 1) {
            const g = cfg.guaranteedSpawn[gi];
            if (!firedGuaranteedSpawns.has(gi) && elapsedMs >= (g?.atMs || 0)) {
              firedGuaranteedSpawns.add(gi);
              spawnPowerupAt(g.type, randomPowerupPoint());
              playGameSfx("bling", 0.8);
            }
          }
        }

        // 2026-06-16: cfg.speedEscalation (L15) — scale every live asteroid toward a target
        // multiplier of 1 + (elapsedMs/5000)*0.04 (≈4% per 5s), capped at 2.5x the spawn speed.
        // We apply only the per-tick delta ratio so collision-modified velocities ramp in step;
        // freeze pauses elapsedMs, so the ramp naturally holds during a freeze.
        if (cfg.speedEscalation) {
          const target = Math.min(2.5, 1 + (elapsedMs / 5000) * 0.04);
          if (target > appliedSpeedEscalation + 1e-4) {
            const ratio = target / appliedSpeedEscalation;
            for (let ai = 0; ai < sim.asteroids.length; ai += 1) {
              sim.asteroids[ai].vx *= ratio;
              sim.asteroids[ai].vy *= ratio;
            }
            appliedSpeedEscalation = target;
          }
        }

        // 2026-06-10: periodically spawn a collectible powerup (weighted random type).
        // Progressive introduction — no powerups before level 4. Spawn zone keeps clear of
        // the top HUD (140px) and the commander portrait/comm box (160px).
        // DEBUG: revert before release — gate is normally cfg.level >= 4
        // 2026-06-16: while the player holds a missile or one is in flight, suppress ONLY a new
        // missile spawn — not the whole powerup system. Previously missileBusy gated this entire
        // block, so once a missile was collected (and the debug force-spawn drops one every level)
        // quad/freeze/bomb stopped appearing entirely. Other types must keep dropping.
        const missileBusy = playerMissileInventory > 0 || activeMissile;
        if (powerups.length < POWERUP_MAX_ONSCREEN && cfg.level >= 1 && now >= nextBombPowerupAt) {
          const puType = practiceEndless ? pick(PRACTICE_POWERUP_POOL) : pickPowerupForLevel(cfg);
          if (puType === "missile" && missileBusy) {
            // skip this missile roll while one is held/in flight; retry shortly with a fresh type.
            nextBombPowerupAt = now + 1500;
          } else {
            spawnPowerupAt(puType, randomPowerupPoint());
            playGameSfx("bling", 0.8);
            // Practice mode: steady 8s cadence with its own weapon-focused pool. Otherwise
            // 2026-06-15: honor a fixed per-level cadence (cfg.powerupIntervalMs) when set.
            nextBombPowerupAt = practiceEndless
              ? now + PRACTICE_POWERUP_INTERVAL_MS
              : cfg.powerupIntervalMs
                ? now + cfg.powerupIntervalMs
                : now + BOMB_POWERUP_INTERVAL_MIN
                  + Math.random() * (BOMB_POWERUP_INTERVAL_MAX - BOMB_POWERUP_INTERVAL_MIN);
          }
        }

        // DEBUG: revert before release — force one missile powerup at the start of each level
        // so the homing missile is easy to test (mirrors the goldbars force-spawn below).
        if (!missileForceSpawnedThisLevel && missileUnlocked(cfg.level) && !missileBusy
            && (!cfg.powerupOverride || cfg.powerupOverride.includes("missile"))
            && !powerups.some((p) => p.type === "missile")) {
          missileForceSpawnedThisLevel = true;
          const missilePt = randomPowerupPoint();
          powerups.push({
            type: "missile",
            x: missilePt.x,
            y: missilePt.y,
            r: 22,
            spawnedAt: now,
            opacity: 1.0,
          });
          playGameSfx("bling", 0.8);
        }
        // expire after lifetime (powerup expiry keeps running even during a snowflake freeze)
        for (let pi = powerups.length - 1; pi >= 0; pi -= 1) {
          if (now - powerups[pi].spawnedAt > BOMB_POWERUP_LIFETIME_MS) powerups.splice(pi, 1);
        }
        // DEBUG: revert before release — force a goldbars spawn in the level's final 15s
        // (once per level, normal margins) so the gold pickup is easy to test.
        if (!goldbarsForceSpawnedThisLevel && levelRemainingMs <= 15000 && levelRemainingMs > 0
            && (!cfg.powerupOverride || cfg.powerupOverride.includes("goldbars"))
            && !powerups.some((p) => p.type === "goldbars")) {
          goldbarsForceSpawnedThisLevel = true;
          const goldPt = randomPowerupPoint();
          powerups.push({
            type: "goldbars",
            x: goldPt.x,
            y: goldPt.y,
            r: 22,
            spawnedAt: now,
            opacity: 1.0,
          });
          playGameSfx("blip", 0.8);
        }
        updateHudMissileInventory();
      }

      if (!ufo && arcadeUfoSpawnAt && now >= arcadeUfoSpawnAt && now >= arcadePausedUntil) {
        spawnUfo();
        arcadeUfoSpawnAt = 0;
      }

      if (!practiceEndless && spawnQueue === 0 && spawnedTotal >= totalToSpawn && sim.asteroids.length === 0) {
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
      // 2026-06-16: advance the in-flight missile HERE (not in the arcade-only block above, which
      // is gated off by !stuntActive). During the Stunt tutorial Phase 9 the missile launched but
      // was never stepped, so it sat frozen at the launch point and never flew/exploded — the
      // phase waiter (await !activeMissile) then hung forever. Practice mode missiles now step too.
      stepMissile(now);
      stepMissileSplitQueue();
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
      const simFrozen = _freezeActive;
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
        // 2026-06-13: a cold-drift toss (no flick) released during this same freeze also keeps
        // gliding — _coldTossSession tags the releasing freeze session (see slowTossFallback).
        if (simFrozen && !a.tossed && !(a._coldTossSession === _freezeSessionId)) continue;
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
        // 2026-06-14: ease a knocked-back asteroid's super-normal speed back down to the drift
        // ceiling — exponential decay of the excess (~3s to settle from a full missile shove).
        if (!a.tossed) {
          const sp = Math.hypot(a.vx, a.vy);
          if (sp > KNOCKBACK_DRIFT_MAX) {
            const newSp = KNOCKBACK_DRIFT_MAX + (sp - KNOCKBACK_DRIFT_MAX) * Math.exp(-dt / 700);
            const k = newSp / sp;
            a.vx *= k;
            a.vy *= k;
          }
        }
        applyMotionHealth(a, now);
      }
      updateStroidTossHold(now);
      updateTossedAsteroidCollision(now);
      stepFlameTrail(dt, now);
      if (simFrozen) updateColdTossFreezeCollision(now);
      else resolveAsteroidCollisions();

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
      // 2026-06-16: detonate any mines queued by a chain reaction this frame (mine/bomb/missile
      // blasts enqueue caught mines instead of recursing — see chainDetonateMines).
      processPendingExplosions();

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
            if (now >= ufo.teleportAt && !ufo.tutorial) {
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
    const frozen = _freezeActive;
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
    const frozen = _freezeActive;
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
        // 2026-06-14: the missile gets an explicit gold glow ring (#ffd700) behind its sprite.
        if (pu.type === "missile") {
          tctx.beginPath();
          tctx.arc(0, 0, POWERUP_SPRITE_SIZE / 2 - 2, 0, Math.PI * 2);
          tctx.strokeStyle = blinkRed ? "#ff3333" : "#ffd700";
          tctx.lineWidth = 2.5;
          tctx.shadowColor = blinkRed ? "#ff3333" : "#ffd700";
          tctx.shadowBlur = 14;
          tctx.stroke();
          tctx.shadowBlur = 0;
        }
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
    if (!tctx || !_freezeActive) return;
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
    // 2026-06-15: ring depletes against the mine's actual fuse (level mines can shorten it).
    const progress = Math.max(0, 1 - (now - landmine.armedAt) / (landmine.fuseMs || LANDMINE_FUSE_MS));
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
        // 2026-06-15: ring depletes against the mine's actual fuse (level-config mines set
        // a custom mineFuseMs, e.g. 5000 on L12/L13/L15) so the arc matches detonation timing.
        const progress = Math.max(0, 1 - (now - mine.armedAt) / (mine.fuseMs || LANDMINE_FUSE_MS));
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
      // KEEP LAST: the missile crosshair (drawMissileFx) must render AFTER drawPowerups on the same
      // overlay so it's never hidden behind a powerup sprite (Part 5, 2026-06-17).
      drawMissileFx(ufoFxCtx || ctx, now);
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
    // KEEP LAST (over powerups): crosshair must sit above powerup sprites (Part 5, 2026-06-17).
    drawMissileFx(ufoFxCtx || ctx, now);

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
    sampleLevelTransitionFrame(rawDt, now);
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
    // 2026-06-14 (PART 9.3): this runs BEFORE the missile-aim check so collecting a powerup
    // always wins over placing a missile target at the same point.
    for (let pi = 0; pi < powerups.length; pi += 1) {
      const pu = powerups[pi];
      if (Math.hypot(x - pu.x, y - pu.y) <= pu.r * 1.8) {
        powerups.splice(pi, 1);
        collectPowerup(pu);
        return;
      }
    }
    // 2026-06-14 (PART 4): missile targeting — the next tap places the crosshair + fires.
    // Consumes the tap (no laser/X-blast). Bomb aim (top) already returned earlier.
    if (missileAimMode) {
      missileAimMode = false;
      hudMissileBtn?.classList.remove("hudMissileBtn--aiming");
      // ignore if a missile slipped into flight / reload between arming and this tap
      if (playerMissileInventory > 0 && performance.now() > missileReloadUntil && !activeMissile) {
        placeMissileTarget(x, y);
      }
      updateHudMissileInventory();
      draw(now);
      return;
    }
    playPlayerFireSound();
    // 2026-06-10: while quadshot is active a single tap can destroy several things at once —
    // exempt the whole hit resolution from the native per-frame sound budget so every hit's
    // destruction sound layers instead of being dropped.
    const quadActive = performance.now() < quadShotUntil;
    _sfxBudgetExempt = quadActive;
    const hitSomething = resolveShotAt(x, y, now, isTouch);
    // Tutorial chatter is skipped by tapping the subtle "TAP TO SKIP" hint above the comm box
    // (the hint text is its own tap target) — the old double-tap-empty-space detection is gone.
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
        // 2026-06-14: each cluster shot fires its own report so quadshot sounds like a burst
        // (was silent past the first tap). Budget-exempt above so they layer instead of dropping.
        playGameSfx("advfire", 0.6, { important: true });
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
      stuntNotify("mine_tap"); // tutorial Phase 6: player engaged the bomb (arm / detonate)
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
    if (hitIndex >= 0 && !tutorialFireBlocked) {
      triggerCrosshairFire();
      splitAsteroidByIndex(hitIndex);
      stuntNotify("shoot");
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
        playGameSfx("weaponclick_pickupbomb", 0.9); // layered bomb-pickup sound
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
      _timerRemainingMs = levelDurationMs; // snap the perimeter visibly back to full
      tutorialTimerRunning = false;        // ...and freeze it there (no one-frame re-deplete)
      playGameSfx("bling", 0.95);          // clear, audible pickup
      playGameSfx("life_gain", 1.0);       // + chime
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
      playGameSfx("pickup_weapon", 0.9); // layered quadshot-pickup sound
      cssFlash("#cc66ff", 0.22, 250);
      // 2026-06-14: quad shot supersedes the missile weapon — clear missile inventory + aim.
      playerMissileInventory = 0;
      missileAimMode = false;
      updateHudMissileInventory();
      return;
    }
    if (pu.type === "missile") {
      // 2026-06-16: one pickup grants +1 missile by default (the rocket art), fired one at a time
      // with a reload between shots. A powerup may override the grant via pu.missileCount (e.g. a
      // level that hands out a full pack). Always capped at MAX_MISSILE_INVENTORY.
      const grant = pu.missileCount || 1;
      playerMissileInventory = Math.min(playerMissileInventory + grant, MAX_MISSILE_INVENTORY);
      updateHudMissileInventory();
      playGameSfx("pickup_weapon", 0.9);
      cssFlash("#ff4444", 0.2, 250);
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

  // 2026-06-17: all the freeze-ON effects (flash, shake, sfx, icy music highpass, HUD active
  // glow). Kept stuntNotify OUT of here so internal tutorial re-freezes can reuse it without
  // firing a spurious "freeze" tutorial event. Used for BOTH first activation and resume.
  function onFreezeStart() {
    cssFlash("#88ddff", 0.25, 300);
    cssShake(0.8);
    playGameSfx("freeze", 0.9);
    audioEngine.applyFreezeFilter();
    if (hudFreezeBtn) hudFreezeBtn.classList.add("hudFreezeBtn--active");
  }
  // 2026-06-21: the freeze-OFF *effects only* (unfreeze sfx, drop music filter + HUD glow) — no
  // state change. Fired on every PAUSE and on the silent auto-expiry/full-clear. `manual` plays
  // the unfreeze sound a touch louder than a silent auto-lapse.
  function freezePauseFx(manual) {
    playGameSfx("unfreeze", manual ? 0.9 : 0.85);
    audioEngine.removeFreezeFilter();
    if (hudFreezeBtn) hudFreezeBtn.classList.remove("hudFreezeBtn--active");
  }
  // 2026-06-21: fully end a freeze — drains the bank to 0 and runs the OFF effects. Called on
  // auto-expiry (bank hit 0) and on every level-end/reset path. Idempotent: a no-op if nothing
  // is banked/active, so reset sites can call it unconditionally.
  function endFreeze(manual) {
    if (_freezeBankMs <= 0 && !_freezeActive) {
      _freezeBankMs = 0;
      _freezeActive = false;
      return;
    }
    _freezeBankMs = 0;
    _freezeActive = false;
    freezePauseFx(manual);
  }

  // 2026-06-21: player-tapped HUD ❄ button — freeze is a PAUSABLE TIMER, not a toggle.
  //  • running    → PAUSE: stop the clock, bank the remaining time, run OFF fx. No charge change.
  //  • paused w/ bank → RESUME: restart the clock, run ON fx. No charge consumed.
  //  • empty bank + stocked → ACTIVATE: spend 1 charge, bank FREEZE_DURATION_MS, new session, ON fx.
  // The update loop auto-ends (silent) when the bank drains to 0.
  function toggleFreezeFromInventory() {
    if (_freezeActive) {
      // running → pause; keep the remaining bank for a later resume.
      _freezeActive = false;
      freezePauseFx(true);
      updateHudFreezeInventory();
      return;
    }
    if (_freezeBankMs > 0) {
      // paused with time banked → resume without spending a charge.
      _freezeActive = true;
      onFreezeStart();
      updateHudFreezeInventory();
      return;
    }
    // empty bank → fresh activation from inventory.
    if (playerFreezeInventory <= 0) return;
    playerFreezeInventory--;
    _freezeBankMs = FREEZE_DURATION_MS;
    _freezeActive = true;
    _freezeSessionId++; // new session so prior cold-toss gliders re-freeze
    updateHudFreezeInventory();
    onFreezeStart();
    stuntNotify("freeze");
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2026-06-14: MISSILE — targeting → flight → explosion (dumb-fire, not homing).
  // The HUD button arms missileAimMode; the next play-area tap places the target +
  // blast-zone marker and launches a single missile from the bottom-left that flies
  // straight to the tapped point over ~1s, then detonates with a half-bomb-radius
  // blast that fully vaporizes everything inside it (and flings the rest).
  // ──────────────────────────────────────────────────────────────────────────

  // PART 4: place the target + immediately fire. Called from the tap handler.
  function placeMissileTarget(x, y) {
    // 2026-06-14: dumb-fire — the missile always flies to the player's tapped target (no homing).
    // The crosshair doubles as the blast-zone marker (radius MISSILE_BLAST_RADIUS), drawn in
    // drawMissileFx while the missile is in flight.
    missileCrosshair = { x, y, placedAt: performance.now() };
    playGameSfx("missile_lockon", 0.9);
    triggerGameplayHapticImpact(hapticImpactStyle.Medium); // target-lock confirm buzz
    fireMissile(x, y);
  }

  // PART 5: launch the missile entity from the bottom-left.
  function fireMissile(targetX, targetY) {
    if (activeMissile) return; // max 1 missile in flight
    if (playerMissileInventory <= 0) return;
    const nowM = performance.now();
    playGameSfx("missile_fired", 0.95);
    playerMissileInventory -= 1;
    missileReloadUntil = nowM + MISSILE_RELOAD_MS;
    updateHudMissileInventory();
    const launchX = 80;
    const launchY = sim.height - 80;
    activeMissile = {
      x: launchX,
      y: launchY,
      launchX,
      launchY,
      targetX,
      targetY,
      launchedAt: nowM,
      flightMs: 1000, // 1.0s dramatic flight
      exploded: false,
      prehitPlayed: false,
      angle: 0,
    };
    // PART 6 tail: when the reload completes (and a missile is still stocked) chirp + pulse.
    // The ready-pulse class is driven by updateHudMissileInventory once missileReloadUntil passes.
    setTimeout(() => {
      if (engineMode === "arcade" && playerMissileInventory > 0) {
        playGameSfx("pickup_weapon", 0.7);
      }
    }, MISSILE_RELOAD_MS);
  }

  // PART 5: advance the in-flight missile each frame (straight flight to target + prehit + detonate).
  function stepMissile(now) {
    const m = activeMissile;
    if (!m || m.exploded) return;
    const t = clamp((now - m.launchedAt) / m.flightMs, 0, 1);
    m.x = lerp(m.launchX, m.targetX, t);
    m.y = lerp(m.launchY, m.targetY, t);
    // 2026-06-14: rocket exhaust — emit orange sparks at the tail each frame into the shared
    // flameTrail system (it advances, draws, and expires them; drawn under the missile sprite).
    {
      const dxh = m.targetX - m.x;
      const dyh = m.targetY - m.y;
      const hl = Math.hypot(dxh, dyh) || 1;
      const nx = dxh / hl;
      const ny = dyh / hl;
      const tailX = m.x - nx * 10;
      const tailY = m.y - ny * 10;
      const count = 2 + (Math.random() < 0.5 ? 1 : 0);
      for (let i = 0; i < count && flameTrail.length < FLAME_TRAIL_MAX; i += 1) {
        flameTrail.push({
          x: tailX + (Math.random() - 0.5) * 5,
          y: tailY + (Math.random() - 0.5) * 5,
          vx: -nx * 60 + (Math.random() - 0.5) * 40, // drift back along the tail + scatter
          vy: -ny * 60 + (Math.random() - 0.5) * 40,
          life: 0,
          ttl: 260 + Math.random() * 160,
          r: 2 + Math.random() * 2.5,
          color: FLAME_COLORS[(Math.random() * FLAME_COLORS.length) | 0],
        });
      }
    }
    if (t > 0.85 && !m.prehitPlayed) {
      m.prehitPlayed = true;
      playGameSfx("missile_prehit", 0.9);
    }
    if (t >= 1) {
      m.exploded = true;
      const tx = m.targetX;
      const ty = m.targetY;
      activeMissile = null;
      missileCrosshair = null; // remove crosshair + lock ring on impact
      explodeMissile(tx, ty);
      updateHudMissileInventory();
    }
  }

  // 2026-06-14: drain the queued missile-blast splits a few per frame. Skip any asteroid that's
  // gone (destroyed by another path) or drifted clear of the blast — guards against a pooled
  // object being recycled into a far-away new asteroid before its turn comes up.
  function stepMissileSplitQueue() {
    if (missileSplitQueue.length === 0) return;
    let budget = MISSILE_SPLITS_PER_FRAME;
    while (budget > 0 && missileSplitQueue.length) {
      budget -= 1;
      const { a, cx, cy, r } = missileSplitQueue.shift();
      const idx = sim.asteroids.indexOf(a);
      if (idx < 0) continue;
      if (Math.hypot(a.x - cx, a.y - cy) > r * 1.3) continue;
      // 2026-06-14: missile fully VAPORIZES asteroids (big rocks don't split into children) with
      // fiery debris + particles. Per-asteroid booms suppressed — the one missile_explo carries it.
      vaporizeAsteroidByIndex(idx, true);
    }
  }

  // PART 6: knockback for an object outside the blast radius — force scales with proximity.
  function applyMissileKnockback(obj, dx, dy, dist, blastRadius) {
    const force = Math.max(0, 1 - dist / (blastRadius * 3)) * 800;
    if (force <= 0) return;
    obj.vx = (obj.vx || 0) + (dx / dist) * force;
    obj.vy = (obj.vy || 0) + (dy / dist) * force;
    const sp = Math.hypot(obj.vx, obj.vy);
    if (sp > 700) {
      obj.vx *= 700 / sp;
      obj.vy *= 700 / sp;
    }
  }

  // PART 6: missile impact — destroy everything inside MISSILE_BLAST_RADIUS, fling the rest.
  function explodeMissile(tx, ty) {
    const blastRadius = MISSILE_BLAST_RADIUS;
    // important: don't let the per-frame iOS sound budget drop the main blast report
    playGameSfx("missile_explo", 1.0, { important: true });
    // 2026-06-14: keep this base burst modest — the iOS particle budget (MAX_EXPLOSION_PARTICLES)
    // is small, so a huge burst here would starve the per-asteroid vaporize FX (they'd "just
    // disappear"). The staggered vaporize refills the budget across frames for fiery debris.
    spawnExplosion(tx, ty, 22, true, 1.3); // fiery impact core
    window.pixiRenderer?.triggerBombDetonation?.(tx, ty, blastRadius);
    addWarpRing(tx, ty, "rgba(255,90,90,1)");
    missileImpactFlash = { x: tx, y: ty, start: performance.now() }; // localized impact flash
    triggerHugeHaptic(); // big rumble on detonation
    cssShake(1.4);
    cssFlash("#ff5500", 0.24, 220);
    window.galaxyBackground?.setHectic(true);
    setTimeout(() => window.galaxyBackground?.setHectic(false), 2000);
    // asteroids — knock back the ones outside the blast immediately (cheap); QUEUE the ones
    // inside for staggered splitting (a few per frame in stepMissileSplitQueue) so we don't
    // split a whole field in one frame — that synchronous burst was the explosion hitch.
    for (let i = sim.asteroids.length - 1; i >= 0; i -= 1) {
      const a = sim.asteroids[i];
      const dx = a.x - tx;
      const dy = a.y - ty;
      const dist = Math.hypot(dx, dy) || 0.0001;
      if (dist <= blastRadius) missileSplitQueue.push({ a, cx: tx, cy: ty, r: blastRadius });
      else applyMissileKnockback(a, dx, dy, dist, blastRadius);
    }
    // UFO — destroy (blast hit) if inside, else knock it back (UFO moves via vx/vy)
    if (ufo) {
      const dx = ufo.x - tx;
      const dy = ufo.y - ty;
      const dist = Math.hypot(dx, dy) || 0.0001;
      if (dist <= blastRadius) hitUfo();
      else applyMissileKnockback(ufo, dx, dy, dist, blastRadius);
    }
    // level landmine — detonate if caught in the blast (static, so no knockback)
    if (landmine) {
      const dist = Math.hypot(landmine.x - tx, landmine.y - ty);
      if (dist <= blastRadius) explodeLandmine({ halfRadius: true });
    }
    // placed bombs — iterate backwards (explodePlacedBomb splices, and a chain detonation can
    // splice further entries this same pass, so a slot may already be gone — guard against it).
    for (let i = placedBombs.length - 1; i >= 0; i -= 1) {
      const b = placedBombs[i];
      if (!b) continue; // 2026-06-16: removed by a chain reaction earlier in this loop
      const dist = Math.hypot(b.x - tx, b.y - ty);
      if (dist <= blastRadius) explodePlacedBomb(b, { halfRadius: true });
    }
  }

  // PART 4/5 draw: localized impact flash + blast-zone marker + the pixel rocket. On the ufoFx
  // overlay each frame.
  function drawMissileFx(tctx, now) {
    if (!tctx) return;
    // localized impact flash — a quick additive fireball pop at the detonation point
    if (missileImpactFlash) {
      const age = now - missileImpactFlash.start;
      const dur = 260;
      if (age >= dur) {
        missileImpactFlash = null;
      } else {
        const t = age / dur;
        const k = 1 - t;
        const R = 40 + t * 200;
        tctx.save();
        tctx.globalCompositeOperation = "lighter";
        tctx.globalAlpha = k * 0.55;
        tctx.fillStyle = "rgba(255,120,40,1)";
        tctx.beginPath(); tctx.arc(missileImpactFlash.x, missileImpactFlash.y, R, 0, Math.PI * 2); tctx.fill();
        tctx.globalAlpha = k * 0.8;
        tctx.fillStyle = "rgba(255,210,120,1)";
        tctx.beginPath(); tctx.arc(missileImpactFlash.x, missileImpactFlash.y, R * 0.55, 0, Math.PI * 2); tctx.fill();
        tctx.globalAlpha = k * 0.95;
        tctx.fillStyle = "rgba(255,255,235,1)";
        tctx.beginPath(); tctx.arc(missileImpactFlash.x, missileImpactFlash.y, R * 0.26, 0, Math.PI * 2); tctx.fill();
        tctx.restore();
      }
    }
    // blast-zone marker — a flashing red circle showing where the missile will detonate and the
    // radius it will clear (drawn while the crosshair/target is live).
    if (missileCrosshair) {
      const ch = missileCrosshair;
      const flashOn = Math.floor(now / 140) % 2 === 0; // ~3.5Hz flash
      tctx.save();
      tctx.strokeStyle = flashOn ? "rgba(255,51,51,0.95)" : "rgba(255,120,80,0.5)";
      tctx.lineWidth = 2.5;
      tctx.shadowColor = "#ff3333";
      tctx.shadowBlur = 10;
      tctx.beginPath();
      tctx.arc(ch.x, ch.y, MISSILE_BLAST_RADIUS, 0, Math.PI * 2);
      tctx.stroke();
      // faint danger-zone fill
      tctx.globalAlpha = flashOn ? 0.1 : 0.05;
      tctx.fillStyle = "#ff3333";
      tctx.beginPath();
      tctx.arc(ch.x, ch.y, MISSILE_BLAST_RADIUS, 0, Math.PI * 2);
      tctx.fill();
      tctx.globalAlpha = 1;
      // small center crosshair at the exact target
      tctx.shadowBlur = 6;
      const arm = 14;
      tctx.beginPath();
      tctx.moveTo(ch.x - arm, ch.y); tctx.lineTo(ch.x - 5, ch.y);
      tctx.moveTo(ch.x + 5, ch.y); tctx.lineTo(ch.x + arm, ch.y);
      tctx.moveTo(ch.x, ch.y - arm); tctx.lineTo(ch.x, ch.y - 5);
      tctx.moveTo(ch.x, ch.y + 5); tctx.lineTo(ch.x, ch.y + arm);
      tctx.stroke();
      tctx.restore();
    }
    const m = activeMissile;
    if (m && !m.exploded) {
      let ang = Math.atan2(m.targetY - m.y, m.targetX - m.x);
      if (Math.hypot(m.targetX - m.x, m.targetY - m.y) < 4) ang = m.angle;
      m.angle = ang;
      tctx.save();
      tctx.translate(m.x, m.y);
      tctx.rotate(ang);
      // flame trail — orange/yellow puffs behind the body (−x), fading
      for (let i = 0; i < 4; i += 1) {
        const fx = -10 - i * 6;
        const a = Math.max(0, 0.7 - i * 0.16);
        tctx.fillStyle = `rgba(255,${180 - i * 30},40,${a.toFixed(2)})`;
        tctx.beginPath();
        tctx.arc(fx + (Math.random() * 2 - 1), Math.random() * 2 - 1, Math.max(1, 4 - i * 0.7), 0, Math.PI * 2);
        tctx.fill();
      }
      // body — silver rectangle ~14×8
      tctx.fillStyle = "#cfd4da";
      tctx.fillRect(-7, -4, 14, 8);
      // tip — red triangle at the front (+x)
      tctx.fillStyle = "#ff3a2a";
      tctx.beginPath();
      tctx.moveTo(7, -4);
      tctx.lineTo(15, 0);
      tctx.lineTo(7, 4);
      tctx.closePath();
      tctx.fill();
      tctx.restore();
    }
  }

  // 2026-06-10: frozen-asteroid destruction — glass-break layer over the normal boom plus
  // ice debris. Runs for any destruction path while a freeze is active.
  function addFrozenShatterFx(x, y, playSound = true) {
    if (!_freezeActive) return;
    if (playSound) playGameSfx("freeze_explode", 0.9);
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
    // A real in-bounds play-area press is a gameplay action → hide the skip hint instantly and
    // suppress it for the next 2s (tap-to-skip rework 2026-06-16).
    if (stuntActive) { _lastTutInteractionAt = now; hideSkipHint(false); }
    let mode = "tap";
    // 2026-06-15: while aiming a missile or bomb, a play-area press must place the target — it
    // must NOT grab a stroid/mine for tossing. Tapping on/near a stroid to target it was being
    // hijacked into a toss-grab, so the missile/bomb never fired (the tutorial "missile didn't
    // fire" bug). Suppress the grab entirely in either aim mode so the tap reaches handleArcadeTap.
    if (engineMode === "arcade" && arcadeActive && !missileAimMode && !bombAimMode) {
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
        } else if (tutorialSmallGrabHintEnabled && hitAsteroid && hitAsteroid.kind === 1) {
          // Coach this only during the stroid-toss lesson. Everywhere else, small-stroid taps
          // fall through silently to the laser path so Training/Practice stay non-chatty.
          if (now - _spcGrabSmallAt > 8000) {
            _spcGrabSmallAt = now;
            spcVO("grab_small", "Smaller **Stroids** cannot be grabbed, Cadet.", "idle_smirk");
          }
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
      const wasGrabbed = stroidToss.active;
      const didLaunch = stroidToss.active ? launchStroidToss(now) : false;
      if (didLaunch) stuntNotify("toss");
      if (!didLaunch) {
        if (wasGrabbed) stuntNotify("toss_fail"); // grabbed but released without a flick (Phase 5 coaching)
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
    playArcadeMenuMusic() {
      playArcadeMenuMusic();
    },
    startArcadeAtLevel(levelNum) {
      startArcadeAtLevel(levelNum);
    },
    startStuntMode() {
      startStuntMode();
    },
    showStuntModeMenu() {
      showStuntModeMenu();
    },
    startStuntPractice() {
      if (!isStuntTrainingComplete()) return; // gated until training is finished
      startStuntPractice();
    },
    isTutorialActive() {
      return stuntActive;
    },
    isTutorialPaused() {
      return tutorialPaused;
    },
    isPracticeEndless() {
      return practiceEndless;
    },
    exitStuntPractice() {
      exitStuntPractice();
    },
    pauseTutorial() {
      pauseTutorial();
    },
    resumeTutorial() {
      resumeTutorial();
    },
    // Part 6: app-switch back into a training/practice session. The audio context gets suspended
    // on background, killing SFX — re-prime it here and resume any SPC line paused on hide.
    onAppForeground() {
      if (!stuntActive && !practiceEndless) return;
      // 2026-06-16: iOS releases the audio session during a speak-to-text / dictation pass and
      // doesn't restore it instantly on foreground. Wait 300ms so the session is fully back before
      // unlocking, then re-prime (loadMany) the SFX buffers iOS dropped, and resume any paused SPC line.
      setTimeout(() => {
        if (!stuntActive && !practiceEndless) return;
        audioEngine.unlock?.();
        audioEngine.loadMany?.(GAME_SFX);
        resizeGalaxyCanvas();
        computePlayfield();
        if (!galaxyRunning) startGalaxyLoop();
        window.galaxyBackground?.show();
        if (!tutorialPaused && _spcAudio) { try { _spcAudio.play().catch(() => {}); } catch {} }
      }, 300);
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
      // 2026-06-14: bomb aim takes priority — cancel any active missile aim.
      if (bombAimMode && missileAimMode) {
        missileAimMode = false;
        hudMissileBtn?.classList.remove("hudMissileBtn--aiming");
        updateHudMissileInventory();
      }
      updateHudBombInventory(); // suppress/restore the attention pulse based on aim state
      if (bombAimMode) playGameSfx("blip", 0.6);
    },
    // 2026-06-17: HUD freeze button — toggle freeze on/off (tap to freeze, tap again to unfreeze)
    activateFreeze() {
      if (!arcadeActive || engineMode !== "arcade") return;
      toggleFreezeFromInventory();
    },
    // 2026-06-14: HUD missile button — toggle aim mode; the next canvas tap sets the target.
    toggleMissileAim() {
      if (!arcadeActive || engineMode !== "arcade") return;
      if (missileAimMode) {
        missileAimMode = false;
        hudMissileBtn?.classList.remove("hudMissileBtn--aiming");
        updateHudMissileInventory();
        return;
      }
      // can't aim with no stock, mid-reload, or a missile already in flight
      if (playerMissileInventory <= 0 || performance.now() <= missileReloadUntil || activeMissile) {
        missileAimMode = false;
        hudMissileBtn?.classList.remove("hudMissileBtn--aiming");
        return;
      }
      // bomb aim takes priority — entering missile aim cancels bomb aim
      if (bombAimMode) {
        bombAimMode = false;
        hudBombBtn?.classList.remove("hudBombBtn--aiming");
        updateHudBombInventory();
      }
      missileAimMode = true;
      hudMissileBtn?.classList.add("hudMissileBtn--aiming");
      updateHudMissileInventory();
      // 2026-06-14: arming the missile uses the weapon/reload sound, not the generic powerup blip
      playGameSfx("pickup_weapon", 0.7);
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
// DEPRECATED 2026-06-16: procedural Oracle starfield. No longer called (the #galaxyCanvas
// element was removed and the Oracle background is now #oracleBgVideo → assets/video/oracle_bg.mp4).
// Kept inert as dead code — self-no-ops because getElementById returns null. Safe to delete.
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

  // Fade the starfield in instead of popping it over the bare gradient on launch.
  // Reduced-motion: just show it. Otherwise we must guarantee the browser commits
  // the opacity:0 start state to a painted frame *before* flipping to .is-ready,
  // or it coalesces both states into one style recalc and the transition never
  // runs (the canvas snaps on). Force a reflow to lock in opacity:0, then flip on
  // a later frame (double rAF — a single rAF can still be coalesced in WKWebView).
  if (prefersReducedMotion) {
    canvas.classList.add("is-ready");
  } else {
    void canvas.offsetWidth; // commit opacity:0 as a painted state
    requestAnimationFrame(() =>
      requestAnimationFrame(() => canvas.classList.add("is-ready")),
    );
  }
}
