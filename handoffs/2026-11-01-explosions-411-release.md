# Session handoff — 2026-11-01 — Explosion perf C3–C8, playtest fixes, 4.1.1 submitted to both stores

**BUILD_TS = "2026-11-01 12:35"** · branch: main · last commit `4d07af2`

## Summary
This session continued [2026-11-01-looks-combo-perf](2026-11-01-looks-combo-perf.md): explosion fixes C3–C8 first, then a live playtest with Paul (hub taps, Unlimited Quad toggle, L13 portrait, toss tip, scoreboard polish, a menu crackle investigation). It ended with **iOS 4.1.1 (9) submitted to App Review (Sun 11-01 12:46 PM)** and **Android 4.1.1 (39) submitted to Play production (full rollout)**. Paul is happy with the build. On device it shows L12 bombs and missile→mine chains at 60fps, worst frame 26ms.

## What was fixed

### Explosion perf C3–C8 (handoff Part C)
- **C3 tinted bursts:** `drawFxSheetFrame` used to round-trip every tinted burst through a scratch canvas on every frame. `getTintedFxSheet` (`script.js:14500`) now bakes each (sheet, tint) pair once into a whole-sheet canvas (LRU cap 16). (`a2aa34a`)
- **C4 shrapnel sprites:** already shipped in `81e1d50`.
- **C5 shake / layout reads:**
  - `.galaxy-view.mode-arcade { will-change: transform }` (style.css) plus a `translate3d` shake.
  - The stroid-behind-HUD ghost check caches element rects for 250ms (`_hudRect`, `script.js:23258`); resize bumps `_hudRectGen`. (`a2aa34a`)
- **C6 `cssStatic`** (`script.js:814`): resizes only when the viewport changed, and an overlapping call restarts the one live loop (`_staticRun`). (`a2aa34a`)
- **C7 missile→mines:** `explodeMissile` queues caught mines (any phase, same as before) on `pendingExplosions`, so the `MINE_CHAIN_PER_FRAME` cap applies. (`a2aa34a`)
- **C8 leftovers:**
  - pixiRenderer reuses `_seen*` Sets instead of allocating each frame.
  - `_pixiTint` is reset in `releaseParticle`/`releaseRing`.
  - Dropped warp rings go back through `releaseRing`.
  - The ufoFx draw patch uses `arguments` (no rest array). (`a2aa34a`)
- **Verified:**
  - Headless L12 stress (6 mines + missile + 3 bombs): no errors. Desktop runs 60fps both before and after, so it can't show a difference.
  - **Device (Paul's perf chip):** ev:bomb 60fps max 26ms, including the missile into a mine cluster; ev:combo 58fps max 44ms; the only >100ms hitch was level load.

### Hub card "just makes the bomb sound"
- **Symptom:** "settings is highlighted and centered, I'm tapping it, it's just making the bomb sound… like the card has to be completely static."
- **Root cause:** tap 2 also required `settled` (ring within 1° of its target). The spring's last-degree creep made a centered card count as moving, so tap 2 re-armed the card and replayed the select SFX (`smallblast`).
- **Fix:**
  - `wirePolyRing` click handler: drop the settled check; an armed front card opens.
  - Drag threshold raised from 6 to 12px, because thumb taps were turning into flicks ("tapped arcade and it spun the wheel"). (`a2aa34a`)
- **Verified:** Paul on device ("amazing").

### Unlimited Quad couldn't be turned off
- **Symptom:** "cannot turn off quad shot when it's infinite" (Dev Infinite Weapons, or the "Unlimited Quad Shot" cheat).
- **Root cause:** `cancelQuad` hard-returned for the cheat, and `updateTimedWeaponQueue` re-armed the quad every frame.
- **Fix:**
  - The badge now toggles `cheatQuadPaused` (`script.js:1640`, reset in `consumeArmedCheatsForRun`) and shows a dimmed **OFF** state (`.hudQuadBadge.active.off`).
  - `cheatQuadLive()` (`script.js:14801`) gates the re-arm and the ∞ label.
  - Also fixed: `classList.toggle(name, undefined)` *flips* the class instead of forcing it, so the badge flickered every frame when no quad cheat was active. Coerce with `!!`. (`a2aa34a`)
- **Verified:** headless ∞ → OFF → ∞; Paul on device.

### L13 start: CMDR's "I believe in you, cadet" showed the SPC portrait
- **Root cause:**
  - A CMDR line still talking when an SPC-host level starts (L13/14) got its portrait swapped mid-line by `setPortraitOverride`.
  - Separately, `showCmdrForLine` never redrew the `<img>`, so a bare `audioSrc` line kept SPC's image.
- **Fix:**
  - `setPortraitOverride` only installs SPC as host while a CMDR line is playing (tracked by `_curLineSpc`, `script.js:3604`).
  - `showCmdrForLine` (`script.js:3879`) calls `setFrame("idle")`. (`cc7f746`)
- **Verified:** not reproduced directly. The source of the orphaned line is unknown ("some orphan line" — Paul).

### Toss tip shown while the Pulse Cannon was armed
- **Fix:**
  - `tossGrabAllowed()` (`script.js:17429`) is the one rule, shared by the pointerdown grab gate and the `toss2` tip's `when()`.
  - New `stillValid` field: `tipTick` hides a tip whose action became impossible, without learning it, and lets it return later. (`4d07af2`)
- **Verified:** headless. Without a pulse the tip shows at about 3.5s; with a pulse picked up at 1.5s it waits until the cannon expires (about 11.5s).

### Polyverse Scoreboard polish (Paul request)
- **Changes:**
  - BACK/DONE is the teal primary button on the **left**, with arcade gloss and a star-orbit pseudo-element (`.leaderboardBtn--primary`, `script.js:9955`).
  - Game Center and Retry are compact and dim (`--secondary`), with a 22px gap so they aren't hit by accident.
  - Panel holo sweep, chrome gradient title, glassy rows, gold/silver/bronze top 3.
  - All motion is transform-only. (`4d07af2`)
- **Verified:** Paul approved the build. Only quick-checked on device.

### Menu chirp louder
- `sfxPicks.js` POLY_HUB_SFX: tick 0.15 → 0.2, open 0.6 → 0.8. (`a2aa34a`)

## Release status
- **iOS 4.1.1 (9)** (from `4d07af2`): in App Review, submitted 12:46 PM.
  - 4.1.0 (5) was removed from review (Developer Rejected), and the same ASC version record was renamed 4.1 → 4.1.1.
  - Notes for Review fixed. It previously held the store description.
  - TestFlight builds 6–9 uploaded. The Beta App Description was filled while adding build 9 to testing.
- **Android 4.1.1 (39)**: production full rollout, Play pre-review checks then review.
  - The "AD_ID missing" error was from an older active artifact (36 and 39 both carry `com.google.android.gms.permission.AD_ID`), so Paul chose **Release without permission**.
  - Bundles can't be deleted; old ones stop being "active" once replaced on their track.
- Release notes: `store-assets/release-notes-4.1.1.txt` (plain text; store-assets is gitignored). In-game `RELEASE_NOTES` version is "4.1.1".

## Still open / follow-ups
- **Audio audit (next session):** [2026-11-01-audio-audit](2026-11-01-audio-audit.md). Paul wants a professional balance and has heard a music crackle while cycling hub chirps **for days** (it predates 11-01). No blind volume tweaks.
- Find the source of the orphaned CMDR low-lives line at the L13 start (`retryCurrentLevel` queues it before `startLevel`, which is one candidate).
- Check the testing tracks in Play Console for a pre-AdMob build that's still active; replace it with 39 or pause the track.
- Duo "folded or unfolded" store line: still withheld until the unfolded inner screen is tested.
- The `?cockpitLab` start path doesn't consume run cheats. Headless cheat tests need `setDevModeOn(true)` first (a global function).

## Gotchas / learnings
- **Never add a master `DynamicsCompressor` on iOS without a device test.** A brickwall limiter (masterGain → compressor → destination) made **all menu SFX silent** on iPhone (builds 12:13/12:25). Removed in 12:27.
- **iOS music isn't in the Web Audio mix by default.** The music `<audio>` is routed through Web Audio only once a dial is below 100% or the mixer was opened this session (`_iosRouteAlways`). Otherwise iOS mixes it natively, outside the game's graph.
- `classList.toggle(cls, maybeUndefined)` flips the class each call. Always pass a real boolean.
- **Android CLI build:** Android Studio's bundled JBR is now **Java 25**, and Gradle 8.14.3 fails with "Unsupported class file major version 69". The workaround is a portable Temurin 21 tarball (adoptium API) used as `JAVA_HOME`. Gradle builds an **unsigned** AAB (no keystore.properties). Sign it in a real Terminal, because `!` can't take the password prompt:
  `jarsigner -sigalg SHA256withRSA -digestalg SHA-256 -keystore "~/Documents/google key store/polyoracle-release-key.jks" -signedjar X.aab X-unsigned.aab polyoracle`
  The alias is `polyoracle` (PKCS12, password ≥6 chars).
- **iOS upload:** CLI `-exportArchive` still fails. Archive from the CLI, copy the archive into `~/Library/Developer/Xcode/Archives/<date>/`, `open` it, and Paul clicks Distribute.
- **ASC:** while a version is Waiting for Review you can't swap its build. Remove it from review (instant, harmless), then edit the same record: version string plus build.
- **Paul's preference:** no release builds (archives/AABs) until he says it's solid; dev installs only while playtesting.
- This Mac's clock read ~11:5x–12:35 while the previous session's stamps said 14:05, so `BUILD_TS` values can go backwards across sessions.

## Pre-release reminders (CLAUDE.md)
- Device-verify the app-switch matrix, orb rub audio after app switching, and the plasma split.
- iPad 13" store screenshots are still pending.
- L12–15: gauntlet VO, L14/L15 music files, dualUfo, waves.
- Stunt Mode SPC VO items and tutorial device verify.
- Memory reminder: contact Apple about the Monkey Trubble review (was due 10-31).
