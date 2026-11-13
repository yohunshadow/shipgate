# Ship Gate: Kane CLI blocked this deploy

Attempt 1 of 3. Kane CLI ran your plain-English flows in a real Chrome browser against http://localhost:5199 and 1 of 1 failed. Production deploy is blocked until every flow passes.

## FAILED: tests/order_total_test.md

- **Failed step:** 3 "Check the cart total"
- **What the step asks for:**

  > Verify the element with data-testid "cart-total" shows exactly "$7.50".
  > Store the text of the cart total as 'cart_total'.

- **Kane saw:** The cart contains a $4.50 latte and a $3.00 croissant, but the displayed total is malformed rather than $7.50.
- **Why it stopped:** Final verification failed: "the element with data-testid "cart-total" shows exactly "$7.50""
- **Kane's root cause:** The total display is joining the item prices together instead of adding them as money amounts.
- **Reason code:** `assertion_error.confirmed_product_bug`
- **Kane bug triage:** application_issue/ui_data_defect, severity major, confidence 0.98 — "Cart total concatenates item prices instead of summing them"
- **What Kane did in that step:**
  - analyze: Reading the cart total from the order summary
  - analyze: Extracting the cart total from the order summary
- **Steps that passed before it:** "Open the menu", "Add two items"
- **Evidence (Kane Test Manager):** https://test-manager.lambdatest.com/projects/01M7AV3YP8WCG0N72S5RNYFQWC/test-cases/01M7AW4D93VF6G0PDR7MJ60HQS/dashboard/share/US_KA8PQ6L5Q3UQFBZITOVER4RU3E2RBVH4V27RMPB7OWPR5HOYK87YYHRIQ3Z4PCD0?type=summary&agentView=true&fqdn=summary-page
- **Evidence pack:** `/home/box/.testmuai/kaneai/sessions/7514bc39-67ab-48a2-865f-89a26405810f/evidence/67f9869b-6604-4af5-845e-f7ec42cf0b5a.evidence` (view with `kane-cli evidence serve <path>`)

## Your job
1. Find the root cause in the application code and fix it.
2. Do **not** edit any `*_test.md` file, weaken an assertion, or hard-code the expected value. The tests describe what users need.
3. Keep the change minimal. When you are done editing, stop: Ship Gate re-runs Kane CLI and only deploys if every flow passes.