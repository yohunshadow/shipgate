# Ship Gate: Kane CLI blocked this deploy

Attempt 1 of 3. Kane CLI ran your plain-English flows in a real Chrome browser against http://localhost:5199 and 1 of 1 failed. Production deploy is blocked until every flow passes.

## FAILED: tests/order_total_test.md

- **Failed step:** 3 "Check the cart total"
- **What the step asks for:**

  > Verify the element with data-testid "cart-total" shows exactly "$7.50".
  > Store the text of the cart total as 'cart_total'.

- **Why it stopped:** assertion_failed: @ step 3
- **Kane's root cause:** The order summary is joining the individual item prices together rather than adding them into one total.
- **Kane bug triage:** application_issue/ui_data_defect, severity major, confidence 0.99 — "Cart total concatenates item prices instead of summing them"
- **What Kane did in that step:**
  - analyze: Reading the cart total from the order summary
  - analyze: Extracting the cart total text from the order summary
- **Steps that passed before it:** "Open the menu", "Add two items", "Open the menu", "Add two items"
- **Evidence pack:** `/home/box/.testmuai/kaneai/sessions/25e8a643-78f0-45a6-a5f2-d36a05d6a6e6/evidence/e48d4a7c-421a-4bcb-9c77-bc2061c1619c.evidence` (view with `kane-cli evidence serve <path>`)

## Your job
1. Find the root cause in the application code and fix it.
2. Do **not** edit any `*_test.md` file, weaken an assertion, or hard-code the expected value. The tests describe what users need.
3. Keep the change minimal. When you are done editing, stop: Ship Gate re-runs Kane CLI and only deploys if every flow passes.