// Minimal MCP server (stdio, JSON-RPC 2.0) so any MCP-capable agent (Claude Code,
// Cursor, Codex, Windsurf, ...) can call Ship Gate as a tool and get Kane's
// verdict back as its next instruction.
import readline from "node:readline";
import { loadConfig } from "./config.js";
import { verifyAndReprompt } from "./verify.js";
import { deployIfSignedOff } from "./gate.js";
import { setQuiet } from "./log.js";

const TOOLS = [
  {
    name: "shipgate_verify",
    description: "Run the project's Kane CLI *_test.md flows in a real browser against a local preview. Returns PASS (and records a sign-off) or a structured re-prompt describing the failed step, what Kane saw, and evidence links. Call it after every change; fix the app (never the tests) until it passes.",
    inputSchema: { type: "object", properties: { cwd: { type: "string", description: "Project root containing shipgate.config.json" } } },
  },
  {
    name: "shipgate_deploy",
    description: "Deploy the project, but only if Kane CLI signed off on exactly the current code. Refuses otherwise.",
    inputSchema: { type: "object", properties: { cwd: { type: "string" } } },
  },
];

export function startMcp() {
  setQuiet(true);
  const send = (msg) => process.stdout.write(JSON.stringify(msg) + "\n");
  const rl = readline.createInterface({ input: process.stdin });
  rl.on("line", async (line) => {
    let req;
    try { req = JSON.parse(line); } catch { return; }
    const { id, method, params } = req;
    const reply = (result) => id !== undefined && send({ jsonrpc: "2.0", id, result });
    const error = (message) => id !== undefined && send({ jsonrpc: "2.0", id, error: { code: -32000, message } });
    try {
      if (method === "initialize") return reply({ protocolVersion: params?.protocolVersion || "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "shipgate", version: "0.1.0" } });
      if (method === "notifications/initialized") return;
      if (method === "ping") return reply({});
      if (method === "tools/list") return reply({ tools: TOOLS });
      if (method === "tools/call") {
        const cfg = loadConfig(params.arguments?.cwd || process.cwd());
        if (params.name === "shipgate_verify") {
          const r = await verifyAndReprompt(cfg);
          const text = r.passed
            ? `PASS: Kane CLI signed off (${r.credits} credits). Fingerprint ${r.signoff.fingerprint}. You may now call shipgate_deploy.\n` + r.results.map((x) => `- ${x.file}: ${x.shareUrl || ""}`).join("\n")
            : r.reprompt;
          return reply({ content: [{ type: "text", text }], isError: !r.passed });
        }
        if (params.name === "shipgate_deploy") {
          const r = await deployIfSignedOff(cfg);
          return reply({ content: [{ type: "text", text: JSON.stringify(r) }], isError: r.status === "refused" || r.status === "deploy-failed" });
        }
        return error("unknown tool " + params.name);
      }
      if (id !== undefined) error("method not found: " + method);
    } catch (e) { error(String(e.message || e)); }
  });
}
