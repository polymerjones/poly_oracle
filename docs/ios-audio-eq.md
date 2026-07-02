# iOS music EQ (freeze / Pulse Cannon) — known limitation & fix path

**Status:** desktop-only. The freeze and Pulse Cannon music-EQ effects **do not work on iOS**
(native Capacitor app or mobile Safari). This is a routing limitation, not a bug in the filters.
Last reviewed: build `2026-07-01 20:11`.

## Symptom
- On desktop the music audibly darkens/ducks while a **freeze** is active
  (`applyFreezeFilter`, lowpass 320Hz) or while the **Pulse Cannon** runs
  (`applyPulseFilter`, lowpass 600Hz + light duck).
- On iOS the same effects fire in code but you hear **no change** to the music.

## Root cause
The EQ filters are spliced into the **Web Audio** graph, between `musicGain` and `masterGain`:

```
music BufferSource → gain → musicGain → [freeze/pulse filter] → masterGain → destination
```

But on iOS, decoding the level `.mp3` into a Web Audio buffer **fails silently**
(`loadMusicBuffer` returns null). `_playMusicInner` (`script.js`, ~`audioEngine._playMusicInner`)
then falls back to a plain HTML element:

```js
const node = new Audio(url);
node.loop = true;
node.play();
this.currentMusicHtml = { key, url, node, ... };
```

That `<audio>` element plays **straight to the hardware output — it never touches `musicGain`**,
so the filter chain has nothing to act on. Hence: no EQ on iOS.

(The same "iOS Web Audio buffers fail silently" behavior is why several SFX use
`forceHtmlOnIOS` — see `playGameSfx`.)

## Why it isn't fixed yet
Making the EQ work on iOS means routing the **HTML-audio music element through Web Audio** via
`ctx.createMediaElementSource(node)` and connecting that into `musicGain` — the same pattern
already proven for VO in `acquireVoElement`. It's deferred because it's the **highest-risk audio
change on the platform**:

1. **Permanent ctx binding.** `createMediaElementSource(el)` binds the element to the AudioContext
   forever; the node is never GC'd. If the ctx suspends (iOS suspends on backgrounding and can only
   resume inside a user gesture), the music can go silent with no auto-recovery — the same
   "iOS audio-death" class that got the per-level `teardown()` retired
   (see memory `progressive-lag-music-buffer-cache`).
2. **Node leak risk.** If the element is re-bound per track (or both the fallback and Web Audio
   paths touch it), we re-introduce the MediaElementSource leak that caused progressive VO lag.
   Must bind **once per element** and re-point `.src`, exactly like `acquireVoElement`.
3. **CORS / tainting.** `MediaElementSource` outputs silence for cross-origin/tainted media.
   Capacitor serves local (`capacitor://`) so likely fine, but it's a silent-failure mode to verify.
4. **Autoplay-gesture timing.** The element must be `.play()`'d and wired within the unlock gesture
   or iOS blocks playback.

## Fix sketch (when we do it)
- Keep **one** persistent music `<audio>` element (mirror `acquireVoElement`): create its
  `MediaElementSource` once, connect `source → musicGain`, and re-point `.src` per track.
- Route the HTML fallback path through that element so music always feeds `musicGain`
  (then freeze/pulse filters apply on iOS too).
- Guard ctx-resume on `visibilitychange`/foreground with a user-gesture fallback.
- Verify: freeze + Pulse Cannon EQ audible on device; no audio-death across level transitions or
  backgrounding; no progressive lag over a long VO-heavy playthrough (L13+, SPC tutorial).

## Related code
- `audioEngine.applyFreezeFilter` / `removeFreezeFilter`
- `audioEngine.applyPulseFilter` / `removePulseFilter`
- `audioEngine._playMusicInner` (the `new Audio(url)` fallback branch)
- `acquireVoElement` (the persistent-element pattern to copy)
