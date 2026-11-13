// Runs Kane CLI test.md flows in --agent mode and turns the NDJSON stream into
// a structured verdict Ship Gate (and a coding agent) can act on.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { log } from "./log.js";

export const KANE_BIN = process.env.SHIPGATE_KANE_BIN || "kane-cli";

export function kaneAvailable() {
  const r = spawnSync(KANE_BIN, ["--version"], { encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : null;
}

export function kaneWhoami() {
  const r = spawnSync(KANE_BIN, ["whoami"], { encoding: "utf8" });
  const m = /User\s+(\S+)/.exec(r.stdout || "");
  return r.status === 0 && /Authenticated/.test(r.stdout) ? (m ? m[1] : "authenticated") : null;
}

export function kaneBalance() {
  const r = spawnSync(KANE_BIN, ["balance"], { encoding: "utf8" });
  const m = /credits:\s*([\d.]+)/i.exec(r.stdout || "");
  return m ? Number(m[1]) : null;
}

/**
 * Parse the NDJSON event list of one `kane-cli testmd run --agent` into a verdict.
 * Pure function so it can be unit-tested against recorded runs.
 */
export function parseTestmdEvents(events, file) {
  const res = {
    file,
    status: "error",
    steps: [],
    failedStep: null,
    credits: 0,
    shareUrl: null,
    evidencePack: null,
    sessionId: null,
    bug: null,
    actions: [],
  };
  let current = null;
  let lastRunEnd = null;
  for (const e of events) {
    switch (e.type) {
      case "test_md_step_start": {
        // After an adaptive heal Kane re-runs steps; the newest attempt of a step wins.
        current = { index: e.step_index, heading: e.heading, status: "running", actions: [] };
        const prev = res.steps.findIndex((s) => s.index === e.step_index);
        if (prev >= 0) res.steps.splice(prev, 1, current); else res.steps.push(current);
        break;
      }
      case "test_md_adaptive_heal":
        res.healed = { shrinkCount: e.shrink_count, completeReauthor: e.complete_reauthor };
        break;
      case "step_event":
        if (current && e.event === "action") current.actions.push(`${e.action_type || "action"}: ${e.detail}${e.success === false ? " (FAILED)" : ""}`);
        break;
      case "run_end":
        lastRunEnd = e;
        res.credits += Number(e.credits_consumed || e.credits || 0);
        if (current) current.runEnd = e;
        break;
      case "test_md_bug_verdict":
        res.bug = {
          title: e.bug_title, confirmed: e.confirmed, family: e.family, category: e.category,
          severity: e.severity, confidence: e.confidence, oneLiner: e.one_liner,
        };
        break;
      case "test_md_step_end":
        if (current && current.index === e.step_index) {
          current.status = e.status;
          current.durationS = e.duration_s;
          if (e.status === "failed") res.failedStep = current;
        }
        break;
      case "test_md_summary":
        res.summary = e.steps;
        res.shareUrl = e.share_url || res.shareUrl;
        res.testcaseId = e.commit && e.commit.testcase_id;
        break;
      case "coverage":
        if (e.pack) res.evidencePack = e.pack;
        break;
      case "test_md_done":
        res.status = e.overall_status;
        res.shareUrl = e.share_url || res.shareUrl;
        res.sessionId = e.session_id;
        res.durationS = e.duration_s;
        break;
      default:
        break;
    }
  }
  res.failedStep = res.steps.filter((s) => s.status === "failed").at(-1) || null;
  const re = (res.failedStep && res.failedStep.runEnd) || lastRunEnd;
  if (re) {
    res.runEnd = {
      status: re.status, oneLiner: re.one_liner, summary: re.summary, reason: re.reason,
      reasonCode: re.reason_code, finalState: re.final_state || {},
      rootCause: re.verdict && re.verdict.root_cause,
      verdictFamily: re.verdict && re.verdict.family,
      sessionDir: re.session_dir,
      assertions: assertionsFrom(re),
    };
  }
  if (res.status === "error" && res.steps.length && res.steps.every((s) => s.status === "passed")) res.status = "passed";
  res.credits = Math.round(res.credits * 100) / 100;
  return res;
}

/** Expected-vs-actual checks Kane recorded in run_end.context.memory (non-secret only). */
export function assertionsFrom(runEnd) {
  const mem = (runEnd.context && runEnd.context.memory) || {};
  const vars = (runEnd.context && runEnd.context.variables) || {};
  const out = [];
  for (const [name, m] of Object.entries(mem)) {
    if (!m || typeof m !== "object" || (vars[name] && vars[name].secret)) continue;
    const failed = /->\s*FAIL\b/.test(m.reasoning || "");
    const passed = /->\s*PASS\b/.test(m.reasoning || "");
    out.push({
      name, condition: m.condition, expected: m.expected_value || null, actual: m.extracted_value,
      result: failed ? "FAIL" : passed ? "PASS" : "stored", locator: (m.locators || [])[0] || null, code: m.code_js || null,
    });
  }
  return out;
}

/** Run one *_test.md through Kane CLI against `url`. Streams progress, saves raw NDJSON. */
export function runTestmd(file, { url, outDir, headless = true, timeout = 420, extraArgs = [], cwd, onLockConflict } = {}) {
  const args = ["testmd", "run", file, "--agent"];
  // Once Kane has recordings, retarget the replay instead of re-authoring step 1
  // when the preview URL changes (local port, Vercel preview, production).
  const recorded = fs.existsSync(path.join(path.dirname(file), `output-${path.basename(file, ".md").replace(/_test$/, "")}`, ".internal", "meta.json"));
  if (url) args.push(recorded ? "--override-start-url" : "--url", url);
  if (headless) args.push("--headless");
  if (timeout) args.push("--timeout", String(timeout));
  // Test Manager holds a short-lived lock per test. "wait" makes Kane wait for it so
  // a passing run is committed and gets a shareable evidence link instead of running readonly.
  if (onLockConflict) args.push("--on-lock-conflict", onLockConflict);
  args.push(...extraArgs);
  fs.mkdirSync(outDir, { recursive: true });
  const stem = path.basename(file, ".md");
  const rawPath = path.join(outDir, `${stem}.ndjson`);
  const raw = fs.createWriteStream(rawPath);
  const events = [];
  return new Promise((resolve) => {
    const child = spawn(KANE_BIN, args, { cwd: cwd || path.dirname(file), env: process.env, stdio: ["ignore", "pipe", "pipe"] });
    let buf = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      raw.write(chunk);
      buf += chunk.toString();
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!line.startsWith("{")) continue;
        try {
          const e = JSON.parse(line);
          events.push(e);
          if (e.type === "test_md_step_start") log.kane(`step ${e.step_index}: ${e.heading}`);
          else if (e.type === "test_md_step_end") log.kane(`step ${e.step_index} ${e.status === "passed" ? "passed" : e.status.toUpperCase()} (${e.duration_s}s)`);
          else if (e.type === "step_event" && e.event === "action") log.kane(`  ${e.action_type}: ${String(e.detail).slice(0, 90)}`);
        } catch { /* non-JSON noise */ }
      }
    });
    child.stderr.on("data", (d) => {
      stderr += d.toString();
      for (const l of d.toString().split("\n")) if (l.startsWith("[lock]")) log.kane(l.replace("[lock] ", "test manager lock: "));
    });
    child.on("close", (code) => {
      raw.end();
      fs.writeFileSync(path.join(outDir, `${stem}.stderr.log`), stderr);
      const res = parseTestmdEvents(events, file);
      res.exitCode = code;
      res.rawPath = rawPath;
      if (!res.evidencePack) {
        const m = /evidence serve (\S+\.evidence)/.exec(stderr);
        if (m) res.evidencePack = m[1];
      }
      if (code !== 0 && res.status === "passed") res.status = "failed";
      if (code === 2 && !events.length) res.status = "error";
      res.stderrTail = stderr.split("\n").filter(Boolean).slice(-5).join("\n");
      resolve(res);
    });
  });
}
