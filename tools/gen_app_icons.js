// Regenerate every app icon from one square master (2026-10-26, icon v5).
//   node tools/gen_app_icons.js [master.png]   (default: poly_oracle_app_iconv5.png)
// Writes: iOS AppIcon (1024, no alpha), web favicons / apple-touch / android-chrome (also the
// lock-screen Now Playing art), assets/icon-1024.png, the in-app Oracle badge, the Lab copy, and
// Android legacy / round / adaptive (foreground + background) mipmaps. Then run `npm run prepare:web`.
// The v5 art has the title lettered edge to edge, so the Android adaptive foreground shrinks the whole
// icon into the 66dp safe circle with feathered edges over a blurred copy of itself (the launcher
// mask would otherwise crop "POLY ORACLE"). Tiny favicons (16/32/ico) use the centre orb only.
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SRC = path.resolve(ROOT, process.argv[2] || "poly_oracle_app_iconv5.png");
const RES = path.join(ROOT, "android/app/src/main/res");
const DENSITIES = [["mdpi", 48, 108], ["hdpi", 72, 162], ["xhdpi", 96, 216], ["xxhdpi", 144, 324], ["xxxhdpi", 192, 432]];
const ORB_CROP = 0.52; // centre crop (fraction of the side) that holds just the orb

const square = (size) => sharp(SRC).resize(size, size, { fit: "cover" });
const out = (rel) => path.join(ROOT, rel);
const circle = (size, r = size / 2) => Buffer.from(`<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="#fff"/></svg>`);
// rounded-rect alpha with a soft edge, for the adaptive foreground
const feather = (size, inset) => Buffer.from(
  `<svg width="${size}" height="${size}"><defs><filter id="f"><feGaussianBlur stdDeviation="${size * 0.03}"/></filter></defs>`
  + `<rect x="${inset}" y="${inset}" width="${size - inset * 2}" height="${size - inset * 2}" rx="${size * 0.08}" fill="#fff" filter="url(#f)"/></svg>`,
);

async function orb(size) {
  const meta = await sharp(SRC).metadata();
  const side = Math.round(meta.width * ORB_CROP);
  const off = Math.round((meta.width - side) / 2);
  return sharp(SRC).extract({ left: off, top: off, width: side, height: side }).resize(size, size);
}

// ICO wrapping PNG payloads (Vista+ format) — sharp can't write .ico itself.
function ico(pngs) {
  const header = Buffer.alloc(6 + 16 * pngs.length);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(pngs.length, 4);
  let offset = header.length;
  pngs.forEach(({ size, buf }, i) => {
    const e = 6 + i * 16;
    header.writeUInt8(size >= 256 ? 0 : size, e); header.writeUInt8(size >= 256 ? 0 : size, e + 1);
    header.writeUInt16LE(1, e + 4); header.writeUInt16LE(32, e + 6);
    header.writeUInt32LE(buf.length, e + 8); header.writeUInt32LE(offset, e + 12);
    offset += buf.length;
  });
  return Buffer.concat([header, ...pngs.map((p) => p.buf)]);
}

async function main() {
  // iOS + master copies (opaque)
  await square(1024).flatten({ background: "#0b0a1e" }).png().toFile(out("ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"));
  await square(1024).png().toFile(out("assets/icon-1024.png"));
  // web
  for (const [file, size] of [["apple-touch-icon.png", 180], ["android-chrome-192.png", 192], ["android-chrome-512.png", 512], ["favicon.png", 256]]) {
    await square(size).png().toFile(out(file));
  }
  for (const size of [16, 32]) await (await orb(size)).png().toFile(out(`favicon-${size}x${size}.png`));
  const icoPngs = [];
  for (const size of [16, 32, 48]) icoPngs.push({ size, buf: await (await orb(size)).png().toBuffer() });
  fs.writeFileSync(out("favicon.ico"), ico(icoPngs));
  // in-app Oracle badge (menu) + the Lab's copy
  await square(200).png().toFile(out("assets/ui/poly_oracle_icon.png"));
  await square(200).png().toFile(out("tools/reactbits-lab/public/art/poly_oracle_icon.png"));
  // Android
  for (const [d, legacy, fg] of DENSITIES) {
    const dir = path.join(RES, `mipmap-${d}`);
    await square(legacy).png().toFile(path.join(dir, "ic_launcher.png"));
    // round legacy: whole icon shrunk to fit the circle (lettering reaches the corners) over its own blur
    const inner = Math.round(legacy * 0.78);
    const bgRound = await square(legacy).blur(legacy * 0.08).modulate({ brightness: 0.55 }).png().toBuffer();
    const round = await sharp(bgRound)
      .composite([{ input: await sharp(await square(inner).png().toBuffer()).composite([{ input: feather(inner, inner * 0.02), blend: "dest-in" }]).png().toBuffer(), gravity: "center" }, { input: circle(legacy), blend: "dest-in" }])
      .png().toBuffer();
    fs.writeFileSync(path.join(dir, "ic_launcher_round.png"), round);
    // adaptive: 108dp canvas, visible ~72dp, safe circle 66dp → the art is 58/108 of the canvas
    const art = Math.round(fg * 58 / 108);
    const fgArt = await sharp(await square(art).png().toBuffer())
      .composite([{ input: feather(art, art * 0.02), blend: "dest-in" }]).png().toBuffer();
    await sharp({ create: { width: fg, height: fg, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: fgArt, gravity: "center" }]).png().toFile(path.join(dir, "ic_launcher_foreground.png"));
    await square(fg).blur(fg * 0.06).modulate({ brightness: 0.6 }).png().toFile(path.join(dir, "ic_launcher_background.png"));
  }
  console.log("icons written from", path.relative(ROOT, SRC));
}

main().catch((e) => { console.error(e); process.exit(1); });
