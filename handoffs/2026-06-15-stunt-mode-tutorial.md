# Session handoff — 2026-06-15 — Stunt Mode SPC tutorial (full build + polish)

**BUILD_TS = "2026-06-15 15:11"**  ·  branch: main

## Summary
Built **Stunt Mode → Training**, a no-fail, SPC-guided tutorial that walks the player through
every core verb (laser, plasma net, UFO, stroid toss, landmine, bomb inventory, quad shot,
freeze, missile) and then hands off into an endless **Practice** mode. Shipped in three commits:
the full engine (`4523cc7`), a pacing/unstuck pass from playtest feedback (`94ae4c7`), and an
intro-cutscene + pause/resume + skip polish pass (`5e81286`). Also routed level-11 music and
corrected the lock-screen MediaSession artwork size. All work is on `main` and deployed to iOS.

The tutorial is **functional but only text-captioned** — SPC voice audio and portrait art do not
exist yet (graceful fallbacks are in place). Needs a full on-device playthrough.

---

## Architecture (read this first)

The entire tutorial lives **inside the `galaxyCanvasController` IIFE** in `script.js` (it needs
closure access to `spawnAsteroid`, `spawnUfo`, `powerups`, `freezeUntil`, `plasmaCage`, etc.).
Key design decisions:

- **`stuntActive` is the master "tutorial running" flag.** It was a pre-existing flag that already
  gates the timed-level update block OFF (`if (engineMode === "arcade" && arcadeActive && !stuntActive)`),
  so no level timer / random spawns / game-over during the tutorial. We reused it instead of inventing a new one.
- **Physics still runs during the tutorial.** The `gameplayAllowed` block (asteroid movement, UFO
  move/teleport/despawn, landmine ticks, toss) is gated on `arcadePausedUntil`, NOT `stuntActive` — so
  stroids move and can be shot/tossed. This is why guards like "UFO no-teleport" had to be added there.
- **Async phase engine.** `TUTORIAL_PHASES` is an array of `{ id, run: async () => {...} }`. `runTutorial()`
  awaits each phase's `run()` in order, then `endTutorial()` → `startStuntPractice()`. Phases await player
  actions via promise helpers resolved in `updateStunt()` (called each frame while `stuntActive`):
  - `waitFor(pred)` — resolves when `pred()` true (polled each frame).
  - `waitEvent(name, n)` — counts increments of `tutorialEvents[name]` (fed by `stuntNotify(name)`).
  - `waitPowerupCollected(type)`, `waitVOIdle()`, `waitMs(ms)`.
  - All are **abortable** via `_tutRunToken`; `abortTutorialAsync()` rejects pending waiters with `TUT_ABORT`,
    which propagates out of the awaited phase and is swallowed by `runTutorial`'s catch.
- **`stuntNotify(eventId)`** is just an event counter now (was the old step machine). It's called from the
  existing action sites: `shoot`, `plasma`, `plasma_miss`, `toss`, `toss_fail`, `bomb`, `freeze`, `mine_tap`.
- **Cleanup is centralized** in `cleanupTutorial()` (idempotent) — called from `exitStuntMode`, `startStuntPractice`,
  and the `showModeSelect` stunt-exit branch. Bumps `_tutRunToken`, restores CMDR portrait, hides chrome.

### Menu flow
`Select Mode → Stunt Mode` button now opens a **sub-menu** (`showStuntModeMenu` → `setArcadeSubmenu("stunt")`,
panel `#stuntModeMenuPanel` in `index.html`): **Training** (always) + **Practice** (disabled until
`localStorage['poly_stunt_training_complete'] === '1'`) + Back. Training → `startStuntMode()`;
Practice → `startStuntPractice()` (gated).

### SPC comm system
- Captions are **pinned directly to the comm ticker** via `commBoxController.pinTicker(text)` and advance on a
  tight timer (`pumpSpc`) — this was rewritten from the original `queueVO` approach because the comm box was
  hiding/showing between every line (visible flicker, dead air). Pin-ticker = no hide/show between lines.
- `spcVO(key, text)` queues; `spcFlush()` clears the queue + current timer/audio (used by skip + completion).
- Audio: `spcVoSrc(key)` returns `vo/SPC_<key>.mp3` ONLY if the key is in the (currently empty) `SPC_VO_AVAILABLE`
  set — so today every line is text-only with no 404s. When audio is recorded, add keys to that set.
- **Portrait swap:** `commBoxController.setPortraitOverride("vo/spc_portrait.png", "SPC")` shows SPC + sets the
  `#commanderCallsign` label; falls back to a teal "SPC" SVG data-URI placeholder if the png 404s. While an
  override is set, `setFrame()` is a no-op so the idle/talk frame cycling can't clobber the SPC image.
- **`setExclusiveSpeaker(true)`** makes `commBoxController.queueVO` drop every line that isn't marked `_spc:true`,
  so CMDR praise/reactions never interleave with SPC during training.

---

## What was built / fixed

### 1. Full tutorial engine + 10-phase script (commit `4523cc7`)
- **Fix:** New engine, menu sub-menu, SPC comm, HUD pointer (`showHudPointer`/`#tutorialPointer`), tutorial
  entity helpers (`spawnTutorialAsteroids/UFO/Powerup/Landmine`, `clearTutorialField`), guards, endless Practice
  (`practiceEndless`), cleanup. Replaced the old 5-step `STUNT_STEPS` machine entirely.
- Integration hooks added: `stuntNotify("plasma_miss")` and `"toss_fail"` at the release sites, `"mine_tap"` at
  the landmine arm tap, UFO `!ufo.tutorial` teleport guard + `despawnAt = Infinity`, CMDR UFO VO suppressed when
  `stuntActive`, fire-block (`tutorialFireBlocked`) on the laser hit site.
- **Verified:** `node --check` + build only. NOT play-tested by me.

### 2. Playtest pacing + unstuck pass (commit `94ae4c7`)
From the user's first device test. Each was a real symptom:
- **"Too slow / comm box disappears between VO lines."** → Rewrote SPC to pin-ticker (no flicker) + shorter line
  durations (`pumpSpc`, `script.js` ~9797).
- **"Delay before 'Fantastic work' after clearing stroids" / completing a step must skip to next VO.** → On any
  waiter resolving in `updateStunt`, call `spcFlush()` so queued instructional chatter is dropped and the
  success line plays immediately.
- **"Plasma 'do it again' gets stuck, no stroids on screen."** → Plasma now **stays charged in the tutorial**
  (`if (stuntActive) rechargePlasmaNow()` after firing, in `releasePlasmaCage`), and `tutorialPlasmaSuccess(respawn)`
  re-spawns stroids if the player clears them with the laser instead.
- **"App-switch → timer powerup blinked red and vanished, tutorial stuck in limbo."** → Tutorial powerups are
  re-stamped `spawnedAt = now` every frame in `updateStunt`, so they never age/expire/blink.
- **"Disable plasma/toss during the first blast-a-stroid step."** → `tutorialBlockPlasmaToss` flag gates
  `beginPlasmaCage` + `startStroidToss` (both `return false`). Set true in the laser phase, false in plasma phase.
- **"Stroids spawn on the edge — want them more center."** → `tutZonePoint("random")` now scatters within the
  central ~55%×50% of the playfield, never the perimeter.
- **"No sound when timer powerup grabbed."** → Timer collect now plays `bling` 0.95 + `life_gain` 1.0.
- **Verified:** build only.

### 3. Intro cutscene + pause/resume + skip + lock-screen icon (commit `5e81286`)
Second batch of deferred polish:
- **Intro cutscene (#2/#3):** comm box starts **centered** (`commBoxController.setCommCenter(true)`), perimeter
  **counts down** (`tutorialTimerRunning` drives `_timerRemainingMs` in `updateStunt`), two neon arrows
  (`showCommArrows`, top `↓`/bottom `↑` both rotated −45°) point at it. When the timer powerup appears (Phase 1)
  the comm box docks to bottom-left + arrows clear; on **collect**, perimeter snaps full and freezes
  (`tutorialTimerRunning = false` set inside `collectPowerup`'s timer block to avoid a one-frame re-deplete race).
- **Double-tap-to-skip (#1):** strobing `#tutorialSkipHint` "DOUBLE-TAP TO SKIP" tooltip; a double-tap on **empty
  space** (`!hitSomething` in `handleArcadeTap`, two taps <320ms) calls `tutorialSkip()` → jumps to the latest
  queued instruction + plasma glitch flash + `printtext` sound.
- **Pause/Resume (#4):** the **Modes** button (`closeGalaxy`) during training calls `pauseTutorial()` instead of
  tearing down — freezes physics (`arcadePausedUntil = Infinity`), pauses VO, shows the `TRAINING PAUSED` overlay
  with **Resume** + **Quit Training** (secondary button). `visibilitychange` auto-pauses on app background (the
  real fix for the limbo report). The pause overlay also resumes on **double-tap** or **swipe-down** (pointer
  listeners on `arcadeOverlay`). `updateStunt` early-returns when `tutorialPaused`.
- **Lock-screen icon (#5):** MediaSession artwork `sizes` corrected `512x512 → 256x256` to match the actual
  `favicon.png` (256×256). **Unverified** — may still need a true 512/1024 square artwork if iOS still shows blank.
- **Verified:** build only. All gesture thresholds + arrow positions are eyeballed, need device tuning.

### 4. L11 music routing (commit `4523cc7`)
- Moved `L11_Swarm.mp3` → `assets/music/`, added `MUSIC.L11_SWARM`, changed `getMusicForLevel` from
  `level >= 10 → L10` to `level === 10 → L10` / `level >= 11 → L11_SWARM`. Verified `getMusicForLevel(11)` returns
  the swarm track. Also added `vo/*.png` to the `prepare:web` copy list (so `spc_portrait.png` ships when added).

---

## Still open / follow-ups

- **L12 / L13 music NOT wired.** `assets/music/L12_BoomCadet.mp3` + `L13_Boom_pt2.mp3` were committed in `5e81286`
  (they were untracked drops following the L11 pattern) but there are **no `MUSIC.L12_*`/`L13_*` keys and no
  routing** — levels 12+ currently all play `L11_Swarm`. To finish: add the two `MUSIC` keys and branch
  `getMusicForLevel` (`level === 12 → L12`, `level === 13 → L13`, then `>= 14 → ...?`).
- **SPC voice audio + portrait do not exist.** Record `SPC_01.mp3`…`SPC_70.mp3` → `vo/`, supply
  `vo/spc_portrait.png`, then **add the recorded keys to the `SPC_VO_AVAILABLE` set** in `script.js` (currently
  empty → everything is text-only).
- **Full on-device playthrough never done.** No phase has been verified to actually advance on a device — only
  syntax/build. Walk all 10 phases + the Practice handoff.
- **Lock-screen icon unverified** — confirm the 256×256 fix actually shows the icon; if not, ship a real
  512/1024 square PNG into `www/` and point artwork at it.
- **Arrow positions + gesture thresholds are guesses** — intro arrows are window-relative (`innerWidth/2`,
  `innerHeight*0.34`); pause double-tap is 320ms, swipe is 70px. Tune on device.
- **Deferred niceties (intentionally simplified):** "freeze/quad/missile timer freezes until first use" — those
  timers just run normally; the landmine manual-vs-auto detonation is approximated via the `mine_tap` count.

## Gotchas / learnings (highest value)

- **The whole tutorial MUST live inside the `galaxyCanvasController` closure** — all the spawn/sim state
  (`spawnAsteroid`, `powerups`, `freezeUntil`, `plasmaCage`, `ufo`, `landmine`) is closure-scoped, not global.
- **`stuntActive` gates the *timed-level* block, but physics runs via the separate `gameplayAllowed` block.**
  Anything you want frozen/changed during the tutorial that lives in `gameplayAllowed` (UFO teleport/despawn,
  collisions) needs its own `stuntActive`/`ufo.tutorial` guard there.
- **Powerups don't expire during the tutorial automatically** — the expiry splice is in the `!stuntActive`
  block — BUT the draw still **blinks them red** based on `now - spawnedAt` vs `BOMB_POWERUP_LIFETIME_MS`. After an
  app-switch the clock jumps and they look expired/vanish. Fix = re-stamp `spawnedAt = now` each frame.
- **The comm box "CMDR" callsign was a hardcoded div with no id** — added `id="commanderCallsign"` in `index.html`
  to allow the SPC swap.
- **The comm box base position is *inline* style** (`bottom:20px; left:16px` on `#commanderHUD`). To move it
  (cutscene centering) and move it back, you must set explicit values both ways — `style.left = ""` would wipe the
  inline base and leave it unpositioned. `setCommCenter(false)` restores `left:16px; bottom:20px` explicitly.
- **`commBoxController.queueVO` caps its internal queue at 2 and silently drops extras** — that's why SPC needed its
  own serial queue (`_spcQueue`) and ultimately the pin-ticker rewrite.
- **`spcFlush()` on every waiter-resolve is what makes "complete a step → skip to next VO" feel instant.** Without
  it, the success line queues behind still-playing instruction lines.
- **`startArcadeNew()` resets `practiceEndless = false` via `startLevel`** — so `startStuntPractice` must set
  `practiceEndless = true` *after* calling `startArcadeNew()`, not before.
- **`prepare:web` copies `vo/*.mp3` and now `vo/*.png`, but globs won't error if absent** (`|| true`) — so the
  missing SPC assets don't break the build.

## Pre-release reminders (carry forward — from CLAUDE.md)
- `DEBUG_FORCE_LEVEL_SELECT` → `false`; powerup level gate → `>= 4`; powerup weights (snowflake 10 / goldbars 25);
  remove forced goldbars + missile spawns; missile gate → `level >= 5`; resolve all `DEBUG: revert before release`.
- **Stunt-specific:** record `SPC_01–70.mp3` + `spc_portrait.png` → `vo/`; populate `SPC_VO_AVAILABLE`; verify all
  10 phases advance on device; confirm Practice unlock gate (`poly_stunt_training_complete`).
