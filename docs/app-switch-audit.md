# App-switch audit (2026-10-26)

"Switch" = any of: Home / app switcher (page hidden), Control Center / notification pull-down /
call banner / Siri (iOS *inactive* — page NOT hidden; caught via Capacitor `appStateChange`), a
full-screen ad. Device test script: do each row on iPhone + Retroid (Android).

## Lifecycle wiring (script.js)
| Hook | What |
|---|---|
| `onGameHide` / `onGameShow` (galaxy closure) | single idempotent pair, fired by `visibilitychange` + Capacitor `appStateChange` (skipped while an ad is showing) |
| `resumeAudioOnGesture` (capture phase) | rebuilds a dead AudioContext on *every* gesture while audio is unhealthy (was one-shot) |
| `audioEngine._resumeWithTimeout` | every `ctx.resume()` raced vs 600ms — iOS "interrupted" ctx used to hang `verifyAlive` forever |
| `audioEngine.onRebuild` | orb drone / grain looper drop nodes bound to the old ctx |
| `AppDelegate.swift` | re-activates the AVAudioSession on interruption end + `didBecomeActive` |
| `oracleOrb.js` | WebGL context loss → remount in place |

## Expected behaviour per screen
| Screen | On hide | On return |
|---|---|---|
| Live level (Arcade) | loop stops, every clock frozen (`_frozenAt`) | frozen field + **PAUSED / TAP TO RESUME**; tap shifts all deadlines (`shiftGameplayClock`) by the whole away+overlay span |
| Practice | same as Arcade (+ practice cadences shifted) | TAP TO RESUME |
| Stunt training | `pauseTutorial` (TRAINING PAUSED overlay) | stays paused; training countdown no longer drains while paused |
| YOU WIN celebration | hand-off timer is cleared by teardown | jumps straight to the hand-off (was a soft-lock on YOU WIN) |
| Scorecard | write-on loop dies | tally completes instantly, waits for tap |
| Poly Slot (between levels / mid-level) | `slotPauseForBackground` | `slotResumeFromBackground`; spin loop restarted if reels were spinning |
| Menu / Polyverse / Level Select / pause menu | loop stops | loop + starfield restarted (menu used to stay frozen/blank) |
| Music (all screens) | dimmed to 10% | restored to its own pre-hide level (keeps scorecard/pause/whisper ducks) |
| Commander/SPC VO | stopped (no VO in the background) | — |
| Oracle orb rub | held rub cancelled (no pointerup will come) | first/second tap rebuilds audio if dead — no reboot needed |
| Orb reality lock | **keeps playing** (HTML `<audio loop>`) | still playing; tap orb / leave Oracle to stop |
| Ads | own hooks (suspend ctx, pause music) | + `verifyAlive` health check after close |

## Known / not covered
- Reveal FX video and native TTS aren't explicitly paused on hide (WKWebView pauses media itself).
- Android: whether the WebView keeps the reality-lock `<audio>` playing while the activity is
  paused is unverified — check on the Retroid.
- Reward chest open animation isn't fast-forwarded on return (timers just resume).
