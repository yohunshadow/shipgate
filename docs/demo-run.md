# Demo run: fail → re-prompt → fix → pass → deploy

These are real runs, recorded on 13 Nov 2026 against [`examples/brew-bar`](../examples/brew-bar), a small order-ahead cart with a bug planted on purpose: prices are read from `data-price` attributes as strings, so `total += line.price` concatenates them.

- **Kane CLI** 0.10.4, account `yendkontl`, headless Chrome on Linux
- **Agent:** Ship Gate's built-in agent → `qwen2.5-coder:7b` (Q4_K_M) on local Ollama, CPU only, no cloud LLM
- **Flow:** [`tests/order_total_test.md`](../examples/brew-bar/tests/order_total_test.md), 4 plain-English steps (open menu, add two items, check the total is `$7.50`, place the order)

## Final loop: [`runs/2026-11-13-final-loop`](runs/2026-11-13-final-loop/run.md)

```
attempt 1/3: Kane CLI verifies http://localhost:5199
  step 1 Open the menu         passed (1.45s, replayed from cache)
  step 2 Add two items         passed (1.35s, replayed from cache)
  step 3 Check the cart total  FAILED → adaptive heal re-authored the step → FAILED again
  FAILED · 8.69 credits
  Kane: The cart lists items priced at $4.50 and $3.00, but the displayed total is "$04.503.00" instead of "$7.50".
  Kane root cause: The total display is joining the individual prices together rather than adding them.

re-prompt → agent (builtin:qwen2.5-coder:7b, 55.4s)
  "The root cause is that the cart total is being concatenated as a string instead of being calculated as a sum."
  -    total += line.price;
  +    total += parseFloat(line.price);
  -  return "$" + value;
  +  return "$" + value.toFixed(2);

attempt 2/3: Kane CLI verifies http://localhost:5199
  steps 1–4 passed · 10.96 credits

✔ Kane CLI signed off after 2 attempts · 19.65 credits · fingerprint d6afa1e4571ed3a7
```

- The exact re-prompt the agent received: [`attempt-1/reprompt.md`](runs/2026-11-13-final-loop/attempt-1/reprompt.md) (machine-readable: [`reprompt.json`](runs/2026-11-13-final-loop/attempt-1/reprompt.json))
- The model's raw answer: [`attempt-1/agent-response.md`](runs/2026-11-13-final-loop/attempt-1/agent-response.md). The applied diff: [`fix.diff`](runs/2026-11-13-final-loop/attempt-1/fix.diff)
- The raw Kane NDJSON for each attempt is in `attempt-N/order_total_test.ndjson`
- Kane Test Manager evidence for the passing run: [summary](https://test-manager.lambdatest.com/projects/01M7AV3YP8WCG0N72S5RNYFQWC/test-cases/01M7AW4D93VF6G0PDR7MJ60HQS/dashboard/share/US_X0TIBRYVY66SPQD0S60JB5EVO2ZNZ07N8XJNI82M2891LARREVV8VFOGBXY0IY9I?type=summary&agentView=true&fqdn=summary-page)
- Sign-off: [`signoff.json`](runs/2026-11-13-final-loop/signoff.json)

## Self-deploy, one command: [`runs/2026-11-14-self-deploy`](runs/2026-11-14-self-deploy/run.md)

With `VERCEL_TOKEN` set, a single `shipgate` now does the whole thing, deploy included (14 Nov 2026, 00:06 WIB):

```
attempt 1/3: Kane CLI verifies http://localhost:5199
  step 3 Check the cart total  FAILED (replay, then heal, both failed) · 7.15 credits
  Kane: The cart contains a $4.50 latte and a $3.00 croissant, but the displayed total is malformed rather than $7.50.
re-prompt → agent (builtin:qwen2.5-coder:7b, 51.6s)
  -    total += line.price;            +    total += parseFloat(line.price);
  -  return "$" + value;               +  return "$" + value.toFixed(2);
attempt 2/3: steps 1–4 passed · 11.65 credits
✔ Kane CLI signed off after 2 attempts · 18.8 credits
› deploy: Vercel API → project "shipgate-brew-bar" (3 files, production)
✔ deployed https://shipgate-brew-bar.vercel.app
```

- Deployment `dpl_AaC5jZe7k8KahtSgisB6aMEUeVYp` (production). The Vercel deployment metadata carries the sign-off: `shipgateFingerprint`, `shipgateSignedOffAt`, `shipgateSignedOffBy`, `shipgateGitSha`.
- `shipgate deploy` on its own (sign-off `d6afa1e4571ed3a7` matched the code) also shipped to production, as `dpl_3Pezm6aDw8eBwTvV3HvDRXVwURvc`: [log](runs/2026-11-14-self-deploy/shipgate-deploy.log). With the bug put back, the same command refuses: `code changed since Kane signed off (d6afa1e4571ed3a7 → 2ca5a80f91a3e886)`.
- Two deploy bugs turned up while testing this, and both are fixed. Vercel rejects empty `meta` values, which made the first attempt fail with `400 bad_request`. `shipgate deploy` also didn't print its result.

### Production check, pure replay: [`runs/2026-11-14-production-replay`](runs/2026-11-14-production-replay/terminal.log)

`shipgate verify --url https://shipgate-brew-bar.vercel.app` passed all 4 steps against production with **0 credits**, about 6 seconds of steps, and `replay_decisions: 4, author_decisions: 0`. Kane replayed its recorded flow with `--override-start-url`, so nothing had to be re-authored.

## Deploy (first time, before VERCEL_TOKEN)

The box had no `VERCEL_TOKEN` and no `vercel login`, so Ship Gate correctly stopped at **deploy-ready**. The signed-off files (fingerprint `d6afa1e4571ed3a7`) were then deployed to Vercel production through the Vercel API:

- Production: **https://shipgate-brew-bar.vercel.app**
- Deployment `dpl_45jHsgT5Kupv5943gpNpCUkiP5mB`, project `shipgate-brew-bar`

This was later replaced by Ship Gate deploying by itself (see above).

## Production verify: [`runs/2026-11-13-production-verify`](runs/2026-11-13-production-verify/terminal.log)

`shipgate verify --url https://shipgate-brew-bar.vercel.app`: Kane ran the same flow against production. Step 1's recorded localhost start didn't match, so Kane healed it, and then all 4 steps **passed** (24.27 credits). [Test Manager evidence](https://test-manager.lambdatest.com/projects/01M7AV3YP8WCG0N72S5RNYFQWC/test-cases/01M7AW4D93VF6G0PDR7MJ60HQS/dashboard/share/US_V3OM4Z76RT18V8V8W9UB6RZSL78O208KE01EE92KJG08FKKJ8FZ6AR9HF9W7UZIJ?type=summary&agentView=true&fqdn=summary-page).

Because of this run, Ship Gate now passes `--override-start-url` once a test has recordings, so changing the preview URL no longer costs a heal.

## Earlier runs (kept as evidence)

| Run | What happened | Kane credits |
|---|---|---|
| [first loop](runs/2026-11-13-first-loop/run.md) | First authoring run of the flow. Kane classified the failure as `assertion_error.confirmed_product_bug` (*"Cart total concatenates item prices instead of summing them"*, confidence 0.98). The agent fixed both lines and the second attempt passed. | 57.08 |
| [two bugs, three attempts](runs/2026-11-13-two-bugs-three-attempts/run.md) | The agent fixed only the sum (`parseFloat`). Kane then caught a **second** bug: *"The cart total is displayed as "$7.5" instead of the required "$7.50""*. A second re-prompt led to `toFixed(2)`, and the third attempt passed. | 28.29 |
| (not kept) | Very first try: another app was already on port 4173. Kane reported *"The run opened the Pockets setup site instead of the Brew Bar start page"* (`config_issue`). That's why Ship Gate now picks a free port. The NDJSON is a test fixture: [`test/fixtures/wrong-target.ndjson`](../test/fixtures/wrong-target.ndjson). | 15.14 |

Kane credits used for everything above: **~255** (14 test.md runs: ~199 on 13 Nov, plus 56.3 for the self-deploy runs on 14 Nov).
