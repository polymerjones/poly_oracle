# Session handoff — 2026-06-12 — Stroid-toss wrap fix + Vercel deploy fixes

**BUILD_TS = "2026-06-12 10:08"**  ·  branch: main

## Summary
Fixed the long-standing "tossed stroid won't wrap at the top" regression by reverting the
flight path to its known-good baseline, then fixed the production website (polyoracle.app on
Vercel): the leaderboard and several sound effects were broken because their files were
git-ignored and never deployed.

## What was fixed

### Tossed stroid hits the top of the screen and won't wrap
- **Symptom (verbatim):** "any time a stroid is tossed upwards it hits the edge of the top of
  the screen and does not wrap, the fire wraps at the bottom but the stroid slowly drifts at
  the top of the screen." Worked "decent" at commit `45645c7`; broke during the fire-FX +
  dwindle work.
- **Root cause:** The "anti-stall" speed floor added after the baseline re-pointed a slowed
  tossed stroid in a **random direction at 180 px/s** whenever its speed dipped low. An upward
  toss caught that path near the top and got redirected sideways/down — drifting slowly along
  the top, never climbing far enough to trigger `wrapEntity`. NOT a render desync: PIXI sprite,
  heat tint, and fire all read live `a.x/a.y`, so "fire at bottom, stroid at top" meant the
  stroid's real position simply wasn't crossing the top edge.
- **Fix:** `script.js` movement loop (~`9198`) — tossed stroids now keep their launch velocity
  untouched (no `clampSpeed`, no speed floor), exactly like the `45645c7` baseline → they fly
  fast/straight and wrap cleanly. Removed the in-flight dwindle (radius shrink) from
  `updateTossedAsteroidCollision` (~`7108`). Shortened `STROID_TOSS_TIMEOUT_MS` 6000 → **2800**
  (`script.js:412`) as the sole anti-linger guard; a toss that never connects self-destructs
  fast and never reverts to a normal drifter. Removed now-unused consts `STROID_TOSS_MIN_SHRINK`,
  `STROID_TOSS_FLOOR_SPEED`, and the dead `_tossBaseR`. (commit `3fe540b`)
- **Verified:** `node --check` + `prepare:web` pass; shipped to Xcode via `ship-ios`. User to
  confirm an upward toss wraps in the running build (high confidence — it's a revert to the
  version the user said worked).

### "Missing Firebase config" / leaderboard broken on polyoracle.app
- **Symptom:** Deployed site logged `[leaderboard] Missing Firebase config`; leaderboard didn't
  load. Worked locally / in Capacitor.
- **Root cause:** Config is a **static global**, not env vars — `script.js:4385` reads
  `globalThis.POLY_FIREBASE_CONFIG`, set by `firebase-config.js` (loaded in `index.html:411`).
  That file was in `.gitignore`, so it was never committed and never deployed. Vercel serves
  the **repo root** as a static site (no build step / no `www/`), so the untracked file = no
  config at runtime. (Setting Vercel env vars would do nothing — no code reads them.)
- **Fix:** Removed `firebase-config.js` + `www/firebase-config.js` from `.gitignore` and
  committed the real file. The Firebase **web** `apiKey` is a public identifier (protected by
  Firestore security rules + key restrictions), so committing it is the intended pattern.
  (commit `b655426`)
- **Verified:** Files now `git ls-files` tracked + pushed. User to confirm leaderboard loads on
  polyoracle.app after Vercel auto-deploy.

### 404s on newsfx/*.mp3 (advfire_lighter.mp3, plasmarecharged.mp3, …)
- **Symptom:** Several sound files 404'd on the deployed site.
- **Root cause:** `.gitignore` excluded `newsfx/` and `www/newsfx/` → the whole folder was
  never in the repo Vercel deploys. (Files exist locally, which is why audio worked locally.)
- **Fix:** Removed `newsfx/` and `www/newsfx/` from `.gitignore`, committed the folder.
  (commit `b655426`)
- **Verified:** Files staged/pushed. Confirm on the live site post-deploy.

## Still open / follow-ups
- **`astgfx/ufo.png` 404** — genuinely missing asset; NO ufo image exists anywhere in the repo
  under any name. `pixiRenderer.js:139` loads it with `.catch(() => null)` and falls back to a
  procedurally-drawn UFO (`pixiRenderer.js:190-197`), so the UFO still renders and nothing
  breaks. Decision deferred: either point line 139 at a real sprite, or generate a UFO mockup
  (like the powerup icons). Low priority.
- **`.wav` source files in git** — committing `newsfx/` also pulled in `.wav` originals
  (lazerzap, plasmachargeup, droneufo). Harmless for the web deploy, just bloat. Could add a
  `*.wav` ignore + `git rm --cached` if we want them out.
- **Toss fix confirmation** — awaiting user's in-build verification that upward tosses wrap.

## Gotchas / learnings
- **Vercel serves the repo ROOT as a static site** here — no build step, no `www/` output dir
  (`vercel.json` has only `cleanUrls`/headers). So anything `.gitignore`'d is simply absent in
  production. This is the root pattern behind both deploy bugs.
- **Firebase config is a static `window.POLY_FIREBASE_CONFIG` global**, not env-var driven.
  Don't reach for Vercel env vars — nothing reads them.
- **Firebase web `apiKey` is not a secret** — it's a public project identifier; security is via
  Firestore rules + API-key referrer restrictions. Safe (and intended) to commit.
- **Tossed stroids must keep their launch velocity untouched to wrap correctly.** Any
  "re-energize / floor / clamp" logic that can change a tossed stroid's *direction* will break
  upward wrapping. The clean mechanic = fast straight flight + a short self-destruct fuse; do
  not add velocity-massaging back.
- All renderers (PIXI sprite, heat tint at `script.js:9489`, fire blobs) read live `a.x/a.y` —
  a sprite-vs-fire position split is therefore always a *sim* (velocity/position) bug, never a
  render desync.

## Pre-release reminders (carry forward — from CLAUDE.md, still unresolved)
- `DEBUG_FORCE_LEVEL_SELECT` → set back to `false`
- Powerup level gate → restore to `cfg.level >= 4` (currently `>= 1` for freeze testing)
- Powerup weights → restore snowflake 10 / goldbars 15 → 30 (`POWERUP_WEIGHTS`)
- Remove forced goldbars spawn in the final 15s (`goldbarsForceSpawnedThisLevel`)
- Resolve all `DEBUG: revert before release` hits in `script.js`
- Verify `hasBeatenGame()` has no overrides
