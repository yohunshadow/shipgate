# Ship Gate: Kane CLI blocked this deploy

Attempt 2 of 3. Kane CLI ran your plain-English flows in a real Chrome browser against http://localhost:5199 and 1 of 1 failed. Production deploy is blocked until every flow passes.

## FAILED: tests/order_total_test.md

- **Failed step:** 3 "Check the cart total"
- **What the step asks for:**

  > Verify the element with data-testid "cart-total" shows exactly "$7.50".
  > Store the text of the cart total as 'cart_total'.

- **Kane saw:** The cart total is displayed as "$7.5" instead of the required "$7.50".
- **Why it stopped:** Final verification failed: "the element with data-testid "cart-total" shows exactly "$7.50""
- **Kane's root cause:** The total is calculated correctly for the items in the cart, but the amount is shown without two decimal places.
- **Reason code:** `assertion_error.confirmed_product_bug`
- **Assertion failed:** the element with data-testid "cart-total" shows exactly "$7.50"
  - expected: `$7.50`
  - actual on the page: `$7.5`
  - element: `internal:testid=[data-testid="cart-total"s]` read via `el(23).textContent`
- **Values Kane captured:** `cart_total` = `$7.5`
- **Kane bug triage:** application_issue/ui_data_defect, severity minor, confidence 0.98 — "Cart total omits trailing zero"
- **What Kane did in that step:**
  - analyze: Reading the cart total from the order summary
  - analyze: Extracting the cart total text from the order summary
- **Steps that passed before it:** "Open the menu", "Add two items"
- **Evidence pack:** `/home/box/.testmuai/kaneai/sessions/eea00272-33bc-4c48-a333-49aae82d8e1a/evidence/263cadb5-64f9-4e93-877a-2c4b5acd35ef.evidence` (view with `kane-cli evidence serve <path>`)

## Your job
1. Find the root cause in the application code and fix it.
2. Do **not** edit any `*_test.md` file, weaken an assertion, or hard-code the expected value. The tests describe what users need.
3. Keep the change minimal. When you are done editing, stop: Ship Gate re-runs Kane CLI and only deploys if every flow passes.