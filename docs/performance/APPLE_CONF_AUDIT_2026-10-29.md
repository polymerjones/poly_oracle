# Poly Oracle vs. Apple "Boost your app's speed and efficiency" — audit, October 29, 2026

Source notes: `apple dev conference notes 10-29-26/`. Baseline context: `AUDIT_2026-10-25.md` (PERF-01…04).
Toolchain at audit time: **Xcode 27.1 (27A9275), iOS 27.1 SDK**; simulators installed only for iOS 26.2/26.5.

Poly Oracle is a Capacitor 8.1 WKWebView game. JS has no call stacks in Instruments (interpreted), and there
is no SwiftUI, so the talks map onto it as below. Desk audit only — nothing in code was changed.

## 🚨 Release blocker found: scene lifecycle is required on the iOS 27 SDK

Apple's exported `app-resizability` skill (`xcrun agent skills export`, `references/scene-lifecycle-task.md`):

> **As of iOS 27, scene lifecycle is required.** Apps built against the iOS 27 SDK that haven't adopted it crash at launch.

Poly Oracle has **not** adopted it:
- `ios/App/App/Info.plist` has no `UIApplicationSceneManifest`; there is no `SceneDelegate`.
- `ios/App/App/AppDelegate.swift` owns `var window` plus app-level lifecycle (`applicationDidBecomeActive` → `reactivateAudioSession()`, the orb-rub audio fix).
- `@capacitor/ios` is **8.1.0**, which has no scene support. **8.6.0** (npm `latest`, published 2026-10-29) adds `CAPSceneDelegateProxy` and scene-based `resume`/`pause` JS events.

Exposure:
- Build **5** (4.1.0, in review) was archived with Xcode 26.6 / `iphoneos26.5` (`DTSDKName` in the archive) → **not affected**.
- Build **6** (eb9338d, the 4.1.0 resubmit / 4.1.1) is **not archived yet**. Archiving it on this Mac now links iOS 27.1 → expected to crash at launch on iOS 27 devices.
- Not yet reproduced: there is no iOS 27 simulator runtime installed. Verify with `xcodebuild -downloadPlatform iOS` + a simulator launch, or a device install once the phone is updated.

**Status 2026-10-29 (same day): migrated, uncommitted.** `@capacitor/core|cli|ios` → 8.6.0 (android left on 8.1
so the submitted Play build is untouched), new `ios/App/App/SceneDelegate.swift` (storyboard-driven via
`UISceneStoryboardFile`, forwards to `SceneDelegateProxy`, `sceneDidBecomeActive` → `reactivateAudioSession`),
`UIApplicationSceneManifest` in Info.plist, `configurationForConnecting` in AppDelegate. Built against iOS 27.1 SDK
(`BUILD SUCCEEDED`), launched + background/foreground round-trip on the iOS 26.5 simulator. Device app-switch matrix still to do.

Original fix plan:
1. Bump all `@capacitor/*` to 8.6.x; `npx cap sync ios` from root.
2. Add the `UIApplicationSceneManifest` (single scene, `SceneDelegate`, Main storyboard) and a `SceneDelegate` that forwards to `SceneDelegateProxy.shared` (open URL / user activity).
3. Move `reactivateAudioSession()` from `applicationDidBecomeActive` to `sceneDidBecomeActive`; keep the interruption observer.
4. Re-run the app-switch matrix (`docs/app-switch-audit.md`): Capacitor's `pause`/`resume` now come from scene notifications.
5. Keep `UIRequiresFullScreen` untouched (the skill says: never delete it, never add `UIRequiresFullScreenIgnoredStartingWithVersion` without a decision). Note: **iOS 27 ignores it and resizes the scene anyway** (TN3192), which leads to the next item.

## Item-by-item

| # | Talk item | Status | Evidence / note |
|---|---|---|---|
| 1 | Export Xcode 27 skills into Claude Code | ✅ done (scratchpad) | `xcrun agent skills export <dir>` → 10 skills. Relevant: `app-resizability`, `modernize-tests`, `device-interaction`. There is **no performance/xctrace skill** in 27.1. Xcode MCP: `xcrun mcpbridge` (not wired yet). Decide whether to copy the 3 skills into `.claude/skills/`. |
| 2 | `xctrace triage` / `show` for agents | ⚠️ unavailable | `xcrun xctrace help` on 27.1 lists only record/import/export/remodel/symbolicate/list/version. Likely a newer Xcode; keep using `record` + `export` (the 10-25 workflow). The memory note "xctrace blocked iOS 27.2 / Xcode 26.6" should clear once the device pairs with 27.1. |
| 3 | Frame rate = biggest power lever | ✅ mostly | Already throttled: logo idle 30 fps (`script.js:2061`), menu galaxy 30 fps (`script.js:25581`), poly ring stops when settled or hidden (`script.js:8970`, `8985`), oracleOrb stops when hidden (`oracleOrb.js:433`), game loop capped ~60 (`script.js:23915`). ⚠️ **oracleOrb renders every frame at full rate while visible** (`oracleOrb.js:428`), which is a candidate for the 30 fps gate. ⚠️ The game loop keeps waking rAF every frame while slot/scorecard idle (`script.js:23905`); this is cheap but still a wake per frame. No `CADisableMinimumFrameDurationOnPhone` in Info.plist → WKWebView should be ≤60 Hz; confirm on the device. |
| 4 | Compositor Fast Path (video) | ⚠️ check on device | The 10-25 orb-idle numbers show **backboardd ≈48% CPU** and thermal "Serious", which is compositor work, exactly what Fast Path colors diagnose. Videos already follow the 720p H.264 guardrail. Check orb bg video, menu videos and boss bg with Compositor debug colors (blue = good, red = missing). |
| 5 | Power Profiler | ⚠️ not done | Use the on-device Performance Trace → Power Profiler during a 10-minute normal session (Phase B). |
| 6 | Hangs + signposts | ⚠️ gap | No `performance.mark/measure` in script.js. Proposal: marks around boot, `startLevel`, `warmGameplaySprites`/`warmTrainingAssets`, slot spin, scorecard, so they appear in Safari Web Inspector Timelines. Optional native `PerfSignpost` Capacitor plugin (pattern: `GameCenterPlugin.swift`) for OSSignposter + StateReporting game state in Instruments/MetricKit. The Dev perf recorder (`script.js:21505`) already buckets hitches per tutorial phase, which is the in-game analog. |
| 7 | MetricKit / Organizer | ⚠️ gap | No `MXMetricManager` in AppDelegate. Step 1 (zero code): Xcode Organizer + App Store Connect API metrics for 4.1 once usage accrues. Step 2 (optional): a MetricKit subscriber writing payloads to Caches, readable from the Dev menu. |
| 8 | Third-party SDK cost (AdMob) | ✅ low risk | Rewarded-only, full-screen, SDK-presented. `init()` runs lazily on the first `adService.preload()` from menus/breaks (`script.js:14996`, `18916`, `21869`), not during the boot path. Add a launch-time baseline before/after SDK bumps (item 10). |
| 9 | iPhone Duo / resizability | 🚨 see blocker | Beyond scenes: iOS 27 ignores `UIRequiresFullScreen` (`Info.plist:54`), so the web layout must survive arbitrary window sizes and aspect ratios. Swift code has no `UIScreen.main`/idiom/orientation use. JS uses portrait lock (`script.js:132`), `orientationchange` relayouts (`5822`, `25071`) and `cockpitTabletScale` (`10172`). Test by resizing in an iPad Stage Manager / iOS 27 simulator. |
| 10 | XCTest launch/hitch metrics | ⚠️ gap | No UI-test target in the pbxproj. Scope: add `AppUITests` with `XCTApplicationLaunchMetric` (+ `XCTHitchMetric` for a scripted menu scroll) with baselines; real device only (the simulator can't record hitches). Skill: `modernize-tests`. |
| 11 | Storage in Caches/tmp | ✅ N/A | No Filesystem plugin; data is localStorage and bundled assets. |
| 12 | SwiftUI Equatable / SwiftUI instrument | N/A | No SwiftUI. |
| 13 | dSYM / GPU frame capture | N/A | JS is interpreted (use Web Inspector JS profiler); WebKit GPU process is not our Metal (use Web Inspector canvas recording if needed). |
| 14 | Android | pointer | Perfetto / Android Studio Profiler (see `ANDROID_2026-10-27.md`). |

## Ranked fix list

1. **Scene lifecycle + Capacitor 8.6** (blocker). Do it before archiving build 6. Xcode 26.6 is no longer installed (only /Applications/Xcode.app = 27.1), so there is no quick fallback toolchain.
2. **Resizability check** on an iOS 27 simulator (window resize, Stage Manager) once scenes land.
3. **Device pass (Phase B)**: Release build → Time Profiler + Hangs; Power Profiler session; Compositor colors on orb/menu/boss videos; confirm the rAF rate on ProMotion. Save as `ios-perf05-*.json`.
4. **oracleOrb 30 fps gate** (reuse the `idleLastDraw` pattern from `script.js:2061`). Only if Phase B shows orb idle still costs.
5. **`performance.mark` signposts** around level load and warmups.
6. **Launch-time XCTest** + Organizer/ASC metrics review; MetricKit later.
