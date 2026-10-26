// Pulls React Bits components (official shadcn-style registry at reactbits.dev/r) into src/rb/<Name>/
// and records each component's default props (parsed from its destructured parameter list) so the
// lab can build a control panel automatically. Re-run any time: `npm run pull`.
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
// [name, category] — category decides how the lab mounts it (see src/App.jsx).
export const COMPONENTS = [
  ["Galaxy", "background"], ["Aurora", "background"], ["LightRays", "background"], ["Iridescence", "background"],
  ["Plasma", "background"], ["Threads", "background"], ["Lightning", "background"], ["Orb", "background"],
  ["Particles", "background"], ["DarkVeil", "background"], ["Silk", "background"], ["LiquidEther", "background"],
  ["PrismaticBurst", "background"], ["Prism", "background"], ["Beams", "background"], ["LightPillar", "background"],
  ["Balatro", "background"], ["PixelBlast", "background"], ["Hyperspeed", "transition"], ["LaserFlow", "background"],
  ["ShinyText", "text"], ["GlitchText", "text"], ["DecryptedText", "text"], ["GradientText", "text"], ["FuzzyText", "text"],
  ["TiltedCard", "card"], ["SpotlightCard", "card"], ["ElectricBorder", "card"], ["StarBorder", "button"],
  ["GlareHover", "card"], ["ClickSpark", "wrapper"], ["PixelTransition", "card"],
];

// Pull `name = default` pairs out of the first destructured-props parameter list.
function parseDefaults(src, name) {
  const start = src.search(new RegExp(`(?:const|function)\\s+${name}\\s*=?\\s*\\(\\s*\\{`));
  if (start < 0) return {};
  let i = src.indexOf("{", start), depth = 0, j = i;
  for (; j < src.length; j++) {
    const c = src[j];
    if (c === "{" || c === "[" || c === "(") depth++;
    else if (c === "}" || c === "]" || c === ")") { depth--; if (depth === 0) break; }
  }
  const body = src.slice(i + 1, j);
  // split on top-level commas
  const parts = []; let cur = ""; depth = 0;
  for (const c of body) {
    if ("{[(".includes(c)) depth++;
    if ("}])".includes(c)) depth--;
    if (c === "," && depth === 0) { parts.push(cur); cur = ""; } else cur += c;
  }
  if (cur.trim()) parts.push(cur);
  const out = {};
  for (const p of parts) {
    const m = p.match(/^\s*([A-Za-z_$][\w$]*)\s*=\s*([\s\S]+?)\s*$/);
    if (!m) continue;
    const [, key, raw] = m;
    try { out[key] = JSON.parse(raw.replace(/'/g, '"')); }
    catch {
      if (/^-?\d*\.?\d+$/.test(raw)) out[key] = Number(raw);
      else if (raw === "true" || raw === "false") out[key] = raw === "true";
      else if (/^\[[\d.,\s-]+\]$/.test(raw)) out[key] = JSON.parse(raw);
    }
  }
  return out;
}

const manifest = [];
for (const [name, category] of COMPONENTS) {
  const res = await fetch(`https://reactbits.dev/r/${name}-JS-CSS.json`);
  if (!res.ok) { console.warn(`skip ${name}: HTTP ${res.status}`); continue; }
  const item = await res.json();
  const dir = path.join(ROOT, "src", "rb", name);
  await mkdir(dir, { recursive: true });
  let mainSrc = "";
  for (const f of item.files || []) {
    const file = path.basename(f.path);
    await writeFile(path.join(dir, file), f.content);
    if (file === `${name}.jsx`) mainSrc = f.content;
  }
  manifest.push({ name, category, title: item.title || name, description: item.description || "", deps: item.dependencies || [], defaults: parseDefaults(mainSrc, name) });
  console.log(`✓ ${name}`);
}
await writeFile(path.join(ROOT, "src", "rb", "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`\n${manifest.length} components pulled. Dependencies needed:`, [...new Set(manifest.flatMap((m) => m.deps))].join(" ") || "(none)");
