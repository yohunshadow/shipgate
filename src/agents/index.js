// Agent adapters. Ship Gate does not care which agent fixes the code; it only
// needs something that takes the Kane re-prompt and edits files in place.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { builtinFix } from "./builtin.js";
import { log } from "../log.js";

// Presets for agent CLIs. The re-prompt goes in on stdin; {prompt_file} is also
// substituted if a CLI prefers a path.
export const PRESETS = {
  claude: "claude -p --permission-mode acceptEdits --output-format text",
  codex: "codex exec --full-auto -",
  gemini: "gemini --yolo",
  "cursor-agent": 'cursor-agent -p --force "$(cat {prompt_file})"',
  aider: "aider --yes-always --no-auto-commits --message-file {prompt_file}",
};

function runCommand(cmd, cwd, repromptPath, attemptDir) {
  return new Promise((resolve, reject) => {
    const full = cmd.replaceAll("{prompt_file}", JSON.stringify(repromptPath).slice(1, -1));
    log.agent(`$ ${full}`);
    const child = spawn(full, { cwd, shell: true, env: { ...process.env, SHIPGATE_REPROMPT_FILE: repromptPath } });
    const out = fs.createWriteStream(path.join(attemptDir, "agent-output.log"));
    child.stdout.on("data", (d) => { out.write(d); for (const l of d.toString().split("\n")) if (l.trim()) log.agent(l.slice(0, 140)); });
    child.stderr.on("data", (d) => out.write(d));
    child.on("error", reject);
    child.on("close", (code) => { out.end(); resolve(code); });
    fs.createReadStream(repromptPath).pipe(child.stdin);
  });
}

export function describeAgent(cfg) {
  const a = cfg.agent || {};
  if (a.type === "builtin") return `builtin (${process.env.SHIPGATE_LLM_MODEL || a.model || "qwen2.5-coder:7b"})`;
  if (a.type === "command") return `command: ${a.command}`;
  return a.type;
}

/** Hand the re-prompt to the configured agent. Returns a short report. */
export async function fixWithAgent(cfg, repromptMd, ctx) {
  const a = cfg.agent || {};
  const repromptPath = path.join(ctx.attemptDir, "reprompt.md");
  fs.writeFileSync(repromptPath, repromptMd);
  if (a.type === "builtin") return builtinFix(cfg, repromptMd, ctx);
  if (a.type === "none") { log.agent("agent disabled; re-prompt written to " + repromptPath); return { agent: "none", applied: 0 }; }
  const cmd = a.type === "command" ? a.command : PRESETS[a.type];
  if (!cmd) throw new Error(`unknown agent type "${a.type}" (use builtin, command, ${Object.keys(PRESETS).join(", ")})`);
  const code = await runCommand(cmd, cfg.root, repromptPath, ctx.attemptDir);
  return { agent: a.type === "command" ? "command" : a.type, exitCode: code };
}
