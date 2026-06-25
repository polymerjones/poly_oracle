---
name: stroid-skin
description: Add or retune a code-baked asteroid ("stroid") color skin in Poly Oracle and assign it to a level. Use when the user wants a new stroid/asteroid skin, tint, or color variant (e.g. "ice-blue stroids on L8", "purple/grey rocks", "midnight-blue skin"), references the green/neon stroid look, or wants to recolor asteroids per level.
---

# stroid-skin

Asteroid skins in Poly Oracle are **code-baked** at runtime, not painted assets: a tritone
luminance gradient (shadow → mid → highlight) is mapped over `astgfx/roid01.png`. This is the
"green stroids that look fantastic" method (`roidneon`).

**The critical gotcha:** the skin must be baked in **TWO** files with **identical ramp stops**, or
it silently falls back to plain silver `roid01` on the iOS device:
- `script.js` → `buildGeneratedAsteroidSprites()` (2D-canvas / desktop path)
- `pixiRenderer.js` → the init block after `buildTintedAsteroidTexture` (PIXI / iOS-native path)

If you only edit `script.js`, it looks right in a desktop browser and **wrong on device**. Always do both.

## Workflow

1. **Pick the ramp stops** — three `[r,g,b]` triplets (0–255): deep `shadow`, mid-tone `mid`,
   bright `hi`. The skin reads mostly as `mid`; `shadow` darkens crevices, `hi` is the rim light.
   Choose a short key like `roidice`, `roidbluemoon`, `roidpurplegrey`.

2. **Bake it in `script.js`** — add one line inside `buildGeneratedAsteroidSprites()` (search for
   that function name; it sits just after `buildTintedAsteroidSprite`):
   ```js
   buildTintedAsteroidSprite("roidice", [12, 34, 66], [86, 170, 214], [224, 246, 255]);
   ```

3. **Bake the SAME skin in `pixiRenderer.js`** — search for `buildTintedAsteroidTexture`. Add a
   parallel entry to the `Promise.all([...])` and assign it, using the **identical** ramp stops:
   ```js
   buildTintedAsteroidTexture([12, 34, 66], [86, 170, 214], [224, 246, 255]).catch(() => null), // L8 ice
   // ...then:
   textures.roidice = _ice || textures.roid01;
   ```

4. **Assign the skin to a level** in `ARCADE_LEVELS` (`script.js`). Pick one:
   - Whole level, one skin: `spriteKey: "roidbluemoon"`
   - Weighted mix: `spriteMix: [["roidpurplegrey", 5], ["hotroid01", 1]]`
   - Time-gated mid-level shift (new spawns only): `spriteShift: { afterMs: 18000, key: "roidice" }`
     (handled by `pickArcadeSpriteOverride`; the spawn calls already pass it).

5. **Exclude the level from the 2D multiply tint** — in `getAsteroidTintForLevel(level)`, add the
   level number to the early `return null` list (alongside 3/6/8/9/12/14). Otherwise a legacy
   per-level multiply tint muddies your baked colors on the 2D/desktop path.

6. **Build & verify**:
   ```sh
   node --check script.js && node --check pixiRenderer.js && npm run prepare:web
   ```
   Bump `BUILD_TS` in `script.js`. Confirm on **device** (PIXI path), not just desktop.

## Notes

- `roid01` must be decoded before baking; both builders guard on that and re-bake on its `load`
  if needed, so ordering is safe.
- Unknown `spriteKey`s fall back to `roid01` (silver) in both renderers — a missing pixiRenderer
  bake is the usual cause of "my skin shows on desktop but is silver on iPad".
- Existing skins to copy as colour references live in `buildGeneratedAsteroidSprites()`:
  `roidneon` (L14 green/purple), `roidbluemoon` (L3), `roidice` (L8), `roidpurplegrey` (L12).
