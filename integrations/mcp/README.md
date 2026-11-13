# Ship Gate MCP server

`shipgate mcp` speaks MCP over stdio (JSON-RPC 2.0) and exposes two tools:

| Tool | What it does |
|---|---|
| `shipgate_verify` | Starts the preview, runs every `*_test.md` with Kane CLI, returns `PASS` + sign-off, or the structured re-prompt (failed step, Kane's reason and root cause, captured `final_state`, Test Manager evidence link). `isError: true` while blocked. |
| `shipgate_deploy` | Deploys only if `.shipgate/signoff.json` matches the current code fingerprint. |

Generic client config (Cursor `.cursor/mcp.json`, Claude Code `.mcp.json`, Windsurf, ...):

```json
{ "mcpServers": { "shipgate": { "command": "shipgate", "args": ["mcp"] } } }
```
