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

/** Deploy `dir` through the Vercel REST API with inline files, then wait until it is live. */
export async function vercelApiDeploy(cfg, dir, signoff) {
  const d = cfg.deploy || {};
  const api = "https://api.vercel.com";
  const headers = { authorization: `Bearer ${process.env.VERCEL_TOKEN}`, "content-type": "application/json" };
  const team = d.teamId || process.env.VERCEL_TEAM_ID || process.env.VERCEL_ORG_ID;
  const q = team ? `?teamId=${encodeURIComponent(team)}` : d.scope ? `?slug=${encodeURIComponent(d.scope)}` : "";
  const files = listFiles(dir).map((abs) => ({ file: path.relative(dir, abs).split(path.sep).join("/"), data: fs.readFileSync(abs).toString("base64"), encoding: "base64" }));
  if (!files.length) { log.fail(`deploy: nothing to upload in ${dir}`); return { status: "deploy-failed", why: "empty" }; }
  const name = d.project || path.basename(cfg.root);
  const prod = d.prod !== false;
  log.step(`deploy: Vercel API → project "${name}" (${files.length} files, ${prod ? "production" : "preview"})`);
  const body = {
    name, project: name, files, ...(prod ? { target: "production" } : {}),
    projectSettings: { framework: d.framework ?? null, buildCommand: d.buildCommand ?? null, outputDirectory: d.outputDirectory ?? null, installCommand: d.installCommand ?? null },
    meta: {
      shipgateFingerprint: String(signoff.fingerprint || ""), shipgateSignedOffAt: String(signoff.at || ""),
      shipgateSignedOffBy: `kane-cli:${signoff.kaneUser || ""}`, shipgateGitSha: String(signoff.gitSha || ""),
      shipgateKaneEvidence: String((signoff.tests && signoff.tests[0] && signoff.tests[0].shareUrl) || "").slice(0, 2000),
    },
  };
  // Vercel rejects empty meta values, so drop them.
  for (const [k, v] of Object.entries(body.meta)) if (!v) delete body.meta[k];
  const sep = q ? "&" : "?";
  const r = await fetch(`${api}/v13/deployments${q}${sep}skipAutoDetectionConfirmation=1`, { method: "POST", headers, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { log.fail(`Vercel API ${r.status}: ${(j.error && (j.error.code + " " + j.error.message)) || ""}`); return { status: "deploy-failed", httpStatus: r.status, error: j.error && j.error.code }; }
  log.info(`deployment ${j.id} created (${j.readyState || j.status}), waiting until it is live…`);
  let dep = j;
  const end = Date.now() + (d.waitSeconds || 300) * 1000;
  while (!["READY", "ERROR", "CANCELED"].includes(dep.readyState || dep.status) && Date.now() < end) {
    await new Promise((res) => setTimeout(res, 3000));
    const g = await fetch(`${api}/v13/deployments/${j.id}${q}`, { headers });
    if (g.ok) dep = await g.json();
  }
  const state = dep.readyState || dep.status;
  if (state !== "READY") { log.fail(`deployment ${j.id} ended in ${state}`); return { status: "deploy-failed", deploymentId: j.id, state }; }
  // Prefer the shortest production alias (e.g. project.vercel.app) once aliasing is done.
  let aliases = dep.alias || [];
  if (prod) {
    for (let i = 0; i < 10 && !dep.aliasAssigned; i++) {
      await new Promise((res) => setTimeout(res, 2000));
      const g = await fetch(`${api}/v13/deployments/${j.id}${q}`, { headers });
      if (g.ok) dep = await g.json();
    }
    aliases = dep.alias || aliases;
  }
  const best = [...aliases].sort((a, b) => a.length - b.length)[0];
  return {
    status: "deployed", url: `https://${best || dep.url}`, deploymentUrl: `https://${dep.url}`, deploymentId: dep.id,
    inspectorUrl: dep.inspectorUrl, target: dep.target || (prod ? "production" : "preview"),
  };
}
