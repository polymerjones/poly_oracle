// App Store screenshot capture (2026-10-27). Drives the real game headless at exact store sizes and
// stages moments through the ?cockpitLab=1 bridge (give/spawn/bombAt/missileAt/rocks). Raw shots land
// in store-assets/raw/<profile>/<scene>.png; the Lab's "Store Shots" tab picks, orders and captions them.
//
//   node tools/capture-store-shots.cjs <profile> [scene,...] [--base http://localhost:5180/game/]
//   profiles: iphone69 (1320×2868) · ipad13 (2064×2752) · Google Play (9:16): play_phone (1080×1920) ·
//             play_tab7 (1224×2176) · play_tab10 (1620×2880)
//
// Needs Playwright (PLAYWRIGHT_PATH, default: the Codex runtime copy) + Google Chrome, and a server for
// the game: the Lab's dev server (/game/) or `python3 -m http.server` in www/.
const path = require("path");
const fs = require("fs");
const PW = process.env.PLAYWRIGHT_PATH || "/Users/paulfisher/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright";
const { chromium } = require(PW);
const args = process.argv.slice(2);
const baseIdx = args.indexOf("--base");
const BASE = baseIdx >= 0 ? args.splice(baseIdx, 2)[1] : "http://localhost:5180/game/";
const [PROF, ONLY] = args;
const OUT = path.join(__dirname, "..", "store-assets", "raw", PROF || "");
const PROFILES = {
  iphone69: { vp: { width: 440, height: 956 }, dpr: 3, safe: [62, 34], ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148" },
  ipad13: { vp: { width: 1032, height: 1376 }, dpr: 2, safe: [24, 20], ua: "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148" },
  play_phone: { vp: { width: 360, height: 640 }, dpr: 3, safe: [24, 0], ua: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36" },
  play_tab7: { vp: { width: 612, height: 1088 }, dpr: 2, safe: [24, 0], ua: "Mozilla/5.0 (Linux; Android 14; SM-X210) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36" },
  play_tab10: { vp: { width: 810, height: 1440 }, dpr: 2, safe: [24, 0], ua: "Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36" },
};
const prof = PROFILES[PROF];
if (!prof) { console.error(`unknown profile "${PROF}" (${Object.keys(PROFILES).join(", ")})`); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });
const wait = (p, ms) => p.waitForTimeout(ms);
(async () => {
  const b = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", args: ["--autoplay-policy=no-user-gesture-required"] });
  const ctx = await b.newContext({ viewport: prof.vp, deviceScaleFactor: prof.dpr, isMobile: true, hasTouch: true, userAgent: prof.ua });
  await ctx.addInitScript(() => { try {
    localStorage.removeItem("poly_oracle_show_build");
    localStorage.setItem("poly_stunt_training_complete", "1");
    localStorage.setItem("poly-oracle-game-beaten", "1");
    const t = Date.now(), learned = {}; for (const id of ["fire","powerup","bomb","missile","freeze","pulse","slot","net","netRecharge","netMode","toss2","netPlaced"]) learned[id] = t;
    localStorage.setItem("poly_oracle_tips_learned", JSON.stringify(learned));
    localStorage.setItem("poly_oracle_tips_last_play", String(t));
    localStorage.setItem("poly_oracle_net_mode_demo_seen", "1");
  } catch {} });
  const p = await ctx.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const shot = (n) => p.screenshot({ path: path.join(OUT, `${n}.png`) }).then(() => console.log("shot", n));
  const lab = (fn, arg) => p.evaluate(fn, arg);
  const fresh = async () => { await p.goto(`${BASE}index.html?cockpitLab=1`); await wait(p, 4000); };
  const level = async (n, settle = 7000) => {
    await fresh(); await lab((l) => window.__cockpitLab.start(l), n);
    await lab(([t, bt]) => window.__cockpitLab.setSafeInsets(t, bt), prof.safe);
    await wait(p, settle);
  };
  // shoot the rocks nearest the middle (taps = lasers + explosions)
  const blast = async (k = 5, gap = 140) => {
    for (let i = 0; i < k; i++) {
      const rocks = await lab(() => window.__cockpitLab.rocks());
      if (!rocks.length) break;
      const r = rocks[Math.floor(Math.random() * rocks.length)];
      await p.mouse.click(r.x, r.y); await wait(p, gap);
    }
  };
  const scenes = {
    oracle: async () => { await fresh(); await shot("01_oracle"); },
    hub: async () => { await fresh(); await lab(() => openGalaxyView()); await wait(p, 2500); await shot("02_hub"); },
    action: async () => { await level(9); await blast(6, 120); await shot("03_action"); },
    bomb: async () => { await level(4); await lab(() => window.__cockpitLab.give("bomb")); await wait(p, 600);
      const rocks = await lab(() => window.__cockpitLab.rocks()); const r = rocks.sort((a, c) => Math.abs(a.y - 450) - Math.abs(c.y - 450))[0] || { x: 220, y: 450 };
      await lab(([x, y]) => window.__cockpitLab.bombAt(x, y), [r.x, r.y]); await wait(p, 900); await blast(2, 120); await shot("04_bomb"); },
    freeze: async () => { await level(6); await lab(() => window.__cockpitLab.give("snowflake")); await wait(p, 400);
      await lab(() => galaxyCanvasController.activateFreeze()); await wait(p, 900); await blast(3, 160); await shot("05_freeze"); },
    missile: async () => { await level(8); await lab(() => window.__cockpitLab.give("missile")); await wait(p, 300);
      const rocks = await lab(() => window.__cockpitLab.rocks()); if (rocks[0]) await lab(([x, y]) => window.__cockpitLab.missileAt(x, y), [rocks[0].x, rocks[0].y]);
      await wait(p, 450); await shot("06_missile"); },
    quad: async () => { await level(12); await lab(() => window.__cockpitLab.give("quadshot")); await wait(p, 500); await blast(5, 110); await shot("07_quad"); },
    pulse: async () => { await level(14); await lab(() => window.__cockpitLab.give("pulse")); await wait(p, 500); await blast(4, 150); await shot("08_pulse"); },
    slot: async () => { await level(5); await lab(() => galaxyCanvasController.openSlotMidLevel()); await wait(p, 3500); await shot("09_slot"); },
    chest: async () => { await fresh(); await lab(() => openGalaxyView()); await wait(p, 1500); await lab(() => galaxyCanvasController.devPreviewRewardChest()); await wait(p, 3000); await shot("10_chest"); },
    training: async () => { await fresh(); await lab(() => openGalaxyView()); await wait(p, 1500); await lab(() => galaxyCanvasController.startStuntMode()); await wait(p, 9000); await shot("11_training"); },
    training2: async () => { await wait(p, 9000); await shot("12_training_b"); },
  };
  for (const [name, fn] of Object.entries(scenes)) {
    if (ONLY && !ONLY.split(",").includes(name)) continue;
    try { await fn(); } catch (e) { console.log(name, "FAILED", e.message.slice(0, 200)); }
  }
  console.log(PROF, "errors:", errs.slice(0, 5));
  await b.close();
})();
