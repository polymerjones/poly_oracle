# HANDOFF — Tossed-stroid "stuck at top / won't wrap" regression

**Status:** FIX APPLIED 2026-06-12 (not yet verified in the simulator). If a fresh build still
shows the bug, this doc's diagnosis below is the resume point.

**Fix applied (root `script.js`):**
1. Movement loop — removed the speed-floor block that re-pointed a slowed tossed stroid in a
   **random direction at 180px/s** (the cause: an upward toss got randomized into a slow
   sideways drift that never climbed far enough to wrap). Tossed stroids now keep their launch
   velocity untouched, exactly like the working `45645c7` baseline → they wrap cleanly.
2. Removed the dwindle (radius shrink) entirely.
3. `STROID_TOSS_TIMEOUT_MS` 6000 → **2800** — a toss that never connects self-destructs fast,
   which is now the only anti-linger guard (replaces the floor). It does NOT revert to normal.

**If still broken after a real build:** add the §4 instrumentation and watch `a.vy`/`a.y` near
the top edge. The remaining unverified assumption is that nothing *else* drops a clean toss's
speed; the trace below found no such path, so the floor's random relaunch was the only suspect.

---

_Original handoff (pre-fix) follows._

**Last shipped (broken) build:** `f2e8261` (`BUILD_TS = 2026-06-11 23:20`).

---

## 1. Symptom (verbatim from the user)

> "any time a stroid is tossed **upwards** it hits the edge of the top of the screen and
> **does not wrap**, the **fire wraps at the bottom** but the **stroid slowly drifts at the
> top of the screen**."

> "this is a very new regression, from either the **dwindle logic** or the **collision logic**,
> I'm pretty sure."

Key qualities:
- Happens **every time** a stroid is tossed **upward** (deterministic, not collision-dependent).
- The **fire FX** (flame trail / blobs) **does** wrap to the bottom normally.
- The **stroid sprite** stays near the **top** and **drifts slowly** instead of wrapping.
- A flaming/tossed stroid should also **not be re-grabbable** (separate, already attempted).

## 2. Regression window

| Commit | What it added | Suspect? |
|--------|---------------|----------|
| `45645c7` | tossable mines + flaming tossed stroids; ship-ios skill | **last "working decent" baseline** |
| `02a606d` | tossed-stroid collisions, fire FX, frozen-toss shatter audio | collision rewrite — suspect |
| `7235639` | tossed-stroid fuse/**dwindle**, tossed-vs-tossed detonation, faster scorecard | **dwindle — prime suspect** |
| `d6fe096` | fix: tossed stroid stalling when tossed upward (re-grab pin) | failed fix attempt |
| `f2e8261` | fix: tossed burn out faster + can never be pinned | failed fix attempt (last shipped) |

User is OK **ditching dwindle**, but requires: a tossed stroid must **NOT revert to a normal
drifter** if it never collides, and the **self-destruct should be faster**.

## 3. What I traced (static analysis — all in root `script.js`)

I looked for anything that drains a tossed stroid's velocity or blocks its wrap. **Negative
result: found no static velocity drain.** Statically the stroid *should* keep moving ≥180 px/s
and wrap. That means the next step is **runtime instrumentation**, not more reading.

Paths checked and CLEARED:
- **Movement loop** (`~9184–9216`): tossed stroids move (`a.x += a.vx…`), wrap via
  `wrapEntity` (`else` branch, not practice), and have a **speed floor** of
  `STROID_TOSS_FLOOR_SPEED = 180` (`9202–9211`). They skip `clampSpeed`. Looks correct.
- **`wrapEntity`** (`~5976`): top→bottom wrap math is correct
  (`if (entity.y < top - entity.r) entity.y = bottom + entity.r - EPS;`). Uses `playfield`
  bounds.
- **`applyMotionHealth`** (`~5999`): only *adds* a 15px/s nudge when stuck >600ms; never drains.
- **`resolveAsteroidCollisions`** (`~6610`): pair loop **skips** tossed (`6646`). Final
  `wrapEntity`+`clampSpeed` loop (`6653–6656`) runs on ALL asteroids incl. tossed, BUT
  `MIN_SPEED = 10` (`5015`) so `clampSpeed` is a **no-op** on a floored (180) tossed stroid.
  → not the drain, but see "code smell" below.
- **`handleTossedAsteroidImpact`** (`~7061`): decrements `tossHealth`, splits/destroys target,
  detonates at 0 health. **Does not change the tossed stroid's velocity.**
- **`launchStroidToss`** (`~6900`): sets `vx/vy = dir * (500–700)`, `tossed=true`,
  `tossedAt=now`, `_tossBaseR=r`. Flick direction math looks fine.
- **`sim.tossedAsteroid`**: only set (`6944`) / cleared (`7040,7058,8220`); **never** used to
  reposition/pin a stroid. No leftover single-slot pin code.
- **Renderer** (`pixiRenderer.js syncAsteroids ~261`): `sprite.x = a.x; sprite.y = a.y`
  unconditionally — **no interpolation, no desync.** So if the sprite shows at the top, then
  `a.y` really is at the top.

### Conclusion from the trace
Because the renderer reads `a.y` directly and the fire reads live positions too, "fire at
bottom + stroid at top" means **`a.y` itself is not crossing the top edge** — i.e. the
stroid's **upward velocity is being lost or reversed specifically near the top**, by a path I
could not see statically. The 180 floor *should* prevent slow drift, so either (a) velocity is
being set to a near-horizontal/downward 180 (floor preserves angle; if angle was flipped this
drifts along the top without wrapping), or (b) something resets `a.y`/`a.vy` after the wrap.

## 4. FIRST STEP NEXT SESSION — instrument, don't guess

Add a temporary one-line-per-frame log for the tossed stroid near the top, then toss upward in
the simulator and read the console:

```js
// TEMP DEBUG: remove before release. Put inside the movement loop, right AFTER wrapEntity(a).
if (a.tossed && a.y < playfield.y + 120) {
  console.log("TOSS", Math.round(a.x), Math.round(a.y),
    "v", Math.round(a.vx), Math.round(a.vy),
    "sp", Math.round(Math.hypot(a.vx, a.vy)), "r", Math.round(a.r));
}
```

Watch for: does `a.vy` flip sign or collapse near the top? Does `sp` fall to ~180 (floor
kicking in) and the **angle** go horizontal? Does `a.y` jump to bottom (wrap fired) then come
back? That single trace pinpoints which of the two failure modes above is real.

## 5. Code smells to fix while in there (likely root cause candidates)

1. **`resolveAsteroidCollisions` final loop touches tossed stroids** (`script.js:6653–6656`).
   The pair loop deliberately skips tossed, but the trailing `wrapEntity`+`clampSpeed` loop
   does not. It's a no-op *today* (MIN_SPEED=10) but it's the exact "collision logic touches
   tossed" inconsistency the user suspects. **Recommend: skip tossed here too**, e.g.
   `if (sim.asteroids[i].tossed) continue;` — and remove the redundant double-wrap.
2. **Dwindle mutates `tossed.r` every frame** (`script.js:7117–7119`). It shrinks the radius
   used by BOTH collision (`7128`) and `wrapEntity`'s `top - entity.r` threshold. Per the
   user, **rip dwindle out** (see §6). It's the prime suspect and they don't want it anyway.

## 6. Recommended fix (meets the user's stated requirements)

The user wants: **no dwindle, no revert-to-normal, faster self-destruct.** Cleanest path:

1. **Remove the dwindle block** entirely (`script.js:7117–7119`) and drop `_tossBaseR`
   usage. (Keep `_tossBaseR` assignment harmless or delete it at `6943`.)
2. **Speed up self-destruct**: set `STROID_TOSS_TIMEOUT_MS` from `6000` → ~`2500–3000`
   (`script.js:412`).
3. **Exclude tossed from the `resolveAsteroidCollisions` tail loop** (smell #1 above).
4. **Keep** the 180 speed floor and the `selfDestructTossedAsteroid` path (no revert to
   normal — that requirement is already satisfied; tossed stroids self-destruct, they don't
   revert).
5. Re-test an **upward** toss with the §4 instrumentation still in place; confirm `a.y` wraps.

### Fallback if it stays broken: revert to the working baseline
The toss "worked decent" at `45645c7`. Safest recovery:
```sh
git revert --no-commit 7235639   # dwindle / fuse / tossed-vs-tossed
git revert --no-commit 02a606d   # fire FX + collision rewrite (only if still broken)
# resolve, test the toss, then re-apply ONLY the fire FX + faster self-destruct deliberately
```
Note this also pulls out tossed-vs-tossed detonation and the faster scorecard — re-apply those
intentionally afterward. Prefer the targeted fix in §6 first; revert only if instrumentation
doesn't lead to a quick fix.

## 7. Build / verify loop (reminder)

- Edit **root `script.js` only** (never `www/script.js`).
- `node --check script.js && npm run prepare:web`
- Ship via the `ship-ios` skill: `.claude/skills/ship-ios/scripts/ship.sh "<msg>"` (bumps
  `BUILD_TS`, builds, commits, pushes, `cap:sync`, opens Xcode). Verify the bottom-left
  `BUILD_TS` stamp in-game.
- Simulator diagnosis worked via `xcrun simctl io booted recordVideo/screenshot` + ffmpeg
  frame extraction (no `timeout` on macOS — use a background process + `kill -INT`).

## 8. Don't forget (PRE-RELEASE CHECKLIST, from CLAUDE.md)

Still must be reverted before any App Store build:
- `DEBUG_FORCE_LEVEL_SELECT` → `false`
- Powerup level gate → `cfg.level >= 4` (currently `>= 1` for freeze testing)
- Powerup weights → snowflake 10 / goldbars 15→30 (`POWERUP_WEIGHTS`)
- Remove forced goldbars spawn in final 15s (`goldbarsForceSpawnedThisLevel`)
- Resolve all `DEBUG: revert before release` hits
- Verify `hasBeatenGame()` has no overrides
