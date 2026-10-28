# Session handoff — 2026-10-28 — Google Play 4.1.0 submitted · Polyverse Mixer · iOS audio fixes

**BUILD_TS = "2026-10-28 09:30"**  ·  branch: main  ·  HEAD `68a567a` (all pushed)

## Summary
Spanned 10-27 and 10-28. **Google Play 4.1.0 (versionCode 36) was built, signed and SUBMITTED for review** (10:15, 10-28).
That included Play store art and copy and the AdMob App-content declarations. Paul reported a production bug: on iOS, the Settings
volume dials did nothing. It's fixed, then the dials were redesigned as the **Polyverse Mixer**: vertical faders with LED ladders.
That took several rounds of iOS audio fixes (lag, quiet at 100%, flaky audition). The last round fixed an orb-tap delay and pops,
a regression caused by the volume fix itself. iOS 4.1.0(5) was already in Apple review, so all the iOS fixes need a **resubmit**.

## What was fixed

### Android 4.1.0 release prep
- **Version:** `android/app/build.gradle` versionCode 35→36, versionName 3.3.2→4.1.0 (commit `9a54317`).
- **Store Shots lab Play profiles** (`9a54317`): `play_phone` 1080×1920, `play_tab7` 1224×2176, `play_tab10` 1620×2880, all 9:16.
  Added in `tools/capture-store-shots.cjs`, `tools/reactbits-lab/vite.config.js` (`SHOT_PROFILES`), `tools/reactbits-lab/src/StoreShots.jsx`
  and `tools/store-shots.json` (8 slots each; Play allows max 8, so the pulse shot was dropped).
- **Play console recommendation, "remove orientation restrictions":** `android:appCategory="game"` in `AndroidManifest.xml` (`e61d0c8`).
  Android 16 ignores the portrait lock on large screens unless the app is a game. The supported-device count was unchanged (12,542 phones / 6,830 tablets).
- **Upload folder `store-assets/googleplay/`** (gitignored): `phone/ tab7/ tab10/` 01–08.png, `icon-512.png`, `feature-graphic-1024x500.png`,
  `listing-play-4.1.txt` (Play copy: Game Center swapped for "Chase the Polyverse High Score", plus a Mixer line), and the unsigned AAB.
- **Feature graphic:** built from `store-assets/appstore/header_5244x2950.png`. Crop `top:190 h:2560` (full width) → lanczos3 to 1024×500 →
  `sharpen({sigma:.6})`. The bottom tagline and byline were erased with a median(23)+blur patch and **re-rendered natively** with SVG in DIN Alternate.
  The byline is bold, 14px, white, with a glow. The script lives only in scratchpad (`fg_text.cjs`); recreate it from this description if needed.
- **Signed AAB:** Android Studio → *Build → Generate Signed App Bundle* (not "Build APK", which makes a debug APK).
  The passwords are **remembered by Android Studio** (alias `polyoracle`). Output is `android/app/release/app-release.aab`.
  It was verified as `jar verified`, with the same cert as previous releases (SHA-256 `45:32:AC:99…52:19`), build 09:30.
- **Play Console App content was updated for AdMob:** Advertising ID = yes (Advertising, Analytics, Fraud prevention). Data safety:
  approximate location, crash logs, diagnostics, other performance data and device IDs, all collected + shared, required, for those
  3 purposes, encrypted in transit. **Ads = Yes** (it was still "No" from July!). The AI asset declaration labels assets as AI-assisted.
- **Verified:** Play pre-checks passed, apart from the R8 deobfuscation warning (harmless, since minify is off). Submitted 10 changes.

### iOS: Settings MUSIC/SFX dials did nothing
- **Symptom (Paul, 10-28):** "the music and sfx volume dials do not work, Settings sound volumes don't work".
- **Root cause:** iOS WebKit ignores `HTMLMediaElement.volume`, and the iOS app plays all music (`loadMusicBuffer` returns null on iOS)
  plus every SFX that hasn't been decoded as an `<audio>` element. The dials only drove Web Audio buses that iOS barely used.
  Android/web were fine: they use buffers via `sfxBus`/`musicBus`.
- **Fix (final shape, after `d4ba446` → `68a567a`):**
  - **Music:** `iosRouteElement` (`script.js:4657`) puts the element through `createMediaElementSource → gain → destination`.
    `setElementLevel` (`script.js:4679`) writes the gain, and only writes element volume/muted when they change.
    Routing kicks in once a dial is below 100% **or** the mixer has been opened (`_iosRouteAlways`), because mixing the two paths made 100% sound quieter.
    One routed music element is **reused across tracks** (`script.js:5247`, `_iosMusicSpare`), because MediaElementSource nodes never free.
    `rebuildContext` (`script.js:4824`) swaps in a fresh element when an app switch rebuilds the ctx.
  - **SFX:** these are **NOT routed** (see the orb bug below). Below 100%, `audioEngine.play()` calls `warmSound(name)` (`script.js:4875`).
    That decodes the sound in the background, so its later plays take the buffer path via `sfxBus`. A dial at 0 skips SFX.
- **Verified:** simulated iOS (a scratch copy of www with `isIOSNative = true` in headless Chrome) and the Android-UA path.
  Paul confirmed "it works" on the device for the dials, but the final audio routing is **not yet device-verified**.

### Polyverse Mixer (replaces the range sliders)
- **Symptom:** "the dials are very difficult to tap and drag".
- **Fix:** `openStroidsSettings` / `syncStroidsSettings` / `setStroidsVolume` (`script.js:2410-2560`), CSS `.mix*` (`style.css:3713+`).
  - Two vertical fader strips with 12-LED stereo ladders in theme **blue → teal → purple** (Paul vetoed green/yellow/red).
  - LCD readout, and MUTE in the CONTINUE-button gradient. MUTED shows the same button pressed and glowing; tapping again restores the last level.
  - The whole strip is the pointer target, with a haptic tick every 10%. Pointermoves coalesce per rAF.
  - The cap and fill move by transform (`--travel` px measured on open). LEDs only touch the DOM when the lit count changes, and the setting saves on release.
  - Commits: `a1feb9b`, `1754653`, `44e5f69`, `1077590`, `8bc93c7`.
- **SFX audition:** `playMixerPreviewSound` (`script.js:2385`) plays the **main-weapon laser** (`sfxTrial("sfxLaser","advfire")`, Paul's pick) as a buffer through `sfxBus`.
  It cuts the previous shot, plays once per 10% line while dragging, and **always on release**. That fixed "sometimes nothing plays" (taps inside one band) and "quieter at the top".
- **Verified:** headless drag, mute and audition tests. On device, Paul said "marvelous, mixer complete".

### iOS: orb tap delayed + static pops (regression from the volume fix)
- **Symptom (Paul):** "tapping orb is sort of delayed and static pops".
- **Root cause:** `playHtmlAudio` was routing pooled SFX elements through MediaElementSource. On iOS that adds start latency and clicks on rapid `currentTime=0` restarts.
  Orb taps (`orb_tap`) are never preloaded on iOS, so they always took this path.
- **Fix:** `68a567a`: SFX elements are plain again (exactly the pre-mixer path), plus the lazy buffer warm described above.
- **Verified:** simulated iOS only (first tap on HTML, then buffer, 0 routed SFX elements). **Needs a device check.**

## Still open / follow-ups
- **Device-verify on iPhone:** orb taps (no pops) with SFX below 100%; the mixer's feel; **an app switch mid-level with a dial below 100%**
  (routed music must come back after TAP TO RESUME, via the rebuildContext swap).
- **iOS resubmit:** 4.1.0(5) in Apple review predates the volume fix, the mixer and the orb fix. Bump the build number in Xcode, archive and upload.
- **Play review:** submitted 10-28 10:15. Watch for policy emails. Managed publishing is off, so it auto-publishes on approval.
- **Edge-to-edge (Android 15+):** the API 36 AVD reports `env(safe-area-inset-bottom)` = 24px and `--sab` picks it up, and the Oracle page clears the gesture bar.
  **Hub and in-game HUD were not checked**: the emulator WebView stalled with `-gpu host`. Check a level on the Retroid or another Android 15+ device.
- **Android tablets:** the Play tablet screenshots show a small, unscaled HUD. `cockpitTabletScale` may be iPad-only, so check on a real Android tablet.
- Known minor gap: on iOS, an SFX's first play below 100% (until its decode lands) is at full volume. Sounds played via `preservePitch` (HTML-only) ignore the dial on iOS.
- Mixer does not affect the Oracle-page sounds (reveal, orb tap via `revealAudio`/`orbTapAudio`); Paul agreed this is correct.
- `assets/store/google-play-app-icon.png` was regenerated (v5). The old `tools/build-google-play-feature-graphic.js` design is pre-remaster, so don't use it.

## Gotchas / learnings
- **iOS ignores `<audio>.volume`**: only `muted` works. Volume needs Web Audio. But **don't route short, rapidly-retriggered SFX through
  MediaElementSource on iOS** (latency + pops). Use decoded buffers instead. Routing is fine for one long-lived music element.
- MediaElementSource can never be re-bound, and nodes are never GC'd. Reuse elements, and replace them after a ctx rebuild (they go silent forever).
- On iOS, writing `muted`/`volume` on media elements is costly (media-process IPC). Never write them per frame.
- The plain `<audio>` path and the Web Audio path differ in loudness on iOS. Keep a given sound on one path for the whole session.
- A preview that only fires on 10% boundary crossings feels broken. Always audition on release.
- **Play rejects alpha** in screenshots and the feature graphic. The Lab exports RGBA, so flatten it. The feature graphic is fixed at 1024×500 and looks soft on Retina at 2×.
  Fill the frame from the largest master and sharpen; don't letterbox.
- Play App content: adding AdMob means updating **Ads, Advertising ID and Data safety**. Only the Advertising ID one blocks submission;
  the other two silently stay stale (Ads still said "No").
- Android Studio "Build APK(s)" ≠ "Generate Signed App Bundle". The signing passwords live only in Android Studio's remembered credentials.
  There's no password file in the repo or in `~/Documents/google key store/`. If it's ever lost, use a Play App Signing upload-key reset.
- The alias can be read from a signed AAB: `META-INF/POLYORAC.RSA` (truncated to 8 characters) → alias `polyoracle`.
- The emulator is unreliable here: `-gpu host` stalls the WebView after navigation, and reloading with a query string (`?cockpitLab=1`) blanks the Capacitor WebView.
  CDP recipe: `adb forward tcp:9333 localabstract:webview_devtools_remote_$(pidof)` + node WebSocket `Runtime.evaluate`.
- Simulated-iOS headless testing: copy `www/`, then `sed` `const isIOSNative = isCapacitorNative && isIOSWebKit;` → `= true`, and serve.

## Pre-release reminders (carry forward)
- iOS resubmit (above). ASC leaderboard `polyverse_high_score` → attach to the next version's Game Center section.
- CLAUDE.md v-next blockers still open: device-verify the app-switch matrix (`docs/app-switch-audit.md`), orb rub audio after an app switch,
  plasma split; nice-to-have orb "leave reality" lock in background; App Store iPad 13" screenshots.
- Levels 12-15: `gauntlet_intro` VO, L14/L15 music files, `dualUfo` + `waves` wiring. Stunt Mode VO items per CLAUDE.md.

