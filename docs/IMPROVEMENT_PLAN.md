# Poly Oracle Remaster

Started: October 25, 2026  
Status: Working draft — discovery and decisions before implementation

## Goals

1. Make Poly Oracle free on iOS and Google Play, integrate Paul's AdMob account with new ad units, and introduce a rewarding optional-ad system.
2. Reduce CPU usage, battery drain, and heat while preserving responsive gameplay and the game's visual identity.
3. Fix the specific gameplay problems Paul has wanted resolved since release.

Platforms in scope: iOS, Android, and polyoracle.app. The website's role in the monetization rollout remains to be decided.

## Decisions already made

- Both mobile versions should become free.
- AdMob integration should use new ad units.
- A reward incentive system is part of the intended update.
- The Monkey Trubble diagnostics should inform the performance investigation.
- Keep the Poly Oracle orb page as the preferred opening screen; make entry into Stroids unmistakable. Opening directly to Stroids remains an alternative, not the selected direction.
- Add announcements inspired by Monkey Trubble.
- Add a player-facing Cheat Codes menu with enhancements earned through multiple rewarded ads (the requested “ad pod” concept; implementation feasibility still needs verification).
- Add a separate automatic reward box every other level, with increased rewards for combos.
- Require player input to start the next level; an idle player must remain on the end-level screen.
- Add a hidden developer-mode entry through three taps on the Stroids menu logo.
- Older repository TODOs are supporting evidence, not automatically the priorities.

## 1. Free app, ads, and rewards

### Decisions to make

- Cheat unlocks are a requested rewarded-ad placement. Decide whether any additional placements are wanted. The every-other-level automatic reward box is a separate gameplay reward, with no ad requirement specified.
- What does each reward grant, when can it be claimed, and what limits keep the game balanced?
- Are rewarded ads the only format, or are other placements wanted?
- How should existing paying players be treated? Decide whether they receive a benefit and how eligibility can reliably be established on each platform.
- Should the website offer the same rewards, an alternative earning path, or a separate experience?

### Planned work

- Inventory existing monetization and native configuration; the current package manifest has no AdMob dependency.
- Define the reward rules and placement in the actual game flow before choosing SDK integration details.
- Configure distinct app registrations and ad units for iOS and Android; document placement names and environments.
- Implement ad loading, availability, presentation, dismissal, and reward delivery as explicit states.
- Grant the reward only on confirmed completion; prevent duplicate grants from repeated callbacks.
- Handle no connection, unavailable ads, cancellation, load failure, app interruption, and relaunch without corrupting progress.
- Verify current store, SDK, consent, privacy, and audience requirements against official documentation before implementation and submission.
- Update store pricing, descriptions, privacy disclosures, and review notes alongside the release.

### Acceptance criteria

- Both stores offer the app free after the planned pricing change.
- Every reward offer clearly states the benefit before the player chooses to watch.
- A completed rewarded ad grants exactly the promised benefit once.
- Unavailable or interrupted ads leave the game in a usable state.
- Audio, gameplay, and rendering pause and resume correctly around ad presentation.
- Test ads are used during development; production configuration is verified before release.

## 2. Performance and battery

Initial measurements and first optimization are recorded in [the October 25 audit](performance/AUDIT_2026-10-25.md). Initial gameplay/thermal, post-gameplay-menu, slot idle, and slot interaction traces are captured. A longer controlled thermal test and device before/after validation remain outstanding. Local fixes cover hidden warm-up animation, logo buffer resizing, duplicate PIXI stage rendering, and stopped slot-reel repainting.

### Bring forward the Monkey Trubble findings

Read-only reference repository: `/Users/paulfisher/monkeytrubble`. Reviewed its README, `source/notes/perf-audit-2026-10-24.md`, and relevant implementations in `web/index.html` on October 25, 2026. No files in Monkey Trubble were changed.

The audit records an iPhone 14 Pro Max Debug-build investigation using Instruments across WebContent, GPU, app, and compositor processes, supplemented by browser measurements. These are recorded Monkey Trubble results, not independently reproduced results or Poly Oracle targets:

| Finding / change | Recorded result | Poly Oracle investigation |
| --- | --- | --- |
| Hidden loading screen left an invisible shimmer running; remove it after launch | Home web CPU about 13% → 2% in the late round; start-of-day value was about 32% | Inspect startup/loading elements and animations even when visually hidden, including the blue startup flash |
| Paused CSS animations still retained compositor work; freeze visual values, remove animations, restore on interaction | Home compositor CPU about 48% → 6%; final app CPU about 1% | Measure compositor cost as well as JS; test actual removal versus pause on Poly Oracle's devices |
| Large masked/rotating layers replaced with smaller pre-rendered art; hidden scenes removed from rendering | Earlier test crashed near 1.55 GB; late test timeline peaked at 778 MB for POLY and 704 MB for streak, ending at 476 MB | Audit large effects, filters, masks, device-pixel-ratio costs, and hidden mode layers; do not assume a JS heap leak explains all memory growth |
| Shared scenery clock, idle rest, gated timers, resting lightbox effects | Earlier intermediate home CPU 32% → 12.7%, before later loader/compositor fixes | Inspect independent canvas/PIXI/DOM loops and stop inactive work; reserve full-rate updates for gameplay that needs them |
| Audio decoded on demand | Launch decoded audio 72 → 39 MB | Inventory startup audio decode and preload needs; protect Reveal timing and smooth first-use playback |
| Ad recovery left working audio alone and restarted only a stalled engine once | Audit reports ad-related stutter fixed | Exercise Reveal and ad audio recovery without unconditional engine restarts |

Do not add percentage reductions across rounds: measurements are from different stages and scenarios. The audit's early proposed ~400 MB target was not its final home measurement. Its reported memory limit belongs to that particular device/test, not all iOS devices. Verify changes on Android and web independently.

Reference method to adapt: record repeatable scenes with Activity Monitor, Hitches, and Thermal State across processes; use Time Profiler and animation-name inspection to locate idle work. CPU is a proxy for energy here, not a direct battery-life measurement. Compare Release builds as well as diagnostic builds.

The native lifecycle fixes are references, not code to copy directly: Monkey Trubble uses custom Swift/Kotlin WebViews, while Poly Oracle uses Capacitor.

### Establish a repeatable baseline

Use physical iOS and Android devices, with device model, OS, build, brightness, sound, session duration, and thermal starting conditions recorded. Compare the same scenarios before and after each change:

| Scenario | What to inspect |
| --- | --- |
| Title/menu left idle | Animation loops, background effects, timers, audio activity |
| Normal gameplay | CPU, GPU/frame timing, frame pacing, memory |
| Heavy combat/effects | Spikes, particle counts, allocations, responsiveness |
| Paused game and overlays | Work that continues unnecessarily |
| App backgrounded, then resumed | Rendering/audio suspension and safe recovery |
| Repeated mode changes and restarts | Growing listener, timer, memory, or resource counts |
| Rewarded ad shown, then dismissed | Resource contention and lifecycle recovery |

Record CPU usage, frame timing, memory, energy/thermal indicators, and battery change over a fixed-duration session where practical. Keep profiling captures and a simple before/after table. Set numerical targets after establishing the baseline; no improvement percentage is assumed yet.

### Performance strategy — decided October 25, 2026

Paul's direction: make graphics and gameplay as inexpensive as possible, and make it look better at the same time. The first device results support this. The big costs so far have been invisible work, not visible effects: the whole game rendering behind the slot cabinet (WebKit GPU process 103% → 2.8% when stopped), and the level starfield repainting behind the paused menu (about 50,000 canvas operations a second). Four plausible-looking fixes moved nothing on the phone; the one real culprit moved everything.

Principles:

- **Stop drawing what isn't visible.** Every overlay, pause, and transition must stop or freeze what it covers.
- **Pre-render instead of computing every frame.** Bake glows, nebulae, star layers, and shimmer into sprites, cached canvases, or short loops. This was Monkey Trubble's biggest win, and baked art can look richer than per-frame canvas effects.
- **Pay for resolution only where the eye notices.** Soft backgrounds, glows, and blurs render at 1× or lower and scale up; keep full device resolution for text, HUD, and sharp asteroid edges.
- **One renderer per screen, not stacked layers.** Video + 2D canvas + PIXI + CSS effects stacked at 3× is the likely reason the system compositor sits at 25–50% even on the orb screen. Fold effects into one PIXI/WebGL pass where possible; that also makes the React Bits laser/tunnel looks affordable.
- **An idle policy everywhere.** Screens that aren't changing drop to a low frame rate or stop.

Order:

1. Finish the hidden-work sweep: slot underlay (done, PERF-02), paused menu (fixed, PERF-03, device check pending), then any other overlays and transitions.
2. Gameplay cost: starfield per-star drawing first, then draw-call and particle counts with an effects budget; rebuild the laser/beam look on the GPU.
3. Measure the orb and menu one layer at a time (video off, canvas off, CSS off) to find what drives the compositor, and redesign from that.
4. Then the visual upgrade (orb, laser, transitions), with each effect profiled on the phone before adoption.

Discipline: measure every change on the phone against the same scene, starting cool where possible, and record it in `docs/performance/AUDIT_2026-10-25.md`. A browser regression check (`tools/perf/`) accompanies each fix.

### Investigation areas from the current source

- `script.js` contains multiple animation loops, intervals, and visibility handlers across game modes.
- `galaxyBackground.js` has its own animation loop and timer activity.
- `pixiRenderer.js` is another rendering area to inspect alongside canvas and DOM effects.
- Existing visibility and suspension logic should be reviewed and measured before adding another lifecycle mechanism.
- Inspect hidden-screen rendering, duplicate loops, particle/effect cost, per-frame allocations, audio/video lifetimes, and cleanup after mode changes.

These are investigation leads, not confirmed performance defects.

### Acceptance criteria

- Repeatable before/after evidence on both mobile platforms.
- Measurable reduction in the targeted resource cost without material gameplay or visual regressions.
- Unneeded rendering and audio work stops when the relevant screen or app is inactive.
- Resume, restart, mode switching, and ad presentation remain reliable.

## 3. Gameplay improvements

The following captures Paul's remaster brief and attached iOS screenshot. Acceptance criteria describe intended outcomes; causes and technical solutions remain to be investigated. Priority labels below are proposed sequencing, not final rankings.

### Opening screen, branding, and menus

| ID | Request / reported problem | Intended outcome and acceptance criteria |
| --- | --- | --- |
| UX-01 | Circular asteroid does not clearly communicate that it opens the game | Keep the orb page as the preferred opener. Explore a prominent asteroid treatment with an explicit “Play Stroids” label and game identity. A first-time player can locate and enter the game without being told what the asteroid means. Review the alternative of opening directly to Stroids only if needed. |
| UX-02 | Add announcements like Monkey Trubble | Provide an accessible announcements page and release notes. Inspect Monkey Trubble before deciding layout, access point, update mechanism, or whether announcements ever appear at launch. |
| UX-03 | Poly Oracle title does not match its branding | Match title lettering and styling to the actual app-icon branding. Obtain/inspect the source branding asset; the supplied screenshot documents the current page, not the target lettering. |
| UX-04 | Orb page and settings feel too much like a generic HTML interface | Develop a coherent game-like visual treatment for panels, typography, controls, and settings. Include release notes and agree which additional settings are useful. Preserve legibility, touch targets, safe areas, and reduced-motion behavior. |
| UX-05 | Stroids menu needs clearer connection to Poly Oracle and creator credit | Add a Poly Oracle graphic near the Stroids logo. Add “A game by Polymer Jones” or “Developed by Polymer Jones” below the logo, matching the intent of Monkey Trubble's byline. Final wording and artwork remain open. |
| UX-06 | Retry and other game buttons look too much like HTML | Establish shared button styles and states across Retry, Continue, menus, rewards, and cheats. Review a small visual prototype before applying throughout the game. |

Screenshot reference: Paul's supplied “Poly Oracle.png” shows the current orb page, plain title treatment, icon controls, Reveal button, and answer panel. Preserve a durable copy in project design references before implementation if needed; the attachment's temporary Notes path is not a permanent project asset.

### Reported bugs and performance scenarios

| ID | Report | Reproduction / acceptance criteria |
| --- | --- | --- |
| FIX-01 | iOS startup briefly shows a blank blue background | Cold-launch and warm-launch on iOS; identify which launch/loading layer produces the flash. Transition into the intended background without an unintended blue screen. |
| FIX-02 | Pressing Reveal cuts off the orb sound sequence on iOS | Reproduce with sound enabled and record the intended sound timing. Reveal preserves the agreed sequence without unintended truncation or overlapping playback. |
| PERF-01 | Small frame hang when Stroids starts | Capture the transition into gameplay and first active frames. Remove the measured startup stall while preserving correct level initialization and input readiness. |
| PERF-02 | iPhone becomes hot after about ten minutes | Profile a repeatable ten-minute session and longer follow-up as needed. Compare CPU, GPU/frame timing, energy, memory, and thermal behavior before/after; report measured improvements. |
| PERF-03 | Check CPU when switching to menu and back to Poly Oracle | Measure gameplay → Stroids menu → orb page, repeated several times and then left idle. Confirm inactive modes stop unnecessary work and resource usage does not accumulate. |
| PERF-04 | Slot machine feels sluggish when pulling the lever | Profile input-to-animation latency and reel animation. Improve measured responsiveness and frame pacing; verify repeated pulls and entry/exit. |
| FIX-03 | Screen dims on the slot-machine level | Establish whether this is an in-game overlay, OS inactivity dimming, or thermal/display behavior. Resolve the identified cause; verify idle/active slot play and restoration of normal device behavior on exit. |

The full performance audit covers iOS, Android, and web, including idle CPU and transitions. The reported heat and sluggishness are symptoms, not yet attributed to a particular loop or renderer.

### Gameplay pacing and rewards

| ID | Request | Intended outcome and acceptance criteria |
| --- | --- | --- |
| GAME-01 | Plasma net should become fireable sooner | Identify the current delay and distinguish charge time from cooldown or another gate. Agree a shorter target, then verify responsiveness, feedback, and balance across affected levels. |
| GAME-02 | Automatic reward box every other level | Add a calmer reward screen inspired by Monkey Trubble's chest, alongside the existing slot machine. Decide first qualifying level, eligible modes, reward contents, and ordering when both systems occur. Grant each earned box once. |
| GAME-03 | Combos should increase reward-box rewards | Define which combo measure counts and how it scales rewards, including limits. Show the player the combo contribution and verify zero-combo and high-combo outcomes. |
| GAME-04 | Next level must not start while player is idle on the end-level screen | Replace automatic progression with an explicit player action. Verify long idle periods, reward completion, background/resume, and rapid repeated taps cannot unexpectedly start or skip a level. |

### Scoreboard and platform identity

**SOCIAL-01:** Connect the Polyverse scoreboard to Apple Game Center and Google's equivalent, Google Play Games Services. Decide whether this means native leaderboards, platform sign-in connected to the existing scoreboard, or both. Inspect existing score storage first. Define declined sign-in/offline behavior, returning-player handling, and web identity. Players must understand which identity and score destination are active.

### Cheat Codes and rewarded ads

**ADS-01:** Add a “Cheat Codes” button to the Polyverse menu. Requested examples include unlocking level select and unlimited missiles; the complete catalog remains to be defined.

- Each enhancement states its effect and the required number of ads before activation.
- Verify whether the desired multi-ad experience is supported by the selected SDK and current platform/ad rules. Do not assume a configurable ad pod exists; if necessary, design an explicit sequence of separately chosen rewarded ads.
- Define unlock duration (run/session/permanent), progress retention, cancellation, unavailable inventory, partial completion, and duplicate-callback handling.
- Decide how cheat-enabled runs interact with leaderboard eligibility and existing unlocks before implementation.
- Preserve earned rewards/progress correctly through backgrounding and relaunch according to the chosen rules.

### Hidden developer tools

**DEV-01:** Three taps on the Stroids logo in its menu reveal a hidden Dev Mode button. Initial requested tool: instant level win; additional tools remain open.

Define the tap window, whether activation persists, how to turn it off, and which builds expose it. Keep developer tools distinct from ad-earned player cheats. Define score-submission behavior for developer-assisted runs and ensure instant win exercises level-completion/reward handling consistently without duplicate grants.

### Visual direction: React Bits references

Paul selected these references for the remaster. These are visual exploration directions, not approved component installations or a decision to migrate to React. Documentation descriptions were reviewed; interactive visual comparison, source inspection, license verification, and device profiling remain to be done.

| Reference | Intended use | Exploration and acceptance checks |
| --- | --- | --- |
| [Crystalized Ball](https://reactbits.dev/animations/crystalized-ball) | Crystal orb on the Poly Oracle opening page | Explore its glass appearance, electric rim, and swirling luminous dust. Define touch/drag interaction in place of cursor behavior, and connect visual intensity to idle, question input, and Reveal. Keep the answer legible and preserve audio sequencing. |
| [Electric Logo — glow=2](https://reactbits.dev/animations/electric-logo?glow=2) | More dynamic laser energy | Preserve Paul's exact glow setting in the reference. Inspect the interactive example and source before deciding which electrical details to borrow; the parameterized page could not be retrieved during the initial documentation review. |
| [Laser Flow](https://reactbits.dev/animations/laser-flow) | Study why the beam feels better than current laser effects | Compare side by side with current gameplay: beam core, glow falloff, movement, width variation, impact/contact lighting, and fade timing. These are comparison questions, not verified properties of the example. Its documentation describes light spilling over content and corners; explore whether contact lighting would improve hit feedback. |
| [Light Tunnel](https://reactbits.dev/backgrounds/light-tunnel) | Level transitions | Explore a short passage through a swirling tunnel of light and depth. Run only during the transition, release resources afterward, and hand off cleanly to a ready level. It must not bypass the requirement for explicit next-level input. Provide a reduced-motion alternative. |
| [Liquid Ether](https://reactbits.dev/backgrounds/liquid-ether) | Background element; exact screen still to choose | Explore subtle flowing color behind the foreground, with touch interaction where useful. Compare a live effect against a lower-cost approximation. Keep text, enemies, projectiles, and controls clear. |

**Related visual requests still awaiting references:** combo typography/animation and game buttons. These five examples do not yet define those designs.

**Prototype approach:** inspect each selected implementation and license; identify the rendering techniques worth adapting to the current JavaScript/PIXI/canvas stack. Prototype one effect at a time and compare it against the current screen on physical devices. Record startup cost, CPU/GPU/frame timing, memory, and idle behavior. Do not assume a visually simple effect is cheap or that React is required to achieve its look.

**Lifecycle requirements:** inactive screens must not retain animation loops or expensive compositing. The orb and any live background need a deliberate idle/rest policy and reduced-motion treatment; transitions must stop at completion. Avoid stacking several full-screen effects before measuring the combined cost. Visual improvements should support the remaster's battery and heat goals.

### Verified Monkey Trubble design references

- **Announcements:** `web/index.html:3643` defines bundled versioned release notes. At line 3691, a POLY badge pulses when the version is unseen; opening its “WHAT’S NEW” lightbox marks that version seen in saved progress. This is an in-app release-notes pattern, not evidence of a remotely managed announcements feed. Decide whether Poly Oracle needs bundled notes only or a remotely updated feed.
- **Creator byline:** `web/index.html:3946` contains both “A GAME BY POLYMER JONES” and “DEVELOPED BY POLYMER JONES”, chosen randomly on each home visit. Poly Oracle can choose a consistent phrase or explicitly adopt that variation.
- **Reward pacing:** `web/index.html:4201` counts qualifying wins, excludes tutorial/developer results, offers the first chest at a win on level 2 or later, then uses every-second-win cadence with an extra seventh-streak-day rule. Choose Poly Oracle's own cadence rather than inheriting all these rules.
- **Chest interaction:** the chest uses two rattles and opens on the third tap; it never opens merely because the player waits. Rewards reveal before a primary COLLECT action. A separate secondary COLLECT ×2 offers a rewarded video. These are useful references; doubling rewards is not yet selected Poly Oracle scope.
- **Rewards and cleanup:** Monkey Trubble banks boosters and may award a puzzle piece. It cancels scene animations, clears timers/canvas, and releases chest frame bitmaps on exit. Poly Oracle needs its own rewards, combo scaling, and lifecycle cleanup.
- **Ad fallback difference:** the reference's ×2 handler grants doubled boosters on either completed or unavailable status. Do not automatically adopt that behavior: Poly Oracle's cheat unlocks still need explicit partial-progress and unavailable-ad rules.

### Existing notes to revisit, not yet committed scope

`CLAUDE.md` records unfinished level-15 dual-UFO and wave behavior, missing late-game music/voice assets, and tutorial verification items. Some notes may be stale or superseded. Confirm current behavior and Paul's priorities before including them in the release.

## Suggested order

1. Review the captured remaster scope, obtain Monkey Trubble findings/reference screens, and settle the key reward and cheat decisions.
2. Measure the current app on iOS and Android before introducing ad SDK overhead.
3. Fix the highest-impact performance problems and gameplay defects in small, verifiable changes.
4. Implement rewarded ads and verify their effect on performance, audio, and lifecycle behavior.
5. Test the combined release on both platforms and the web; update store configuration and release materials.

Pricing timing remains a release decision: coordinate the switch to free with the intended availability of rewards and ads.

## Release checks

- Preserve saved progress, unlocks, settings, and scores through an upgrade from the released app.
- Verify the selected treatment for existing paying players.
- Check fresh install, returning player, offline use, pause/resume, and repeated sessions.
- Verify rewards, gameplay balance, and performance together on physical devices.
- Confirm web behavior explicitly rather than assuming native ads work there.
- Prepare release notes and define which post-release signals warrant a hotfix or temporarily disabling an ad placement.

## Project context

The current repository uses Capacitor 8, JavaScript, canvas, and PIXI. Root `script.js` is the source of truth; `www/` is generated. Existing `docs/V11_ROADMAP.md` is historical and does not define this update's scope. This document changes no app code, pricing, or live ad configuration.

## Next discussion

1. Choose whether announcements are bundled release notes like Monkey Trubble or also need remote updates.
2. Which enhancements should be offered as cheats, how many ads should each require, and how long should each unlock last?
3. What should reward boxes contain, and should cheat-enabled runs qualify for the scoreboard?
4. Confirm proposed first priorities: heat/idle CPU, startup and Reveal bugs, and clearer game entry before broader visual polish.
