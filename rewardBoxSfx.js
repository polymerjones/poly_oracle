// Reward box (chest) SFX — written by the Lab's "Reward Box" tab (tools/reactbits-lab, "Bake into game").
// Read by rewardBoxSfx() in script.js. Each moment is a list of layers played together:
// key = GAME_SFX key, vol 0..1.5, rate = playback speed. Tap layers add volRamp × (tap/6) and
// rateRamp × tap so every tap rises. An empty list = silent moment.
window.POLY_REWARD_BOX_SFX = {
  "arrive": [{"key": "warp", "vol": 0.7}],
  "tap": [{"key": "blip1", "vol": 0.6, "volRamp": 0.3, "rate": 0.85, "rateRamp": 0.09}],
  "open": [{"key": "bling", "vol": 0.9}, {"key": "pickup_weapon", "vol": 0.9}],
  "collect": [{"key": "level_up", "vol": 0.8}]
};
