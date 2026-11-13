# Ship Gate × Claude Code

Two ways to close the loop, use either or both.

## 1. Stop hook (automatic, recommended)

Copy `settings.json` to your project's `.claude/settings.json` (or run `shipgate init --claude`).

Every time Claude Code thinks it is done, the hook runs `shipgate verify --hook claude`:

- Kane CLI runs every `*_test.md` flow in a real Chrome against your local preview.
- **Fail** → the hook exits `2` and writes Kane's re-prompt (failed step, what Kane saw, captured values, evidence link) to stderr. Claude Code treats that as "you are not done" and keeps working on exactly that failure.
- **Pass** → Kane's sign-off is recorded in `.shipgate/signoff.json` and Claude is allowed to stop. `shipgate deploy` will now ship that exact code (and refuses if anything changed since).
- The hook gives up after `maxAttempts` rounds so it can never loop forever.

## 2. MCP tool

`.mcp.json` in your project:

```json
{ "mcpServers": { "shipgate": { "command": "shipgate", "args": ["mcp"] } } }
```

Claude gets `shipgate_verify` and `shipgate_deploy` tools.

## 3. Headless from Ship Gate

Let Ship Gate drive Claude instead: `shipgate --agent claude` pipes each re-prompt into `claude -p --permission-mode acceptEdits`.
