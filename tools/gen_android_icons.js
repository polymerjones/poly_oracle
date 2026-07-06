// Generate Android adaptive launcher icons (2 variants), legacy/round icons,
// nebula background layer, dark splash screens, and circle-masked previews.
// Source: iOS 1024px app icon. Output: scratchpad icons/ tree (copied into res/ after pick).
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const SRC = __dirname + "/../ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png";
const OUT = path.join(__dirname, "icons_out");

// Orb bounds in the 1024 art (eyeballed: spans ~x280-760, y290-770)
const ORB = { cx: 520, cy: 528, r: 245 };
const SAFE = 66 / 108; // adaptive-icon safe zone fraction

const DENSITIES = [
  { dir: "mipmap-mdpi", fg: 108, legacy: 48 },
  { dir: "mipmap-hdpi", fg: 162, legacy: 72 },
  { dir: "mipmap-xhdpi", fg: 216, legacy: 96 },
  { dir: "mipmap-xxhdpi", fg: 324, legacy: 144 },
  { dir: "mipmap-xxxhdpi", fg: 432, legacy: 192 },
];

const SPLASHES = [
  ["drawable", 480, 320],
  ["drawable-land-mdpi", 480, 320], ["drawable-land-hdpi", 800, 480],
  ["drawable-land-xhdpi", 1280, 720], ["drawable-land-xxhdpi", 1600, 960],
  ["drawable-land-xxxhdpi", 1920, 1280],
  ["drawable-port-mdpi", 320, 480], ["drawable-port-hdpi", 480, 800],
  ["drawable-port-xhdpi", 720, 1280], ["drawable-port-xxhdpi", 960, 1600],
  ["drawable-port-xxxhdpi", 1280, 1920],
];

const circleMask = (size, r = size / 2 - 1) => Buffer.from(
  `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="#fff"/></svg>`
);

async function main() {
  fs.rmSync(OUT, { recursive: true, force: true });

  // Orb cutout with alpha (square crop around orb, circle-masked)
  const crop = { left: ORB.cx - ORB.r - 10, top: ORB.cy - ORB.r - 10, size: (ORB.r + 10) * 2 };
  const orb = await sharp(SRC)
    .extract({ left: crop.left, top: crop.top, width: crop.size, height: crop.size })
    .composite([{ input: circleMask(crop.size, crop.size / 2 - 4), blend: "dest-in" }])
    .png().toBuffer();

  // Blurred nebula background (single 432 master, downscaled per density)
  const bgMaster = await sharp(SRC).resize(432, 432).blur(14)
    .modulate({ brightness: 0.55, saturation: 1.1 }).png().toBuffer();

  // Variant B background: darkened nebula + a soft black "pocket" behind the art so the
  // art's dark-space border fades into shadow instead of contrasting with bright nebula.
  // Radial gradient = true drop-shadow falloff (no rect edge to read even when blurred)
  const darkPocket = Buffer.from(
    `<svg width="432" height="432"><defs><radialGradient id="g" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#05040c" stop-opacity="0.95"/>
      <stop offset="55%" stop-color="#05040c" stop-opacity="0.9"/>
      <stop offset="78%" stop-color="#05040c" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="#05040c" stop-opacity="0"/>
    </radialGradient></defs>
    <circle cx="216" cy="216" r="216" fill="url(#g)"/></svg>`
  );
  const bgMirrorMaster = await sharp(bgMaster)
    .modulate({ brightness: 0.82 })
    .composite([{ input: darkPocket }]).png().toBuffer();

  // Variant B art: feather the square border (~80px fade at 1024) so it melts into the
  // blurred bg instead of showing a hard edge. POLY/ORACLE text clears the fade zone.
  const featherMask = await sharp({
    create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{
      input: Buffer.from('<svg width="1024" height="1024"><rect x="52" y="52" width="920" height="920" rx="150" fill="#fff"/></svg>'),
    }])
    .blur(34).png().toBuffer();
  const featheredArt = await sharp(SRC)
    .composite([{ input: featherMask, blend: "dest-in" }]).png().toBuffer();

  for (const d of DENSITIES) {
    const bg = await sharp(bgMaster).resize(d.fg, d.fg).png().toBuffer();
    const bgMirror = await sharp(bgMirrorMaster).resize(d.fg, d.fg).png().toBuffer();
    const orbSized = await sharp(orb).resize(Math.round(d.fg * SAFE), Math.round(d.fg * SAFE)).png().toBuffer();
    const artSized = await sharp(featheredArt).resize(Math.round(d.fg * SAFE), Math.round(d.fg * SAFE)).png().toBuffer();

    const transparent = { create: { width: d.fg, height: d.fg, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } };
    const fgA = await sharp(transparent).composite([{ input: orbSized, gravity: "centre" }]).png().toBuffer();
    const fgB = await sharp(transparent).composite([{ input: artSized, gravity: "centre" }]).png().toBuffer();

    for (const [variant, fgBuf, bgBuf] of [["variantA", fgA, bg], ["variantB", fgB, bgMirror]]) {
      const dir = path.join(OUT, variant, d.dir);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, "ic_launcher_foreground.png"), fgBuf);
      fs.writeFileSync(path.join(dir, "ic_launcher_background.png"), bgBuf);
      // Legacy flattened icons (pre-8.0 launchers + some launcher fallbacks)
      const flat = await sharp(bgBuf).composite([{ input: fgBuf }]).png().toBuffer();
      const legacy = await sharp(flat).resize(d.legacy, d.legacy).png().toBuffer();
      fs.writeFileSync(path.join(dir, "ic_launcher.png"), legacy);
      const round = await sharp(legacy)
        .composite([{ input: circleMask(d.legacy), blend: "dest-in" }]).png().toBuffer();
      fs.writeFileSync(path.join(dir, "ic_launcher_round.png"), round);
    }

    // Circle-masked launcher-style previews at xxxhdpi (worst-case mask)
    if (d.fg === 432) {
      for (const [variant, fgBuf, bgBuf] of [["A", fgA, bg], ["B", fgB, bgMirror]]) {
        const flat = await sharp(bgBuf).composite([{ input: fgBuf }]).png().toBuffer();
        const masked = await sharp(flat)
          .composite([{ input: circleMask(432), blend: "dest-in" }]).png().toBuffer();
        fs.writeFileSync(path.join(OUT, `preview${variant}.png`), masked);
      }
    }
  }

  // Dark splash screens (pre-Android-12 path): black + centered orb
  for (const [dir, w, h] of SPLASHES) {
    const orbD = Math.round(Math.min(w, h) * 0.34);
    const orbSized = await sharp(orb).resize(orbD, orbD).png().toBuffer();
    const buf = await sharp({ create: { width: w, height: h, channels: 3, background: "#000000" } })
      .composite([{ input: orbSized, gravity: "centre" }]).png().toBuffer();
    const outDir = path.join(OUT, "splash", dir);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "splash.png"), buf);
  }

  console.log("done:", OUT);
}

main().catch((e) => { console.error(e); process.exit(1); });
