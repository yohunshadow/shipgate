// The loop: verify with Kane → (fail) re-prompt agent → fix → re-verify → (pass) sign off → deploy.
import fs from "node:fs";
import path from "node:path";
import { findTests } from "./config.js";
import { kaneAvailable, kaneWhoami, runTestmd } from "./kane.js";
import { startPreview } from "./preview.js";
import { buildReprompt, repromptJson } from "./reprompt.js";
import { fixWithAgent, describeAgent } from "./agents/index.js";
import { deploy, gitSha } from "./deploy.js";
import { fingerprint, snapshot, diffSince } from "./snapshot.js";
import { writeRunReport } from "./report.js";
import { log, color } from "./log.js";

export function stateDir(cfg) { return path.join(cfg.root, ".shipgate"); }

export async function verifyOnce(cfg, { url, attemptDir }) {
  const tests = findTests(cfg);
  if (!tests.length) throw new Error(`no *_test.md files found in ${[].concat(cfg.tests).join(", ")}`);
  const results = [];
  for (const t of tests) {
    log.step(`kane: ${path.relative(cfg.root, t)}`);
    const r = await runTestmd(t, { url, outDir: attemptDir, cwd: cfg.root, ...cfg.kane });
    const tag = r.status === "passed" ? color.green("PASS") : color.red(r.status.toUpperCase());
    log.raw(`  ${tag} ${path.relative(cfg.root, t)} · ${r.credits} credits${r.failedStep ? ` · failed at "${r.failedStep.heading}"` : ""}`);
    if (r.runEnd && r.status !== "passed") log.info(r.runEnd.oneLiner || r.runEnd.summary || "");
    results.push(r);
  }
  return results;
}

/**
 * Full gate. opts: { fix: bool, deploy: bool, maxAttempts }
 * Returns the run report (also written to .shipgate/runs/<id>/report.json).
 */
export async function runGate(cfg, opts = {}) {
  const maxAttempts = opts.maxAttempts || cfg.maxAttempts || 3;
  log.banner(opts.deploy === false ? "verify" : "verify → fix → deploy");
  const kv = kaneAvailable();
  if (!kv) throw new Error("kane-cli not found. Install: npm i -g @testmuai/kane-cli");
  const who = kaneWhoami();
  if (!who) throw new Error("kane-cli is not logged in. Run: kane-cli login");
  log.info(`kane-cli ${kv} · user ${who} · agent ${describeAgent(cfg)} · max ${maxAttempts} attempts`);

  const runId = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const runDir = path.join(stateDir(cfg), "runs", runId);
  fs.mkdirSync(runDir, { recursive: true });
  const report = { runId, startedAt: new Date().toISOString(), kaneVersion: kv, kaneUser: who, agent: describeAgent(cfg), attempts: [], status: "blocked", root: cfg.root };

  const preview = await startPreview(cfg);
  report.previewUrl = preview.url;
  try {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const attemptDir = path.join(runDir, `attempt-${attempt}`);
      fs.mkdirSync(attemptDir, { recursive: true });
      log.raw("");
      log.step(color.bold(`attempt ${attempt}/${maxAttempts}: Kane CLI verifies ${preview.url}`));
      const results = await verifyOnce(cfg, { url: preview.url, attemptDir });
      const a = { attempt, results: results.map(slim(cfg)), credits: sum(results.map((r) => r.credits)) };
      report.attempts.push(a);
      if (results.every((r) => r.status === "passed")) { report.status = "passed"; break; }
      if (attempt === maxAttempts || opts.fix === false) break;

      const md = buildReprompt(results, { attempt, maxAttempts, root: cfg.root, url: preview.url });
      fs.writeFileSync(path.join(attemptDir, "reprompt.json"), JSON.stringify(repromptJson(results, { attempt, maxAttempts, root: cfg.root, url: preview.url }), null, 2));
      log.raw("");
      log.step(color.bold("re-prompt → agent") + color.dim(`  (${path.relative(process.cwd(), path.join(attemptDir, "reprompt.md"))})`));
      for (const line of md.split("\n").filter((l) => l.startsWith("- **")).slice(0, 6)) log.info(line.replace(/\*\*/g, "").slice(0, 150));
      const before = snapshot(cfg);
      const fix = await fixWithAgent(cfg, md, { attemptDir, attempt });
      const diff = diffSince(cfg, before);
      fs.writeFileSync(path.join(attemptDir, "fix.diff"), diff);
      a.reprompt = path.relative(cfg.root, path.join(attemptDir, "reprompt.md"));
      a.fix = { ...fix, diffLines: diff.split("\n").filter((l) => /^[+-][^+-]/.test(l)).length };
      if (!diff) log.warn("agent made no changes");
      else for (const l of diff.split("\n").filter((l) => /^[+-][^+-]/.test(l)).slice(0, 12)) log.raw("    " + (l[0] === "+" ? color.green(l) : color.red(l)));
    }
  } finally {
    await preview.stop();
  }

  report.credits = sum(report.attempts.map((a) => a.credits));
  if (report.status === "passed") {
    const signoff = {
      signedOffBy: "kane-cli", kaneUser: who, at: new Date().toISOString(), fingerprint: fingerprint(cfg), gitSha: gitSha(cfg.root),
      tests: report.attempts.at(-1).results.map((r) => ({ test: r.test, status: r.status, shareUrl: r.shareUrl })),
    };
    fs.writeFileSync(path.join(stateDir(cfg), "signoff.json"), JSON.stringify(signoff, null, 2));
    report.signoff = signoff;
    log.raw("");
    log.ok(color.bold(`Kane CLI signed off after ${report.attempts.length} attempt(s) · ${report.credits} credits`));
    if (opts.deploy !== false) {
      report.deploy = await deploy(cfg, signoff);
      if (report.deploy.status === "deployed") log.ok(`deployed ${report.deploy.url || ""}`);
      else if (report.deploy.status === "deploy-ready") log.ok(`deploy-ready: ${report.deploy.note}`);
      else log.fail("deploy failed");
    }
  } else {
    log.raw("");
    log.fail(color.bold(`deploy blocked: Kane CLI did not sign off after ${report.attempts.length} attempt(s)`));
  }
  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(runDir, "report.json"), JSON.stringify(report, null, 2));
  const mdPath = writeRunReport(report, runDir);
  log.info(`run log: ${path.relative(process.cwd(), mdPath)}`);
  return report;
}

/** Deploy only if a sign-off exists for exactly the current code. */
export async function deployIfSignedOff(cfg) {
  const p = path.join(stateDir(cfg), "signoff.json");
  if (!fs.existsSync(p)) { log.fail("no Kane sign-off. Run `shipgate` first."); return { status: "refused", why: "no-signoff" }; }
  const s = JSON.parse(fs.readFileSync(p, "utf8"));
  const fp = fingerprint(cfg);
  if (s.fingerprint !== fp) { log.fail(`code changed since Kane signed off (${s.fingerprint} → ${fp}). Re-run \`shipgate\`.`); return { status: "refused", why: "stale-signoff" }; }
  log.ok(`sign-off ${fp} matches current code`);
  return deploy(cfg, s);
}

const sum = (xs) => Math.round(xs.reduce((a, b) => a + (b || 0), 0) * 100) / 100;
const slim = (cfg) => (r) => ({
  test: path.relative(cfg.root, r.file), status: r.status, credits: r.credits, durationS: r.durationS,
  failedStep: r.failedStep ? { index: r.failedStep.index, heading: r.failedStep.heading } : null,
  kane: r.runEnd ? { oneLiner: r.runEnd.oneLiner, reason: r.runEnd.reason, reasonCode: r.runEnd.reasonCode, finalState: r.runEnd.finalState, rootCause: r.runEnd.rootCause } : null,
  bug: r.bug, shareUrl: r.shareUrl, evidencePack: r.evidencePack, sessionId: r.sessionId,
  steps: r.steps.map((s) => ({ index: s.index, heading: s.heading, status: s.status })),
});
