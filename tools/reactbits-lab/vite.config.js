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
