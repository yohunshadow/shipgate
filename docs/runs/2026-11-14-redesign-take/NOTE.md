# Note on this run

This is the run recorded for the demo video, after the Brew Bar UI redesign (same flows, same copy, same seeded `cart.js` bug).

- Attempt 1: Kane failed step 3 ("$04.503.00" instead of "$7.50"). Another Test Manager playground session held the account lock, and this run used `--on-lock-conflict wait`, so after the verdict Kane kept polling the lock. After about 2.5 minutes the Kane process was stopped by hand. Its NDJSON verdict was already complete, so Ship Gate built the re-prompt from it, which is why attempt 1 reports `error` / 0 credits.
- Attempt 2: the agent's fix (`parseFloat` + `toFixed(2)`) passed 4/4 steps from Kane's replay cache, with Test Manager in `readonly_fallback`, which means no share link.
- Deploy: `dpl_FgNCkHKtvU4MYzoM34vag4p9o2ZF` → https://shipgate-brew-bar.vercel.app

The demo config now uses `"onLockConflict": "readonly"`.
