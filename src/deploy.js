// The deploy step is pluggable. It only ever runs after Kane CLI signed off.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { log } from "./log.js";

function sh(cmd, cwd, env = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, { cwd, shell: true, env: { ...process.env, ...env } });
    let out = "";
    child.stdout.on("data", (d) => { out += d; for (const l of d.toString().split("\n")) if (l.trim()) log.info(l.slice(0, 140)); });
    child.stderr.on("data", (d) => { out += d; });
    child.on("close", (code) => resolve({ code, out }));
  });
}

export function vercelAuthed() {
  if (process.env.VERCEL_TOKEN) return "token";
  const candidates = [
    path.join(os.homedir(), ".local/share/com.vercel.cli/auth.json"),
    path.join(os.homedir(), "Library/Application Support/com.vercel.cli/auth.json"),
    path.join(os.homedir(), ".vercel/auth.json"),
  ];
  return candidates.some((p) => fs.existsSync(p)) ? "cli-login" : null;
}

/** Deploy after sign-off. Returns { status: "deployed"|"deploy-ready"|"deploy-failed", url? }. */
export async function deploy(cfg, signoff) {
  const d = cfg.deploy || {};
  const dir = path.resolve(cfg.root, d.dir || ".");
  if (d.provider === "none") return { status: "deploy-ready", note: "deploy.provider is none" };
  if (d.provider === "command") {
    log.step(`deploy: \`${d.command}\``);
    const r = await sh(d.command, dir, { SHIPGATE_SIGNOFF: JSON.stringify(signoff) });
    const url = (r.out.match(/https:\/\/\S+/g) || []).pop();
    return { status: r.code === 0 ? "deployed" : "deploy-failed", url, exitCode: r.code };
  }
  // Vercel (default). With VERCEL_TOKEN: REST API, no CLI needed. Else the logged-in vercel CLI.
  if (process.env.VERCEL_TOKEN && d.via !== "cli") return vercelApiDeploy(cfg, dir, signoff);
  const auth = vercelAuthed();
  if (!auth) {
    log.warn("deploy: no VERCEL_TOKEN and no `vercel login` found, so Ship Gate stops at deploy-ready");
    return { status: "deploy-ready", note: "Set VERCEL_TOKEN (or run `vercel login`) and re-run `shipgate deploy` to ship the signed-off build." };
  }
  const args = ["-y", "vercel@latest", "deploy", "--yes"];
  if (d.prod !== false) args.push("--prod");
  if (d.scope) args.push("--scope", d.scope);
  if (process.env.VERCEL_TOKEN) args.push("--token", "$VERCEL_TOKEN");
  log.step(`deploy: vercel ${d.prod !== false ? "--prod" : "(preview)"} from ${path.relative(process.cwd(), dir) || "."}`);
  const r = await sh("npx " + args.join(" "), dir);
  const url = (r.out.match(/https:\/\/[\w.-]+\.vercel\.app\S*/g) || []).pop();
  return { status: r.code === 0 ? "deployed" : "deploy-failed", url, exitCode: r.code };
}

export function gitSha(cwd) {
  const r = spawnSync("git", ["rev-parse", "--short", "HEAD"], { cwd, encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : null;
}

function listFiles(dir) {
  const out = [];
  const walk = (p) => {
    for (const e of fs.readdirSync(p, { withFileTypes: true })) {
      if ([".git", ".shipgate", "node_modules", ".vercel", ".testmuai"].includes(e.name) || e.name.startsWith("output-")) continue;
      const abs = path.join(p, e.name);
      if (e.isDirectory()) walk(abs); else out.push(abs);
    }
  };
  walk(dir);
  return out;
}

/** Deploy `dir` through the Vercel REST API with inline files. */
export async function vercelApiDeploy(cfg, dir, signoff) {
  const d = cfg.deploy || {};
  const files = listFiles(dir).map((abs) => ({ file: path.relative(dir, abs), data: fs.readFileSync(abs).toString("base64"), encoding: "base64" }));
  const name = d.project || path.basename(cfg.root);
  const q = d.teamId ? `?teamId=${encodeURIComponent(d.teamId)}` : d.scope ? `?slug=${encodeURIComponent(d.scope)}` : "";
  log.step(`deploy: Vercel API → project "${name}" (${files.length} files, ${d.prod !== false ? "production" : "preview"})`);
  const body = {
    name, files, ...(d.prod !== false ? { target: "production" } : {}),
    projectSettings: { framework: null, ...(d.outputDirectory ? { outputDirectory: d.outputDirectory } : {}) },
    meta: { shipgateFingerprint: signoff.fingerprint, shipgateSignedOffAt: signoff.at, shipgateKaneEvidence: (signoff.tests[0] || {}).shareUrl || "" },
  };
  const r = await fetch(`https://api.vercel.com/v13/deployments${q}`, {
    method: "POST", headers: { authorization: `Bearer ${process.env.VERCEL_TOKEN}`, "content-type": "application/json" }, body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { log.fail(`Vercel API ${r.status}: ${(j.error && j.error.message) || ""}`); return { status: "deploy-failed", httpStatus: r.status }; }
  const url = `https://${j.alias && j.alias[0] ? j.alias[0] : j.url}`;
  return { status: "deployed", url, deploymentId: j.id, inspectorUrl: j.inspectorUrl };
}
