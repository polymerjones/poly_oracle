// 2026-10-26: candidate art for the POLYVERSE hub card ring, picked per card in FX Lab → HUB CARD ART.
// Crops the hi-res commander/SPC portraits to the hub card size (240×330, same as assets/ui/hub/*.webp)
// into assets/ui/hub/picks/. Run: node tools/build-hub-card-picks.js (needs local/commander design/).
// Keep PICKS in sync with HUB_CARD_PICKS in script.js.
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "assets/ui/hub/picks");
const CMDR = "local/commander design";
const SPC = "spc_mug/spc_greeneyes mug";
// [pick id, source file]
const PICKS = [
  ["cmdr_default", `${CMDR}/commander.jpg`],
  ["cmdr_smirk", `${CMDR}/smirk_commander.jpg`],
  ["cmdr_laugh", `${CMDR}/laugh_commander.jpg`],
  ["cmdr_laugh2", `${CMDR}/laugh2_commander.jpg`],
  ["cmdr_angry", `${CMDR}/angry_commander.jpg`],
  ["cmdr_shocked", `${CMDR}/shockd_commander.jpg`],
  ["cmdr_thinking", `${CMDR}/thinking_commander.jpg`],
  ["cmdr_lookleft", `${CMDR}/lookleft_commander.jpg`],
  ["cmdr_lookright", `${CMDR}/lookright_commander.jpg`],
  ["cmdr_eyesdown", `${CMDR}/eyesdown_commander.jpg`],
  ["cmdr_exhausted", `${CMDR}/exhausted_commander.jpg`],
  ["cmdr_lightdmg", `${CMDR}/lightdamage_commander.jpg`],
  ["cmdr_heavydmg", `${CMDR}/heavydamage_commander.jpg`],
  ["cmdr_coffee", `${CMDR}/easteregg_coffee_commander.jpg`],
  ["cmdr_duckface", `${CMDR}/easteregg_duckface_commander.jpg`],
  ["cmdr_tongue", `${CMDR}/easteregg_tongueout_commander.jpg`],
  ["spc_smile_wide", `${SPC}/spc_idle_smile_wide.png`],
  ["spc_smile", `${SPC}/spc_idle_smile.png`],
  ["spc_smirk", `${SPC}/spc_idle_smirk.png`],
  ["spc_warm", `${SPC}/spc_idle_warm.png`],
  ["spc_soft", `${SPC}/spc_idle_soft.png`],
  ["spc_gentle", `${SPC}/spc_idle_gentle.png`],
  ["spc_neutral", `${SPC}/spc_idle_neutral.png`],
  ["spc_alert", `${SPC}/spc_alert.png`],
  ["spc_laugh", `${SPC}/spc_laugh.png`],
  ["spc_praise", `${SPC}/spc_praise.png`],
  ["spc_smile_open", `${SPC}/spc_smile_open.png`],
  ["spc_happy", `${SPC}/spc_talk_happy.png`],
  ["spc_friendly", `${SPC}/spc_talk_friendly.png`],
  ["spc_shades", `${SPC}/spc_shades.png`],
  ["spc_blink", `${SPC}/spc_blink.png`],
];

fs.mkdirSync(OUT, { recursive: true });
(async () => {
  for (const [id, src] of PICKS) {
    const file = path.join(ROOT, src);
    if (!fs.existsSync(file)) { console.warn(`skip ${id}: missing ${src}`); continue; }
    await sharp(file)
      .resize(240, 330, { fit: "cover", position: id.startsWith("spc_") ? "top" : "centre" })
      .webp({ quality: 78 })
      .toFile(path.join(OUT, `${id}.webp`));
  }
  console.log(`${PICKS.length} picks → ${path.relative(ROOT, OUT)}`);
})();
