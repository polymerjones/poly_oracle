import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const LAYOUT_FILE = path.join(REPO, "cockpitLayout.js");
const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".svg": "image/svg+xml",
  ".ico": "image/x-icon", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".mp4": "video/mp4", ".mov": "video/quicktime",
  ".webmanifest": "application/manifest+json", ".woff2": "font/woff2",
};

// Cockpit Designer plumbing: /game/* serves the real game (repo root = source of truth, falling back
// to www/ for the assets prepare:web assembles elsewhere), and /__cockpit/{load,save} read/write
// cockpitLayout.js at the repo root.
function cockpitDesigner() {
  return {
    name: "poly-cockpit-designer",
    configureServer(server) {
      server.middlewares.use("/__cockpit/load", (req, res) => {
        try {
          const src = fs.readFileSync(LAYOUT_FILE, "utf8");
          const json = src.slice(src.indexOf("{"), src.lastIndexOf("}") + 1);
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(JSON.parse(json)));
        } catch (err) {
          res.statusCode = 500;
          res.end(String(err));
        }
      });
      server.middlewares.use("/__cockpit/save", (req, res) => {
        if (req.method !== "POST") { res.statusCode = 405; res.end(); return; }
        let body = "";
        req.on("data", (c) => { body += c; });
        req.on("end", () => {
          try {
            const layout = JSON.parse(body);
            const src = fs.readFileSync(LAYOUT_FILE, "utf8");
            const header = src.slice(0, src.indexOf("window.POLY_COCKPIT_LAYOUT"));
            fs.writeFileSync(LAYOUT_FILE, `${header}window.POLY_COCKPIT_LAYOUT = ${formatLayout(layout)};\n`);
            res.end(JSON.stringify({ ok: true, file: LAYOUT_FILE }));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ ok: false, error: String(err) }));
          }
        });
      });
      // Hub Cards "BAKE INTO GAME": {card: pickId} → copy assets/ui/hub/picks/<pickId>.webp over assets/ui/hub/<card>.webp
      server.middlewares.use("/__hubcards/bake", (req, res) => {
        let body = "";
        req.on("data", (c) => { body += c; });
        req.on("end", () => {
          res.setHeader("Content-Type", "application/json");
          try {
            const cards = new Set(["arcade", "stunt", "scores", "cheats", "settings", "news"]);
            const hub = path.join(REPO, "assets/ui/hub");
            const baked = [];
            for (const [card, pick] of Object.entries(JSON.parse(body || "{}"))) {
              if (!cards.has(card) || !/^[a-z0-9_]+$/.test(pick)) throw new Error(`bad pick ${card}=${pick}`);
              fs.copyFileSync(path.join(hub, "picks", `${pick}.webp`), path.join(hub, `${card}.webp`));
              baked.push(`${card}=${pick}`);
            }
            res.end(JSON.stringify({ ok: true, baked }));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ ok: false, error: String(err) }));
          }
        });
      });
      // Sounds "BAKE INTO GAME": {chest: {moment: [layers]}, hub: {...}} → sfxPicks.js at the repo root
      server.middlewares.use("/__sfxpicks/save", (req, res) => {
        let body = "";
        req.on("data", (c) => { body += c; });
        req.on("end", () => {
          res.setHeader("Content-Type", "application/json");
          try {
            const { chest = {}, hub = {} } = JSON.parse(body || "{}");
            const file = path.join(REPO, "sfxPicks.js");
            const src = fs.readFileSync(file, "utf8");
            const header = src.slice(0, src.indexOf("window.POLY_REWARD_BOX_SFX"));
            const block = (name, cfg, moments) => {
              const lines = moments.map((m) => {
                const layers = (Array.isArray(cfg[m]) ? cfg[m] : []).map((l) => {
                  if (!/^[A-Za-z0-9_]+$/.test(l.key || "")) throw new Error(`bad key ${l.key}`);
                  return JSON.stringify(l).replace(/,"/g, ', "').replace(/":/g, '": ');
                });
                return `  "${m}": [${layers.join(", ")}]`;
              });
              return `window.${name} = {\n${lines.join(",\n")}\n};\n`;
            };
            fs.writeFileSync(file, header + block("POLY_REWARD_BOX_SFX", chest, ["arrive", "tap", "open", "collect"]) + block("POLY_HUB_SFX", hub, ["tick", "select", "open"]));
            res.end(JSON.stringify({ ok: true }));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ ok: false, error: String(err) }));
          }
        });
      });
      // Store Shots (2026-10-27): raw captures in store-assets/raw/<profile>/, picks + captions in
      // tools/store-shots.json, finished PNGs (rendered in the browser) → store-assets/appstore/<profile>/NN.png
      const SHOTS_CFG = path.join(REPO, "tools/store-shots.json");
      const SHOT_PROFILES = new Set(["iphone69", "ipad13", "play_phone", "play_tab7", "play_tab10"]);
      const readBody = (req) => new Promise((resolve, reject) => {
        const chunks = [];
        req.on("data", (c) => chunks.push(c));
        req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        req.on("error", reject);
      });
      const sendJson = (res, obj, code = 200) => { res.statusCode = code; res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(obj)); };
      server.middlewares.use("/__storeshots/list", (req, res) => {
        const raw = {};
        for (const p of SHOT_PROFILES) {
          const dir = path.join(REPO, "store-assets/raw", p);
          raw[p] = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".png")).sort()
            .map((f) => ({ file: f, mtime: fs.statSync(path.join(dir, f)).mtimeMs })) : [];
        }
        let config = null;
        try { config = JSON.parse(fs.readFileSync(SHOTS_CFG, "utf8")); } catch { /* first run */ }
        sendJson(res, { raw, config });
      });
      server.middlewares.use("/__storeshots/save", async (req, res) => {
        try {
          const cfg = JSON.parse(await readBody(req));
          fs.writeFileSync(SHOTS_CFG, `${JSON.stringify(cfg, null, 2)}\n`);
          sendJson(res, { ok: true });
        } catch (err) { sendJson(res, { ok: false, error: String(err) }, 500); }
      });
      server.middlewares.use("/__storeshots/export", async (req, res) => {
        try {
          const { profile, index, png, clear } = JSON.parse(await readBody(req));
          if (!SHOT_PROFILES.has(profile)) throw new Error(`bad profile ${profile}`);
          const dir = path.join(REPO, "store-assets/appstore", profile);
          if (clear) fs.rmSync(dir, { recursive: true, force: true });
          fs.mkdirSync(dir, { recursive: true });
          const name = `${String(Number(index)).padStart(2, "0")}.png`;
          fs.writeFileSync(path.join(dir, name), Buffer.from(String(png).replace(/^data:image\/png;base64,/, ""), "base64"));
          sendJson(res, { ok: true, file: path.relative(REPO, path.join(dir, name)) });
        } catch (err) { sendJson(res, { ok: false, error: String(err) }, 500); }
      });
      server.middlewares.use("/__storeshots/capture", async (req, res) => {
        try {
          const { profile, scenes = "" } = JSON.parse(await readBody(req));
          if (!SHOT_PROFILES.has(profile)) throw new Error(`bad profile ${profile}`);
          if (scenes && !/^[a-z0-9_,]+$/.test(scenes)) throw new Error("bad scene list");
          const { execFile } = await import("node:child_process");
          const port = server.config.server.port || 5180;
          const argv = [path.join(REPO, "tools/capture-store-shots.cjs"), profile, ...(scenes ? [scenes] : []), "--base", `http://localhost:${port}/game/`];
          execFile(process.execPath, argv, { cwd: REPO, timeout: 15 * 60 * 1000 }, (err, stdout, stderr) => {
            sendJson(res, { ok: !err, log: `${stdout}${stderr}`.slice(-4000), error: err ? String(err) : undefined }, err ? 500 : 200);
          });
        } catch (err) { sendJson(res, { ok: false, error: String(err) }, 500); }
      });
      server.middlewares.use("/game", (req, res, next) => {
        const rel = decodeURIComponent((req.url || "/").split("?")[0]).replace(/^\/+/, "") || "index.html";
        const file = [path.join(REPO, rel), path.join(REPO, "www", rel)].find((f) => f.startsWith(REPO) && fs.existsSync(f) && fs.statSync(f).isFile());
        if (!file) { res.statusCode = 404; res.end(); return; }
        const size = fs.statSync(file).size;
        res.setHeader("Content-Type", MIME[path.extname(file).toLowerCase()] || "application/octet-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Accept-Ranges", "bytes");
        const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range || "");
        if (range) {
          const start = range[1] ? Number(range[1]) : 0;
          const end = range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
          res.statusCode = 206;
          res.setHeader("Content-Range", `bytes ${start}-${end}/${size}`);
          res.setHeader("Content-Length", end - start + 1);
          fs.createReadStream(file, { start, end }).pipe(res);
          return;
        }
        res.setHeader("Content-Length", size);
        fs.createReadStream(file).pipe(res);
        void next;
      });
    },
  };
}

// one part / panel per line so diffs of cockpitLayout.js stay readable
function formatLayout(layout) {
  const parts = Object.entries(layout.parts || {}).map(([k, v]) => `    ${JSON.stringify(k)}: ${JSON.stringify(v).replace(/,"/g, ', "').replace(/":/g, '": ')}`);
  const panels = (layout.panels || []).map((p) => `    ${JSON.stringify(p).replace(/,"/g, ', "').replace(/":/g, '": ')}`);
  return `{\n  "version": ${layout.version || 1},\n  "parts": {\n${parts.join(",\n")}\n  },\n  "panels": [\n${panels.join(",\n")}\n  ]\n}`;
}

export default defineConfig({ plugins: [react(), cockpitDesigner()], server: { port: 5180 } });
