# Looks cheats + combo text refactor + explosion performance deep dive

## Context
Paul's notes from the 2026-11-01 playtest, after build 38cf279 (pushed to `main`, build 10:05):

1. **Looks.** Paul loves all five view modes. Each should be its own **3-ad, permanent** cheat, using the Polyverse names. Avoid "Virtual Boy" (Nintendo trademark). The Cheat Codes panel needs **sections** so it stays organized.
2. **Combo text.** Paul has never liked how the combo text looks, and it "almost always seems to lag gameplay".
3. **Performance deep dive.** Especially bomb explosions and similar mass kills.

This plan is written to work as a **handoff doc**. Paul may `/clear` first, so all needed context is inline. Root `script.js` is the source of truth; `www/` is generated. After every edit run `node --check script.js && npm run prepare:web`, and bump `BUILD_TS` per build. Phone install recipe: memory `wireless-device-install`. Headless test recipe: Playwright at `/Users/paulfisher/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`, serve the repo on port 8765, open `www/index.html?cockpitLab=1` and call `__cockpitLab.start(n)`. Always kill the server afterwards.

---

## Part D (do FIRST) — Sound effects lost after a Continue ad (Paul, L11, build 10:05)
**Path:**
1. `offerAdContinue` (~19972) calls `adService.show()` (~386), which calls `holdAudio` → `hooks.onOpen`. The hooks are at ~13184 (search `adService.setHooks`). `onOpen` pauses the music with `pauseMusicNodeIntent` and calls **`audioEngine.ctx.suspend()`**.
2. When the ad closes, `settle` → `releaseAudio` → `onClose` calls `ctx.resume()` at 0, 400 and 1200 ms, sets `_verifyOnGesture`, and runs `verifyAlive()` at 1400 ms.
3. Then `retryCurrentLevel()` runs.

**Hypotheses, to rule out in order:**
- (a) **AdMob changes the native AVAudioSession** (category or active state) and nothing re-applies ours. Closing a full-screen ad view controller may not fire `sceneDidBecomeActive`. `.ambient` follows the silent switch, so if the phone is on silent, SFX go quiet while HTML music may survive.
- (b) **`ctx.resume()` hangs while the context is "interrupted".** Then `unlocked` / `_needsRebuild` end up in a state where `play()` still uses the buffer path into a dead context.
- (c) **Something in `retryCurrentLevel`** leaves SFX muted or ducked (`state.minimal`, `sfxBus` gain, an iOS-routed SFX dial).

**Diagnose:**
- Extend the Dev perf chip's audio line (`tutPerf`, ~22098: ctx state, clock STUCK, unlocked, buffers) to arcade mode.
- Reproduce on the phone with the test ad unit (dev devices use test units, `poly_oracle_test_ads`). Read the chip before and after the ad.
- Log the session category from native if needed.

**Likely fixes:**
- Native: re-assert the session (`reactivateAudioSession`) when the app becomes active **and** when a JS bridge event fires on ad close. A tiny `evaluateJavaScript`-style bridge already exists for interruption-end in `AppDelegate.swift`; add the reverse direction with a small Capacitor plugin method, or re-assert on `UIApplication.didBecomeActive` plus a timed re-assert.
- JS: after the ad closes, if the context isn't "running" or its clock is stuck, force `_needsRebuild` so the next tap rebuilds it (`rebuildContext` must run inside a gesture). The continue flow already requires a tap (the retry overlay), so that tap can rebuild.
- Verify: Continue ad → SFX play right away. Also verify the cheat-code ad pod and the token ad.

## Part A — Looks as 5 cheats, with Cheat Codes sections

**Current state (38cf279):**
- `applyWireLook(mode)` in `script.js` lives near `cssStatic` (search `WIREFRAME / B&W / VIRTUAL-BOY MOCKUPS`). Modes are `""|A|B|C|R|V`. It uses two full-screen overlays: `#wireGrayFx` (backdrop-filter grayscale) and `#wireRedFx` (red multiply). C and V also add a `.wireGrid` element, and B, C and V switch PIXI to outline textures (`pixiRenderer.js wireTextureFor`, read through `window.POLY_WIRE_MODE`).
- One cheat exists, `vboy`: storage keys `poly_oracle_cheat_vboy` / `poly_oracle_vboy_on`, menu button `#btnArcadeVboy` under Level Select, functions `vboyCheatOwned/vboyCheatOn/setVboyCheatOn/syncVboyMenuButton`.
- Dev Mode has a `#btnWireLook` button that cycles all looks.

**Names (Paul picked):**

| Mode | Name | Look |
|---|---|---|
| A | **Polynoir** | B&W |
| B | **Polysketch** | B&W outlines |
| C | **Polygrid** | Tron grid |
| R | **Virtual Poly** | red |
| V | **Polyvector** | red wireframe |

**Changes:**
1. **Data model.**
   - Add `LOOK_CATALOG = [{ id:"look_noir", mode:"A", name:"Polynoir", desc }, …]`.
   - Store each owned look as `poly_oracle_look_<mode>="1"`.
   - Store the active look as `poly_oracle_look_active` = a mode, or `""` for Classic.
   - Replace the `vboy` helpers with `lookOwned(mode)`, `activeLook()`, `setActiveLook(mode)`.
   - Migration: if `poly_oracle_cheat_vboy` is set, mark V as owned. It's only on Paul's devices, so this is cheap.
   - Keep the string-key, top-level-function pattern. It runs before the cheat consts exist, so it would otherwise hit a TDZ error (see memory `init-tdz-gotcha`).
2. **Cheats.**
   - Add the 5 looks to `CHEAT_CATALOG` with `section:"looks"`. Tag the existing entries `section:"unlocks"` (levelselect) and `section:"powerups"` (24-hour cheats).
   - In `recordCheatAd`, a look id sets its owned key and makes it the active look.
   - `isCheatOwned` must handle look ids.
   - Looks never enter `activeRunCheats`, so scores still count.
3. **Sectioned panel.**
   - `renderCheatCodesPanel()` groups rows under three headers: **Unlocks**, **Power-Ups · 24 hours**, **Looks · permanent**.
   - Each header is a small styled `div` (reuse the `.cheatRow` styles). Collapsible headers are optional, not required.
   - An owned look's row becomes a **USE / IN USE** button. Only one look can be active at a time.
   - Also add a small "Classic" button (it shows a tick when no look is active) so players can turn looks off.
4. **Menu.**
   - Replace `#btnArcadeVboy` with `#btnArcadeLook`, labelled "Look: Polygrid". Tapping it cycles Classic → each owned look.
   - It is hidden until at least one look is owned. Sync it in `syncArcadeMenuButtons` (rename `syncVboyMenuButton`).
5. **Dev.** Keep `#btnWireLook`, which cycles all looks without owning them, but have it write `poly_oracle_look_active` so there's one source of truth. Remove the `poly_oracle_wire_mock` key.
6. **Overlay perf.** The gray `backdrop-filter` covers the whole screen. In Part C, measure FPS with each look on at L12 and L15. If it's costly, a fallback for A/R is to drop the backdrop-filter and grey only `#galaxyView` with a CSS filter plus a PIXI `ColorMatrixFilter` on the stage.

## Part B — Combo text: redesign and make it cheap

**How it works today** (`awardCombo` ~14740, `drawComboBanners` ~14945, `drawComboBannersLayer` ~15038):
- Text is drawn on a **second full-screen canvas** (`comboBannerCanvas`, fixed, z 9500) that is **cleared and redrawn every frame for 2.2s**.
- During the slam the font size changes every frame, so WebKit re-lays out the glyphs each frame.
- There are 4 stroke/fill text draws per banner, all in `"lighter"` blending.
- The subtitle still uses `shadowBlur` on iOS (~15028). This was missed by commit 5e2013c.
- The font is SF Mono. The headline glow and letter blasts are already off on iOS, so the iPhone version looks plain, which explains Paul's dissatisfaction.

**Lag spikes at award time:**
- The combo voice line uses `preservePitch`, which always takes the HTML `<audio>` path. It plays twice, 70ms apart (`playComboSfx` ~14726), so the first play of each combo creates 2 `new Audio()` elements.
- `getBoundingClientRect()` is called twice, right after `cssShake`/`cssFlash` style writes, which forces a layout.
- Up to 4 sounds start at once.

**Plan:**
1. **Bake each banner once.** When a combo is awarded, render the headline and subtitle a single time onto an offscreen canvas at final size. Effects that were too expensive per frame become affordable because they run once:
   - gradient fill
   - thick outline
   - outer glow (`shadowBlur`, paid once)
   - optional chrome/bevel
2. **Show it as a PIXI sprite.** Use `PIXI.Texture.from(canvas)` in a new top PIXI container, animated with scale, alpha and y only (slam = scale 1.55→1 with an overshoot), and destroy the texture on removal.
   - This deletes `comboBannerCanvas` and its per-frame full-screen clear and upload.
   - Banners on the score screen or outside PIXI need a fallback: a DOM `<img>` or `<canvas>` element animated with CSS transform and opacity (compositor-only).
3. **Font.** Use a bundled display font, loaded and warmed at boot with `document.fonts.load`, so baking never waits on it. Pick one in the mockup step.
4. **Style mockups first** (same process as the looks). Build 3 styles behind a Dev / FX Lab toggle (`trial("comboStyle")` in the existing trials system, `TRIAL_DEFAULTS` ~2422), take headless screenshots, and let Paul pick:
   - (1) Arcade chrome: gradient, bevel, heavy outline.
   - (2) Neon tube: thin bright core with a wide glow, in level colours.
   - (3) Comic punch: tilted, with a burst plate behind the text.
5. **Award-time fixes:**
   - Make the combo voice a decoded buffer: drop `preservePitch`, pre-render the pitched versions or play at rate 1. Paul should ear-check the result.
   - Play it once instead of the 2-layer echo, or keep the echo but on the buffer path.
   - Cache the rects for the comm-box dodge on resize instead of reading layout at award time.
   - Let combo sounds count toward the audio budget, except the voice line.
   - Gate `comboFxParticles` on `_frameBudgetExceeded`.

## Part C — Explosion performance deep dive

**Measure first.**
- The Dev perf recorder `tutPerf` (~22054) only runs in Training/Practice. Extend it to arcade levels: bucket by level, and add markers for bomb, missile, net and combo events.
- Wrap the main suspects in `fdPhase` timers so the per-event sync cost shows on the chip. Then record a baseline on iPhone at L12 (bomb-heavy) and L15.
- Reuse the headless scripts `tools/perf/check-bomb-stress.cjs` and `profile-late-levels.cjs` as before/after numbers.

**Fixes, ranked by suspected cost:**
1. **Haptics per kill.**
   - `triggerAsteroidSizeFeedback` (~17607) makes 1–2 native haptic bridge calls per kill with no throttle. A 10-rock bomb means 10–20 calls, plus 3 from `triggerHugeHaptic`. Code comment ~18959 already calls bridged haptics "the worst offender".
   - Fix: a global haptic throttle with at most 1 per 60ms, where the strongest request in the window wins.
   - Make the per-kill `cssFlash`/`cssShake` coalesce the same way.
2. **Shrapnel kills explode twice.**
   - The shrapnel step (~23192) calls `spawnExplosion` and then `vaporizeAsteroidByIndex`, which calls it again. Remove the first call.
   - Add a per-frame kill cap (about 3 per frame) to shrapnel and the plasma net (`destroyAsteroidsInPlasmaCage` ~18023). Queue the rest, like the existing `missileSplitQueue` / `MISSILE_SPLITS_PER_FRAME`.
3. **Tinted 2D sprite bursts.**
   - `drawFxSheetFrame` (~14691) round-trips through `fxTintCanvas` for every burst, every frame. Pre-bake tinted sprite sheets once per colour, cached by colour key, so each burst becomes one `drawImage`.
   - Longer term, move these bursts into PIXI (AnimatedSprite or a tinted Sprite) so the 2D ufoFx overlay can stay idle.
4. **Shrapnel graphics.**
   - `syncShrapnel` (pixiRenderer ~1516) rebuilds a `PIXI.Graphics` for each shrapnel piece every frame, 36 per bomb. Replace it with pooled sprites from one baked shrapnel texture, scaled and tinted.
5. **`cssShake`.**
   - It writes `transform` on `#galaxyView`, which has no `will-change`, so each shake rebuilds compositing layers. Shake the PIXI stage or canvas wrapper instead, or add `will-change: transform` and make sure nothing reads `getBoundingClientRect` right after.
   - Also: `updateStroidBehindHud` (~22659) reads layout at 15Hz. Cache those rects.
6. **`cssStatic`** (~702): stop reallocating the canvas on every call and add an overlap guard. On iOS, consider a pre-rendered noise texture faded with CSS opacity.
7. **Missiles detonate mines inline.** `explodeMissile` (~25180) sets off caught mines in the same frame. Route them through `chainDetonateMines` so the 2-per-frame cap applies.
8. **Leftovers:**
   - Avoid allocating `new Set()` per frame in pixiRenderer's sync functions (~561).
   - Reset `p._pixiTint` in `releaseParticle`.
   - Return dropped warp rings to the pool (~16124).
   - Remove the per-draw array allocation in the ufoFx method patch (~10341).
9. **Proactive guard.** `_frameBudgetExceeded` only reacts on the frame after a slow one. Add an "event budget" flag that bomb/missile/net detonation sets for that frame plus the next 2, so optional work is cut on the frame that hitches.

## Status (end of 2026-11-01 session)
- DONE + pushed: Part D (81e1d50 — root cause was the Google Mobile Ads SDK owning the AVAudioSession), C1, C2, C9, bomb sprite redesign, first-launch deferrals, L3 UFO blur hang (81e1d50); Part A looks + sections, menu chirp, plasma-over-menu (0a0b30e).
- 12:05 build (UNCOMMITTED, installed on iPhone): perf chip buckets by look (`L12 grid` etc., `window.POLY_LOOK`); Part B mockups = `comboBanner.js` (bake + pose, styles chrome/neon/comic) + `assets/fonts/*.woff2` (OFL) + preview `prototypes/combo-styles/` → artifact https://claude.ai/artifact/Wynr46KQ3BBasDCkNjp4ZP. WAITING on Paul's style pick + look FPS numbers. comboBanner.js/fonts not yet in index.html or prepare:web.
- Build 12:55 (UNCOMMITTED, on iPhone): Dev Mode always has Level Select; Dev "Infinite Weapons" switch (default on, `poly_oracle_dev_inf_weapons`, survives Factory Reset); TestFlight free cheats via native `window.__polyTestFlight` (sandbox receipt, MainViewController.swift) → "Unlock free (beta)" button. Look FPS check DONE: looks ~free (58-60fps); only >100ms hitches were combo awards (130/132ms) → Part B is the fix. Paul likes combo styles 1 (chrome) AND 3 (comic): build both behind a Dev switch (or chrome for normal, comic for big combos).
- Build 13:20 (UNCOMMITTED, on iPhone): baked combo banners IN GAME — `showBakedComboBanner` (DOM canvas in `comboBannerHost`, WAAPI transform/opacity), cache + `prebakeComboBanners()` at startLevel, trial `comboStyle` (classic/chrome/comic/neon/mixed, default mixed = chrome <1500, comic >=1500), combo voice echo dropped except classic, `__cockpitLab.combo(i, style)` hook, comboBanner.js + assets/fonts in index.html + prepare:web. Awaiting Paul's device retest (ev:combo row vs 130ms baseline).
- Paul LOVES the baked banners (default mixed). Device retest: ev:combo 52fps max 83ms, no >100ms hitches (was 22fps/132ms).
- Build 13:45: theme-start "muffled crack" — source file clean (-5 dB peak); suspect = music <audio> re-routed into Web Audio mid-play on first-tap unlock (iosRouteElement) + raw gain .value steps. Fix: fresh route starts at gain 0 and glides up; setElementLevel uses setTargetAtTime. Pending Paul's ear check.
- NEXT: device FPS check with each look on (L12/L15) → cheaper overlay if needed; Part B mockups; C3–C8; TestFlight.

## Order
0. Part D: sound effects lost after a Continue ad (release-blocking bug).
1. Part C measurement scaffolding, then a device baseline.
2. Fixes C1, C2 and C9 (cheap, high value). Re-measure.
3. Part A (looks cheats and sections).
4. Part B mockups. **Stop for Paul's pick.** Then build the baked-banner refactor.
5. C3–C8. Re-measure, then do the FPS check with each look on.
6. Commit, then TestFlight (still pending from the 11-01 batch; it needs a build number higher than the 4.1.0 build that's in review).

## Verification
- `node --check`, `npm run prepare:web`, and eslint. The `m.volume` self-assign error is pre-existing and not ours.
- Headless:
  - Cheat panel sections render.
  - Each look applies after its unlock and persists through a reload.
  - The `#btnArcadeLook` cycle works.
  - Combo style mockup screenshots.
  - `check-bomb-stress.cjs` numbers before and after.
- Device (iPhone 14 Pro Max, wireless install):
  - Perf chip readings at L12/L15 with bomb chains, missile into a mine cluster, and a big net, before and after.
  - Combo awards during bomb chains: no visible stall.
  - Each look on, check FPS.
  - First-time combo voice plays without a hitch.

## C3–C8 session (build 2026-11-01 11:52, UNCOMMITTED, installed on iPhone)
- 4.1.1 (6) archive opened in Organizer for Paul to Distribute → TestFlight (CLI upload still fails).
- C3: `getTintedFxSheet` — (sheet, tint) baked once into a whole-sheet canvas (cap 16); `drawFxSheetFrame` tinted path = 1 drawImage.
- C4: already shipped in 81e1d50 (shrapnel = pooled ADD sprites).
- C5: `.galaxy-view.mode-arcade { will-change: transform }` + translate3d shake; ghost-check rects cached 250ms (`_hudRect`, resize bumps `_hudRectGen`).
- C6: `cssStatic` resizes only on viewport change; overlapping calls restart the one live loop (`_staticRun`).
- C7: `explodeMissile` queues caught landmine/placed bombs on `pendingExplosions` (any phase, as before) → MINE_CHAIN_PER_FRAME cap.
- C8: reused `_seen*` Sets in pixiRenderer syncs; `_pixiTint` reset in releaseParticle/releaseRing; dropped warp ring → releaseRing; ufoFx draw patch uses `arguments` (no rest array).
- Headless L12 (6 mines + missile + 3 bombs): no errors; desktop 60fps both before/after (not discriminating). NEXT: Paul device check perf chip L12/L15 (missile into mine cluster, bomb chains), watch tinted burst colours, HUD ghosting, shake feel. Then commit.
