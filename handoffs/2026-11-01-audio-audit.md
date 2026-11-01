# Audio audit — professional balance + the menu crackle

## Why
Paul wants the game's music and sounds **professionally balanced**, with no more blind per-sound tweaks. He has heard a **music crackle while cycling the hub menu chirps** for *days* (it started before 2026-11-01), and it's the only crackle he has noticed. Run this as its own session (`/clear` first). The root `script.js` is the source of truth. After every edit run `node --check script.js && npm run prepare:web` and bump `BUILD_TS`. Paul has asked for dev installs only (no TestFlight archives or Play AABs) until he says the build is solid.

## How the sound is wired today (script.js)
- **Web Audio graph** (`audioEngine.ensureContext`, ~5170):
  - Every SFX buffer → `sfxBus` (SFX dial, `userLevelGain` = (v/100)^2) → `masterGain` (0.75) → destination.
  - `musicGain` (+ freeze/pulse filters) → `musicBus` (MUSIC dial) → `masterGain`.
- **iOS music**: an HTML `<audio>` element. iOS ignores `.volume`, so `iosRouteElement` (~5087) pipes it through `createMediaElementSource` → its own gain → destination. **Routing only happens** when a dial is below 100% OR the Settings mixer was opened this session (`_iosRouteAlways`, set in the Settings open ~2908, not persisted). Otherwise the music plays natively and is mixed with Web Audio only inside iOS. A routed element can never be un-routed. `rebuildContext` makes fresh elements.
- **SFX `<audio>` fallback**: never routed (routing caused orb-tap delay and pops). Below 100% the SFX decode to buffers (`warmSound`).
- **Hub sounds**: `playHubSfx` (~9522) reads `sfxPicks.js` `POLY_HUB_SFX`. Current levels: tick blip 0.2 @ rate 1.55, select smallblast 0.45, open menu_hit 0.8. Before 2026-11-01 they were 0.15 / 0.45 / 0.6. All use `preferBuffer`.
- **VO**: persistent per-channel `<audio>` (`acquireVoElement`). Commander lines go through the radio chain `applyCommRadioEffect` (~6060: highpass/lowpass/waveshaper/compressor). Combo voice: see `playComboSfx`.
- **Per-call volumes**: scattered `playGameSfx(key, vol)` / `audioEngine.play(key, {volume})` calls. Mixer audition: `warmMixerAudition`.
- **Limiter experiment: REMOVED (build 12:27).** A master `DynamicsCompressor` brickwall (threshold -1.5, knee 0, ratio 20, attack 1 ms) between masterGain and the destination was installed in builds 12:13 and 12:25. Paul then reported **no menu sounds at all**, so Paul had it removed. Assume a WebKit/iOS DynamicsCompressor problem until proven otherwise. Do NOT re-add a master compressor without a device test.

## Measured so far (ffmpeg volumedetect)
| asset | peak dBFS | mean dB |
|---|---|---|
| assets/music/STROIDS_THEME.mp3 | -3.9 | -14.5 |
| gamesfx/blip.mp3 | -2.0 | -16.4 |
| gamesfx/menu_hit1.mp3 | -1.1 | -21.6 |
| gamesfx/smallblast.mp3 | -2.5 | — |

Effective peak of the open chirp: 0.88 × 0.8 × 0.75 ≈ 0.53 FS (at the old 0.6 it was ≈ 0.40). Music peak ≈ 0.64 FS when routed at level 1. So music + chirp can pass 1.0 FS, which clips. That's a **hypothesis**, not proven. The crackle predates the louder chirp, and native-plus-Web-Audio mixing or the element hand-off are other candidates.

## Audit plan
1. **Inventory and measure** every asset (music, gamesfx, newsfx, newsfxdesigned, assets/newsfx, vo, vo3, combo_fx mp3): true peak plus integrated loudness (`ffmpeg -af ebur128=peak=true`). Script it in `tools/audio/`, output CSV/JSON.
2. **Map effective levels**: for each sound, file peak/LUFS × call-site volume × bus × master. Grep every `playGameSfx` / `audioEngine.play` / VO call. Flag sounds far louder or quieter than their peers, and worst-case sums (music + chirps, bomb chain + combo VO + music, pulse-cannon EQ).
3. **Headroom budget** (propose, then Paul approves): e.g. music around -18 LUFS-equivalent at the bus, SFX tiers (UI / weapon / explosion / reward), VO always ~3–6 dB above the music, master true-peak at most -1 dBFS without needing a limiter. Prefer normalising the files offline (keep the originals) over runtime gains.
4. **Find the crackle with evidence**: reproduce on the iPhone with the dials at 100% and the mixer unopened (music native), then again with the mixer opened (music routed). Log via the `devicectl --console` recipe (memory `perf-audio-session-2026-11-01`). Check clipping vs. hand-off vs. a sample-rate or session issue.
5. **Deliver a balance table** plus a Lab A/B (the Sounds tab already exists). Paul ear-checks on the phone. Commit.

## Other state at hand-off
- Limiter removed in build 12:27. The toss-tip guard and the scoreboard polish are in the dev build (commit status: see git).
- Pushed: cc7f746 (4.1.1 (8) / Android 38 built; Paul uploaded (7) and (8) to TestFlight).
