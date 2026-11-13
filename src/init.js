// `shipgate init`: config, an example flow, and optional agent wiring.
import fs from "node:fs";
import path from "node:path";
import { log } from "./log.js";

const EXAMPLE_TEST = `---
mode: testing
tags: [smoke]
---

# Smoke

## Open the app
Open the start page.
Verify the main heading is visible.
`;

export function init(cwd, o) {
  const write = (rel, body, { json = false, merge = false } = {}) => {
    const p = path.join(cwd, rel);
    if (fs.existsSync(p) && !merge) { log.info(`exists: ${rel}`); return; }
    fs.mkdirSync(path.dirname(p), { recursive: true });
    if (merge && fs.existsSync(p)) {
      const cur = JSON.parse(fs.readFileSync(p, "utf8"));
      cur.hooks = { ...(cur.hooks || {}), ...body.hooks };
      body = cur;
    }
    fs.writeFileSync(p, json ? JSON.stringify(body, null, 2) + "\n" : body);
    log.ok(`wrote ${rel}`);
  };
  write("shipgate.config.json", {
    tests: ["tests"],
    preview: { static: "." },
    agent: { type: o.claude ? "claude" : o.codex ? "codex" : "builtin" },
    maxAttempts: 3,
    deploy: { provider: "vercel", prod: true },
  }, { json: true });
  write("tests/smoke_test.md", EXAMPLE_TEST);
  if (o.claude) {
    write(".claude/settings.json", {
      hooks: { Stop: [{ hooks: [{ type: "command", command: "npx shipgate verify --hook claude", timeout: 900 }] }] },
    }, { json: true, merge: true });
    write(".mcp.json", { mcpServers: { shipgate: { command: "npx", args: ["shipgate", "mcp"] } } }, { json: true });
  }
  if (o.codex) {
    write("AGENTS.md", fs.readFileSync(new URL("../integrations/codex/AGENTS.md", import.meta.url), "utf8"));
  }
  log.ok("next: write your flows in tests/*_test.md, then run `shipgate`");
  return 0;
}
