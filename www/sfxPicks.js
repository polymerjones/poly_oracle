// Sound picks — written by the Lab's "Sounds" tab (tools/reactbits-lab, "Bake into game").
// POLY_REWARD_BOX_SFX → rewardBoxSfx() (the reward chest); POLY_HUB_SFX → playHubSfx() (the POLYVERSE
// hub card carousel + menu taps). Each moment is a list of layers played together:
// key = GAME_SFX key, vol 0..1.5, rate = playback speed. Tap layers add volRamp × (tap/6) and
// rateRamp × tap so every tap rises. An empty list = silent moment.
window.POLY_REWARD_BOX_SFX = {
  "arrive": [{"key": "bigbang", "vol": 0.7}],
  "tap": [{"key": "crush", "vol": 0.6, "volRamp": 0.3, "rate": 0.55, "rateRamp": 0.09}],
  "open": [{"key": "item_pickup2", "vol": 0}, {"key": "pickup_weapon", "vol": 0.9}, {"key": "slot_life", "vol": 1.3, "rate": 0.55}],
  "collect": [{"key": "level_up", "vol": 0.8}]
};
window.POLY_HUB_SFX = {
  "tick": [{"key": "blip", "vol": 0.05, "rate": 1.55}],
  "select": [{"key": "smallblast", "vol": 0.15}],
  "open": [{"key": "menu_hit", "vol": 0.7}]
};
