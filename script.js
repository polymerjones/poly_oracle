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
          // 2026-06-25: was favicon.png — the stale Feb icon (old pink orb) that showed on the iOS
          // lock-screen / Now Playing. android-chrome-512.png is the current app-icon art (matches
          // the Xcode AppIcon) and is copied into www/ by prepare:web.
          src: "android-chrome-512.png",
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

async function updateMediaSessionLevel(levelNum, levelLabel) {
  if (!_mediaSession) return;
  try {
    // 2026-06-22: "L2 - SHAKE DOWN" style now-playing title (level number + name).
    const title = levelLabel ? `L${levelNum} - ${levelLabel}` : `L${levelNum}`;
    await _mediaSession.setMetadata({
      title,
      artist: "POLYVERSE",
      album: "Arcade Mode",
      artwork: [{
        // 2026-06-25: current app-icon art (was the stale favicon.png) — see initMediaSession.
        src: "android-chrome-512.png",
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
const BUILD_TS = "2026-07-04 22:32";
const debugTapsKey = "poly_oracle_debug_taps";
const ufoFxPresetKey = "poly_oracle_ufo_fx_preset";
const STORAGE_BEST_RUN = "poly-oracle-best-run";
const STORAGE_GAME_BEATEN = "poly-oracle-game-beaten";
const DISABLE_VIDEO_BG = true;

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

const BG = {};

function bgKeyForLevel(_levelNum) {
  return "";
}

const GAME_SFX = {
  orb_tap: "taporb.mp3",
  orb_rub2: "gamesfx/orb_rub2.mp3",
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
  menu_hit: "gamesfx/menu_hit1.mp3", // mode-menu button select (forward)
  menu_back: "gamesfx/menu_back_hit.mp3", // mode-menu "← Back" button
  pickup_weapon: "gamesfx/pickup_weapon.mp3", // layered on quadshot pickup
  weaponclick_pickupbomb: "gamesfx/weaponclick_pickupbomb.mp3", // layered on bomb pickup
  // 2026-07-01: Pulse Cannon sound pack — charge-up on activation, alternating fire1/fire2 per shot
  pulse_cannon_charge: "gamesfx/pulse_cannon_charge.mp3",
  pulse_cannon_fire1: "gamesfx/pulse_cannon_fire1.mp3",
  pulse_cannon_fire2: "gamesfx/pulse_cannon_fire2.mp3",
  // 2026-06-14: homing missile powerup sound pack
  missile_lockon: "gamesfx/missile_lockon.mp3", // crosshair placed / target acquired
  missile_fired: "gamesfx/missile_fired.mp3", // launch
  missile_prehit: "gamesfx/missile_prehit.mp3", // ~last 15% of flight
  missile_explo: "gamesfx/missile_explo.mp3", // impact
  // POLYSLOTS slot-machine SFX — the ACTUAL prototype sounds (from "prototypes/slot sound/"),
  // copied into gamesfx/ with clean keys and played 1:1 with the prototype's SND map. The long
  // polyslots_* MUSIC tracks are intentionally NOT here — they stream as <audio> (decoding a ~3min
  // MP3 balloons to ~40-60MB PCM; see the 2026-06-23 music-buffer note).
  slot_pull: "gamesfx/slot_pull.mp3", // lever pull + FULL spin as ONE sound (stopped when reels land)
  slot_clunk: "gamesfx/slot_clunk.mp3", // reel locks into place (per reel, 3x max)
  slot_win: "gamesfx/slot_win.mp3", // generic win resolve
  slot_jackpot: "gamesfx/slot_jackpot.mp3", // jackpot hit
  slot_bigwin: "gamesfx/slot_bigwin.mp3", // big-payout flourish layered on jackpot
  slot_life: "gamesfx/slot_life.mp3", // alien-scatter extra life
  slot_outoftokens: "gamesfx/slot_outoftokens.mp3", // played as TAP TO CONTINUE appears
  slot_reel_click_short: "gamesfx/slot_reel_click_short.mp3", // crisp per-reel stop tick
  "slot_machine-ramp-and-spin": "gamesfx/slot_machine-ramp-and-spin.mp3", // optional spin bed
  combo_marksman: "combo_fx/marksman_combo.mp3",
  combo_net_ufo_net: "combo_fx/net-ufo-net-combo.mp3",
  combo_pyro: "combo_fx/pyro_combo.mp3",
  combo_xtra_pyro: "combo_fx/xtra_pyro_combo.mp3",
  combo_freeze_berserk: "combo_fx/freeze_berserk_combo.mp3",
  combo_big_bomb: "combo_fx/bigbomb_combo.mp3",
  // 2026-07-01: SPC menu voiceovers — classic-arcade callouts on mode-select buttons. Played with
  // the combo-style dual-layer chain (at normal speed) via playMenuVo.
  menuvo_arcade_mode: "vo/gamemenu_arcade_mode.mp3",
  menuvo_arcade: "vo/gamemenu_arcade.mp3",
  menuvo_stunt_mode: "vo/gamemenu_stunt_mode.mp3",
  menuvo_training: "vo/gamemenu_training.mp3",
  menuvo_practice: "vo/gamemenu_practice.mp3",
  menuvo_new_game: "vo/gamemenu_new_game.mp3",
  menuvo_level_select: "vo/gamemenu_level_select.mp3",
  menuvo_polyversescoreboard: "vo/gamemenu_polyversescoreboard.mp3",
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

const CORE_PRELOAD_SFX_KEYS = [
  "orb_tap",
  "orb_rub2",
  "menu_hit",
  "menu_back",
  "bling",
  "explosion_med",
  "explosion_big",
  "advfire",
  "pulse_cannon_charge",
  "pulse_cannon_fire1",
  "pulse_cannon_fire2",
  // 2026-07-03: the Oracle reveal intro (SFX.MAIN). Without a decoded WebAudio buffer on iOS native,
  // the first reveal fell back to an unprimed HTML-audio element and played silent. Preload it.
  "newreveal005",
];

const IOS_GAMEPLAY_PRELOAD_SFX_KEYS = [
  ...CORE_PRELOAD_SFX_KEYS,
  "explosion_small",
  "explosion_small_alt",
  "explosion_med_alt",
  "warp",
  "level_up",
  "gameover",
  "scorecount",
  "pickup_gold",
  "slot_pull",
  "slot_clunk",
  "slot_win",
  "slot_outoftokens",
  "ufo_spawn",
  "ufo_hit1",
  "ufo_destroy",
  "plasmarecharged",
];

function sfxMapForKeys(keys) {
  const out = {};
  for (const key of keys) {
    if (GAME_SFX[key]) out[key] = GAME_SFX[key];
  }
  return out;
}

function gameplayPreloadSfxMap() {
  // 2026-06-30: warm the FULL gameplay SFX set on iOS too (was a curated ~24-key subset).
  // Decoded SFX buffers are short/cheap — the iOS memory pressure that drove the subset was
  // music PCM (40-60MB/track, capped separately at MUSIC_BUFFER_CACHE_MAX), not SFX. Loading
  // everything during WARMING UP kills the first-play decode hitch (missile/freeze/quad/bomb/
  // plasma/explosion-variants). loadMany is idempotent, so the per-level re-calls are no-ops.
  // IOS_GAMEPLAY_PRELOAD_SFX_KEYS is retained as the documented critical-first list.
  return GAME_SFX;
}

const PRACTICE_MAX_ASTEROIDS = 40;
const PRACTICE_SPAWN_COOLDOWN_MS = 1000;
const PRACTICE_ENABLED = false;
// 2026-06-12: net charge/highlight response sped up ~20% (1000 → 800) so the cage locks faster.
// The previous 1000ms is the "hard mode" candidate value for a future difficulty setting.
const PLASMA_CAGE_CHARGE_MS = 800;
const PLASMA_CAGE_COOLDOWN_MS = 5000;
const PLASMA_HUD_COLOR = "#00FFE6";
const PLASMA_HUD_RADIUS = 14;
const PLASMA_HUD_PULSE_MS = 2000;
const PLASMA_HUD_PARTICLE_COUNT = 10;
const PLASMA_HUD_TRANSITION_MS = 300;
const PLASMA_HUD_GLOW_ALPHA = 0.52;
const PLASMA_HUD_EDGE_OFFSET = 28;
const PLASMA_HUD_ARC_MIN_MS = 3000;
const PLASMA_HUD_ARC_MAX_MS = 6000;
// 2026-07-03: a MANUAL placed net blocks re-arming (beginPlasmaCage rejects while one is set), so an
// un-detonated net soft-locks the weapon. Safety-expire it after 45s (blinks the last 5s as a warning).
const PLASMA_PLACED_NET_TTL_MS = 45000;
const PLASMA_PLACED_NET_WARN_MS = 5000;
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
  8:  { primary: "#33CFFF", name: "Deep Freeze" }, // 2026-06-24: ice retheme — recolored cold/ice (2026-06-23) and renamed from "Cold Front" (L3 already owns "Ice Field")
  9:  { primary: "#AAFF00", name: "Toxic" },
  10: { primary: "#FF1500", name: "Hellfire" },
  // 2026-06-15: levels 11-15 — primary drives the perimeter timer line + plasma color (Part 7).
  11: { primary: "#FFFFFF", name: "Void Grey" },
  12: { primary: "#00FFFF", name: "Boom Cadet" },
  13: { primary: "#FF0000", name: "Boom Pt 2" },
  14: { primary: "#00FF44", name: "Critical Mass" },
  15: { primary: "#FF8800", name: "The Gauntlet" },
};
// 2026-06-24: true for a "red" level theme — high red channel, low green/blue. Used to pick SPC's
// "gettin' hot in here" intro on red levels (e.g. L13). Orange themes (#FF8800) fail on green.
function isRedTheme(hex) {
  if (typeof hex !== "string") return false;
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) return false;
  const r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
  return r > 200 && g < 80 && b < 80;
}
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
// 2026-07-01: short on-screen life for ~half of the gold-bar powerups so extra ones (once the token
// bank is deep) fade fast instead of cluttering the field — see spawnPowerupAt.
const GOLDBAR_SHORT_LIFETIME_MS = 6000;
const MUSIC_MAX_GAIN = 1.0; // 2026-06-10: was 0.9, bumped to full
// 2026-06-23 PERF: max decoded music tracks kept in memory (see audioEngine._evictMusicBuffers).
// 2026-06-26: dropped 4→2 (currently-playing + prefetched-next only, no slack). Each entry is
// ~40-60MB of PCM, so 4 pinned ~200-240MB; on iPad that headroom is what the L9-entry boss-tier
// preload (boss video .load() + boss-music decodeAudioData) blew through, jettisoning the
// WebContent process for ~11.5s (CARenderServer bootstrap failure). 2 caps audio at ~100-120MB
// and leaves room to absorb the boss preload. Cost: stepping BACK a level re-decodes — negligible.
const MUSIC_BUFFER_CACHE_MAX = 2;
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
// 2026-06-22: gate the verbose level-transition / SPC-VO diagnostics. Default OFF so shipped
// builds pay nothing (the per-slow-frame [lvltrans] log otherwise fires DURING janky frames).
// Flip DEBUG_LVLTRANS true to profile a transition: reproduce L9→L10 / L13→L14 with the console
// open and read the `worst=…ms over32=… dropped=…` watcher report.
const DEBUG_LVLTRANS = false;
const DEBUG_SPC_VO = false;
// DEBUG: flip true to log slotDoPull() synchronous duration to the console. Keep false in builds.
const DEBUG_SLOT_TIMING = false;
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
// 2026-06-22: standalone bottom-screen level title — lingers, then a very slow fade. Lives
// outside the dimming intro overlay (pointer-events:none) so it never covers/blocks gameplay.
const LEVEL_TITLE_HOLD_MS = 2600; // 2026-06-22: fade starts ~1s earlier
const LEVEL_TITLE_FADE_MS = 4200; // 2026-06-22: longer, stretched dim-out (matches CSS levelTitleOut)
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
  { level: 1, label: "First Flight", time: 48, totalToClear: 4, startSpawn: 4, spawnEveryMs: 0, maxOnScreen: 12 },
  { level: 2, label: "SHAKE DOWN", time: 50, totalToClear: 6, startSpawn: 6, spawnEveryMs: 0, maxOnScreen: 12 },
  { level: 3, label: "Blue Moon", time: 52, totalToClear: 10, startSpawn: 5, spawnEveryMs: 2000, maxOnScreen: 12,
    spriteKey: "roidbluemoon" }, // 2026-06-24: code-baked midnight-blue/grey/white skin (Blue Moon)
  { level: 4, label: "DEBRIS RUN", time: 54, totalToClear: 12, startSpawn: 6, spawnEveryMs: 2000, maxOnScreen: 12,
    // 2026-06-23: ambient silver debris trickles in throughout — bonus targets/hazards that do NOT
    // count toward the clear quota (spawned with .ambient = true; see the debris block in update()).
    debrisField: { intervalMs: 1500, maxDebris: 6 } },
  { level: 5, label: "Emotions Heavy", time: 56, totalToClear: 13, startSpawn: 5, spawnEveryMs: 2000, maxOnScreen: 12,
    // 2026-06-23: missile unlocks at L5 — drop one near the end (~10s before the timer expires).
    guaranteedSpawn: [{ type: "bomb", atMs: 8000 }, { type: "bomb", atMs: 18000 }, { type: "missile", atMs: 46000 }] },
  { level: 6, label: "THE SWARM", time: 58, totalToClear: 14, startSpawn: 5, spawnEveryMs: 1800, maxOnScreen: 13,
    spriteKey: "roid01", // 2026-06-23: silver stroids for the whole level
    musicVolume: 1.15 }, // 2026-06-17: +15% music gain for this level
  { level: 7, label: "Into The Deep", time: 60, totalToClear: 16, startSpawn: 5, spawnEveryMs: 1800, maxOnScreen: 13,
    // 2026-07-01: was two guaranteed goldbars (14s + 36s) — trimmed to one; the double drop plus the
    // weighted-pool goldbars made L7 pile up tokens to a disruptive degree.
    guaranteedSpawn: [{ type: "goldbars", atMs: 14000 }] },
  { level: 8, label: "DEEP FREEZE", time: 64, totalToClear: 18, startSpawn: 6, spawnEveryMs: 1600, maxOnScreen: 14,
    // 2026-06-24: mid-level skin shift — asteroids spawned after the shift mark come in ice-blue
    // (earlier ones keep their skin). Honored by pickArcadeSpriteOverride at the spawn call.
    // 2026-06-26: shift pulled 18s→10s so more of the level spawns blue.
    spriteShift: { afterMs: 10000, key: "roidice" },
    guaranteedSpawn: [{ type: "goldbars", atMs: 30000 }] },
  { level: 9, label: "DANGER CLOSE", time: 68, totalToClear: 21, startSpawn: 6, spawnEveryMs: 1500, maxOnScreen: 14,
    spriteKey: "roid01", // 2026-06-23: silver stroids for the whole level
    musicRamp: { atMs: 25000, toMult: 1.4, rampMs: 4000 }, // 2026-06-24: noticeable swell ~25s in
    guaranteedSpawn: [
      { type: "bomb", atMs: 8000 },
      { type: "bomb", atMs: 20000 },
      { type: "quadshot", atMs: 12000 },
      { type: "goldbars", atMs: 44000 },
    ] }, // 2026-06-17: two bombs + a quadshot near the start
  { level: 10, label: "RED HORIZON", time: 75, totalToClear: 24, startSpawn: 7, spawnEveryMs: 1400, maxOnScreen: 14,
    musicVolume: 1.15, // 2026-06-24: boss music up a touch from the start
    musicRamp: { atMs: 6000, toMult: 1.35, rampMs: 50000 }, // 2026-06-24: gradual rise across the level
    powerupOverride: ["freeze", "goldbars", "bomb"], // 2026-06-16: boss-level support kit
    guaranteedSpawn: [{ type: "freeze", atMs: 37000 }], // 2026-06-23: guaranteed freeze around the half-way mark
    waves: [{ count: 8, triggerAtRemaining: 32 }] }, // 2026-06-23: boss surge — 8 rocks burst in once ~32s remain
  // 2026-06-15: second act — the run no longer ends at level 10. Levels 11-15 reuse the
  // level-10 boss music + background (musicForLevel/bgKeyForLevel both clamp at >=10) and the
  // hotroid sprites, ramping density/time. "YOU WIN" now fires after clearing level 15.
  // 2026-07-01: L11 ran too short — doubled (was time 78 / clear 27). A landmine now auto-drops at
  // the midpoint (~78s, the old endpoint) via levelHasLandmine(11); the normal spawner keeps
  // scattering rocks through the back half, plus a second surge.
  { level: 11, label: "AFTERSHOCK", time: 156, totalToClear: 52, startSpawn: 7, spawnEveryMs: 1350, maxOnScreen: 15,
    musicVolume: 1.45, // 2026-06-24: L11_Swarm track is mastered quiet — boosted again per playtest
    guaranteedSpawn: [{ type: "quadshot", atMs: 12000 }, { type: "goldbars", atMs: 42000 }, { type: "goldbars", atMs: 110000 }],
    waves: [{ count: 9, triggerAtRemaining: 78 }, { count: 9, triggerAtRemaining: 34 }] }, // aftershock surges — back-half + finale
  // 2026-06-15: levels 12-15 are the "second act" with per-level mechanics. New config fields
  // (asteroidKinds, asteroidSpeedMult, mineLaunch/mineCount/mineFuseMs, noUfo, ufoSpawnAt,
  // powerupOverride, powerupIntervalMs, label, musicKey) are honored by the engine. waves is now
  // wired (second-wave surge in the main loop); dualUfo is still NOT wired — see setupUfoSpawnForLevel.
  {
    level: 12,
    label: "MAKE IT BOOM",
    time: 55,
    totalToClear: 18,
    startSpawn: 6,
    spawnEveryMs: 8000,
    maxOnScreen: 10,
    asteroidKinds: [3, 3, 2],   // large + medium only — tight clusters
    spriteMix: [["roidpurplegrey", 5], ["hotroid01", 1]], // 2026-06-24: purple/grey skin, a few red boom-rocks
    noUfo: false,
    ufoSpawnAt: 25,             // UFO arrives mid-level to disrupt chains
    mineLaunch: true,
    mineCount: 4,              // 4 mines spawn at level start
    mineFuseMs: 5000,          // shorter fuse than normal (normally 8000)
    powerupOverride: ["timer", "freeze", "bomb", "goldbars"],
    guaranteedSpawn: [
      { type: "timer", atMs: 12000 },
      { type: "freeze", atMs: 22000 },
    ],
    musicKey: "L12_BOOM",
    musicVolume: 1.3, // 2026-06-24: L12_BOOM mastered quiet — boost per playtest
  },
  {
    level: 13,
    label: "MAKE IT BOOM PT 2",
    time: 48,
    totalToClear: 28,
    startSpawn: 10,
    spawnEveryMs: 4800,
    maxOnScreen: 14,
    asteroidKinds: [3, 2, 2, 1], // mix of all sizes
    asteroidSpeedMult: 1.3,       // 2026-06-23: eased 1.4→1.3 so fast laser/net clearing is viable
    noUfo: false,
    ufoSpawnAt: 15,               // UFO arrives early
    mineLaunch: true,
    mineCount: 4,
    mineFuseMs: 5000,
    powerupOverride: ["missile", "missile", "goldbars"], // 2026-06-16: missile-weighted pool
    // 2026-06-23: CRUCIAL make-or-break timer. One +30s timer drops at 20s-remaining; collected it
    // refills the clock toward full (collectPowerup caps at levelDurationMs), missed and the level is
    // near-unwinnable. This is the level-saver — bombs/mines are a distraction; reward is fast laser +
    // dropping/clustering stroids (grab→release drops dead in place on L13, see launchStroidToss) for
    // a big plasma-net sweep.
    guaranteedSpawn: [{ type: "timer", atMs: 28000 }],
    waves: [{ count: 6, triggerAtRemaining: 18 }],
    musicKey: "L13_BOOM_PT2",
    musicVolume: 1.35, // 2026-06-24: L13_Boom_pt2 mastered quiet — boost per playtest (also covers L14 fallback)
  },
  {
    level: 14,
    label: "CRITICAL MASS",
    time: 50,                    // longer last-second timer-chain level
    totalToClear: 80,            // doubled-length small fast asteroid swarm
    startSpawn: 15,
    spawnEveryMs: 2700,
    maxOnScreen: 20,
    asteroidKinds: [1],          // ONLY kind 1 small asteroids
    spriteKey: "roidneon",       // 2026-06-23: code-generated neon skin (black/green/purple gradient map)
    asteroidSpeedMult: 1.6,      // 60% faster
    noUfo: true,
    noLandmines: true,
    powerupOverride: ["freeze", "quadshot", "timer", "timer"], // 2026-06-16: timer-weighted support
    powerupIntervalMs: 9000,
    guaranteedSpawn: [
      { type: "timer", atMs: 17000 },
      { type: "freeze", atMs: 26000 },
      { type: "timer", atMs: 36000 },
      { type: "timer", atMs: 44000 },
    ],
    musicKey: "L14_CRITICAL",
  },
  {
    level: 15,
    label: "THE GAUNTLET",
    time: 60,
    // 2026-07-01: beatability retune. Was totalToClear 50 of mostly big splitting rocks in 60s with
    // ZERO guaranteed timers — effectively unwinnable (must spawn all 50 roots AND clear every child).
    // Now 34 roots + 2 make-or-break timer drops (like L13/L14) + eased base speed + a smaller surge.
    totalToClear: 34,
    startSpawn: 10,
    spawnEveryMs: 5000,
    maxOnScreen: 16,
    asteroidKinds: [3, 3, 2, 2, 1],
    asteroidSpeedMult: 1.2,      // 2026-07-01: eased 1.3→1.2 (speedEscalation still ramps it live)
    noUfo: false,
    ufoSpawnAt: 10,
    dualUfo: true,               // NOT yet wired — see setupUfoSpawnForLevel TODO
    mineLaunch: true,
    mineCount: 2,
    waves: [
      { count: 6, triggerAtRemaining: 20 }, // 2026-07-01: eased 10→6 surge to match the lower total
    ],
    // 2026-06-16: missile-heavy mix with every type available, dropping every 12s.
    // 2026-07-01: + pulse so the Pulse Cannon is available in the finale (also force-spawned per level).
    powerupOverride: ["missile", "missile", "timer", "freeze", "quadshot", "bomb", "pulse"],
    powerupIntervalMs: 12000,
    // 2026-07-01: two guaranteed +30s timer drops — the level's make-or-break lifeline (mirrors the
    // L13/L14 timer-chain design). Without these the clock can't cover clearing the splitting field.
    guaranteedSpawn: [
      { type: "timer", atMs: 18000 },
      { type: "timer", atMs: 40000 },
    ],
    speedEscalation: true,       // 2026-06-16: live asteroids ramp speed over the level (cap 2.5x)
    musicVolume: 1.4,            // 2026-06-25: L15 was too quiet — it plays the L10 boss track as a
                                 // fallback at default 1.0 gain (quieter than L10's own 1.15). Boost
                                 // for the finale; revisit when the real L15_gauntlet track is supplied.
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
  "The answer is yes",
  "Yes, but keep your timing sharp",
  "Yes - the path is open",
  "It leans yes",
  "Trust the yes you already felt",
  "Nope",
  "I don't think so",
  "Don't count on it",
  "The answer is no",
  "Not unless something changes first",
  "That is for God to decide",
  "Ask another day",
  "The stars say wait",
  "Let the signal clear, then ask again",
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
    yes: ["The current aligns in your favor.", "The signal is clean. Proceed.", "Momentum says yes.", "The door is open.", "Green light, but stay awake."],
    no: ["Not this cycle.", "The signs ask for patience.", "Pause and return with clearer intent.", "The path is blocked for now.", "Let this one pass."],
  },
  romantic: {
    label: "Romantic",
    yes: ["The heart says yes.", "Love is leaning your way.", "There is warmth ahead.", "The feeling is not one-sided.", "Move gently, but move."],
    no: ["Not from this person, not today.", "Protect your energy first.", "Wait for reciprocation.", "Do not chase what is not reaching back.", "Your peace is the answer."],
  },
  business: {
    label: "Business",
    yes: ["The tradeoff is acceptable.", "Green light with discipline.", "Risk-adjusted yes.", "The upside is real if you keep scope tight.", "Proceed, but write down the limits first."],
    no: ["Return with better numbers.", "Hold capital for now.", "Not enough edge yet.", "The cost is hiding in the fine print.", "Wait for a cleaner opening."],
  },
  chaos: {
    label: "Chaos Goblin",
    yes: ["Absolutely. Do it loud.", "Chaos approves.", "Yes, and make it weird.", "The weird door is open.", "Send it, but own the cleanup."],
    no: ["Nope. Universe said sit down.", "Hard no, tiny mortal.", "Not unless you enjoy drama.", "The vibes have filed a complaint.", "No, that spiral has teeth."],
  },
  stoic: {
    label: "Stoic",
    yes: ["Act with virtue and continue.", "This is within your control.", "Proceed without attachment.", "Do the next right thing.", "Yes, if your motive is clean."],
    no: ["Decline what weakens you.", "Not essential. Let it go.", "Choose restraint.", "Silence is the stronger action.", "No answer is needed when discipline is clear."],
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
// 2026-07-02: iPad-class = an iOS device whose SHORT edge is tablet-sized (>=640px). iPhones top
// out well under this in both orientations, so it cleanly separates iPad from iPhone. Used to
// nudge device-specific audio/layout (e.g. combo-callout loudness, which reads much quieter on
// iPad's HTML-audio mix than on iPhone).
const isIPadClass = isIOSWebKit && Math.min(window.innerWidth || 0, window.innerHeight || 0) >= 640;
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
let listenersBound = false;

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
const menuLogoCanvas = document.getElementById("menuLogoCanvas");

// STROIDS menu logo "warp-in": a retro SNES/Genesis raster-distortion reveal. The logo
// materializes out of horizontal raster bars (per-row X displacement + scanline wobble +
// a chromatic shimmer ghost) rather than sliding/scaling in, then resolves perfectly sharp
// with a residual glow (the glow is a static CSS drop-shadow on the canvas). Lightweight:
// one sliced drawImage pass + two ghost draws per frame for ~1.1s, then it stops.
// 2026-06-22: this IIFE MUST stay AFTER `const menuLogoCanvas` above — it reads that binding at
// module-eval time, so declaring it earlier (the original bug) threw a TDZ ReferenceError that
// aborted the whole script (dead UI, no galaxy bg). Keep it here, after the DOM lookups.
const menuLogoWarp = (() => {
  const noop = { play() {}, drawSharp() {} };
  if (!menuLogoCanvas) return noop;
  const ctx = menuLogoCanvas.getContext("2d");
  if (!ctx) return noop;
  const SUPPORTS_CONIC = typeof ctx.createConicGradient === "function";

  const img = new Image();
  let imgReady = false;
  let pendingPlay = false;
  img.onload = () => {
    imgReady = true;
    if (pendingPlay) {
      pendingPlay = false;
      play();
    }
  };
  img.src = "assets/stroids_menu_logo.png";

  const DURATION = 1150;
  let rafId = 0;
  let startTs = 0;

  function sizeCanvas() {
    const rect = menuLogoCanvas.getBoundingClientRect();
    const dpr = nativeCanvasDpr();
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (menuLogoCanvas.width !== w || menuLogoCanvas.height !== h) {
      menuLogoCanvas.width = w;
      menuLogoCanvas.height = h;
    }
    return { w, h };
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function drawSharp() {
    if (!imgReady) return;
    const { w, h } = sizeCanvas();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
  }

  function frame(ts) {
    if (!startTs) startTs = ts;
    const elapsed = ts - startTs;
    const p = Math.min(1, elapsed / DURATION);
    const { w, h } = sizeCanvas();
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, w, h);

    if (!imgReady) {
      rafId = requestAnimationFrame(frame);
      return;
    }

    // opacity climbs in after a faint-shimmer beat (~8%) and is fully solid by ~80%
    const reveal = easeOutCubic(Math.min(1, Math.max(0, (p - 0.08) / 0.72)));
    // all distortion decays to exactly 0 at p === 1 so the final state is dead sharp
    const decay = Math.pow(1 - p, 1.6);
    const maxShift = w * 0.1 * decay; // horizontal raster-bar displacement
    const t = elapsed / 1000;

    const sliceCount = 54;
    const sliceH = h / sliceCount;
    const srcSliceH = img.height / sliceCount;

    for (let i = 0; i < sliceCount; i++) {
      const ph = i / sliceCount;
      // layered sines => unstable "reality resolving" raster wobble
      const dx =
        Math.sin(ph * 22 + t * 14) * maxShift +
        Math.sin(ph * 7 + t * 9) * maxShift * 0.5;
      // per-row opacity flicker, strongest early, gone by the end
      const flick = 1 - decay * 0.5 * (0.5 + 0.5 * Math.sin(ph * 40 + t * 30));
      ctx.globalAlpha = reveal * Math.max(0, Math.min(1, flick));
      ctx.drawImage(
        img,
        0,
        i * srcSliceH,
        img.width,
        srcSliceH + 1,
        dx,
        i * sliceH,
        w,
        sliceH + 1
      );
    }

    // chromatic shimmer: additive ghosts split left/right, fading with the distortion
    if (decay > 0.02) {
      const chroma = w * 0.018 * decay;
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = reveal * decay * 0.5;
      ctx.drawImage(img, -chroma, 0, w, h);
      ctx.drawImage(img, chroma, 0, w, h);
      ctx.globalCompositeOperation = "source-over";
    }

    ctx.globalAlpha = 1;

    if (p < 1) {
      rafId = requestAnimationFrame(frame);
    } else {
      drawSharp(); // guarantee a clean final frame
      rafId = 0;
      startIdle(); // hand off to the continuous "living logo" shimmer
    }
  }

  // ── continuous "living logo" idle shimmer (runs after the warp resolves) ──────────────
  // The source art is a single flattened PNG (chrome text baked over a nebula swirl), so the
  // layers can't be moved geometrically. Instead we fake separate-layer life with masked
  // additive light: a slow conic "energy" rotation around the swirl + a specular gleam that
  // sweeps the chrome + twinkling sparkles. Every effect is clipped to the logo's alpha via an
  // offscreen mask canvas, so nothing paints into the empty corners. Throttled to ~30fps and
  // stopped whenever the Select Mode menu isn't on screen (see stop() callers).
  let maskCanvas = null;
  let maskCtx = null;
  let idleRunning = false;
  let idleStartTs = 0;
  let idleLastDraw = 0;
  // angle around center, radius factor, size factor, twinkle phase
  const SPARKLES = [
    [-0.35, 0.46, 1.0, 0.0],
    [0.55, 0.50, 0.8, 1.7],
    [1.7, 0.30, 0.7, 3.1],
    [2.7, 0.46, 0.9, 0.8],
    [3.5, 0.40, 0.7, 2.2],
    [4.6, 0.49, 0.85, 4.0],
    [5.5, 0.33, 0.6, 5.2],
  ];

  function ensureMask(w, h) {
    if (!maskCanvas) {
      maskCanvas = document.createElement("canvas");
      maskCtx = maskCanvas.getContext("2d");
    }
    if (maskCanvas.width !== w || maskCanvas.height !== h) {
      maskCanvas.width = w;
      maskCanvas.height = h;
    }
    return maskCtx;
  }

  // paint fillFn(mctx) clipped to the logo's alpha shape, then add it onto the main canvas
  function addMaskedLight(w, h, alpha, fillFn) {
    const mctx = ensureMask(w, h);
    mctx.globalCompositeOperation = "source-over";
    mctx.globalAlpha = 1;
    mctx.clearRect(0, 0, w, h);
    mctx.drawImage(img, 0, 0, w, h); // establish the logo's alpha shape
    mctx.globalCompositeOperation = "source-in"; // subsequent paint is clipped to that shape
    fillFn(mctx);
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = alpha;
    ctx.drawImage(maskCanvas, 0, 0, w, h);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  function idleFrame(ts) {
    if (!idleRunning) return;
    if (!idleStartTs) idleStartTs = ts;
    if (ts - idleLastDraw < 32) { // ~30fps — smooth for slow shimmer, half the draw cost
      rafId = requestAnimationFrame(idleFrame);
      return;
    }
    idleLastDraw = ts;
    const t = (ts - idleStartTs) / 1000;
    const { w, h } = sizeCanvas();
    const cx = w / 2;
    const cy = h * 0.42;

    // base logo
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    // 1) slow conic "energy" rotating around the swirl (continuous, subtle)
    if (SUPPORTS_CONIC) {
      const ang = (t * 0.5) % (Math.PI * 2); // ~12s per rotation
      addMaskedLight(w, h, 0.16, (mctx) => {
        const g = mctx.createConicGradient(ang, cx, cy);
        g.addColorStop(0.0, "rgba(170,140,255,0)");
        g.addColorStop(0.12, "rgba(190,170,255,0.9)");
        g.addColorStop(0.24, "rgba(170,140,255,0)");
        g.addColorStop(0.5, "rgba(120,200,255,0)");
        g.addColorStop(0.62, "rgba(150,210,255,0.85)");
        g.addColorStop(0.74, "rgba(120,200,255,0)");
        g.addColorStop(1.0, "rgba(170,140,255,0)");
        mctx.fillStyle = g;
        mctx.fillRect(0, 0, w, h);
      });
    }

    // 2) periodic specular gleam sweeping across the chrome — first sweep at ~10s, then every
    // ~25s, each lasting ~1.6s (a slow, occasional "big shine" rather than a constant glint)
    const GLEAM_FIRST = 10; // seconds before the first sweep
    const GLEAM_EVERY = 25; // seconds between sweeps thereafter
    const GLEAM_DUR = 1.6; // seconds the sweep takes to cross
    const gleamT = t >= GLEAM_FIRST ? (t - GLEAM_FIRST) % GLEAM_EVERY : -1;
    if (gleamT >= 0 && gleamT < GLEAM_DUR) {
      const sweep = gleamT / GLEAM_DUR; // 0..1 across the logo
      const bandCx = (-0.3 + sweep * 1.6) * w; // band travels past both edges
      const bandW = w * 0.26;
      const intensity = Math.sin(sweep * Math.PI); // fade in/out at the ends
      addMaskedLight(w, h, 0.55 * intensity, (mctx) => {
        const g = mctx.createLinearGradient(bandCx - bandW, 0, bandCx + bandW, h * 0.3);
        g.addColorStop(0.0, "rgba(255,255,255,0)");
        g.addColorStop(0.5, "rgba(255,250,235,0.95)");
        g.addColorStop(1.0, "rgba(255,255,255,0)");
        mctx.fillStyle = g;
        mctx.fillRect(0, 0, w, h);
      });
    }

    // 3) twinkling sparkles on the ring
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < SPARKLES.length; i++) {
      const [a, rf, sf, ph] = SPARKLES[i];
      const tw = 0.5 + 0.5 * Math.sin(t * 2.4 + ph);
      const alpha = tw * tw * 0.9;
      if (alpha < 0.02) continue;
      const sx = cx + Math.cos(a) * w * rf;
      const sy = cy + Math.sin(a) * h * rf * 0.92;
      const r = w * 0.012 * sf * (0.6 + 0.7 * tw);
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
      g.addColorStop(0, `rgba(255,255,255,${alpha})`);
      g.addColorStop(0.4, `rgba(200,220,255,${alpha * 0.6})`);
      g.addColorStop(1, "rgba(160,180,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;

    rafId = requestAnimationFrame(idleFrame);
  }

  function startIdle() {
    if (prefersReducedMotion) {
      drawSharp();
      return;
    }
    idleRunning = true;
    idleStartTs = 0;
    idleLastDraw = 0;
    rafId = requestAnimationFrame(idleFrame);
  }

  function play() {
    if (!imgReady) {
      pendingPlay = true;
      return;
    }
    stop();
    if (prefersReducedMotion) {
      drawSharp();
      return;
    }
    startTs = 0;
    rafId = requestAnimationFrame(frame);
  }

  function stop() {
    idleRunning = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  return { play, drawSharp, stop };
})();

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
const hudBombCount = document.getElementById("hudBombCount");
const hudFreezeBtn = document.getElementById("hudFreezeBtn");
const hudFreezeCount = document.getElementById("hudFreezeCount");
// 2026-06-21: debounce the freeze HUD button so a fast double-tap can't toggle
// freeze on-then-off and waste a charge (guards the shared toggleFreezeFromInventory path).
let _lastFreezeToggleAt = 0;
const hudMissileBtn = document.getElementById("hudMissileBtn");
const hudMissileCount = document.getElementById("hudMissileCount");
const hudMissileReload = document.getElementById("hudMissileReload");
const hudQuadBadge = document.getElementById("hudQuadBadge");
const hudQuadTime = document.getElementById("hudQuadTime");
const hudPulseBadge = document.getElementById("hudPulseBadge");
const hudPulseTime = document.getElementById("hudPulseTime");

const RUN_TIME_CAP_MS = (99 * 60 + 59) * 1000; // clock stops at 99:59
function formatRunTime(ms) {
  const s = Math.floor(Math.min(ms, RUN_TIME_CAP_MS) / 1000);
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

// 2026-06-24: true while the arcade level-select grid is showing. Comms (reactions + queued VO)
// are suppressed while it's up — picking a level via Level Skip was firing leftover/gameplay comms
// over the menu. Set in setArcadeSubmenu (single choke point for every submenu transition).
let arcadeLevelSelectOpen = false;

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
  // 2026-06-24: SPC levels auto-dismiss the comm mug a short beat after the last line clears, so
  // her portrait isn't permanently parked over the playfield. Soft CSS collapse (#commanderHUD
  // .comm-collapsed); restored the instant the next caption shows. CMDR levels are unaffected.
  let commCollapseTimer = null;
  const COMM_COLLAPSE_MS = 1600;
  // 2026-06-23: true while an SPC (Stunt Mode) caption owns the ticker. SPC captions are pinned and
  // must NOT be wiped by the shared CMDR auto-hide timer (endTalking) — that's what made the comm
  // box vanish mid-line during the plasma-net praise step. CMDR play never pins, so this stays false
  // there and the auto-hide behaves exactly as before. Set by pinTicker, cleared by hideTicker.
  let spcTickerActive = false;
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
    // 2026-06-24: new commander VO drop (files live in assets/vo3/ — uppercase-first names route
    // there via commVoSrc). Captions in VO_CAPTIONS below. Not yet wired to game events — see
    // the catalog note; available for triggerVO({ voFile }) / pool wiring.
    "CMDR_a_job_well_done_cadet_you_win.mp3",
    "CMDR_get_the_alien.mp3",
    "CMDR_get_the_alien_cadet_alternate.mp3",
    "CMDR_i_dont_know_where_they_found_you_cadet_but_youre_killin_it.mp3",
    "CMDR_id_be_lost_without_you_cadet_alternate.mp3",
    "CMDR_level_7_start_were_getting_deeper.mp3",
    "CMDR_this_looks_like_a_world_of_trouble_cadet.mp3",
    "CMDR_this_looks_like_a_world_of_trouble_cadet_alternate.mp3",
    "CMDR_you_really_are_doing_a_great_job_cadet.mp3",
    "CMDR_you_win_a_job_well_done_cadet.mp3",
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
    // 2026-07-01: new CMDR "let's blast these stroids" drop (5 variations; _hehaha one ends on a laugh).
    "cmdr_lets_blast_these_stroids_new1.mp3",
    "cmdr_lets_blast_these_stroids_new2.mp3",
    "cmdr_lets_blast_these_stroids_hehaha_new3.mp3",
    "cmdr_lets_blast_these_stroids_new4.mp3",
    "cmdr_lets_blast_these_stroids_new5.mp3",
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
    // 2026-06-24: ominous intro lines (new CMDR drop) — sit alongside "this definitely concerns you".
    "CMDR_this_looks_like_a_world_of_trouble_cadet.mp3",
    "CMDR_this_looks_like_a_world_of_trouble_cadet_alternate.mp3",
  ];

  // 2026-07-01: CMDR "let's blast these 'stroids" intro pool — the original line plus 5 new drops
  // (the _hehaha variant ends on a laugh). Rotated at the L1/L10 intro beats via pickFromPool.
  const POOL_CMDR_BLAST = [
    "vo-lets_blast_these_stroids.mp3",
    "cmdr_lets_blast_these_stroids_new1.mp3",
    "cmdr_lets_blast_these_stroids_new2.mp3",
    "cmdr_lets_blast_these_stroids_hehaha_new3.mp3",
    "cmdr_lets_blast_these_stroids_new4.mp3",
    "cmdr_lets_blast_these_stroids_new5.mp3",
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
    // 2026-06-24: new CMDR praise lines, safe at any level.
    "CMDR_you_really_are_doing_a_great_job_cadet.mp3",
    "CMDR_id_be_lost_without_you_cadet_alternate.mp3",
  ];

  // 2026-06-24: late-game level-complete pool — the base praise lines PLUS "you're killin' it",
  // which name-checks how far the cadet has come and shouldn't fire on the opening levels. Used in
  // place of POOL_LEVEL_COMPLETE once level >= LEVEL_COMPLETE_LATE_FROM (separate pickFromPool key so
  // its shuffle is independent of the base pool). [[playtest-backlog-2026-06-24]]
  const POOL_LEVEL_COMPLETE_LATE = [
    ...POOL_LEVEL_COMPLETE,
    "CMDR_i_dont_know_where_they_found_you_cadet_but_youre_killin_it.mp3",
  ];

  // 2026-06-24: UFO ("alien") spotted callout pool — the original line plus two new CMDR variants.
  const POOL_UFO_SPOTTED = [
    "vo-ufo_spotted_takeemout.mp3",
    "CMDR_get_the_alien.mp3",
    "CMDR_get_the_alien_cadet_alternate.mp3",
  ];

  // 2026-06-24: "YOU WIN" celebration VO (new CMDR drop) — one plays over the win-sequence barrage.
  const POOL_WIN = [
    "CMDR_a_job_well_done_cadet_you_win.mp3",
    "CMDR_you_win_a_job_well_done_cadet.mp3",
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
    // 2026-06-24: new SPC gameplay lines (level-start variety, red-level start, plasma recharged,
    // slow-play nudge, big praise, random ad-lib). Files in vo/SPC_*.mp3.
    "SPC_its_getting_messy_cadet_take_em_out.mp3",
    "SPC_peeing_pants.mp3",
    "SPC_aye_its_gettin_hot_in_here.mp3",
    "SPC_plasma_recharged_make_a_plasma_net.mp3",
    "SPC_put_some_effort_into_it.mp3",
    "SPC_wow_cadet_just_wow-bigpraise.mp3",
    "SPC_Ayyee.mp3",
  ]);
  const POOL_SPC_PRAISE = [
    "SPC_crushing_it.mp3",
    "SPC_boom_like_that.mp3",
    "SPC_there_you_go.mp3",
    "SPC_amazing.mp3",
    "SPC_show_boss.mp3",
    "SPC_lets_get_after_it.mp3",
    "SPC_Ayyee.mp3", // 2026-06-24: ad-lib "Ayyee!" mixed into the ambient praise rotation
  ];
  // 2026-06-24: SPC level-start intro pool (general) + the red-theme variant. Picked in startLevel
  // on SPC levels; red levels (e.g. L13) use the "gettin' hot in here" line instead.
  const POOL_SPC_LEVEL_START = [
    "SPC_lets_get_after_it.mp3",
    "SPC_its_getting_messy_cadet_take_em_out.mp3",
    "SPC_peeing_pants.mp3",
  ];
  // The red-theme intro (SPC_aye_its_gettin_hot_in_here.mp3) is inlined at the startLevel call site.
  // 2026-06-24: low-time / behind-the-curve nudge pool for SPC levels (alternates the time warning
  // with a "put some effort into it" line so the 20s mark isn't always the same comm).
  const POOL_SPC_TIMER_LOW = [
    "SPC_timer_warning.mp3",
    "SPC_put_some_effort_into_it.mp3",
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
    "SPC_its_getting_messy_cadet_take_em_out.mp3": "IT'S GETTING REAL MESSY OUT THERE, CADET. TAKE 'EM OUT!",
    "SPC_peeing_pants.mp3": "IF THESE 'STROIDS WERE ALIVE, THEY'D BE PEEING THEIR PANTS.",
    "SPC_aye_its_gettin_hot_in_here.mp3": "AYE, IT'S GETTIN' HOT IN HERE!",
    "SPC_plasma_recharged_make_a_plasma_net.mp3": "PLASMA RECHARGED — MAKE A PLASMA NET!",
    "SPC_put_some_effort_into_it.mp3": "PUT SOME EFFORT INTO IT, CADET!",
    "SPC_wow_cadet_just_wow-bigpraise.mp3": "WOW, CADET. JUST… WOW.",
    "SPC_Ayyee.mp3": "AYYEE!",
    // 2026-06-15: level 15 finale (Part 8). Audio is a placeholder (Poly records gauntlet_intro.mp3);
    // until then this caption shows in the comm box.
    "gauntlet_intro.mp3": "THIS IS IT CADET. THE GAUNTLET. GIVE IT EVERYTHING YOU'VE GOT.",
    "vo-hairytakeemout.mp3": "IT'S HAIRY OUT THERE. TAKE 'EM OUT.",
    "vo-lets_blast_these_stroids.mp3": "LET'S BLAST THESE 'STROIDS.",
    "cmdr_lets_blast_these_stroids_new1.mp3": "LET'S BLAST THESE 'STROIDS!",
    "cmdr_lets_blast_these_stroids_new2.mp3": "LET'S BLAST THESE 'STROIDS!",
    "cmdr_lets_blast_these_stroids_hehaha_new3.mp3": "LET'S BLAST THESE 'STROIDS! HE-HAH!",
    "cmdr_lets_blast_these_stroids_new4.mp3": "LET'S BLAST THESE 'STROIDS!",
    "cmdr_lets_blast_these_stroids_new5.mp3": "LET'S BLAST THESE 'STROIDS!",
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
    "vo-nice_victory.mp3": "NICE!",
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
    // 2026-06-24: new commander VO drop (assets/vo3/CMDR_*.mp3).
    "CMDR_a_job_well_done_cadet_you_win.mp3": "A JOB WELL DONE, CADET. YOU WIN.",
    "CMDR_get_the_alien.mp3": "GET THE ALIEN.",
    "CMDR_get_the_alien_cadet_alternate.mp3": "GET THE ALIEN, CADET.",
    "CMDR_i_dont_know_where_they_found_you_cadet_but_youre_killin_it.mp3": "I DON'T KNOW WHERE THEY FOUND YOU, CADET, BUT YOU'RE KILLIN' IT.",
    "CMDR_id_be_lost_without_you_cadet_alternate.mp3": "I'D BE LOST WITHOUT YOU, CADET.",
    "CMDR_level_7_start_were_getting_deeper.mp3": "WE GETTING DEEPER INTO THE POLYVERSE.",
    "CMDR_this_looks_like_a_world_of_trouble_cadet.mp3": "THIS LOOKS LIKE A WORLD OF TROUBLE, CADET.",
    "CMDR_this_looks_like_a_world_of_trouble_cadet_alternate.mp3": "THIS LOOKS LIKE A WORLD OF TROUBLE, CADET.",
    "CMDR_you_really_are_doing_a_great_job_cadet.mp3": "YOU REALLY ARE DOING A GREAT JOB, CADET.",
    "CMDR_you_win_a_job_well_done_cadet.mp3": "YOU WIN! A JOB WELL DONE, CADET.",
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
  // 2026-06-24: the LEVEL's default host (SPC on L13/L14) is tracked separately from _spcMode (which
  // is "is the SPC mug currently displayed"). On SPC-host levels a CMDR-spoken gameplay line is shown
  // with the CMDR mug for its duration, then the SPC host mug is restored — see triggerVO. Without
  // this split, every CMDR gameplay line (UFO/plasma/landmine/level-complete) flapped the SPC mug.
  let _spcLevelHost = false;           // level default is SPC (mug follows the line speaker on top)
  let _spcLevelPortraitSrc = null;     // the SPC override src to restore after a CMDR line
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
    // 2026-06-22 (19:21 notes #5): the closing "go practice" line should actually TALK (warm sign-off)
    // and then settle BACK to the shades pose — so it flaps with talk frames but rests on "shades"
    // (rest-frame override lives in spcSpeakStart). Previously the line used the no-flap "shades" hold.
    shades_outro: ["talk_friendly", "talk_neutral", "talk_happy", "talk_calm"],
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
    let randomMouth = false; // drive the mouth via _spcPickTalkFrame() instead of a fixed loop
    if (frameHint === "talk_explain") {
      // 2026-06-22 (19:21 notes #3): long explanatory lines (e.g. the perimeter-timer intro) looked
      // robotic with the fixed 5-frame talk loop — the repeat is obvious over a long sentence and
      // especially in the large centered cutscene layout. Lead with a friendly expression, then drive
      // the mouth with the randomized natural talk cycle so it never reads as a tight loop.
      frames = ["talk_friendly"];
      randomMouth = true;
    } else if (frameHint && SPC_EXPR_FLAP[frameHint]) {
      frames = SPC_EXPR_FLAP[frameHint];
      if (frameHint.indexOf("idle_") === 0 || frameHint === "shades") _spcRestFrame = frameHint;
      else if (frameHint === "shades_outro") _spcRestFrame = "shades"; // talk, then settle back to shades
    } else if (frameHint && spcImages[frameHint]) {
      // a talk_* (or other loaded) hint: lead with it, vary the mouth, include a closed-mouth rest beat.
      // idle_neutral is repeated so the closed mouth holds for 2 ticks (~250ms) — a single 125ms tick
      // is too brief to read clearly as "mouth closed".
      frames = [frameHint, "talk_neutral", "idle_neutral", "idle_neutral", "talk_happy"];
    } else {
      frames = SPC_TALK_CYCLE;
    }
    setSpcFrame(frames[0]);
    if (frames.length === 1 && !randomMouth) return; // held expression — no mouth flap
    let i = 0;
    // 2026-06-20: ~125ms (8fps) phoneme cycle while the line plays (cleared by spcSpeakEnd on audio end).
    // Was 120ms — slowed slightly so the flap reads as natural speech rather than a fast flutter.
    _spcMouthFlap = setInterval(() => {
      if (frames === SPC_TALK_CYCLE || randomMouth) {
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
    _spcLevelHost = true;                  // 2026-06-24: this level's default host is SPC
    _spcLevelPortraitSrc = portraitOverride; // remember it so CMDR lines can restore the SPC mug
    _spcRestFrame = "smile_wide";
    _spcSpeaking = false;
    const cs = callsignEl();
    if (cs) cs.textContent = callsign;
    if (portrait) {
      // SPC is tall (600×913) — restore the default contain/min-height box.
      portrait.classList.remove("commPortraitImg--commander");
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
    _spcLevelHost = false;           // 2026-06-24: back to a CMDR-host level
    _spcLevelPortraitSrc = null;
    _spcSpeaking = false;
    cancelCommCollapse(); // 2026-06-24: leaving an SPC level — un-collapse the mug for CMDR
    _spcStopFlap();
    _spcStopBlink();
    if (portrait) {
      portrait.onerror = null;
      // back to the square 64×64 commander — hug the mug, no empty backing.
      portrait.classList.add("commPortraitImg--commander");
    }
    const cs = callsignEl();
    if (cs) cs.textContent = "CMDR";
    setFrame("idle");
    // 2026-06-18: CMDR is back — resume its idle loop if the HUD is showing (mirrors the stopIdle in
    // setPortraitOverride). startIdle() no-ops if already running.
    if (hudVisible) startIdle();
  }

  // 2026-06-24: per-line portrait swap so the mug follows the LINE's speaker on SPC-host levels.
  // showCmdrForLine() drops the SPC override for the duration of a CMDR-spoken line — portraitOverride
  // must be null so setFrame draws real CMDR frames, and _spcMode false so the talk/idle loops use
  // CMDR frames. restoreSpcHost() puts the SPC host mug back when the line ends (or an SPC line plays).
  function showCmdrForLine() {
    _spcStopFlap();
    _spcStopBlink();
    portraitOverride = null;
    _spcMode = false;
    if (portrait) {
      portrait.onerror = null;
      portrait.classList.add("commPortraitImg--commander");
    }
    const cs = callsignEl();
    if (cs) cs.textContent = "CMDR";
  }
  function restoreSpcHost() {
    portraitOverride = _spcLevelPortraitSrc || SPC_PLACEHOLDER;
    _spcMode = true;
    _spcRestFrame = "smile_wide";
    _spcSpeaking = false;
    if (portrait) {
      portrait.classList.remove("commPortraitImg--commander");
      portrait.onerror = () => { portrait.onerror = null; portrait.src = SPC_PLACEHOLDER; };
      portrait.src = (spcImages.smile_wide && spcImages.smile_wide.src)
        ? spcImages.smile_wide.src
        : portraitOverride;
    }
    const cs = callsignEl();
    if (cs) cs.textContent = "SPC";
    _spcStartBlink();
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
    cancelCommCollapse(); // 2026-06-24: a new caption brings the SPC mug back into view
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
    spcTickerActive = true; // SPC owns the ticker now — guards against the CMDR auto-hide (see endTalking)
    showTicker();
    typeText(text);
  }

  function isTickerVisible() {
    return tickerVisible;
  }

  function hideTicker() {
    if (!ticker) return;
    spcTickerActive = false; // a genuine hide releases SPC ownership
    ticker.classList.remove("ticker-visible");
    tickerVisible = false;
    if (tickerText) tickerText.innerHTML = "";
    setTimeout(() => {
      document.querySelectorAll(".sigbar")
        .forEach((b) => b.classList.remove("sigbar-active"));
      configureSignalBars();
    }, 300);
  }

  // 2026-06-24: cancel a pending/active mug auto-collapse and reveal the box (called when any
  // new caption shows). Safe to call on CMDR levels (no-op beyond removing the class).
  function cancelCommCollapse() {
    if (commCollapseTimer) { clearTimeout(commCollapseTimer); commCollapseTimer = null; }
    hud?.classList.remove("comm-collapsed");
  }
  // 2026-06-25: collapse the comm box immediately (no delay). Used at the start of an SPC-host level
  // so her mug isn't left standing on the playfield before she's said anything — the first VO line
  // un-collapses it (showTicker → cancelCommCollapse) so the mug appears WITH the voice, not before.
  function collapseCommNow() {
    if (commCollapseTimer) { clearTimeout(commCollapseTimer); commCollapseTimer = null; }
    hud?.classList.add("comm-collapsed");
  }
  // 2026-06-24: arm the mug auto-collapse — SPC levels only. Fires after a short hold, but only if
  // nothing is still queued/playing and the ticker is hidden (re-checked when the timer elapses).
  function scheduleCommCollapse() {
    // 2026-06-25: collapse on any SPC-host level, not only while SPC's own mug is up. A CMDR
    // gameplay line ending on L13/L14 now leaves the CMDR mug (_spcMode false) instead of swapping
    // to SPC's idle face — but the overlay must still dismiss so it doesn't park over the playfield.
    if (!_spcMode && !_spcLevelHost) return;
    if (commCollapseTimer) { clearTimeout(commCollapseTimer); commCollapseTimer = null; }
    commCollapseTimer = setTimeout(() => {
      commCollapseTimer = null;
      if ((!_spcMode && !_spcLevelHost) || _voPlaying || _voQueue.length > 0 || tickerVisible) return;
      hud?.classList.add("comm-collapsed");
    }, COMM_COLLAPSE_MS);
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
    _voProtected = false;
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
    if (!hudVisible || arcadeLevelSelectOpen) return;
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
    voFile = null,
    duration = 3500,
    frame = null,
    event = null,
    onDone = null,
    _onEnd = null,
    _spc = false,
  } = {}) {
    if (arcadeLevelSelectOpen) { if (_onEnd) _onEnd(); return; } // no comms over the level-select menu
    if (!hudVisible) show();
    if (!hudVisible) {
      if (_onEnd) _onEnd();
      return;
    }
    const triggerToken = ++_voTriggerToken;

    let resolvedLines = lines;
    let resolvedAudio = audioSrc;
    // 2026-06-24: a `voFile` (intended VO filename) resolves audio when the mp3 is available and
    // ALWAYS resolves the caption from VO_CAPTIONS — so placeholder lines whose audio isn't recorded
    // yet (e.g. L15 gauntlet_intro.mp3) still TYPE their caption instead of showing a blank comm box.
    // (commVoSrc() returns null for unrecorded files, which previously left audioSrc null and skipped
    // the caption lookup below entirely.)
    if (voFile) {
      if (!resolvedAudio) resolvedAudio = commVoSrc(voFile);
      if ((!resolvedLines || resolvedLines.length === 0) && VO_CAPTIONS[voFile]) {
        resolvedLines = [VO_CAPTIONS[voFile]];
      }
    }
    if ((!resolvedLines || resolvedLines.length === 0) && resolvedAudio) {
      const filename = resolvedAudio.split("/").pop();
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

    // 2026-06-24: mug follows the line's speaker, not the level. On SPC-host levels (13/14) a CMDR
    // gameplay line (_spc false) shows the CMDR mug for its duration; SPC's own lines (_spc true) keep
    // her mug. Restored to the SPC host when the line ends (endTalking).
    if (_spcLevelHost) {
      // 2026-07-03: make the mug authoritative on THIS line's channel, not on prior _spcMode state.
      // A carried-over line left the SPC mug up while a CMDR clip played on L13; forcing showCmdrForLine
      // on every CMDR line (idempotent) guarantees a CMDR clip always shows the CMDR mug.
      if (_spc) { if (!_spcMode) restoreSpcHost(); }
      else { showCmdrForLine(); }
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
      // 2026-06-25: line over. We NO LONGER re-park SPC's idle mug here. The mug now only ever shows
      // while someone is actively speaking — SPC's mug appears when SHE speaks (the _spc branch in
      // triggerVO) and goes away with the line. This kills the "SPC mug pops up for nothing right after
      // a Commander comm" bug (it fired even on levels where the SPC-host flag leaked on, e.g. L12).
      tickIdle();
      tickerHideTimer = setTimeout(() => {
        // 2026-06-23: never let a stale CMDR auto-hide wipe a live SPC caption (the plasma-net
        // praise line vanished mid-VO). SPC drives its own caption lifecycle; only auto-hide here
        // when SPC doesn't own the ticker.
        if (!spcTickerActive) hideTicker();
        // 2026-06-24: SPC levels — once the caption clears and nothing else is queued, dismiss the
        // mug after a short beat to free up playfield space (no-op on CMDR levels).
        scheduleCommCollapse();
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
    // 2026-06-24: Stunt Mode (training/practice) — SPC's VO + caption start a touch sooner (120ms).
    // 2026-06-25: device-tested the snappier training timing and brought the main game down to match
    // (was 280ms — felt laggy after the comm-box pop/blip). Small 150ms beat still lets the comm pop
    // settle before the voice starts.
    const voDelay = _exclusiveSpeaker ? 120 : 150;

    const beginMainVO = () => {
      if (triggerToken !== _voTriggerToken) return;
      startMouthFlap(getTalkFrames());
      showTicker();
      typeText(resolvedLines);

      if (resolvedAudio) {
        let audioFallbackTimer = null;
        const finishAudio = () => {
          if (audioFallbackTimer) clearTimeout(audioFallbackTimer);
          endTalking();
        };
        try {
          // 2026-06-24: reuse the persistent "CMDR" VO element (see acquireVoElement) instead of a
          // fresh `new Audio()` per line — the per-line createMediaElementSource was the node leak.
          voAudio = acquireVoElement("CMDR");
          voAudio.src = resolvedAudio;
          // 2026-06-17: L14 mutes CMDR voice (caption still types), but SPC's own bonus lines
          // (_spc) bypass the mute so the Specialist is actually heard on her level.
          voAudio.volume = (muteCmdrVO && !_spc) ? 0 : (_spc ? 0.85 : 0.7);
          voAudioFxCleanup = applyCommRadioEffect(voAudio);
          voAudio.play().catch(() => {
            if (!audioFallbackTimer) audioFallbackTimer = setTimeout(endTalking, duration);
          });
          voAudio.onended = finishAudio;
          audioFallbackTimer = setTimeout(endTalking, duration);
          // 2026-06-23: the fallback above (default 3500ms) used to fire endTalking — which runs
          // voAudioFxCleanup() and DISCONNECTS the radio-filter graph — before a long clip naturally
          // ended. Since the audio routes through a MediaElementSource, disconnecting silences its
          // tail (the "THAT'S WHAT I'M TALKING ABOUT" cutoff). Once metadata loads, stretch the
          // fallback to the real clip length (+buffer) so the natural "ended" event drives the end.
          voAudio.onloadedmetadata = () => {
            const realMs = (voAudio?.duration || 0) * 1000 + 600;
            if (Number.isFinite(realMs) && realMs > duration && audioFallbackTimer) {
              clearTimeout(audioFallbackTimer);
              audioFallbackTimer = setTimeout(endTalking, realMs);
            }
          };
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
    // 2026-06-22: a queued line can carry a playGuard predicate, evaluated at play time (after the
    // ~600ms queue gap). If it no longer holds — e.g. the UFO the line announces was already killed
    // — skip this line and immediately drain the next queued one so the queue never stalls.
    if (options.playGuard && !options.playGuard()) {
      if (_voQueue.length > 0) { playVONow(_voQueue.shift()); return; }
      _voPlaying = false;
      return;
    }
    const playToken = ++_voPlayToken;
    _voPlaying = true;
    _voProtected = !!options.protected; // 2026-07-03: guard this line from high-priority preemption
    const onEnd = options._onEnd;
    triggerVO({
      ...options,
      _onEnd: () => {
        if (playToken !== _voPlayToken) return;
        if (onEnd) onEnd();
        _voPlaying = false;
        _voProtected = false;
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
  // 2026-07-03: while a `protected` line is playing (e.g. the L14 official opener), a high-priority
  // reaction must NOT cut it off — it queues behind instead. Set per-line in playVONow.
  let _voProtected = false;
  function setLevelEndLock(on) {
    _levelEndLock = !!on;
    if (on) { _voQueue.length = 0; } // flush incidental stragglers queued before the level ended
  }

  function queueVO(options = {}) {
    if (arcadeLevelSelectOpen) return; // no comms over the level-select menu
    if (_exclusiveSpeaker && !options._spc) return;
    // Level-end window: let only the one levelcomplete praise speak (see setLevelEndLock).
    if (_levelEndLock && options.event !== "levelcomplete") return;
    const highPriority = options.priority === "high";
    // A `protected` line in flight can't be preempted — a high-priority line queues behind it.
    if (highPriority && !_voProtected) {
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
    getSpcImages: () => spcImages,
    setMuteCmdrVO: (on) => { muteCmdrVO = !!on; },
    pinTicker,
    hideTicker,
    collapseCommNow,
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
    POOL_CMDR_BLAST,
    POOL_LEVEL_COMPLETE,
    POOL_LEVEL_COMPLETE_LATE,
    POOL_UFO_SPOTTED,
    POOL_WIN,
    POOL_NICE_SHOT,
    POOL_HYPE,
    POOL_SPC_PRAISE,
    POOL_SPC_LEVEL_START,
    POOL_SPC_TIMER_LOW,
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

let _soundLoadChain = Promise.resolve();
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
  _pulseFilter: null,   // 2026-07-01: lowpass (high-cut) music dip while the Pulse Cannon runs
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
  // ⚠️ RETIRED 2026-06-24 — DO NOT CALL. This closed + rebuilt the AudioContext between levels to
  // release leaked VO MediaElementSource nodes. It worked, but rebuilding the ctx caused level-start
  // freezes, iOS audio-loss (a fresh ctx starts suspended and can't resume outside a user gesture),
  // and music restarts (currentMusic nulled → same-track level pairs no longer carried over). The
  // leak is now fixed at SOURCE via persistent per-channel VO elements (see acquireVoElement), so the
  // ctx lives for the whole session. Kept only for reference — re-wiring this re-introduces all three
  // regressions. Closing the ctx is now never the right move.
  teardown() {
    try { this.stopMusic(); } catch { /* ignore */ }
    try { this.stopAllLoops(); } catch { /* ignore */ }
    try { this.removeFreezeFilter(); } catch { /* ignore */ }
    try { this.ctx?.close(); } catch { /* ignore */ }
    this.ctx = null;
    this.masterGain = null;
    this.musicGain = null;
    this._freezeFilter = null;
    this._freezeFilter2 = null;
    this._pulseFilter = null;
    this._musicGainBeforePulse = null;
    this._musicGainBeforeFreeze = null;
    this.currentMusic = null;
    this.currentMusicHtml = null;
    this.voices.clear(); // context-bound SFX source nodes — die with the ctx
    this.loops.clear();  // context-bound loop source nodes — die with the ctx
    this.unlocked = false; // force unlock()/resume() on the rebuilt ctx
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
    const soundMap = mapNameToUrl || {};
    const missingKeys = Object.keys(soundMap).filter((key) => !this.buffers.has(key));
    if (!missingKeys.length) return Promise.resolve();
    const priorityKeys = [
      "orb_tap",
      "orb_rub2",
      "explosion_med",
      "explosion_big",
      "advfire",
      "pulse_cannon_charge",
      "pulse_cannon_fire1",
      "pulse_cannon_fire2",
      "ufo_destroy",
      "landmine_boom",
      "plasmarecharged",
    ];
    const orderedKeys = [
      ...priorityKeys.filter((key) => missingKeys.includes(key)),
      ...missingKeys.filter((key) => !priorityKeys.includes(key)),
    ];
    const run = async () => {
      for (let i = 0; i < orderedKeys.length; i += 1) {
        const name = orderedKeys[i];
        try {
          await this.loadSound(name, soundMap[name]);
        } catch {
          // Skip individual failed sounds and continue loading the rest.
        }
      }
    };
    _soundLoadChain = _soundLoadChain.then(run, run);
    return _soundLoadChain;
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
  playHtmlAudio(name, { volume = 1, rate = 1, loop = false, preservePitch = false } = {}) {
    const src = GAME_SFX?.[name];
    if (!src) return { stop() {}, ended: Promise.resolve() };
    const pool = this.htmlAudioPool.get(src) || [];
    const poolLimit = loop ? 2 : (preservePitch ? 2 : 4);
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
    }
    if (node) {
      const nodeIndex = pool.indexOf(node);
      if (nodeIndex >= 0 && nodeIndex !== pool.length - 1) {
        pool.splice(nodeIndex, 1);
        pool.push(node);
      }
    }
    while (pool.length > poolLimit) {
      const old = pool.shift();
      if (!old || old === node) continue;
      try {
        old.pause();
        old.currentTime = 0;
      } catch {
        // ignore
      }
    }
    this.htmlAudioPool.set(src, pool);
    node.loop = !!loop;
    node.playbackRate = clamp(rate, 0.5, 2);
    if (preservePitch) {
      node.preservesPitch = true;
      node.mozPreservesPitch = true;
      node.webkitPreservesPitch = true;
    }
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
    // 2026-06-24: cap the player fire sound (advfire) lower and steal the oldest voice — without this,
    // up to 8 identical phase-locked buffers (4 per quad tap) summed into a low resonant boom under
    // sustained fire. Fewer overlapping voices + the per-shot detune jitter keep it crisp.
    const isPlayerFire = name === "advfire";
    const maxVoices = name === "orb_tap"
      ? 10
      : (isExplosionLike ? (isIOSWebKit ? 24 : 16) : (isPlayerFire ? 5 : this.maxVoicesPerSound));
    const mode = name === "orb_tap"
      ? "drop_newest"
      : ((isExplosionLike || isPlayerFire) ? "steal_oldest" : "drop_newest");
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
    if (isIOSNative) return null;
    this.ensureMusic();
    if (!this.ctx) return null;
    if (this.musicBuffers.has(url)) {
      // 2026-06-23: LRU touch — re-insert so the most-recently-used tracks survive eviction.
      const cached = this.musicBuffers.get(url);
      this.musicBuffers.delete(url);
      this.musicBuffers.set(url, cached);
      return cached;
    }
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      const arr = await response.arrayBuffer();
      const decoded = await this.ctx.decodeAudioData(arr.slice(0));
      this.musicBuffers.set(url, decoded);
      this._evictMusicBuffers();
      return decoded;
    } catch {
      return null;
    }
  },
  // 2026-06-23 PERF: decodeAudioData expands an MP3 to raw 32-bit float PCM (~40-60MB per ~3min
  // stereo loop), and the cache used to hold EVERY track played for the whole session. Climbing
  // levels 1→12 thus pinned ~500MB+ of decoded audio, starving iOS and turning every allocating
  // action (explosions, shrapnel, toss) into a GC stall — while level-select straight to 12 stayed
  // smooth (only ~2 tracks decoded). Cap the cache to the working set (current + prefetched next +
  // slack), LRU-evicted, and never drop the track that's actually playing. Evicted tracks simply
  // re-decode on demand; the one-level look-ahead prefetch keeps the next one warm.
  _evictMusicBuffers() {
    const protectedUrls = new Set([this.currentMusic?.url, this.currentMusicHtml?.url]);
    // Map preserves insertion order → iterate oldest-first, drop until within the cap.
    for (const key of this.musicBuffers.keys()) {
      if (this.musicBuffers.size <= MUSIC_BUFFER_CACHE_MAX) break;
      if (protectedUrls.has(key)) continue;
      this.musicBuffers.delete(key);
    }
  },
  async playMusic(key, url, { crossfadeMs = 250, volume = 1, fadeUpMs = 0 } = {}) {
    if (!url) return;
    this.ensureMusic();
    // 2026-06-22: in-flight guard. currentMusic/currentMusicHtml aren't set until the awaits below
    // resolve, so two calls for the same key in quick succession both used to slip past the
    // same-key checks and start two sources (the menu-theme double-start). Track the pending key so
    // a concurrent same-key call is a no-op until the first finishes.
    if (this._pendingMusicKey === key) return;
    if (this.currentMusic && this.currentMusic.key === key) return;
    if (this.currentMusicHtml && this.currentMusicHtml.key === key) return;
    this._pendingMusicKey = key;
    try {
      return await this._playMusicInner(key, url, { crossfadeMs, volume, fadeUpMs });
    } finally {
      if (this._pendingMusicKey === key) this._pendingMusicKey = null;
    }
  },
  async _playMusicInner(key, url, { crossfadeMs = 250, volume = 1, fadeUpMs = 0 } = {}) {
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
      this.currentMusicHtml = { key, url, node, baseVolume: volume };
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
    // 2026-07-01: fadeUpMs => "soft intro" — fade in quickly to a few dB down, then swell to full
    // over fadeUpMs so the menu theme eases in instead of hitting at full volume. (used by the menu.)
    const introVol = fadeUpMs > 0 ? volume * 0.6 : volume;
    gain.gain.linearRampToValueAtTime(introVol, now + crossfadeMs / 1000);
    if (fadeUpMs > 0) gain.gain.linearRampToValueAtTime(volume, now + crossfadeMs / 1000 + fadeUpMs / 1000);
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
    this.currentMusic = { key, url, source, gain, baseVolume: volume, startedAt: performance.now(), ctxStartedAt: this.ctx.currentTime };
  },
  // 2026-06-24: mid-track music swell. Ramp the live music source's gain to baseVolume * mult over
  // rampMs — drives L9's noticeable swell (~25s in) and L10's gradual rise across the level. No-op if
  // no music is playing yet. Relative to the per-level base so it composes with cfg.musicVolume.
  rampMusicVolume(mult, rampMs = 2000) {
    const m = this.currentMusic;
    if (m?.gain && this.ctx) {
      const now = this.ctx.currentTime;
      const target = (m.baseVolume || 1) * mult;
      try {
        m.gain.gain.cancelScheduledValues(now);
        m.gain.gain.setValueAtTime(m.gain.gain.value, now);
        m.gain.gain.linearRampToValueAtTime(target, now + Math.max(0.05, rampMs / 1000));
      } catch {
        // ignore
      }
    }
    if (this.currentMusicHtml?.node) {
      const full = state.whisper ? 0.43 : MUSIC_MAX_GAIN;
      this.currentMusicHtml.node.volume = Math.min(1, full * (this.currentMusicHtml.baseVolume || 1) * mult);
    }
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
    // 2026-07-01: freeze takes priority over the Pulse Cannon dip. If a pulse filter is already
    // spliced, tear it down first (keeping its saved pre-pulse gain as the true baseline) so freeze
    // splices cleanly — no double node in the chain, and thaw restores to the real level, not the
    // ducked one. An in-flight pulse just loses its music dip for the freeze's duration; its later
    // onPulseEnd/removePulseFilter no-ops safely.
    let priorBase = null;
    if (this._pulseFilter) {
      priorBase = this._musicGainBeforePulse;
      this.removePulseFilter();
    }
    const dest = this.masterGain || this.ctx.destination;
    const hp = this.ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 80;
    hp.Q.value = 0.9;
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass";
    // 2026-06-22: more dramatic freeze — push the cutoff down hard and add resonance so
    // the track sounds plunged underwater/frozen, not just gently muffled.
    lp.frequency.value = 320;
    lp.Q.value = 6;
    hp.connect(lp);
    lp.connect(dest);
    try { this.musicGain.disconnect(dest); } catch { /* ignore */ }
    this.musicGain.connect(hp);
    this._freezeFilter = hp;
    this._freezeFilter2 = lp;
    // Duck the music so the freeze lands as a dramatic dip, then it swells back on thaw.
    try {
      const g = this.musicGain.gain;
      const t = this.ctx.currentTime;
      // If we just took over from a pulse dip, restore the pre-pulse level as the freeze baseline.
      this._musicGainBeforeFreeze = priorBase != null ? priorBase : g.value;
      g.cancelScheduledValues(t);
      g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(this._musicGainBeforeFreeze * 0.45, t + 0.35);
    } catch { /* ignore */ }
  },
  removeFreezeFilter() {
    if (!this._freezeFilter || !this.ctx || !this.musicGain) {
      this._freezeFilter = null;
      this._freezeFilter2 = null;
      return;
    }
    // Un-duck: swell the music back to its pre-freeze level.
    try {
      const g = this.musicGain.gain;
      const t = this.ctx.currentTime;
      const target = this._musicGainBeforeFreeze != null ? this._musicGainBeforeFreeze : g.value;
      g.cancelScheduledValues(t);
      g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(target, t + 0.4);
    } catch { /* ignore */ }
    this._musicGainBeforeFreeze = null;
    const dest = this.masterGain || this.ctx.destination;
    try { this.musicGain.disconnect(this._freezeFilter); } catch { /* ignore */ }
    try { this._freezeFilter.disconnect(); } catch { /* ignore */ }
    try { this._freezeFilter2?.disconnect(); } catch { /* ignore */ }
    this.musicGain.connect(dest);
    this._freezeFilter = null;
    this._freezeFilter2 = null;
  },
  // 2026-07-01: Pulse Cannon music FX — a single lowpass (high-cut at 600Hz) spliced into
  // musicGain→masterGain so the track dips/darkens while the weapon rips, then swells back on
  // expiry. Gentler than the freeze bandpass (no low-cut, higher cutoff, lighter duck). Only the
  // Web Audio path is filtered (see the iOS note on the freeze filter). If a freeze filter is
  // already live it muffles harder, so the pulse filter stands down entirely to avoid a double
  // splice — and won't touch musicGain on teardown either.
  applyPulseFilter() {
    this.ensureMusic();
    if (!this.ctx || !this.musicGain || this._pulseFilter || this._freezeFilter) return;
    const dest = this.masterGain || this.ctx.destination;
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 600; // dim everything above 600Hz
    lp.Q.value = 1;
    lp.connect(dest);
    try { this.musicGain.disconnect(dest); } catch { /* ignore */ }
    this.musicGain.connect(lp);
    this._pulseFilter = lp;
    // Light duck (freeze drops to 0.45; keep the track present here) so the weapon reads without
    // burying the music.
    try {
      const g = this.musicGain.gain;
      const t = this.ctx.currentTime;
      this._musicGainBeforePulse = g.value;
      g.cancelScheduledValues(t);
      g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(g.value * 0.7, t + 0.2);
    } catch { /* ignore */ }
  },
  removePulseFilter() {
    if (!this._pulseFilter || !this.ctx || !this.musicGain) {
      this._pulseFilter = null;
      return;
    }
    try {
      const g = this.musicGain.gain;
      const t = this.ctx.currentTime;
      const target = this._musicGainBeforePulse != null ? this._musicGainBeforePulse : g.value;
      g.cancelScheduledValues(t);
      g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(target, t + 0.3);
    } catch { /* ignore */ }
    this._musicGainBeforePulse = null;
    const dest = this.masterGain || this.ctx.destination;
    try { this.musicGain.disconnect(this._pulseFilter); } catch { /* ignore */ }
    try { this._pulseFilter.disconnect(); } catch { /* ignore */ }
    this.musicGain.connect(dest);
    this._pulseFilter = null;
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

// 2026-06-24: persistent per-channel VO <audio> elements. createMediaElementSource() permanently
// binds an element to the AudioContext and the resulting node is never GC'd — so the old "new Audio()
// + applyCommRadioEffect() per VO line" piled up dead source nodes and progressively lagged VO-heavy
// playthroughs (~L13) and the SPC tutorial. We now keep ONE element per channel ("CMDR"/"SPC") and
// re-point its .src each line, so createMediaElementSource runs at most once per channel for the whole
// session. This replaces the per-level audioEngine.teardown() sledgehammer (closed the ctx to release
// the nodes) which cured the leak but caused level-start freezes, iOS audio-loss (a rebuilt ctx starts
// suspended and can't resume outside a user gesture), and music restarts (teardown nulled currentMusic
// so same-track level pairs no longer carried over).
const _voChannels = new Map(); // channel name -> HTMLAudioElement
const _commRadioWired = new WeakSet(); // elements whose radio graph is already built (wire once)
function acquireVoElement(channel) {
  let el = _voChannels.get(channel);
  if (!el) {
    el = new Audio();
    el.preload = "auto";
    el.playsInline = true;
    _voChannels.set(channel, el);
  }
  // Wire the radio-filter graph once the ctx is running (idempotent; no-op once wired or pre-unlock).
  applyCommRadioEffect(el);
  // Reset transient per-line listeners/state so a reused element never inherits the prior line's.
  el.onended = null;
  el.onloadedmetadata = null;
  el.onerror = null;
  el.onplaying = null;
  el.ontimeupdate = null;
  try { el.pause(); el.currentTime = 0; } catch { /* empty element pre-first-src */ }
  el.playbackRate = 1;
  return el;
}

// Wire a one-time "comm radio" filter chain for a VO <audio> element. Idempotent: each element is
// wired at most once (createMediaElementSource can only ever be called once per element), and the
// chain stays connected to masterGain for the session — one idle filter chain per channel, not one
// per line. Returns a no-op cleanup (the persistent graph is never torn down; stop a line via
// el.pause()). Muting is handled by the caller via el.volume, so the `enabled` arg is advisory.
function applyCommRadioEffect(audioNode) {
  if (!audioNode || _commRadioWired.has(audioNode)) return () => {};
  try {
    const ctx = audioEngine.ensureContext?.();
    if (!ctx || !audioEngine.masterGain) return () => {};
    if (ctx.state !== "running") return () => {}; // not unlocked yet — play dry, wire on a later line
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

    _commRadioWired.add(audioNode);
    return () => {};
  } catch {
    return () => {};
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
  if (isIOSNative) return;
  audioEngine.loadMany(isIOSNative ? sfxMapForKeys(CORE_PRELOAD_SFX_KEYS) : GAME_SFX);
}

let arcadeWarmupPromise = null;
let arcadeWarmupOverlay = null;
// 2026-06-30: assigned inside initGalaxyCanvas (the giant galaxy closure) so the top-level
// WARMING UP routine can pre-decode + GPU-prime the gameplay sprites it otherwise can't reach.
let warmGameplaySprites = null;

function afterNextPaint() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

function setArcadeWarmupVisible(visible, text = "LOADING") {
  if (!galaxyView) return;
  if (!arcadeWarmupOverlay) {
    if (!document.getElementById("arcadeWarmupStyles")) {
      const style = document.createElement("style");
      style.id = "arcadeWarmupStyles";
      style.textContent = `
        @keyframes arcadeWarmupSpin{to{transform:rotate(1turn)}}
        @keyframes arcadeWarmupPulseScale{
          0%,100%{transform:scale(1)}
          50%{transform:scale(1.08)}
        }
        .arcadeWarmupInner b{
          display:inline-block;
          transform-origin:center;
          animation:arcadeWarmupPulseScale 1.15s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce){
          .arcadeWarmupInner b{animation:none}
        }
      `;
      document.head.appendChild(style);
    }
    arcadeWarmupOverlay = document.createElement("div");
    arcadeWarmupOverlay.id = "arcadeWarmup";
    arcadeWarmupOverlay.innerHTML = '<div class="arcadeWarmupInner"><span></span><b></b></div>';
    Object.assign(arcadeWarmupOverlay.style, {
      position: "fixed",
      inset: "0",
      zIndex: "9800",
      display: "none",
      alignItems: "center",
      justifyContent: "center",
      pointerEvents: "auto",
      background: "radial-gradient(circle at 50% 42%, rgba(8,18,34,.92), rgba(1,4,10,.98))",
      color: "#dff",
      fontFamily: "ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace",
      letterSpacing: ".16em",
      textAlign: "center",
    });
    const inner = arcadeWarmupOverlay.querySelector(".arcadeWarmupInner");
    Object.assign(inner.style, {
      display: "grid",
      gap: "14px",
      placeItems: "center",
      textShadow: "0 0 18px rgba(0,255,209,.7)",
    });
    const ring = arcadeWarmupOverlay.querySelector("span");
    Object.assign(ring.style, {
      width: "54px",
      height: "54px",
      borderRadius: "50%",
      border: "2px solid rgba(0,255,209,.18)",
      borderTopColor: "#00FFD1",
      animation: "arcadeWarmupSpin .82s linear infinite",
      boxShadow: "0 0 22px rgba(0,255,209,.35)",
    });
    (galaxyView || document.body).appendChild(arcadeWarmupOverlay);
  }
  const label = arcadeWarmupOverlay.querySelector("b");
  if (label) label.textContent = text;
  arcadeWarmupOverlay.style.display = visible ? "flex" : "none";
}

async function warmImageSet(images) {
  const list = Object.values(images || {}).filter(Boolean);
  await Promise.all(list.map((img) => {
    if (img.complete && img.naturalWidth > 0) return Promise.resolve();
    if (typeof img.decode === "function") return img.decode().catch(() => {});
    return new Promise((resolve) => {
      img.onload = () => resolve();
      img.onerror = () => resolve();
      setTimeout(resolve, 1200);
    });
  }));
}

async function warmArcadeAssets(levelNum = 1) {
  if (arcadeWarmupPromise) return arcadeWarmupPromise;
  setArcadeWarmupVisible(true, "WARMING UP");
  const minHold = delay(420);
  arcadeWarmupPromise = (async () => {
    try {
      await afterNextPaint();
      await audioEngine.unlock?.();
      await audioEngine.loadMany?.(gameplayPreloadSfxMap());
      const bgKey = bgKeyForLevel(levelNum);
      preloadGalaxyBackgroundKey(bgKey);
      await Promise.race([
        audioEngine.loadMusicBuffer?.(getMusicForLevel(levelNum)) || Promise.resolve(),
        delay(1800),
      ]);
      // 2026-06-30: pre-decode + GPU-prime ALL gameplay sprites (asteroids incl. generated tint
      // skins, powerups, combo-FX sheets, AND the slot symbols) so first combo / first pickup /
      // first tinted-rock level / first slot reveal no longer hitch. This supersedes the old
      // slotSprites warm here, whose guard was dead code (closure-local symbols, unreachable
      // from this top-level scope). Longer warmup, drop-free play (intentional per playtest).
      if (typeof warmGameplaySprites === "function") {
        await Promise.race([warmGameplaySprites(), delay(1800)]);
      }
      await minHold;
    } finally {
      setArcadeWarmupVisible(false);
      arcadeWarmupPromise = null;
      setTimeout(() => primeLeaderboardThresholds({ timeoutMs: 1600 }).catch(() => {}), 250);
    }
  })();
  return arcadeWarmupPromise;
}

async function playSfxAndWait(name, { volume = 1, rate = 1, detune = 0, maxWaitMs = 8000 } = {}) {
  const handle = audioEngine.play(name, { volume, rate, detune });
  const durationMs = audioEngine.getDuration(name, rate) * 1000;
  const waitMs = clamp(durationMs || 300, 180, maxWaitMs);
  await Promise.race([handle?.ended || Promise.resolve(), delay(waitMs)]);
}

init();

function init() {
  const runStartupStep = (label, fn) => {
    try {
      fn?.();
    } catch (error) {
      console.warn(`[startup] ${label} failed`, error);
    }
  };
  setVh();
  resetUiOverlayState();
  loadState();
  runStartupStep("preloadSfx", preloadSfx);
  addListeners();
  // 2026-06-16: procedural Oracle starfield removed — the Oracle page background is now the
  // looping MP4 (#oracleBgVideo → assets/video/oracle_bg.mp4). initGalaxyBackground() (and its
  // #galaxyCanvas element) are gone; the gameplay level-video stack is unaffected.
  runStartupStep("initGalaxyCanvas", initGalaxyCanvas);
  runStartupStep("initBackgroundVideos", initBackgroundVideos);
  runStartupStep("applyTheme", applyTheme);
  runStartupStep("buildPackSelect", buildPackSelect);
  runStartupStep("warmVoices", warmVoices);
  runStartupStep("populateVoices", populateVoices);
  runStartupStep("applySettingsToUi", applySettingsToUi);
  runStartupStep("renderVault", renderVault);
  runStartupStep("setIntentState", setIntentState);
  runStartupStep("setupFirstRunHint", setupFirstRunHint);
  runStartupStep("initTitleSparkles", initTitleSparkles);
  runStartupStep("initOrbTapPool", initOrbTapPool);
  runStartupStep("setGalaxyTool", () => setGalaxyTool(state.galaxyTool));
}

function addListeners() {
  if (listenersBound) return;
  listenersBound = true;
  window.addEventListener("resize", setVh);
  window.addEventListener("orientationchange", setVh);
  questionInput.addEventListener("focus", setVh);
  questionInput.addEventListener("blur", setVh);

  const primeMediaOnGesture = () => {
    if (mediaPrimed) return;
    mediaPrimed = true;
    if (isIOSNative) return;
    audioEngine.unlock();
    primeBackgroundMedia();
  };
  document.addEventListener("pointerdown", primeMediaOnGesture, { once: true });
  document.addEventListener("touchstart", primeMediaOnGesture, { once: true, passive: true });
  document.addEventListener("keydown", primeMediaOnGesture, { once: true });
  const resumeAudioOnGesture = () => {
    if (isIOSNative && !audioEngine.ctx) return;
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
  if (hudPulseBadge) {
    // 2026-07-01: tapping the Pulse Cannon badge cancels the weapon early.
    hudPulseBadge.addEventListener("click", () => {
      galaxyCanvasController?.cancelPulse?.();
    });
  }
  if (hudQuadBadge) {
    // 2026-07-02: tapping the Quad Shot badge cancels the weapon early (parity with Pulse Cannon).
    hudQuadBadge.addEventListener("click", () => {
      galaxyCanvasController?.cancelQuad?.();
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
  // 2026-06-22 (19:21 notes #1+#2): unified press feedback + a ~1/3s pause before the menu actually
  // navigates, so the pressed button's yellow flash is visible on THIS page before the panel swaps
  // (previously the flash landed on the next page's button because nav happened instantly). Forward
  // taps (.modeBtn) play the new menu-hit sound; "← Back" taps (.modeBackBtn) play the back sound.
  // Implemented as a single CAPTURE-phase listener that intercepts the first click, plays feedback,
  // then re-dispatches the click after the pause so each button's own navigation handler runs
  // untouched. Locked/disabled cards stay silent; extra taps during the pause are ignored.
  const MENU_PRESS_DELAY = 320;
  // 2026-07-01: SPC voice callouts on the mode-select buttons (classic-arcade style). Uses the same
  // dual-layer processing as the Combo voice FX (playComboSfx) but at normal speed, per playtest —
  // full menu phrases stay intelligible. Keyed off button id; Resume/Scores/Back get no callout.
  const MENU_VO = {
    btnArcade: ["menuvo_arcade_mode", "menuvo_arcade"], // random alternate per user request
    btnArcadeStunt: ["menuvo_stunt_mode"],
    btnArcadeNew: ["menuvo_new_game"],
    btnArcadeLevelSelect: ["menuvo_level_select"],
    btnStuntTraining: ["menuvo_training"],
    btnStuntPractice: ["menuvo_practice"],
    btnPractice: ["menuvo_practice"],
  };
  function playMenuVo(btnId) {
    const choices = MENU_VO[btnId];
    if (!choices) return;
    const key = choices[(Math.random() * choices.length) | 0];
    const fn = window.playGameSfx;
    if (typeof fn !== "function") return;
    // 2026-07-02: menu VOs ("level select" etc.) were a touch too loud — dropped both layers.
    fn(key, 0.5, { rate: 1.0, preservePitch: true, important: true });
    setTimeout(() => fn(key, 0.12, { rate: 1.0, preservePitch: true, important: true }), 70);
  }
  if (galaxyModeSelect) {
    let menuNavPending = false;
    galaxyModeSelect.addEventListener("click", (e) => {
      const btn = e.target?.closest?.(".modeBtn, .modeBackBtn");
      if (!btn || !galaxyModeSelect.contains(btn)) return;
      if (btn.disabled || btn.classList.contains("locked") || btn.classList.contains("is-disabled")) return;
      if (btn._menuNavReplay) { btn._menuNavReplay = false; return; } // the delayed replay — let it through
      e.stopImmediatePropagation();
      if (menuNavPending) return; // ignore extra taps while the press-pause is running
      menuNavPending = true;
      const isBack = btn.classList.contains("modeBackBtn");
      // 2026-07-01: forward select stays on the menu_hit blip at 0.9 (~1.5x) since it carries an
      // SPC voice callout underneath. Back now reuses the (softened) level-complete chime.
      if (isBack) window.playGameSfx?.("level_up", 0.5);
      else audioEngine.play("menu_hit", { volume: 0.9 });
      if (!isBack) {
        playMenuVo(btn.id);
        btn.classList.remove("modeBtn--select");
        void btn.offsetWidth; // restart the flash on rapid re-taps
        btn.classList.add("modeBtn--select");
        btn.addEventListener("animationend", () => btn.classList.remove("modeBtn--select"), { once: true });
      }
      setTimeout(() => {
        menuNavPending = false;
        btn._menuNavReplay = true;
        btn.click(); // replay → capture lets it through → the button's nav handler fires
      }, MENU_PRESS_DELAY);
    }, true); // capture: runs before the buttons' own navigation handlers
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
  // 2026-06-26: free the crystal-ball reveal video's decoder/buffer while in the game (Stroids menu
  // + gameplay). It's an Oracle-only on-demand FX, so holding it here just adds to the simultaneous-
  // video-decoder pressure suspected in the L9/menu render-server crash (CARenderServer). Re-armed
  // in closeGalaxyView(); startCrystalOverlay() also re-sets the src on the next Reveal.
  if (revealFxVideo) {
    try {
      revealFxVideo.pause();
      revealFxVideo.removeAttribute("src");
      revealFxVideo.load();
    } catch { /* decoder release is best-effort */ }
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
  menuLogoWarp.stop(); // stop the logo idle shimmer when returning to the Oracle
  galaxyView.hidden = true;
  galaxyView.setAttribute("aria-hidden", "true");
  oracleView.hidden = false;
  document.body.style.overflow = "";
  // 2026-06-22: restore the Oracle bg video on return. Opacity alone wasn't enough — on iOS the
  // WKWebView drops the paused video's decoded frame while it's hidden behind the galaxy view, so
  // it comes back black. Clear the fade-in opacity AND force a clean replay (reload only if the
  // media element actually lost its data), then let the controller's watchdog keep it alive.
  if (oracleBgVideo) {
    oracleBgVideo.style.opacity = "";
    try {
      if (oracleBgVideo.readyState < 2) oracleBgVideo.load();
      const pr = oracleBgVideo.play();
      if (pr && typeof pr.catch === "function") pr.catch(() => {});
    } catch {
      // ignore — controller.start() below also retries via its watchdog
    }
  }
  if (!prefersReducedMotion) {
    if (oracleBgController) oracleBgController.start();
  }
  // 2026-06-26: re-arm the crystal-ball reveal video (its src was released in openGalaxyView so it
  // wouldn't hold a decoder during the game). Restore the src + load so the next Reveal is ready;
  // it stays paused/hidden until startCrystalOverlay() plays it.
  if (revealFxVideo && !revealFxVideo.getAttribute("src")) {
    try {
      revealFxVideo.setAttribute("src", "crystalballfx.mp4");
      revealFxVideo.load();
    } catch { /* startCrystalOverlay() re-sets the src on the next Reveal regardless */ }
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
      // 2026-07-01: orb-tap SFX removed during Reveal per playtest — the taps muddied the
      // reveal intro/voice mix. Visual burst (sparkle + bg flash) stays.
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
    audioEngine.play(SFX.MAIN, { volume: 0.95, rate: 1.0 }); // 2026-07-01: reveal intro up (was 0.82) so it isn't buried under the TTS voice on iPhone

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
const ORB_RUB_PULSE_EDGE = 0.9; // 2026-07-01: wider tempo spread per playtest (was 1.25) — slower edge
const ORB_RUB_PULSE_CENTER = 4.4; // 2026-07-01: faster center (was 3.2) — bigger overall BPM range
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

    // 2026-07-01: removed the 1.5kHz "presence" oscillator — it read as a harsh high-pitched hum
    // on device. The drone stays warm/low; audibility on phone speakers comes from the loop layer.

    osc1.connect(trem);
    osc2.connect(trem);
    osc3.connect(osc3Gain);
    osc3Gain.connect(trem);

    const target = state.whisper ? 0.24 : 0.48;
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
    out.gain.linearRampToValueAtTime(0, now + 0.42);
    const stopAt = now + 0.48;
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
let orbRub2WebAudio = null;
const orbRub2TargetVol = () => (state.whisper ? 0.068 : 0.162); // 2026-07-01: +35% per playtest (was 0.05/0.12), still under the main rub drone
const ORB_RUB2_FADE_IN_MS = 750;
const ORB_RUB2_FADE_OUT_MS = 1200;

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

function stopOrbRub2WebAudioNow(handle = orbRub2WebAudio) {
  if (!handle) return;
  if (handle.stopTimer) clearTimeout(handle.stopTimer);
  try { handle.source.stop(); } catch { /* ignore */ }
  try { handle.source.disconnect(); } catch { /* ignore */ }
  try { handle.gain.disconnect(); } catch { /* ignore */ }
  if (orbRub2WebAudio === handle) orbRub2WebAudio = null;
}

function startOrbRub2WebAudio() {
  const ctx = audioEngine.ensureContext?.();
  const buffer = audioEngine.buffers?.get?.("orb_rub2");
  if (!ctx || !audioEngine.masterGain || !audioEngine.unlocked || !buffer) return false;
  if (orbRub2WebAudio) {
    const handle = orbRub2WebAudio;
    if (handle.stopTimer) {
      clearTimeout(handle.stopTimer);
      handle.stopTimer = null;
    }
    const now = handle.ctx.currentTime;
    handle.gain.gain.cancelScheduledValues(now);
    handle.gain.gain.setValueAtTime(handle.gain.gain.value, now);
    handle.gain.gain.linearRampToValueAtTime(orbRub2TargetVol(), now + ORB_RUB2_FADE_IN_MS / 1000);
    return true;
  }

  const now = ctx.currentTime;
  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  source.buffer = buffer;
  source.loop = true;
  gain.gain.value = 0;
  source.connect(gain);
  gain.connect(audioEngine.masterGain);
  source.start(now);
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(orbRub2TargetVol(), now + ORB_RUB2_FADE_IN_MS / 1000);
  const handle = { ctx, source, gain, stopTimer: null };
  source.onended = () => {
    if (orbRub2WebAudio === handle) orbRub2WebAudio = null;
  };
  orbRub2WebAudio = handle;
  return true;
}

function startOrbRub2Loop() {
  try {
    audioEngine.loadSound?.("orb_rub2", GAME_SFX.orb_rub2).catch?.(() => {});
    if (!orbRub2Audio) {
      orbRub2Audio = new Audio("gamesfx/orb_rub2.mp3");
      orbRub2Audio.loop = true;
      orbRub2Audio.volume = 0; // 2026-07-01: start silent so a first-load play() can't emit an un-ramped blip before the fade engages
    }
    if (orbRub2Active) return; // already running this rub — let the loop continue, don't re-seek
    orbRub2Active = true;
    if (orbRub2FadeTimer) { clearInterval(orbRub2FadeTimer); orbRub2FadeTimer = null; }
    if (startOrbRub2WebAudio()) {
      try { orbRub2Audio.pause(); } catch { /* ignore */ }
      return;
    }
    orbRub2Audio.volume = 0;             // silence first so the restart-from-top seek is inaudible
    try { orbRub2Audio.currentTime = 0; } catch { /* ignore */ }
    if (orbRub2Audio.paused) orbRub2Audio.play().catch(() => {});
    fadeOrbRub2(orbRub2TargetVol(), ORB_RUB2_FADE_IN_MS); // long fade in
  } catch { /* ignore */ }
}
function stopOrbRub2Loop() {
  if (!orbRub2Audio || !orbRub2Active) return;
  orbRub2Active = false;
  if (orbRub2WebAudio) {
    const handle = orbRub2WebAudio;
    const { ctx, gain } = handle;
    const now = ctx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(0, now + ORB_RUB2_FADE_OUT_MS / 1000);
    handle.stopTimer = setTimeout(() => {
      if (!orbRub2Active && orbRub2WebAudio === handle) stopOrbRub2WebAudioNow(handle);
    }, ORB_RUB2_FADE_OUT_MS + 80);
    return;
  }
  fadeOrbRub2(0, ORB_RUB2_FADE_OUT_MS, () => {
    // Only pause if another rub didn't start during the fade-out (which flips Active back on).
    if (!orbRub2Active) { try { orbRub2Audio.pause(); } catch { /* ignore */ } }
  });
}

// Start the drone + the synced hard-pulse haptic loop (both idempotent).
function beginRubFeedback() {
  if (!orbRubbing) return; // 2026-07-01: never start rub audio unless a hold is genuinely in progress
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
  // 2026-07-01: hold gate raised 150->260ms so a normal tap (incl. sluggish first-open taps) releases
  // before rub audio starts — rub should only sound during a real press-and-hold. Movement still
  // brings feedback in immediately (onOrbRubMove).
  orbRubDroneTimer = setTimeout(() => { if (orbRubbing) beginRubFeedback(); }, 260);
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
let leaderboardThresholdsPromise = null;
const leaderboardThresholds = {
  loaded: false,
  firstScore: null,
  thirdScore: null,
};

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

async function primeLeaderboardThresholds({ timeoutMs = 1600 } = {}) {
  if (leaderboardThresholds.loaded) return leaderboardThresholds;
  if (!leaderboardThresholdsPromise) {
    leaderboardThresholdsPromise = (async () => {
      try {
        const db = await initLeaderboardFirestore();
        if (!db) throw new Error("Firebase unavailable");
        const snap = await db.collection("scores").orderBy("score", "desc").limit(3).get();
        const scores = snap.docs
          .map((doc) => Math.floor(Number(doc.data()?.score) || 0))
          .filter((score) => score > 0);
        leaderboardThresholds.firstScore = scores.length >= 1 ? scores[0] : null;
        leaderboardThresholds.thirdScore = scores.length >= 3 ? scores[2] : null;
        leaderboardThresholds.loaded = true;
      } catch {
        leaderboardThresholds.firstScore = null;
        leaderboardThresholds.thirdScore = null;
        leaderboardThresholds.loaded = true;
      }
      if (typeof CustomEvent === "function") {
        window.dispatchEvent(new CustomEvent("polyLeaderboardThresholdsReady"));
      }
      return leaderboardThresholds;
    })();
  }
  await Promise.race([leaderboardThresholdsPromise, delay(timeoutMs)]);
  return leaderboardThresholds;
}

function playPolyverseScoreboardVo() {
  const _voFn = window.playGameSfx;
  if (typeof _voFn !== "function") return;
  _voFn("menuvo_polyversescoreboard", 0.5, { rate: 1.0, preservePitch: true, important: true });
  setTimeout(() => _voFn("menuvo_polyversescoreboard", 0.12, { rate: 1.0, preservePitch: true, important: true }), 70);
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
  // SPC callout when the board is opened for browsing (not on the post-submit "Done" re-render).
  // Uses the same dual-layer echo chain as playMenuVo so it matches the other menu voiceovers.
  if (!afterSubmit) {
    playPolyverseScoreboardVo();
  }
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
  galaxyCanvasController?.playArcadeMenuMusic?.({ fullVolume: true });
  playPolyverseScoreboardVo();
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
  // FIXED 2026-06-22: the <video> has autoplay+preload, so it can already be ready (readyState>=2)
  // by the time these listeners attach — in which case canplay/loadeddata already fired and the
  // {once} listeners never run, leaving opacity:0 (background invisible on first launch until a
  // later navigation re-fires an event). Reset opacity immediately when it's already ready.
  if (oracleBgVideo) {
    const onVideoReady = () => {
      oracleBgVideo.style.opacity = "";
    };
    if (oracleBgVideo.readyState >= 2) {
      onVideoReady();
    } else {
      oracleBgVideo.addEventListener("canplay", onVideoReady, { once: true });
      oracleBgVideo.addEventListener("loadeddata", onVideoReady, { once: true });
    }
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

// 2026-06-26: blur+grayscale the just-completed level's background during the scorecard so the
// player isn't left staring at the old playfield (no full level-transition animation — that was a
// hang source). Pauses the bg video so the GPU filter runs over a static frame. Cleared in startLevel().
function setLevelBackgroundDefocus(on) {
  const bgStackEl = document.getElementById("bgStack");
  const bgCanvasEl = document.getElementById("galaxyBgCanvas");
  bgStackEl?.classList.toggle("level-defocus", on);
  bgCanvasEl?.classList.toggle("level-defocus", on);
  if (on) {
    [bgVideoA, bgVideoB].forEach((v) => { try { v?.pause(); } catch {} });
  }
  // resume is implicit: the next level's setGalaxyBackgroundKey re-plays the front video.
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
  const plasmaHudParticles = [];
  let plasmaHudState = "readyIdle";
  let plasmaHudTransitionAt = 0;
  let plasmaHudNextArcAt = 0;
  let plasmaHudArcUntil = 0;
  let plasmaHudPulseSeed = Math.random() * Math.PI * 2;
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
  // Combo BANNERS render on their own top-most layer (above the Commander comm box, z-index 9000)
  // so a combo popup near the bottom-left is never hidden behind the HUD. Only the banner text/fx
  // lives here — ambient ufoFx (sparks, freeze tint, powerups) stays on ufoFxCanvas below the
  // commander so gameplay FX never cover the portrait. Cleared only while a banner is on screen.
  const comboBannerCanvas = document.createElement("canvas");
  const comboBannerCtx = comboBannerCanvas.getContext("2d", {
    alpha: true,
    desynchronized: true,
    willReadFrequently: false,
  });
  let _comboBannerDirty = false; // true while the combo layer holds pixels (so we clear once on idle)
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
  comboBannerCanvas.setAttribute("aria-hidden", "true");
  // Fixed + parented next to #commanderHUD so it shares the root stacking context: galaxyView is a
  // fixed z-index:20 context, so a canvas inside it can never paint above the commander (9000) no
  // matter its z-index. As a commanderHUD sibling at 9500 it clears the comm box (below the 10000
  // menu overlays). Geometry mirrors galaxyPlayCanvas each frame (galaxyView is fixed inset:0, so
  // the play canvas's offsets equal viewport coords).
  comboBannerCanvas.style.position = "fixed";
  comboBannerCanvas.style.pointerEvents = "none";
  comboBannerCanvas.style.zIndex = "9500";
  comboBannerCanvas.style.inset = "auto";
  (document.getElementById("commanderHUD")?.parentNode || document.body).appendChild(comboBannerCanvas);

  // 2026-07-03: Plasma net Manual/Auto toggle + Manual-mode DETONATE button. Same top-most layer trick
  // as the combo banner (sibling of #commanderHUD, z-index 9500) so it stays visible AND tappable even
  // when a comm box overlaps the bottom-right recharge corner. The primary detonate is still tapping
  // the placed net itself; this button is the convenience affordance. Starts hidden — updatePlasmaModeBtn
  // (driven from updateArcadeHud) reveals it during arcade, practice, and stunt training gameplay.
  const plasmaModeBtn = document.createElement("button");
  plasmaModeBtn.type = "button";
  plasmaModeBtn.id = "plasmaModeBtn";
  plasmaModeBtn.className = "plasmaModeBtn";
  plasmaModeBtn.setAttribute("aria-label", "Plasma net firing mode");
  plasmaModeBtn.innerHTML = [
    '<span class="plasmaModeBtn__fx" aria-hidden="true">',
    '  <span class="plasmaModeBtn__fill"></span>',
    '  <span class="plasmaModeBtn__particles"></span>',
    '  <span class="plasmaModeBtn__core"></span>',
    "</span>",
    '<span class="plasmaModeBtn__label">NET • AUTO</span>',
  ].join("");
  (document.getElementById("commanderHUD")?.parentNode || document.body).appendChild(plasmaModeBtn);
  plasmaModeBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (plasmaCage.placed) { detonatePlacedNet(performance.now()); return; }
    plasmaCage.mode = plasmaCage.mode === "manual" ? "auto" : "manual";
    playGameSfx("blip1", 0.6, { rate: plasmaCage.mode === "manual" ? 1.2 : 0.9 });
    updatePlasmaModeBtn();
  });
  let _plasmaModeBtnSig = "";
  function updatePlasmaModeBtn(now = performance.now()) {
    if (!plasmaModeBtn) return;
    const show = arcadeActive || practiceEndless || stuntActive;
    if (!show) {
      if (_plasmaModeBtnSig !== "hide") {
        _plasmaModeBtnSig = "hide";
        plasmaModeBtn.style.display = "none";
      }
      return;
    }
    plasmaModeBtn.style.display = "inline-flex";
    const manual = plasmaCage.mode === "manual";
    const placed = !!plasmaCage.placed;
    const charging = !placed && !plasmaCage.active && plasmaCage.cooldownUntil > now;
    const state = placed ? "detonate" : charging ? "charging" : (plasmaCage.active ? "arming" : "ready");
    const cooldownTotal = Math.max(1, (plasmaCage.cooldownUntil || now) - (plasmaCage.cooldownStart || now));
    const fill = placed
      ? 1
      : charging
        ? clamp((now - plasmaCage.cooldownStart) / cooldownTotal, 0, 1)
        : (plasmaCage.active ? 0.22 : 0.92);
    const fillAlpha = placed
      ? 0.14
      : charging
        ? 0.24 + fill * 0.46
        : (plasmaCage.active ? 0.16 : 0.72);
    const coreScale = placed
      ? 1.02
      : charging
        ? Math.max(0.52, 0.22 + fill * 0.86)
        : (plasmaCage.active ? 0.14 : 1);
    const coreOpacity = placed
      ? 1
      : charging
        ? Math.max(0.45, 0.28 + fill * 0.64)
        : (plasmaCage.active ? 0.18 : 0.98);
    const particleOpacity = placed
      ? 0.34
      : charging
        ? 0.08 + fill * 0.26
        : (plasmaCage.active ? 0.04 : 0.24);
    const coreLeft = placed || !charging
      ? 86
      : Math.max(16, Math.min(86, 16 + fill * 70));
    const sig = [state, manual ? "manual" : "auto", Math.round(fill * 100)].join("|");
    if (sig !== _plasmaModeBtnSig) {
      _plasmaModeBtnSig = sig;
      const label = plasmaModeBtn.querySelector(".plasmaModeBtn__label");
      if (label) label.textContent = placed ? "DETONATE" : manual ? "NET • MANUAL" : "NET • AUTO";
      else plasmaModeBtn.textContent = placed ? "DETONATE" : manual ? "NET • MANUAL" : "NET • AUTO";
      plasmaModeBtn.dataset.state = state;
      plasmaModeBtn.dataset.mode = manual ? "manual" : "auto";
      plasmaModeBtn.setAttribute(
        "aria-label",
        placed
          ? "Detonate placed plasma net"
          : manual
            ? "Plasma net mode: manual"
            : "Plasma net mode: auto",
      );
    }
    plasmaModeBtn.style.setProperty("--plasma-fill", `${(fill * 100).toFixed(1)}%`);
    plasmaModeBtn.style.setProperty("--plasma-fill-alpha", fillAlpha.toFixed(3));
    plasmaModeBtn.style.setProperty("--plasma-core-left", `${coreLeft.toFixed(1)}%`);
    plasmaModeBtn.style.setProperty("--plasma-arc-rotate", `${Math.round(fill * 360)}deg`);
    plasmaModeBtn.style.setProperty("--plasma-core-scale", coreScale.toFixed(3));
    plasmaModeBtn.style.setProperty("--plasma-core-opacity", coreOpacity.toFixed(3));
    plasmaModeBtn.style.setProperty("--plasma-particle-opacity", particleOpacity.toFixed(3));
  }

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
    // 2026-07-03: Manual/Auto firing mode. AUTO (default) = release fires immediately. MANUAL = a
    // charged release LEAVES the net placed on the field until the cadet taps it (or the DETONATE
    // button). `mode` persists across levels; `placed` is the pending manual net (cleared per level).
    mode: "auto",
    placed: null,
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
    shockwaves: [],
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
    // eslint-disable-next-line no-unreachable -- intentional kill-switch above
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
    // 2026-06-27: L4 DEBRIS RUN ambient debris — cutout sprites from prototypes/space debris/cutout.
    debris: "astgfx/debris_silver.png",
    debris_ice: "astgfx/debris_ice.png",
    debris_redhot: "astgfx/debris_redhot.png",
  };
  const asteroidSprites = {};
  Object.keys(asteroidSpritePaths).forEach((key) => {
    const img = new Image();
    img.decoding = "async";
    img.src = asteroidSpritePaths[key];
    asteroidSprites[key] = img;
  });

  // 2026-06-23: code-generated asteroid skins instead of painted assets — a tritone luminance
  // gradient map over roid01 (shadow -> mid -> highlight stops). Built once into an offscreen canvas,
  // then baked to an Image so the renderer's .complete/.naturalWidth checks and the asteroidSprites
  // lookup all work unchanged (PIXI on iOS-native builds its texture from the same Image, which is why
  // this approach renders everywhere — unlike the 2D multiply tint). If roid01 isn't decoded yet we
  // defer to its load; if the canvas reads back tainted we bail and the level falls back to the normal
  // sprite. Tweak the three ramp stops per skin to retune the colors.
  // 2026-06-24: generalized from the single L14 "roidneon" builder so new tinted variants (L3 Blue
  // Moon, L8 ice, L12 purple/grey) reuse the exact same fantastic-looking method.
  function buildTintedAsteroidSprite(outKey, shadow, mid, hi, baseKey = "roid01") {
    const base = asteroidSprites[baseKey] || asteroidSprites.roid01;
    if (!base || !base.complete || !base.naturalWidth) return false;
    const w = base.naturalWidth;
    const h = base.naturalHeight;
    const cv = document.createElement("canvas");
    cv.width = w;
    cv.height = h;
    const c = cv.getContext("2d");
    if (!c) return false;
    c.drawImage(base, 0, 0);
    let data;
    try { data = c.getImageData(0, 0, w, h); } catch { return false; } // tainted-canvas guard
    const px = data.data;
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] === 0) continue; // keep fully-transparent pixels (silhouette + AA edges intact)
      const L = (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) / 255;
      let a0; let a1; let t;
      if (L < 0.5) { a0 = shadow; a1 = mid; t = L / 0.5; }
      else { a0 = mid; a1 = hi; t = (L - 0.5) / 0.5; }
      px[i] = a0[0] + (a1[0] - a0[0]) * t;
      px[i + 1] = a0[1] + (a1[1] - a0[1]) * t;
      px[i + 2] = a0[2] + (a1[2] - a0[2]) * t;
    }
    c.putImageData(data, 0, 0);
    const out = new Image();
    out.src = cv.toDataURL("image/png");
    asteroidSprites[outKey] = out;
    return true;
  }
  function buildGeneratedAsteroidSprites() {
    const base = asteroidSprites.roid01;
    if (!base || !base.complete || !base.naturalWidth) return false;
    const base03 = asteroidSprites.roid03;
    const base03Ready = base03 && base03.complete && base03.naturalWidth;
    // L14 neon: faint-violet shadows -> neon green mids -> purple highlights (the original look).
    buildTintedAsteroidSprite("roidneon", [4, 0, 10], [57, 255, 20], [168, 70, 255]);
    // 2026-06-24: skins punched up — these were reading as "just tinted silver" on device. The
    // mids now carry full saturation so each level's rocks look like a different MATERIAL, not a
    // recolored silver (the L14 neon look). Shadows stay deep, highlights stay near-white for rim.
    // L3 "Blue Moon": deep navy shadows -> vivid electric blue mids -> icy white highlights.
    buildTintedAsteroidSprite("roidbluemoon", [3, 10, 38], [28, 96, 235], [188, 222, 255]);
    // L8 "DEEP FREEZE": baked on roid03 (this level's rock sprite, not roid01) — deep teal-ice
    // shadows -> bright cyan-ice mids -> icy white (kicks in mid-level, 18s).
    buildTintedAsteroidSprite("roidice", [4, 28, 64], [40, 196, 230], [226, 250, 255], "roid03");
    // L12 "MAKE IT BOOM": deep purple shadows -> vivid magenta-purple mids -> pale lilac highlights.
    buildTintedAsteroidSprite("roidpurplegrey", [26, 4, 52], [168, 56, 214], [236, 214, 248]);
    return base03Ready; // false until roid03 is decoded too, so the ice bake re-runs on its load
  }
  if (!buildGeneratedAsteroidSprites()) {
    asteroidSprites.roid01.addEventListener("load", buildGeneratedAsteroidSprites, { once: true });
    asteroidSprites.roid03?.addEventListener("load", buildGeneratedAsteroidSprites, { once: true });
  }

  // 2026-06-10: powerup sprites (256px source, transparent bg, baked-in glow) — drawn ~56px.
  // 2026-06-26: bomb now uses a framed sprite too; the canvas-drawn ring + 💣 glyph remains
  // only as the decode-frames fallback in drawPowerups.
  const POWERUP_SPRITE_SIZE = 56;
  const powerupSpritePaths = {
    goldbars: "powerups/powerup_goldbars.png",
    quadshot: "powerups/powerup_quadshot.png",
    timer: "powerups/powerup_timer.png",
    snowflake: "powerups/powerup_freeze.png",
    missile: "powerups/powerup_missile.png",
    bomb: "powerups/powerup_bomb.png", // 2026-06-26: framed bomb sprite (was canvas-drawn 💣)
    pulse: "powerups/powerup_pulse.png", // 2026-07-01: Pulse Cannon timed rapid-fire weapon
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
  // 2026-06-24: handles for the YOU-WIN celebration timers (explosion barrage + fade) so they can be
  // cancelled if the loop is torn down mid-sequence (navigate away / new game) instead of firing
  // spawnExplosion/sfx against a dead state.
  let _winSeqTimers = [];
  let engineMode = "menu"; // menu | practice | arcade
  let worldLockEnabled = false;
  let worldLockWidth = 0;
  let worldLockHeight = 0;
  let overlayTimer = null;
  let levelTitleTimer = null; // 2026-06-22: bottom-screen level-title hold/fade timer
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
  // 2026-06-22: minimum on-screen time per caption. Guards against a short/force-advanced line
  // (e.g. an audio load failure that advances instantly) being overwritten by the next line
  // before it can be read — the "show you the ropes" line was vanishing this way.
  const SPC_MIN_CAPTION_MS = 900;
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
  // 2026-06-21: bombInventory phase — a tutorial-placed bomb must NOT auto-arm/auto-detonate.
  // It stays "spawned" until the cadet taps it to arm it, so the "TAP THE BOMB TO ARM IT" step
  // can't strand the player in purgatory waiting for a player_armed that auto-detonation skipped.
  let tutorialPlacedBombNoAutoArm = false;
  // 2026-07-02: freeze phase → freeze_toss step. While set, the freeze bank does NOT time-drain,
  // so the freeze the cadet activates in the freeze step survives the VO + field-clear + step
  // transition and stays active through the frozen toss (no forced re-acquire). Cleared once the
  // toss lands (freeze_toss explicitly ends the freeze) and in cleanupTutorial.
  let tutorialHoldFreeze = false;
  let tutorialPaused = false;          // pause menu / app-switch
  let tutorialTimerRunning = false;    // intro: perimeter visibly counts down until timer powerup
  let tutorialTimerStartedAt = 0;
  // Stunt → Practice: endless arcade gameplay (no timer, no level-complete, score not submitted).
  const PRACTICE_ASTEROID_SPRITE_KEYS = ["roid01", "roid02", "roid03", "hotroid01"];
  const PRACTICE_ASTEROID_UNLOCK_MS = 25000;
  // 2026-06-22 (19:21 notes #6): backgrounds cycle a little faster (was 30s) and now crossfade
  // (setTheme dissolve flag). PRACTICE_PERIMETER_HUE_PERIOD_MS is a continuous hue sweep for the
  // perimeter line in endless Practice — "almost as fast" as the bg cadence so the border drifts
  // through colors alongside the changing backgrounds.
  const PRACTICE_THEME_INTERVAL_MS = 18000;
  const PRACTICE_PERIMETER_HUE_PERIOD_MS = 16000;
  // 2026-07-03: quicker cadence in Practice so the cadet can actually stock an inventory to play with.
  const PRACTICE_POWERUP_INTERVAL_MS = 5000;
  // 2026-07-03: Practice guarantees a Pulse Cannon early (first drop ~12s) and keeps re-offering it on
  // this cadence for the endless run — the level-based force-spawn only fires once, which isn't enough
  // for an open-ended practice session.
  const PRACTICE_PULSE_FIRST_MS = 12000;
  const PRACTICE_PULSE_INTERVAL_MS = 40000;
  // 2026-07-02: widened for variety so Practice no longer skews toward quad shots — one entry per
  // powerup type (quad now ~1/7 instead of 1/5), with an extra bomb/freeze so the staples still
  // recur. Bomb-full and missile-busy rolls are skipped at spawn time (see the spawn block).
  const PRACTICE_POWERUP_POOL = ["bomb", "bomb", "missile", "snowflake", "goldbars", "pulse", "quadshot"];
  let practiceEndless = false;
  let practiceStartedAt = 0;
  let nextPracticeMineAt = 0; // Part 8: practice drops a fresh landmine on this 60s cadence
  let nextPracticePulseAt = 0; // 2026-07-03: practice guarantees + re-offers the Pulse Cannon
  // Practice background theme cycling: blend to the next level's color theme every 30s.
  let practiceThemeIndex = 1; // starts on the L1 theme; cycles 1→2→…→15→1
  let nextThemeCycleAt = 0;
  // SPC_xx.mp3 audio is recorded later; until a key is listed here, the line is text-only.
  // 2026-06-17: SPC VO is recorded — register every vo/SPC_*.mp3 (key = filename minus the
  // SPC_ prefix and .mp3 suffix, e.g. SPC_08-09.mp3 → "08-09"). spcVoSrc() plays vo/SPC_<key>.mp3.
  const SPC_VO_AVAILABLE = new Set([
    "01", "02", "03-04", "05-06a", "06b", "07", "08", "08b", "08c", "12", "13-14", "15-16", "15-16_release", "17", "17b", "18", "19",
    "one_of_our_most_useful_weapons_plasma_net", "to_fire_a_plasma_net_tap_and_drag",
    // 2026-07-01: Pulse Cannon training step (final weapon taught before the outro).
    "one_more_thing_i_want_to_show_you", "the_pulse_cannon_is",
    "tap_and_drag_to_fire_the_pulse_cannon_light_em_up",
    "20", "21", "22", "23", "24", "25", "26", "27", "28-30", "28-30_part2", "31", "32", "33",
    "34", "35", "36", "35-36", "37", "38", "39", "40", "41", "42-43", "44-45", "46", "47", "48", "49",
    // 2026-06-23: standalone "52" OMITTED on purpose — vo/SPC_52.mp3 is a mislabeled recording
    // that actually says "Tap the bomb icon on your HUD", not "tap it to arm it". The arm step
    // (bombInventory Step 3) requests "52" but now falls back to its text caption only. mp3 left
    // in vo/ for reference; supply a correct recording and re-add "52" here to restore the voice.
    "50", "51", "50-51", "53", "54", "54_alt", "52-54", "55-56", "57", "58", "59", "60", "59-60", "61", "62",
    "thats_the_quad_shot_pick_it_up", "but_to_detonate_it_yourself_just_tap_it_again",
    "tap_the_bomb_icon_hud",
    "bomb_now_tap_the_screen_where_you_want_to_place_it",
    // 2026-06-22: corrected single-purpose recordings (drop the matching vo/SPC_*.mp3 in to enable).
    "blast_those_stroids_with_the_quad_shot", "tap_freeze_on_hud_to_activate_it", "pick_up_the_missile_cadet",
    "now_swipe_to_toss_the_stroid",
    // 2026-06-24: dedicated bomb arm/detonate recordings (placed-bomb steps).
    "Tap_the_bomb_to_arm_it", "tap_the_bomb_again_to_detonate_it",
    "62_part1", "63", "63b", "63b_part1", "63b_part2", "64", "65", "66", "67", "68", "69", "70",
    "amazing", "boom_like_that", "crushing_it", "freeze_toggle", "grab_small", "lets_get_after_it",
    "not_doing_hot", "peeing_pants", "show_boss", "there_you_go", "timer_warning",
    // 2026-06-24: BONUS_006 & BONUS_039 removed — those recordings were renamed to
    // SPC_Ayyee.mp3 / SPC_put_some_effort_into_it.mp3 and wired as gameplay bonus lines.
    "BONUS_001", "BONUS_002", "BONUS_003", "BONUS_011", "BONUS_012", "BONUS_016",
    "BONUS_057", "BONUS_063", "BONUS_066", "BONUS_075",
  ]);
  let currentLevelIndex = 0;
  let _levelPrimaryColor = "#00FFD1";
  let levelEndsAt = 0;
  let levelDurationMs = 0;
  let levelRunStartAt = 0;
  // 2026-06-22: hold any forced level-start powerup spawn for a few seconds so the
  // player gets their bearings before the missile pickup appears.
  const LEVEL_START_SPAWN_DELAY_MS = 5000;
  let arcadePausedUntil = 0;
  let nextSpawnAt = Infinity;
  let nextDebrisAt = Infinity; // 2026-06-23: L4 ambient debris-field spawn clock (cfg.debrisField)
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
  // 2026-06-26: POLYSLOTS economy — goldbar pickups silently bank tokens during a level;
  // the between-level slot reveals the banked total as its token count. Use-it-or-lose-it: any
  // leftover is discarded when the slot is left (see slotMachine glue). Reset on a fresh game.
  let slotTokens = 0;
  // ── POLYSLOTS lifecycle (step 1) ───────────────────────────────────────────────────────────
  // The between-level slot is a small MODAL GAME STATE that OWNS the scorecard→startLevel window —
  // not just an overlay. Existing handlers (the visibilitychange listeners, stopAndMenu, the
  // gameplay loop) branch on isSlotActive() so the rest of the game defers to the slot while it's
  // up. That ownership is what structurally prevents VO bleed, loops under menus, and resume limbo.
  //   idle → entering → ready → spinning → resolving → exiting → disposed
  //   idle     = never entered / clean rest state (re-armable)
  //   entering = overlay mounting / token reveal animating in
  //   ready    = sitting on the slot screen, awaiting a spin
  //   spinning = reels in motion
  //   resolving= reels stopped, payout being applied (atomic spend+credit — step 5)
  //   exiting  = animating out, about to hand control back via startLevel()
  //   disposed = torn down; nothing slot-owned is live. The next entry resets to entering.
  const SLOT_STATE = Object.freeze({
    IDLE: "idle",
    ENTERING: "entering",
    READY: "ready",
    SPINNING: "spinning",
    RESOLVING: "resolving",
    EXITING: "exiting",
    DISPOSED: "disposed",
  });
  let slotState = SLOT_STATE.IDLE;
  // The slot uses NO named looping SFX (faithful to the prototype: the pull sound is a single
  // one-shot covering the whole spin, stored as a HANDLE in slotLoopHandles and stopped when the
  // reels land / on teardown). Kept as an (empty) name list so the teardown's stopLoop() pass and
  // the audio-desync guard stay in place for anything added later.
  const SLOT_LOOP_NAMES = [];
  // Canonical teardown reasons. Pass slotTeardown() one of THESE constants, never a bare string —
  // a typo'd constant is a ReferenceError, whereas a typo'd string ("exit"/"done") would silently
  // miss the discard allowlist and strand a player's tokens. Note: there is deliberately no
  // BACKGROUND reason — backgrounding is a pause/snapshot (step 4), not a teardown.
  const SLOT_REASON = Object.freeze({
    MENU: "menu",         // user backed out to the menu
    NEW_GAME: "newgame",  // fresh-game reset
    SLOT_EXIT: "slot-exit", // normal end of a slot session (step 3+)
  });
  // Token-discard policy (use-it-or-lose-it): only a REAL exit zeroes unused tokens, and only the
  // reasons listed here. Explicit allowlist, not "everything except background" — teardown is
  // disposal, and backgrounding is NOT a teardown (separate pause/snapshot path in step 4, so it
  // must never reach slotTeardown). Unknown/unlisted reasons preserve the bank: a forgotten-to-list
  // exit leaks tokens (recoverable) rather than silently nuking them (not).
  const SLOT_TOKEN_DISCARD_REASONS = new Set([
    SLOT_REASON.MENU, SLOT_REASON.NEW_GAME, SLOT_REASON.SLOT_EXIT,
  ]);
  // Teardown bookkeeping. Every slot timer / rAF / listener / loop-handle MUST be registered via the
  // slotTrack* helpers below so slotTeardown() can guarantee a single, complete, idempotent cleanup —
  // the same one-way discipline the scorecard (showLevelScoreReport) proved out.
  const slotTimers = new Set();      // setTimeout handles
  const slotListeners = [];          // { target, type, handler, opts } for removeEventListener
  const slotLoopHandles = new Set(); // handles returned by audioEngine.playLoop(...) — see note below
  let slotRaf = 0;                   // single in-flight requestAnimationFrame handle
  let slotOverlay = null;            // DOM overlay root, mounted by enterSlot()
  // Live-shell state (step 3). enterSlot() owns the between-level window: it mounts the cabinet
  // overlay, shows the banked token count, locks input briefly, and hands control to startLevel()
  // on exit via slotOnExit. Reels/payouts/jackpot/visibility are deliberately NOT here yet.
  let slotOnExit = null;             // continue-to-next-level callback the slot now owns
  let slotInputLockedUntil = 0;      // anti-misclick: taps/exits ignored until this timestamp
  let slotContinueArmedAt = Infinity;// "TAP TO CONTINUE" only accepts taps after this timestamp
  let slotContinueShown = false;     // true once the continue overlay is up
  let slotPaused = false;            // true while backgrounded (step 4) — a PAUSE, never a teardown
  const slotEls = {};                // cached child refs of the mounted overlay
  // Reel engine (step 5a). Mechanics only: weighted strips, spin physics, lever, token-per-pull.
  // NO win evaluation / payouts / rewards / jackpot yet — those are 5b.
  let slotReels = [];                // per-reel { canvas, ctx, cw, ch, strip, len, pos, vel, state, ... }
  let slotRampHandle = null;         // slot_ramp spin loop handle (tracked via slotTrackLoop)
  let slotLastFrameAt = 0;           // dt clock for the rAF loop
  let slotLeverTravel = 140;         // knob travel px, recomputed from the track height (scale-correct)
  const slotLever = { value: 0, vel: 0, mode: "rest", grabOffset: 0, springTarget: 0 };
  const slotSprites = {};            // symbol id -> Image (loaded from slotart/)
  let _slotSpritesLoaded = false;
  let slotNukeOwned = 0;             // per-game nuke flag (jackpot cap); reset on a new game
  let slotPendingQuadShot = 0;       // quad wins are timed charges → applied at the next level start
  let slotMusicEl = null;            // legacy dedicated slot stream; kept for teardown safety
  let slotLevelMusicGainBefore = null;
  let slotLevelMusicHtmlVolBefore = null;

  // Single predicate the rest of the game branches on to detect slot ownership. Active == any live
  // state; idle/disposed == not active. Exposed on the controller API (see return block) so the
  // out-of-closure visibilitychange handlers can defer to the slot later too.
  function isSlotActive() {
    return slotState !== SLOT_STATE.IDLE && slotState !== SLOT_STATE.DISPOSED;
  }

  // Canonical registration helpers — future slot code MUST schedule through these (never raw
  // setTimeout / rAF / addEventListener) so teardown catches everything. Each auto-untracks on
  // natural completion so the bookkeeping sets don't grow unbounded.
  function slotTrackTimeout(fn, ms) {
    const id = setTimeout(() => { slotTimers.delete(id); fn(); }, ms);
    slotTimers.add(id);
    return id;
  }
  function slotTrackRaf(fn) {
    slotRaf = requestAnimationFrame((t) => { slotRaf = 0; fn(t); });
    return slotRaf;
  }
  function slotTrackListener(target, type, handler, opts) {
    target.addEventListener(type, handler, opts);
    slotListeners.push({ target, type, handler, opts });
  }
  // Loop SFX MUST be started through this so teardown can stop them by HANDLE, not just by name.
  // audioEngine.stopLoop(name) only stops WebAudio loops stored in audioEngine.loops; playLoop()
  // can fall back to playHtmlAudio(..., loop:true) (no ctx / not unlocked / buffer missing), and
  // that handle is NOT in audioEngine.loops — stopLoop(name) would never reach it. Pass the
  // playLoop(...) return value here: e.g. slotTrackLoop(audioEngine.playLoop("slot_ramp", {...})).
  function slotTrackLoop(handle) {
    if (handle) slotLoopHandles.add(handle);
    return handle;
  }

  // Idempotent, DEFENSIVE one-way teardown == EXIT/DISPOSE (menu, fresh game, normal slot exit).
  // NOT a pause: backgrounding must use the step-4 pause/snapshot path, never this. Safe to call
  // repeatedly and from any real exit. It ALWAYS drains runtime artifacts (loops, timers, rAF,
  // listeners, overlay) regardless of slotState — never trust the state flag to imply "nothing is
  // live", because a desync (e.g. global stopAllLoops fired but our handle is still tracked) is
  // exactly the bug we're guarding against. Parks state at DISPOSED and applies the token-discard
  // policy. Deliberately does NOT call startLevel() — transition ownership (step 3) is the caller's.
  function slotTeardown(reason = "unknown") {
    const wasActive = isSlotActive();
    // Stop loops both ways: by known name (WebAudio loops in audioEngine.loops) AND by tracked
    // handle (catches HTML-fallback loops that stopLoop(name) can't reach).
    for (let i = 0; i < SLOT_LOOP_NAMES.length; i += 1) {
      try { audioEngine.stopLoop(SLOT_LOOP_NAMES[i]); } catch { /* already silenced — ignore */ }
    }
    slotLoopHandles.forEach((h) => slotStopHandle(h));
    slotLoopHandles.clear();
    slotRampHandle = null;
    slotStopMusic(); // stop the streamed slot track (level music resumes via the next startLevel)
    slotTimers.forEach((id) => clearTimeout(id));
    slotTimers.clear();
    if (slotRaf) { cancelAnimationFrame(slotRaf); slotRaf = 0; }
    for (let i = 0; i < slotListeners.length; i += 1) {
      const { target, type, handler, opts } = slotListeners[i];
      try { target.removeEventListener(type, handler, opts); } catch { /* ignore */ }
    }
    slotListeners.length = 0;
    if (slotOverlay) {
      try { slotOverlay.remove(); } catch { /* ignore */ }
      slotOverlay = null;
    }
    galaxyView?.classList.remove("slot-active");
    // Reset live-shell state. slotOnExit is intentionally cleared here too — exitSlot() captures it
    // BEFORE calling teardown, so the handoff still fires; this just prevents a stale callback.
    slotOnExit = null;
    slotInputLockedUntil = 0;
    slotContinueArmedAt = Infinity;
    slotContinueShown = false;
    slotPaused = false;
    slotReels = [];
    slotLever.value = 0; slotLever.vel = 0; slotLever.mode = "rest"; slotLever.springTarget = 0;
    slotWinFx.active = false; slotWinFx.lineActive = false; slotWinFx.parts.length = 0; slotWinFx.lines = []; slotWinFx.frost = false; slotWinFx.ctx = null;
    if (slotWinFxResizeObs) { try { slotWinFxResizeObs.disconnect(); } catch { /* ignore */ } slotWinFxResizeObs = null; }
    for (const k in slotEls) delete slotEls[k];
    // Use-it-or-lose-it: discard unused tokens only on a listed real exit. Centralised here so
    // menu/normal exit can't forget; unlisted reasons preserve the bank (see SLOT_TOKEN_DISCARD_REASONS).
    if (SLOT_TOKEN_DISCARD_REASONS.has(reason)) slotTokens = 0;
    slotState = SLOT_STATE.DISPOSED;
    if (wasActive) lvlTrace(`[slot] teardown reason=${reason}`); // quiet when there was nothing live
  }

  // ── POLYSLOTS live shell (step 3) ──────────────────────────────────────────────────────────
  // Anti-misclick timings (from the prototype/SPEC §9): 600ms open lockout, SKIP after 2s, the
  // TAP-TO-CONTINUE overlay armed 500ms after it appears so the final lever-tap can't dismiss it.
  const SLOT_LOCKOUT_MS = 600;
  const SLOT_SKIP_DELAY_MS = 2000;
  const SLOT_CONTINUE_DELAY_MS = 500;
  const SLOT_FINAL_RESULT_HOLD_MS = 1000;
  const SLOT_EXIT_FADE_MS = 420; // brief "ENTERING NEXT LEVEL…" beat before handing to startLevel()
  // Frequency toggle. For now: open after every non-final level (the handoff seam only fires on the
  // non-final path anyway). Flip to false to skip the slot entirely; later this can become a cadence.
  const SLOT_OPEN_AFTER_EVERY_LEVEL = true;
  function shouldOpenSlot() {
    return SLOT_OPEN_AFTER_EVERY_LEVEL && slotTokens > 0;
  }

  // ── POLYSLOTS reel engine (step 5a) ────────────────────────────────────────────────────────
  // Ported from prototypes/slot-machine.html, but: rAF via slotTrackRaf (cancellable), reel-stop
  // scheduling via slotTrackTimeout, SFX via playGameSfx/slotTrackLoop, music via a streamed <audio>.
  // 5a is MECHANICS ONLY — no win evaluation, payouts, rewards, jackpot, or sprite art (text faces).
  const SLOT_SYMBOLS = ["jackpot", "quad", "missile", "bomb", "freeze", "goldbar", "wild", "alien", "blank"];
  // 2026-06-30: bumped the four weapon symbols 9 → 12 so weapon-powerup triples land noticeably
  // more often (a weapon triple is ~2.4× more likely per payline). Tune-able single constant.
  const SLOT_STRIP_WEIGHTS = { blank: 5, goldbar: 3, freeze: 12, bomb: 12, quad: 12, missile: 12, wild: 3, alien: 2, jackpot: 1 };
  const SLOT_SYM_LABEL = { jackpot: "ORB", quad: "QUAD", missile: "MSL", bomb: "BOMB", freeze: "FRZ", goldbar: "GOLD", wild: "WILD", alien: "ALN", blank: "·" };
  const SLOT_SYM_COLOR = { jackpot: "#aa78ff", quad: "#be6eff", missile: "#ff5050", bomb: "#ffaa3c", freeze: "#6ec8ff", goldbar: "#ffcd5a", wild: "#5ae6d2", alien: "#78eb78", blank: "#506e96" };
  const SLOT_SPIN_SPEED = isIOSNative ? 19 : 16;
  const SLOT_SPIN_TIME_MS = isIOSNative ? 1900 : 2600;
  const SLOT_REEL_STAGGER_MS = isIOSNative ? 260 : 380;
  const SLOT_STOP_MIN_TRAVEL = 6, SLOT_STOP_DUR = 1.0;
  const SLOT_LEVER_COMMIT = 0.18, SLOT_LEVER_STIFF = 120, SLOT_LEVER_DAMP = 9;
  const SLOT_BOUNCE_IMPULSE = 0.16, SLOT_BOUNCE_K = 200, SLOT_BOUNCE_DAMP = 16;
  const SLOT_DPR = isIOSNative ? 1 : Math.min(window.devicePixelRatio || 1, 2);
  // Slot mode now keeps level music running underneath, ducked by slotDuckLevelMusic().

  function ensureSlotSprites() {
    if (_slotSpritesLoaded) return;
    _slotSpritesLoaded = true;
    for (const id of SLOT_SYMBOLS) {
      const im = new Image();
      im.decoding = "async";
      im.onload = () => {
        slotInvalidateSymbolAtlas();
        if (slotReels.length) slotQueueSpriteRefresh();
      };
      im.onerror = () => {
        slotInvalidateSymbolAtlas();
      };
      im.src = "slotart/" + id + ".png";
      slotSprites[id] = im;
    }
  }
  let _slotCabinetArt = null;
  let _slotCabinetArtPromise = null;
  function ensureSlotCabinetArt() {
    if (_slotCabinetArtPromise) return _slotCabinetArtPromise;
    _slotCabinetArt = _slotCabinetArt || new Image();
    _slotCabinetArt.decoding = "async";
    _slotCabinetArt.src = "slotart/cabinet.png";
    _slotCabinetArtPromise = warmImageSet({ cabinet: _slotCabinetArt })
      .then(() => _slotCabinetArt)
      .catch(() => _slotCabinetArt);
    return _slotCabinetArtPromise;
  }
  const slotSymbolTileAtlas = { size: 0, tiles: null };
  let _slotSpriteRefreshQueued = false;
  function slotInvalidateSymbolAtlas() {
    slotSymbolTileAtlas.size = 0;
    slotSymbolTileAtlas.tiles = null;
  }
  function slotQueueSpriteRefresh() {
    if (_slotSpriteRefreshQueued) return;
    _slotSpriteRefreshQueued = true;
    requestAnimationFrame(() => {
      _slotSpriteRefreshQueued = false;
      if (slotReels.length) slotSizeReels();
    });
  }
  function slotRenderSymbolTile(id, sz) {
    const tile = typeof OffscreenCanvas === "function" ? new OffscreenCanvas(sz, sz) : document.createElement("canvas");
    tile.width = sz;
    tile.height = sz;
    const cacheCtx = tile.getContext("2d");
    if (!cacheCtx) return tile;
    const glow = SLOT_SYM_COLOR[id];
    if (glow) {
      cacheCtx.save();
      cacheCtx.globalAlpha = 0.22;
      cacheCtx.fillStyle = glow;
      cacheCtx.beginPath();
      cacheCtx.arc(sz / 2, sz / 2, sz * 0.5, 0, Math.PI * 2);
      cacheCtx.fill();
      cacheCtx.restore();
    }
    const img = slotSprites[id];
    if (img && img.complete && img.naturalWidth) {
      cacheCtx.drawImage(img, 0, 0, sz, sz);
    } else {
      cacheCtx.fillStyle = SLOT_SYM_COLOR[id] || "#9fb";
      cacheCtx.font = `700 ${Math.round(sz * 0.24)}px ui-monospace,monospace`;
      cacheCtx.textAlign = "center";
      cacheCtx.textBaseline = "middle";
      cacheCtx.fillText(SLOT_SYM_LABEL[id] || id, sz / 2, sz / 2);
    }
    return tile;
  }
  function slotBuildSymbolTileAtlas(sz) {
    const size = Math.max(1, Math.round(sz));
    if (slotSymbolTileAtlas.size === size && slotSymbolTileAtlas.tiles) return slotSymbolTileAtlas;
    const tiles = {};
    for (const id of SLOT_SYMBOLS) tiles[id] = slotRenderSymbolTile(id, size);
    slotSymbolTileAtlas.size = size;
    slotSymbolTileAtlas.tiles = tiles;
    return slotSymbolTileAtlas;
  }
  function slotEstimateReelTileSize() {
    const vw = window.innerWidth || 0;
    const vh = window.innerHeight || 0;
    const panelW = vw >= 640 ? Math.min(vh * 0.43, vw * 0.9, 620) : Math.min(vw * 0.94, vh * 0.4, 420);
    const panelH = panelW * (1806 / 826);
    const reelsW = panelW * 0.6998;
    const reelsH = panelH * 0.3527;
    const reelW = (reelsW - 16) / 3; // padding + two gaps
    const reelH = reelsH - 8;
    return Math.max(1, Math.round(Math.min(reelH * 0.92, reelW * 0.92)));
  }
  function slotShuffle(a) {
    for (let i = a.length - 1; i > 0; i -= 1) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function slotBuildStrip(exclude) {
    const arr = [];
    for (const id in SLOT_STRIP_WEIGHTS) {
      const c = (exclude && exclude.has(id)) ? 0 : SLOT_STRIP_WEIGHTS[id];
      for (let i = 0; i < c; i += 1) arr.push(id);
    }
    return slotShuffle(arr);
  }
  function slotMakeReels() {
    slotReels = (slotEls.reelCanvas || []).map((canvas, i) => {
      const strip = slotBuildStrip();
      return {
        canvas, ctx: canvas.getContext("2d"), cw: 0, ch: 0,
        strip, len: strip.length, pos: i + strip.length, vel: 0,
        bounce: 0, bounceVel: 0, state: "idle", target: 0,
        stopFrom: 0, stopFinal: 0, stopV0: 0, stopT0: 0,
        symCache: null, symSize: 0,
      };
    });
    slotSizeReels();
  }
  function slotSizeReels() {
    for (const r of slotReels) {
      const w = r.canvas.clientWidth, h = r.canvas.clientHeight;
      r.cw = w; r.ch = h;
      r.canvas.width = Math.round(w * SLOT_DPR);
      r.canvas.height = Math.round(h * SLOT_DPR);
      r.ctx.setTransform(SLOT_DPR, 0, 0, SLOT_DPR, 0, 0);
      const rowH = r.ch / 3;
      const sz = Math.max(1, Math.round(Math.min(rowH * 0.92, r.cw * 0.92)));
      const atlas = slotSymbolTileAtlas.tiles ? slotSymbolTileAtlas : slotBuildSymbolTileAtlas(sz);
      r.symSize = sz;
      r.symCache = atlas.tiles;
      slotDrawReel(r);
    }
    slotSizeWinFx();
    // Recompute the lever travel from the actual track height so the knob scales with the cabinet.
    if (slotEls.track && slotEls.knob) {
      slotLeverTravel = Math.max(40, slotEls.track.clientHeight - slotEls.knob.offsetHeight);
    }
  }
  // Sync the win-FX overlay canvas backing store to the reels container's CURRENT size. Called both
  // on layout changes AND right before a win (slotStartWinFX) — the cabinet is responsive (aspect-
  // ratio + vw/vh + safe-area), so a canvas sized once at open can go stale and make the streak
  // coordinates overflow toward the top-left origin. Keeping this in lockstep with the live reel
  // rects is what makes the payout streak land on the actual winning cells.
  function slotSizeWinFx() {
    if (!slotEls.winFx || !slotWinFx.ctx) return;
    const wr = slotEls.winFx.getBoundingClientRect();
    const fw = wr.width || slotEls.winFx.clientWidth, fh = wr.height || slotEls.winFx.clientHeight;
    if (!fw || !fh) return;
    slotWinFx.cw = fw; slotWinFx.ch = fh;
    slotEls.winFx.width = Math.round(fw * SLOT_DPR); slotEls.winFx.height = Math.round(fh * SLOT_DPR);
    slotWinFx.ctx.setTransform(SLOT_DPR, 0, 0, SLOT_DPR, 0, 0);
  }
  function slotDrawReel(r) {
    const ctx = r.ctx, mid = r.ch / 2, cx = r.cw / 2, len = r.len, rowH = r.ch / 3;
    if (!len || !r.cw) return;
    ctx.clearRect(0, 0, r.cw, r.ch);
    const rp = r.pos + r.bounce, base = Math.round(rp);
    const sz = r.symSize || Math.min(rowH * 0.92, r.cw * 0.92);
    for (let k = -2; k <= 2; k += 1) {
      const a = base + k, id = r.strip[((a % len) + len) % len], y = mid + (rp - a) * rowH;
      if (y < -rowH || y > r.ch + rowH) continue;
      const cached = r.symCache?.[id];
      if (cached) {
        ctx.drawImage(cached, cx - sz / 2, y - sz / 2, sz, sz);
      } else {
        const img = slotSprites[id];
        if (img && img.complete && img.naturalWidth) {
          ctx.drawImage(img, cx - sz / 2, y - sz / 2, sz, sz);
        } else {
          // fallback until the sprite decodes: coloured label
          ctx.fillStyle = SLOT_SYM_COLOR[id] || "#9fb";
          ctx.font = `700 ${Math.round(sz * 0.24)}px ui-monospace,monospace`;
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(SLOT_SYM_LABEL[id] || id, cx, y);
        }
      }
    }
  }
  function slotPrimeReelCaches() {
    try { slotBuildSymbolTileAtlas(slotEstimateReelTileSize()); } catch { /* ignore */ }
  }

  function slotLeverEnabled() {
    return slotTokens > 0 && slotState === SLOT_STATE.READY && performance.now() >= slotInputLockedUntil;
  }
  function slotReleaseLever() {
    if (slotLever.mode !== "drag") return;
    const committed = slotLever.value >= SLOT_LEVER_COMMIT;
    if (committed) {
      slotLever.mode = "autoPull";
      slotLever.springTarget = 1;
      // Start the spin on release instead of waiting for the lever spring to cross the threshold
      // on a later frame. That keeps the cabinet responsive even if the frame loop is briefly late.
      slotDoPull();
    } else {
      slotLever.mode = "recoil";
      slotLever.springTarget = 0;
    }
  }

  function slotStartSpin() {
    slotReels.forEach((r) => {
      r.pos = ((Math.round(r.pos) % r.len) + r.len) % r.len + r.len;
      r.vel = SLOT_SPIN_SPEED; r.state = "spinning";
    });
  }
  function slotCommandStop(r, targetIndex) {
    const start = r.pos, v0 = r.vel, len = r.len;
    const natural = v0 * SLOT_STOP_DUR / 2, minPos = start + Math.max(natural, SLOT_STOP_MIN_TRAVEL);
    let final = Math.ceil((minPos - targetIndex) / len) * len + targetIndex;
    if (final < minPos) final += len;
    r.stopFrom = start; r.stopFinal = final; r.stopV0 = v0; r.stopT0 = performance.now(); r.state = "stopping";
  }
  // audioEngine.play() returns {source,ended} (stop via source.stop()); playHtmlAudio()/playLoop()
  // return {stop()}. Cover both so a tracked slot sound is actually silenced.
  function slotStopHandle(h) {
    if (!h) return;
    try { h.stop?.(); } catch { /* ignore */ }
    try { h.source?.stop?.(); } catch { /* ignore */ }
  }
  function slotStopRamp() {
    const h = slotRampHandle;
    slotRampHandle = null;
    if (h) { slotStopHandle(h); slotLoopHandles.delete(h); }
  }
  // 2026-07-01: the lever pull used a full-viewport cssFlash (#screenFlashDiv, inset:0), which forced
  // a fullscreen compositor repaint over the animating reels every pull → a visible hitch. Swap it
  // for a localized glow pop on the reels frame — only the small slot region repaints, still exciting.
  let _slotLeverFlashTimer = null;
  function slotLeverFlash() {
    const el = slotEls.reels;
    if (!el) return;
    if (_slotLeverFlashTimer) clearTimeout(_slotLeverFlashTimer);
    el.style.transition = "none";
    el.style.boxShadow = "0 0 0 3px rgba(0,255,209,0.85), 0 0 26px rgba(0,255,209,0.6)";
    _slotLeverFlashTimer = setTimeout(() => {
      el.style.transition = "box-shadow 200ms ease-out";
      el.style.boxShadow = "";
      _slotLeverFlashTimer = null;
    }, 16);
  }
  function slotDoPull() {
    if (slotState !== SLOT_STATE.READY || slotTokens <= 0 || performance.now() < slotInputLockedUntil) return;
    const _slotPullT0 = DEBUG_SLOT_TIMING ? performance.now() : 0;
    slotTokens -= 1;
    if (slotEls.tokenCount) slotEls.tokenCount.textContent = String(slotTokens);
    // 2026-07-03 (iPad lever-hang fix): START THE REELS FIRST. Build strips, flip to SPINNING and
    // schedule the stops before anything else so the reels are already moving on THIS committing rAF
    // frame. The heavy non-visual work — forced reflow (tokens tick), the native Capacitor haptic
    // bridge, and the slot_pull audio decode/start — is deferred to after the first paint below; on
    // iPad that work stalled the commit frame so the reels visibly hung one frame before spinning.
    slotState = SLOT_STATE.SPINNING;
    // Capped powerups are pulled from the strip for this spin so their win literally can't appear.
    const ex = slotCappedExclusions();
    slotReels.forEach((r) => { r.strip = slotBuildStrip(ex); r.len = r.strip.length; r.target = (Math.random() * r.len) | 0; });
    slotStartSpin();
    // Paint the first moving frame immediately so the reels visibly move even if the next rAF is late.
    slotReels.forEach((r) => slotDrawReel(r));
    slotReels.forEach((r, i) => slotTrackTimeout(() => slotCommandStop(r, r.target), SLOT_SPIN_TIME_MS + i * SLOT_REEL_STAGGER_MS));
    // Cheap on-frame feedback so the glow + shake land with the spin-start.
    slotLeverFlash(); // 2026-07-01: localized glow instead of the full-screen cssFlash (see slotLeverFlash)
    cssShake(isIOSNative ? 0.45 : 0.75);
    setSlotHint("");
    slotEls.skip?.classList.remove("show");
    slotClearWinFx();
    slotEls.reels?.classList.remove("win");
    if (slotEls.result) { slotEls.result.className = "ps-result"; slotEls.result.innerHTML = ""; }
    if (DEBUG_SLOT_TIMING) console.log(`slotDoPull sync: ${(performance.now() - _slotPullT0).toFixed(1)}ms`);
    // Deferred until after the first moving paint: haptic bridge + audio start + forced reflow never
    // block the reels' first frame. Native iOS gets one extra frame because the bridge/audio startup
    // can still contend with the compositor on the pull commit.
    requestAnimationFrame(() => {
      if (slotState !== SLOT_STATE.SPINNING) return; // stopped / torn down before the defer fired
      const runFeedback = () => {
        if (slotState !== SLOT_STATE.SPINNING) return;
        if (slotEls.tokensBox) {
          slotEls.tokensBox.classList.remove("tick");
          if (!isIOSNative) void slotEls.tokensBox.offsetWidth;
          slotEls.tokensBox.classList.add("tick");
        }
        triggerGameplayHapticImpact(hapticImpactStyle.Heavy);
        playGameSfx("slot_clunk", 0.72);
        // Single pull+spin sound (prototype's official_level_pull_full), stored as a handle so it can be
        // stopped the instant all reels land. Tracked so teardown/background also stop it.
        slotRampHandle = slotTrackLoop(audioEngine.playLoop("slot_machine-ramp-and-spin", { volume: 0.28 }));
        playGameSfx("slot_pull", 0.9);
      };
      if (isIOSNative) requestAnimationFrame(runFeedback);
      else runFeedback();
    });
  }
  function slotOnAllStopped() {
    slotStopRamp();
    slotApplyOutcome(); // evaluate the 3x3 grid, award the best line + scatter (ported from prototype)
  }

  // ── Paytable / evaluation / win FX (ported verbatim from prototypes/slot-machine.html) ─────────
  const SLOT_PAYLINES = [{ n: "center", rows: [1, 1, 1] }, { n: "diag\\", rows: [0, 1, 2] }, { n: "diag/", rows: [2, 1, 0] }];
  const SLOT_NUKE_CAP = 1;
  const SLOT_POINTS = { jackpotOwned: 5000, wild3: 3000, jackpot2: 2500 };
  const SLOT_TOK = { goldbar3: 3, goldbar2: 1 };
  const SLOT_LINE_RANK = ["jackpot", "goldbar", "bomb", "missile", "quad", "freeze"];
  const SLOT_WIN_FX_DUR = 1350, SLOT_MAXP = 150;
  const SLOT_LINE_COL = { freeze: "150,225,255", bomb: "255,150,60", goldbar: "255,220,120", jackpot: "185,150,255", quad: "190,130,255", missile: "255,95,95", points: "40,255,150", _: "40,255,150" };
  const SLOT_PW_LABEL = { quad: "QUAD SHOT!", missile: "MISSILE +1", bomb: "BOMB +1", freeze: "FREEZE +1" };
  const SLOT_PW_SUB = { quad: "Active next level", missile: "Added to inventory", bomb: "Added to inventory", freeze: "Added to inventory" };
  // lines: one entry per winning payline ({ points, cells, type }) so every simultaneous win streaks
  // across its own cells. parts: shared particle pool. frost: any freeze line is present.
  const slotWinFx = { active: false, lines: [], parts: [], start: 0, lineStart: 0, lineActive: false, frost: false, cw: 0, ch: 0, ctx: null, dirty: false };
  let slotWinFxResizeObs = null; // keeps the overlay canvas synced across rotation / viewport / safe-area shifts

  function slotRoundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function slotDrawStar(ctx, x, y, r, col) {
    ctx.save(); ctx.translate(x, y); ctx.fillStyle = col; ctx.beginPath();
    for (let i = 0; i < 8; i += 1) { const a = i / 8 * 6.283, rr2 = i % 2 ? r * 0.4 : r; ctx.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2); }
    ctx.closePath(); ctx.fill(); ctx.restore();
  }
  function slotPushP(p) { if (slotWinFx.parts.length < SLOT_MAXP) slotWinFx.parts.push(p); }
  function slotClearWinFx() {
    slotWinFx.active = false; slotWinFx.lineActive = false; slotWinFx.parts.length = 0;
    slotWinFx.lines = []; slotWinFx.frost = false;
    if (slotWinFx.ctx) slotWinFx.ctx.clearRect(0, 0, slotWinFx.cw, slotWinFx.ch);
  }
  function slotLineType(prize) {
    return prize.kind === "jackpot" ? "jackpot" : prize.kind === "powerup" ? prize.sym : prize.kind === "tokens" ? "goldbar" : "points";
  }
  // 2026-07-01: streak now handles EVERY simultaneous winning line (center + diagonals), each tracing
  // its own payline so the flash lands on the actual winning cells — not a fixed corner. Resync the
  // overlay canvas first so its coordinate space matches the live reel rects (the top-left-collapse bug).
  function slotStartWinFX(wins) {
    if (!slotEls.reels || !wins || !wins.length) return;
    slotSizeWinFx();
    const rr = slotEls.reels.getBoundingClientRect();
    slotWinFx.lines = [];
    slotWinFx.frost = false;
    for (const win of wins) {
      // Only the columns that actually formed the win (res.idx) get the per-symbol GLOW + particles,
      // so non-matching corners don't pop; the STREAK still traces the full payline across all 3 cells.
      const idx = win.res?.idx || win.pl.rows.map((_, i) => i);
      const allPts = win.pl.rows.map((row, i) => {
        const rc = slotReels[i].canvas.getBoundingClientRect(); const rowH = rc.height / 3;
        return { x: rc.left - rr.left + rc.width / 2, y: rc.top - rr.top + (row * rowH + rowH / 2), half: Math.min(rc.width, rowH) / 2 };
      });
      const cellPts = allPts.filter((_, i) => idx.includes(i));
      const type = slotLineType(win.prize);
      if (type === "freeze") slotWinFx.frost = true;
      slotWinFx.lines.push({ points: allPts, cells: cellPts, type });
      slotSeedEffect(type, cellPts);
    }
    slotWinFx.lineStart = performance.now(); slotWinFx.start = slotWinFx.lineStart;
    slotWinFx.lineActive = true; slotWinFx.active = true;
  }
  function slotClipWinFx(ctx) {
    const inset = isIOSWebKit ? 2.5 : 1;
    slotRoundRect(ctx, inset, inset, Math.max(0, slotWinFx.cw - inset * 2), Math.max(0, slotWinFx.ch - inset * 2), 7);
    ctx.clip();
  }
  function slotSeedEffect(type, cells) {
    if (type === "jackpot") {
      const cx = slotWinFx.cw / 2, cy = slotWinFx.ch / 2, hue = [165, 185, 280, 300];
      for (let i = 0; i < 64; i += 1) { const a = Math.random() * 6.283, sp = 130 + Math.random() * 280;
        slotPushP({ t: "spark", x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: 0.8 + Math.random() * 0.8, size: 2 + Math.random() * 2, col: `hsl(${hue[i % 4]},100%,72%)`, grav: 50, drag: 1.5 }); }
    }
    for (const c of cells) {
      if (type === "freeze") for (let i = 0; i < 6; i += 1) slotPushP({ t: "mist", x: c.x + (Math.random() - 0.5) * c.half, y: c.y + c.half * 0.35, vx: (Math.random() - 0.5) * 16, vy: -14 - Math.random() * 18, life: 0, max: 1.1 + Math.random() * 0.8, size: c.half * 0.55, col: "185,235,255", grav: -5, drag: 0.5 });
      else if (type === "bomb") for (let i = 0; i < 11; i += 1) { const a = -1.57 + (Math.random() - 0.5) * 2.4, sp = 70 + Math.random() * 170;
        slotPushP({ t: "ember", x: c.x, y: c.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: 0.5 + Math.random() * 0.5, size: 1.5 + Math.random() * 2, col: `hsl(${18 + Math.random() * 32},100%,58%)`, grav: 260, drag: 1.1 }); }
      else if (type === "goldbar") for (let i = 0; i < 7; i += 1) slotPushP({ t: "gleam", x: c.x + (Math.random() - 0.5) * c.half, y: c.y + (Math.random() - 0.5) * c.half, vx: 0, vy: 0, life: 0, max: 0.6 + Math.random() * 0.6, size: 3 + Math.random() * 4, col: "255,225,120", grav: 0, drag: 0, delay: Math.random() * 0.55 });
      else for (let i = 0; i < 6; i += 1) { const a = Math.random() * 6.283, sp = 45 + Math.random() * 95;
        slotPushP({ t: "spark", x: c.x, y: c.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: 0.5 + Math.random() * 0.4, size: 1.5 + Math.random() * 1.5, col: "hsl(165,100%,72%)", grav: 35, drag: 1.4 }); }
    }
    if (cells.length > 1) { for (let i = 0; i <= 16; i += 1) slotSpawnLineP(type, slotPointOnPath(cells, i / 16)); }
  }
  function slotLineCol(type) { return SLOT_LINE_COL[type] || SLOT_LINE_COL._; }
  function slotPointOnPath(pts, f) {
    const segs = []; let total = 0;
    for (let i = 0; i < pts.length - 1; i += 1) { const L = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y); segs.push(L); total += L; }
    let d = f * total, acc = 0;
    for (let i = 0; i < pts.length - 1; i += 1) { if (acc + segs[i] >= d) { const t = (d - acc) / (segs[i] || 1); return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * t, y: pts[i].y + (pts[i + 1].y - pts[i].y) * t }; } acc += segs[i]; }
    return pts[pts.length - 1];
  }
  function slotSpawnLineP(type, pt) {
    if (type === "freeze") slotPushP({ t: "mist", x: pt.x, y: pt.y, vx: (Math.random() - 0.5) * 10, vy: -8 - Math.random() * 12, life: 0, max: 0.9 + Math.random() * 0.7, size: 14 + Math.random() * 10, col: "185,235,255", grav: -4, drag: 0.5 });
    else if (type === "bomb") slotPushP({ t: "ember", x: pt.x, y: pt.y, vx: (Math.random() - 0.5) * 40, vy: -18 - Math.random() * 40, life: 0, max: 0.45 + Math.random() * 0.4, size: 1.4 + Math.random() * 1.6, col: `hsl(${20 + Math.random() * 30},100%,60%)`, grav: 210, drag: 1.1 });
    else if (type === "goldbar") slotPushP({ t: "gleam", x: pt.x, y: pt.y, vx: 0, vy: 0, life: 0, max: 0.5 + Math.random() * 0.5, size: 2.5 + Math.random() * 3, col: "255,225,120", grav: 0, drag: 0, delay: Math.random() * 0.4 });
    else slotPushP({ t: "spark", x: pt.x, y: pt.y, vx: (Math.random() - 0.5) * 55, vy: (Math.random() - 0.5) * 55, life: 0, max: 0.4 + Math.random() * 0.4, size: 1.1 + Math.random() * 1.2, col: (SLOT_LINE_COL[type] || SLOT_LINE_COL._), grav: 20, drag: 1.4 });
  }
  function slotUpdateParticles(dt) {
    const ps = slotWinFx.parts;
    for (let i = ps.length - 1; i >= 0; i -= 1) { const p = ps[i];
      if (p.delay > 0) { p.delay -= dt; continue; }
      p.life += dt; if (p.life >= p.max) { ps.splice(i, 1); continue; }
      p.vx -= p.vx * p.drag * dt; p.vy -= p.vy * p.drag * dt; p.vy += p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt;
    }
  }
  function slotDrawParticles(ctx) {
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    for (const p of slotWinFx.parts) { if (p.delay > 0) continue; const k = 1 - p.life / p.max;
      if (p.t === "mist") { const r = p.size * (1.3 - 0.6 * k); const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r); g.addColorStop(0, `rgba(${p.col},${0.3 * k})`); g.addColorStop(1, `rgba(${p.col},0)`); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.283); ctx.fill(); }
      else if (p.t === "gleam") { slotDrawStar(ctx, p.x, p.y, p.size * (0.6 + 0.6 * Math.abs(Math.sin(p.life * 11))), `rgba(${p.col},${k})`); }
      else { ctx.globalAlpha = k; ctx.fillStyle = (typeof p.col === "string" && p.col[0] === "h") ? p.col : `rgba(${p.col},1)`; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 6.283); ctx.fill(); ctx.globalAlpha = 1; }
    }
    ctx.restore();
  }
  function slotTracePath(ctx, pts, reveal) {
    const segs = []; let total = 0;
    for (let i = 0; i < pts.length - 1; i += 1) { const L = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y); segs.push(L); total += L; }
    const target = reveal * total; ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); let acc = 0;
    for (let i = 0; i < pts.length - 1; i += 1) { const L = segs[i];
      if (acc + L <= target) { ctx.lineTo(pts[i + 1].x, pts[i + 1].y); acc += L; }
      else { const f = L ? (target - acc) / L : 0; ctx.lineTo(pts[i].x + (pts[i + 1].x - pts[i].x) * f, pts[i].y + (pts[i + 1].y - pts[i].y) * f); break; } }
  }
  function slotSampleWavy(pts, reveal, amp, freq, phase, n) {
    const segs = []; let total = 0;
    for (let i = 0; i < pts.length - 1; i += 1) { const L = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y); segs.push(L); total += L; }
    const out = [], target = reveal * total || 1;
    for (let s = 0; s <= n; s += 1) {
      const d = target * s / n; let acc = 0, si = 0;
      while (si < segs.length - 1 && acc + segs[si] < d) { acc += segs[si]; si += 1; }
      const L = segs[si] || 1, f = (d - acc) / L;
      const ax = pts[si].x, ay = pts[si].y, bx = pts[si + 1].x, by = pts[si + 1].y;
      let tx = bx - ax, ty = by - ay; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
      const taper = Math.sin((s / n) * Math.PI); const off = Math.sin(d * freq + phase) * amp * taper;
      out.push({ x: ax + (bx - ax) * f - ty * off, y: ay + (by - ay) * f + tx * off });
    }
    return out;
  }
  function slotStrokePts(ctx, a) { ctx.beginPath(); ctx.moveTo(a[0].x, a[0].y); for (let i = 1; i < a.length; i += 1) ctx.lineTo(a[i].x, a[i].y); }
  function slotDrawWinBand(now) {
    for (const line of slotWinFx.lines) slotDrawWinBandLine(now, line);
  }
  function slotDrawWinBandLine(now, line) {
    const ctx = slotWinFx.ctx, pts = line.points, t = now - slotWinFx.lineStart, col = slotLineCol(line.type);
    const attack = Math.min(1, t / 90), decay = Math.max(0, 1 - (t - 90) / 980), env = attack * decay; if (env <= 0) return;
    const flick = 0.72 + 0.28 * Math.sin(t / 47) * Math.sin(t / 19);
    const reveal = Math.min(1, t / 140);
    const baseHalf = line.cells.length ? line.cells[0].half : 24, half = baseHalf * (0.55 + 0.55 * env);
    ctx.save(); slotClipWinFx(ctx); ctx.globalCompositeOperation = "lighter"; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.shadowColor = `rgba(${col},${0.9 * env})`; ctx.shadowBlur = 30 * env;
    ctx.lineWidth = half * 2.1; ctx.strokeStyle = `rgba(${col},${0.15 * env})`;
    slotTracePath(ctx, pts, reveal); ctx.stroke();
    for (let L = 0; L < 3; L += 1) {
      const amp = half * (0.55 - L * 0.13), freq = 0.045 + L * 0.03, speed = 0.010 + L * 0.007;
      ctx.shadowBlur = (16 - L * 4) * env; ctx.lineWidth = half * (0.95 - L * 0.24);
      ctx.strokeStyle = `rgba(${col},${(0.32 - L * 0.07) * env * flick})`;
      slotStrokePts(ctx, slotSampleWavy(pts, reveal, amp, freq, t * speed + L * 1.9, 40)); ctx.stroke();
    }
    ctx.shadowBlur = 10 * env; ctx.lineWidth = Math.max(2, half * 0.30);
    ctx.strokeStyle = `rgba(255,255,255,${0.5 * env * flick})`;
    slotTracePath(ctx, pts, reveal); ctx.stroke();
    if (t < 160) { const a = 1 - t / 160; ctx.shadowColor = `rgba(${col},1)`; ctx.shadowBlur = 40;
      ctx.lineWidth = half * 2.6; ctx.strokeStyle = `rgba(255,255,255,${0.55 * a})`;
      slotTracePath(ctx, pts, 1); ctx.stroke(); }
    ctx.restore();
  }
  function slotDrawFX(now, dt) {
    const ctx = slotWinFx.ctx; if (!ctx) return;
    const tline = now - slotWinFx.lineStart, lineActive = slotWinFx.lineActive && tline < SLOT_WIN_FX_DUR, teff = now - slotWinFx.start;
    const glowActive = slotWinFx.lines.some((l) => l.cells.length) && teff < 1700, frostActive = slotWinFx.frost && teff < 1700, jackpotActive = slotWinFx.lines.some((l) => l.type === "jackpot") && teff < 1700;
    slotUpdateParticles(dt);
    if (!lineActive && !glowActive && !frostActive && !slotWinFx.parts.length) { if (slotWinFx.dirty) { ctx.clearRect(0, 0, slotWinFx.cw, slotWinFx.ch); slotWinFx.dirty = false; } slotWinFx.active = false; return; }
    ctx.clearRect(0, 0, slotWinFx.cw, slotWinFx.ch); slotWinFx.dirty = true;
    if (jackpotActive) { const a = Math.max(0, 1 - teff / 1700) * (0.5 + 0.5 * Math.abs(Math.sin(teff / 90))); const cx = slotWinFx.cw / 2, cy = slotWinFx.ch / 2, R = Math.max(slotWinFx.cw, slotWinFx.ch) * 0.85;
      ctx.save(); slotClipWinFx(ctx); ctx.globalCompositeOperation = "lighter"; const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
      g.addColorStop(0, `rgba(180,140,255,${0.5 * a})`); g.addColorStop(0.4, `rgba(0,255,209,${0.22 * a})`); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, slotWinFx.cw, slotWinFx.ch); ctx.restore(); }
    if (glowActive) { const a = Math.max(0, 1 - teff / 1700) * (0.6 + 0.4 * Math.abs(Math.sin(teff / 110)));
      ctx.save(); slotClipWinFx(ctx); ctx.globalCompositeOperation = "lighter";
      for (const line of slotWinFx.lines) {
        const col = line.type === "freeze" ? "150,225,255" : line.type === "bomb" ? "255,150,60" : line.type === "goldbar" ? "255,220,120" : line.type === "jackpot" ? "180,150,255" : "40,255,170";
        for (const c of line.cells) { const R = c.half * 1.5; const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, R); g.addColorStop(0, `rgba(${col},${0.5 * a})`); g.addColorStop(1, `rgba(${col},0)`); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c.x, c.y, R, 0, 6.283); ctx.fill(); }
      }
      ctx.restore(); }
    if (frostActive) { const a = Math.min(1, teff / 300) * Math.max(0, 1 - Math.max(0, teff - 1100) / 600);
      for (const line of slotWinFx.lines) { if (line.type !== "freeze") continue;
        for (const c of line.cells) { const s = c.half * 2 * 0.96; const g = ctx.createLinearGradient(c.x - c.half, c.y - c.half, c.x + c.half, c.y + c.half);
          g.addColorStop(0, `rgba(205,240,255,${0.30 * a})`); g.addColorStop(0.5, `rgba(140,205,255,${0.10 * a})`); g.addColorStop(1, `rgba(225,245,255,${0.32 * a})`);
          ctx.fillStyle = g; slotRoundRect(ctx, c.x - s / 2, c.y - s / 2, s, s, 8); ctx.fill(); } } }
    if (lineActive) slotDrawWinBand(now);
    slotDrawParticles(ctx);
  }

  // Grid read + line scoring (verbatim from the prototype; wild/scatter rules intact).
  function slotReadGrid() {
    return slotReels.map((r) => { const len = r.len, c = ((Math.round(r.pos) % len) + len) % len;
      return [r.strip[(c + 1) % len], r.strip[c], r.strip[(c - 1 + len) % len]]; });
  }
  function slotCappedExclusions() {
    const ex = new Set();
    if (playerBombInventory >= MAX_BOMB_INVENTORY) ex.add("bomb");
    if (playerMissileInventory >= MAX_MISSILE_INVENTORY) ex.add("missile");
    if (playerFreezeInventory >= MAX_FREEZE_INVENTORY) ex.add("freeze");
    return ex;
  }
  function slotEvalLine(syms) {
    if (syms.includes("alien")) return { kind: "none" };
    const wild = syms.filter((s) => s === "wild").length;
    const reals = syms.filter((s) => s !== "wild");
    if (reals.length === 0) return wild === 3 ? { kind: "triple", sym: "wild", idx: [0, 1, 2] } : { kind: "none" };
    const counts = {}; reals.forEach((s) => { counts[s] = (counts[s] || 0) + 1; });
    let best = null;
    for (const s in counts) {
      const eff = counts[s] + (s === "jackpot" ? 0 : wild);
      if (!best || eff > best.eff || (eff === best.eff && SLOT_LINE_RANK.indexOf(s) < SLOT_LINE_RANK.indexOf(best.sym))) best = { sym: s, eff };
    }
    // 2026-07-01: track WHICH columns actually formed the win (matching symbol + any wild that
    // counts toward it) so the win FX flashes only the winning symbols, not the whole payline —
    // a goldbar pair on a diagonal was lighting up the non-matching corner cell. (jackpot ignores
    // wilds, so a jackpot line only credits the real jackpot cells.)
    const contributes = (s) => s === best.sym || (s === "wild" && best.sym !== "jackpot");
    const idx = [];
    for (let i = 0; i < syms.length; i += 1) if (contributes(syms[i])) idx.push(i);
    if (best.eff >= 3) return { kind: "triple", sym: best.sym, idx };
    if (best.eff >= 2) return { kind: "pair", sym: best.sym, idx };
    return { kind: "none" };
  }
  function slotPrizeForLine(res) {
    if (res.kind === "triple") {
      switch (res.sym) {
        case "jackpot": return slotNukeOwned < SLOT_NUKE_CAP ? { kind: "jackpot" } : { kind: "points", value: SLOT_POINTS.jackpotOwned };
        case "quad": case "missile": case "bomb": case "freeze": return { kind: "powerup", sym: res.sym };
        case "goldbar": return { kind: "tokens", value: SLOT_TOK.goldbar3 };
        case "wild": return { kind: "points", value: SLOT_POINTS.wild3 };
        default: return { kind: "none" };
      }
    }
    if (res.kind === "pair") {
      switch (res.sym) {
        case "jackpot": return { kind: "points", value: SLOT_POINTS.jackpot2 };
        case "goldbar": return { kind: "tokens", value: SLOT_TOK.goldbar2 };
        // 2026-07-01: weapon PAIRS no longer pay — with weapon symbols dominating the strip a pair hit
        // almost every spin (the flat "+1000 every pull" problem). Only a weapon TRIPLE (→ the powerup)
        // rewards weapons now; pairs read as near-misses.
        default: return { kind: "none" };
      }
    }
    return { kind: "none" };
  }
  function slotEvaluate(grid) {
    const wins = [];
    for (const pl of SLOT_PAYLINES) {
      const syms = grid.map((col, ri) => col[pl.rows[ri]]);
      const res = slotEvalLine(syms), prize = slotPrizeForLine(res);
      if (prize.kind !== "none") wins.push({ pl, res, prize });
    }
    const extraLifeCells = [];
    for (let ci = 0; ci < grid.length; ci += 1) {
      if (grid[ci][1] === "alien") extraLifeCells.push(ci);
    }
    return { win: slotBestWin(wins), wins, extraLife: extraLifeCells.length > 0, extraLifeCells };
  }
  function slotBestWin(wins) {
    const rank = (w) => ({ jackpot: 4, powerup: 3, tokens: 2, points: 1 })[w.prize.kind] || 0;
    let best = null;
    for (const w of wins) { if (!best || rank(w) > rank(best) || (rank(w) === rank(best) && (w.prize.value || 0) > (best.prize.value || 0))) best = w; }
    return best;
  }

  function slotShowResult(cls, big, sub) {
    if (!slotEls.result) return;
    slotEls.result.className = "ps-result " + cls;
    slotEls.result.innerHTML = `<div class="ps-big">${big}</div><div class="ps-sub">${sub}</div>`;
  }
  function slotAwardPowerup(sym) {
    if (sym === "bomb") { playerBombInventory = Math.min(MAX_BOMB_INVENTORY, playerBombInventory + 1); updateHudBombInventory(); }
    else if (sym === "missile") { playerMissileInventory = Math.min(MAX_MISSILE_INVENTORY, playerMissileInventory + 1); updateHudMissileInventory(); }
    else if (sym === "freeze") { playerFreezeInventory = Math.min(MAX_FREEZE_INVENTORY, playerFreezeInventory + 1); updateHudFreezeInventory(); }
    else if (sym === "quad") {
      slotPendingQuadShot = Math.min(9, slotPendingQuadShot + 1); // timed charges — applied at the next level start
      playerMissileInventory = 0;
      missileAimMode = false;
      updateHudMissileInventory();
    }
    slotSyncCabinetStats();
    slotFlashRewardEl(slotEls.invSlots?.[sym]);
  }
  function slotJackpotPresent(extraLife) {
    slotState = SLOT_STATE.RESOLVING;
    playGameSfx("slot_jackpot", 1.0);
    playGameSfx("slot_bigwin", 0.7);
    slotNukeOwned = SLOT_NUKE_CAP;
    slotSyncCabinetStats();
    slotFlashRewardEl(slotEls.invSlots?.nuke);
    // TODO(nuke weapon): the real Nuke is net-new (see SPEC §7 ⚠). For now the jackpot awards a big
    // point bonus + full FX/sound; wire the actual weapon when it's built.
    if (slotEls.result) {
      slotEls.result.className = "ps-result jackpot";
      slotEls.result.innerHTML = `<div class="ps-big">JACKPOT!</div><div class="ps-sub">+${SLOT_POINTS.jackpotOwned.toLocaleString()} PTS${extraLife ? " + EXTRA LIFE" : ""}</div>`;
      const btn = document.createElement("button"); btn.className = "ps-claim"; btn.type = "button"; btn.textContent = "CLAIM";
      slotTrackListener(btn, "click", () => {
        addArcadeScore(SLOT_POINTS.jackpotOwned);
        slotFlashScorePayout();
        slotEls.result.className = "ps-result"; slotEls.result.innerHTML = "";
        slotState = SLOT_STATE.READY; slotAfterResolve();
      });
      slotEls.result.appendChild(btn);
    }
  }
  function slotFlashExtraLife(extraLifeCells = []) {
    if (slotEls.lifeCount) slotEls.lifeCount.textContent = String(arcadeLives);
    if (slotEls.lives) {
      slotEls.lives.classList.remove("bump");
      void slotEls.lives.offsetWidth;
      slotEls.lives.classList.add("bump");
      slotFlashRewardEl(slotEls.lives);
    }
    slotFlashRewardEl(slotEls.topLivesBox);
    if (slotEls.lifeAward) {
      slotEls.lifeAward.classList.remove("show");
      void slotEls.lifeAward.offsetWidth;
      slotEls.lifeAward.classList.add("show");
      slotTrackTimeout(() => slotEls.lifeAward?.classList.remove("show"), 1150);
    }
    if (slotEls.alienFx && slotEls.reelCanvas) {
      slotEls.alienFx.innerHTML = "";
      const rr = slotEls.reels?.getBoundingClientRect();
      if (rr) {
        for (const ci of extraLifeCells) {
          const canvas = slotEls.reelCanvas[ci];
          const cr = canvas?.getBoundingClientRect();
          if (!cr) continue;
          const rowH = cr.height / 3;
          const flash = document.createElement("div");
          flash.className = "ps-alienflash";
          flash.style.left = `${cr.left - rr.left + cr.width / 2}px`;
          flash.style.top = `${cr.top - rr.top + rowH * 1.5}px`;
          flash.style.width = `${Math.min(cr.width, rowH) * 1.18}px`;
          flash.style.height = flash.style.width;
          slotEls.alienFx.appendChild(flash);
        }
        slotTrackTimeout(() => { if (slotEls.alienFx) slotEls.alienFx.innerHTML = ""; }, 1150);
      }
    }
  }
  function slotPayoutImpact(win, extraLife) {
    const kind = win?.prize?.kind || (extraLife ? "life" : "none");
    if (kind === "none") return;
    const tier = kind === "jackpot" ? 3 : kind === "powerup" ? 2 : kind === "tokens" ? 1.5 : 1;
    cssShake(isIOSNative ? 0.55 * tier : 0.85 * tier);
    cssFlash(kind === "jackpot" ? "#ffffff" : kind === "powerup" ? "#00FFD1" : "#39ff9a", clamp(0.12 + tier * 0.08, 0, 0.42), 180 + tier * 70);
    triggerGameplayHapticImpact(tier >= 2 ? hapticImpactStyle.Heavy : hapticImpactStyle.Medium);
    if (tier >= 3) setTimeout(() => triggerGameplayHapticImpact(hapticImpactStyle.Heavy), 80);
  }
  function slotApplyOutcome() {
    const { win, wins, extraLife, extraLifeCells } = slotEvaluate(slotReadGrid());
    if (extraLife) {
      arcadeLives = clamp(arcadeLives + 1, 0, MAX_LIVES);
      renderLives();
      slotFlashExtraLife(extraLifeCells);
    }
    if (!win) {
      if (extraLife) { slotPayoutImpact(null, true); slotShowResult("life", "EXTRA LIFE", "Alien scatter!"); playGameSfx("plasmarecharged1", 0.96, { important: true }); }
      else slotShowResult("none", "NO WIN", "Pull again");
      slotState = SLOT_STATE.READY; slotAfterResolve(); return;
    }
    slotPayoutImpact(win, extraLife);
    slotEls.reels?.classList.add("win");
    slotStartWinFX(wins);
    const p = win.prize;
    if (p.kind === "jackpot") { if (extraLife) playGameSfx("plasmarecharged1", 0.9, { important: true }); slotJackpotPresent(extraLife); return; }
    // per-reward payout cue (falls back to slot_win when the reward-specific file is absent)
    const payoutKey = p.kind === "tokens" ? "pickup_gold" : p.kind === "powerup" ? "slot_payout_" + p.sym : null;
    playGameSfx(payoutKey && GAME_SFX[payoutKey] ? payoutKey : "slot_win", 0.92);
    if (extraLife) playGameSfx("plasmarecharged1", 0.86, { important: true });
    let big, sub;
    if (p.kind === "tokens") {
      slotTokens += p.value; big = `+${p.value} TOKEN${p.value > 1 ? "S" : ""}`; sub = "Gold bars!";
      if (slotEls.tokenCount) slotEls.tokenCount.textContent = String(slotTokens);
      if (slotEls.tokensBox) { slotEls.tokensBox.classList.remove("tick"); void slotEls.tokensBox.offsetWidth; slotEls.tokensBox.classList.add("tick"); }
      slotFlashRewardEl(slotEls.tokensBox);
    } else if (p.kind === "powerup") { slotAwardPowerup(p.sym); big = SLOT_PW_LABEL[p.sym]; sub = SLOT_PW_SUB[p.sym]; }
    else {
      addArcadeScore(p.value);
      slotFlashScorePayout();
      big = `+${p.value.toLocaleString()} PTS`;
      sub = (win.res.kind === "pair" ? "Matched pair" : "Bonus") + (extraLife ? " + EXTRA LIFE" : "");
    }
    slotShowResult("win", big, sub);
    slotState = SLOT_STATE.READY; slotAfterResolve();
  }
  function slotAfterResolve() {
    if (slotTokens <= 0) { slotShowContinue(SLOT_FINAL_RESULT_HOLD_MS); return; }
    slotEls.skip?.classList.add("show");
    if (!slotEls.result || !slotEls.result.classList.contains("none")) setSlotHint("PULL AGAIN");
    else setSlotHint("");
  }
  // Apply rewards that must land on the NEXT level (quad is timed). Called after startLevel().
  function slotApplyPendingRewards() {
    if (slotPendingQuadShot > 0) {
      quadShotUntil = performance.now() + 12000 * slotPendingQuadShot;
      slotPendingQuadShot = 0;
    }
  }

  function slotFrame(now) {
    if (slotState === SLOT_STATE.DISPOSED || !slotOverlay) return; // loop ends (not rescheduled)
    let dt = (now - slotLastFrameAt) / 1000; slotLastFrameAt = now;
    if (dt > 0.05) dt = 0.05; if (dt < 0) dt = 0;
    // lever spring physics
    if (slotLever.mode === "drag" || slotLever.mode === "autoPull") {
      slotLever.vel += (slotLever.springTarget - slotLever.value) * SLOT_LEVER_STIFF * dt;
      slotLever.vel -= slotLever.vel * SLOT_LEVER_DAMP * dt; slotLever.value += slotLever.vel * dt;
      if (slotLever.mode === "autoPull" && slotLever.value >= 0.985) {
        slotLever.value = 1;
        slotLever.vel = 0;
        slotLever.mode = "recoil";
        slotLever.springTarget = 0;
        slotDoPull();
      }
    } else if (slotLever.mode === "recoil") {
      slotLever.vel += (0 - slotLever.value) * SLOT_LEVER_STIFF * dt;
      slotLever.vel -= slotLever.vel * SLOT_LEVER_DAMP * dt; slotLever.value += slotLever.vel * dt;
      if (Math.abs(slotLever.value) < 0.004 && Math.abs(slotLever.vel) < 0.02) { slotLever.value = 0; slotLever.vel = 0; slotLever.mode = "rest"; }
    }
    slotLever.value = Math.max(0, Math.min(1, slotLever.value));
    if (slotEls.knob) slotEls.knob.style.transform = `translateY(${slotLever.value * slotLeverTravel}px)`;
    slotEls.lever?.classList.toggle("disabled", !slotLeverEnabled());
    // reels
    for (const r of slotReels) {
      if (r.state === "spinning") { r.pos += r.vel * dt; }
      else if (r.state === "stopping") {
        const s = Math.min(1, ((now - r.stopT0) / 1000) / SLOT_STOP_DUR), s2 = s * s, s3 = s2 * s;
        r.pos = r.stopFrom * (2 * s3 - 3 * s2 + 1) + (r.stopV0 * SLOT_STOP_DUR) * (s3 - 2 * s2 + s) + r.stopFinal * (-2 * s3 + 3 * s2);
        if (s >= 1) {
          r.pos = r.stopFinal; r.bounce = 0; r.bounceVel = SLOT_BOUNCE_IMPULSE; r.state = "settle";
          playGameSfx("slot_clunk", 0.7);
          triggerGameplayHapticImpact(hapticImpactStyle.Heavy); // 2026-07-02: reel-stop bumped Medium->Heavy per playtest (harder symbol-stop feel)
        }
      } else if (r.state === "settle") {
        r.bounceVel += (0 - r.bounce) * SLOT_BOUNCE_K * dt; r.bounceVel -= r.bounceVel * SLOT_BOUNCE_DAMP * dt; r.bounce += r.bounceVel * dt;
        if (Math.abs(r.bounce) < 0.002 && Math.abs(r.bounceVel) < 0.02) {
          r.bounce = 0; r.state = "stopped";
          if (slotReels.every((x) => x.state === "stopped")) slotOnAllStopped();
        }
      }
      slotDrawReel(r);
    }
    if (slotWinFx.active) slotDrawFX(now, dt);
    slotTrackRaf(slotFrame);
  }
  function slotStartFrameLoop() {
    if (slotRaf) return; // already scheduled
    slotLastFrameAt = performance.now();
    slotTrackRaf(slotFrame);
  }

  function slotDuckLevelMusic() {
    slotLevelMusicGainBefore = audioEngine.musicGain?.gain?.value ?? MUSIC_MAX_GAIN;
    slotLevelMusicHtmlVolBefore = audioEngine.currentMusicHtml?.node?.volume ?? MUSIC_MAX_GAIN;
    // 2026-07-02: gentler slot duck — the level track stays clearly present under the slot SFX
    // (was 0.42 / 0.32, which read as "music turned way down"). Just a light dip now.
    const target = (state.whisper ? 0.45 : 0.68) * MUSIC_MAX_GAIN;
    if (audioEngine.musicGain && audioEngine.ctx) {
      const t = audioEngine.ctx.currentTime;
      audioEngine.musicGain.gain.cancelScheduledValues(t);
      audioEngine.musicGain.gain.setValueAtTime(audioEngine.musicGain.gain.value, t);
      audioEngine.musicGain.gain.linearRampToValueAtTime(target, t + 0.22);
    }
    if (audioEngine.currentMusicHtml?.node) audioEngine.currentMusicHtml.node.volume = state.whisper ? 0.35 : 0.55;
  }
  function slotRestoreLevelMusic() {
    if (slotLevelMusicGainBefore == null && slotLevelMusicHtmlVolBefore == null) return;
    const gainTarget = slotLevelMusicGainBefore ?? MUSIC_MAX_GAIN;
    const htmlTarget = slotLevelMusicHtmlVolBefore ?? MUSIC_MAX_GAIN;
    slotLevelMusicGainBefore = null;
    slotLevelMusicHtmlVolBefore = null;
    if (audioEngine.musicGain && audioEngine.ctx) {
      const t = audioEngine.ctx.currentTime;
      audioEngine.musicGain.gain.cancelScheduledValues(t);
      audioEngine.musicGain.gain.setValueAtTime(audioEngine.musicGain.gain.value, t);
      audioEngine.musicGain.gain.linearRampToValueAtTime(gainTarget, t + 0.18);
    }
    if (audioEngine.currentMusicHtml?.node) audioEngine.currentMusicHtml.node.volume = htmlTarget;
  }
  function slotStartMusic() {
    slotStopMusic();
    slotDuckLevelMusic();
  }
  function slotStopMusic() {
    if (slotMusicEl) { try { slotMusicEl.pause(); } catch { /* ignore */ } slotMusicEl = null; }
    slotRestoreLevelMusic();
  }

  let _slotStylesInjected = false;
  function ensureSlotStyles() {
    if (_slotStylesInjected) return;
    _slotStylesInjected = true;
    const s = document.createElement("style");
    s.id = "polyslotsStyles";
    s.textContent = `
      #polyslots{position:fixed;inset:0;z-index:9500;display:flex;align-items:flex-start;justify-content:center;pointer-events:auto;overflow:hidden;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace;background:
        radial-gradient(ellipse at 50% 40%,rgba(116,56,210,.38),rgba(28,16,82,.46) 36%,rgba(3,5,20,.94) 72%),
        linear-gradient(145deg,rgba(21,5,54,.97),rgba(3,8,28,.98) 52%,rgba(42,7,74,.96));}
      #polyslots::before{content:"";position:absolute;inset:-18%;z-index:0;pointer-events:none;background:
        radial-gradient(circle at 18% 22%,rgba(182,104,255,.34),transparent 18%),
        radial-gradient(circle at 78% 26%,rgba(92,205,255,.18),transparent 15%),
        radial-gradient(circle at 42% 72%,rgba(246,105,255,.20),transparent 22%),
        repeating-radial-gradient(circle at 50% 50%,rgba(255,255,255,.13) 0 1px,transparent 1px 13px);
        filter:blur(.2px);opacity:.72;animation:psGalaxyDrift 18s linear infinite;}
      #polyslots::after{content:"";position:absolute;inset:0;z-index:0;pointer-events:none;background:
        radial-gradient(circle at 22% 34%,rgba(255,255,255,.74) 0 1px,transparent 1.5px),
        radial-gradient(circle at 64% 18%,rgba(202,224,255,.84) 0 1px,transparent 1.5px),
        radial-gradient(circle at 83% 62%,rgba(255,255,255,.55) 0 1px,transparent 1.5px),
        radial-gradient(circle at 36% 84%,rgba(176,248,255,.62) 0 1px,transparent 1.5px);
        background-size:220px 180px,260px 210px,310px 240px,190px 160px;mix-blend-mode:screen;opacity:.72;animation:psStarDrift 24s linear infinite;}
      @keyframes psGalaxyDrift{from{transform:translate3d(0,0,0) rotate(0deg)}to{transform:translate3d(-2%,1%,0) rotate(1turn)}}
      @keyframes psStarDrift{from{background-position:0 0,0 0,0 0,0 0}to{background-position:220px 180px,-260px 210px,310px -240px,-190px -160px}}
      #polyslots.ios-lite::before,#polyslots.ios-lite::after{animation:none;}
      #polyslots.ps-flash{animation:psOverlayFlash 360ms ease-out both;}
      @keyframes psOverlayFlash{0%{filter:brightness(2.1)}100%{filter:brightness(1)}}
      /* Cabinet skin: the whole machine is one art PNG; live bits are absolutely placed (ported 1:1
         from prototypes/slot-machine.html — TUNE fractions are of the cabinet box). */
      .cabinet-loading .ps-reels,.cabinet-loading .ps-lever,.cabinet-loading .ps-result,.cabinet-loading .ps-hint,.cabinet-loading .ps-hud,.cabinet-loading .ps-skip,.cabinet-loading .ps-continue,.cabinet-loading .ps-lifeaward{opacity:0;}
      .ps-gamehud{position:absolute;left:max(10px,env(safe-area-inset-left,0px));right:max(10px,env(safe-area-inset-right,0px));top:calc(8px + env(safe-area-inset-top,0px));z-index:3;display:flex;align-items:center;justify-content:space-between;gap:10px;color:#dff;}
      .ps-modebtn{min-height:40px;border:1px solid rgba(255,255,255,.2);border-radius:999px;background:rgba(7,14,30,.76);color:#dff;padding:8px 12px;font:800 13px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.04em;}
      .ps-score{display:flex;gap:10px;align-items:center;justify-content:flex-end;flex-wrap:wrap;font-size:clamp(12px,3.1vw,15px);font-weight:800;text-shadow:0 0 10px rgba(0,255,209,.45);}
      .ps-score span{padding:7px 9px;border:1px solid rgba(255,255,255,.14);border-radius:999px;background:rgba(7,14,30,.64);}
      .ps-score span.score-flash{animation:psScoreFlash 520ms ease-out both;}
      @keyframes psScoreFlash{0%{transform:scale(1);border-color:rgba(255,255,255,.14);box-shadow:none}28%{transform:scale(1.16);border-color:#39ff9a;box-shadow:0 0 18px rgba(57,255,154,.85),0 0 34px rgba(57,255,154,.55);color:#fff}100%{transform:scale(1);border-color:rgba(255,255,255,.14);box-shadow:none}}
      .ps-reward-flash{animation:psRewardFlash 620ms ease-out both;}
      @keyframes psRewardFlash{0%{filter:brightness(1);text-shadow:0 0 9px rgba(57,255,154,.6)}24%{filter:brightness(1.9) drop-shadow(0 0 12px rgba(57,255,154,.95));text-shadow:0 0 18px rgba(57,255,154,1),0 0 32px rgba(57,255,154,.75)}58%{filter:brightness(1.35) drop-shadow(0 0 20px rgba(57,255,154,.7));text-shadow:0 0 14px rgba(57,255,154,.85)}100%{filter:brightness(1);text-shadow:0 0 9px rgba(57,255,154,.6)}}
      .ps-panel{position:relative;z-index:1;aspect-ratio:826/1806;width:min(420px,94vw,40vh);margin-top:calc(60px + env(safe-area-inset-top,0px));color:#dff;
        background:linear-gradient(180deg,rgba(3,6,14,.92),rgba(5,12,24,.98));
        animation:psSlam 240ms cubic-bezier(.2,1.4,.4,1) both;
        --reelL:6.9%;--reelT:19.82%;--reelW:69.98%;--reelH:35.27%;
        --leverR:2%;--leverT:20%;--leverW:17%;--leverH:35%;
        --resultT:55.8%;--hintT:61.3%;--hudT:67.5%;--btnT:75.5%;}
      .ps-cabinet{position:absolute;inset:0;width:100%;height:100%;object-fit:fill;z-index:1;pointer-events:none;}
      /* 2026-07-02: iPad-class screens (>=640px wide — clears every iPhone) were pinned to the
         420px cap, leaving the cabinet marooned in the middle of a huge display. The art is a tall,
         narrow aspect (826/1806), so the way to reclaim real estate is to grow it to (nearly) fill
         the viewport height; width follows the aspect ratio. Trim the top margin so the taller
         cabinet still fits. Everything inside is placed in % of the panel, so it all scales along. */
      @media (min-width:640px){
        .ps-panel{width:min(43vh,90vw,620px);margin-top:calc(18px + env(safe-area-inset-top,0px));}
      }
      @keyframes psSlam{0%{opacity:0;transform:scale(2.35) rotate(-2deg)}58%{opacity:1;transform:scale(.92) rotate(.5deg)}100%{opacity:1;transform:scale(1) rotate(0)}}
      @keyframes psBlink{50%{opacity:.25}}
      @keyframes psTick{0%{transform:scale(1)}40%{transform:scale(1.5);color:#fff}100%{transform:scale(1)}}
      @keyframes psBump{40%{transform:scale(1.4)}}
      .ps-lives,.ps-tokens{position:absolute;z-index:8;font-weight:800;font-size:clamp(15px,4vw,22px);transform:translateY(-50%);color:#39ff9a;text-shadow:0 0 9px rgba(57,255,154,.6);}
      .ps-lives{top:12.8%;right:6.5%;} .ps-tokens{top:16.5%;right:6.5%;}
      .ps-tokens.tick b{animation:psTick 380ms ease-out;} .ps-lives.bump b{animation:psTick 380ms ease-out;}
      .ps-lifeaward{position:absolute;left:7%;top:12.2%;z-index:9;display:flex;align-items:center;gap:5px;opacity:0;transform:translateY(-50%) scale(.7);pointer-events:none;color:#9dff9d;font-weight:900;font-size:clamp(11px,3vw,15px);letter-spacing:.08em;text-shadow:0 0 12px rgba(120,255,120,.8);}
      .ps-lifeaward img{width:clamp(24px,6vw,34px);height:clamp(24px,6vw,34px);object-fit:contain;filter:drop-shadow(0 0 10px rgba(120,255,120,.9));}
      .ps-lifeaward.show{animation:psLifeAward 1050ms ease-out both;}
      @keyframes psLifeAward{0%{opacity:0;transform:translateY(-50%) scale(.6)}18%{opacity:1;transform:translateY(-50%) scale(1.22)}58%{opacity:1;transform:translateY(-64%) scale(1)}100%{opacity:0;transform:translateY(-86%) scale(.92)}}
      .ps-reels{position:absolute;left:var(--reelL);top:var(--reelT);width:var(--reelW);height:var(--reelH);display:flex;gap:4px;padding:4px;border-radius:6px;background:linear-gradient(180deg,#02060d,#050d18);box-shadow:inset 0 0 22px rgba(0,0,0,.9);z-index:3;}
      .ps-reel{position:relative;flex:1;height:100%;overflow:hidden;border-radius:5px;background:linear-gradient(180deg,#0a1626,#060e1a);border:1px solid rgba(0,255,209,.10);}
      .ps-reel canvas{display:block;width:100%;height:100%;}
      .ps-payline{position:absolute;left:4px;right:4px;top:50%;height:32%;transform:translateY(-50%);border-top:2px solid rgba(0,255,209,.42);border-bottom:2px solid rgba(0,255,209,.42);pointer-events:none;z-index:4;border-radius:4px;box-shadow:0 0 18px rgba(0,255,209,.18);}
      .ps-reels.win .ps-payline{border-color:#00FFD1;box-shadow:0 0 26px rgba(0,255,209,.55);animation:psWinpulse .5s ease-in-out 3;}
      @keyframes psWinpulse{50%{box-shadow:0 0 40px rgba(0,255,209,.9);}}
      .ps-alienfx{position:absolute;inset:0;z-index:6;pointer-events:none;overflow:visible;}
      .ps-alienflash{position:absolute;border-radius:50%;transform:translate(-50%,-50%);background:radial-gradient(circle,rgba(190,255,190,.96) 0 28%,rgba(57,255,80,.72) 44%,rgba(57,255,80,.16) 68%,rgba(57,255,80,0) 78%);box-shadow:0 0 18px rgba(57,255,80,.95),0 0 44px rgba(57,255,80,.75);animation:psAlienFlash 1050ms ease-out both;}
      .ps-alienflash::after{content:"";position:absolute;inset:18%;background:url("slotart/alien.png") center/contain no-repeat;filter:drop-shadow(0 0 8px rgba(180,255,180,.95));}
      @keyframes psAlienFlash{0%{opacity:0;transform:translate(-50%,-50%) scale(.45)}18%{opacity:1;transform:translate(-50%,-50%) scale(1.2)}48%{opacity:1;transform:translate(-50%,-50%) scale(.95)}100%{opacity:0;transform:translate(-50%,-50%) scale(1.55)}}
      .ps-winfx{position:absolute;inset:0;width:100%;height:100%;z-index:5;pointer-events:none;}
      .ps-result{position:absolute;left:var(--reelL);width:var(--reelW);top:var(--resultT);z-index:8;display:flex;flex-direction:column;align-items:center;gap:1px;text-align:center;pointer-events:none;}
      .ps-result .ps-big{font-size:clamp(15px,4.2vw,22px);letter-spacing:.08em;color:#00FFD1;text-shadow:0 0 12px rgba(0,255,209,.6);}
      .ps-result .ps-sub{font-size:clamp(10px,2.6vw,13px);letter-spacing:.05em;color:rgba(183,201,255,.65);}
      .ps-result.none .ps-big{color:rgba(183,201,255,.65);text-shadow:none;}
      .ps-result.life .ps-big{color:#ff7b8a;text-shadow:0 0 12px rgba(255,90,120,.6);}
      .ps-result.jackpot .ps-big{font-size:clamp(18px,5vw,26px);color:#fff;text-shadow:0 0 10px #00FFD1,0 0 26px rgba(0,255,209,.8),0 0 40px rgba(0,255,209,.5);animation:psJflash .6s ease-in-out infinite;}
      @keyframes psJflash{50%{text-shadow:0 0 16px #fff,0 0 40px #00FFD1,0 0 70px rgba(0,255,209,.9);}}
      .ps-claim{margin-top:6px;pointer-events:auto;font-family:inherit;font-size:.78rem;letter-spacing:.1em;color:#04121c;background:#00FFD1;border:none;border-radius:8px;padding:7px 16px;cursor:pointer;font-weight:bold;box-shadow:0 0 18px rgba(0,255,209,.45);}
      .ps-lever{position:absolute;right:var(--leverR);top:var(--leverT);width:var(--leverW);height:var(--leverH);display:flex;flex-direction:column;align-items:center;z-index:7;touch-action:none;}
      .ps-track{position:relative;width:9px;flex:1;margin:4px 0;border-radius:6px;background:linear-gradient(180deg,#0b1422,#060c16);border:1px solid rgba(0,255,209,.18);box-shadow:inset 0 0 8px rgba(0,0,0,.8);}
      .ps-knob{position:absolute;left:50%;top:0;width:30px;height:30px;margin-left:-15px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#ff6b6b,#b00020 70%);border:2px solid rgba(255,255,255,.35);box-shadow:0 0 16px rgba(255,40,60,.55),inset 0 -4px 8px rgba(0,0,0,.4);cursor:grab;touch-action:none;z-index:5;}
      .ps-knob::before{content:"";position:absolute;inset:-28px;border-radius:50%;}
      .ps-knob:active{cursor:grabbing;}
      .ps-lever.disabled .ps-knob{filter:grayscale(.7) brightness(.55);cursor:not-allowed;}
      .ps-hint{position:absolute;left:0;right:0;top:var(--hintT);text-align:center;font-size:clamp(12px,3.4vw,16px);letter-spacing:.16em;color:rgba(0,255,209,.72);z-index:8;}
      .ps-hint.blink{animation:psBlink 1.1s steps(2,jump-none) infinite;}
      .ps-hud{position:absolute;left:0;right:0;top:var(--hudT);transform:translateY(-50%);display:flex;gap:clamp(8px,3.2vw,18px);justify-content:center;font-size:clamp(13px,3.4vw,17px);z-index:8;}
      .ps-hud .ps-slot{display:flex;align-items:center;gap:3px;color:#cfe;}
      .ps-hud .ps-slot b{color:#fff;font-weight:700;}
      .ps-hud .ps-slot.nuke{color:#ff8a96;}
      .ps-hud .ps-hudicon{width:clamp(22px,6vw,30px);height:clamp(22px,6vw,30px);object-fit:contain;}
      .ps-skip{position:absolute;left:8%;top:var(--btnT);z-index:8;font-family:inherit;font-size:clamp(9px,2.3vw,12px);letter-spacing:.14em;color:rgba(183,201,255,.65);background:rgba(8,18,32,.92);border:1px solid rgba(0,255,209,.25);border-radius:8px;padding:6px 12px;cursor:pointer;opacity:0;pointer-events:none;transition:opacity .4s;}
      .ps-skip.show{opacity:.85;pointer-events:auto;}
      .ps-skip:hover{opacity:1;color:#00FFD1;border-color:rgba(0,255,209,.42);}
      .ps-continue{position:absolute;inset:0;z-index:12;display:flex;align-items:center;justify-content:center;border-radius:14px;cursor:pointer;opacity:0;pointer-events:none;transition:opacity .35s;background:radial-gradient(circle at 50% 50%,rgba(2,10,20,.86),rgba(1,4,10,.95));}
      .ps-continue.show{opacity:1;pointer-events:auto;}
      .ps-continue-inner{position:absolute;top:73.5%;left:50%;transform:translateX(-50%);font-size:clamp(.88rem,3.2vw,1.05rem);letter-spacing:.14em;color:#00FFD1;text-align:center;text-shadow:0 0 16px rgba(0,255,209,.6);border:1px solid rgba(0,255,209,.42);border-radius:10px;padding:12px 18px;min-width:62%;animation:psBlink 1.2s steps(2,jump-none) infinite;}
    `;
    document.head.appendChild(s);
  }

  function buildSlotOverlay() {
    const overlay = document.createElement("div");
    overlay.id = "polyslots";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
      <div class="ps-gamehud">
        <button class="ps-modebtn" id="psModes" type="button">← Modes</button>
        <div class="ps-score"><span id="psScoreBox">Score: <b id="psScoreVal">0</b></span><span id="psTopLivesBox">Lives: <b id="psTopLives">0</b></span></div>
      </div>
      <div class="ps-panel">
        <img class="ps-cabinet" src="slotart/cabinet.png" alt="" aria-hidden="true">
        <span class="ps-lives" id="psLives"><b id="psLifeCount">0</b></span>
        <span class="ps-tokens" id="psTokens"><b id="psTokenCount">0</b></span>
        <div class="ps-lifeaward" id="psLifeAward"><img src="slotart/alien.png" alt=""><span>+1 LIFE</span></div>
        <div class="ps-reels" id="psReels">
          <div class="ps-payline"></div>
          <div class="ps-reel"><canvas id="psReelC0"></canvas></div>
          <div class="ps-reel"><canvas id="psReelC1"></canvas></div>
          <div class="ps-reel"><canvas id="psReelC2"></canvas></div>
          <div class="ps-alienfx" id="psAlienFx"></div>
          <canvas class="ps-winfx" id="psWinFx"></canvas>
        </div>
        <div class="ps-lever" id="psLever"><div class="ps-track" id="psTrack"><div class="ps-knob" id="psKnob"></div></div></div>
        <div class="ps-result" id="psResult"></div>
        <div class="ps-hint blink" id="psHint">GET READY</div>
        <div class="ps-hud" id="psHud">
          <div class="ps-slot" data-k="quad"><img class="ps-hudicon" src="slotart/quad.png" alt=""><b id="psInvQuad">0</b></div>
          <div class="ps-slot" data-k="bomb"><img class="ps-hudicon" src="slotart/bomb.png" alt=""><b id="psInvBomb">0</b></div>
          <div class="ps-slot" data-k="missile"><img class="ps-hudicon" src="slotart/missile.png" alt=""><b id="psInvMissile">0</b></div>
          <div class="ps-slot" data-k="freeze"><img class="ps-hudicon" src="slotart/freeze.png" alt=""><b id="psInvFreeze">0</b></div>
          <div class="ps-slot nuke" data-k="nuke"><img class="ps-hudicon" src="slotart/nuke.png" alt=""><b id="psInvNuke">0</b></div>
        </div>
        <button class="ps-skip" id="psSkip" type="button">SKIP ▸</button>
        <div class="ps-continue" id="psContinue"><div class="ps-continue-inner" id="psContinueInner">TAP TO CONTINUE</div></div>
      </div>
    `;
    (galaxyView || document.body).appendChild(overlay);
    slotEls.root = overlay;
    slotEls.lives = overlay.querySelector("#psLives");
    slotEls.topLivesBox = overlay.querySelector("#psTopLivesBox");
    slotEls.topLives = overlay.querySelector("#psTopLives");
    slotEls.scoreBox = overlay.querySelector("#psScoreBox");
    slotEls.scoreVal = overlay.querySelector("#psScoreVal");
    slotEls.modes = overlay.querySelector("#psModes");
    slotEls.tokensBox = overlay.querySelector("#psTokens");
    slotEls.tokenCount = overlay.querySelector("#psTokenCount");
    slotEls.lifeCount = overlay.querySelector("#psLifeCount");
    slotEls.lifeAward = overlay.querySelector("#psLifeAward");
    slotEls.hint = overlay.querySelector("#psHint");
    slotEls.skip = overlay.querySelector("#psSkip");
    slotEls.continue = overlay.querySelector("#psContinue");
    slotEls.continueInner = overlay.querySelector("#psContinueInner");
    slotEls.result = overlay.querySelector("#psResult");
    slotEls.reels = overlay.querySelector("#psReels");
    slotEls.alienFx = overlay.querySelector("#psAlienFx");
    slotEls.lever = overlay.querySelector("#psLever");
    slotEls.track = overlay.querySelector("#psTrack");
    slotEls.knob = overlay.querySelector("#psKnob");
    slotEls.reelCanvas = [0, 1, 2].map((i) => overlay.querySelector("#psReelC" + i));
    slotEls.invSlots = {
      quad: overlay.querySelector('.ps-slot[data-k="quad"]'),
      bomb: overlay.querySelector('.ps-slot[data-k="bomb"]'),
      missile: overlay.querySelector('.ps-slot[data-k="missile"]'),
      freeze: overlay.querySelector('.ps-slot[data-k="freeze"]'),
      nuke: overlay.querySelector('.ps-slot[data-k="nuke"]'),
    };
    slotEls.winFx = overlay.querySelector("#psWinFx");
    slotWinFx.ctx = slotEls.winFx ? slotEls.winFx.getContext("2d") : null;
    return overlay;
  }

  function setSlotHint(text, blink = true) {
    if (!slotEls.hint) return;
    slotEls.hint.textContent = text;
    slotEls.hint.classList.toggle("blink", blink && !!text);
  }

  // Mirror the player's live game stats into the cabinet HUD. 5a is READ-ONLY (rewards land in 5b);
  // this just makes the machine show real ♥ / inventory instead of zeros.
  function slotSyncCabinetStats() {
    if (slotEls.lifeCount) slotEls.lifeCount.textContent = String(arcadeLives);
    if (slotEls.topLives) slotEls.topLives.textContent = String(arcadeLives);
    if (slotEls.scoreVal) slotEls.scoreVal.textContent = String(arcadeScore);
    const setInv = (id, n) => { const el = slotEls.root?.querySelector(id); if (el) el.textContent = String(n); };
    setInv("#psInvQuad", slotPendingQuadShot);
    setInv("#psInvBomb", playerBombInventory);
    setInv("#psInvMissile", playerMissileInventory);
    setInv("#psInvFreeze", playerFreezeInventory);
    setInv("#psInvNuke", slotNukeOwned);
  }
  function slotFlashRewardEl(el) {
    if (!el) return;
    el.classList.remove("ps-reward-flash");
    void el.offsetWidth;
    el.classList.add("ps-reward-flash");
    slotTrackTimeout(() => el.classList.remove("ps-reward-flash"), 660);
  }
  function slotFlashScorePayout() {
    if (!slotEls.scoreBox) return;
    slotEls.scoreBox.classList.remove("score-flash");
    void slotEls.scoreBox.offsetWidth;
    slotEls.scoreBox.classList.add("score-flash");
    slotTrackTimeout(() => slotEls.scoreBox?.classList.remove("score-flash"), 560);
  }

  // Open the slot. onExit is the continue-to-next-level callback (the slot OWNS the startLevel()
  // call from here on). Safe against double-entry: ignored while a slot is already live.
  function enterSlot({ onExit } = {}) {
    if (isSlotActive()) return;
    slotState = SLOT_STATE.ENTERING;
    slotOnExit = typeof onExit === "function" ? onExit : null;
    slotContinueShown = false;
    slotContinueArmedAt = Infinity;
    slotInputLockedUntil = performance.now() + SLOT_LOCKOUT_MS;
    ensureSlotStyles();
    ensureSlotSprites();
    void ensureSlotCabinetArt();
    commBoxController.hide();
    slotOverlay = buildSlotOverlay();
    slotOverlay.classList.add("cabinet-loading");
    slotOverlay.classList.add("ps-flash");
    if (isIOSNative) {
      slotOverlay.classList.add("ios-lite");
      [bgVideoA, bgVideoB].forEach((v) => { try { v?.pause(); } catch {} });
    }
    galaxyView?.classList.add("slot-active");
    slotClearWinFx();
    if (slotEls.tokenCount) slotEls.tokenCount.textContent = String(slotTokens);
    slotSyncCabinetStats(); // lives + current inventory in the cabinet HUD
    setSlotHint("GET READY");
    // Swallow taps on the cabinet so a stray fire-tap can't reach the canvas underneath.
    slotTrackListener(slotEls.root, "pointerdown", (e) => e.stopPropagation(), { passive: false });
    // SKIP ▸ → leave to the next level (gated by the open lockout).
    slotTrackListener(slotEls.skip, "click", () => {
      if (performance.now() < slotInputLockedUntil) return;
      if (slotState === SLOT_STATE.READY) exitSlot();
    });
    // TAP TO CONTINUE overlay → leave (only after it's armed, so the final tap doesn't dismiss it).
    slotTrackListener(slotEls.continue, "pointerdown", (e) => {
      e.stopPropagation();
      if (performance.now() >= slotContinueArmedAt) exitSlot();
    }, { passive: false });
    slotTrackListener(slotEls.modes, "click", (e) => {
      e.stopPropagation();
      slotTeardown(SLOT_REASON.MENU);
      showModeSelect();
    });
    // Lever (drag-only — anti-misclick). Spring physics run in slotFrame; a release past the
    // threshold triggers the pull.
    const slotBeginLeverDrag = (e) => {
      if (!slotLeverEnabled()) return;
      slotLever.mode = "drag";
      try { slotEls.lever.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      const rect = slotEls.track.getBoundingClientRect();
      const knobTop = rect.top + slotLever.value * slotLeverTravel;
      slotLever.grabOffset = e.target === slotEls.knob
        ? e.clientY - knobTop
        : (slotEls.knob?.offsetHeight || 30) / 2;
      slotLever.springTarget = Math.max(0, Math.min(1, (e.clientY - slotLever.grabOffset - rect.top) / slotLeverTravel));
      e.preventDefault();
    };
    slotTrackListener(slotEls.lever, "pointerdown", slotBeginLeverDrag, { passive: false });
    slotTrackListener(slotEls.lever, "pointermove", (e) => {
      if (slotLever.mode !== "drag") return;
      const rect = slotEls.track.getBoundingClientRect();
      slotLever.springTarget = Math.max(0, Math.min(1, (e.clientY - slotLever.grabOffset - rect.top) / slotLeverTravel));
    });
    slotTrackListener(slotEls.lever, "pointerup", slotReleaseLever);
    slotTrackListener(slotEls.lever, "pointercancel", slotReleaseLever);
    // Build the reels and start the (cancellable) render/physics loop + slot music.
    slotMakeReels();
    requestAnimationFrame(slotSizeReels); // re-measure once CSS layout has settled
    // The cabinet is responsive; keep the reels + win-FX overlay synced as its box settles/changes
    // (safe-area, rotation) so the payout streak always maps to the live cell positions.
    if (typeof ResizeObserver === "function" && slotEls.reels && !slotWinFxResizeObs) {
      slotWinFxResizeObs = new ResizeObserver(() => slotSizeReels());
      try { slotWinFxResizeObs.observe(slotEls.reels); } catch { /* ignore */ }
    }
    slotStartFrameLoop();
    slotStartMusic();
    requestAnimationFrame(() => {
      if (slotState === SLOT_STATE.ENTERING) slotOverlay?.classList.remove("cabinet-loading");
    });
    // After the lockout: become READY and invite the pull.
    slotTrackTimeout(() => {
      if (slotState !== SLOT_STATE.ENTERING) return;
      slotState = SLOT_STATE.READY;
      if (slotTokens > 0 && !slotContinueShown) setSlotHint("PULL THE LEVER");
    }, SLOT_LOCKOUT_MS);
    // SKIP appears after a beat (only if we're idle on the slot, not already leaving via continue).
    slotTrackTimeout(() => {
      if (!slotContinueShown && slotState === SLOT_STATE.READY) slotEls.skip?.classList.add("show");
    }, SLOT_SKIP_DELAY_MS);
    // No tokens banked → there's nothing to play; go straight to the continue overlay.
    if (slotTokens <= 0) slotShowContinue();
    lvlTrace(`[slot] enter tokens=${slotTokens}`);
  }

  // Full-panel TAP TO CONTINUE. Armed after a delay so the tap that emptied the bank (step 4) can't
  // also dismiss it. In step 3 this only triggers when entering with 0 tokens.
  function slotShowContinue(delayMs = 0) {
    if (slotContinueShown) return;
    if (delayMs > 0) {
      slotTrackTimeout(() => slotShowContinue(0), delayMs);
      return;
    }
    slotContinueShown = true;
    setSlotHint("");
    slotEls.skip?.classList.remove("show");
    slotEls.continue?.classList.add("show");
    slotContinueArmedAt = performance.now() + SLOT_CONTINUE_DELAY_MS;
    playGameSfx("slot_outoftokens", 0.8);
  }

  // The single NORMAL exit. Shows a brief "ENTERING NEXT LEVEL…" beat, then disposes the slot
  // (SLOT_REASON.SLOT_EXIT → tokens discarded) and hands control to the next level. The onExit
  // callback is captured before teardown so the handoff still fires after disposal.
  function exitSlot() {
    if (slotState === SLOT_STATE.EXITING || slotState === SLOT_STATE.DISPOSED) return;
    slotState = SLOT_STATE.EXITING;
    slotInputLockedUntil = Infinity; // freeze all further input during the exit beat
    if (slotEls.continueInner) slotEls.continueInner.textContent = "ENTERING NEXT LEVEL…";
    slotEls.continue?.classList.add("show");
    slotTrackTimeout(() => {
      const onExit = slotOnExit; // capture before teardown clears it
      slotTeardown(SLOT_REASON.SLOT_EXIT);
      onExit?.(); // hand off — this is the slot's owned startLevel() call
    }, SLOT_EXIT_FADE_MS);
  }

  // ── App-switch handling (step 4) ───────────────────────────────────────────────────────────
  // Backgrounding during the slot is a PAUSE, not a teardown — the existing arcade visibility-
  // restore path is gated on arcadeActive (false during the slot), so without this the slot would
  // get no resume handling. These run from the gameplay visibilitychange handler when isSlotActive().
  function slotPauseForBackground() {
    if (!isSlotActive() || slotPaused) return;
    slotPaused = true;
    // Silence slot loops (none in the shell yet; the global stopAllLoops also fires on hide). We
    // must still clear our own handle bookkeeping so audio state can't desync — same rule as teardown.
    for (let i = 0; i < SLOT_LOOP_NAMES.length; i += 1) {
      try { audioEngine.stopLoop(SLOT_LOOP_NAMES[i]); } catch { /* ignore */ }
    }
    slotLoopHandles.forEach((h) => slotStopHandle(h));
    slotLoopHandles.clear();
    slotRampHandle = null;
    // Pause the streamed slot music (do NOT restore the bus — this is a pause, not an exit).
    if (slotMusicEl) { try { slotMusicEl.pause(); } catch { /* ignore */ } }
    lvlTrace(`[slot] background pause state=${slotState}`);
  }
  function slotResumeFromBackground() {
    if (!slotPaused) return;
    slotPaused = false;
    // An exit already in flight completes via its own timer — don't disturb it.
    if (slotState === SLOT_STATE.EXITING || slotState === SLOT_STATE.DISPOSED) return;
    // The overlay shouldn't get detached by anything during background, but re-attach defensively
    // (without a teardown, so tokens survive) rather than strand the player on a blank screen.
    if (slotOverlay && !slotOverlay.isConnected) (galaxyView || document.body).appendChild(slotOverlay);
    const now = performance.now();
    // Anti-misclick on return: re-arm the open lockout so a fumbled tap coming back doesn't instantly
    // fire SKIP / CONTINUE, and re-arm the continue overlay if it was already up.
    slotInputLockedUntil = now + SLOT_LOCKOUT_MS;
    if (slotContinueShown) slotContinueArmedAt = now + SLOT_CONTINUE_DELAY_MS;
    // Drop any half-finished drag and restart the render loop (rAF doesn't fire while backgrounded).
    slotLever.mode = "rest"; slotLever.vel = 0;
    slotStartFrameLoop();
    if (slotMusicEl) { try { slotMusicEl.play().catch(() => {}); } catch { /* ignore */ } }
    lvlTrace(`[slot] background resume state=${slotState}`);
  }

  // The single between-level seam (replaces the step-3 stub). Decides whether the slot takes the
  // window — if so it OWNS the startLevel() call (passed as onExit); otherwise forwards straight on.
  function handoffAfterScorecard(continueToNextLevel) {
    if (shouldOpenSlot()) {
      // The slot owns startLevel(); after it runs, apply any reward that must land on the new level (quad).
      enterSlot({ onExit: () => {
        engineMode = "arcade";
        setMenuOverlayOpen(false);
        setGalaxyViewMode("arcade");
        setGalaxyTool("draw");
        if (!galaxyRunning) {
          resizeGalaxyCanvas();
          computePlayfield();
          setTimeout(computePlayfield, 50);
          startGalaxyLoop();
        }
        continueToNextLevel();
        slotApplyPendingRewards();
      } });
      return;
    }
    continueToNextLevel();
  }
  // ───────────────────────────────────────────────────────────────────────────────────────────
  // 2026-06-10: multi-type powerup system (generalized from the single bomb powerup).
  // Types: timer (+30s), goldbars (+1000), quadshot (cluster fire), snowflake (freeze), bomb.
  let powerups = [];
  const POWERUP_MAX_ONSCREEN = 2;
  const POWERUP_WEIGHTS = [
    { type: "goldbars", weight: 25 },
    { type: "timer", weight: 28 },
    { type: "quadshot", weight: 26 },
    { type: "snowflake", weight: 22 },
    { type: "bomb", weight: 20 },
    { type: "missile", weight: 20 }, // 2026-06-14: homing missile powerup
    { type: "pulse", weight: 20 }, // 2026-07-01: Pulse Cannon (gated to level >= 5)
  ];
  const POWERUP_COLORS = {
    bomb: "#00ffcc",
    timer: "#ffaa00",
    goldbars: "#ffd700",
    quadshot: "#cc66ff",
    snowflake: "#88ddff",
    missile: "#ffd700", // gold ring glow
    pulse: "#00ffc8", // teal ring glow
  };
  let quadShotUntil = 0;
  // 2026-06-30: a quad-shot tap fires 4 projectiles; without this they'd each register a marksman
  // hit and trivialize the 10-hit combo. resolveShotAt(..., deferMarksman) sets this when it kills
  // a rock so handleArcadeTap can record exactly ONE marksman event per quad volley (see below).
  let _quadHitAsteroid = false;
  // 2026-07-03: set when a quad-volley shot struck the UFO — lets handleArcadeTap suppress the
  // combined volley marksman event so it doesn't break the net-UFO-net combo mid-sequence.
  let _quadHitUfo = false;
  const QUADSHOT_SEEK_RADIUS = 120;
  // 2026-07-01: Pulse Cannon — a 10s timed rapid-fire weapon. Modeled on quadShotUntil (a plain
  // expiry timestamp + HUD badge), but adds a new input mode: press-and-HOLD turret rapid fire.
  // While active, tap-and-hold sweeps a stream of pulse shots (and Plasma-Net-on-hold is disabled).
  const PULSE_CANNON_DURATION_MS = 10000;
  const PULSE_PAIR_DELAY_MS = 35; // gap between the two shots of a pulse pair
  const PULSE_BURST_DELAY_MS = 130; // pause after a pair → ~12 shots/s (2 / (35+130)ms)
  const PULSE_CANNON_SWEEP_DEG = 7; // max turret sweep off the aim line (tunable)
  const PULSE_HIT_GLOW_MS = 550; // 2026-07-01: lifetime of the teal shard-hit highlight on split children
  // 2026-07-02: every pulse shot lights up stroids within this radius of the impact with the same
  // pulsing teal glow a UFO explosion gives (reuses the _ufoBlasted glow family; see applyPulseBlastGlow).
  // Tighter than UFO's 220 since the pulse is a precision weapon — tune after playtest.
  const PULSE_BLAST_RADIUS = 160;
  // 2026-07-01: every level gets one guaranteed Pulse Cannon early; these levels also get a SECOND
  // drop later in the level (~58% elapsed) for an extra mid/late-level burst window.
  const SECOND_PULSE_LEVELS = new Set([9, 11, 13, 14, 15]);
  let pulseCannonUntil = 0;
  let pulseWasActive = false; // 2026-07-01: active→inactive edge latch for onPulseStart/onPulseEnd
  let pulseFiring = false; // input currently held → streaming shots
  let nextPulseShotAt = 0;
  let pulseBurstIndex = 0; // 0/1 within a pair (1 == mid-pair, use the short delay)
  let pulseSweepPhase = 0; // oscillator driving the left↔right turret sweep
  let pulseFireToggle = 0; // alternates the fire1/fire2 report
  let lastPulseFireHapticAt = 0; // 2026-07-02: throttles the per-shot pulse-fire haptic (bridge flood guard)
  let pulseMarksmanTick = 0; // 2026-07-01: throttles pulse hits fed into the marksman combo (1 of 3)
  let _pulseShot = false; // set around resolveShotAt so the projectile renders as a pulse bolt
  const pulseMuzzle = { active: false, x: 0, y: 0, angle: 0, recoil: 0, phase: 0 };
  const pulseCannonActive = () => performance.now() < pulseCannonUntil;
  // 2026-06-10: freeze is now a collectible inventory item activated from the HUD (like bombs)
  let playerFreezeInventory = 0;
  const MAX_FREEZE_INVENTORY = 3;
  const FREEZE_DURATION_MS = 12000;
  // 2026-06-23: a running freeze no longer fully stops the perimeter clock — it runs it at
  // FREEZE_TIMER_SLOW (0.25x), then ramps back to full speed over the final FREEZE_TIMER_RAMP_MS
  // of the bank so the timer eases back to normal as the freeze runs out (no abrupt snap).
  const FREEZE_TIMER_SLOW = 0.25;
  const FREEZE_TIMER_RAMP_MS = 3000;
  // 2026-06-21: freeze is a PAUSABLE TIMER, not an on/off toggle. Spending one charge banks
  // FREEZE_DURATION_MS of freeze time; tapping pauses (time stays banked) / resumes (no new charge);
  // the freeze fully ends only when the bank drains to 0 (auto-expiry) or the level resets.
  let _freezeBankMs = 0;        // remaining banked freeze time (ms); 0 == nothing to resume
  let _freezeActive = false;    // true == freeze running (clock paused); false == paused or empty
  // 2026-07-03: strobe the timer perimeter for exactly one training VO line ("First — the perimeter
  // timer…"). Set true by that line's onStart, cleared when the next VO line begins (see pumpSpc).
  let _perimeterVoFlash = false;
  let _freezeSessionId = 0;     // bumped only on a fresh activation (NOT on resume) — cold-toss gliders
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
  let pulseForceSpawnedThisLevel = 0; // 2026-07-01: Pulse Cannon drops placed this level (see SECOND_PULSE_LEVELS)
  // 2026-06-16: per-level emergency timer drop — on the listed levels, when the clock first
  // dips under 20s with no timer powerup on screen, force one out (reset in clearGameplayEntities).
  let emergencyTimerSpawned = false;
  const EMERGENCY_TIMER_LEVELS = [6, 9, 11, 14, 15];
  // 2026-06-16: cfg.guaranteedSpawn = [{type, atMs}] — force-spawn a powerup once its atMs elapses.
  // Tracks which entries (by index) have already fired this level.
  const firedGuaranteedSpawns = new Set();
  // 2026-06-23: cfg.waves = [{count, triggerAtRemaining}] — second-wave surge spawning. Tracks
  // which wave entries (by index) have already burst this level. Re-armed in clearGameplayEntities.
  const firedWaves = new Set();
  // 2026-06-16: cfg.speedEscalation (L15) — live asteroids ramp speed with elapsed time. We track
  // the last-applied factor and scale all asteroids by the per-tick delta ratio (clamped to 2.5x).
  let appliedSpeedEscalation = 1;
  // missile blast = 50% of the bomb's full blast radius (explodeMineEntity uses 700)
  const MISSILE_BLAST_RADIUS = 350;
  // DEBUG: revert before release — missile unlocks at level >= 5 (currently >= 1)
  const missileUnlocked = (level) => level >= 1;
  // 2026-07-01: Pulse Cannon unlocks at level >= 5 (drop to >= 1 temporarily to test on low levels).
  const pulseUnlocked = (level) => level >= 5;
  let nextBombPowerupAt = performance.now()
    + BOMB_POWERUP_INTERVAL_MIN
    + Math.random() * (BOMB_POWERUP_INTERVAL_MAX - BOMB_POWERUP_INTERVAL_MIN);

  function pickPowerupType(level = 99) {
    // 2026-06-14: the missile only enters the pool once unlocked for this level.
    const pool = POWERUP_WEIGHTS.filter(
      (w) => (w.type !== "missile" || missileUnlocked(level))
        && (w.type !== "pulse" || pulseUnlocked(level)),
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
    // 2026-07-01: gold-bar powerups pile up (disruptive once the token bank is deep), so ~half of
    // them get a SHORT grab window (GOLDBAR_SHORT_LIFETIME_MS) instead of the full lifetime — you
    // have to be quick to bank the extra ones. Every other powerup keeps the standard lifetime.
    const lifeMs = normalized === "goldbars" && Math.random() < 0.5
      ? GOLDBAR_SHORT_LIFETIME_MS
      : BOMB_POWERUP_LIFETIME_MS;
    powerups.push({
      type: normalized,
      x: pt.x,
      y: pt.y,
      r: 22,
      spawnedAt: performance.now(),
      lifeMs,
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
  let _musicRampFired = false; // 2026-06-24: one-shot guard for cfg.musicRamp per level
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
  // 2026-06-25: kill-burst boom coalescer. Several asteroid deaths landing within a few ms (quad-shot
  // cluster, bomb chains, split cascades) used to each fire their own boom — they phase-stack into mud
  // AND churn audio nodes mid-frame (the dominant audio cost). Instead: play the FIRST boom of a burst
  // live (instant feedback), swallow the rest, and at the window's end fire ONE "cluster" boom scaled
  // by how many were swallowed — so a multi-kill feels BIGGER (not randomly quieter, which is what the
  // old iOS 2-per-frame / 80ms drop did) for a fraction of the node churn.
  const BOOM_BURST_WINDOW_MS = 60;
  let _boomBurstOpen = false;
  let _boomBurstCount = 0;
  let _boomBurstVol = 0;
  let _boomBurstTimer = null;
  let scoreRenderRaf = 0;
  let warningActive = false;
  let warningLoopHandle = null;
  let warningHapticInterval = null;
  let arcadeLives = 0;
  let arcadeScore = 0;
  let arcadeScoreAtLevelStart = 0;
  // 2026-07-02: gold-bar slot tokens picked up during a run must NOT survive a lost-life retry.
  // Snapshot the bank at each level start (always 0 in practice — the prior level's tokens are spent
  // at the slot before advancing) and restore it on Retry so the failed attempt's pickups are erased.
  let slotTokensAtLevelStart = 0;
  let shotsFired = 0;
  let shotsHit = 0;
  let ufosKilledThisLevel = 0;
  let comboBonusThisLevel = 0;
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
  const comboFxSheet = {
    img: new Image(),
    ready: false,
    frameWidth: 128,
    frameHeight: 128,
    frameCount: 12,
    columns: 12,
    fps: 30,
    padding: 2,
  };
  comboFxSheet.img.onload = () => { comboFxSheet.ready = true; };
  comboFxSheet.img.onerror = () => { comboFxSheet.ready = false; };
  comboFxSheet.img.src = "combo_fx/2_electric_elements.png";
  const bigStroidFxSheet = {
    img: new Image(),
    ready: false,
    frameWidth: 128,
    frameHeight: 128,
    frameCount: 12,
    columns: 12,
    fps: 30,
    padding: 2,
  };
  bigStroidFxSheet.img.onload = () => { bigStroidFxSheet.ready = true; };
  bigStroidFxSheet.img.onerror = () => { bigStroidFxSheet.ready = false; };
  bigStroidFxSheet.img.src = "combo_fx/1_electric_elements.png";
  const smallStroidFxSheet = {
    img: new Image(),
    ready: false,
    frameWidth: 128,
    frameHeight: 128,
    frameCount: 16,
    columns: 15,
    fps: 30,
    padding: 2,
  };
  smallStroidFxSheet.img.onload = () => { smallStroidFxSheet.ready = true; };
  smallStroidFxSheet.img.onerror = () => { smallStroidFxSheet.ready = false; };
  smallStroidFxSheet.img.src = "combo_fx/2d_cartoon_fx_electricity_5.png";
  const powerupPickupFxSheet = {
    img: new Image(),
    ready: false,
    frameWidth: 128,
    frameHeight: 128,
    frameCount: 16,
    columns: 15,
    fps: 30,
    padding: 2,
  };
  powerupPickupFxSheet.img.onload = () => { powerupPickupFxSheet.ready = true; };
  powerupPickupFxSheet.img.onerror = () => { powerupPickupFxSheet.ready = false; };
  powerupPickupFxSheet.img.src = "combo_fx/2d_cartoon_fx_electricity_33.png";
  const powerupPickupFlashSheet = {
    img: new Image(),
    ready: false,
    frameWidth: 128,
    frameHeight: 128,
    frameCount: 16,
    columns: 15,
    fps: 30,
    padding: 2,
  };
  powerupPickupFlashSheet.img.onload = () => { powerupPickupFlashSheet.ready = true; };
  powerupPickupFlashSheet.img.onerror = () => { powerupPickupFlashSheet.ready = false; };
  powerupPickupFlashSheet.img.src = "combo_fx/5_electric_elements.png";
  const explosiveElectricFxSheet = powerupPickupFlashSheet;
  // 2026-07-02: Pulse Cannon fire signature — an expanding teal electric ring stamped at each
  // swept shot point (replaces the old orbiting muzzle orb that read as a "phantom circle").
  const pulseFireFxSheet = {
    img: new Image(),
    ready: false,
    frameWidth: 128,
    frameHeight: 128,
    frameCount: 12,
    columns: 12,
    fps: 30,
    padding: 2,
  };
  pulseFireFxSheet.img.onload = () => { pulseFireFxSheet.ready = true; };
  pulseFireFxSheet.img.onerror = () => { pulseFireFxSheet.ready = false; };
  pulseFireFxSheet.img.src = "combo_fx/4_electric_elements.png";
  // 2026-06-30: top-level hook for the WARMING UP screen — pre-decode + GPU-prime every
  // gameplay sprite so first combo / first powerup pickup / first tinted-rock level no longer
  // trigger a one-off decode+upload frame drop. warmImageSet (img.decode + timeout) is the
  // top-level helper; the 1px drawImage forces the texture upload ahead of first real draw.
  warmGameplaySprites = async function warmGameplaySpritesImpl() {
    // Build the generated tint skins now so their toDataURL-backed Images exist to be warmed
    // too — otherwise the first tinted-rock level (L3/L8/L12/L14) still hitches on first draw.
    try { buildGeneratedAsteroidSprites(); } catch {}
    // Slot symbols too: the old slotSprites warm in warmArcadeAssets was dead (its guard
    // referenced closure-local symbols from top-level scope, always false), so the slot art
    // decoded on first slot-machine reveal — that's the between-level slot lag. Warm it here.
    try { ensureSlotSprites(); } catch {}
    try { await ensureSlotCabinetArt(); } catch {}
    try { slotPrimeReelCaches(); } catch {}
    const sprites = Object.assign({}, asteroidSprites, powerupSprites, slotSprites);
    [comboFxSheet, bigStroidFxSheet, smallStroidFxSheet, powerupPickupFxSheet, powerupPickupFlashSheet, pulseFireFxSheet]
      .forEach((s, i) => { if (s && s.img) sprites["_fx" + i] = s.img; });
    await warmImageSet(sprites);
    try {
      const primeCv = document.createElement("canvas");
      primeCv.width = 1;
      primeCv.height = 1;
      const primeCtx = primeCv.getContext("2d");
      if (primeCtx) {
        for (const img of Object.values(sprites)) {
          if (img && img.complete && img.naturalWidth > 0) {
            try { primeCtx.drawImage(img, 0, 0, 1, 1); } catch {}
          }
        }
      }
    } catch {}
  };
  const COMBO_BANNER_TTL_MS = isIOSNative ? 2200 : 2400;
  const COMBO_BANNER_FADE_START = 0.26;
  const COMBO_BANNER_BLAST_START = 0.34;
  const COMBO_MAX_BANNERS = 2;
  let comboBanners = [];
  let comboFxParticles = [];
  let smallStroidBursts = [];
  let mediumStroidBursts = []; // 2026-07-01: medium (kind 2) kills now get a sprite burst too, with per-hit aspect/rotation variety
  let bigStroidBursts = [];
  let explosiveElectricBursts = [];
  let powerupPickupBursts = [];
  let pulseFireBursts = []; // 2026-07-02: teal electric-ring bursts stamped at each Pulse Cannon shot
  const fxTintCanvas = document.createElement("canvas");
  const fxTintCtx = fxTintCanvas.getContext("2d", { alpha: true });
  let comboBlastSeq = 0;
  const comboBombBlastAwarded = new Set();
  const comboState = {
    marksmanHits: 0,
    marksmanAwarded: false,
    plasmaStage: 0,
    freezeSessionId: -1,
    freezeKills: 0,
    freezeAwarded: false,
    pyroChain: 0,
    pyroAwarded2: false,
    pyroAwarded3: false,
  };
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
    // halt the logo's idle shimmer rAF whenever we leave the Select Mode menu (save battery)
    if (mode !== "menu") menuLogoWarp.stop();
  }

  function renderLives() {
    if (!hudLives) return;
    hudLives.textContent = `Lives: ${arcadeLives}`;
  }

  function renderScore() {
    if (slotEls.scoreVal) slotEls.scoreVal.textContent = String(arcadeScore);
    if (!hudScore) return;
    hudScore.textContent = `Score: ${arcadeScore}`;
    const beatsFirst = Number.isFinite(leaderboardThresholds.firstScore)
      && arcadeScore > leaderboardThresholds.firstScore;
    const beatsThird = Number.isFinite(leaderboardThresholds.thirdScore)
      && arcadeScore > leaderboardThresholds.thirdScore;
    hudScore.classList.toggle("score-glow-amber", beatsFirst);
    hudScore.classList.toggle("score-glow-teal", !beatsFirst && beatsThird);
  }
  window.addEventListener("polyLeaderboardThresholdsReady", renderScore);

  function updateHudBombInventory() {
    if (!hudBombBtn) return;
    // 2026-06-09: always visible — grayed-out empty slot at 0, full + count when stocked.
    const hasBombs = playerBombInventory > 0;
    hudBombBtn.style.display = "";
    // 2026-07-01: icon lives in a static <img>; only the count text updates (was an emoji glyph).
    if (hudBombCount) hudBombCount.textContent = `\xD7${playerBombInventory}`;
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
    // 2026-06-23: freeze is a pausable banked timer, so inventory can read 0 while a paused
    // freeze is still resumable. That state used to show a dead-looking "❄ ×0"; show a paused
    // glyph + lit pulsing glow instead so the player knows there's freeze left to tap.
    const pausedWithBank = !_freezeActive && _freezeBankMs > 0;
    // 2026-07-01: snowflake icon lives in a static <img>; the count span shows the state text.
    // "ON" while running (still tappable to unfreeze); "❚❚" while paused-with-bank; else the count.
    if (hudFreezeCount) {
      hudFreezeCount.textContent = _freezeActive
        ? "ON"
        : pausedWithBank
          ? "❚❚"
          : `\xD7${playerFreezeInventory}`;
    }
    // Keep enabled while there's banked time to pause/resume, even with empty inventory.
    hudFreezeBtn.disabled = !hasFreezes && _freezeBankMs <= 0;
    hudFreezeBtn.classList.toggle("has-freezes", hasFreezes);
    hudFreezeBtn.classList.toggle("freeze-paused", pausedWithBank);
    // 2026-06-22: truly-out state (no charges, not running, nothing banked) gets a distinct
    // depleted look so the player can read "no freeze left" at a glance, not just "×0".
    const isEmpty = !hasFreezes && !_freezeActive && _freezeBankMs <= 0;
    hudFreezeBtn.classList.toggle("is-empty", isEmpty);
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
    // 2026-07-01: rocket icon lives in a static <img>; only the count text updates (was 🚀 glyph).
    const label = `\xD7${count}`;
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

  // Pulse Cannon HUD badge — mirrors the quad badge (art + seconds remaining). Unlike quad, this
  // badge is TAPPABLE: tapping it cancels the weapon early (see cancelPulseCannon wiring below).
  function updateHudPulseBadge() {
    const remaining = pulseCannonUntil - performance.now();
    const active = remaining > 0;
    // 2026-07-01: natural-expiry edge — runs before the badge guard so the disarm cue + music
    // swell-back fire even if the HUD element is missing. onPulseEnd is latch-guarded (idempotent).
    if (!active && pulseWasActive) onPulseEnd();
    if (!hudPulseBadge) return;
    hudPulseBadge.classList.toggle("active", active);
    hudPulseBadge.setAttribute("aria-hidden", active ? "false" : "true");
    if (active && hudPulseTime) {
      const label = `${Math.ceil(remaining / 1000)}s`;
      if (hudPulseTime.textContent !== label) hudPulseTime.textContent = label;
    }
  }

  // 2026-07-02: Player tapped the Quad Shot badge — forfeit any remaining cluster-fire time.
  // Mirrors cancelPulseCannon; guarded against the training lesson by the controller export.
  function cancelQuadShot() {
    if (quadShotUntil <= performance.now()) return;
    quadShotUntil = 0;
    updateHudQuadBadge();
  }

  // Player tapped the Pulse Cannon badge — forfeit any remaining duration and stop firing at once.
  function cancelPulseCannon() {
    if (!pulseCannonActive()) return;
    pulseCannonUntil = 0;
    stopPulseFiring();
    onPulseEnd(); // disarm cue + music swell-back (idempotent; edge already flipped)
    updateHudPulseBadge();
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

  function resetComboState() {
    comboState.marksmanHits = 0;
    comboState.marksmanAwarded = false;
    comboState.plasmaStage = 0;
    comboState.freezeSessionId = _freezeSessionId;
    comboState.freezeKills = 0;
    comboState.freezeAwarded = false;
    comboState.pyroChain = 0;
    comboState.pyroAwarded2 = false;
    comboState.pyroAwarded3 = false;
    comboBanners.length = 0;
    comboFxParticles.length = 0;
    smallStroidBursts.length = 0;
    mediumStroidBursts.length = 0;
    bigStroidBursts.length = 0;
    explosiveElectricBursts.length = 0;
    powerupPickupBursts.length = 0;
    pulseFireBursts.length = 0;
    comboBombBlastAwarded.clear();
  }

  function breakPyroCombo() {
    comboState.pyroChain = 0;
    comboState.pyroAwarded2 = false;
    comboState.pyroAwarded3 = false;
  }

  function breakNetUfoNetCombo() {
    comboState.plasmaStage = 0;
  }

  function spawnComboParticles(x, y, colors) {
    if (prefersReducedMotion) return;
    const maxParts = isIOSNative ? 18 : 54;
    const room = Math.max(0, maxParts - comboFxParticles.length);
    const count = Math.min(room, isIOSNative ? 8 : 28);
    for (let i = 0; i < count; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = 90 + Math.random() * (isIOSNative ? 180 : 260);
      comboFxParticles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0,
        ttl: 420 + Math.random() * 360,
        size: 1.4 + Math.random() * 2.4,
        color: colors[(Math.random() * colors.length) | 0],
      });
    }
  }

  function spawnSmallStroidBurst(x, y) {
    if (prefersReducedMotion || !smallStroidFxSheet.ready) return;
    const maxBursts = isIOSNative ? 5 : 9;
    if (smallStroidBursts.length >= maxBursts) smallStroidBursts.shift();
    smallStroidBursts.push({
      x,
      y,
      start: performance.now(),
      ttl: isIOSNative ? 360 : 440,
      scale: 0.52 + Math.random() * 0.18,
      rot: Math.random() * Math.PI * 2,
      flickerSeed: Math.random() * Math.PI * 2,
    });
  }

  function explosionTintForSprite(spriteKey) {
    if (spriteKey === "roid02") return "rgba(90,150,255,0.72)";
    if (spriteKey === "roid03") return "rgba(255,180,45,0.68)";
    if (spriteKey === "hotroid01") return "rgba(255,76,22,0.62)";
    const _lvl = engineMode === "arcade" ? (ARCADE_LEVELS[currentLevelIndex]?.level || 1) : 1;
    const levelTint = getAsteroidTintForLevel(_lvl);
    if (levelTint) return levelTint;
    return "rgba(0,255,209,0.72)";
  }

  function spawnBigStroidBurst(x, y, blastScale = 1, spriteKey = "roid01") {
    if (prefersReducedMotion || !bigStroidFxSheet.ready) return;
    const maxBursts = isIOSNative ? 4 : 7;
    if (bigStroidBursts.length >= maxBursts) bigStroidBursts.shift();
    bigStroidBursts.push({
      x,
      y,
      start: performance.now(),
      ttl: isIOSNative ? 420 : 520,
      scale: clamp(0.98 * blastScale, 1.05, 1.95) * (0.92 + Math.random() * 0.18),
      rot: Math.random() * Math.PI * 2,
      tint: explosionTintForSprite(spriteKey),
      flickerSeed: Math.random() * Math.PI * 2,
    });
  }

  // 2026-07-01: medium asteroids previously had no sprite burst (only particle chunks). Reuse the big
  // burst artwork but randomize X scale, Y scale (independent → circle vs ellipse) and rotation per hit
  // so repeated medium kills don't look identical. scaleX/scaleY diverge to stretch the sprite.
  function spawnMediumStroidBurst(x, y, spriteKey = "roid01") {
    if (prefersReducedMotion || !bigStroidFxSheet.ready) return;
    const maxBursts = isIOSNative ? 4 : 7;
    if (mediumStroidBursts.length >= maxBursts) mediumStroidBursts.shift();
    mediumStroidBursts.push({
      x,
      y,
      start: performance.now(),
      ttl: isIOSNative ? 380 : 460,
      scaleX: 0.82 + Math.random() * 0.55, // ~0.82–1.37
      scaleY: 0.82 + Math.random() * 0.55, // independent of scaleX → aspect variety
      rot: Math.random() * Math.PI * 2,
      tint: explosionTintForSprite(spriteKey),
      flickerSeed: Math.random() * Math.PI * 2,
    });
  }

  function powerupPickupTint(type) {
    if (type === "timer") return "rgba(255,255,255,0.82)";
    if (type === "missile") return "rgba(255,78,78,0.78)";
    if (type === "goldbars") return "rgba(255,215,0,0.82)";
    if (type === "quadshot") return "rgba(204,102,255,0.82)";
    if (type === "snowflake") return "rgba(136,221,255,0.82)";
    if (type === "bomb") return "rgba(0,255,204,0.82)";
    return POWERUP_COLORS[type] || "rgba(0,255,204,0.82)";
  }

  function spawnPowerupPickupBurst(pu) {
    if (prefersReducedMotion || !powerupPickupFxSheet.ready || !pu) return;
    const maxBursts = isIOSNative ? 5 : 9;
    if (powerupPickupBursts.length >= maxBursts) powerupPickupBursts.shift();
    powerupPickupBursts.push({
      x: pu.x,
      y: pu.y,
      start: performance.now(),
      ttl: isIOSNative ? 250 : 320,
      scale: pu.type === "bomb" ? 1.32 : 1.17,
      rot: Math.random() * Math.PI * 2,
      flashRot: Math.random() * Math.PI * 2,
      flashScale: 0.84 + Math.random() * 0.24,
      flashAlpha: 0.58 + Math.random() * 0.28,
      tint: powerupPickupTint(pu.type),
      flickerSeed: Math.random() * Math.PI * 2,
    });
  }

  function spawnExplosiveElectricBurst(x, y, radius = 180, count = 5) {
    if (prefersReducedMotion || !explosiveElectricFxSheet.ready) return;
    const maxBursts = isIOSNative ? 8 : 14;
    while (explosiveElectricBursts.length > Math.max(0, maxBursts - count)) explosiveElectricBursts.shift();
    const colors = [
      "rgba(255,38,0,0.82)",
      "rgba(255,126,0,0.82)",
      "rgba(255,224,40,0.82)",
    ];
    for (let i = 0; i < count; i += 1) {
      const ang = Math.random() * Math.PI * 2;
      const dist = radius * (0.12 + Math.random() * 0.42);
      explosiveElectricBursts.push({
        x: x + Math.cos(ang) * dist,
        y: y + Math.sin(ang) * dist,
        start: performance.now() + Math.random() * 80,
        ttl: 360 + Math.random() * 180,
        scale: 1.0 + Math.random() * 0.7,
        rot: Math.random() * Math.PI * 2,
        spin: (Math.random() < 0.5 ? -1 : 1) * (0.35 + Math.random() * 0.8),
        tint: colors[(Math.random() * colors.length) | 0],
        flickerSeed: Math.random() * Math.PI * 2,
      });
    }
  }

  // 2026-07-02: stamp one expanding teal electric ring at a Pulse Cannon shot point (sx, sy).
  // Called per shot; capped + skipped under frame pressure so the ~12 shots/s stream can't tank FPS.
  function spawnPulseFireBurst(x, y) {
    if (prefersReducedMotion || !pulseFireFxSheet.ready) return;
    if (isIOSNative && sim._frameBudgetExceeded) return; // self-throttle when the frame is already tight
    const maxBursts = isIOSNative ? 6 : 10;
    if (pulseFireBursts.length >= maxBursts) pulseFireBursts.shift();
    pulseFireBursts.push({
      x,
      y,
      start: performance.now(),
      ttl: isIOSNative ? 240 : 280,
      scale: 0.9 + Math.random() * 0.3,
      rot: Math.random() * Math.PI * 2, // random rotation per shot
      tint: "rgba(90,255,225,0.85)", // laser-fire teal
      flickerSeed: Math.random() * Math.PI * 2,
    });
  }

  function fastFxFlicker(now, seed = 0, depth = 0.24) {
    const a = Math.sin(now * 0.12 + seed) * 0.5 + 0.5;
    const b = Math.sin(now * 0.27 + seed * 1.7) * 0.5 + 0.5;
    return clamp(1 - depth + (a * 0.65 + b * 0.35) * depth * 2, 0.45, 1.62);
  }

  // 2026-07-01: sizeY lets callers draw the frame as an ellipse (non-square) for per-explosion aspect
  // variety; defaults to `size` (square) so all existing callers are unchanged.
  function drawFxSheetFrame(drawCtx, sheet, frame, x, y, size, rot = 0, tint = "", sizeY = size) {
    const sx = (frame % sheet.columns) * (sheet.frameWidth + sheet.padding);
    const sy = Math.floor(frame / sheet.columns) * (sheet.frameHeight + sheet.padding);
    drawCtx.translate(x, y);
    drawCtx.rotate(rot);
    if (tint && fxTintCtx) {
      if (fxTintCanvas.width !== sheet.frameWidth || fxTintCanvas.height !== sheet.frameHeight) {
        fxTintCanvas.width = sheet.frameWidth;
        fxTintCanvas.height = sheet.frameHeight;
      }
      fxTintCtx.clearRect(0, 0, sheet.frameWidth, sheet.frameHeight);
      fxTintCtx.globalCompositeOperation = "source-over";
      fxTintCtx.globalAlpha = 1;
      fxTintCtx.drawImage(sheet.img, sx, sy, sheet.frameWidth, sheet.frameHeight, 0, 0, sheet.frameWidth, sheet.frameHeight);
      fxTintCtx.globalCompositeOperation = "source-atop";
      fxTintCtx.fillStyle = tint;
      fxTintCtx.fillRect(0, 0, sheet.frameWidth, sheet.frameHeight);
      fxTintCtx.globalCompositeOperation = "source-over";
      drawCtx.drawImage(fxTintCanvas, -size / 2, -sizeY / 2, size, sizeY);
    } else {
      drawCtx.drawImage(
        sheet.img,
        sx,
        sy,
        sheet.frameWidth,
        sheet.frameHeight,
        -size / 2,
        -sizeY / 2,
        size,
        sizeY,
      );
    }
    drawCtx.setTransform(sim.dpr, 0, 0, sim.dpr, 0, 0);
  }

  function playComboSfx(key) {
    const sfxKey = `combo_${key}`;
    if (!GAME_SFX[sfxKey]) return;
    // 2026-07-01: the net-ufo-net callout sat too hot in the mix — trim just this one.
    let [v1, v2] = key === "net_ufo_net" ? [0.85, 0.18] : [0.98, 0.24];
    // 2026-07-02: combo callouts read much quieter on iPad than on iPhone (they ride the HTML-audio
    // path for the pitch-preserved speed-up, and that element volume lands softer in iPad's mix).
    // Push the iPad class up toward the ceiling so the callout matches iPhone loudness; iPhone,
    // already "very loud," is left as-is.
    if (isIPadClass) { v1 = Math.min(1, v1 * 1.7); v2 = Math.min(1, v2 * 1.7); }
    playGameSfx(sfxKey, v1, { rate: 1.45, preservePitch: true, important: true });
    setTimeout(() => playGameSfx(sfxKey, v2, { rate: 1.55, preservePitch: true, important: true }), 70);
  }

  function awardCombo({ key, label, points, x, y, colors = ["0,255,209", "186,110,255"] }) {
    if (engineMode !== "arcade" || !arcadeActive) return;
    if (stuntActive) return;
    const now = performance.now();
    const marginX = Math.max(18, sim.width * 0.06);
    const marginY = Math.max(54, sim.height * 0.12);
    const preferredX = key === "marksman" ? sim.width / 2 : (Number.isFinite(x) ? x : sim.width / 2);
    const preferredY = Number.isFinite(y) ? y : sim.height * 0.36;
    const cx = clamp(preferredX, marginX, Math.max(marginX, sim.width - marginX));
    let cy = clamp(preferredY, marginY, Math.max(marginY, sim.height - marginY));
    const commRect = document.getElementById("commanderHUD")?.getBoundingClientRect();
    const canvasRect = galaxyPlayCanvas?.getBoundingClientRect();
    const commVisible = commRect && canvasRect && commRect.width > 20 && commRect.height > 20
      && commRect.bottom > canvasRect.top && commRect.top < canvasRect.bottom;
    if (commVisible) {
      const commTop = commRect.top - canvasRect.top - 18;
      const commBottom = commRect.bottom - canvasRect.top + 18;
      const bannerHalfH = 58;
      const overlapsY = cy + bannerHalfH > commTop && cy - bannerHalfH < commBottom;
      const bannerHalfW = Math.min(Math.max(220, sim.width - 28), sim.width - 28) / 2;
      const commLeft = commRect.left - canvasRect.left - 18;
      const commRight = commRect.right - canvasRect.left + 18;
      const overlapsX = cx + bannerHalfW > commLeft && cx - bannerHalfW < commRight;
      if (overlapsX && overlapsY) {
        const above = commTop - bannerHalfH;
        const below = commBottom + bannerHalfH;
        cy = above >= marginY
          ? above
          : clamp(below, marginY, Math.max(marginY, sim.height - marginY));
      }
    }
    addArcadeScore(points);
    comboBonusThisLevel += points;
    comboBanners.push({
      key,
      label,
      points,
      x: cx,
      y: cy,
      start: now,
      colors,
    });
    if (comboBanners.length > COMBO_MAX_BANNERS) {
      comboBanners.splice(0, comboBanners.length - COMBO_MAX_BANNERS);
    }
    spawnComboParticles(cx, cy, colors);
    cssFlash(`rgba(${colors[0]},1)`, isIOSNative ? 0.14 : 0.22, 180);
    cssShake(isIOSNative ? 0.55 : 0.85);
    triggerGameplayHapticImpact(points >= 1000 ? hapticImpactStyle.Heavy : hapticImpactStyle.Medium);
    playGameSfx(points >= 1000 ? "level_up" : "bling", points >= 1000 ? 0.82 : 0.75, { important: true });
    playGameSfx("slot_life", 1.24, { important: true });
    playComboSfx(key);
  }

  function drawComboFxOverlay(drawCtx, now) {
    if (!drawCtx) return;
    const underFramePressure = isIOSNative && !!sim._frameBudgetExceeded;
    if (!underFramePressure && explosiveElectricBursts.length && explosiveElectricFxSheet.ready) {
      drawCtx.save();
      drawCtx.globalCompositeOperation = "lighter";
      for (let i = explosiveElectricBursts.length - 1; i >= 0; i -= 1) {
        const b = explosiveElectricBursts[i];
        const age = now - b.start;
        if (age < 0) continue;
        const t = clamp(age / b.ttl, 0, 1);
        if (t >= 1) {
          explosiveElectricBursts.splice(i, 1);
          continue;
        }
        const frame = Math.min(explosiveElectricFxSheet.frameCount - 1, Math.floor(t * explosiveElectricFxSheet.frameCount * 2.25));
        const pop = t < 0.22 ? 0.75 + (t / 0.22) * 0.5 : 1.25 - (t - 0.22) * 0.28;
        const fade = 1 - Math.max(0, t - 0.52) / 0.48;
        const size = (isIOSNative ? 128 : 154) * b.scale * pop;
        drawCtx.globalAlpha = clamp(0.8 * fade * fastFxFlicker(now, b.flickerSeed, 0.5), 0, 0.8);
        drawFxSheetFrame(drawCtx, explosiveElectricFxSheet, frame, b.x, b.y, size, b.rot + b.spin * t, b.tint);
      }
      drawCtx.restore();
    }
    // 2026-07-02: Pulse Cannon fire rings — the expanding teal electric burst at each shot point,
    // sized to the X-blast, random rotation, opacity flickering. Additive so it glows over the X.
    if (!underFramePressure && pulseFireBursts.length && pulseFireFxSheet.ready) {
      drawCtx.save();
      drawCtx.globalCompositeOperation = "lighter";
      for (let i = pulseFireBursts.length - 1; i >= 0; i -= 1) {
        const b = pulseFireBursts[i];
        const t = clamp((now - b.start) / b.ttl, 0, 1);
        if (t >= 1) {
          pulseFireBursts.splice(i, 1);
          continue;
        }
        const frame = Math.min(pulseFireFxSheet.frameCount - 1, Math.floor(t * pulseFireFxSheet.frameCount));
        const size = (isIOSNative ? 92 : 108) * b.scale; // 2026-07-02: ~2x bigger — readable under the thumb (playtest)
        const fade = 1 - t; // expands + fades over its short life
        drawCtx.globalAlpha = clamp(0.95 * fade * fastFxFlicker(now, b.flickerSeed, 0.5), 0, 0.95);
        drawFxSheetFrame(drawCtx, pulseFireFxSheet, frame, b.x, b.y, size, b.rot, b.tint);
      }
      drawCtx.restore();
    }
    if (!underFramePressure && powerupPickupBursts.length && powerupPickupFxSheet.ready) {
      drawCtx.save();
      drawCtx.globalCompositeOperation = "lighter";
      for (let i = powerupPickupBursts.length - 1; i >= 0; i -= 1) {
        const b = powerupPickupBursts[i];
        const t = clamp((now - b.start) / b.ttl, 0, 1);
        if (t >= 1) {
          powerupPickupBursts.splice(i, 1);
          continue;
        }
        const frame = Math.min(powerupPickupFxSheet.frameCount - 1, Math.floor(t * powerupPickupFxSheet.frameCount * 2.2));
        const pop = t < 0.42 ? 1 + t / 0.42 * 0.48 : 1.48 - ((t - 0.42) / 0.58) * 0.30;
        const size = (isIOSNative ? 111 : 132) * b.scale * pop;
        const fade = 1 - Math.max(0, t - 0.54) / 0.46;
        const flicker = fastFxFlicker(now, b.flickerSeed, 0.42);
        drawCtx.globalAlpha = clamp(1.08 * fade * flicker, 0, 1);
        drawFxSheetFrame(drawCtx, powerupPickupFxSheet, frame, b.x, b.y, size, b.rot, b.tint);
        if (powerupPickupFlashSheet.ready) {
          const flashFrame = Math.min(powerupPickupFlashSheet.frameCount - 1, Math.floor(t * powerupPickupFlashSheet.frameCount * 2.55));
          const flashSize = (isIOSNative ? 102 : 123) * b.scale * b.flashScale * pop;
          drawCtx.globalAlpha = clamp((b.flashAlpha + 0.18) * fade * fastFxFlicker(now, b.flickerSeed + 2.4, 0.52), 0, 1);
          drawFxSheetFrame(drawCtx, powerupPickupFlashSheet, flashFrame, b.x, b.y, flashSize, b.flashRot + t * 0.55, b.tint);
        }
      }
      drawCtx.restore();
    }
    if (!underFramePressure && bigStroidBursts.length && bigStroidFxSheet.ready) {
      drawCtx.save();
      drawCtx.globalCompositeOperation = "lighter";
      for (let i = bigStroidBursts.length - 1; i >= 0; i -= 1) {
        const b = bigStroidBursts[i];
        const t = clamp((now - b.start) / b.ttl, 0, 1);
        if (t >= 1) {
          bigStroidBursts.splice(i, 1);
          continue;
        }
        const frame = Math.min(bigStroidFxSheet.frameCount - 1, Math.floor(t * bigStroidFxSheet.frameCount * 1.65));
        const size = (isIOSNative ? 41 : 52) * b.scale * (1.08 + t * 0.18);
        drawCtx.globalAlpha = clamp(0.8 * (1 - Math.max(0, t - 0.72) / 0.28) * fastFxFlicker(now, b.flickerSeed, 0.22), 0, 0.8);
        drawFxSheetFrame(drawCtx, bigStroidFxSheet, frame, b.x, b.y, size, b.rot, b.tint);
      }
      drawCtx.restore();
    }
    if (!underFramePressure && mediumStroidBursts.length && bigStroidFxSheet.ready) {
      drawCtx.save();
      drawCtx.globalCompositeOperation = "lighter";
      for (let i = mediumStroidBursts.length - 1; i >= 0; i -= 1) {
        const b = mediumStroidBursts[i];
        const t = clamp((now - b.start) / b.ttl, 0, 1);
        if (t >= 1) {
          mediumStroidBursts.splice(i, 1);
          continue;
        }
        const frame = Math.min(bigStroidFxSheet.frameCount - 1, Math.floor(t * bigStroidFxSheet.frameCount * 1.6));
        const base = (isIOSNative ? 40 : 50) * (1.06 + t * 0.2);
        drawCtx.globalAlpha = clamp(0.78 * (1 - Math.max(0, t - 0.7) / 0.3) * fastFxFlicker(now, b.flickerSeed, 0.22), 0, 0.8);
        // width = base*scaleX, height = base*scaleY → per-hit ellipse/rotation variety
        drawFxSheetFrame(drawCtx, bigStroidFxSheet, frame, b.x, b.y, base * b.scaleX, b.rot, b.tint, base * b.scaleY);
      }
      drawCtx.restore();
    }
    if (!underFramePressure && smallStroidBursts.length && smallStroidFxSheet.ready) {
      drawCtx.save();
      drawCtx.globalCompositeOperation = "lighter";
      for (let i = smallStroidBursts.length - 1; i >= 0; i -= 1) {
        const b = smallStroidBursts[i];
        const t = clamp((now - b.start) / b.ttl, 0, 1);
        if (t >= 1) {
          smallStroidBursts.splice(i, 1);
          continue;
        }
        const frame = Math.min(smallStroidFxSheet.frameCount - 1, Math.floor(t * smallStroidFxSheet.frameCount * 1.55));
        const size = (isIOSNative ? 82 : 98) * b.scale * (1 + t * 0.28);
        drawCtx.globalAlpha = clamp(0.82 * (1 - Math.max(0, t - 0.68) / 0.32) * fastFxFlicker(now, b.flickerSeed, 0.2), 0, 1);
        drawFxSheetFrame(drawCtx, smallStroidFxSheet, frame, b.x, b.y, size, b.rot);
      }
      drawCtx.restore();
    }
    if (comboFxParticles.length) {
      drawCtx.save();
      drawCtx.globalCompositeOperation = "lighter";
      for (let i = comboFxParticles.length - 1; i >= 0; i -= 1) {
        const p = comboFxParticles[i];
        p.life += 16.67;
        if (p.life >= p.ttl) {
          comboFxParticles.splice(i, 1);
          continue;
        }
        const dt = 1 / 60;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.985;
        p.vy *= 0.985;
        const a = 1 - p.life / p.ttl;
        drawCtx.fillStyle = `rgba(${p.color},${(0.82 * a).toFixed(3)})`;
        drawCtx.beginPath();
        drawCtx.arc(p.x, p.y, p.size * (0.65 + a * 0.5), 0, Math.PI * 2);
        drawCtx.fill();
      }
      drawCtx.restore();
    }
  }

  // Combo BANNERS (headline + points + slam fx) render on the dedicated top-most comboBannerCanvas
  // (above the Commander comm box / HUD) so a combo popup is never hidden behind UI. Owns the
  // comboBanners lifecycle (expiry splices). Ambient combo FX (bursts/particles) stay on ufoFx.
  function drawComboBanners(drawCtx, now) {
    if (!drawCtx || !comboBanners.length) return;
    const underFramePressure = isIOSNative && !!sim._frameBudgetExceeded;
    const compactComboFx = isIOSNative || underFramePressure;
    for (let i = comboBanners.length - 1; i >= 0; i -= 1) {
      const b = comboBanners[i];
      const t = clamp((now - b.start) / COMBO_BANNER_TTL_MS, 0, 1);
      if (t >= 1) {
        comboBanners.splice(i, 1);
        continue;
      }
      const slam = t < 0.18 ? 1.55 - (t / 0.18) * 0.55 : 1 + Math.sin((t - 0.18) * Math.PI * 3) * 0.035 * (1 - t);
      const fadeT = t < COMBO_BANNER_FADE_START
        ? 0
        : clamp((t - COMBO_BANNER_FADE_START) / (1 - COMBO_BANNER_FADE_START), 0, 1);
      const alpha = 1 - (fadeT * fadeT * (3 - 2 * fadeT));
      if (alpha <= 0.015) {
        comboBanners.splice(i, 1);
        continue;
      }
      const y = b.y - t * 24;
      drawCtx.save();
      drawCtx.globalCompositeOperation = "lighter";
      drawCtx.globalAlpha = alpha;
      if (comboFxSheet.ready && !prefersReducedMotion && !compactComboFx) {
        const frame = Math.min(comboFxSheet.frameCount - 1, Math.floor(t * comboFxSheet.frameCount * 1.85));
        const sx = (frame % comboFxSheet.columns) * (comboFxSheet.frameWidth + comboFxSheet.padding);
        const sy = Math.floor(frame / comboFxSheet.columns) * (comboFxSheet.frameHeight + comboFxSheet.padding);
        const size = (isIOSNative ? 190 : 240) * (1.15 - t * 0.25);
        drawCtx.drawImage(
          comboFxSheet.img,
          sx,
          sy,
          comboFxSheet.frameWidth,
          comboFxSheet.frameHeight,
          b.x - size / 2,
          y - size / 2,
          size,
          size,
        );
      }
      drawCtx.textAlign = "center";
      drawCtx.textBaseline = "middle";
      const headline = b.label;
      const sub = `+${b.points} pts`;
      const maxW = Math.max(220, sim.width - 28);
      const safeX = clamp(b.x, 14 + maxW / 2, Math.max(14 + maxW / 2, sim.width - 14 - maxW / 2));
      const safeY = clamp(y, 46, Math.max(46, sim.height - 46));
      const base = clamp(maxW / Math.max(1, headline.length * 0.74), 18, 34);
      drawCtx.font = `900 ${Math.floor(base * slam)}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
      drawCtx.lineWidth = Math.max(4, base * 0.18);
      const glowPulse = 0.54 + 0.46 * Math.abs(Math.sin(now * 0.016 + b.start * 0.003));
      const brandHeadline = `rgb(${b.colors[0]})`;
      const brandSub = `rgb(${b.colors[1] || b.colors[0]})`;
      drawCtx.strokeStyle = "rgba(2,8,18,0.88)";
      drawCtx.shadowColor = `rgba(${b.colors[0]},${(b.key === "marksman" ? 0.34 : 0.78) * glowPulse})`;
      drawCtx.shadowBlur = compactComboFx
        ? 0
        : (b.key === "marksman" ? (isIOSNative ? 4 : 8) : (isIOSNative ? 8 : 18)) * glowPulse;
      drawCtx.fillStyle = brandHeadline;
      drawCtx.strokeText(headline, safeX, safeY, maxW);
      drawCtx.fillText(headline, safeX, safeY, maxW);
      if (!prefersReducedMotion && !compactComboFx && smallStroidFxSheet.ready && t >= COMBO_BANNER_BLAST_START) {
        const headlineWidth = Math.min(maxW, drawCtx.measureText(headline).width * 1.08);
        const blastCount = Math.max(5, Math.min(9, Math.ceil(headlineWidth / Math.max(42, base * 1.55))));
        const blastDuration = 0.36;
        const blastStagger = 0.052;
        drawCtx.save();
        drawCtx.globalCompositeOperation = "lighter";
        for (let j = 0; j < blastCount; j += 1) {
          const local = (t - COMBO_BANNER_BLAST_START - j * blastStagger) / blastDuration;
          if (local < 0 || local > 1) continue;
          const frame = Math.min(smallStroidFxSheet.frameCount - 1, Math.floor(local * smallStroidFxSheet.frameCount * 1.24));
          const x = safeX - headlineWidth / 2 + headlineWidth * ((j + 0.5) / blastCount);
          const yJitter = Math.sin(j * 1.73 + b.start * 0.003) * base * 0.16;
          const size = base * (1.35 + 0.42 * Math.sin((j + 1) * 1.19)) * (1 + local * 0.38);
          drawCtx.globalAlpha = clamp(alpha * (1 - Math.max(0, local - 0.68) / 0.32) * 0.92, 0, 0.92);
          drawFxSheetFrame(drawCtx, smallStroidFxSheet, frame, x, safeY + yJitter, size, j * 0.48);
        }
        drawCtx.restore();
      }
      drawCtx.font = `800 ${Math.floor(base * 0.54 * slam)}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
      drawCtx.shadowColor = `rgba(${b.colors[1] || b.colors[0]},${0.42 * glowPulse})`;
      drawCtx.shadowBlur = (isIOSNative ? 5 : 10) * glowPulse;
      drawCtx.fillStyle = brandSub;
      drawCtx.strokeText(sub, safeX, clamp(safeY + base * 0.82, 66, Math.max(66, sim.height - 24)), maxW);
      drawCtx.fillText(sub, safeX, clamp(safeY + base * 0.82, 66, Math.max(66, sim.height - 24)), maxW);
      drawCtx.restore();
    }
  }

  // Renders combo banners on the top-most layer. Only touches the canvas while a banner is on
  // screen (clearing once when the last one expires) so idle gameplay pays no per-frame cost.
  function drawComboBannersLayer(now) {
    if (!comboBannerCtx) return;
    if (comboBanners.length) {
      comboBannerCtx.clearRect(0, 0, sim.width, sim.height);
      drawComboBanners(comboBannerCtx, now);
      _comboBannerDirty = true;
    } else if (_comboBannerDirty) {
      comboBannerCtx.clearRect(0, 0, sim.width, sim.height);
      _comboBannerDirty = false;
    }
  }

  function recordComboEvent(type, data = {}) {
    if (engineMode !== "arcade" || stuntActive) return;
    const x = Number.isFinite(data.x) ? data.x : sim.width / 2;
    const y = Number.isFinite(data.y) ? data.y : sim.height * 0.34;
    if (type === "laser_stroid_hit") {
      comboState.marksmanHits += 1;
      breakPyroCombo();
      breakNetUfoNetCombo();
      if (comboState.marksmanHits >= 10) {
        comboState.marksmanHits = 0;
        awardCombo({
          key: "marksman",
          label: "MARKSMAN COMBO",
          points: 500,
          x,
          y,
          colors: ["80,220,255", "255,255,255"],
        });
      }
      return;
    }
    if (type === "laser_miss" || type === "laser_non_stroid_hit") {
      comboState.marksmanHits = 0;
      comboState.marksmanAwarded = false;
      breakPyroCombo();
      breakNetUfoNetCombo();
      return;
    }
    if (type === "bomb_tap") {
      comboState.marksmanHits = 0;
      comboState.marksmanAwarded = false;
      breakNetUfoNetCombo();
      return;
    }
    if (type === "ufo_shot") {
      comboState.marksmanHits = 0;
      comboState.marksmanAwarded = false;
      breakPyroCombo();
      if (comboState.plasmaStage === 1) comboState.plasmaStage = 2;
      return;
    }
    if (type === "plasma_net") {
      comboState.marksmanHits = 0;
      breakPyroCombo();
      if ((data.destroyedCount || 0) > 0) {
        if (comboState.plasmaStage === 2) {
          awardCombo({
            key: "net_ufo_net",
            label: "NET-UFO-NET COMBO!",
            points: 1500,
            x,
            y,
            colors: ["0,255,209", "255,85,255"],
          });
          comboState.plasmaStage = 0;
        } else {
          comboState.plasmaStage = 1;
        }
      } else {
        breakNetUfoNetCombo();
      }
      return;
    }
    if (type === "ufo_destroyed") {
      comboState.marksmanHits = 0;
      breakPyroCombo();
      if (comboState.plasmaStage === 1) comboState.plasmaStage = 2;
      return;
    }
    if (type === "bomb_destroyed_stroids") {
      comboState.marksmanHits = 0;
      breakNetUfoNetCombo();
      comboState.pyroChain += 1;
      if (comboState.pyroChain >= 3 && !comboState.pyroAwarded3) {
        comboState.pyroAwarded3 = true;
        awardCombo({
          key: "xtra_pyro",
          label: "XTRA PYRO COMBO",
          points: 2000,
          x,
          y,
          colors: ["255,70,20", "255,220,80"],
        });
      } else if (comboState.pyroChain >= 2 && !comboState.pyroAwarded2) {
        comboState.pyroAwarded2 = true;
        awardCombo({
          key: "pyro",
          label: "PYRO COMBO",
          points: 1000,
          x,
          y,
          colors: ["255,120,30", "255,236,120"],
        });
      }
      return;
    }
    if (type === "frozen_stroid_destroyed") {
      if (comboState.freezeSessionId !== _freezeSessionId) {
        comboState.freezeSessionId = _freezeSessionId;
        comboState.freezeKills = 0;
        comboState.freezeAwarded = false;
      }
      comboState.freezeKills += 1;
      if (comboState.freezeKills > 12 && !comboState.freezeAwarded) {
        comboState.freezeAwarded = true;
        awardCombo({
          key: "freeze_berserk",
          label: "FREEZE BERSERK COMBO",
          points: 1000,
          x,
          y,
          colors: ["150,225,255", "255,255,255"],
        });
      }
    }
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
    const volume = (ARCADE_LEVELS.find((l) => l.level === levelNum)?.musicVolume || 1) * 1.08;
    audioEngine.playMusic(url, url, { crossfadeMs: 250, volume });
    const nextUrl = getMusicForLevel(levelNum + 1);
    // 2026-06-26 EXPERIMENT: also skip the boss-music decode prefetch at L9 so the boss-tier
    // lookahead is fully off for this test (decoded at L10 entry instead). // DEBUG: revert before release
    if (nextUrl && nextUrl !== url && !(SKIP_BOSS_LOOKAHEAD && levelNum + 1 >= 10)) {
      audioEngine.loadMusicBuffer(nextUrl).catch(() => {});
    }
  }

  function playArcadeMenuMusic(opts = {}) {
    audioEngine.unlock();
    const volume = opts.fullVolume ? 1 : 0.72;
    // 2026-07-01: ease the theme in a few dB down and swell to normal over ~5s when the menu first
    // appears (skip the soft intro on the fullVolume path, which is a mid-session resume).
    audioEngine.playMusic("ARCADE_MENU", MUSIC.ARCADE_MENU, { crossfadeMs: 250, volume, fadeUpMs: opts.fullVolume ? 0 : 5000 });
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
    // Practice has no arcade gameTimer running — anchor the live clock to practiceStartedAt so
    // "RUN" counts up from 00:00 the moment practice begins (capped at 99:59 in formatRunTime).
    const elapsed = practiceEndless
      ? Math.max(0, now - practiceStartedAt)
      : (gameTimer.running ? gameTimer.elapsed + (now - gameTimer.startedAt) : gameTimer.elapsed);
    hudGameTimer.textContent = `RUN ${formatRunTime(elapsed)}`;
  }

  function updateArcadeHud(now) {
    const remainingMs = levelEndsAt - now;
    const safeRemaining = Math.max(0, remainingMs);
    _timerRemainingMs = safeRemaining;
    _timerRatio = levelDurationMs > 0 ? clamp(safeRemaining / levelDurationMs, 0, 1) : 0;
    updateGameTimerHud(now);
    updatePlasmaModeBtn(now); // 2026-07-04: refresh the conformed recharge pill every frame
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
    // 2026-06-24: suppress comms while the level-select grid is up; kill any in-flight/queued VO
    // the moment it opens so a leftover gameplay line can't talk over the menu.
    arcadeLevelSelectOpen = showLevels;
    if (showLevels) { commBoxController.stopVO(); commBoxController.hide(); }
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
    // 2026-07-03: the Stunt menu must NEVER sit in exclusive-SPC mode. A training/practice replay
    // exit path could leave _exclusiveSpeaker true (queueVO drops every non-SPC line while it's on),
    // muting the CMDR/menu VO until the player backed all the way out to the Oracle root. Clear it
    // (and the SPC portrait override) unconditionally on entry so menu comms always speak.
    commBoxController.setExclusiveSpeaker(false);
    commBoxController.clearPortraitOverride();
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
    hideLevelTitleBanner(); // 2026-06-22: never leave a level title lingering over a menu/quit
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
    // 2026-06-22: the level title (e.g. "RED HORIZON") no longer rides under the dimming intro
    // overlay — it shows as a standalone bottom banner that lingers and slow-fades on its own.
    const introCfg = ARCADE_LEVELS.find((l) => l.level === levelNum);
    showLevelTitleBanner(introCfg?.label || "");
    arcadeOverlay.classList.remove("show");
    arcadeOverlay.setAttribute("aria-hidden", "true");
    arcadeOverlayText.classList.remove("show", "fadeOut");
    arcadeOverlaySub.textContent = "";
    arcadeOverlayBtn.style.display = "none";
    if (arcadeOverlayBtnSecondary) arcadeOverlayBtnSecondary.style.display = "none";
    hideEl(arcadeOverlay);
    overlayTimer = null;
  }

  // 2026-06-22: standalone bottom-screen level title. Slides in, holds, then a very slow fade.
  // pointer-events:none + outside the dimming intro overlay, so it never blocks/covers gameplay.
  function showLevelTitleBanner(label, opts = {}) {
    const el = document.getElementById("levelTitleBanner");
    if (!el) return;
    if (levelTitleTimer) { clearTimeout(levelTitleTimer); levelTitleTimer = null; }
    el.classList.remove("show", "fadeOut");
    // 2026-07-02: Training reuses this same animated banner to introduce each mechanic, but the
    // default lower-center position collides with the training comm box / objective banner. The
    // `training` variant repositions to the upper third (see .levelTitleBanner.training in CSS).
    el.classList.toggle("training", !!opts.training);
    if (!label) { el.textContent = ""; el.setAttribute("aria-hidden", "true"); return; }
    el.textContent = label;
    void el.offsetWidth; // restart the entrance animation
    el.classList.add("show");
    el.setAttribute("aria-hidden", "false");
    levelTitleTimer = setTimeout(() => {
      el.classList.add("fadeOut");
      levelTitleTimer = setTimeout(() => {
        el.classList.remove("show", "fadeOut");
        el.setAttribute("aria-hidden", "true");
        levelTitleTimer = null;
      }, LEVEL_TITLE_FADE_MS);
    }, LEVEL_TITLE_HOLD_MS);
  }

  function hideLevelTitleBanner() {
    if (levelTitleTimer) { clearTimeout(levelTitleTimer); levelTitleTimer = null; }
    const el = document.getElementById("levelTitleBanner");
    if (!el) return;
    el.classList.remove("show", "fadeOut");
    el.textContent = "";
    el.setAttribute("aria-hidden", "true");
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
    // 2026-06-23: silver-stroid levels render the natural blue-grey roid01 (and L12's few red
    // hotroids) untinted — a teal/gold/cyan multiply would discolor the "silver" read. L14 uses the
    // code-generated neon skin with its colors already baked in, so it stays untinted too.
    // 2026-06-24: L3 (Blue Moon) and L8 (ice, after 18s) now use code-baked color skins as well, so
    // they also skip the 2D multiply tint that would otherwise muddy those baked colors.
    if (level === 3 || level === 6 || level === 8 || level === 9 || level === 12 || level === 14) return null;
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
    // 2026-06-23: per-level sprite overrides off the level config — cfg.spriteKey forces one sprite
    // for the whole level (silver L6/L9); cfg.spriteMix = [[key, weight], …] picks weighted-random
    // (L12 = mostly silver roid01 with a select few red hotroid01). Falls through to range defaults.
    const _cfg = engineMode === "arcade" ? ARCADE_LEVELS.find((l) => l.level === levelNum) : null;
    if (_cfg?.spriteMix) {
      const mix = _cfg.spriteMix;
      let total = 0;
      for (let i = 0; i < mix.length; i += 1) total += mix[i][1];
      let roll = Math.random() * total;
      for (let i = 0; i < mix.length; i += 1) {
        roll -= mix[i][1];
        if (roll < 0) return mix[i][0];
      }
      return mix[0][0];
    }
    if (_cfg?.spriteKey) return _cfg.spriteKey;
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
    // 2026-06-26 EXPERIMENT (SKIP_BOSS_LOOKAHEAD): the L9→L10 boss-video preload spins up an extra
    // hardware video decoder (27s 720p, preload=auto) on top of the live bg + oracle videos — the
    // suspected cause of the render-server crash / ~12s WebContent stall at L9 entry. Skip the
    // boss-tier lookahead; the boss bg loads at L10 entry instead. // DEBUG: revert before release
    if (nextKey && nextKey !== key && !(SKIP_BOSS_LOOKAHEAD && nextKey === "L10")) {
      preloadGalaxyBackgroundKey(nextKey);
    }
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
    if (opts.preservePitch) {
      audioEngine.playHtmlAudio(name, {
        volume: finalVolume,
        rate: opts.rate || 1,
        loop: false,
        preservePitch: true,
      });
      return;
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
    // 2026-06-24: small detune jitter on every shot — rapid identical advfire buffers were summing
    // into a resonant low boom (worst under quadshot); this de-correlates their phase, staying crisp.
    // 2026-07-02: base laser tap bumped 0.86 → 1.0 (louder plasma report per playtest).
    playGameSfx("advfire", 1.0, { detune: (Math.random() - 0.5) * 100 });
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

  function playSingleAsteroidBoom(kind, volume, rate) {
    const mediumKeys = ["explosion_med", "explosion_med_alt"];
    const smallKeys = ["explosion_small", "explosion_small_alt"];
    const key = kind >= 3 ? "explosion_big" : kind === 2 ? pick(mediumKeys) : pick(smallKeys);
    playGameSfx(key, volume * 1.8, { rate, forceHtmlOnIOS: true });
  }

  function resetBoomBurst() {
    if (_boomBurstTimer) { clearTimeout(_boomBurstTimer); _boomBurstTimer = null; }
    _boomBurstOpen = false;
    _boomBurstCount = 0;
    _boomBurstVol = 0;
  }

  function flushBoomBurst() {
    _boomBurstTimer = null;
    const swallowed = _boomBurstCount - 1; // the first boom of the burst already played live
    if (swallowed >= 1) {
      // One designed "cluster detonation" standing in for the N swallowed booms — scaled up with the
      // kill count (louder + heavier/deeper as the cluster grows) so a multi-kill reads as one decisive
      // impact rather than a muddy smear. TODO: swap "explosion_big" for a bespoke cluster-boom asset
      // when one is recorded — this is the only line that needs to change.
      const intensity = Math.min(1, 0.5 + swallowed * 0.18);
      const vol = clamp(_boomBurstVol * (0.55 + intensity * 0.6), 0, 1.6);
      const rate = 0.82 - Math.min(0.12, swallowed * 0.03);
      playGameSfx("explosion_big", vol * 1.8, { rate, forceHtmlOnIOS: true, important: true });
    }
    _boomBurstOpen = false;
    _boomBurstCount = 0;
    _boomBurstVol = 0;
  }

  function playAsteroidExplosionBoom(kind, volume, rate) {
    if (!_boomBurstOpen) {
      // first kill of a burst — play it live for instant feedback, then open the coalescing window
      _boomBurstOpen = true;
      _boomBurstCount = 1;
      _boomBurstVol = volume;
      _lastExplosionSoundAt = performance.now();
      playSingleAsteroidBoom(kind, volume, rate);
      if (_boomBurstTimer) clearTimeout(_boomBurstTimer);
      _boomBurstTimer = setTimeout(flushBoomBurst, BOOM_BURST_WINDOW_MS);
      return;
    }
    // burst already open — swallow this boom and fold it into the pending cluster accent
    void kind;
    _boomBurstCount += 1;
    if (volume > _boomBurstVol) _boomBurstVol = volume;
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

  // 2026-06-25: localized "heat shimmer" shockwave for quad-shot blasts. A fast additive ring
  // with a faint trailing echo and (off the perf-critical native path) a 1px chromatic R/B split —
  // cheap fake distortion drawn on the 2D overlay, reads as a heatwave pop at the impact point
  // without ever touching the framebuffer. Pooled through the shared ring pool; capped per frame.
  function addShockwave(x, y) {
    if (prefersReducedMotion || state.minimal) return;
    const cap = isIOSNative ? 6 : 12;
    if (sim.shockwaves.length >= cap) releaseRing(sim.shockwaves.shift());
    const s = getRing();
    s.x = x;
    s.y = y;
    s.life = 0;
    s.ttl = isIOSNative ? 240 : 300;
    s.baseR = 6;
    s.maxR = isIOSNative ? 50 : 64;
    s.alpha = 0.5;
    sim.shockwaves.push(s);
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
    // 2026-06-23: reset the ambient flag every spawn — pooled asteroids reuse objects, so a stale
    // .ambient from a previous L4 debris piece must not leak onto a real asteroid. The L4 debris
    // spawner sets .ambient = true on its returned piece (see the debris block in update()).
    a.ambient = false;
    a._pulseHitAt = 0; // 2026-07-01: clear stale pulse-shard highlight from a pooled/reused asteroid
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

  // 2026-06-23: count only the asteroids that count toward clearing the level — L4 debris pieces
  // (.ambient) are bonus targets/hazards and must be excluded from the spawn-capacity gate, the
  // keep-alive check, and the level-complete emptiness test so they never stall progress.
  function nonAmbientAsteroidCount() {
    let n = 0;
    for (let i = 0; i < sim.asteroids.length; i += 1) {
      if (!sim.asteroids[i].ambient) n += 1;
    }
    return n;
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

  // 2026-06-24: time-gated mid-level skin shift for arcade levels. cfg.spriteShift = { afterMs, key }
  // forces a different baked skin on every asteroid spawned after `afterMs` into the level (L8 ice).
  // Returns the override key once the clock passes the mark, else null (level default). Guards on the
  // baked sprite actually existing so a not-yet-decoded skin falls back cleanly.
  function pickArcadeSpriteOverride(cfg, now) {
    const sh = cfg?.spriteShift;
    if (sh && asteroidSprites[sh.key]) {
      if (Math.max(0, now - levelRunStartAt) >= sh.afterMs) return sh.key;
    }
    return null;
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
    const placed = createMineEntity(px, py);
    if (tutorialPlacedBombNoAutoArm) placed.noAutoArm = true; // tutorial: wait for the cadet to tap-arm it
    placedBombs.push(placed);
    playerBombInventory--;
    updateHudBombInventory();
    playGameSfx("blip1", 0.85);
    addWarpRing(px, py, "rgba(124,255,91,1)");
    return true;
  }

  function levelHasLandmine(levelNum) {
    // 2026-06-10: progressive introduction — L1 clean, L2 first landmine, L3 UFOs, L4 powerups.
    if (levelNum < 2) return false;
    // 2026-07-01: L11 doubled in length — the auto-spawn at levelDurationMs/2 drops a landmine
    // at the old ~78s endpoint (now the midpoint pivot).
    return levelNum === 2 || levelNum === 3 || levelNum === 5 || levelNum === 8 || levelNum === 11;
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
      // 2026-06-22: drop the callout at play time if the UFO is already dead (killed during the
      // ~600ms queue gap) — no point announcing a UFO the player just destroyed.
      commBoxController.queueVO({
        // 2026-06-24: vary the UFO callout across the original line + two new "get the alien" CMDR variants.
        audioSrc: commBoxController.commVoSrc(
          commBoxController.pickFromPool("ufoSpotted", commBoxController.POOL_UFO_SPOTTED),
        ),
        event: "ufo",
        playGuard: () => !!(ufo && ufo.alive),
      });
    }
    addWarpRing(x, y, "rgba(160,255,255,1)");
  }

  function isPointOnUfo(x, y) {
    if (!ufo || !ufo.alive) return false;
    return Math.hypot(ufo.x - x, ufo.y - y) <= ufo.r + 10;
  }

  function hitUfo(forceKill = false) {
    if (!ufo || !ufo.alive) return;
    const x = ufo.x;
    const y = ufo.y;
    ufo.hitCount += 1;
    shotsHit += 1;
    // 2026-06-23: forceKill (quadshot) skips the first-hit damage beat so the UFO dies on one shot.
    if (ufo.hitCount === 1 && !forceKill) {
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
    recordComboEvent("ufo_destroyed", { x, y });
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
    const underFramePressure = isIOSNative && !!sim._frameBudgetExceeded;
    const isLarge = asteroidKind >= 2;
    const isBigAsteroid = asteroidKind >= 3 && !fire;
    const isSmallAsteroid = asteroidKind === 1 && !fire;
    const isMediumAsteroid = asteroidKind === 2 && !fire;
    const particleCount = isIOSNative
      ? (isLarge ? Math.ceil(count / 2) : Math.ceil(count / 3))
      : count;
    const emitCount = prefersReducedMotion
      ? Math.min(6, particleCount)
      : underFramePressure
        ? Math.min(6, Math.ceil(particleCount / 2))
        : particleCount;
    function pushAsteroidChunk() {
      if (isIOSNative && sim.particles.length >= MAX_EXPLOSION_PARTICLES) return;
      if (sim.particles.length >= MAX_EXPLOSION_PARTICLES) return;
      const angle = Math.random() * Math.PI * 2;
      const speed = isSmallAsteroid ? 160 + Math.random() * 240 : 40 + Math.random() * 80;
      const p = getParticle();
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.life = 0;
      p.ttl = (isSmallAsteroid ? 280 + Math.random() * 180 : 600 + Math.random() * 200) * (isMediumAsteroid ? 1.2 : 1);
      p.size = (isSmallAsteroid ? 1.6 + Math.random() * 1.7 : 2.5 + Math.random() * 2) * (isMediumAsteroid ? 1.3 : 1);
      p.alpha = isSmallAsteroid ? 0.72 + Math.random() * 0.2 : 0.8 + Math.random() * 0.2;
      if (isSmallAsteroid) {
        const v = 190 + Math.floor(Math.random() * 62);
        p.color = `rgba(${v},${v + Math.floor(Math.random() * 5)},${v + 8 + Math.floor(Math.random() * 10)},`;
      } else if (Math.random() < 0.72) {
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
      const speed = isSmallAsteroid ? 300 + Math.random() * 190 : hot ? 220 + Math.random() * 100 : 180 + Math.random() * 100;
      const p = getParticle();
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.life = 0;
      p.ttl = isSmallAsteroid ? 95 + Math.random() * 70 : 120 + Math.random() * 80;
      p.size = isSmallAsteroid ? 0.9 + Math.random() * 1.1 : 1.0 + Math.random();
      p.alpha = 0.9;
      if (isSmallAsteroid) {
        const v = 215 + Math.floor(Math.random() * 40);
        p.color = `rgba(${v},${v},${Math.min(255, v + 10)},`;
      } else {
        p.color = sparkColorForSprite();
      }
      p.flicker = true;
      sim.particles.push(p);
    }
    if (isSmallAsteroid) spawnSmallStroidBurst(x, y);
    if (isMediumAsteroid) spawnMediumStroidBurst(x, y, spriteKey);
    if (isBigAsteroid) spawnBigStroidBurst(x, y, blastScale, spriteKey);
    for (let i = 0; i < emitCount; i += 1) {
      if (isIOSNative && sim.particles.length >= MAX_EXPLOSION_PARTICLES) break;
      if (sim.particles.length >= MAX_EXPLOSION_PARTICLES) break;
      const angle = Math.random() * Math.PI * 2;
      const speed = isSmallAsteroid ? 190 + Math.random() * 260 : 30 + Math.random() * 110;
      const p = getParticle();
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.life = 0;
      p.ttl = (isSmallAsteroid ? 260 + Math.random() * 190 : 320 + Math.random() * 180) * ttlScale * (isMediumAsteroid ? 1.2 : 1);
      p.size = (isSmallAsteroid ? 1.1 + Math.random() * 2.0 : 1.7 + Math.random() * 2.4) * blastScale * (isMediumAsteroid ? 1.3 : 1);
      p.alpha = isSmallAsteroid ? 0.58 + Math.random() * 0.32 : 0.45 + Math.random() * 0.4;
      if (fire) {
        p.color = `rgba(${220 + Math.floor(Math.random() * 35)},${100 + Math.floor(Math.random() * 90)},${30 + Math.floor(Math.random() * 40)},`;
      } else if (isSmallAsteroid) {
        const tone = Math.random();
        if (tone < 0.55) {
          const v = 225 + Math.floor(Math.random() * 30);
          p.color = `rgba(${v},${v},${Math.min(255, v + 8)},`;
        } else if (tone < 0.88) {
          const v = 170 + Math.floor(Math.random() * 55);
          p.color = `rgba(${v},${v + Math.floor(Math.random() * 8)},${v + 14 + Math.floor(Math.random() * 14)},`;
        } else {
          p.color = "rgba(120,132,145,";
          p.ttl *= 1.25;
          p.size *= 1.15;
          p.alpha = Math.max(p.alpha, 0.62);
        }
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
      // 2026-06-23: on L13 ("MAKE IT BOOM PT 2"), a flick-less release DROPS the stroid dead in place
      // instead of drifting — this is the level's rearrange strategy: cluster stroids together, then
      // sweep them all with one plasma net. Everywhere else keeps the slow cold-drift feel (2026-06-12).
      const dropInPlace = ARCADE_LEVELS[currentLevelIndex]?.level === 13;
      const slowSpeed = dropInPlace ? 0 : STROID_TOSS_SLOW_SPEED;
      entity.vx = dnx * slowSpeed;
      entity.vy = dny * slowSpeed;
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
    if (_freezeActive) recordComboEvent("frozen_stroid_destroyed", { x, y });
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
    recordComboEvent("frozen_stroid_destroyed", { x, y });
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
          cssFlash("#ffaa44", 0.24, 180);
          cssShake(1.15);
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
            // SPC levels: the kill-streak milestone is the "big praise" moment — fire her
            // "Wow, Cadet. Just… wow." line; fall back to the praise pool, then CMDR's cocky line.
            // (2026-06-24)
            if (queueSpcBonusVO("SPC_wow_cadet_just_wow-bigpraise.mp3")) return;
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

  // 2026-07-01: pulseImpact (optional {x,y}) = the Pulse Cannon bolt's landing point. When set, each
  // split child is tagged with a short-lived directional teal highlight on the side that faced the
  // shot, so a Pulse Cannon kill visibly "shears" the parent into glowing shards (see the asteroid
  // render loop). Other kill sources (laser, toss) pass null and behave exactly as before.
  function splitAsteroidByIndex(targetIndex, pulseImpact = null) {
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
    if (_freezeActive) recordComboEvent("frozen_stroid_destroyed", { x: baseX, y: baseY });

    if (wasKind > 1) {
      const childCount = wasKind === 3 ? (3 + Math.floor(Math.random() * 3)) : (2 + Math.floor(Math.random() * 2));
      const pulseNow = pulseImpact ? performance.now() : 0;
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
        if (pulseImpact) {
          // direction from the bolt impact toward this shard = the hit-facing side to light up
          let hx = child.x - pulseImpact.x;
          let hy = child.y - pulseImpact.y;
          const hl = Math.hypot(hx, hy) || 1;
          child._pulseHitAt = pulseNow;
          child._pulseHitDirX = hx / hl;
          child._pulseHitDirY = hy / hl;
        }
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

  function vaporizeAsteroidByIndex(targetIndex, suppressBoom = false, suppressFreezeCombo = false) {
    const a = removeAsteroidAt(targetIndex);
    if (!a) return;
    const levelNum = ARCADE_LEVELS[currentLevelIndex]?.level || 1;
    const isLevel10 = levelNum === 10;
    const bigBlast = a.kind === 3;
    const mediumBlast = a.kind === 2;
    addArcadeScore(arcadeMultiplierPoints(a.kind >= 2 ? 25 : 10));
    trackKillStreak();
    if (_freezeActive && !suppressFreezeCombo) recordComboEvent("frozen_stroid_destroyed", { x: a.x, y: a.y });
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
    hidePlasmaReadyBadge(); // 2026-07-03: drop the "PLASMA READY" cue when the net releases/cancels
    // 2026-06-24: do NOT touch rechargeSoundPlayed here. This resets the gesture geometry only,
    // and runs on fizzles, pointer-cancel, and app-resume too. Clearing the recharge flag while
    // cooldownUntil still points at an already-elapsed cooldown re-fired a FALSE "plasma recharged"
    // VO. The flag is armed (set false) at the one site that starts a real cooldown (releasePlasmaCage
    // charged branch) and cleared (true) by the recharge VO / UFO-kill reward / level cleanup.
  }

  // 2026-07-03: net charge/highlight delay. In Training + Practice the highlight/lock lands almost
  // instantly so the cadet isn't waiting to fire; the real game keeps the full 800ms feel.
  function plasmaCageChargeMs() {
    return (stuntActive || practiceEndless) ? 120 : PLASMA_CAGE_CHARGE_MS;
  }
  function isPlasmaCageReady(now = performance.now()) {
    if (plasmaCage.active) {
      const ready = plasmaCage.charged || now - plasmaCage.chargeStart >= plasmaCageChargeMs();
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
    if (pulseCannonActive()) return false; // Pulse Cannon replaces hold-to-net; auto-restores on expiry
    if (tutorialBlockPlasmaToss) return false; // tutorial laser step only teaches the laser
    if (plasmaCage.placed) {
      // 2026-07-03: a placed-but-unfired net is un-spent ammo — starting a new draw picks it up and
      // replaces it for FREE (no cooldown). Only DETONATION starts the reload, so re-aiming a
      // misplaced trap costs nothing. (A tap INSIDE the net still detonates — that's handled at the
      // pointer-down site before any drag begins, so this only runs on a genuine re-draw.)
      plasmaCage.placed = null;
      playGameSfx("blip1", 0.55, { rate: 0.9 }); // subtle "pick-up" cue
      triggerGameplayHapticImpact(hapticImpactStyle.Light);
      updatePlasmaModeBtn();
    }
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

  // 2026-07-03: the plasma net is a gesture weapon with no HUD meter, so "charged / ready to release"
  // had no persistent VISUAL cue (sound + haptic only). Flash a "PLASMA READY" badge near the top of
  // the HUD the moment the net locks on. Lazy DOM element, auto-fades; theme-neutral teal.
  let _plasmaReadyBadgeEl = null;
  let _plasmaReadyBadgeTimer = null;
  function flashPlasmaReadyBadge() {
    if (!_plasmaReadyBadgeEl) {
      const el = document.createElement("div");
      el.id = "plasmaReadyBadge";
      el.textContent = "PLASMA READY";
      el.setAttribute("aria-hidden", "true");
      el.style.cssText =
        "position:fixed;left:50%;top:11%;transform:translateX(-50%);z-index:9400;pointer-events:none;"
        + "font:800 clamp(13px,3.2vw,20px)/1 system-ui,-apple-system,sans-serif;letter-spacing:.14em;"
        + "color:#04140f;background:rgba(0,255,209,.94);padding:7px 15px;border-radius:999px;"
        + "box-shadow:0 0 22px rgba(0,255,209,.6);opacity:0;transition:opacity 140ms ease;"
        + "white-space:nowrap;display:none;";
      document.body.appendChild(el);
      _plasmaReadyBadgeEl = el;
    }
    const el = _plasmaReadyBadgeEl;
    if (_plasmaReadyBadgeTimer) { clearTimeout(_plasmaReadyBadgeTimer); _plasmaReadyBadgeTimer = null; }
    el.style.display = "block";
    requestAnimationFrame(() => { el.style.opacity = "1"; });
    _plasmaReadyBadgeTimer = setTimeout(() => {
      el.style.opacity = "0";
      _plasmaReadyBadgeTimer = setTimeout(() => {
        _plasmaReadyBadgeTimer = null;
        if (_plasmaReadyBadgeEl) _plasmaReadyBadgeEl.style.display = "none";
      }, 200);
    }, 650);
  }
  function hidePlasmaReadyBadge() {
    if (_plasmaReadyBadgeTimer) { clearTimeout(_plasmaReadyBadgeTimer); _plasmaReadyBadgeTimer = null; }
    if (_plasmaReadyBadgeEl) { _plasmaReadyBadgeEl.style.opacity = "0"; _plasmaReadyBadgeEl.style.display = "none"; }
  }
  function updatePlasmaCageCharge(now) {
    if (!plasmaCage.active || plasmaCage.charged) return;
    if (now - plasmaCage.chargeStart >= plasmaCageChargeMs()) {
      plasmaCage.charged = true;
      if (!plasmaCage.readySoundPlayed) {
        plasmaCage.readySoundPlayed = true;
        const readyKey = resolveGameSfxKey("plasma_ready", "reveal4");
        if (readyKey) playGameSfx(readyKey, 1.0);
        commBoxController.reactTo("plasmacharged");
        flashPlasmaReadyBadge(); // 2026-07-03: visible "PLASMA READY" HUD cue
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
        // SPC levels: her own "Plasma recharged — make a plasma net!" line. (2026-06-24)
        if (queueSpcBonusVO("SPC_plasma_recharged_make_a_plasma_net.mp3")) return;
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

  // 2026-07-03: shared "wasted net" cue — a muffled dud, deliberately unsatisfying vs the punchy
  // basicb_explo of a net that actually catches stroids. Used on an empty net AND the 45s net expiry.
  function playPlasmaFizzle() {
    playGameSfx("distantexplode", 0.5);
  }

  // 2026-07-03: safety-expire a MANUAL placed net. A placed net blocks re-arming (beginPlasmaCage
  // rejects while one is set), so forgetting to detonate would soft-lock the weapon. After 45s, discard
  // it with the wasted-net fizzle and run a normal reload so plasma comes back cleanly. (drawPlasmaOverlay
  // blinks the net during the final PLASMA_PLACED_NET_WARN_MS as a warning.)
  function updatePlasmaPlacedNet(now) {
    const placed = plasmaCage.placed;
    if (!placed) return;
    if (now - placed.placedAt < PLASMA_PLACED_NET_TTL_MS) return;
    plasmaCage.placed = null;
    plasmaCage.lastRectCx = placed.x + placed.w / 2;
    plasmaCage.lastRectCy = placed.y + placed.h / 2;
    plasmaCage.releaseFx = { x: placed.x, y: placed.y, w: placed.w, h: placed.h, type: "fizzle", start: now, ttl: 260 };
    playPlasmaFizzle();
    plasmaCage.cooldownStart = now;
    plasmaCage.cooldownUntil = now + PLASMA_CAGE_COOLDOWN_MS;
    plasmaCage.rechargeSoundPlayed = false;
    updatePlasmaModeBtn();
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
      vaporizeAsteroidByIndex(toDestroy[i], true, true); // suppressBoom + no freeze combo credit for plasma kills
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

  // 2026-07-03: the actual "fire the net" payload — destroy caught stroids, combo/FX/haptics, then
  // start the recharge cooldown. Shared by the AUTO release path and the MANUAL detonate (tap-the-net
  // / DETONATE button) so both fire identically.
  function detonatePlasmaRect(rect, now) {
    const destroyedCount = destroyAsteroidsInPlasmaCage(rect);
    recordComboEvent("plasma_net", {
      destroyedCount,
      x: rect.x + rect.w / 2,
      y: rect.y + rect.h / 2,
    });
    if (destroyedCount > 0) stuntNotify("plasma");
    else { stuntNotify("plasma_miss"); playPlasmaFizzle(); } // tutorial Phase 3 coaching + a "wasted net" dud on an empty net
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
    // 2026-07-03: MANUAL mode recharges 2× slower (10s). A placed whole-screen net that grabs and
    // detonates everything is powerful, so it costs a longer reload; AUTO fire stays 5s. Clock starts
    // on detonate, so Manual reads as "one big play, then a 10s reload".
    const cooldownMs = plasmaCage.mode === "manual" ? PLASMA_CAGE_COOLDOWN_MS * 2 : PLASMA_CAGE_COOLDOWN_MS;
    plasmaCage.cooldownStart = now;
    plasmaCage.cooldownUntil = now + cooldownMs;
    plasmaCage.rechargeSoundPlayed = false;
    plasmaCage.releaseFx = { x: rect.x, y: rect.y, w: rect.w, h: rect.h, type: "fire", start: now, ttl: 220 };
    return destroyedCount;
  }

  // 2026-07-03: fire a MANUAL net that was left placed on the field. Reused by tap-on-net and the
  // DETONATE button. No-op if nothing is placed.
  function detonatePlacedNet(now = performance.now()) {
    if (!plasmaCage.placed) return false;
    const rect = plasmaCage.placed;
    plasmaCage.placed = null;
    plasmaCage.lastRectCx = rect.x + rect.w / 2;
    plasmaCage.lastRectCy = rect.y + rect.h / 2;
    detonatePlasmaRect(rect, now);
    updatePlasmaModeBtn();
    return true;
  }

  // 2026-07-03: a trap net needs a usable footprint — a degenerate sliver (dragged out then back)
  // isn't placeable.
  function isPlasmaRectPlaceable(rect) {
    return !!rect && Math.hypot(rect.w, rect.h) >= 50;
  }
  function releasePlasmaCage(now, { edgeExit = false } = {}) {
    if (!plasmaCage.active) return false;
    updatePlasmaCageCharge(now);
    const rect = getPlasmaRect();
    const charged = plasmaCage.charged;
    plasmaCage.lastRectCx = rect.x + rect.w / 2;
    plasmaCage.lastRectCy = rect.y + rect.h / 2;
    stopPlasmaChargeSound();
    resetPlasmaCageGesture();
    // 2026-07-03: leave the net PLACED as a trap (hangs until tapped / the DETONATE button) instead
    // of firing or fizzling when:
    //   • MANUAL mode — a released net is ALWAYS a placed trap, with or without a stroid highlighted
    //     inside (#14), OR
    //   • an EDGE-EXIT (finger left the iPad screen) that hadn't charged — never "throw the net away"
    //     on an edge slip (#2). A CHARGED edge-exit still fires below, since that net pays off.
    // Training forces AUTO and never edge-places, so its net lessons are unaffected.
    const placeAsTrap = !stuntActive && (plasmaCage.mode === "manual" || (edgeExit && !charged));
    if (placeAsTrap) {
      if (isPlasmaRectPlaceable(rect)) {
        plasmaCage.placed = { x: rect.x, y: rect.y, w: rect.w, h: rect.h, placedAt: now };
        playGameSfx("blip1", 0.72, { rate: 1.12 }); // "net set" confirm
        triggerGameplayHapticImpact(hapticImpactStyle.Light);
        updatePlasmaModeBtn();
        return true;
      }
      plasmaCage.releaseFx = { x: rect.x, y: rect.y, w: rect.w, h: rect.h, type: "fizzle", start: now, ttl: 200 };
      return true;
    }
    if (charged) {
      detonatePlasmaRect(rect, now);
    } else {
      plasmaCage.releaseFx = { x: rect.x, y: rect.y, w: rect.w, h: rect.h, type: "fizzle", start: now, ttl: 200 };
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
    // Combo banner overlay tracks the same geometry (it's position:fixed, but galaxyView is fixed
    // inset:0 so the play canvas's left/top already equal viewport coords).
    if (comboBannerCtx) {
      comboBannerCanvas.style.left = galaxyPlayCanvas.style.left;
      comboBannerCanvas.style.top = galaxyPlayCanvas.style.top;
      comboBannerCanvas.style.width = galaxyPlayCanvas.style.width;
      comboBannerCanvas.style.height = galaxyPlayCanvas.style.height;
      comboBannerCanvas.width = galaxyPlayCanvas.width;
      comboBannerCanvas.height = galaxyPlayCanvas.height;
      comboBannerCtx.setTransform(sim.dpr, 0, 0, sim.dpr, 0, 0);
    }
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
    // 2026-06-22 (19:21 notes #6): in endless Practice the timer is always "full", so instead of a
    // static primary color the perimeter slowly drifts through the spectrum (continuous hue sweep)
    // alongside the cycling backgrounds. Warning/strobe overrides below still take precedence.
    if (practiceEndless && remaining > 10000) {
      const hue = ((now % PRACTICE_PERIMETER_HUE_PERIOD_MS) / PRACTICE_PERIMETER_HUE_PERIOD_MS) * 360;
      color = `hsl(${hue.toFixed(1)}, 85%, 62%)`;
    }
    // 2026-06-10: freeze strobe — alternate white at ~3Hz while frozen, theme color returns
    // automatically when the freeze pauses/ends.
    if ((_freezeActive || _perimeterVoFlash) && Math.floor(now / 167) % 2 === 0) color = "#ffffff";
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

  // 2026-07-03: canvas mirror of pixiRenderer.drawWavyRect — traces the net perimeter as a wavy
  // "plasma field line" path (was a straight dashed strokeRect). Amplitude tapers to 0 at the corners.
  function traceWavyRectPath(ctx, x, y, w, h, now, amp) {
    const step = 9;
    const freq = 0.055;
    const speed = now / 140;
    const sides = [
      { sx: x, sy: y, dx: 1, dy: 0, nx: 0, ny: -1, len: w },
      { sx: x + w, sy: y, dx: 0, dy: 1, nx: 1, ny: 0, len: h },
      { sx: x + w, sy: y + h, dx: -1, dy: 0, nx: 0, ny: 1, len: w },
      { sx: x, sy: y + h, dx: 0, dy: -1, nx: -1, ny: 0, len: h },
    ];
    ctx.beginPath();
    for (let s = 0; s < sides.length; s += 1) {
      const side = sides[s];
      for (let d = 0; d <= side.len + step; d += step) {
        const dd = Math.min(d, side.len);
        const taper = Math.min(1, Math.min(dd, side.len - dd) / 14);
        const wob = (Math.sin(dd * freq + speed + s * 1.3) + 0.4 * Math.sin(dd * freq * 2.3 - speed * 1.7)) * amp * taper;
        const px = side.sx + side.dx * dd + side.nx * wob;
        const py = side.sy + side.dy * dd + side.ny * wob;
        if (s === 0 && d === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
        if (dd >= side.len) break;
      }
    }
    ctx.closePath();
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
    const strobe = 0.78 + 0.22 * Math.sin(now / 90);
    plasmaCtx.globalAlpha = borderAlpha * strobe;
    traceWavyRectPath(plasmaCtx, x, y, w, h, now, charged ? 3.4 : 1.6 + progress * 1.6);
    plasmaCtx.stroke();
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

  function ensurePlasmaHudParticles() {
    if (plasmaHudParticles.length) return plasmaHudParticles;
    for (let i = 0; i < PLASMA_HUD_PARTICLE_COUNT; i += 1) {
      plasmaHudParticles.push({
        angle: (i / PLASMA_HUD_PARTICLE_COUNT) * Math.PI * 2 + Math.random() * 0.5,
        speed: 0.00028 + Math.random() * 0.0003,
        radius: PLASMA_HUD_RADIUS + 1.5 + Math.random() * 5,
        wobble: 0.0012 + Math.random() * 0.0018,
        wobbleAmp: 0.6 + Math.random() * 1.2,
        size: 0.7 + Math.random() * 1.3,
        alpha: 0.22 + Math.random() * 0.34,
        phase: Math.random() * Math.PI * 2,
      });
    }
    return plasmaHudParticles;
  }

  function updatePlasmaHudState(plasmaCage, now) {
    if (!plasmaCage || plasmaCage.active || plasmaCage.placed) return null;
    const charging = plasmaCage.cooldownUntil > now;
    if (charging) {
      if (plasmaHudState !== "charging") {
        plasmaHudState = "charging";
        plasmaHudTransitionAt = 0;
        plasmaHudArcUntil = 0;
        plasmaHudNextArcAt = 0;
      }
      return "charging";
    }

    if (plasmaHudState === "charging") {
      plasmaHudState = "chargedTransition";
      plasmaHudTransitionAt = now;
      plasmaHudArcUntil = now + 140;
      plasmaHudNextArcAt = now + PLASMA_HUD_ARC_MIN_MS + Math.random() * (PLASMA_HUD_ARC_MAX_MS - PLASMA_HUD_ARC_MIN_MS);
      return "chargedTransition";
    }

    if (plasmaHudState === "chargedTransition") {
      if (plasmaHudTransitionAt > 0 && (now - plasmaHudTransitionAt) < PLASMA_HUD_TRANSITION_MS) {
        return "chargedTransition";
      }
      plasmaHudState = "readyIdle";
    }

    if (plasmaHudState !== "readyIdle") {
      plasmaHudState = "readyIdle";
    }
    if (!plasmaHudNextArcAt) {
      plasmaHudNextArcAt = now + PLASMA_HUD_ARC_MIN_MS + Math.random() * (PLASMA_HUD_ARC_MAX_MS - PLASMA_HUD_ARC_MIN_MS);
    }
    return "readyIdle";
  }

  function drawPlasmaHudParticles(g, cx, cy, now, alpha, pulse) {
    const particles = ensurePlasmaHudParticles();
    const pulseScale = 1 + pulse * 0.04;
    const drawAlpha = alpha * (0.55 + pulse * 0.45);
    g.save();
    g.globalCompositeOperation = "lighter";
    for (let i = 0; i < particles.length; i += 1) {
      const p = particles[i];
      const angle = p.angle + now * p.speed;
      const orbit = p.radius + Math.sin(now * p.wobble + p.phase) * p.wobbleAmp;
      const px = cx + Math.cos(angle) * orbit;
      const py = cy + Math.sin(angle) * orbit;
      const size = p.size * pulseScale;
      g.fillStyle = `rgba(0,255,230,${(p.alpha * drawAlpha).toFixed(3)})`;
      g.beginPath();
      g.arc(px, py, size, 0, Math.PI * 2);
      g.fill();
      if (i % 4 === 0) {
        g.fillStyle = `rgba(220,255,250,${(p.alpha * drawAlpha * 0.55).toFixed(3)})`;
        g.beginPath();
        g.arc(px + Math.cos(angle + 0.8) * 0.8, py + Math.sin(angle + 0.8) * 0.8, Math.max(0.5, size * 0.45), 0, Math.PI * 2);
        g.fill();
      }
    }
    g.restore();
  }

  function drawPlasmaCooldown(now) {
    if (window.pixiRenderer) return;
    if (!plasmaCtx || !plasmaCage || plasmaCage.active || plasmaCage.placed) return;
    const state = updatePlasmaHudState(plasmaCage, now);
    const x = sim.width - PLASMA_HUD_EDGE_OFFSET;
    const y = sim.height - PLASMA_HUD_EDGE_OFFSET;
    const pulse = 0.5 + 0.5 * Math.sin(((now + plasmaHudPulseSeed) / PLASMA_HUD_PULSE_MS) * Math.PI * 2);
    const charging = state === "charging";
    const progress = charging
      ? Math.max(
        0,
        Math.min(
          1,
          1 - (plasmaCage.cooldownUntil - now) / Math.max(1, plasmaCage.cooldownUntil - (plasmaCage.cooldownStart || now)),
        ),
      )
      : 1;

    plasmaCtx.save();
    plasmaCtx.globalCompositeOperation = "lighter";

    if (charging) {
      const ringRadius = PLASMA_HUD_RADIUS + 8;
      plasmaCtx.lineWidth = 7;
      plasmaCtx.strokeStyle = `rgba(0,255,230,${(PLASMA_HUD_GLOW_ALPHA * 0.15).toFixed(3)})`;
      plasmaCtx.beginPath();
      plasmaCtx.arc(x, y, ringRadius + 2.2, -Math.PI / 2, Math.PI * 1.5);
      plasmaCtx.stroke();
      plasmaCtx.lineWidth = 3;
      plasmaCtx.strokeStyle = "rgba(0,68,61,0.42)";
      plasmaCtx.beginPath();
      plasmaCtx.arc(x, y, ringRadius, -Math.PI / 2, Math.PI * 1.5);
      plasmaCtx.stroke();
      plasmaCtx.lineWidth = 3.2;
      plasmaCtx.strokeStyle = "rgba(0,255,230,0.8)";
      if (!isIOSNative) {
        plasmaCtx.shadowColor = PLASMA_HUD_COLOR;
        plasmaCtx.shadowBlur = 8;
      }
      plasmaCtx.beginPath();
      plasmaCtx.arc(x, y, ringRadius, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
      plasmaCtx.stroke();
      plasmaCtx.lineWidth = 1.6;
      plasmaCtx.strokeStyle = "rgba(220,255,240,0.22)";
      plasmaCtx.beginPath();
      plasmaCtx.arc(x, y, ringRadius - 1.1, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
      plasmaCtx.stroke();
      plasmaCtx.restore();
      return;
    }

    const transitionT = state === "chargedTransition"
      ? Math.max(0, Math.min(1, (now - plasmaHudTransitionAt) / PLASMA_HUD_TRANSITION_MS))
      : 1;
    const transitionEase = 1 - Math.pow(1 - transitionT, 3);
    const ringRadius = PLASMA_HUD_RADIUS + 8 + (state === "chargedTransition" ? 2.6 * (1 - transitionEase) : 0.7 * pulse);
    const ringAlpha = state === "chargedTransition"
      ? 0.4 + transitionEase * 0.5
      : 0.46 + pulse * 0.22;
    const orbAlpha = state === "chargedTransition"
      ? Math.max(0, Math.min(1, (transitionT - 0.08) / 0.4))
      : 0.88 + pulse * 0.12;
    const orbRadius = state === "chargedTransition"
      ? 2 + transitionEase * 5.2
      : 4.8 + pulse * 1.1;

    plasmaCtx.lineWidth = 7;
    plasmaCtx.strokeStyle = `rgba(0,255,230,${(PLASMA_HUD_GLOW_ALPHA * 0.27).toFixed(3)})`;
    if (!isIOSNative) {
      plasmaCtx.shadowColor = PLASMA_HUD_COLOR;
      plasmaCtx.shadowBlur = 9;
    }
    plasmaCtx.beginPath();
    plasmaCtx.arc(x, y, ringRadius + 1.8, -Math.PI / 2, Math.PI * 1.5);
    plasmaCtx.stroke();

    plasmaCtx.lineWidth = 3;
    plasmaCtx.strokeStyle = `rgba(0,68,61,${(ringAlpha * 0.55).toFixed(3)})`;
    plasmaCtx.beginPath();
    plasmaCtx.arc(x, y, ringRadius, -Math.PI / 2, Math.PI * 1.5);
    plasmaCtx.stroke();

    plasmaCtx.lineWidth = 2.8;
    plasmaCtx.strokeStyle = `rgba(0,255,230,${ringAlpha.toFixed(3)})`;
    plasmaCtx.beginPath();
    plasmaCtx.arc(x, y, ringRadius, -Math.PI / 2, Math.PI * 1.5);
    plasmaCtx.stroke();

    plasmaCtx.lineWidth = 1.5;
    plasmaCtx.strokeStyle = `rgba(220,255,240,${(ringAlpha * 0.28).toFixed(3)})`;
    plasmaCtx.beginPath();
    plasmaCtx.arc(x, y, ringRadius - 1.3, -Math.PI / 2, Math.PI * 1.5);
    plasmaCtx.stroke();

    if (state === "chargedTransition") {
      const rippleRadius = ringRadius + 2 + transitionEase * 16;
      const rippleAlpha = (1 - transitionEase) * 0.42;
      plasmaCtx.lineWidth = 1.5;
      plasmaCtx.strokeStyle = `rgba(0,255,230,${rippleAlpha.toFixed(3)})`;
      plasmaCtx.beginPath();
      plasmaCtx.arc(x, y, rippleRadius, 0, Math.PI * 2);
      plasmaCtx.stroke();
    }

    plasmaCtx.fillStyle = `rgba(0,255,230,${(orbAlpha * 0.24).toFixed(3)})`;
    plasmaCtx.beginPath();
    plasmaCtx.arc(x, y, orbRadius + 3, 0, Math.PI * 2);
    plasmaCtx.fill();
    plasmaCtx.fillStyle = `rgba(0,255,230,${(orbAlpha * 0.62).toFixed(3)})`;
    plasmaCtx.beginPath();
    plasmaCtx.arc(x, y, orbRadius, 0, Math.PI * 2);
    plasmaCtx.fill();
    plasmaCtx.fillStyle = `rgba(220,255,240,${(orbAlpha * 0.92).toFixed(3)})`;
    plasmaCtx.beginPath();
    plasmaCtx.arc(x, y, Math.max(1.2, orbRadius * 0.42), 0, Math.PI * 2);
    plasmaCtx.fill();

    drawPlasmaHudParticles(plasmaCtx, x, y, now, orbAlpha, pulse);

    if (!plasmaHudNextArcAt) {
      plasmaHudNextArcAt = now + PLASMA_HUD_ARC_MIN_MS + Math.random() * (PLASMA_HUD_ARC_MAX_MS - PLASMA_HUD_ARC_MIN_MS);
    }
    if (now >= plasmaHudNextArcAt && now >= plasmaHudTransitionAt + PLASMA_HUD_TRANSITION_MS) {
      plasmaHudArcUntil = now + 160;
      plasmaHudNextArcAt = now + PLASMA_HUD_ARC_MIN_MS + Math.random() * (PLASMA_HUD_ARC_MAX_MS - PLASMA_HUD_ARC_MIN_MS);
    }
    if (plasmaHudArcUntil > now) {
      const arcT = 1 - ((plasmaHudArcUntil - now) / 160);
      const arcStart = -Math.PI / 2 + arcT * Math.PI * 1.1;
      const arcEnd = arcStart + 0.65 + arcT * 0.9;
      const arcRadius = ringRadius + 3.5;
      plasmaCtx.lineWidth = 2.2;
      plasmaCtx.strokeStyle = `rgba(0,255,230,${((1 - arcT) * 0.78).toFixed(3)})`;
      plasmaCtx.beginPath();
      plasmaCtx.arc(x, y, arcRadius, arcStart, arcEnd);
      plasmaCtx.stroke();
      plasmaCtx.lineWidth = 1;
      plasmaCtx.strokeStyle = `rgba(220,255,240,${((1 - arcT) * 0.42).toFixed(3)})`;
      plasmaCtx.beginPath();
      plasmaCtx.arc(x, y, arcRadius + 0.8, arcStart, arcEnd);
      plasmaCtx.stroke();
    }

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
    // 2026-07-03: MANUAL placed net — draw it persistently (charged look, gentle breathing pulse) so
    // it's clearly armed and waiting for a tap/DETONATE.
    if (plasmaCage.placed) {
      // 2026-07-03: gentle breathing pulse normally; blink HARD during the final warn window before the
      // 45s safety-expiry discards it (see updatePlasmaPlacedNet).
      const age = now - plasmaCage.placed.placedAt;
      const warn = age > PLASMA_PLACED_NET_TTL_MS - PLASMA_PLACED_NET_WARN_MS;
      const pulse = warn
        ? (Math.floor(now / 140) % 2 === 0 ? 0.95 : 0.28)
        : 0.82 + 0.18 * Math.sin(now / 120);
      drawPlasmaCageRect(plasmaCage.placed, now, 1, true, pulse, 1);
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

  // 2026-06-26: the "DETONATE THE BOMB" comm used to fire the instant a bomb was armed, every
  // single time. Now it waits 5s and only nags if that bomb is STILL sitting armed — and at most
  // once every 30s — so it's an occasional reminder, not a per-arm announcement.
  let lastDetonateNagAt = 0;
  function scheduleDetonateNag(mine) {
    setTimeout(() => {
      if (!mine || mine.phase !== "player_armed") return;            // re-armed / phase changed
      if (landmine !== mine && !placedBombs.includes(mine)) return;  // already detonated / removed
      const now = performance.now();
      if (now - lastDetonateNagAt < 30000) return;                   // throttle the reminder
      lastDetonateNagAt = now;
      commBoxController.queueVO({
        audioSrc: commBoxController.commVoSrc(
          commBoxController.pickFromPool("detonate", commBoxController.POOL_DETONATE),
        ),
        event: "landmine",
        priority: "high",
      });
    }, 5000);
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
      scheduleDetonateNag(mine); // 2026-06-26: delayed + throttled (was an instant per-arm VO)
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

    if (mine.phase === "spawned" && !mine.noAutoArm && now - mine.spawnedAt >= 10000) {
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
  // 2026-06-23: big-bomb combo reward — when a single blast catches BIG_BOMB_GOLDBARS_THRESHOLD+
  // large (kind-3) stroids, drop a goldbars powerup. Counts the big rocks present in the blast radius
  // at detonation (shrapnel kills them over the next ~2s). Throttled to one goldbars on screen so the
  // dense mine-chain levels can't flood the field; bypasses powerupOverride since it's a skill reward.
  const BIG_BOMB_GOLDBARS_THRESHOLD = 7; // 2026-07-03: raised 5→7 — Big Bomb Combo was too easy (co-fired with Pyro); goldbars drop uses the same bar
  function rewardBigBombCombo(x, y, radius) {
    if (engineMode !== "arcade" || !arcadeActive) return;
    if (powerups.some((p) => p.type === "goldbars")) return;
    let big = 0;
    const r2 = radius * radius;
    for (let i = 0; i < sim.asteroids.length; i += 1) {
      const a = sim.asteroids[i];
      if (a.kind !== 3 || a.ambient) continue;
      const dx = a.x - x;
      const dy = a.y - y;
      if (dx * dx + dy * dy <= r2) big += 1;
    }
    if (big >= BIG_BOMB_GOLDBARS_THRESHOLD) {
      awardCombo({
        key: "big_bomb",
        label: "BIG BOMB COMBO",
        points: 500,
        x,
        y,
        colors: ["255,215,0", "255,90,90"],
      });
      spawnPowerupAt("goldbars", randomPowerupPoint());
      playGameSfx("bling", 0.85);
    }
  }

  // 2026-06-24 PERF: rapid-fire bombs and the chain-reaction levels (L12/L13) used to fire the FULL
  // screen-wide FX stack — white flash, double shake, "hectic" bg toggle, a 3-impact heavy haptic
  // burst, and two boom SFX — on EVERY blast. With MINE_CHAIN_PER_FRAME mines draining per frame plus
  // player rapid-fire, those globals stacked N-deep every frame (the bridged native haptic calls are
  // the worst offender) → fps slideshow. The per-blast LOCAL FX (particles, shrapnel, warp ring, pixi
  // shockwave at the blast point) still fire every time; only these screen-wide globals coalesce to
  // one hit per cooldown window — visually indistinguishable (you can't resolve 5 flashes in 130ms).
  let _lastBombScreenFxAt = 0;
  const BOMB_SCREEN_FX_COOLDOWN_MS = 130;
  function triggerBombScreenFx() {
    const now = performance.now();
    if (now - _lastBombScreenFxAt < BOMB_SCREEN_FX_COOLDOWN_MS) {
      // Coalesced blast: keep a single light boom so the hit still reads, but skip the heavy stack.
      playGameSfx("bigbang", 1.05);
      return false;
    }
    _lastBombScreenFxAt = now;
    triggerLandmineScreenFlash();
    cssFlash("#ffffff", 0.55, 300);
    cssShake(1.8);
    setTimeout(() => cssShake(1.0), 120);
    window.galaxyBackground?.setHectic(true);
    setTimeout(() => window.galaxyBackground?.setHectic(false), 3000);
    triggerHugeHaptic(); // 2026-06-12: bomb blast = huge haptic
    playBigBoomSound();
    playGameSfx("bigbang", 1.62);
    return true;
  }

  function explodeMineEntity(mine, { halfRadius = false } = {}) {
    if (!mine) return;
    const x = mine.x;
    const y = mine.y;
    const radius = halfRadius ? 350 : 700;
    rewardBigBombCombo(x, y, radius);
    spawnBombShrapnel(x, y);
    window.pixiRenderer?.triggerBombDetonation?.(x, y, radius);
    addWarpRing(x, y, "rgba(255,90,90,1)");
    spawnExplosion(x, y, 80, true);
    spawnExplosiveElectricBurst(x, y, radius, halfRadius ? 4 : 7);
    triggerBombScreenFx();
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
    rewardBigBombCombo(x, y, 1050); // 2026-06-23: 5+ big stroids in the blast → goldbars reward
    spawnBombShrapnel(x, y);
    window.pixiRenderer?.triggerBombDetonation?.(x, y, 1050);
    addWarpRing(x, y, "rgba(255,90,90,1)");
    spawnExplosion(x, y, 80, true);
    spawnExplosiveElectricBurst(x, y, 700, 8);
    triggerBombScreenFx(); // 2026-06-24 PERF: throttled screen-wide FX (see triggerBombScreenFx)
  }

  function spawnBombShrapnel(x, y) {
    const count = 24;
    const blastId = ++comboBlastSeq;
    if (comboBombBlastAwarded.size > 64) comboBombBlastAwarded.clear();
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.3;
      const speed = 500 + Math.random() * 400;
      _bombShrapnel.push({
        blastId,
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
        blastId,
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

  function clearGameplayEntities({ keepFx = false } = {}) {
    fkReset(); // DEBUG_FIRSTKILL: re-arm the first-kill probe for the next run
    resetStroidToss();
    resetComboState();
    sim.tossedAsteroid = null;
    while (sim.asteroids.length) releaseAsteroid(sim.asteroids.pop());
    // 2026-07-03: keepFx preserves the in-flight visual FX (explosion debris, rings) so a tutorial
    // field-wipe that JUST spawned per-stroid kill FX doesn't drain them the same frame — that was
    // the "stroids just vanish / no debris" bug. They self-expire via their own TTLs; only the
    // gameplay entities are removed here.
    if (!keepFx) {
      while (sim.particles.length) releaseParticle(sim.particles.pop());
      while (sim.warpRings.length) releaseRing(sim.warpRings.pop());
      while (sim.shockwaves.length) releaseRing(sim.shockwaves.pop());
      resetBoomBurst(); // drop any pending cluster-boom timer so it can't fire across a transition
      sim.lightningRings.length = 0;
    }
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
    pulseCannonUntil = 0; stopPulseFiring(); onPulseEnd(true);
    // 2026-06-21: discard any banked freeze on level transition (bank does NOT persist across
    // levels). Silent — no unfreeze SFX on a level/menu change — but still tear down the lingering
    // FX (icy music filter + HUD glow) so a level that ends mid-freeze doesn't carry them forward.
    // 2026-07-02: EXCEPT while the freeze tutorial is holding the freeze open (tutorialHoldFreeze).
    // The between-step field clear (clearTutorialField) runs this, and it used to silently kill the
    // freeze the cadet just activated — so the freeze expired right after the "can be toggled" VO
    // and the toss step dropped a redundant second powerup. Keep the held freeze alive across the
    // clear; it's ended explicitly once the cadet tosses a frozen stroid.
    if (!tutorialHoldFreeze) {
      _freezeBankMs = 0;
      _freezeActive = false;
      audioEngine.removeFreezeFilter();
      hudFreezeBtn?.classList.remove("hudFreezeBtn--active");
    }
    emergencyTimerSpawned = false; // 2026-06-16: re-arm the under-20s emergency timer drop
    pulseForceSpawnedThisLevel = 0; // 2026-07-01: re-arm the per-level guaranteed Pulse Cannon drop(s)
    firedGuaranteedSpawns.clear(); // 2026-06-16: re-arm cfg.guaranteedSpawn entries
    firedWaves.clear(); // 2026-06-23: re-arm cfg.waves second-wave surges
    appliedSpeedEscalation = 1; // 2026-06-16: reset L15 speed ramp
    // 2026-06-14: freeze inventory PERSISTS across levels (matches bomb) — collected freezes
    // carry forward; only a full game reset (startArcadeNew / startStuntMode) zeroes it.
    updateHudFreezeInventory();
    updateHudQuadBadge();
    updateHudPulseBadge();
    bombAimMode = false;
    hudBombBtn?.classList.remove("hudBombBtn--aiming");
    updateHudBombInventory();
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
    plasmaCage.placed = null; // 2026-07-03: drop any pending MANUAL net on level/menu transition (mode persists)
    plasmaCage.releaseFx = null;
    plasmaCage.rechargeSoundPlayed = true;
    updatePlasmaModeBtn();
    if (!keepFx) {
      laserBeams.length = 0;
      tapBlasts.length = 0;
      _bombShrapnel.length = 0; // in-flight bomb shrapnel keeps flying/killing under keepFx
      flameTrail.length = 0;
      fireBlobs.length = 0;
    }
    stopPlasmaChargeSound();
    stopWarningState();
  }

  let _lsrStylesInjected = false;
  let _lvlTransWatch = null;

  // 2026-06-22: gated diagnostic loggers — no-ops in shipped builds (see DEBUG_LVLTRANS).
  const lvlTrace = (...a) => { if (DEBUG_LVLTRANS) console.log(...a); };
  const spcTrace = (...a) => { if (DEBUG_SPC_VO) console.log(...a); };

  // 2026-06-26: ON-SCREEN level-entry freeze probe (no Web Inspector needed). For each level
  // entry it records (a) the synchronous cost of each suspect phase inside startLevel and
  // (b) the worst single frame delta in the WINDOW_MS after entry — a ~10s WKWebView freeze
  // shows up as one giant rawDt on the first frame after the app un-stalls. The summary is
  // painted just above the BUILD stamp so it's readable straight off the iPad. Flip
  // FREEZE_DIAG=false to remove once the L9 freeze is pinned. // DEBUG: revert before release
  const FREEZE_DIAG = false; // 2026-06-26: freezes resolved, on-screen worst-Δ probe hidden (flip true to re-arm)
  // 2026-06-26 EXPERIMENT: skip the L9→L10 boss-tier lookahead preload (boss video + boss music)
  // to test whether that resource spike is the L9-entry render-server crash. // DEBUG: revert before release
  const SKIP_BOSS_LOOKAHEAD = true;
  // Worst frame is tracked for the WHOLE level (until the next entry), repainted live on every
  // new worst, so a freeze that starts seconds in and lasts ~10s can never slip past a fixed
  // window — its recovery frame (huge rawDt) is always still being watched.
  const _fd = { level: 0, t0: 0, phases: [], worstDt: 0, worstAt: 0, armed: false };
  let _fdEl = null;
  function fdRepaint() {
    if (!FREEZE_DIAG || !_fd.armed) return;
    if (!_fdEl) {
      _fdEl = document.createElement("div");
      _fdEl.style.cssText = "position:fixed;bottom:20px;left:8px;font-family:monospace;"
        + "font-size:10px;color:rgba(255,210,0,0.85);pointer-events:none;z-index:99999;"
        + "white-space:pre;text-shadow:0 0 3px #000;";
      document.body.appendChild(_fdEl);
    }
    const ph = _fd.phases.map(([l, ms]) => `${l}:${ms.toFixed(0)}`).join(" ");
    const syncTotal = _fd.phases.reduce((s, [, ms]) => s + ms, 0);
    const at = _fd.worstAt > 0 ? `@+${(_fd.worstAt - _fd.t0).toFixed(0)}ms` : "";
    _fdEl.textContent = `L${_fd.level} worstΔ=${_fd.worstDt.toFixed(0)}ms ${at}`
      + `\nsync=${syncTotal.toFixed(0)}ms ${ph}`;
  }
  // Begin a probe at the top of startLevel. fdPhase() brackets each suspect call.
  function fdBegin(level) {
    if (!FREEZE_DIAG) return;
    _fd.level = level;
    _fd.t0 = performance.now();
    _fd.phases = [];
    _fd.worstDt = 0;
    _fd.worstAt = 0;
    _fd.armed = true;
  }
  function fdPhase(label, fn) {
    if (!FREEZE_DIAG) return fn();
    const a = performance.now();
    const r = fn();
    _fd.phases.push([label, performance.now() - a]);
    return r;
  }
  // Called every frame from the main loop. rawDt is the inter-frame gap (10s freeze ≈ 10000).
  function fdSampleFrame(rawDt, now) {
    if (!FREEZE_DIAG || !_fd.armed) return;
    if (rawDt > _fd.worstDt) {
      _fd.worstDt = rawDt;
      _fd.worstAt = now;
      fdRepaint();
    }
  }

  // 2026-07-02: ON-SCREEN first-stroid-destroy hitch probe (no Web Inspector needed). Arms on the
  // FIRST asteroid kill of the run (the split call site in resolveShotAt), times that call's
  // synchronous cost (split = explosion-particle alloc + child creation + SFX trigger), then watches
  // the next FK_WINDOW_MS of frames for the worst inter-frame gap — a one-frame stall shows up as one
  // big rawDt. Read it straight off the iPad, just above the freeze/BUILD stamps:
  //   split=X.Xms  → the synchronous destruction work is the cost (particles/children).
  //   worstΔ big @+0ms, split small → the SAME frame's DRAW (first sprite/particle GPU upload) is it.
  //   worstΔ big @+later → a deferred/async cost landed after the kill (image/SFX decode finishing).
  // Re-arms every clearGameplayEntities (each training/level restart). // DEBUG: revert before release
  const DEBUG_FIRSTKILL = false;
  const FK_WINDOW_MS = 2000;
  const _fk = { armed: false, done: false, phaseTaken: false, t0: 0, splitMs: 0, worstDt: 0, worstAt: 0 };
  let _fkEl = null;
  function fkRepaint() {
    if (!DEBUG_FIRSTKILL) return;
    if (!_fkEl) {
      _fkEl = document.createElement("div");
      _fkEl.style.cssText = "position:fixed;bottom:52px;left:8px;font-family:monospace;"
        + "font-size:10px;color:rgba(0,255,180,0.92);pointer-events:none;z-index:99999;"
        + "white-space:pre;text-shadow:0 0 3px #000;";
      document.body.appendChild(_fkEl);
    }
    const at = _fk.worstAt > 0 ? `@+${(_fk.worstAt - _fk.t0).toFixed(0)}ms` : "";
    _fkEl.textContent = `FIRSTKILL split=${_fk.splitMs.toFixed(1)}ms`
      + `\nworstΔ=${_fk.worstDt.toFixed(0)}ms ${at}`;
  }
  function fkReset() {
    if (!DEBUG_FIRSTKILL) return;
    _fk.armed = false; _fk.done = false; _fk.phaseTaken = false;
    _fk.t0 = 0; _fk.splitMs = 0; _fk.worstDt = 0; _fk.worstAt = 0;
  }
  function fkArm() {
    if (!DEBUG_FIRSTKILL || _fk.armed || _fk.done) return;
    _fk.armed = true;
    _fk.t0 = performance.now();
    fkRepaint();
  }
  // Brackets the first-kill split call; a no-op passthrough on every later kill / after the window.
  function fkPhase(fn) {
    if (!DEBUG_FIRSTKILL || _fk.done || _fk.phaseTaken) return fn();
    const a = performance.now();
    const r = fn();
    _fk.splitMs = performance.now() - a;
    _fk.phaseTaken = true;
    fkRepaint();
    return r;
  }
  function fkSampleFrame(rawDt, now) {
    if (!DEBUG_FIRSTKILL || !_fk.armed) return;
    if (rawDt > _fk.worstDt) { _fk.worstDt = rawDt; _fk.worstAt = now; fkRepaint(); }
    if (now - _fk.t0 >= FK_WINDOW_MS) { _fk.armed = false; _fk.done = true; }
  }

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
    lvlTrace(`[lvltrans] frame watcher start levelIndex=${levelIndex}`);
  }

  function sampleLevelTransitionFrame(dt, now) {
    const watch = _lvlTransWatch;
    if (!watch || dt <= 32) return;
    watch.overBudgetFrames += 1;
    watch.droppedFrames += Math.max(1, Math.round(dt / (1000 / 60)) - 1);
    watch.worstFrameMs = Math.max(watch.worstFrameMs, dt);
    lvlTrace(`[lvltrans] slow frame dt=${dt.toFixed(1)}ms elapsed=${(now - watch.startedAt).toFixed(1)}ms`);
  }

  function scheduleLevelTransitionReport(delayMs = 500) {
    const watch = _lvlTransWatch;
    if (!watch) return;
    watch.reportTimer = setTimeout(() => {
      if (_lvlTransWatch !== watch) return;
      lvlTrace(
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
      /* 2026-06-24: opaque backdrop above the comm box (9000) + HUD so the scorecard's first painted
         frame fully covers the just-beaten level and its score counter — no "stale level" flash before
         the panel slams in. The backdrop is solid on frame 1 (no opacity animation); only the panel
         animates (lsrSlam). This is what makes the level feel "put to bed". */
      #levelScoreReport{position:fixed;inset:0;z-index:9500;display:flex;align-items:center;justify-content:center;pointer-events:auto;background:radial-gradient(circle at 50% 42%,rgba(6,16,30,.93),rgba(1,4,10,.97));}
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

  function showLevelScoreReport({ levelNum, levelTimeMs, timeBonus, accuracy, accuracyBonus, comboBonus = 0, ufosKilled, scoreBefore, scoreAfter, onDismiss }) {
    ensureLsrStyles();
    document.getElementById("levelScoreReport")?.remove();

    const overlay = document.createElement("div");
    overlay.id = "levelScoreReport";
    overlay.setAttribute("aria-hidden", "true");

    const acStr = accuracyBonus > 0 ? ` +${accuracyBonus}` : "";
    const tbStr = timeBonus > 0 ? `+${timeBonus}` : "—";
    const comboStr = comboBonus > 0 ? `+${comboBonus}` : "—";
    const panel = document.createElement("div");
    panel.className = "lsr-panel";
    panel.innerHTML = `
      <div class="lsr-title">LEVEL ${levelNum} COMPLETE</div>
      <div class="lsr-div">─────────────────</div>
      <div class="lsr-row"><span class="lsr-lbl">SCORE</span><span class="lsr-val" id="lsrScoreVal">${scoreBefore}</span></div>
      <div class="lsr-row"><span class="lsr-lbl">LEVEL TIME</span><span class="lsr-val">${formatRunTime(levelTimeMs)}</span></div>
      <div class="lsr-row"><span class="lsr-lbl">ACCURACY</span><span class="lsr-val">${accuracy}%${acStr}</span></div>
      <div class="lsr-row"><span class="lsr-lbl">UFOs</span><span class="lsr-val">${ufosKilled}</span></div>
      <div class="lsr-row"><span class="lsr-lbl">COMBOS</span><span class="lsr-val">${comboStr}</span></div>
      <div class="lsr-row"><span class="lsr-lbl">TIME BONUS</span><span class="lsr-val">${tbStr}</span></div>
      <div class="lsr-div">─────────────────</div>
      <div class="lsr-row lsr-total"><span class="lsr-lbl">TOTAL</span><span class="lsr-val" id="lsrTotalVal">${scoreBefore}</span></div>
      <div class="lsr-hint">TAP TO CONTINUE</div>
    `;
    overlay.appendChild(panel);
    (galaxyView || document.body).appendChild(overlay);
    lvlTrace(`[lvltrans] scorecard overlay appeared level=${levelNum}`);

    // FIX 2026-06-09: make sure a UFO doesn't linger behind the scorecard
    // 2026-06-13: clear ALL gameplay entities (asteroids, flames, powerups, particles, mines…)
    // the moment the scorecard appears so the playfield is empty behind it — they used to linger,
    // still rendering, until the next startLevel() cleared them on dismiss. Idempotent with that.
    clearGameplayEntities();

    // 2026-06-26: defocus the just-completed level's background (blur+grayscale, bg video paused)
    // so it isn't sitting visible behind the scorecard. Cleared in startLevel() as the next bg loads.
    setLevelBackgroundDefocus(true);

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
    let hintVisible = false; // 2026-06-26: TAP TO CONTINUE shown — single tap may now skip
    let autoTimer = null;
    const tallyTimers = [];
    let tallyDone = false;
    let scoreRevealComplete = false;
    let writeLoopHandle = null;
    let countupRaf = 0;

    function stopWriteLoop() {
      if (writeLoopHandle) {
        try { audioEngine.stopLoop("write_on_text_loop"); } catch {}
        writeLoopHandle = null;
      }
    }

    function completeScorecardReveal() {
      if (dismissed || scoreRevealComplete) return;
      scoreRevealComplete = true;
      tallyTimers.forEach(t => clearTimeout(t));
      tallyTimers.length = 0;
      if (countupRaf) { cancelAnimationFrame(countupRaf); countupRaf = 0; }
      stopWriteLoop();
      revealEls.forEach((el) => el.classList.add("in"));
      const hint = panel.querySelector(".lsr-hint");
      hint?.classList.add("in");
      hintVisible = true;
      const totalEl = panel.querySelector("#lsrTotalVal");
      if (totalEl) {
        totalEl.textContent = scoreAfter;
        totalEl.classList.remove("score-tick-flash");
        totalEl.classList.add("score-final-flash");
        setTimeout(() => totalEl.classList.remove("score-final-flash"), 300);
      }
      if (!tallyDone) {
        tallyDone = true;
        playGameSfx("level_up", 0.9);
        cssFlash("#00FFD1", 0.24, 240);
      }
    }

    function dismiss() {
      if (dismissed) return;
      dismissed = true;
      lvlTrace(`[lvltrans] scorecard dismiss elapsed=${(performance.now() - shownAt).toFixed(1)}ms`);
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
      if (!hintVisible && !scoreRevealComplete) {
        // 2026-06-30: stray firing taps were skipping the write-on the instant the scorecard
        // appeared. Swallow single taps in the first second; after that a tap still fast-forwards.
        // 2026-07-02: a deliberate double-tap is clearly not a stray fire, so it skips the
        // write-on immediately (even inside the first-second swallow window).
        if (tapNow - shownAt >= 1000 || isDoubleTap) completeScorecardReveal();
        return;
      }
      // 2026-06-26: stray firing taps were skipping the scorecard. Only skip via either
      // (a) a deliberate double-tap once it's been up ≥1s, or (b) a single tap once TAP TO CONTINUE shows.
      if (hintVisible || (isDoubleTap && tapNow - shownAt >= 1000)) dismiss();
    }, { passive: false });

    // 2026-06-30: don't auto-advance while the level-complete comm is still talking. After the
    // base 7s, re-poll until the VO goes idle, then dismiss. Hard cap (+8s) so a stuck/never-
    // played VO can't pin the scorecard open. Manual dismiss paths are unaffected.
    const autoAdvanceDeadline = performance.now() + 7000 + 8000;
    function scheduleAutoDismiss(ms) {
      autoTimer = setTimeout(() => {
        if (dismissed) return;
        if (commBoxController.isVOActive() && performance.now() < autoAdvanceDeadline) {
          scheduleAutoDismiss(300);
          return;
        }
        dismiss();
      }, ms);
    }
    scheduleAutoDismiss(7000);

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
            if (!dismissed) { panel.querySelector(".lsr-hint")?.classList.add("in"); hintVisible = true; }
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
    lvlTrace(`[lvltrans] levelComplete entry levelIndex=${currentLevelIndex}`);
    startLevelTransitionWatch(currentLevelIndex);
    arcadeActive = false;
    retryPending = false;
    // 2026-06-21 (Item 1b): lock the comm box to a single praise line for the whole level-end
    // window (scorecard → next level start). Set BEFORE the levelcomplete VO is queued below so
    // that one line passes; everything else is suppressed. Cleared in startLevel().
    commBoxController.setLevelEndLock(true);
    stopWarningState();
    // 2026-06-26: clear the big red ≤20s countdown number the instant the level completes so it
    // doesn't linger behind/after the scorecard (noticed when a level is cleared inside the red
    // warning window — arcadeActive flips false here so updateArcadeHud stops repainting/clearing it).
    if (hudTimer) {
      hudTimer.textContent = "";
      hudTimer.classList.remove("visible", "slam", "warning", "critical");
    }
    _timerNumberVisible = false;
    _timerSlammed = false;
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
    // 2026-06-23: L13/L14 are SPC levels (SPC face, CMDR voice muted), but the end-of-level praise
    // is the Commander's line ("Phenomenal work, cadet"). Show HIS mug (correct crop via the standard
    // commander portrait) and let his voice through for this one comm instead of SPC's face. The next
    // startLevel() re-applies the right portrait override (SPC for L14, CMDR for L15).
    const _lcCfg = ARCADE_LEVELS[currentLevelIndex];
    if (_lcCfg && (_lcCfg.level === 13 || _lcCfg.level === 14)) {
      commBoxController.setMuteCmdrVO(false);
      commBoxController.clearPortraitOverride();
    }
    commBoxController.reactTo("levelcomplete");
    // 2026-06-24: from level 8 on, fold in the "you're killin' it" praise (it name-checks how far the
    // cadet has come, so it'd ring false on the opening levels). Distinct pool key keeps the late
    // shuffle independent of the base one.
    const LEVEL_COMPLETE_LATE_FROM = 8;
    const _lcLevel = _lcCfg ? _lcCfg.level : 0;
    const _lcLate = _lcLevel >= LEVEL_COMPLETE_LATE_FROM;
    // 2026-06-24: on the FINAL clear (game won) skip the routine praise — playWinSequence speaks the
    // dedicated "YOU WIN" line instead, so we don't stack two ~3s commander lines back-to-back.
    const _lcFinalWin = _lcLevel >= ARCADE_LEVELS.length;
    if (!_lcFinalWin) {
      commBoxController.queueVO({
        audioSrc: commBoxController.commVoSrc(
          commBoxController.pickFromPool(
            _lcLate ? "levelcomplete_late" : "levelcomplete",
            _lcLate ? commBoxController.POOL_LEVEL_COMPLETE_LATE : commBoxController.POOL_LEVEL_COMPLETE,
          ),
        ),
        event: "levelcomplete",
      });
    }
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
        comboBonus: comboBonusThisLevel,
        ufosKilled: ufosKilledThisLevel,
        scoreBefore,
        scoreAfter,
        onDismiss: () => {
          setSavedArcadeLevel(nextLevel);
          // 2026-06-12: the "LEVEL X" slam-in fires ONCE, from startLevel() once the next level
          // is fully loaded — not here on dismiss (that double-slammed: once pre-load, once post).
          setTimeout(() => {
            // 2026-06-24: the per-level audioEngine.teardown() that used to run here is GONE — it
            // rebuilt the AudioContext every advance to release leaked VO nodes, but that caused
            // level-start freezes, iOS audio-loss (rebuilt ctx starts suspended, can't resume outside
            // a gesture), and music restarts. The leak is now fixed at source (persistent per-channel
            // VO elements, see acquireVoElement), so the ctx lives for the whole session and music
            // carries over seamlessly across same-track level pairs. stopVO() still flushes in-flight VO.
            commBoxController.stopVO();
            // STUB (slot step 3): single between-level seam. Forwards straight to the next level for
            // now; later this is where the slot takes ownership and assumes the startLevel() call.
            handoffAfterScorecard(() => startLevel(currentLevelIndex + 1));
          }, 420);
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
      galaxyView?.classList.remove("level-10", "level-3");
      audioEngine.stopMusic();
      stopGalaxyBackground();
      // 2026-06-24: celebration done — stop the render loop before the initials/YOU-WIN screen so it
      // doesn't keep drawing over the menu (next fresh start re-inits via resizeGalaxyCanvas).
      stopGalaxyLoop();
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
    playGameSfx("level_up", 0.55);

    // 2026-06-24: commander signs off the run with a "you win" line over the celebration (new CMDR
    // drop). Small delay so it lands after the chime/first boom rather than on top of them. The
    // routine level-complete praise is suppressed on the final clear (see _lcFinalWin), so this is
    // the only commander line here — the hold below is stretched to let it finish before handoff.
    setTimeout(() => {
      commBoxController.queueVO({
        voFile: commBoxController.pickFromPool("win", commBoxController.POOL_WIN),
        event: "levelcomplete",
      });
    }, 500);

    // 2026-06-24: track every celebration timer so a mid-sequence teardown (new game / navigate away,
    // which runs stopGalaxyLoop) cancels the pending explosions/fade instead of firing them blind.
    _winSeqTimers.forEach(clearTimeout);
    _winSeqTimers = [];

    // 7 large explosions at random spots across the screen, staggered ~180ms over ~1.3s.
    const EXPLOSION_COUNT = 7;
    const boomKeys = ["explosion_big", "explosion_med", "explosion_med_alt"];
    for (let i = 0; i < EXPLOSION_COUNT; i += 1) {
      _winSeqTimers.push(setTimeout(() => {
        const x = sim.width * (0.12 + Math.random() * 0.76);
        const y = sim.height * (0.15 + Math.random() * 0.6);
        spawnExplosion(x, y, 60, true, 2.4, 1.2, 3, "roid01");
        cssShake(i === 0 ? 1.5 : 0.8);
        playGameSfx(boomKeys[i % boomKeys.length], 1.1 + Math.random() * 0.2, { important: true });
      }, i * 180));
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

    // Hold the "YOU WIN" slam, fade out, then hand off. 2026-06-24: extended from 2400→4200ms so the
    // commander "you win" line (queued ~0.5s in, ~3s long) finishes before the handoff to the
    // score/initials screen instead of getting cut off.
    _winSeqTimers.push(setTimeout(() => {
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
    }, 4200));
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
        arcadeScore = arcadeScoreAtLevelStart;
        slotTokens = slotTokensAtLevelStart; // 2026-07-02: erase gold-bar tokens banked during the failed attempt
        renderLives();
        renderScore();
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
    // 2026-06-24: terminal game over — fully stop the render loop (was left running over the
    // GAME OVER / initials screen, burning CPU/GPU every session). The next fresh start re-inits the
    // renderer via resizeGalaxyCanvas (same teardown stopAndMenu already does on the way to the menu).
    stopGalaxyLoop();
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
    fdBegin(ARCADE_LEVELS[clamp(idx, 0, ARCADE_LEVELS.length - 1)]?.level || 0);
    lvlTrace(`[lvltrans] startLevel entry requestedIndex=${idx}`);
    stuntActive = false; // a real arcade level is never a stunt session
    practiceEndless = false; // ...nor an endless practice session (Stunt Practice re-sets this after)
    commBoxController.setLevelEndLock(false); // 2026-06-21 (Item 1b): next level live — end the level-end VO lock
    setLevelBackgroundDefocus(false); // 2026-06-26: lift the scorecard bg blur as the next level's bg comes in
    const safeIdx = clamp(idx, 0, ARCADE_LEVELS.length - 1);
    audioEngine.unlock?.();
    audioEngine.loadMany?.(gameplayPreloadSfxMap());
    currentLevelIndex = safeIdx;
    const cfg = ARCADE_LEVELS[safeIdx];
    const now = performance.now();
    arcadeScoreAtLevelStart = arcadeScore;
    slotTokensAtLevelStart = slotTokens; // 2026-07-02: baseline for the lost-life token rollback (see Retry)
    setSavedArcadeLevel(cfg.level);
    initMediaSession().then(() => updateMediaSessionLevel(cfg.level, cfg.label));
    galaxyView?.classList.toggle("level-10", cfg.level === 10);
    galaxyView?.classList.toggle("level-3", cfg.level === 3); // 2026-06-22: "Blue Moon" backdrop prop
    applyLevelTheme(cfg.level);

    clearGameplayEntities();
    shotsFired = 0;
    shotsHit = 0;
    ufosKilledThisLevel = 0;
    comboBonusThisLevel = 0;
    commBoxController.show();
    commBoxController.setDamageState("normal");
    showFpsOverlay();
    resetPraiseState();
    totalToSpawn = cfg.totalToClear;
    spawnedTotal = 0;
    spawnQueue = Math.max(0, cfg.totalToClear - cfg.startSpawn);
    maxOnScreen = capIOSNativeAsteroids(cfg.maxOnScreen);
    // 2026-06-23: give the L4 debris field its own headroom in the hard cap so ambient debris never
    // starves the real-asteroid trickle (the trickle gate is keyed on nonAmbientAsteroidCount).
    sim.maxAsteroids = capIOSNativeAsteroids(cfg.maxOnScreen)
      + (cfg.debrisField ? (cfg.debrisField.maxDebris || 4) : 0);
    levelDurationMs = cfg.time * 1000;
    levelRunStartAt = now + 400;
    arcadePausedUntil = levelRunStartAt;
    levelEndsAt = levelRunStartAt + levelDurationMs;
    nextSpawnAt = cfg.spawnEveryMs > 0 ? levelRunStartAt + cfg.spawnEveryMs : Infinity;
    // 2026-06-23: L4 ambient debris field — first piece a touch after the level settles.
    nextDebrisAt = cfg.debrisField ? levelRunStartAt + (cfg.debrisField.intervalMs || 1500) : Infinity;
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
    _musicRampFired = false;
    resetArcadeTimerVisuals();
    syncArcadeEntryLabel();
    fdPhase("bg", () => setGalaxyBackgroundForLevel(cfg.level));
    window.galaxyBackground?.show();
    fdPhase("theme", () => {
      window.galaxyBackground?.setTheme(cfg.level);
      window.galaxyBackground?.setLevel(cfg.level);
    });
    if (currentLevelIndex > 0) {
      fdPhase("warp", () => window.galaxyBackground?.triggerWarp());
    }
    lvlTrace(`[lvltrans] after triggerWarp invoked=${currentLevelIndex > 0}`);
    fdPhase("music", () => playArcadeMusicForLevel(cfg.level));
    if (cfg.level === 10) {
      playGameSfx("lastlevelstart", 0.96);
    }
    // 2026-06-15: early levels felt empty when every starting asteroid entered from the rim.
    // Seed a share of them in the interior (clear of the center ship) so the field reads full
    // from the first second. Tapers to 0 once the later levels are naturally busy.
    const _spawnWorkStartAt = performance.now();
    lvlTrace(`[lvltrans] before synchronous spawn work level=${cfg.level} startSpawn=${cfg.startSpawn} mines=${cfg.mineLaunch ? (cfg.mineCount || 1) : 0}`);
    const interiorShare = cfg.level <= 2 ? 0.5 : cfg.level <= 4 ? 0.35 : 0;
    fdPhase("spawn", () => {
      for (let i = 0; i < cfg.startSpawn; i += 1) {
        const p = Math.random() < interiorShare ? randomInteriorPoint() : randomPerimeterPoint();
        spawnAsteroid(p.x, p.y, pickAsteroidKind(cfg), false);
        spawnedTotal += 1;
      }
    });

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
    lvlTrace(`[lvltrans] after synchronous spawn work duration=${(performance.now() - _spawnWorkStartAt).toFixed(1)}ms asteroids=${sim.asteroids.length} mines=${placedBombs.length}`);

    // 2026-06-23: cfg.waves second-wave surges are wired in the main update loop (keyed on
    // levelRemainingMs <= triggerAtRemaining), not here — startLevel only seeds the opening field.

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
      // 2026-06-25: set SPC up as the level host (routing + CMDR mute) but DON'T leave her mug
      // standing at level start — collapse the box so her mug first appears with her intro VO.
      commBoxController.collapseCommNow();
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
    } else if (levelNum === 7) {
      // 2026-06-24: dedicated level-7 intro (new CMDR drop) — "we're getting deeper".
      levelStartVO = "CMDR_level_7_start_were_getting_deeper.mp3";
    } else if (levelNum === 15) {
      // 2026-07-02: L15 opens silent for 10s (no "THE GAUNTLET" intro) — then the CMDR opens with a
      // "let's blast these 'stroids" line. Handled in the L10-style hush branch below.
      levelStartVO = null;
    } else {
      levelStartVO = commBoxController.pickFromPool(
        "levelstart",
        commBoxController.POOL_LEVEL_START,
      );
    }

    // 2026-06-17: delay the first VO 800ms so the level-intro animation finishes before SPC/CMDR
    // starts talking (the comm box was popping up before the level had visually settled).
    // 2026-06-24: L10 stays silent for the first 8s — no intro chatter before the action gets going.
    // 2026-07-02: L15 hushes for 10s, then opens with the CMDR blast line (like L10's 8s hush).
    const firstVoDelayMs = levelNum === 10 ? 8000 : (levelNum === 15 ? 10000 : 800);
    setTimeout(() => {
      // 2026-06-24: L10 — after the 8s hush the commander opens with the blast line (its only intro).
      // 2026-07-02: L15 does the same after its 10s hush.
      if (levelNum === 10 || levelNum === 15) {
        commBoxController.queueVO({
          voFile: commBoxController.pickFromPool("cmdrBlast", commBoxController.POOL_CMDR_BLAST),
          event: "commander",
        });
        return;
      }
      // 2026-06-17: levels 13 & 14 — SPC owns the comm box and CMDR voice is muted, so greet the
      // cadet with one of her own intro lines instead of the muted CMDR line.
      // 2026-06-24: pick from POOL_SPC_LEVEL_START for variety; red themes (L13) get the
      // "gettin' hot in here" line.
      // 2026-07-03: L14's OFFICIAL opener is hard-set to the "peeing their pants" line (was a random
      // pool pick that duplicated) and flagged `protected` so no gameplay reaction can cut it off.
      const spcIntroFile = levelNum === 14
        ? "SPC_peeing_pants.mp3"
        : (levelNum === 13
            ? (isRedTheme(LEVEL_THEMES[levelNum]?.primary)
                ? "SPC_aye_its_gettin_hot_in_here.mp3"
                : commBoxController.pickFromPool("spcLevelStart", commBoxController.POOL_SPC_LEVEL_START))
            : null);
      const spcIntro = spcIntroFile ? commBoxController.spcBonusVoSrc(spcIntroFile) : null;
      if (spcIntro) {
        commBoxController.queueVO({ audioSrc: spcIntro, _spc: true, protected: levelNum === 14 });
      } else if (levelStartVO) {
        // 2026-06-24: pass the intended filename (voFile) so triggerVO resolves audio when recorded
        // and always types the caption.
        // 2026-07-02: L15 sets levelStartVO=null (silent open) — queue nothing in that case.
        commBoxController.queueVO({
          voFile: levelStartVO,
          event: "commander",
        });
      }
    }, firstVoDelayMs);

    if (levelNum === 1) {
      function fireSecondVO() {
        const ticker = document.getElementById("commanderTicker");
        const isActive = ticker?.classList.contains("ticker-visible");
        if (isActive) {
          setTimeout(fireSecondVO, 400);
          return;
        }
        commBoxController.queueVO({
          voFile: commBoxController.pickFromPool("cmdrBlast", commBoxController.POOL_CMDR_BLAST),
        });
      }
      setTimeout(fireSecondVO, 800);
    }
    lvlTrace(`[lvltrans] end startLevel duration=${(performance.now() - _lvlTransStartAt).toFixed(1)}ms level=${cfg.level}`);
    scheduleLevelTransitionReport();
  }

  function startArcadeFromSave() {
    audioEngine.unlock?.();
    audioEngine.loadMany?.(gameplayPreloadSfxMap());
    hideArcadeOverlay();
    if (arcadeResumeAvailable && arcadeActive) {
      const now = performance.now();
      levelEndsAt = now + pausedLevelRemainingMs;
      restoreLandmineTimer(pausedLandmineRemainingMs, now);
      engineMode = "arcade";
      setMenuOverlayOpen(false);
      setGalaxyViewMode("arcade");
      setGalaxyTool("draw");
      // 2026-06-22: the comm box was hidden when we paused into the menu (showModeSelect preserve
      // branch) — bring it back on resume so the commander HUD reappears with the live game.
      commBoxController.show();
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
    slotTeardown(SLOT_REASON.NEW_GAME); // dispose any live slot before discarding its tokens
    slotTokens = 0; // 2026-06-26: discard banked POLYSLOTS tokens on a fresh run
    slotNukeOwned = 0; slotPendingQuadShot = 0; // reset per-game slot reward state
    // 2026-06-10: reset powerup + active effect state
    powerups.length = 0;
    quadShotUntil = 0;
    pulseCannonUntil = 0; stopPulseFiring(); onPulseEnd(true);
    _freezeBankMs = 0;
    _freezeActive = false;
    playerFreezeInventory = 0;
    updateHudFreezeInventory();
    updateHudQuadBadge();
    updateHudPulseBadge();
    bombAimMode = false;
    hudBombBtn?.classList.remove("hudBombBtn--aiming");
    updateHudBombInventory();
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

  async function startArcadeAtLevel(levelNum) {
    arcadeLevelSelectOpen = false; // 2026-06-24: grid is dismissed — re-enable comms for the run
    const numericLevel = Math.floor(Number(levelNum));
    const safeLevel = Number.isFinite(numericLevel) ? numericLevel : 1;
    await warmArcadeAssets(safeLevel);
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
    const idx = clamp(safeLevel - 1, 0, ARCADE_LEVELS.length - 1);
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
  // 2026-07-02: warm the assets specific to Training that the generic arcade warmup can't reach.
  // Runs right after warmArcadeAssets(1) in startStuntMode, keeping the WARMING UP overlay up.
  async function warmTrainingAssets() {
    setArcadeWarmupVisible(true, "WARMING UP");
    try {
      // 1) SPC portrait frames — .src is set at load but never decoded, so the first talk/praise
      //    frame swap (which lands right around the first Stroid kill) decode-hitches. Decode now.
      //    NOTE: spcImages lives inside the commBoxController IIFE and is out of scope here — reach
      //    it via the accessor. (Referencing the bare identifier threw ReferenceError → bounced the
      //    user back to the menu on every Training launch.)
      await warmImageSet(commBoxController.getSpcImages());
      // 2) Plasma-net demo clip — built lazily on first show today; pre-build + buffer it so the
      //    first plasma lesson doesn't stall fetching/decoding the video.
      try {
        const v = _ensureDemoOverlayEl();
        if (v && v.readyState < 2) v.load();
      } catch {}
      // 3) Second, uncapped gameplay-sprite prime. The arcade pass races an 1800ms cap that can be
      //    truncated on a cold device, re-introducing the first-stroid FX upload hitch. Idempotent
      //    (already-decoded images are no-ops); bounded so it can never hang the warmup screen.
      if (typeof warmGameplaySprites === "function") {
        await Promise.race([warmGameplaySprites(), delay(3000)]);
      }
    } catch (err) {
      // Warmup is best-effort — a failure here must NEVER abort startStuntMode and bounce the
      // user to the menu. Swallow and let Training start (assets decode lazily as a fallback).
      console.warn("warmTrainingAssets failed (continuing):", err);
    } finally {
      setArcadeWarmupVisible(false);
    }
  }

  async function startStuntMode() {
    // 2026-06-24: the audioEngine.teardown() that used to run here is GONE. Backing out of Training
    // and restarting it was laggy because the SPC tutorial (VO-heavy) piled up MediaElementSource
    // nodes; teardown released them by closing the ctx but caused freezes + audio-loss. The leak is
    // now fixed at source (one persistent "SPC" VO element, see acquireVoElement), so the ctx persists.
    commBoxController.stopVO();
    // 2026-06-30: a user who opens the app and goes straight to Training bypassed the main-game
    // "WARMING UP" pass, so first-run gameplay hitched. Reuse the same warmup (unlock + full SFX +
    // sprite GPU-prime) so Training/Practice are as smooth as the main game. warmArcadeAssets already
    // unlocks audio and loads the gameplay SFX map, so no separate loadMany is needed here.
    await warmArcadeAssets(1);
    // 2026-07-02: then warm the Training-only surfaces (SPC frames, demo video, uncapped sprite
    // prime) so the first Stroid kill / first portrait swap / first plasma demo don't hitch.
    await warmTrainingAssets();
    hideArcadeOverlay();
    tapBlasts = [];
    // fresh, pressure-free state
    arcadeScore = 0;
    arcadeLives = 0;
    playerBombInventory = 0;
    playerFreezeInventory = 0;
    quadShotUntil = 0;
    pulseCannonUntil = 0; stopPulseFiring(); onPulseEnd(true);
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
    galaxyView?.classList.remove("level-10", "level-3");
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
    updateHudPulseBadge();

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
  // 2026-06-22 (Item 2): fire-and-forget — clear the comm box a beat after the current VO drains,
  // so a gameplay step gets the full playfield (like the "destroy the stroids" step) without the
  // phase awaiting it. Abort-safe: the abortable waiters reject on teardown and are swallowed.
  function hideCommsAfterVO(extraMs = 1000) {
    (async () => {
      try {
        await waitVOIdle();
        await waitMs(extraMs);
        // 2026-06-23: a NEW SPC line may have started during the wait (e.g. the cadet finished the
        // net fast and the "Nice work — you learn fast" praise line is now playing). Hiding here was
        // blanking the comm box mid-line (text + portrait invisible). Only hide if SPC is truly idle.
        if (stuntActive && !_spcPlaying && _spcQueue.length === 0) commBoxController.hide();
      } catch { /* aborted on teardown */ }
    })();
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
  function spcVO(key, text, frameHint, onStart) {
    _spcQueue.push({ key, text, frameHint, onStart });
    pumpSpc();
  }
  function pumpSpc() {
    if (_spcPlaying || _spcQueue.length === 0) return;
    const { key, text, frameHint, onStart } = _spcQueue.shift();
    _spcPlaying = true;
    // Start the "continuous talking" clock at the first line of an uninterrupted run; following
    // lines start immediately so the run is unbroken until the queue empties (see advance()).
    if (_spcContinuousStartAt === 0) _spcContinuousStartAt = performance.now();
    commBoxController.show();
    commBoxController.spcSpeakStart?.(frameHint); // animate the SPC portrait first so the mouth-flap starts immediately
    commBoxController.pinTicker(text); // types text + keeps ticker visible (cancels auto-hide)
    // 2026-06-23: optional per-line hook fired exactly when this caption starts (used to sync a
    // visual demo to the words — e.g. replaying the plasma recharge while SPC narrates it).
    if (onStart) { try { onStart(); } catch {} }
    const src = spcVoSrc(key);
    const dur = Math.max(1200, Math.min(4600, (text.length * 46) / SPC_VO_PLAYBACK_RATE));
    const advance = () => {
      if (!_spcPlaying) return; // idempotent: orphaned timer / watchdog / onerror+onended race can't double-advance
      // 2026-06-22: hold a caption for a minimum readable window before handing off to the next
      // queued line, so a short or force-advanced line is never overwritten before it's seen.
      if (_spcQueue.length > 0 && _spcLineStartedAt > 0) {
        const shown = performance.now() - _spcLineStartedAt;
        if (shown < SPC_MIN_CAPTION_MS) {
          if (_spcTimer) clearTimeout(_spcTimer);
          _spcTimer = setTimeout(advance, SPC_MIN_CAPTION_MS - shown);
          return;
        }
      }
      if (_spcTimer) { clearTimeout(_spcTimer); _spcTimer = null; }
      if (_spcAudioFxCleanup) { _spcAudioFxCleanup(); _spcAudioFxCleanup = null; }
      // 2026-06-18: pause before nulling — a forced advance (watchdog/skip/fallback) must not
      // leave the previous clip audible under the next line.
      if (_spcAudio) { try { _spcAudio.pause(); } catch {} }
      _spcAudio = null;
      _spcPlaying = false;
      _perimeterVoFlash = false; // 2026-07-03: perimeter strobe lives exactly one VO line
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
        // 2026-06-24: reuse the persistent "SPC" VO element (see acquireVoElement) — the SPC tutorial
        // is VO-heavy, so a fresh element + createMediaElementSource per line leaked the fastest.
        _spcAudio = acquireVoElement("SPC");
        _spcAudio.src = src;
        _spcAudio.volume = 0.85;
        _spcAudio.playbackRate = SPC_VO_PLAYBACK_RATE;
        _spcAudioFxCleanup = applyCommRadioEffect(_spcAudio);
        _spcAudio.onerror = (e) => {
          // 2026-06-17: surface load failures on device — relative path is correct for
          // capacitor://localhost, so an error here means the file is missing from the bundle
          // or the codec/MIME failed to decode. Falls back to text-only caption (advance()).
          const code = _spcAudio && _spcAudio.error ? _spcAudio.error.code : "?";
          console.warn("[SPC] audio error", { key, src, code, e });
          // 2026-06-22: don't advance instantly on a load/decode failure — that lets the next
          // line overwrite this caption before it's readable (the "show you the ropes" bug).
          // Fall back to the text-length timer so the caption stays up like the no-audio path.
          if (_spcPlaying) {
            if (_spcTimer) clearTimeout(_spcTimer);
            _spcTimer = setTimeout(advance, dur);
          }
        };
        // 2026-06-18: iOS WKWebView does NOT reliably fire 'ended' on a media element routed
        // through a Web Audio graph (applyCommRadioEffect). So the PRIMARY advance is a timer
        // computed from the REAL clip duration, rate-adjusted to actual playtime. 'onended' stays
        // as a nice-to-have early trigger when it does fire. Both go through the idempotent advance().
        _spcAudio.onended = () => { spcTrace("[SPC] ended", key); advance(); };

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
          spcTrace("[SPC] playing", key, "playMs", Math.round(playMs), "-> advance in", Math.round(ms), "ms");
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
          if (wall > 0.05) spcTrace("[SPC] rate-check", key, "observed", (ct / wall).toFixed(3), "expected", SPC_VO_PLAYBACK_RATE);
          _spcAudio.ontimeupdate = null; // one-shot
        };

        // Pre-START backstop: if neither 'playing' nor play() resolves, don't stall on the 8s
        // watchdog. armPlayTimer() replaces this with the precise timer the instant playback starts.
        _spcTimer = setTimeout(advance, 9000);
        const p = _spcAudio.play();
        spcTrace("[SPC] play", key, src);
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
    // eslint-disable-next-line no-unreachable -- intentional: feature disabled pending redesign
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
    _positionDemoOverlay(); // keep the demo clip stacked above the banner when both are up
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

  // ── plasma-net demo overlay (2026-06-22): a looping clip showing the tap-and-drag gesture,
  // floated just ABOVE the objective banner during the first plasma lesson. Hidden the instant
  // the cadet starts drawing a net. Muted/looping, pointer-events:none so it never eats taps. ──
  let _demoOverlayEl = null;
  function _ensureDemoOverlayEl() {
    if (_demoOverlayEl) return _demoOverlayEl;
    const v = document.createElement("video");
    v.id = "tutorialDemoOverlay";
    v.src = "assets/video/plasma_net_demonstration_overlay.mov";
    v.muted = true;
    v.loop = true;
    v.playsInline = true;
    v.setAttribute("playsinline", "");
    v.setAttribute("muted", "");
    v.setAttribute("aria-hidden", "true");
    v.style.cssText =
      "position:fixed;z-index:9996;display:none;pointer-events:none;left:50%;"
      + "transform:translate(-50%,-100%);width:min(72vw,300px);height:auto;"
      + "border-radius:10px;opacity:0;transition:opacity 300ms ease;"
      + "box-shadow:0 0 18px rgba(0,255,204,0.45);";
    document.body.appendChild(v);
    _demoOverlayEl = v;
    return v;
  }
  // Rest the overlay's bottom just above the objective banner (or the HUD if the banner is hidden).
  function _positionDemoOverlay() {
    if (!_demoOverlayEl || _demoOverlayEl.style.display === "none") return;
    let topRef;
    if (_taskInstrEl && _taskInstrEl.style.display === "block") {
      topRef = _taskInstrEl.getBoundingClientRect().top;
    } else {
      const hudEl = document.getElementById("commanderHUD");
      const r = hudEl && hudEl.getBoundingClientRect();
      topRef = r && r.height ? r.top - 8 : window.innerHeight * 0.72;
    }
    _demoOverlayEl.style.top = `${topRef - 10}px`;
  }
  function showPlasmaDemoOverlay() {
    const v = _ensureDemoOverlayEl();
    v.style.display = "block";
    _positionDemoOverlay();
    try { v.currentTime = 0; const p = v.play(); if (p && p.catch) p.catch(() => {}); } catch {}
    requestAnimationFrame(() => requestAnimationFrame(() => { v.style.opacity = "1"; }));
  }
  function hidePlasmaDemoOverlay() {
    if (!_demoOverlayEl) return;
    _demoOverlayEl.style.opacity = "0";
    _demoOverlayEl.style.display = "none";
    try { _demoOverlayEl.pause(); } catch {}
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
      const a = spawnAsteroid(p.x, p.y, kind, true, options.spriteKey || null); // warp:true → playWarpSound + addWarpRing; optional per-step skin (e.g. "roidneon" green for the Pulse Cannon step)
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
  // 2026-07-03: full "shot kill" FX for ONE stroid — explosion sprite + coalesced boom, sized per kind,
  // mirroring splitAsteroidByIndex but without splitting/scoring. Lets a field wipe blow every stroid up
  // with real weight instead of a silent puff. The boom auto-coalesces (playAsteroidExplosionBoom's
  // burst window) so wiping a full field doesn't spike audio.
  function spawnStroidKillFx(a, volScale = 1) {
    const bigBlast = a.kind === 3;
    const mediumBlast = a.kind === 2;
    const ttlScale = bigBlast ? 1.4 : mediumBlast ? 1.18 : 1;
    spawnExplosion(a.x, a.y, bigBlast ? 32 : 16, false, bigBlast ? 1.8 : 1.15, ttlScale, a.kind, a.spriteKey);
    // 2026-07-03: match the real shot-kill weight (splitAsteroidByIndex) so a bomb/landmine/missile
    // field wipe BLOWS UP each stroid instead of puffing it away (the training bomb steps read as
    // "stroids just vanish"). Electric burst is size-gated (big/medium only, small count) so wiping a
    // full field at once doesn't spike; it self-guards on sheet.ready + reduced-motion. Size feedback
    // adds the impact "weight".
    if (bigBlast || mediumBlast) spawnExplosiveElectricBurst(a.x, a.y, bigBlast ? 160 : 110, bigBlast ? 4 : 3);
    triggerAsteroidSizeFeedback(a.kind);
    playAsteroidExplosionBoom(a.kind, (bigBlast ? 0.9 : mediumBlast ? 0.92 : 0.78) * volScale, 0.92 + Math.random() * 0.16);
  }
  function clearTutorialField() {
    // Every stroid the wipe removes gets a real kill FX (was a small silent puff — the bomb steps read
    // as "stroids just vanish"). One shared crackle + impact flash for the whole burst keeps it punchy
    // without stacking a dozen particle crackles at once.
    let killed = 0;
    let anyBig = false;
    for (const a of sim.asteroids) {
      spawnStroidKillFx(a);
      killed += 1;
      if (a.kind === 3) anyBig = true;
    }
    if (killed > 0) {
      playParticleCrackle();
      triggerAsteroidImpactFlash(anyBig ? 0.9 : 0.5);
    }
    if (ufo && ufo.alive) spawnExplosion(ufo.x, ufo.y, 20, true, 1.5);
    if (landmine) spawnExplosion(landmine.x, landmine.y, 20, true, 1.5);
    for (const b of placedBombs) spawnExplosion(b.x, b.y, 16, false, 1.2);
    playGameSfx("ufo_destroy", 0.6);
    // 2026-07-03: keepFx — remove the entities but LEAVE the debris/rings we just spawned so the wipe
    // actually blows up (they were being drained the same frame → "stroids just vanish"). The 450ms
    // hold below lets the debris play out before the next step spawns.
    clearGameplayEntities({ keepFx: true });
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
      spcVO("03-04", "First — the perimeter timer. That line around the screen edges shows how long you have to clear the field.", "talk_explain",
        () => { _perimeterVoFlash = true; }); // 2026-07-03: strobe the border while SPC calls it out (cleared at the next line)
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
      showLevelTitleBanner("PRIMARY LASER WEAPON", { training: true });
      spawnTutorialAsteroids(1, 3);
      const baseShots = tutorialEvents.shoot || 0;
      spcVO("08", "These are the **Stroids** — our job is to clear them from the Polyverse.", "talk_friendly");
      spcVO("08b", "Tap to fire your laser and blast the **Stroid** and all its pieces.", "talk_calm");
      showTaskInstructionDeferred("TAP TO FIRE — DESTROY THE STROID");
      // 2026-07-03: arm the clear waiter IMMEDIATELY so a cadet who blasts the field DURING the intro
      // VO advances the instant it's empty. Previously the step blocked on waitVOIdle+800ms before it
      // even started listening, so an early clear meant waiting out the whole VO. On the first shot,
      // clear the comm box + the deferred intro instruction and switch the banner to "DESTROY ALL".
      waitFor(() => (tutorialEvents.shoot || 0) > baseShots)
        .then(() => {
          if (!stuntActive) return;
          commBoxController.hide();
          _pendingTaskInstruction = null; // drop the deferred "TAP TO FIRE" so it can't re-surface
          showTaskInstruction("DESTROY ALL THE STROIDS");
        })
        .catch(() => {});
      await waitFor(tutorialAsteroidsAllCleared);
      if (!stuntActive) return;
      hideTaskInstruction();
      // Praise fires only once the objective is met (all stroids cleared), not before. Clearing the
      // field resolves a waiter, which drops any still-queued intro lines (see updateStunt) so the
      // praise comes up right after the current line — snappy, no waiting out the narration.
      spcVO("08c", "Fantastic, Cadet — you'll show these **Stroids** who's boss.", "praise");
      await waitVOIdle();
      await waitMs(700);
    },
    // 2026-06-21 (Item 2): when the field thins to its last 1-2 stroids, a slow drifter can crawl
    // behind the comm box and look like the game has hung. Give each surviving stroid a one-time
    // 1.5x speed nudge so it clears the comm-box footprint quickly. Per-asteroid flag (cleared on
    // pool release) means it scales each piece exactly once, never frame-over-frame. Laser phase
    // only — no effect on arcade/practice or any other tutorial step.
    onUpdate: (now) => {
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
      showLevelTitleBanner("PLASMA NET WEAPON", { training: true });
      spawnTutorialAsteroids(2, 2);
      // 2026-07-03: show the "here's the net" demo overlay TOGETHER with the title card (concurrent
      // with the intro VO) — the cadet was asking "where's the net?" because it previously only
      // appeared after the three intro lines drained. The onUpdate hook still retires it the instant
      // a real net drag begins.
      tutorialState.plasmaDemoShown = true;
      showPlasmaDemoOverlay();
      tutorialState.plasmaRestockAt = 0;
      spcVO("one_of_our_most_useful_weapons_plasma_net", "One of our most useful weapons is the **Plasma Net**.");
      spcVO("to_fire_a_plasma_net_tap_and_drag", "To fire a **Plasma Net**, tap and drag a net across the screen.");
      spcVO("15-16", "When **Stroids** glow they're targeted. Release to fire.");
      // 2026-06-20: hold the objective text until the intro VO finishes (deferred-until-VO-idle,
      // same as the other steps) — the onUpdate hook below is gated on plasmaObjectiveMode, so we
      // only arm it after the lines drain instead of letting it flash up under the narration.
      await waitVOIdle();
      // 2026-06-22 (Item 1): clear the comm box once the intro VO drains — same as the laser step —
      // so the cadet has the full playfield. The demo overlay then floats above the objective banner.
      if (!stuntActive) return;
      commBoxController.hide();
      // Part 3 (2026-06-17): two-stage objective — set, then release. The phase's onUpdate hook
      // (below) keeps the text in sync with plasmaCage.active each frame, so it re-arms back to
      // "TAP AND DRAG" whenever a gesture resets (miss/cancel/fire) instead of sticking on RELEASE.
      tutorialState.plasmaObjectiveMode = "setfire";
      tutorialState.plasmaObjectiveShown = "";
      tutorialState.plasmaMisses = 0;
      // 2026-07-03: demo overlay already shown up top (with the title card); the onUpdate hook hides
      // it the instant a net drag begins (plasmaCage.active). Only for the first lesson round.
      await tutorialPlasmaSuccess(() => spawnTutorialAsteroids(2, 2));
      tutorialState.plasmaObjectiveMode = null;
      tutorialState.plasmaDemoShown = false;
      hidePlasmaDemoOverlay();
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
      spcVO("17b", "Nice! Great work, Cadet.", "praise");
      await clearTutorialField();
      await waitMs(350);
    },
    // Drive the objective text off plasmaCage.active each frame while a "setfire" round is live,
    // so it re-arms to "TAP AND DRAG" whenever the gesture resets (Part 3 fix, 2026-06-17).
    onUpdate: () => {
      // 2026-06-22 (Item 1): the moment the cadet starts drawing a net, retire the demo overlay.
      if (tutorialState.plasmaDemoShown && plasmaCage.active) {
        tutorialState.plasmaDemoShown = false;
        hidePlasmaDemoOverlay();
      }
      if ((tutorialState.plasmaDemoShown || tutorialState.plasmaObjectiveMode === "setfire") && sim.asteroids.length < 2) {
        const lastRestock = tutorialState.plasmaRestockAt || 0;
        if (now - lastRestock >= 900) {
          const need = Math.max(1, 2 - sim.asteroids.length);
          spawnTutorialAsteroids(need, 2);
          tutorialState.plasmaRestockAt = now;
        }
      }
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
      showLevelTitleBanner("UFOS", { training: true });
      spcVO("23", "UFO spotted, Cadet!", "alert");
      spcVO("24", "Shoot it twice to take it out!", "alert");
      showTaskInstructionDeferred("SHOOT THE UFO TWICE");
      waitFor(() => ufo && ufo.hitCount >= 1)
        .then(() => { if (stuntActive) spcVO("25", "Direct hit! Do it again!", "praise"); })
        .catch(() => {});
      await waitFor(() => !ufo);
      hideTaskInstruction();
      spcVO("26", "Wow, there you go.", "laugh");
      // 2026-06-23: visibly DEMONSTRATE the recharge as SPC says it — refill the cage and replay the
      // recharge sound + a teal flash so the cadet connects "UFO down → plasma ready". (No arrow: the
      // plasma net is a gesture weapon with no HUD meter, so there's no correct target to point at —
      // the teal flash is the cue.)
      spcVO("27", "Destroying a UFO instantly recharges your plasma.", undefined, () => {
        rechargePlasmaNow();
        playGameSfx(Math.random() < 0.5 ? "plasmarecharged" : "plasmarecharged1", 1.0);
        cssFlash("#00ffd1", 0.22, 300);
      });
      showLevelTitleBanner("NET UFO NET COMBO ATTACK", { training: true });
      spcVO("28-30", "So net the **Stroids** when a UFO shows up.");
      await clearTutorialField();
      spawnTutorialAsteroids(3, 2);
      // Net step first — UFO withheld until the net lands so the sequence is taught in order.
      spcVO("31", "Use your **Plasma Net** on those **Stroids**.", "talk_friendly");
      showTaskInstructionDeferred("TAP AND DRAG TO MAKE A PLASMA NET");
      hideCommsAfterVO(); // 2026-06-22 (Item 2): comms clear ~1s after the VO finishes
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
      showTaskInstructionDeferred("SHOOT THE UFO TWICE");
      await waitFor(() => !ufo);
      hideTaskInstruction();
      spawnTutorialAsteroids(4, 2);
      spcVO("33", "Plasma recharged — make another net!", "talk_friendly");
      // 2026-06-22 (Item 2): this follow-up net had no objective text — restore it, and clear the
      // comm box a beat after the VO so the cadet has the field (no demo overlay on this one).
      showTaskInstructionDeferred("TAP AND DRAG TO MAKE A PLASMA NET");
      hideCommsAfterVO();
      await tutorialPlasmaSuccess(() => spawnTutorialAsteroids(4, 2));
      hideTaskInstruction();
      spcVO("34", "Nice work, Cadet. You learn fast.", "praise");
      await clearTutorialField();
      await waitMs(350);
    } },
    { id: "toss", run: async () => {
      spawnTutorialAsteroids(3, 3);
      showLevelTitleBanner("THE STROID TOSS", { training: true });
      spcVO("35-36", "Next — the **Stroid Toss**. Tap and hold a **Stroid** to grab it.", "talk_calm");
      showTaskInstructionDeferred("TAP AND HOLD A STROID");
      // 2026-07-03: the instant the cadet GRABS a stroid, swap the banner to the swipe action and
      // fire a dedicated "now swipe to toss" VO — the grab step had no follow-up cue (mirrors the
      // bomb arm→detonate swap). Caption shows until vo/SPC_now_swipe_to_toss_the_stroid.mp3 is
      // recorded + its key added to SPC_VO_AVAILABLE (see PRE-RELEASE checklist).
      waitFor(() => stroidToss.active)
        .then(() => {
          if (!stuntActive) return;
          showTaskInstruction("NOW SWIPE TO TOSS THE STROID");
          spcVO("now_swipe_to_toss_the_stroid", "Now swipe to toss the **Stroid**!", "alert");
        })
        .catch(() => {});
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
      await waitVOIdle(); // 2026-06-22 (Item 4): let the prior praise finish before the bomb appears
      showLevelTitleBanner("BOMBS", { training: true });
      spawnTutorialLandmine(tutZonePoint("center"));
      spcVO("42-43", "When you see a bomb, tap it to arm it.", "talk_calm");
      spcVO("44-45", "The bomb explodes soon,", "talk_calm");
      spcVO("but_to_detonate_it_yourself_just_tap_it_again", "but to detonate it yourself, just tap it again.", "talk_calm");
      showTaskInstructionDeferred("TAP THE BOMB TO ARM IT");
      // 2026-07-02: once the cadet arms the bomb (tap → player_armed), swap the objective to the
      // detonate action so the banner tracks the mechanic instead of stalling on "ARM IT".
      waitFor(() => landmine && landmine.phase === "player_armed")
        .then(() => { if (stuntActive) showTaskInstruction("TAP THE BOMB TO DETONATE IT"); })
        .catch(() => {});
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
      await waitVOIdle(); // 2026-06-22 (Item 4): let the prior praise finish before the powerup appears
      spawnTutorialPowerup("bomb", tutZonePoint("center"));
      spcVO("50-51", "Sometimes a bomb powerup appears — tap it to add it to your HUD.", "talk_calm");
      showTaskInstructionDeferred("TAP THE BOMB TO PICK IT UP");
      await waitPowerupCollected("bomb");
      hideTaskInstruction();

      // 2026-06-20 (Item 5): the old all-at-once "52-54" line is replaced by 4 action-gated steps.
      // 2026-06-21: a tutorial-placed bomb must wait for the cadet to tap-arm it (no auto-arm /
      // auto-detonate) so Step 3 can't strand the player. Flag is cleared in cleanupTutorial().
      tutorialPlacedBombNoAutoArm = true;
      // Step 1 — tap the HUD bomb icon (enters bomb-aim mode). 2026-06-21: this step is about the
      // HUD icon, not arming — corrected text + dedicated SPC recording (vo/SPC_tap_the_bomb_icon_hud.mp3).
      spcVO("tap_the_bomb_icon_hud", "Tap the bomb icon on your HUD.", "talk_calm");
      showHudPointer("hudBombBtn", 0); // persist the arrow until the icon is tapped
      showTaskInstructionDeferred("TAP THE BOMB ICON ON YOUR HUD");
      await waitFor(() => bombAimMode);
      hideHudPointer();
      hideTaskInstruction();

      // Step 2 — place it on the field (the next tap drops the bomb).
      // 2026-06-22 (19:21 notes #4): the old "53" recording played the wrong line ("tap the bomb on
      // your HUD") here — the cadet has already tapped the HUD icon by this point. Use the dedicated
      // "now tap the screen where you want to place it" recording instead.
      spcVO("bomb_now_tap_the_screen_where_you_want_to_place_it", "Now tap the screen where you want to place it.", "talk_calm");
      showTaskInstructionDeferred("TAP TO PLACE THE BOMB");
      await waitFor(() => placedBombs.length > 0);
      hideTaskInstruction();

      // Step 3 — arm the placed bomb by tapping it. 2026-06-24: dedicated recording
      // (vo/SPC_Tap_the_bomb_to_arm_it.mp3) with tightened caption "Tap the bomb to arm it."
      // The bomb stays "spawned" (noAutoArm) until the cadet taps it, so this waitFor can't hang
      // on an auto-detonated bomb.
      spcVO("Tap_the_bomb_to_arm_it", "Tap the bomb to arm it.", "talk_calm");
      showTaskInstructionDeferred("TAP THE BOMB TO ARM IT");
      await waitFor(() => placedBombs.some((b) => b.phase === "player_armed"));
      hideTaskInstruction();

      // Step 4 — detonate it (tap the armed bomb again). "bomb" event fires on detonation.
      // 2026-06-24: dedicated recording (vo/SPC_tap_the_bomb_again_to_detonate_it.mp3).
      spcVO("tap_the_bomb_again_to_detonate_it", "Tap the bomb again to detonate it.", "talk_calm");
      showTaskInstructionDeferred("TAP THE BOMB AGAIN TO DETONATE");
      await waitEvent("bomb");
      hideTaskInstruction();
      await clearTutorialField();
      await waitMs(350);
    } },
    { id: "quadshot", run: async () => {
      await waitVOIdle(); // 2026-06-22 (Item 4): hold the powerup until the prior praise finishes
      showLevelTitleBanner("QUAD SHOT", { training: true });
      spawnTutorialPowerup("quadshot", tutZonePoint("center"));
      spcVO("thats_the_quad_shot_pick_it_up", "That's the **Quad Shot** power-up. Pick it up!", "talk_calm");
      showTaskInstructionDeferred("TAP THE QUAD SHOT TO PICK IT UP");
      await waitPowerupCollected("quadshot");
      hideTaskInstruction();
      // 2026-06-22: NO quad timer during training — keep it active for the whole lesson so an
      // idle cadet can't have it expire under them and get forced to finish with the plain laser.
      quadShotUntil = performance.now() + 600000;
      spawnTutorialAsteroids(3, 2);
      // 2026-06-22 (Item 6): the recorded "57" clip actually re-said "That's the quad shot" — use the
      // corrected, dedicated recording (vo/SPC_blast_those_stroids_with_the_quad_shot.mp3).
      spcVO("blast_those_stroids_with_the_quad_shot", "Blast those **Stroids** with the **Quad Shot**!", "smile_open");
      showTaskInstructionDeferred("BLAST THE STROIDS WITH THE QUAD SHOT");
      // Two satisfying volleys, then move on — bounded by rounds (not a timer) so it can't strand.
      let keepFiringSaid = false;
      for (let round = 0; round < 2; round += 1) {
        await waitFor(tutorialAsteroidsAllCleared);
        if (!stuntActive) return;
        if (round < 1) {
          spawnTutorialAsteroids(3, 2);
          if (!keepFiringSaid) { spcVO("58", "Keep firing, Cadet!", "smile_open"); keepFiringSaid = true; }
        }
      }
      quadShotUntil = 0; // lesson done — let the quad effect end before the field clears
      hideTaskInstruction();
      await clearTutorialField();
      await waitMs(350);
    } },
    { id: "freeze", run: async () => {
      await waitVOIdle(); // 2026-06-22 (Item 4): hold the powerup until the prior praise finishes
      showLevelTitleBanner("THE FREEZE POWERUP", { training: true });
      spawnTutorialPowerup("snowflake", tutZonePoint("center"));
      // 2026-06-20 (Item 9): split the combined 59-60 line so the "tap the freeze button" guidance
      // only plays AFTER the powerup is actually collected (was telling the cadet to activate it
      // before they'd even picked it up).
      spcVO("59", "Pick up the freeze powerup.", "idle_soft");
      showTaskInstructionDeferred("TAP THE FREEZE POWERUP TO PICK IT UP");
      await waitPowerupCollected("snowflake");
      hideTaskInstruction();
      spawnTutorialAsteroids(3, 2);
      // 2026-06-22 (Item 8): the recorded "60" clip played the wrong line — use the corrected,
      // dedicated recording (vo/SPC_tap_freeze_on_hud_to_activate_it.mp3).
      spcVO("tap_freeze_on_hud_to_activate_it", "Tap the freeze button on your HUD to activate it.", "idle_soft");
      showHudPointer("hudFreezeBtn", 6000);
      showTaskInstructionDeferred("TAP THE FREEZE ICON IN YOUR HUD TO ACTIVATE");
      await waitEvent("freeze");
      hideHudPointer();
      hideTaskInstruction();
      // 2026-07-02: pin the freeze bank from time-draining now, so it can't expire during this VO
      // + the field-clear + the transition into the freeze_toss step. The cadet keeps the freeze
      // they just activated all the way through the frozen toss (flag cleared once they toss, or in
      // cleanupTutorial). Manual toggle still works; the second powerup becomes optional, not forced.
      tutorialHoldFreeze = true;
      spcVO("61", "Objects are frozen for a short time.", "idle_soft");
      spcVO("freeze_toggle", "Freeze can be enabled and disabled by tapping the freeze icon on your HUD.", "idle_soft");
      await waitVOIdle();
      // 2026-07-03: right after the "enable/disable" line, DEMONSTRATE the toggle with a LOUD freeze
      // enable→disable sound + freeze-blue flash (was the field-clear's plasma-ish electric burst,
      // which read as the wrong cue). Sound/flash ONLY — the actual freeze stays HELD
      // (tutorialHoldFreeze) for the upcoming frozen toss.
      if (stuntActive) {
        playGameSfx("freeze", 1.0);
        cssFlash("#88ddff", 0.28, 320);
        await waitMs(700);
        if (stuntActive) { playGameSfx("unfreeze", 1.0); cssFlash("#88ddff", 0.22, 300); }
        await waitMs(300);
      }
      await clearTutorialField();
      await waitMs(350);
    } },
    { id: "freeze_toss", run: async () => {
      spawnTutorialAsteroids(3, 2);
      spcVO("62", "Frozen **Stroids** can be tossed too. Grab one and toss it.", "idle_soft");
      showTaskInstructionDeferred("GRAB AND TOSS A FROZEN STROID");
      // If freeze time carried over from the activation step (bank still has time, whether running
      // or paused) — skip straight to the toss loop. Only re-prompt with a fresh powerup when the
      // bank is fully empty.
      if (_freezeBankMs <= 0) {
        if (!stuntActive) return;
        spawnTutorialPowerup("snowflake", tutZonePoint("center"));
        spcVO("63b", "Freeze expired — grab another one and try the toss.", "idle_soft");
        await waitPowerupCollected("snowflake");
        showHudPointer("hudFreezeBtn", 6000);
        await waitEvent("freeze");
        hideHudPointer();
      }
      tutorialState.frozenTossBase = tutorialEvents.toss || 0;
      while ((tutorialEvents.toss || 0) <= tutorialState.frozenTossBase) {
        // 2026-07-01: field-empty watchdog — never leave the cadet staring at an empty field while
        // we're waiting for the frozen toss. A race where the last rock is shot AND the freeze bank
        // drains together used to strand the step (player had to tap freeze to make rocks reappear).
        // Restock here every iteration; new spawns are auto-frozen while _freezeActive (freeze is a
        // global movement-skip), so they're immediately tossable.
        if (tutorialAsteroidsAllCleared()) spawnTutorialAsteroids(3, 2);
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
          spcVO("63", "Good shooting — but try grabbing and tossing a frozen **Stroid**.", "idle_soft");
        } else {
          // freeze expired before the cadet tossed one — wait a beat, drop a fresh powerup
          await waitMs(1000);
          if (!stuntActive) return;
          spawnTutorialPowerup("snowflake", tutZonePoint("center"));
          if (tutorialAsteroidsAllCleared()) spawnTutorialAsteroids(3, 2);
          spcVO("63b", "Freeze expired — grab another one and try the toss.", "idle_soft");
          await waitPowerupCollected("snowflake");
          showHudPointer("hudFreezeBtn", 6000);
          await waitEvent("freeze"); // re-arm the freeze bank before re-checking for the toss
          hideHudPointer();
        }
      }
      // 2026-07-02: keep the freeze ACTIVE through the toss so the tossed rock stays frozen while
      // it flies. "toss" fires the instant the stroid is flicked — wait for it to fully resolve
      // (collide + detonate, or self-destruct) so the cadet sees the frozen destruction, THEN
      // release the hold and thaw the field. Previously we ended the freeze the instant the toss
      // fired, so the rock thawed mid-flight and the freeze never made it to the explosion.
      await waitFor(() => !sim.asteroids.some((a) => a.tossed));
      tutorialHoldFreeze = false;
      if (_freezeActive) endFreeze(false);
      await waitMs(300); // let the blast read before SPC chimes in
      spcVO("64", "Very cool, Cadet.", "praise");
      await clearTutorialField();
      await waitMs(350);
    } },
    { id: "missile", run: async () => {
      await waitVOIdle(); // 2026-06-22 (Item 4): hold the powerup until the prior praise finishes
      spawnTutorialPowerup("missile", tutZonePoint("center"));
      spawnTutorialAsteroids(4, 2);
      showLevelTitleBanner("MISSILES", { training: true });
      // 2026-06-22 (Item 9): singular — one missile pickup (vo/SPC_pick_up_the_missile_cadet.mp3).
      spcVO("pick_up_the_missile_cadet", "Pick up the missile, Cadet.", "talk_calm");
      showTaskInstructionDeferred("TAP THE MISSILE TO PICK IT UP");
      await waitPowerupCollected("missile");
      hideTaskInstruction();
      spcVO("66", "Tap the missile weapon in the HUD to arm a missile.", "alert");
      showHudPointer("hudMissileBtn", 6000);
      showTaskInstructionDeferred("TAP THE MISSILE ICON IN YOUR HUD");
      await waitFor(() => missileAimMode);
      hideHudPointer();
      spcVO("67", "Now tap to set a target and watch the destruction.", "alert");
      showTaskInstructionDeferred("TAP THE SCREEN TO SET YOUR TARGET");
      await waitFor(() => activeMissile);
      hideTaskInstruction();
      await waitFor(() => !activeMissile);
      // 2026-07-03: let the missile's staggered vaporize debris fully play before the field wipe.
      // The step used to clear the instant the missile exploded, which dropped the queued splits
      // (missileSplitQueue drained by clearGameplayEntities) so the caught stroids just vanished
      // instead of blasting into fiery debris. Wait for the queue to drain, then a short beat.
      await waitFor(() => missileSplitQueue.length === 0);
      await waitMs(400);
      // ── Pulse Cannon (final weapon) — 2026-07-01 ──────────────────────────────
      await clearTutorialField();            // clear leftover silver missile-step Stroids
      await waitMs(300);
      // Intro line — must fully finish before the powerup appears.
      spcVO("one_more_thing_i_want_to_show_you",
        "One more thing I want to show you before we're done today, Cadet.", "talk_calm");
      await waitVOIdle();
      if (!stuntActive) return;
      showLevelTitleBanner("THE PULSE CANNON", { training: true });
      // Spawn the Pulse Cannon pickup (bypasses level/unlock gating via the tutorial helper).
      spawnTutorialPowerup("pulse", tutZonePoint("center"));
      spcVO("the_pulse_cannon_is",
        "The Pulse Cannon is a rapid-fire powerup. Pick it up, Cadet.", "talk_calm");
      showTaskInstructionDeferred("TAP THE PULSE CANNON TO PICK IT UP");
      await waitPowerupCollected("pulse");   // collectPowerup auto-arms the 10s timer here
      hideTaskInstruction();
      // Pulse is now active: 10s timer running, Plasma Net auto-disabled. Guarantee that
      // a press always fires (not a stroid grab) for the "tap and drag" lesson.
      tutorialBlockPlasmaToss = true;
      spcVO("tap_and_drag_to_fire_the_pulse_cannon_light_em_up",
        "Tap and drag to fire the Pulse Cannon. Light 'em up, Cadet!", "alert");
      showTaskInstructionDeferred("TAP AND DRAG TO FIRE THE PULSE CANNON");
      // Green target field; keep it stocked for the whole duration. Free-fire, no kill
      // requirement. Loop ends when the cannon ends — natural expiry OR HUD-tap cancel
      // (both zero out pulseCannonActive()).
      spawnTutorialAsteroids(4, 2, { spriteKey: "roidneon" });
      while (pulseCannonActive() && stuntActive) {
        await waitMs(1000);
        if (!stuntActive) return;
        if (pulseCannonActive() && tutorialAsteroidsAllCleared()) {
          spawnTutorialAsteroids(4, 2, { spriteKey: "roidneon" });
        }
      }
      // Cannon ended: restore normal weapon behavior. Plasma Net already auto-restored
      // (pulseCannonActive() is false); just re-enable grab/toss and clear the green field.
      tutorialBlockPlasmaToss = false;
      hideTaskInstruction();
      await clearTutorialField();
      await waitMs(300);
      // ── falls straight into the existing conclusion below ──
      // 2026-07-02: bookend the tutorial with the level-title card so finishing Training reads as a
      // genuine accomplishment before the hand-off into Practice / the full game.
      showLevelTitleBanner("TRAINING COMPLETE", { training: true });
      spcVO("68", "Excellent work, Cadet.", "laugh");
      // 2026-06-22 (Item 10): SPC dons the "shades" closing pose (with its blink) the moment the
      // sign-off line begins, and holds it through the final "go practice" line below.
      spcVO("69", "This concludes our training for today.", "shades");
      // 2026-06-21 (Item 3): persist completion HERE, the moment training is functionally done —
      // not only inside endTutorial() after the outro hold. Previously the unlock key was written
      // only after the trailing hold, so bailing during that silent window left Practice locked.
      // endTutorial() still writes it too (idempotent).
      try { localStorage.setItem(STUNT_TRAINING_DONE_KEY, "1"); } catch {}
      await waitVOIdle();
      await waitMs(350);
      spcVO("70", "Go practice if you like — the Polyverse awaits.", "shades_outro");
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
      // The player just completed/triggered something — drop any still-QUEUED instructional VO,
      // but let the line that's currently PLAYING finish naturally. 2026-07-02: previously this
      // called spcFlush(), which paused the in-flight clip too — so completing an action mid-line
      // (e.g. flicking the frozen stroid while "62" was still talking) left the caption pinned on
      // screen with dead audio. Now the current line plays out to its end, then the next phase
      // beat (success/transition) comes up right after. Only queued extras are dropped.
      if (resolvedAction) _spcQueue = [];
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
    tutorialPlacedBombNoAutoArm = false;
    tutorialHoldFreeze = false;
    tutorialPaused = false;
    tutorialTimerRunning = false;
    hideSkipHint();
    hideLevelTitleBanner(); // 2026-07-02: drop any in-flight training step title on teardown
    hideTaskInstruction();
    hidePlasmaDemoOverlay(); // 2026-06-22 (Item 1): never leave the demo clip on screen post-teardown
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
    tutorialPlacedBombNoAutoArm = false;
    tutorialHoldFreeze = false;
    tutorialPaused = false;
    tutorialTimerRunning = false;
    hideSkipHint();
    hideTaskInstruction();
    hidePlasmaDemoOverlay(); // 2026-06-22 (Item 1): never leave the demo clip on screen post-teardown
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
  async function startStuntPractice({ fromTutorial = false, preserveSpcOutro = false } = {}) {
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
    slotTeardown(SLOT_REASON.NEW_GAME); // dispose any live slot before discarding its tokens
    slotTokens = 0; // 2026-06-26: discard banked POLYSLOTS tokens on a fresh run
    slotNukeOwned = 0; slotPendingQuadShot = 0; // reset per-game slot reward state
    quadShotUntil = 0;
    pulseCannonUntil = 0; stopPulseFiring(); onPulseEnd(true);
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
    updateHudPulseBadge();
    updateHudBombInventory();
    renderLives();
    renderScore();

    // ── cold start (Practice menu button, no tutorial behind us): stand up the same arcade
    //    environment the tutorial uses — tutorial backdrop + music, SPC portrait, running loop.
    //    When handed off from training, all of this is already live, so we leave it untouched
    //    (no music/theme change = seamless continuation). ──
    if (!fromTutorial) {
      // 2026-06-30: cold-start Practice (menu button, no tutorial behind us) gets the same
      // "WARMING UP" pass as the main game so first-run gameplay is smooth. When handed off from
      // training the assets are already warm, so the fromTutorial branch skips this. warmArcadeAssets
      // already unlocks audio + loads the gameplay SFX map.
      await warmArcadeAssets(1);
      hideArcadeOverlay();
      engineMode = "arcade";
      setMenuOverlayOpen(false);
      setGalaxyViewMode("arcade");
      setGalaxyTool("draw");
      galaxyView?.classList.remove("level-10", "level-3");
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
    nextPracticePulseAt = nowP + PRACTICE_PULSE_FIRST_MS; // guaranteed Pulse Cannon inside the first minute
    // Practice powerups: first drop at 5s, then a steady cadence (see the endless update block).
    nextBombPowerupAt = nowP + 5000;
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
    audioEngine.loadMany?.(gameplayPreloadSfxMap());
    hideArcadeOverlay();
    stopWarningState();
    engineMode = "practice";
    arcadeActive = false;
    arcadeResumeAvailable = false;
    retryPending = false;
    resetArcadeTimerVisuals();
    galaxyView?.classList.remove("level-10", "level-3");
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
    // The combo banner layer lives on a body-level canvas (above the HUD); wipe any lingering
    // banner so it can't float over the mode-select menu when we leave mid-combo.
    comboBanners.length = 0;
    if (comboBannerCtx) { comboBannerCtx.clearRect(0, 0, sim.width, sim.height); _comboBannerDirty = false; }
    retryPending = false;
    stopWarningState();
    commBoxController.setLevelEndLock(false); // 2026-06-21 (Item 1b): never carry the level-end VO lock into menus (e.g. the final-level win path bypasses startLevel)
    // 2026-07-03: _exclusiveSpeaker is only ever set by training/practice, both of which are being
    // left here — clear it unconditionally so no menu path can stay stuck muting CMDR/menu VO.
    // (portrait override is left to the mode-specific blocks below — L13/L14 pause-resume relies on it.)
    commBoxController.setExclusiveSpeaker(false);
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
      // 2026-06-22: pausing a live game into the menu must silence + hide the commander, mirroring
      // the training pause — otherwise CMDR VO keeps talking over the Select Mode menu. Physics is
      // already frozen here (engineMode flips to "menu" below, gating gameplay). Restored on resume
      // via startArcadeFromSave -> commBoxController.show().
      commBoxController.stopVO();
      commBoxController.hide();
    } else {
      commBoxController.hide();
      commBoxController.clearPortraitOverride(); // 2026-06-16: clean exit restores CMDR (SPC owns L13/14)
      clearGameplayEntities();
      arcadeActive = false;
      arcadeResumeAvailable = false;
      if (gamePageActive) playArcadeMenuMusic();
      else audioEngine.stopMusic();
      setGalaxyBackgroundDim(0);
      galaxyView?.classList.remove("level-10", "level-3");
    }
    engineMode = "menu";
    syncArcadeEntryLabel();
    setArcadeSubmenu(canPreserve && openArcadeMenu ? "arcade" : "root");
    syncArcadeMenuButtons();
    // 2026-06-22: menu music is already handled in the non-preserve branch above (play if on the
    // game page, else stop). A second playArcadeMenuMusic() here double-started the theme — the
    // first call took the HTML fallback while the buffer loaded, then this one restarted it from 0
    // via the WebAudio path (~1s in). Removed; the else branch is the single source of truth.
    setGalaxyViewMode("menu");
    // 2026-06-22: replay the STROIDS logo warp-in on a FRESH menu entry only — not when pausing a
    // live arcade game into the menu. The warp's per-frame raster pass (54 sliced draws + ghosts)
    // fought the still-running game loop on device, presenting as a brief freeze.
    if (!canPreserve) menuLogoWarp.play();
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

  // 2026-07-01: reveal Stroids hidden behind the comms HUD (commander/SPC mug + text box). The HUD is a
  // DOM overlay above the play canvas, so ducking its opacity lets the real rock underneath show through
  // — a zero-cost "ghost" (no extra draw pass / silhouette canvas). Gated to when the HUD is actually on
  // screen AND a rock overlaps its rect, and throttled to ~15Hz, so it costs essentially nothing.
  let _commHudEl = null;
  let _commTickerEl = null;
  let _stroidBehindHudNext = 0;
  let _stroidBehindHud = false;
  // True if any non-ambient stroid overlaps the given rect (rect already in sim/canvas space).
  function anyStroidInRect(hx0, hy0, hx1, hy1) {
    const list = sim.asteroids;
    for (let i = 0; i < list.length; i += 1) {
      const a = list[i];
      if (a.ambient) continue;
      const r = a.r || 0;
      if (a.x + r > hx0 && a.x - r < hx1 && a.y + r > hy0 && a.y - r < hy1) return true;
    }
    // 2026-07-03: powerups also duck the HUD — a pickup drifting under the mug/comms box or a
    // training overlay was hidden before; now it triggers the same see-through fade so it stays
    // visible and collectable.
    for (let i = 0; i < powerups.length; i += 1) {
      const p = powerups[i];
      const r = p.r || 0;
      if (p.x + r > hx0 && p.x - r < hx1 && p.y + r > hy0 && p.y - r < hy1) return true;
    }
    return false;
  }
  function updateStroidBehindHud(now) {
    if (now < _stroidBehindHudNext) return;
    _stroidBehindHudNext = now + 66; // ~15Hz
    if (!_commHudEl) _commHudEl = document.getElementById("commanderHUD");
    const hud = _commHudEl;
    if (!hud) return;
    if (!_commTickerEl) _commTickerEl = document.getElementById("commanderTicker");
    const commRect = hud.getBoundingClientRect();
    const canvasRect = galaxyPlayCanvas?.getBoundingClientRect();
    // display:none / collapsed / off-canvas → treat as not obstructing (getBoundingClientRect is ~0).
    const visible = canvasRect && commRect.width > 20 && commRect.height > 20
      && commRect.bottom > canvasRect.top && commRect.top < canvasRect.bottom
      && !hud.classList.contains("comm-collapsed");
    let behind = false;
    if (visible) {
      // Portrait/mug rect in sim/canvas space (sim coords == canvas CSS px; see awardCombo).
      // getBoundingClientRect on #commanderHUD only spans the in-flow portrait — the ticker text
      // box is position:absolute, so it's tested separately below.
      const hx0 = commRect.left - canvasRect.left, hy0 = commRect.top - canvasRect.top;
      const hx1 = commRect.right - canvasRect.left, hy1 = commRect.bottom - canvasRect.top;
      behind = anyStroidInRect(hx0, hy0, hx1, hy1);
      // Also ghost when a stroid hides behind the comms TEXT BOX, even if nothing's under the mug.
      if (!behind && _commTickerEl) {
        const op = parseFloat(getComputedStyle(_commTickerEl).opacity || "0");
        const tRect = _commTickerEl.getBoundingClientRect();
        if (op > 0.05 && tRect.width > 20 && tRect.height > 20
          && tRect.bottom > canvasRect.top && tRect.top < canvasRect.bottom) {
          behind = anyStroidInRect(
            tRect.left - canvasRect.left, tRect.top - canvasRect.top,
            tRect.right - canvasRect.left, tRect.bottom - canvasRect.top);
        }
      }
    }
    if (behind !== _stroidBehindHud) {
      _stroidBehindHud = behind;
      hud.classList.toggle("comm-see-through", behind);
    }
    // 2026-07-02: extend the same "ghost behind Stroids" treatment to the training objective banner
    // and the plasma-net demo video, so every HUD-layer overlay ducks consistently. Each is its own
    // fixed element with its own opacity, so we toggle a .stroid-ghost class (see CSS). Only live
    // during Training (both elements are null/hidden otherwise → no-op).
    if (canvasRect) {
      _updateElBehindStroid(_taskInstrEl, canvasRect);
      _updateElBehindStroid(_demoOverlayEl, canvasRect);
      // 2026-07-03: extend the see-through to the TOP arcade-HUD content — the score/level/timer
      // block and the weapon-button group — so a Stroid drifting behind them fades them too. The
      // pulse-step green Stroids passed under the top HUD, which had NO ghost effect. Targets the
      // content sub-regions (not the full-width bar) so empty gaps don't trigger it; rect-based so a
      // hidden HUD (rect ~0) just clears the class.
      if (!_hudCenterEl) _hudCenterEl = document.querySelector("#arcadeHud .hudCenter");
      if (!_hudInvEl) _hudInvEl = document.querySelector("#arcadeHud .hudInventoryGroup");
      _ghostHudRegion(_hudCenterEl, canvasRect);
      _ghostHudRegion(_hudInvEl, canvasRect);
    }
  }
  let _hudCenterEl = null;
  let _hudInvEl = null;
  // Rect-based ghost toggle (doesn't assume an inline display style, unlike _updateElBehindStroid).
  function _ghostHudRegion(el, canvasRect) {
    if (!el) return;
    const r = el.getBoundingClientRect();
    let behind = false;
    if (r.width > 12 && r.height > 12 && r.bottom > canvasRect.top && r.top < canvasRect.bottom) {
      behind = anyStroidInRect(
        r.left - canvasRect.left, r.top - canvasRect.top,
        r.right - canvasRect.left, r.bottom - canvasRect.top);
    }
    el.classList.toggle("stroid-ghost", behind);
  }
  // Toggle .stroid-ghost on a fixed overlay element when a non-ambient Stroid overlaps its rect.
  function _updateElBehindStroid(el, canvasRect) {
    if (!el || el.style.display === "none" || !el.style.display) {
      if (el && el.classList.contains("stroid-ghost")) el.classList.remove("stroid-ghost");
      return;
    }
    const r = el.getBoundingClientRect();
    let behind = false;
    if (r.width > 20 && r.height > 20 && r.bottom > canvasRect.top && r.top < canvasRect.bottom) {
      behind = anyStroidInRect(
        r.left - canvasRect.left, r.top - canvasRect.top,
        r.right - canvasRect.left, r.bottom - canvasRect.top);
    }
    el.classList.toggle("stroid-ghost", behind);
  }

  function update(dt, now) {
    const _frameBudgetExceeded = isIOSNative && dt > 32;
    sim._frameBudgetExceeded = _frameBudgetExceeded;
    updateStroidBehindHud(now);
    updatePlasmaRechargeSound(now);
    updatePlasmaPlacedNet(now);
    if (stuntActive || practiceEndless) updatePlasmaModeBtn(now);
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
    if (engineMode === "arcade" && arcadeActive) updateHudPulseBadge();
    // Pulse Cannon rapid-fire pump: fire a swept shot whenever the cadence timer is due while the
    // input is held. Two quick shots (PULSE_PAIR_DELAY_MS) then a longer pause (PULSE_BURST_DELAY_MS).
    if (pulseFiring && !pulseCannonActive()) stopPulseFiring(); // expired mid-hold → drop the muzzle
    if (pulseFiring && galaxyGesture) {
      // Keep the muzzle jet glued to the ship front along the current aim (tracks even between shots).
      const cx = sim.width / 2;
      const cy = sim.height / 2;
      const aim = galaxyGesture.current || galaxyGesture.start;
      const ang = Math.atan2(aim.y - cy, aim.x - cx);
      pulseMuzzle.active = true;
      pulseMuzzle.angle = ang;
      pulseMuzzle.x = cx + Math.cos(ang) * (46 - pulseMuzzle.recoil);
      pulseMuzzle.y = cy + Math.sin(ang) * (46 - pulseMuzzle.recoil);
      // catch-up guard: after a stall/background jump, don't machine-gun a backlog of shots
      if (now > nextPulseShotAt + 400) nextPulseShotAt = now;
      while (now >= nextPulseShotAt) {
        firePulseShot(now);
        pulseBurstIndex ^= 1;
        nextPulseShotAt += pulseBurstIndex ? PULSE_PAIR_DELAY_MS : PULSE_BURST_DELAY_MS;
      }
    }
    // Muzzle FX loop phase advances while visible; recoil eases back to 0 each frame.
    if (pulseMuzzle.active) {
      pulseMuzzle.phase += dt * 0.03;
      if (pulseMuzzle.recoil > 0) pulseMuzzle.recoil = Math.max(0, pulseMuzzle.recoil - dt * 0.03);
    }

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
        // Theme cycle — setTheme(_, true) now actually crossfades (subtle dissolve, ~2.4s).
        if (now >= nextThemeCycleAt) {
          practiceThemeIndex = (practiceThemeIndex % 15) + 1;
          window.galaxyBackground?.setTheme(practiceThemeIndex, true);
          nextThemeCycleAt = now + PRACTICE_THEME_INTERVAL_MS;
        }
      }
      // 2026-06-21/2026-06-23: a RUNNING freeze drains the bank and SLOWS the level clock (it no
      // longer fully stops). Each frozen frame we push the time anchors forward by hold = dt*(1-rate),
      // so the clock advances at `rate` of real time: FREEZE_TIMER_SLOW (0.25x) for most of the bank,
      // then ramps to 1.0x over the final FREEZE_TIMER_RAMP_MS so it eases back to normal as the
      // freeze runs out. dt is clamped to 33ms upstream, so a huge dt on foreground return can't nuke
      // the bank in one frame. When the bank hits 0, auto-end silently. A PAUSE leaves _freezeActive
      // = false with bank intact — the clock simply resumes ticking at full speed (no special case).
      if (_freezeActive && !tutorialHoldFreeze) {
        _freezeBankMs -= dt;
        if (_freezeBankMs <= 0) {
          endFreeze(false); // bank drained — silent unfreeze (drops music filter + HUD glow)
        } else {
          let rate = FREEZE_TIMER_SLOW;
          if (_freezeBankMs < FREEZE_TIMER_RAMP_MS) {
            const t = 1 - _freezeBankMs / FREEZE_TIMER_RAMP_MS; // 0 → 1 across the final ramp window
            rate = FREEZE_TIMER_SLOW + (1 - FREEZE_TIMER_SLOW) * t;
          }
          const hold = dt * (1 - rate); // dt → fully paused, 0 → full speed
          levelEndsAt += hold;
          levelRunStartAt += hold;
          if (Number.isFinite(nextSpawnAt)) nextSpawnAt += hold;
          if (nextMineRespawnAt) nextMineRespawnAt += hold; // 2026-06-16: hold mine drip during freeze
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
          if (nonAmbientAsteroidCount() < maxOnScreen) {
            const p = randomPerimeterPoint();
            spawnAsteroid(
              p.x,
              p.y,
              pickAsteroidKind(cfg),
              true,
              practiceEndless ? pickPracticeAsteroidSpriteKey(now) : pickArcadeSpriteOverride(cfg, now),
            );
            spawnQueue -= 1;
            spawnedTotal += 1;
            nextSpawnAt += cfg.spawnEveryMs;
          } else {
            nextSpawnAt = now + 180;
          }
        }

        // Keep gameplay visually alive between stagger waves.
        if (cfg.spawnEveryMs > 0 && spawnQueue > 0 && nonAmbientAsteroidCount() === 0) {
          const p = randomPerimeterPoint();
          spawnAsteroid(
            p.x,
            p.y,
            pickAsteroidKind(cfg),
            true,
            practiceEndless ? pickPracticeAsteroidSpriteKey(now) : pickArcadeSpriteOverride(cfg, now),
          );
          spawnQueue -= 1;
          spawnedTotal += 1;
          nextSpawnAt = Math.max(nextSpawnAt, now + Math.max(350, cfg.spawnEveryMs));
        }

        // 2026-06-23: L4 ambient debris field — small debris sprite trickles in throughout
        // as bonus targets/hazards. Flagged .ambient so it doesn't count toward the clear quota
        // (nonAmbientAsteroidCount) and isn't tinted by the level color. Capped low so it never
        // crowds the real-asteroid spawn budget.
        if (cfg.debrisField && now >= nextDebrisAt) {
          const df = cfg.debrisField;
          let ambientLive = 0;
          for (let di = 0; di < sim.asteroids.length; di += 1) {
            if (sim.asteroids[di].ambient) ambientLive += 1;
          }
          if (ambientLive < (df.maxDebris || 4)) {
            const dp = randomPerimeterPoint();
            const debris = spawnAsteroid(dp.x, dp.y, 1, true, "debris");
            if (debris) {
              debris.ambient = true;
              debris.r = 10 + Math.random() * 3;
              debris.mass = debris.r * debris.r;
            }
          }
          nextDebrisAt = now + (df.intervalMs || 1500);
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

        // 2026-06-23: cfg.waves = [{count, triggerAtRemaining}] — second-wave surge. When the clock
        // drops to triggerAtRemaining seconds, burst `count` extra asteroids from the rim that the
        // player must also clear. Both spawnedTotal and totalToSpawn are bumped so the level-complete
        // gate (spawnedTotal >= totalToSpawn && nonAmbient === 0) stays consistent — the surge is
        // gated purely on clearing the new rocks. Each entry fires once; re-armed per level.
        if (Array.isArray(cfg.waves)) {
          for (let wi = 0; wi < cfg.waves.length; wi += 1) {
            const wv = cfg.waves[wi];
            const triggerMs = (wv?.triggerAtRemaining || 0) * 1000;
            if (!firedWaves.has(wi) && levelRemainingMs <= triggerMs && levelRemainingMs > 0) {
              firedWaves.add(wi);
              const wvCount = Math.max(1, wv.count || 1);
              for (let wk = 0; wk < wvCount; wk += 1) {
                const wp = randomPerimeterPoint();
                spawnAsteroid(wp.x, wp.y, pickAsteroidKind(cfg), true);
                spawnedTotal += 1;
                totalToSpawn += 1;
              }
              playGameSfx("ufo_spawn", 0.85);
            }
          }
        }

        // 2026-06-24: per-level music swell — cfg.musicRamp = { atMs, toMult, rampMs }. Once the clock
        // passes atMs, ramp the music to baseVolume * toMult over rampMs. Fires once per level (L9
        // noticeable swell ~25s in; L10 gradual rise across the level).
        if (!_musicRampFired && cfg.musicRamp && elapsedMs >= (cfg.musicRamp.atMs || 0)) {
          _musicRampFired = true;
          audioEngine.rampMusicVolume(cfg.musicRamp.toMult || 1, cfg.musicRamp.rampMs || 3000);
        }

        if (!_timerWarnedAt60 && levelRemainingMs <= 20000
            && levelRemainingMs > 0 && engineMode === "arcade") {
          _timerWarnedAt60 = true;
          commBoxController.setDamageState("light");
          // SPC levels: low-time nudge — alternates "running out of time" / "put some effort into it"
          // (2026-06-24) — in place of CMDR's low-time line.
          if (!queueSpcBonusVO(
              commBoxController.pickFromPool("spcTimerLow", commBoxController.POOL_SPC_TIMER_LOW),
              { priority: "high" })) {
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
        // 2026-07-02: don't drop bomb powerups while the inventory is already full (3) — wait until
        // the player spends one down to 2 or fewer. Applies in both arcade and practice.
        // 2026-07-03: same rule generalized to every capped type — freeze/snowflake at max no longer
        // spawns a powerup the player picks up for zero gain (the pickup was silently wasted).
        const bombFull = playerBombInventory >= MAX_BOMB_INVENTORY;
        const freezeFull = playerFreezeInventory >= MAX_FREEZE_INVENTORY;
        if (powerups.length < POWERUP_MAX_ONSCREEN && cfg.level >= 1 && now >= nextBombPowerupAt) {
          const puType = practiceEndless ? pick(PRACTICE_POWERUP_POOL) : pickPowerupForLevel(cfg);
          const puAtMax = (puType === "missile" && missileBusy)
            || (puType === "bomb" && bombFull)
            || ((puType === "snowflake" || puType === "freeze") && freezeFull);
          if (puAtMax) {
            // skip: this type's inventory is already full / busy — retry soon with a fresh roll.
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

        // 2026-07-01: Pulse Cannon availability. One guaranteed drop early on EVERY level; a subset
        // of levels (SECOND_PULSE_LEVELS) get a second drop later in the level (~58% elapsed) for a
        // fresh burst window rather than two back-to-back at the start.
        // 2026-07-03: Practice is endless, so the once-per-level force-spawn isn't enough — it gets a
        // guaranteed early Pulse (~12s) plus a re-offer cadence so the weapon stays available.
        if (practiceEndless) {
          if (now >= nextPracticePulseAt && !powerups.some((p) => p.type === "pulse")) {
            spawnPowerupAt("pulse", randomPowerupPoint());
            playGameSfx("bling", 0.8);
            nextPracticePulseAt = now + PRACTICE_PULSE_INTERVAL_MS;
          }
        } else {
          const pulseMaxThisLevel = SECOND_PULSE_LEVELS.has(cfg.level) ? 2 : 1;
          // 2026-07-02: first Pulse Cannon drop is offset to ~28% into the level so it no longer lands
          // on the same frame as the level-start missile force-spawn (both used to fire at
          // LEVEL_START_SPAWN_DELAY_MS). Second drop (SECOND_PULSE_LEVELS) stays at ~58%.
          const pulseNextAtMs = pulseForceSpawnedThisLevel === 0
            ? Math.max(LEVEL_START_SPAWN_DELAY_MS + 8000, levelDurationMs * 0.28)
            : levelDurationMs * 0.58;
          if (pulseForceSpawnedThisLevel < pulseMaxThisLevel && elapsedMs >= pulseNextAtMs
              && !powerups.some((p) => p.type === "pulse")) {
            pulseForceSpawnedThisLevel += 1;
            spawnPowerupAt("pulse", randomPowerupPoint());
            playGameSfx("bling", 0.8);
          }
        }

        // DEBUG: revert before release — force one missile powerup at the start of each level
        // so the homing missile is easy to test (mirrors the goldbars force-spawn below).
        if (!missileForceSpawnedThisLevel && elapsedMs >= LEVEL_START_SPAWN_DELAY_MS
            && missileUnlocked(cfg.level) && !missileBusy
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
          if (now - powerups[pi].spawnedAt > (powerups[pi].lifeMs ?? BOMB_POWERUP_LIFETIME_MS)) powerups.splice(pi, 1);
        }
        updateHudMissileInventory();
      }

      if (!ufo && arcadeUfoSpawnAt && now >= arcadeUfoSpawnAt && now >= arcadePausedUntil) {
        spawnUfo();
        arcadeUfoSpawnAt = 0;
      }

      if (!practiceEndless && spawnQueue === 0 && spawnedTotal >= totalToSpawn && nonAmbientAsteroidCount() === 0) {
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
                if (!comboBombBlastAwarded.has(sh.blastId)) {
                  comboBombBlastAwarded.add(sh.blastId);
                  recordComboEvent("bomb_destroyed_stroids", { x: a.x, y: a.y });
                }
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
    for (let i = sim.shockwaves.length - 1; i >= 0; i -= 1) {
      const s = sim.shockwaves[i];
      s.life += dt;
      if (s.life >= s.ttl) {
        sim.shockwaves[i] = sim.shockwaves[sim.shockwaves.length - 1];
        sim.shockwaves.pop();
        releaseRing(s);
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
  // 2026-07-01: `hit` distinguishes a Pulse Cannon shot that struck a target from one swept into
  // empty space. A pulse HIT renders the full beefy X + bloom (impactful); a pulse MISS renders only
  // a small crisp spark — the big expanding "ghost X" and radial flash are suppressed so sweeping
  // the rapid-fire stream across empty space no longer sprays oversized stray X's on screen.
  function drawTapBlast(tctx, x, y, life, pulse = false, hit = false) {
    const beef = pulse && hit;        // full beefy blast only on a real pulse hit
    const pulseMiss = pulse && !hit;  // toned-down: skip the ghost-X + flash bloom
    const wMul = beef ? 1.6 : 1;
    // Layer 0 — "radiation" ring: a soft, low-opacity teal circle that expands well past the
    // fingertip so the player can always see WHERE they tapped, even with a thumb over the spot.
    // 2026-07-02 (playtest). Skipped on a pulse miss to keep empty-space sweeps clean.
    if (!pulseMiss) {
      const radR = 30 + (1 - life) * 40; // 30 → 70px, larger than a thumb contact patch
      const rg = tctx.createRadialGradient(x, y, radR * 0.55, x, y, radR);
      rg.addColorStop(0, "rgba(0,255,204,0)");
      rg.addColorStop(0.8, `rgba(0,255,204,${(life * 0.10).toFixed(3)})`);
      rg.addColorStop(1, "rgba(0,255,204,0)");
      tctx.save();
      tctx.fillStyle = rg;
      tctx.beginPath();
      tctx.arc(x, y, radR, 0, Math.PI * 2);
      tctx.fill();
      tctx.globalAlpha = life * 0.18;
      tctx.strokeStyle = "#00ffcc";
      tctx.lineWidth = 2;
      tctx.beginPath();
      tctx.arc(x, y, radR, 0, Math.PI * 2);
      tctx.stroke();
      tctx.restore();
    }
    // Layer 1 — radial flash (only while bright; suppressed on a pulse miss)
    if (life > 0.6 && !pulseMiss) {
      const flashAlpha = (life - 0.6) / 0.4;
      const flashR = ((1 - life) * 40 + 6) * (beef ? 1.4 : 1);
      const grad = tctx.createRadialGradient(x, y, 0, x, y, flashR);
      grad.addColorStop(0, `rgba(180,255,240,${(flashAlpha * (beef ? 1 : 0.9)).toFixed(3)})`);
      grad.addColorStop(0.5, `rgba(0,255,200,${(flashAlpha * (beef ? 0.55 : 0.4)).toFixed(3)})`);
      grad.addColorStop(1, "rgba(0,200,160,0)");
      tctx.save();
      tctx.fillStyle = grad;
      tctx.beginPath();
      tctx.arc(x, y, flashR, 0, Math.PI * 2);
      tctx.fill();
      tctx.restore();
    }

    // Layer 2 — ghost X (outer, expands, low opacity; suppressed on a pulse miss)
    // 2026-07-02: ~2x bigger — the old X was smaller than a thumb, so it hid under the touch (playtest).
    if (!pulseMiss) {
      const ghostSize = (18 + (1 - life) * 26) * (beef ? 1.2 : 1);
      tctx.save();
      tctx.globalAlpha = life * 0.18;
      tctx.strokeStyle = "#00ffcc";
      tctx.lineWidth = 6 * wMul;
      tctx.beginPath();
      tctx.moveTo(x - ghostSize, y - ghostSize);
      tctx.lineTo(x + ghostSize, y + ghostSize);
      tctx.moveTo(x + ghostSize, y - ghostSize);
      tctx.lineTo(x - ghostSize, y + ghostSize);
      tctx.stroke();
      tctx.restore();
    }

    // Layer 3 — main X (crisp teal). A pulse miss stays compact (no beef); a pulse hit is enlarged.
    // 2026-07-02: ~2x bigger so the crosshair reads even under the firing thumb (playtest).
    const size = (15 + (1 - life) * 10) * (beef ? 1.15 : pulseMiss ? 0.7 : 1);
    tctx.save();
    tctx.globalAlpha = life * 0.95;
    tctx.strokeStyle = pulse ? "#66ffe6" : "#00ffcc";
    tctx.lineWidth = 2.5 * wMul;
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
      drawTapBlast(tctx, b.x, b.y, b.life, b.pulse, b.hit);
      b.life -= 0.055;
      if (b.life <= 0) tapBlasts.splice(i, 1);
    }
  }

  // 2026-07-02: The old ship-front muzzle jet is retired. It was drawn 46px out along the aim, so it
  // orbited the ship as you aimed/swept — reading as a glitchy "phantom circle + rotating laser line".
  // The Pulse Cannon fire signature is now the teal electric ring stamped at each shot point
  // (spawnPulseFireBurst / pulseFireBursts). This stub keeps the call sites harmless.
  function drawPulseMuzzle() { /* muzzle FX removed — see pulseFireBursts */ }

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
      // 2026-06-26: the bomb art has spark/glow padding on its edges, so its bomb body reads
      // smaller than the other powerups — draw it 20% larger to compensate (visual only).
      const drawSize = pu.type === "bomb" ? POWERUP_SPRITE_SIZE * 1.2 : POWERUP_SPRITE_SIZE;
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
      if (sprite && sprite.complete && sprite.naturalWidth > 0) {
        // 2026-06-14: the missile gets an explicit gold glow ring (#ffd700) behind its sprite.
        if (pu.type === "missile") {
          tctx.beginPath();
          tctx.arc(0, 0, drawSize / 2 - 2, 0, Math.PI * 2);
          tctx.strokeStyle = blinkRed ? "#ff3333" : "#ffd700";
          tctx.lineWidth = 2.5;
          tctx.shadowColor = blinkRed ? "#ff3333" : "#ffd700";
          tctx.shadowBlur = 14;
          tctx.stroke();
          tctx.shadowBlur = 0;
        }
        tctx.drawImage(
          sprite,
          -drawSize / 2,
          -drawSize / 2,
          drawSize,
          drawSize,
        );
        if (blinkRed) {
          // red warning tint over the sprite — normal compositing; multiply would also
          // darken whatever the overlay already drew underneath the circle
          tctx.fillStyle = "rgba(255,51,51,0.38)";
          tctx.beginPath();
          tctx.arc(0, 0, drawSize / 2, 0, Math.PI * 2);
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
      drawPulseMuzzle(ufoFxCtx || ctx);
      // KEEP LAST: the missile crosshair (drawMissileFx) must render AFTER drawPowerups on the same
      // overlay so it's never hidden behind a powerup sprite (Part 5, 2026-06-17).
      drawMissileFx(ufoFxCtx || ctx, now);
      drawComboFxOverlay(ufoFxCtx || ctx, now);
      drawComboBannersLayer(now);
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
        // 2026-06-23: ambient L4 debris keeps its natural silver — skip the level color multiply.
        const _tint = a.ambient ? null : getAsteroidTintForLevel(_levelNum);
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
      // 2026-07-01: Pulse Cannon shard highlight — a fading teal crescent on the side of a freshly
      // split child that faced the bolt, so a Pulse Cannon kill reads as "sheared into glowing shards".
      // TTL-gated + skipped under frame-budget pressure so dense L15 splits can't tank FPS.
      if (a._pulseHitAt && !_frameBudgetExceeded) {
        const age = now - a._pulseHitAt;
        if (age >= 0 && age < PULSE_HIT_GLOW_MS) {
          const k = 1 - age / PULSE_HIT_GLOW_MS; // 1 → 0 fade
          const edgeAng = Math.atan2(a._pulseHitDirY, a._pulseHitDirX); // toward the hit-facing rim
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.globalAlpha = k * 0.85;
          ctx.lineCap = "round";
          // bright teal arc hugging the hit-facing rim (~110° wedge), thicker + brighter early
          ctx.strokeStyle = "rgba(120,255,235,1)";
          ctx.lineWidth = 3 + k * 2;
          ctx.beginPath();
          ctx.arc(a.x, a.y, a.r * 0.92, edgeAng - 0.95, edgeAng + 0.95);
          ctx.stroke();
          // soft outer bloom on the same wedge
          ctx.globalAlpha = k * 0.4;
          ctx.strokeStyle = "rgba(0,255,209,1)";
          ctx.lineWidth = 6 + k * 4;
          ctx.beginPath();
          ctx.arc(a.x, a.y, a.r * 1.02, edgeAng - 0.8, edgeAng + 0.8);
          ctx.stroke();
          ctx.restore();
        } else if (age >= PULSE_HIT_GLOW_MS) {
          a._pulseHitAt = 0; // expired — stop testing this rock
        }
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
      // 2026-06-25: quad-shot shockwave bloom — additive expanding ring, thick at birth and
      // thinning out, with a trailing echo (the "compression" double-edge) and, off the native
      // path, a chromatic R/B split that reads as heat distortion. All on the 2D overlay.
      if (sim.shockwaves.length) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        for (let i = 0; i < sim.shockwaves.length; i += 1) {
          const s = sim.shockwaves[i];
          const t = s.life / s.ttl;
          const ease = 1 - (1 - t) * (1 - t); // ease-out so it punches out fast, settles slow
          const radius = s.baseR + (s.maxR - s.baseR) * ease;
          const fade = s.alpha * (1 - t);
          if (fade <= 0.01) continue;
          const lw = (1 - t) * 3.0 + 0.6; // wide at birth, thins as it expands
          ctx.lineWidth = lw;
          ctx.strokeStyle = `rgba(255,236,202,${fade.toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(s.x, s.y, radius, 0, Math.PI * 2);
          ctx.stroke();
          if (!isIOSNative) {
            const split = 1.4 + t * 2.6; // edges separate more as the wave grows
            ctx.lineWidth = Math.max(0.5, lw * 0.6);
            ctx.strokeStyle = `rgba(255,80,80,${(fade * 0.5).toFixed(3)})`;
            ctx.beginPath();
            ctx.arc(s.x, s.y, radius + split, 0, Math.PI * 2);
            ctx.stroke();
            ctx.strokeStyle = `rgba(90,150,255,${(fade * 0.5).toFixed(3)})`;
            ctx.beginPath();
            ctx.arc(s.x, s.y, Math.max(0, radius - split), 0, Math.PI * 2);
            ctx.stroke();
          }
          const trail = radius - lw * 2.2; // faint inner echo ring
          if (trail > 0) {
            ctx.lineWidth = Math.max(0.5, lw * 0.5);
            ctx.strokeStyle = `rgba(200,230,255,${(fade * 0.34).toFixed(3)})`;
            ctx.beginPath();
            ctx.arc(s.x, s.y, trail, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
        ctx.restore();
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
    drawPulseMuzzle(ufoFxCtx || ctx);
    // KEEP LAST (over powerups): crosshair must sit above powerup sprites (Part 5, 2026-06-17).
    drawMissileFx(ufoFxCtx || ctx, now);
    drawComboFxOverlay(ufoFxCtx || ctx, now);
    drawComboBannersLayer(now);

    if (_frameBudgetExceeded && isIOSNative && sim.particles.length > 22) {
      const dropCount = sim.particles.length - 22;
      const dropped = sim.particles.splice(0, dropCount);
      for (let i = 0; i < dropped.length; i += 1) releaseParticle(dropped[i]);
    }
    const particleLimit = _frameBudgetExceeded ? Math.min(22, sim.particles.length) : sim.particles.length;
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
    fdSampleFrame(rawDt, now);
    fkSampleFrame(rawDt, now);
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
    // 2026-06-30: under quadshot, defer marksman accounting on every projectile and record one
    // combined hit/miss for the whole volley below — so a quad tap counts as a single marksman hit.
    if (quadActive) { _quadHitAsteroid = false; _quadHitUfo = false; }
    const hitSomething = resolveShotAt(x, y, now, isTouch, quadActive);
    if (quadActive) addShockwave(x, y); // localized heat-shimmer bloom on the primary quad blast
    // Tutorial chatter is skipped by tapping the subtle "TAP TO SKIP" hint above the comm box
    // (the hint text is its own tap target) — the old double-tap-empty-space detection is gone.
    // 2026-06-10: quadshot — 3 extra shots clustered around the tap point while active.
    // Stagger them across frames so the first quad tap stays responsive; each extra shot seeks
    // the nearest live asteroid within QUADSHOT_SEEK_RADIUS and fires at its center through
    // the same hit pipeline. Pure random 30-80px offsets almost never landed inside an
    // asteroid's collision radius (r 10-38 + 10 slop), so the cluster visuals overlapped
    // asteroids without ever destroying them.
    let extraHit = false;
    if (quadActive) {
      let extraIndex = 0;
      const fireNextQuadShot = () => {
        if (extraIndex >= 3) {
          // the whole quad volley (primary + cluster) registers as a single marksman event: a hit if
          // any projectile killed a rock, otherwise a miss (which still breaks the combo, as before).
          // 2026-07-03: but if this volley struck the UFO, skip the marksman event entirely — the UFO hit
          // is already recorded (ufo_shot) and this event's breakNetUfoNetCombo would kill the in-progress
          // net-UFO-net combo, making it impossible to land with quad shot active.
          if (!_quadHitUfo) {
            recordComboEvent(_quadHitAsteroid ? "laser_stroid_hit" : "laser_miss", { x, y });
          }
          if (hitSomething || extraHit) draw(performance.now());
          return;
        }
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
        _sfxBudgetExempt = true;
        try {
          // 2026-06-14: each cluster shot fires its own report so quadshot sounds like a burst
          // (was silent past the first tap). Budget-exempt above so they layer instead of dropping.
          // 2026-06-22: trimmed 0.6 → 0.42 — layered bursts were a touch too loud.
          // 2026-06-24: per-shot detune jitter so the 4 identical advfire buffers per quad tap don't
          // phase-lock into a low resonant comb-filter boom under sustained fire (de-correlates them).
          playGameSfx("advfire", 0.42, { important: true, detune: (Math.random() - 0.5) * 160 });
          addShockwave(ex, ey); // each cluster blast gets its own localized shimmer ring
          if (resolveShotAt(ex, ey, performance.now(), isTouch, true)) extraHit = true;
        } finally {
          _sfxBudgetExempt = false;
        }
        extraIndex += 1;
        requestAnimationFrame(fireNextQuadShot);
      };
      requestAnimationFrame(fireNextQuadShot);
    }
    _sfxBudgetExempt = false;
    if (hitSomething || extraHit) draw(now);
  }

  // 2026-06-10: resolves one shot at (sx, sy) — visual X-blast on both touch and desktop,
  // plus the standard hit checks. Extracted from handleArcadeTap so quadshot can fire extra
  // cluster shots through the identical path. Returns true if it hit anything.
  function resolveShotAt(sx, sy, now, isTouch, deferMarksman = false) {
    // 2026-07-01: _pulseShot tags this projectile as a Pulse Cannon bolt so it renders thicker +
    // brighter than a normal laser (set by firePulseShot around the call, cleared after).
    const pulse = _pulseShot;
    // 2026-07-01: hold a ref to the blast we just created so the hit-check branches below can flag
    // whether this shot actually struck a target. A Pulse Cannon MISS renders a toned-down blast
    // (no oversized ghost-X) so sweeping into empty space stops spraying big stray X's (see drawTapBlast).
    let _shotBlastRef = null;
    if (isIOSWebKit && isTouch) {
      _shotBlastRef = { x: sx, y: sy, life: 1.0, pulse, hit: false };
      tapBlasts.push(_shotBlastRef);
    } else {
      // Desktop now reuses the iOS-style fire graphic so taps read as the same compact blast
      // instead of the thin laser line path.
      _shotBlastRef = { x: sx, y: sy, life: 1.0, pulse, hit: false };
      tapBlasts.push(_shotBlastRef);
    }
    const markShotHit = () => { if (_shotBlastRef) _shotBlastRef.hit = true; };
    shotsFired += 1;
    // 2026-06-23: while quadshot is active, bombs and UFOs die in one hit — the bomb skips its
    // arming step and detonates on the spot, the UFO is destroyed on the first hit — to sell the
    // "powerful weapon" illusion. quadShotUntil is in scope, so this covers both the original tap
    // and the seeking burst shots. Non-quad shots keep the normal arm-then-detonate / 2-hit flow.
    const quadActive = performance.now() < quadShotUntil;
    if (landmine && isPointOnMine(landmine, sx, sy)) {
      triggerCrosshairFire();
      markShotHit();
      stuntNotify("mine_tap"); // tutorial Phase 6: player engaged the bomb (arm / detonate)
      if (quadActive) explodeLandmine();
      else armLandmine();
      recordComboEvent("bomb_tap", { x: sx, y: sy });
      return true;
    }
    // 2026-06-10: placed bombs use the same tap behavior (spawned → arm, armed → detonate)
    const tappedBomb = placedBombs.find((b) => isPointOnMine(b, sx, sy));
    if (tappedBomb) {
      triggerCrosshairFire();
      markShotHit();
      if (quadActive) explodePlacedBomb(tappedBomb);
      else armMineEntity(tappedBomb, (opts) => explodePlacedBomb(tappedBomb, opts));
      recordComboEvent("bomb_tap", { x: sx, y: sy });
      return true;
    }
    if (ufo && isPointOnUfo(sx, sy)) {
      triggerCrosshairFire();
      markShotHit();
      // 2026-07-03: remember a quad-volley UFO hit so the combined marksman event below is skipped —
      // ufo_shot already advanced the net-UFO-net combo (plasmaStage 1→2) and the laser_stroid_hit/
      // laser_miss volley event would immediately break it (breakNetUfoNetCombo) on the same tap.
      if (deferMarksman) _quadHitUfo = true;
      hitUfo(quadActive);
      recordComboEvent("ufo_shot", { x: sx, y: sy });
      return true;
    }
    const hitIndex = findHitAsteroidIndex(sx, sy);
    if (hitIndex >= 0 && !tutorialFireBlocked) {
      triggerCrosshairFire();
      markShotHit();
      // 2026-06-22: a tossed stroid (fiery or frozen — render-only difference) is an in-flight
      // projectile, not a normal rock. Blasting it detonates on the spot (reusing the impact FX
      // + sim.tossedAsteroid cleanup) instead of splitting it into children.
      const hitRock = sim.asteroids[hitIndex];
      if (hitRock && hitRock.tossed) {
        detonateTossedAsteroid(hitRock);
      } else {
        // 2026-07-01: pass the shot's impact point so the split children get a directional teal
        // "just got hit" highlight on the side that faced the shot (see splitAsteroidByIndex).
        // 2026-07-02: applies to plain plasma/laser taps too, not just Pulse Cannon bolts — the
        // shard highlight was missing on normal-tap kills (playtest).
        // DEBUG_FIRSTKILL: arm on this (the first stroid kill) + time the split's synchronous cost.
        fkArm();
        fkPhase(() => splitAsteroidByIndex(hitIndex, { x: sx, y: sy }));
      }
      // 2026-06-30: under quadshot, defer to handleArcadeTap so the 4-projectile volley counts as
      // one marksman hit (flag the kill instead of incrementing here).
      if (deferMarksman) _quadHitAsteroid = true;
      else recordComboEvent("laser_stroid_hit", { x: sx, y: sy });
      stuntNotify("shoot");
      return true;
    }
    if (!deferMarksman) recordComboEvent("laser_miss", { x: sx, y: sy });
    return false;
  }

  // 2026-07-02: light up every stroid within PULSE_BLAST_RADIUS of the shot point with the exact same
  // pulsing teal glow a UFO explosion applies. Writes the _ufoBlasted glow family that pixiRenderer's
  // syncAsteroids already renders/cleans up — highlight only, no knockback (pulse gameplay unchanged).
  function applyPulseBlastGlow(cx, cy) {
    const blastTime = performance.now();
    for (let i = 0; i < sim.asteroids.length; i += 1) {
      const a = sim.asteroids[i];
      const dx = a.x - cx;
      const dy = a.y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > PULSE_BLAST_RADIUS) continue;
      a._ufoBlasted = blastTime;
      a._ufoBlastedDuration = UFO_GLOW_DURATION;
      a._ufoBlastOriginX = cx;
      a._ufoBlastOriginY = cy;
      a._ufoBlastIntensity = 1 - (dist / PULSE_BLAST_RADIUS);
    }
  }

  // 2026-07-01: Pulse Cannon single shot. Aims at the held pointer, applies a small oscillating
  // turret sweep (so the stream reads as a rotating cannon, deliberately less precise than a laser),
  // fires through resolveShotAt, and plays an alternating fire report. Marksman is deferred: a pulse
  // shot only records a combo HIT (never a miss), so the weapon's spray can't break the player's combo.
  function firePulseShot(now) {
    if (!galaxyGesture) return;
    const cx = sim.width / 2;
    const cy = sim.height / 2;
    const aim = galaxyGesture.current || galaxyGesture.start;
    let dx = aim.x - cx;
    let dy = aim.y - cy;
    let dist = Math.hypot(dx, dy);
    if (dist < 1) { dx = 0; dy = -1; dist = 1; } // straight-up fallback for a dead-centre press
    const baseAngle = Math.atan2(dy, dx);
    const sweep = Math.sin(pulseSweepPhase) * (PULSE_CANNON_SWEEP_DEG * Math.PI / 180);
    pulseSweepPhase += 0.6; // advance the oscillator → center → right → center → left …
    const ang = baseAngle + sweep;
    const sx = clamp(cx + Math.cos(ang) * dist, 0, sim.width);
    const sy = clamp(cy + Math.sin(ang) * dist, 0, sim.height);
    _pulseShot = true;
    const hit = resolveShotAt(sx, sy, now, galaxyGesture.isTouch === true, true);
    _pulseShot = false;
    // 2026-07-02: stamp a teal electric ring at the shot point (over the X-blast) as the fire signature.
    spawnPulseFireBurst(sx, sy);
    // 2026-07-02: highlight nearby stroids with the UFO-explosion glow, centered on the shot point.
    applyPulseBlastGlow(sx, sy);
    // 2026-07-01: the Pulse Cannon sprays ~12 hits/s — feeding every hit into the 10-hit MARKSMAN
    // counter trivializes it. Only every 3rd pulse hit counts toward marksman (so it still builds,
    // but ~3x slower). Pulse still never records a MISS (resolveShotAt was called with deferMarksman),
    // so the spray can't break the player's combo.
    if (hit) {
      pulseMarksmanTick = (pulseMarksmanTick + 1) % 3;
      if (pulseMarksmanTick === 0) recordComboEvent("laser_stroid_hit", { x: sx, y: sy });
    }
    // alternating fire1/fire2 with pitch jitter so a sustained stream never combs into one harsh tone
    // 2026-07-02: pulse fire read too quiet in playtest — bumped 0.7 → 0.9 (~+25%).
    playGameSfx(pulseFireToggle ? "pulse_cannon_fire2" : "pulse_cannon_fire1", 0.9, {
      important: true,
      detune: (Math.random() - 0.5) * 90,
    });
    pulseFireToggle ^= 1;
    // 2026-07-02: sharp, quick haptic tick on each shot so a held pulse stream "buzzes" in the hand.
    // Throttled to ~40ms so the ~12 shots/s stream doesn't flood the Capacitor bridge (a pair's two
    // 35ms-apart shots collapse to one tick). This layers ON TOP of the per-kill destroy haptic.
    if (now - lastPulseFireHapticAt >= 40) {
      lastPulseFireHapticAt = now;
      triggerGameplayHapticImpact(hapticImpactStyle.Light);
    }
    pulseMuzzle.recoil = 2; // subtle kick; drawn as a 1-2px muzzle offset, never touches gameplay
  }

  // Stop the held rapid-fire stream (input released, weapon expired, or cancelled) and hide the muzzle.
  function stopPulseFiring() {
    pulseFiring = false;
    pulseBurstIndex = 0;
    pulseMuzzle.active = false;
    pulseMuzzle.recoil = 0;
  }

  // 2026-07-01: Pulse Cannon arm/disarm music+FX hooks (mirrors onFreezeStart/freezePauseFx). The
  // `pulseWasActive` latch (declared with the other pulse state) makes onPulseEnd fire exactly once
  // on the active→inactive edge, whether the weapon lapses naturally (detected in updateHudPulseBadge),
  // is tapped off (cancelPulseCannon), or is dropped by a level/reset path — all idempotently.
  function onPulseStart() {
    if (pulseWasActive) return;
    pulseWasActive = true;
    audioEngine.applyPulseFilter(); // dim music >600Hz + light duck while the cannon runs
  }
  function onPulseEnd(silent = false) {
    if (!pulseWasActive) return;
    pulseWasActive = false;
    audioEngine.removePulseFilter(); // swell the music back to normal
    if (silent) return; // level-end/reset — drop the filter without a disarm cue mid-transition
    // Disarm cue — synthesized from existing sfx (no dedicated asset): the unfreeze whoosh leads as
    // the "spin-down", with a subtle pitched-/slowed-down charge tail under it for weapon character.
    playGameSfx("unfreeze", 0.7, { important: true, detune: -200 });
    playGameSfx("pulse_cannon_charge", 0.35, { important: true, detune: -800, rate: 0.8 });
  }

  // 2026-06-10: per-type powerup collection effects.
  function collectPowerup(pu) {
    spawnPowerupPickupBurst(pu);
    // gold bars get their own pickup sound; everything else keeps the generic blip
    if (pu.type === "goldbars") playGameSfx("pickup_gold", 0.9);
    else if (pu.type !== "pulse") playGameSfx("blip", 0.9);
    playGameSfx("crunch", 0.58);
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
      // 2026-07-03: 1 gold bar = 3 POLYSLOTS tokens. (The 2026-07-02 drop to 1 was not intended —
      // reverted here so a gold bar is worth three pulls again.)
      slotTokens += 3;
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
    if (pu.type === "pulse") {
      // 2026-07-01: Pulse Cannon — a 10s timed rapid-fire weapon (hold to sweep-fire). Plays a
      // charge-up on activation; supersedes the missile weapon like quad shot does.
      pulseCannonUntil = performance.now() + PULSE_CANNON_DURATION_MS;
      updateHudPulseBadge();
      // 2026-07-01: `important` so the pickup-frame iOS 2-SFX budget (blip + crunch already
      // fired this frame) can't drop the arm-up cue — the Pulse Cannon self-arms on pickup, so
      // this charge sound IS the "weapon armed" confirmation and must land with the pickup.
      // Louder than the pickup blip so the "cannon charge" reads clearly (user request).
      playGameSfx("pulse_cannon_charge", 1.2, { important: true });
      onPulseStart(); // dim the music (>600Hz) + light duck for the weapon's duration
      cssFlash("#00ffc8", 0.22, 250);
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
    recordComboEvent("laser_non_stroid_hit", { x, y });
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
    spawnExplosiveElectricBurst(tx, ty, blastRadius, 5);
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
    // 2026-07-03: MANUAL plasma net — a placed net is waiting to be detonated. A press INSIDE it fires
    // it (and consumes the press); a press OUTSIDE falls through to normal weapon fire. beginPlasmaCage
    // is already blocked while one is placed, so an outside press can't start a second net.
    if (plasmaCage.placed && engineMode === "arcade" && arcadeActive && !missileAimMode && !bombAimMode) {
      const r = plasmaCage.placed;
      if (point.x >= r.x && point.x <= r.x + r.w && point.y >= r.y && point.y <= r.y + r.h) {
        detonatePlacedNet(now);
        return;
      }
    }
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
    // 2026-07-01: Pulse Cannon — a plain press (not a grab/aim) begins HELD rapid fire immediately,
    // firing the first shot now. Stroid/mine grabs (mode "stroidToss") keep priority and skip pulse.
    // A press ON a powerup is left to the normal tap path (handleArcadeTap) so it still gets collected
    // — resolveShotAt (the pulse fire path) doesn't collect powerups.
    const pressOnPowerup = powerups.some((pu) => Math.hypot(point.x - pu.x, point.y - pu.y) <= pu.r * 1.8);
    if (
      engineMode === "arcade" && arcadeActive && mode === "tap"
      && pulseCannonActive() && !missileAimMode && !bombAimMode && !pressOnPowerup
    ) {
      pulseFiring = true;
      firePulseShot(now); // shot A of the first pair — its partner follows PULSE_PAIR_DELAY_MS later
      pulseBurstIndex = 1;
      nextPulseShotAt = now + PULSE_PAIR_DELAY_MS;
    }
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
    // While Pulse Cannon is firing, a drag steers the turret aim (via galaxyGesture.current, already
    // updated above) — it must NOT spawn a Plasma Net. Suppress the whole cage branch.
    if (engineMode === "arcade" && arcadeActive && dragged && !pulseFiring) {
      if (!plasmaCage.active && galaxyGesture.mode !== "cage") {
        galaxyGesture.mode = "cage";
        galaxyGesture.canceled = !beginPlasmaCage(galaxyGesture.start, point, now);
      } else if (plasmaCage.active) {
        // 2026-06-26: clamp the net corner to the play bounds so sliding a finger to the screen
        // edge keeps the net alive on-screen instead of losing it off the edge.
        plasmaCage.currentX = Math.max(0, Math.min(sim.width, point.x));
        plasmaCage.currentY = Math.max(0, Math.min(sim.height, point.y));
      }
    }
  }

  // 2026-06-11: a canceled pointer/touch (iOS edge gestures, system interruptions) must release
  // any in-progress grab and clear the gesture, or the grabbed stroid stays pinned in place.
  function onGalaxyPointerCancel() {
    if (pulseFiring) stopPulseFiring();
    if (stroidToss.active) cancelStroidToss();
    // 2026-06-26: an iOS edge-gesture pointercancel used to silently DISCARD an in-progress plasma
    // net — players "lost" the net by dragging to the screen edge. 2026-07-03: an edge-exit now
    // LEAVES THE NET PLACED (a trap to detonate) rather than firing/fizzling it, so a slip off the
    // bezel never throws the net away.
    if (plasmaCage.active) releasePlasmaCage(performance.now(), { edgeExit: true });
    galaxyGesture = null;
  }

  function onGalaxyPointerUp(event) {
    if (!galaxyGesture) return;
    const now = performance.now();
    // 2026-06-09: capture before the gesture is cleared so taps know the input type
    const gestureIsTouch = galaxyGesture.isTouch === true;
    const point = getPointerWorld(event);
    // 2026-07-03: a pointerup whose coords land off the play area (finger lifted onto the iPad bezel)
    // is treated as an EDGE-EXIT so an in-progress net is left placed rather than fizzled (#2).
    let plasmaEdgeExit = false;
    if (Number.isFinite(point.x) && Number.isFinite(point.y)) {
      galaxyGesture.current = point;
      if (plasmaCage.active) {
        plasmaEdgeExit = point.x < 0 || point.x > sim.width || point.y < 0 || point.y > sim.height;
        // Clamp the release corner to play bounds (matches onGalaxyPointerMove) so the net's geometry
        // stays on-screen whether it fires (auto/charged) or is placed (manual/edge-exit).
        plasmaCage.currentX = clamp(point.x, 0, sim.width);
        plasmaCage.currentY = clamp(point.y, 0, sim.height);
      }
    } else if (plasmaCage.active) {
      plasmaEdgeExit = true; // no usable coords → treat as an edge/interruption exit
    }
    if (event.cancelable) event.preventDefault();
    if (typeof galaxyPlayCanvas.releasePointerCapture === "function" && galaxyGesture.pointerId != null) {
      try {
        galaxyPlayCanvas.releasePointerCapture(galaxyGesture.pointerId);
      } catch {
        // ignore capture failures
      }
    }
    // 2026-07-01: Pulse Cannon hold released — stop the stream + hide the muzzle. The initial shot
    // already fired on pointerdown, so DON'T fall through to handleArcadeTap (no double-fire).
    if (pulseFiring) {
      stopPulseFiring();
      galaxyGesture = null;
      draw(now);
      return;
    }
    if (plasmaCage.active) {
      releasePlasmaCage(now, { edgeExit: plasmaEdgeExit });
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
    // 2026-06-24: cancel any in-flight YOU-WIN celebration timers so they don't fire after teardown.
    _winSeqTimers.forEach(clearTimeout);
    _winSeqTimers = [];
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
    slotTeardown(SLOT_REASON.MENU); // tear the slot down BEFORE leaving — stopAndMenu won't clean it otherwise
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
      // Step 4: the slot owns this window (arcadeActive is false here, so the arcade restore below
      // won't fire) — pause it explicitly. The unconditional music dim still runs alongside.
      if (isSlotActive()) slotPauseForBackground();
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
      // Step 4: resume the slot to a sane, exitable shell (the arcade restore below stays skipped
      // because arcadeActive is false during the slot). Music restore below runs unconditionally.
      if (isSlotActive()) slotResumeFromBackground();
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
    playArcadeMenuMusic(opts = {}) {
      playArcadeMenuMusic(opts);
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
        audioEngine.loadMany?.(gameplayPreloadSfxMap());
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
      if (bombAimMode) playGameSfx("item_pickup2", 0.85); // 2026-06-21: crunchier bomb-arm cue
    },
    // 2026-06-17: HUD freeze button — toggle freeze on/off (tap to freeze, tap again to unfreeze)
    activateFreeze() {
      if (!arcadeActive || engineMode !== "arcade") return;
      toggleFreezeFromInventory();
    },
    // 2026-07-01: HUD Pulse Cannon badge — tap to cancel the weapon early (forfeit remaining time).
    cancelPulse() {
      if (!arcadeActive || engineMode !== "arcade") return;
      cancelPulseCannon();
    },
    // 2026-07-02: HUD Quad Shot badge — tap to cancel the weapon early. Allowed in real arcade and
    // in endless Practice, but never during the training lesson (stuntActive drives the quad phase).
    cancelQuad() {
      if (stuntActive) return;
      if (engineMode !== "arcade" && engineMode !== "practice") return;
      cancelQuadShot();
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
    isSlotActive, // slot owns the between-level window — out-of-closure handlers branch on this
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
