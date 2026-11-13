# Ship Gate: Kane CLI blocked this deploy

Attempt 1 of 3. Kane CLI ran your plain-English flows in a real Chrome browser against http://localhost:5199 and 1 of 1 failed. Production deploy is blocked until every flow passes.

## FAILED: tests/order_total_test.md

- **Failed step:** 3 "Check the cart total"
- **What the step asks for:**

  > Verify the element with data-testid "cart-total" shows exactly "$7.50".
  > Store the text of the cart total as 'cart_total'.

- **Kane saw:** The cart contains a $4.50 latte and a $3.00 croissant, but the displayed total is malformed rather than $7.50.
- **Why it stopped:** Final verification failed: "the element with data-testid "cart-total" shows exactly "$7.50""
- **Kane's root cause:** The total display is joining the item prices together instead of adding them into one correctly formatted amount.
- **Kane's notes:** The total display is joining the item prices together instead of adding them into one correctly formatted amount. Fix the cart-total calculation to add numeric item prices first, then format the single result as currency (for example, $7.50). evidence: error_ui_text: $04.503.00
- **Reason code:** `assertion_error.confirmed_product_bug`
- **Assertion failed:** the element with data-testid "cart-total" shows exactly "$7.50"
  - expected: `$7.50`
  - actual on the page: `$04.503.00`
  - element: `internal:testid=[data-testid="cart-total"s]` read via `el(23).textContent`
- **Values Kane captured:** `cart_total` = `$04.503.00`
- **Kane bug triage:** application_issue/ui_data_defect, severity major, confidence 0.99 — "Cart total concatenates item prices instead of calculating sum"
- **What Kane did in that step:**
  - analyze: Reading the cart total from the order summary
  - analyze: Extracting the cart total from the order summary
- **Steps that passed before it:** "Open the menu", "Add two items"
- **Note:** Kane replayed the recorded steps, the replay failed, and an adaptive re-author of the failing tail failed the same way, so this is not a flaky selector.
- **Evidence pack:** `/home/box/.testmuai/kaneai/sessions/0ae00c2d-5936-40e9-8317-40de464149e2/evidence/acb754a1-a53e-4e8f-aeb7-e7a789be3c04.evidence` (view with `kane-cli evidence serve <path>`)

## Your job
1. Find the root cause in the application code and fix it.
2. Do **not** edit any `*_test.md` file, weaken an assertion, or hard-code the expected value. The tests describe what users need.
3. Keep the change minimal. When you are done editing, stop: Ship Gate re-runs Kane CLI and only deploys if every flow passes.