# Ship Gate rules for coding agents

This project ships through **Ship Gate**: nothing deploys until Kane CLI signs off on real browser runs of the flows in `tests/*_test.md`.

- After any change that affects the UI or behaviour, run `npx shipgate verify`.
- If it prints a re-prompt, that is your next task: fix the root cause in the app code. Do **not** edit `*_test.md` files, weaken assertions or hard-code expected values.
- Repeat until `shipgate verify` exits 0 ("Kane CLI signed off").
- Deploy only with `npx shipgate deploy`. It refuses if the code changed after the sign-off.
- Never run `vercel deploy` directly.
