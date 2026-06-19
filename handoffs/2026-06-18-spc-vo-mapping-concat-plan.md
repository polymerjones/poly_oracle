# 2026-06-18 — SPC tutorial VO audit + concat/wiring plan

Investigation-only session. **No `script.js` edits.** Renamed VO files in `www/vo/` and produced two
planning docs. Next session is mechanical: listen to intro splits, decide merge-vs-rechop, then execute.

## Shipped earlier this session
- **SPC mouth-flap freeze fix** — `a8e7d60` (already committed; `show()` no longer tears down the flap
  under SPC override). Part of the run of flap/lipsync fixes `2e1c92b`…`a8e7d60`.

## What changed on disk (`www/vo/`)
- Ran `normalize_vo_names.sh apply` — 60 descriptive VO files: spaces / ` - ` / `- ` → single `_`.
- Renamed `SPC_freese_…` → `SPC_freeze_pickup_the_freeze_powerup.mp3` (typo fix).
- Renamed mangled `SPC_praisemp3.mp3` → `SPC_praise.mp3` (distinct 2.5s take, not a dup).
- A copy of `normalize_vo_names.sh` was dropped in `www/vo/` to run it — can be removed.
- **Pending deletes (held, not done):** `SPC_01_splitC.wav` (2.4 MB source dup), `old_SPC_01.mp3`
  (18s original, keep as backup until splits verified).

## Source of truth for the next session
**`SPC_VO_CONCAT_PLAN.md`** (repo root) — the full execution plan. Also `SPC_VO_MAPPING.md` (the raw
audit it was derived from). Read the CONCAT_PLAN first; it supersedes the mapping doc.

### Key findings baked into the plan
- The tutorial VO is **effectively unwired**: of ~60 `spcVO()` lines, only `08-09` and `freeze_toggle`
  actually play today. The rest are 🔴 404 (key in Set, file missing) or ⬜ text-only (key not in Set).
- Descriptive recordings on disk cover **most** captions but are keyed by sentence, not the `SPC_NN`
  numbers the code passes. Several captions = **2–3 take "halves"** (e.g. `52-54` = 3 files).
- The resolver is strict: `spcVoSrc(key)` = `SPC_VO_AVAILABLE.has(key) ? vo/SPC_${key}.mp3 : null`
  (script.js:10690). No compound-key splitting — `spcVO("35-36")` is text-only because the Set holds
  `35`/`36` separately. `pumpSpc` (10708) is a fragile iOS-race state machine — **do not touch it.**

### Strategy locked: **#1 — concatenate, keep `pumpSpc` 1:1**
Pre-merge the half-takes into one clip per caption with ffmpeg, so the queue stays 1:1. Output uses
**descriptive filenames** (not opaque `SPC_NN`). 10 concat ops + ~43 single-file renames — see
CONCAT_PLAN §1/§2. `SPC_try_it_again.mp3` is **not** an orphan — it's key `21` ("Try it again.") in the
shared plasma-retry sub-loop (script.js:11206).

## The ONE blocking decision (do this first next session)
Intro splits `SPC_01_splitB/C/D/E` have **no words in their filenames**. Durations show the 5 splits =
the whole 18.43s `old_SPC_01.mp3` chopped sequentially, spanning captions **01 through 06**:

| Split | Dur | Hypothesis (confirm by ear) |
|-------|-----|------------------------------|
| splitA | 3.38s | `01` (confirmed by name) |
| splitB | 2.51s | `02` "Let me show you the ropes…" |
| splitC | **6.84s** | `03`+`04a`+`04b` in one breath (too long for `03` alone) |
| splitD | 4.65s | `05` (+ start of `06`?) |
| splitE | 0.86s | `06` tail "Tap it now." (confirmed by name) |

Exact captions: `01` "Hi there Cadet, welcome to the Polyverse simulator." · `02` "Let me show you the
ropes before the real battle." · `03` "First — the perimeter timer." · `04a` "That line around the screen
edges" · `04b` "shows how long you have to clear the field." · `05` "Every so often a timer power-up
appears." · `06` "Grab it to buy time. Tap it now."

**After listening, choose for splitC (and maybe splitD):**
- **(a) merge captions** — collapse `03`/`04a`/`04b` into one `spcVO` call + combined caption keyed to
  splitC. Cleanest, one intro-phase edit. **OR**
- **(b) re-chop** splitC into 3 clips in Audition so each caption keeps its own audio.

## Must record (no usable file exists)
- `05` "Every so often a timer power-up appears."
- `31b` "Good shot — but try the plasma net first, then the UFO. Let's run it again."
- `57` "Blast those stroids with the quad shot!" (don't reuse the laser "blast the stroids" take)
- Partials: `06` (only "tap it now" exists), `10-11` (only "blast the stroids" exists)

## Pre-approved, blast radius confirmed
- **Set→Map resolver change** is greenlit: replace `SPC_VO_AVAILABLE` (Set) with `SPC_VO_FILES`
  (Map key→filename) + one-line change in `spcVoSrc` (script.js:10690). **Resolver only** — `pumpSpc`,
  the queue, the iOS race fixes, and all `spcVO()` call sites are untouched. Full Map is in
  CONCAT_PLAN §3, ready to paste.
- Bonus/ambient callouts (`amazing`, `crushing_it`, BONUS_*, …) resolve via the **separate**
  `spcBonusVoSrc` path (script.js:1898) — leave intact.

## Execution order when greenlit
1. Confirm intro splits by ear → pick (a) or (b). 2. Run 10 concats + renames in `vo/`. 3. Set→Map +
resolver line. 4. `node --check script.js && npm run prepare:web`; bump `BUILD_TS`. 5. Record the 3 gaps,
add Map entries. 6. Fix the stale CLAUDE.md "verified 1:1 on 2026-06-17" note.
