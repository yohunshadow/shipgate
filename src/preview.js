// Gives Kane something to test: a built-in static server, a dev-server command,
// or an existing preview URL (e.g. a Vercel preview deployment).
import http from "node:http";
import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { log } from "./log.js";

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png",
  ".jpg": "image/jpeg", ".ico": "image/x-icon", ".webp": "image/webp", ".txt": "text/plain; charset=utf-8",
};

export function portFree(port) {
  return new Promise((resolve) => {
    const s = net.createServer().once("error", () => resolve(false)).once("listening", () => s.close(() => resolve(true)));
    s.listen(port, "127.0.0.1");
  });
}

export async function pickPort(preferred = 5199) {
  for (let p = preferred; p < preferred + 50; p++) if (await portFree(p)) return p;
  throw new Error("no free port near " + preferred);
}

export function serveStatic(dir, port) {
  const root = path.resolve(dir);
  const server = http.createServer((req, res) => {
    let rel = decodeURIComponent(new URL(req.url, "http://x").pathname);
    let file = path.join(root, rel);
    if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    if (!fs.existsSync(file) && fs.existsSync(file + ".html")) file += ".html";
    if (!fs.existsSync(file)) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(server)));
}

async function waitForUrl(url, ms = 60000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { const r = await fetch(url); if (r.status < 500) return true; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

/** Start the preview described by cfg.preview. Returns { url, stop() }. */
export async function startPreview(cfg) {
  const p = cfg.preview || {};
  if (p.url && !p.command) {
    log.step(`preview: using ${p.url}`);
    return { url: p.url, stop: async () => {} };
  }
  if (p.command) {
    log.step(`preview: starting \`${p.command}\``);
    const child = spawn(p.command, { cwd: cfg.root, shell: true, stdio: "ignore", detached: true });
    const ok = await waitForUrl(p.url, (p.waitSeconds || 60) * 1000);
    if (!ok) { try { process.kill(-child.pid); } catch {} throw new Error(`preview never answered at ${p.url}`); }
    return { url: p.url, stop: async () => { try { process.kill(-child.pid); } catch {} } };
  }
  const dir = path.resolve(cfg.root, p.static || ".");
  const port = await pickPort(p.port || 5199);
  const server = await serveStatic(dir, port);
  const url = `http://localhost:${port}`;
  log.step(`preview: serving ${path.relative(process.cwd(), dir) || "."} at ${url}`);
  return { url, stop: () => new Promise((r) => server.close(() => r())) };
}
