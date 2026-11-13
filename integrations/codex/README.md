# Ship Gate × Codex CLI

- **Driven by Ship Gate:** `shipgate --agent codex` pipes each Kane re-prompt into `codex exec --full-auto -`, then re-verifies.
- **Driven by Codex:** drop `AGENTS.md` into your repo (`shipgate init --codex`). Codex runs `shipgate verify`, reads the re-prompt, fixes, and repeats until Kane signs off.
- **MCP:** add to `~/.codex/config.toml`:

```toml
[mcp_servers.shipgate]
command = "npx"
args = ["shipgate", "mcp"]
```
