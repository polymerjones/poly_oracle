const fs = require("fs/promises");
const path = require("path");
const sharp = require("sharp");

const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "assets", "store");
const outPath = path.join(outDir, "google-play-feature-graphic.png");
const currentIconPath = asset("ios", "App", "App", "Assets.xcassets", "AppIcon.appiconset", "AppIcon-512@2x.png");

const W = 1024;
const H = 500;

function asset(...parts) {
  return path.join(root, ...parts);
}

function svgLayer(markup) {
  return Buffer.from(
    `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${markup}</svg>`
  );
}

async function sprite(input, width, rotate = 0, blur = 0) {
  let img = sharp(input).resize({ width, withoutEnlargement: false });
  if (rotate) img = img.rotate(rotate, { background: { r: 0, g: 0, b: 0, alpha: 0 } });
  if (blur) img = img.blur(blur);
  return img.png().toBuffer();
}

async function darkToAlpha(input, width, blur = 0) {
  const { data, info } = await sharp(input)
    .resize({ width })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const alpha = Math.max(0, Math.min(255, ((luma - 8) / 92) * 255));
    data[i + 3] = Math.min(data[i + 3], alpha);
  }

  let img = sharp(data, { raw: info });
  if (blur) img = img.blur(blur);
  return img.png().toBuffer();
}

async function main() {
  await fs.mkdir(outDir, { recursive: true });

  const background = await sharp(asset("assets", "video", "oracle_bg_poster.jpg"))
    .resize(W, H, { fit: "cover", position: "center" })
    .modulate({ brightness: 0.76, saturation: 1.18 })
    .linear(1.05, -6)
    .png()
    .toBuffer();

  const logo = await darkToAlpha(currentIconPath, 492);
  const logoBloom = await darkToAlpha(currentIconPath, 500, 22);

  const roidA = await sprite(asset("astgfx", "roid01.png"), 76, -18);
  const roidB = await sprite(asset("astgfx", "roid02.png"), 94, 21);
  const roidC = await sprite(asset("astgfx", "roid03.png"), 58, 38);
  const hotRoid = await sprite(asset("astgfx", "hotroid01.png"), 72, -31);
  const roidGlow = await sprite(asset("astgfx", "hotroid01.png"), 94, -31, 7);

  const cinematicGrade = svgLayer(`
    <defs>
      <radialGradient id="logoHalo" cx="37%" cy="52%" r="42%">
        <stop offset="0%" stop-color="#d07cff" stop-opacity="0.18"/>
        <stop offset="34%" stop-color="#65f0ff" stop-opacity="0.14"/>
        <stop offset="100%" stop-color="#020613" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="rightBlast" cx="72%" cy="46%" r="22%">
        <stop offset="0%" stop-color="#fff7c8" stop-opacity="0.72"/>
        <stop offset="16%" stop-color="#ff72d5" stop-opacity="0.42"/>
        <stop offset="46%" stop-color="#19e6ff" stop-opacity="0.18"/>
        <stop offset="100%" stop-color="#19e6ff" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="vignette" cx="50%" cy="50%" r="72%">
        <stop offset="54%" stop-color="#000000" stop-opacity="0"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0.58"/>
      </radialGradient>
      <linearGradient id="shot" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#ccfff5" stop-opacity="0"/>
        <stop offset="24%" stop-color="#66ffe6" stop-opacity="0.82"/>
        <stop offset="65%" stop-color="#f9b6ff" stop-opacity="0.55"/>
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="#020611" opacity="0.22"/>
    <rect width="${W}" height="${H}" fill="url(#logoHalo)"/>
    <rect width="${W}" height="${H}" fill="url(#rightBlast)"/>
    <g opacity="0.48" filter="drop-shadow(0 0 10px #55ffe8)">
      <path d="M585 325 C650 295, 704 260, 790 214" stroke="url(#shot)" stroke-width="4.6" stroke-linecap="round" fill="none"/>
      <path d="M604 349 C681 320, 735 282, 835 236" stroke="#52f6ff" stroke-width="1.8" stroke-linecap="round" fill="none" opacity="0.64"/>
      <path d="M730 124 C780 148, 830 152, 892 182" stroke="#ffd978" stroke-width="2" stroke-linecap="round" fill="none" opacity="0.45"/>
    </g>
    <g opacity="0.5">
      <circle cx="764" cy="224" r="64" fill="#ff56be" opacity="0.08"/>
      <circle cx="764" cy="224" r="37" fill="#29e7ff" opacity="0.10"/>
      <circle cx="764" cy="224" r="15" fill="#fff4d6" opacity="0.42"/>
      <path d="M706 210 L822 238 M738 169 L790 279 M714 262 L810 184" stroke="#fff7d7" stroke-width="2.2" stroke-linecap="round" opacity="0.38"/>
    </g>
    <rect width="${W}" height="${H}" fill="url(#vignette)"/>
  `);

  const foregroundGrade = svgLayer(`
    <defs>
      <linearGradient id="bottomShade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#000000" stop-opacity="0"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0.34"/>
      </linearGradient>
      <radialGradient id="orbKick" cx="36%" cy="50%" r="28%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.12"/>
        <stop offset="34%" stop-color="#ff9fe8" stop-opacity="0.11"/>
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#orbKick)"/>
    <rect width="${W}" height="${H}" fill="url(#bottomShade)"/>
  `);

  await sharp(background)
    .composite([
      { input: cinematicGrade, blend: "screen" },
      { input: roidGlow, left: 805, top: 164, blend: "screen", opacity: 0.34 },
      { input: roidA, left: 660, top: 338, blend: "over", opacity: 0.42 },
      { input: roidB, left: 838, top: 168, blend: "over", opacity: 0.52 },
      { input: hotRoid, left: 772, top: 92, blend: "over", opacity: 0.42 },
      { input: logoBloom, left: 42, top: 0, blend: "screen", opacity: 0.62 },
      { input: logo, left: 46, top: 4, blend: "screen", opacity: 1 },
      { input: foregroundGrade, blend: "screen" },
    ])
    .flatten({ background: { r: 2, g: 6, b: 17 } })
    .removeAlpha()
    .toColorspace("srgb")
    .png({ compressionLevel: 9, adaptiveFiltering: true, palette: false })
    .toFile(outPath);

  const meta = await sharp(outPath).metadata();
  const stat = await fs.stat(outPath);
  console.log(`${outPath}`);
  console.log(`${meta.width}x${meta.height} ${meta.format} ${meta.space} ${Math.round(stat.size / 1024)}KB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
