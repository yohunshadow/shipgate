---
test: ../order_total_test.md
status: passed
started: 2026-11-13T16:36:38.263Z
duration_s: 59
session_id: 7e7c121f-1f29-4be0-a017-d58ae3b9b387
---

# Brew Bar order total — Result

## Open the menu ✓ passed (1.48s)
md5: dca793eaa66f428ebc3b82ec862f56ce
Open the Brew Bar start page.
Verify the heading "What are we drinking?" is visible.

## Add two items ✓ passed (1.39s)
md5: a50c6df51d5ccbff2d020d7ea2e56139
Click the "Add Iced Latte" button.
Click the "Add Butter Croissant" button.

## Check the cart total ✓ passed (25.7s)
md5: a998c417c7b90310e55d8978f887ff5c
Verify the element with data-testid "cart-total" shows exactly "$7.50".
Store the text of the cart total as 'cart_total'.

## Place the order ✓ passed (26.3s)
md5: 1d6662a5fe1d1cb9067d8a6eb1ed68e3
Click the "Place order" button.
Verify the status message contains "Total charged: $7.50".
