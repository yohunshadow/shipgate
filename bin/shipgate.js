#!/usr/bin/env node
// shipgate: refuse to deploy until Kane CLI signs off.
import fs from "node:fs";
import path from "node:path";
import { loadConfig } from "../src/config.js";
import { runGate, deployIfSignedOff, stateDir } from "../src/gate.js";
import { verifyAndReprompt } from "../src/verify.js";
import { startMcp } from "../src/mcp.js";
import { log, color } from "../src/log.js";
import { init } from "../src/init.js";

const HELP = `
${color.lime(color.bold("ship gate"))} · refuse to deploy until Kane CLI signs off

Usage
  shipgate [ship]            verify with Kane → re-prompt agent on failure → re-verify → deploy on pass
  shipgate verify            one Kane pass, no fixing (exit 0 pass, 1 blocked); writes a re-prompt
  shipgate verify --hook claude   Claude Code Stop hook: blocks the agent with Kane's re-prompt until flows pass
  shipgate deploy            deploy only if a sign-off exists for exactly the current code
  shipgate reprompt          print the last re-prompt
  shipgate mcp               run as an MCP server (tools: shipgate_verify, shipgate_deploy)
  shipgate init [--claude] [--codex]   add shipgate.config.json, an example *_test.md, agent wiring

Options
  --agent <type>         builtin | claude | codex | gemini | cursor-agent | aider | command | none
  --agent-cmd "<cmd>"    pipe the re-prompt (stdin, or {prompt_file}) to any agent CLI; implies --agent command
  --max-attempts <n>     fix/verify rounds before blocking (default 3)
  --no-deploy            stop after sign-off
  --url <url>            test an already running preview instead of starting one
  --config <file>        config path (default ./shipgate.config.json)
  -C <dir>               run in another directory
`;

function parse(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === "-h" || a === "--help") o.help = true;
    else if (a === "--agent") o.agent = next();
    else if (a === "--agent-cmd") o.agentCmd = next();
    else if (a === "--max-attempts") o.maxAttempts = Number(next());
    else if (a === "--no-deploy") o.noDeploy = true;
    else if (a === "--url") o.url = next();
    else if (a === "--config") o.config = next();
    else if (a === "--hook") o.hook = next();
    else if (a === "-C") o.cwd = next();
    else if (a === "--claude") o.claude = true;
    else if (a === "--codex") o.codex = true;
    else o._.push(a);
  }
  return o;
}

async function readStdinJson() {
  if (process.stdin.isTTY) return {};
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString() || "{}"); } catch { return {}; }
}

async function main() {
  const o = parse(process.argv.slice(2));
  const cmd = o._[0] || "ship";
  if (o.help || cmd === "help") { process.stdout.write(HELP); return 0; }
  if (cmd === "mcp") { startMcp(); return null; }
  const cwd = path.resolve(o.cwd || process.cwd());
  if (cmd === "init") return init(cwd, o);
  const cfg = loadConfig(cwd, o.config);
  if (o.agentCmd) cfg.agent = { type: "command", command: o.agentCmd };
  else if (o.agent) cfg.agent = { ...cfg.agent, type: o.agent };
  if (o.url) cfg.preview = { url: o.url };

  if (cmd === "ship") {
    const r = await runGate(cfg, { maxAttempts: o.maxAttempts, deploy: !o.noDeploy });
    return r.status === "passed" && (!r.deploy || r.deploy.status !== "deploy-failed") ? 0 : 1;
  }
  if (cmd === "verify") {
    if (o.hook === "claude") return claudeHook(cfg);
    log.banner("verify");
    const r = await verifyAndReprompt(cfg);
    if (r.passed) { log.ok(`Kane CLI signed off · ${r.credits} credits`); return 0; }
    process.stdout.write(r.reprompt + "\n");
    log.fail(`blocked · ${r.credits} credits · re-prompt saved to ${path.relative(cwd, path.join(r.dir, "reprompt.md"))}`);
    return 1;
  }
  if (cmd === "deploy") {
    log.banner("deploy");
    const r = await deployIfSignedOff(cfg);
    return r.status === "deployed" || r.status === "deploy-ready" ? 0 : 1;
  }
  if (cmd === "reprompt") {
    const p = path.join(stateDir(cfg), "last-reprompt.md");
    if (!fs.existsSync(p)) { log.warn("no re-prompt yet"); return 1; }
    process.stdout.write(fs.readFileSync(p, "utf8") + "\n");
    return 0;
  }
  process.stdout.write(HELP);
  return 2;
}

// Claude Code "Stop" hook: exit 2 + stderr blocks Claude from finishing and feeds
// it Kane's re-prompt. Capped by maxAttempts so it can never loop forever.
async function claudeHook(cfg) {
  const input = await readStdinJson();
  const counter = path.join(stateDir(cfg), "hook-attempts");
  fs.mkdirSync(stateDir(cfg), { recursive: true });
  let n = input.stop_hook_active && fs.existsSync(counter) ? Number(fs.readFileSync(counter, "utf8")) || 0 : 0;
  n += 1;
  fs.writeFileSync(counter, String(n));
  const r = await verifyAndReprompt(cfg, { attempt: n });
  if (r.passed) {
    fs.rmSync(counter, { force: true });
    process.stdout.write(JSON.stringify({ systemMessage: `Ship Gate: Kane CLI signed off (${r.credits} credits). Run \`shipgate deploy\` to ship.` }) + "\n");
    return 0;
  }
  if (n >= (cfg.maxAttempts || 3)) {
    fs.rmSync(counter, { force: true });
    process.stdout.write(JSON.stringify({ systemMessage: `Ship Gate: still failing after ${n} attempts; deploy stays blocked. See .shipgate/last-reprompt.md` }) + "\n");
    return 0;
  }
  process.stderr.write(r.reprompt + "\n");
  return 2;
}

main().then((code) => { if (code !== null) process.exit(code); }).catch((e) => { log.fail(e.message || String(e)); process.exit(2); });
