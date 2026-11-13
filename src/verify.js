// One Kane pass, no fixing. Used by `shipgate verify`, the Claude Code hook and MCP.
import fs from "node:fs";
import path from "node:path";
import { startPreview } from "./preview.js";
import { verifyOnce, stateDir } from "./gate.js";
import { buildReprompt, repromptJson } from "./reprompt.js";
import { fingerprint, } from "./snapshot.js";
import { kaneWhoami } from "./kane.js";
import { gitSha } from "./deploy.js";

export async function verifyAndReprompt(cfg, { attempt = 1, maxAttempts = cfg.maxAttempts } = {}) {
  const id = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const dir = path.join(stateDir(cfg), "verify", id);
  fs.mkdirSync(dir, { recursive: true });
  const preview = await startPreview(cfg);
  let results;
  try { results = await verifyOnce(cfg, { url: preview.url, attemptDir: dir }); }
  finally { await preview.stop(); }
  const passed = results.every((r) => r.status === "passed");
  const credits = Math.round(results.reduce((a, r) => a + r.credits, 0) * 100) / 100;
  if (passed) {
    const signoff = {
      signedOffBy: "kane-cli", kaneUser: kaneWhoami(), at: new Date().toISOString(), fingerprint: fingerprint(cfg), gitSha: gitSha(cfg.root),
      tests: results.map((r) => ({ test: path.relative(cfg.root, r.file), status: r.status, shareUrl: r.shareUrl, evidencePack: r.evidencePack, sessionId: r.sessionId })),
    };
    fs.writeFileSync(path.join(stateDir(cfg), "signoff.json"), JSON.stringify(signoff, null, 2));
    return { passed, credits, results, signoff, dir };
  }
  const meta = { attempt, maxAttempts, root: cfg.root, url: preview.url };
  const md = buildReprompt(results, meta);
  fs.writeFileSync(path.join(dir, "reprompt.md"), md);
  fs.writeFileSync(path.join(dir, "reprompt.json"), JSON.stringify(repromptJson(results, meta), null, 2));
  fs.writeFileSync(path.join(stateDir(cfg), "last-reprompt.md"), md);
  return { passed, credits, results, reprompt: md, dir };
}
