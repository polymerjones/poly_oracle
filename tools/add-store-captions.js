/**
 * Store-screenshot caption layers.
 *
 * Renders each marketing caption as a standalone transparent PNG the exact size
 * of a store screenshot, so it can be dropped straight into Photoshop as its own
 * layer over any shot (and re-used as a template when the screenshots get redone).
 *
 *   node tools/add-store-captions.js                  # write overlay layers
 *   node tools/add-store-captions.js --composite store-assets/phone
 *                                                     # also burn flattened previews
 *
 * Settings + caption copy live in tools/store-captions.json (created on first run).
 */

const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");

// This machine has no fontconfig config, so without this every font silently
// falls back to one default face (see tools/fontconfig/fonts.conf). Must be set
// before sharp loads, since fontconfig reads its config at init.
process.env.FONTCONFIG_PATH =
  process.env.FONTCONFIG_PATH || path.join(__dirname, "fontconfig");

const sharp = require("sharp");

const root = path.resolve(__dirname, "..");
const configPath = path.join(__dirname, "store-captions.json");
const overlayDir = path.join(root, "store-assets", "captions");
const compositeDir = path.join(root, "store-assets", "captioned");

const DEFAULT_CONFIG = {
  canvas: { width: 1080, height: 1920 },
  band: {
    height: 320,
    // "scrim" = dark fade that blends into the art, "bar" = flat block, "none" = text only
    style: "scrim",
    color: "#04060f",
    opacity: 0.82,
  },
  text: {
    // Verified to resolve on this machine: DIN Alternate, Arial Narrow,
    // Arial Black, Futura, Helvetica Neue, Optima, Verdana, Georgia,
    // Trebuchet MS, Palatino, Courier New.
    // NOT resolvable here: Impact, DIN Condensed, Avenir Next Condensed.
    // The game's UI face is Rajdhani — drop the .ttf in ~/Library/Fonts and put
    // "Rajdhani" here to match the in-game look exactly.
    font: "DIN Alternate",
    weight: "bold",
    size: 78,
    lineHeight: 88,
    color: "#ffffff",
    letterSpacing: 3,
    uppercase: true,
    top: 104,
    maxCharsPerLine: 22,
  },
  subtitle: {
    enabled: true,
    font: "Arial Narrow",
    weight: "bold",
    size: 38,
    color: "#b9c6d8",
    letterSpacing: 2,
    gap: 18,
  },
  accent: {
    enabled: true,
    color: "#33cfff",
    width: 168,
    thickness: 5,
    gap: 30,
  },
  captions: [
    { title: "Read the Oracle", subtitle: "Every answer bends reality" },
    { title: "Shatter the swarm", subtitle: "Precision beats panic" },
    { title: "Arm the pulse cannon", subtitle: "One shot, total clear" },
    { title: "Freeze time", subtitle: "Then take your shot" },
    { title: "Chain your combos", subtitle: "Multipliers stack fast" },
    { title: "Survive the gauntlet", subtitle: "15 levels, no mercy" },
  ],
};

function xmlEscape(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function slug(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

/** Greedy word wrap — captions are short, so character width is a fine proxy. */
function wrap(text, maxChars) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = w;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function bandMarkup(cfg) {
  const { band, canvas } = cfg;
  if (band.style === "none") return "";
  if (band.style === "bar") {
    return `<rect x="0" y="0" width="${canvas.width}" height="${band.height}" fill="${band.color}" fill-opacity="${band.opacity}"/>`;
  }
  // scrim: solid at the top, fading out over the lower third of the band
  return `
    <defs>
      <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="${band.color}" stop-opacity="${band.opacity}"/>
        <stop offset="62%"  stop-color="${band.color}" stop-opacity="${band.opacity * 0.86}"/>
        <stop offset="100%" stop-color="${band.color}" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="${canvas.width}" height="${band.height}" fill="url(#scrim)"/>`;
}

function overlaySvg(cfg, caption, opts = {}) {
  const { canvas, text, subtitle, accent } = cfg;
  const fontOverride = opts.fontOverride;
  const cx = canvas.width / 2;
  const title = text.uppercase ? String(caption.title).toUpperCase() : String(caption.title);
  const lines = wrap(title, text.maxCharsPerLine);

  let y = text.top + text.size;
  const parts = [opts.noBand ? "" : bandMarkup(cfg)];

  for (const line of lines) {
    parts.push(
      `<text x="${cx}" y="${y}" text-anchor="middle" font-family="${xmlEscape(fontOverride || text.font)}" ` +
        `font-weight="${xmlEscape(text.weight || "normal")}" ` +
        `font-size="${text.size}" fill="${text.color}" letter-spacing="${text.letterSpacing}">${xmlEscape(line)}</text>`
    );
    y += text.lineHeight;
  }

  if (accent.enabled) {
    const ay = y - text.lineHeight + accent.gap;
    parts.push(
      `<rect x="${cx - accent.width / 2}" y="${ay}" width="${accent.width}" ` +
        `height="${accent.thickness}" rx="${accent.thickness / 2}" fill="${accent.color}"/>`
    );
    y = ay + accent.thickness + accent.gap;
  }

  if (subtitle.enabled && caption.subtitle) {
    const sub = String(caption.subtitle).toUpperCase();
    parts.push(
      `<text x="${cx}" y="${y + subtitle.size}" text-anchor="middle" ` +
        `font-family="${xmlEscape(fontOverride || subtitle.font)}" ` +
        `font-weight="${xmlEscape(subtitle.weight || "normal")}" font-size="${subtitle.size}" ` +
        `fill="${subtitle.color}" letter-spacing="${subtitle.letterSpacing}">${xmlEscape(sub)}</text>`
    );
  }

  return Buffer.from(
    `<svg width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}" ` +
      `xmlns="http://www.w3.org/2000/svg">${parts.join("")}</svg>`
  );
}

/** Non-transparent pixel count. */
async function inkCount(input) {
  const { data } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let n = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] > 8) n++;
  return n;
}

/** Ink from the text alone (no band), so an empty/failed render is detectable. */
async function textInk(cfg, caption, fontOverride) {
  const svg = overlaySvg(cfg, caption, { noBand: true, fontOverride });
  return inkCount(await sharp(svg).png().toBuffer());
}

/**
 * Renders the caption twice — once with the configured font, once with a
 * deliberately nonexistent one. Identical output means fontconfig fell back and
 * the chosen typeface is NOT being applied.
 */
async function checkFont(cfg, caption) {
  const [real, bogus] = await Promise.all([
    textInk(cfg, caption),
    textInk(cfg, caption, "__NoSuchFont__QQ"),
  ]);
  return { resolved: real !== bogus, real, bogus };
}

async function loadConfig() {
  if (!fs.existsSync(configPath)) {
    await fsp.writeFile(configPath, `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`);
    console.log(`created ${path.relative(root, configPath)} — edit captions there and re-run`);
    return DEFAULT_CONFIG;
  }
  const cfg = JSON.parse(await fsp.readFile(configPath, "utf8"));
  // shallow-merge so a partial config still works
  return {
    ...DEFAULT_CONFIG,
    ...cfg,
    canvas: { ...DEFAULT_CONFIG.canvas, ...cfg.canvas },
    band: { ...DEFAULT_CONFIG.band, ...cfg.band },
    text: { ...DEFAULT_CONFIG.text, ...cfg.text },
    subtitle: { ...DEFAULT_CONFIG.subtitle, ...cfg.subtitle },
    accent: { ...DEFAULT_CONFIG.accent, ...cfg.accent },
  };
}

async function listShots(dir) {
  const entries = await fsp.readdir(dir);
  return entries
    .filter((f) => /\.(png|jpe?g)$/i.test(f))
    .sort()
    .map((f) => path.join(dir, f));
}

async function main() {
  const args = process.argv.slice(2);
  const ci = args.indexOf("--composite");
  const srcDir = ci >= 0 ? path.resolve(root, args[ci + 1] || "") : null;

  const cfg = await loadConfig();
  const { width, height } = cfg.canvas;
  await fsp.mkdir(overlayDir, { recursive: true });

  // Untexted band alone — the reusable template layer.
  const blank = await sharp(Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${bandMarkup(cfg)}</svg>`
  )).png().toBuffer();
  await fsp.writeFile(path.join(overlayDir, "overlay-00-blank-band.png"), blank);

  // Verify the configured typeface is actually being applied before writing 40 files.
  const fontCheck = await checkFont(cfg, cfg.captions[0]);
  if (fontCheck.resolved) {
    console.log(`font "${cfg.text.font}" ${cfg.text.weight || ""} -> resolved\n`);
  } else {
    console.warn(
      `! font "${cfg.text.font}" did NOT resolve — falling back to a default face.\n` +
        `  Known-good here: DIN Alternate, Arial Narrow, Arial Black, Futura,\n` +
        `  Helvetica Neue, Optima, Verdana, Georgia, Trebuchet MS, Courier New.\n`
    );
  }

  const made = [];
  for (let i = 0; i < cfg.captions.length; i++) {
    const cap = cfg.captions[i];
    const svg = overlaySvg(cfg, cap);
    const buf = await sharp(svg).png().toBuffer();

    const ink = await textInk(cfg, cap);
    if (ink < 500) {
      console.warn(`  ! overlay ${i + 1} has almost no text ink (${ink}px) — check the caption copy`);
    }

    const name = `overlay-${String(i + 1).padStart(2, "0")}-${slug(cap.title)}.png`;
    await fsp.writeFile(path.join(overlayDir, name), buf);
    made.push({ name, buf, cap });
    console.log(`  ${name}  (${ink.toLocaleString()} text px)`);
  }

  console.log(`\n${made.length} caption layers + blank band -> ${path.relative(root, overlayDir)}/`);
  console.log(`canvas ${width}x${height}, transparent outside the band`);

  if (!srcDir) return;

  if (!fs.existsSync(srcDir)) {
    console.error(`\ncomposite source not found: ${srcDir}`);
    process.exitCode = 1;
    return;
  }
  const shots = await listShots(srcDir);
  if (!shots.length) {
    console.error(`\nno images in ${srcDir}`);
    process.exitCode = 1;
    return;
  }

  await fsp.mkdir(compositeDir, { recursive: true });
  const n = Math.min(shots.length, made.length);
  console.log(`\nflattened previews (${n}):`);
  for (let i = 0; i < n; i++) {
    const base = await sharp(shots[i])
      .resize(width, height, { fit: "cover", position: "centre" })
      .toBuffer();
    const out = path.join(
      compositeDir,
      `${String(i + 1).padStart(2, "0")}-${slug(made[i].cap.title)}.png`
    );
    await sharp(base).composite([{ input: made[i].buf, top: 0, left: 0 }]).png().toFile(out);
    console.log(`  ${path.basename(shots[i])} + ${made[i].name} -> ${path.basename(out)}`);
  }
  console.log(`\n-> ${path.relative(root, compositeDir)}/`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
