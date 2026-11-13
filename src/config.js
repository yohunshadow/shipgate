import fs from "node:fs";
import path from "node:path";

export const DEFAULTS = {
  // Directories or files holding Kane CLI *_test.md flows.
  tests: ["tests"],
  // How to get a URL for Kane to test.
  //   { "static": "dist" }                       built-in static server for a folder
  //   { "command": "npm run dev", "url": "http://localhost:3000" }
  //   { "url": "https://my-preview.vercel.app" } an already running preview
  preview: { static: "." },
  // Who fixes failures. See README "Agents".
  agent: { type: "builtin" },
  // Fix → re-verify rounds before Ship Gate gives up and blocks the deploy.
  maxAttempts: 3,
  // What to do once Kane signs off.
  deploy: { provider: "vercel", prod: true },
  kane: { headless: true, timeout: 420, extraArgs: [], onLockConflict: null },
};

export function loadConfig(cwd = process.cwd(), file) {
  const p = path.resolve(cwd, file || "shipgate.config.json");
  let user = {};
  if (fs.existsSync(p)) {
    user = JSON.parse(fs.readFileSync(p, "utf8"));
  }
  const cfg = {
    ...DEFAULTS,
    ...user,
    preview: { ...DEFAULTS.preview, ...(user.preview || {}) },
    agent: { ...DEFAULTS.agent, ...(user.agent || {}) },
    deploy: { ...DEFAULTS.deploy, ...(user.deploy || {}) },
    kane: { ...DEFAULTS.kane, ...(user.kane || {}) },
  };
  if (user.preview && (user.preview.command || user.preview.url) && !user.preview.static) delete cfg.preview.static;
  cfg.root = path.dirname(p);
  cfg.configPath = fs.existsSync(p) ? p : null;
  return cfg;
}

// Expand cfg.tests (dirs/files) into absolute *_test.md paths.
export function findTests(cfg) {
  const out = [];
  const walk = (p) => {
    if (!fs.existsSync(p)) return;
    const st = fs.statSync(p);
    if (st.isFile() && p.endsWith("_test.md")) out.push(p);
    else if (st.isDirectory()) {
      for (const e of fs.readdirSync(p)) {
        if (e.startsWith("output-") || e === "node_modules" || e.startsWith(".")) continue;
        walk(path.join(p, e));
      }
    }
  };
  for (const t of [].concat(cfg.tests)) walk(path.resolve(cfg.root, t));
  return out.sort();
}
