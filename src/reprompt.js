// Turns Kane CLI verdicts into the message a coding agent gets back.
// This is the "closed loop": the agent does not get "tests failed", it gets
// which plain-English step broke, what Kane saw, what it extracted, and the
// evidence link, plus the rules (fix the app, never the test).
import fs from "node:fs";
import path from "node:path";

/** Pull the body text under a `## heading` out of a *_test.md file. */
export function stepBody(file, heading) {
  try {
    const md = fs.readFileSync(file, "utf8");
    const lines = md.split("\n");
    const start = lines.findIndex((l) => l.trim() === `## ${heading}`);
    if (start < 0) return null;
    const body = [];
    for (let i = start + 1; i < lines.length && !lines[i].startsWith("## "); i++) body.push(lines[i]);
    return body.join("\n").trim();
  } catch { return null; }
}

export function buildReprompt(results, { attempt, maxAttempts, root, url }) {
  const rel = (f) => path.relative(root, f) || f;
  const failed = results.filter((r) => r.status !== "passed");
  const passed = results.filter((r) => r.status === "passed");
  const L = [];
  L.push(`# Ship Gate: Kane CLI blocked this deploy`);
  L.push("");
  L.push(`Attempt ${attempt} of ${maxAttempts}. Kane CLI ran your plain-English flows in a real Chrome browser against ${url} and ${failed.length} of ${results.length} failed. Production deploy is blocked until every flow passes.`);
  L.push("");
  for (const r of failed) {
    const fs_ = r.failedStep;
    L.push(`## FAILED: ${rel(r.file)}`);
    L.push("");
    if (fs_) {
      L.push(`- **Failed step:** ${fs_.index} "${fs_.heading}"`);
      const body = stepBody(r.file, fs_.heading);
      if (body) L.push(`- **What the step asks for:**\n\n${body.split("\n").map((l) => "  > " + l).join("\n")}\n`);
    }
    if (r.runEnd) {
      if (r.runEnd.oneLiner) L.push(`- **Kane saw:** ${r.runEnd.oneLiner}`);
      if (r.runEnd.reason) L.push(`- **Why it stopped:** ${r.runEnd.reason}`);
      if (r.runEnd.rootCause) L.push(`- **Kane's root cause:** ${r.runEnd.rootCause}`);
      if (r.runEnd.reasonCode) L.push(`- **Reason code:** \`${r.runEnd.reasonCode}\``);
      const fsKeys = Object.keys(r.runEnd.finalState || {});
      if (fsKeys.length) L.push(`- **Values Kane captured:** \`${JSON.stringify(r.runEnd.finalState)}\``);
    }
    if (r.bug) L.push(`- **Kane bug triage:** ${r.bug.family}/${r.bug.category}, severity ${r.bug.severity}, confidence ${r.bug.confidence}${r.bug.title ? ` — "${r.bug.title}"` : ""}`);
    if (fs_ && fs_.actions.length) {
      L.push(`- **What Kane did in that step:**`);
      for (const a of fs_.actions.slice(-8)) L.push(`  - ${a}`);
    }
    const passedSteps = r.steps.filter((s) => s.status === "passed").map((s) => `"${s.heading}"`);
    if (passedSteps.length) L.push(`- **Steps that passed before it:** ${passedSteps.join(", ")}`);
    if (r.shareUrl) L.push(`- **Evidence (Kane Test Manager):** ${r.shareUrl}`);
    if (r.evidencePack) L.push(`- **Evidence pack:** \`${r.evidencePack}\` (view with \`kane-cli evidence serve <path>\`)`);
    if (!r.steps.length && r.stderrTail) L.push(`- **Kane CLI error:**\n\n\`\`\`\n${r.stderrTail}\n\`\`\``);
    L.push("");
  }
  if (passed.length) {
    L.push(`## Passing (do not break these)`);
    for (const r of passed) L.push(`- ${rel(r.file)}`);
    L.push("");
  }
  L.push(`## Your job`);
  L.push(`1. Find the root cause in the application code and fix it.`);
  L.push(`2. Do **not** edit any \`*_test.md\` file, weaken an assertion, or hard-code the expected value. The tests describe what users need.`);
  L.push(`3. Keep the change minimal. When you are done editing, stop: Ship Gate re-runs Kane CLI and only deploys if every flow passes.`);
  return L.join("\n");
}

export function repromptJson(results, meta) {
  return {
    gate: "blocked",
    ...meta,
    failures: results.filter((r) => r.status !== "passed").map((r) => ({
      test: path.relative(meta.root, r.file),
      failedStep: r.failedStep ? { index: r.failedStep.index, heading: r.failedStep.heading, actions: r.failedStep.actions } : null,
      kane: r.runEnd || null,
      bug: r.bug,
      evidence: { shareUrl: r.shareUrl, pack: r.evidencePack, sessionId: r.sessionId },
    })),
  };
}
