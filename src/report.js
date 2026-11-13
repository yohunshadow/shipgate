// Human-readable run log (Markdown) for a gate run.
import fs from "node:fs";
import path from "node:path";

export function writeRunReport(report, runDir) {
  const L = [];
  L.push(`# Ship Gate run ${report.runId}`);
  L.push("");
  L.push(`- Result: **${report.status === "passed" ? "PASSED, Kane CLI signed off" : "BLOCKED"}**${report.deploy ? ` → deploy: **${report.deploy.status}**${report.deploy.url ? ` (${report.deploy.url})` : ""}` : ""}`);
  L.push(`- Kane CLI ${report.kaneVersion} as \`${report.kaneUser}\` · agent: ${report.agent} · preview: ${report.previewUrl}`);
  L.push(`- Attempts: ${report.attempts.length} · Kane credits used: ${report.credits}`);
  L.push(`- Started ${report.startedAt} · finished ${report.finishedAt}`);
  L.push("");
  for (const a of report.attempts) {
    L.push(`## Attempt ${a.attempt}`);
    L.push("");
    L.push(`| Test | Result | Failed step | Kane says | Credits | Evidence |`);
    L.push(`|---|---|---|---|---|---|`);
    for (const r of a.results) {
      L.push(`| \`${r.test}\` | ${r.status === "passed" ? "✅ passed" : "❌ " + r.status} | ${r.failedStep ? `${r.failedStep.index}. ${r.failedStep.heading}` : "—"} | ${(r.status === "passed" ? "" : (r.kane && (r.kane.oneLiner || r.kane.reason)) || "").replace(/\|/g, "\\|").replace(/\n/g, " ")} | ${r.credits} | ${r.shareUrl ? `[Test Manager](${r.shareUrl})` : "—"} |`);
    }
    L.push("");
    if (a.fix) {
      L.push(`**Re-prompt sent to agent:** [\`reprompt.md\`](./attempt-${a.attempt}/reprompt.md) · **Agent:** ${a.fix.agent}${a.fix.diagnosis ? ` · *${a.fix.diagnosis.trim()}*` : ""}`);
      L.push("");
      const diffPath = path.join(runDir, `attempt-${a.attempt}`, "fix.diff");
      if (fs.existsSync(diffPath) && fs.readFileSync(diffPath, "utf8").trim()) {
        L.push("```diff");
        L.push(fs.readFileSync(diffPath, "utf8").trim());
        L.push("```");
        L.push("");
      }
    }
  }
  const p = path.join(runDir, "run.md");
  fs.writeFileSync(p, L.join("\n"));
  return p;
}
