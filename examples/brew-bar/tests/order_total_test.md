---
mode: testing
tags: [smoke, checkout]
---

# Brew Bar order total

## Open the menu
Open the Brew Bar start page.
Verify the heading "What are we drinking?" is visible.

## Add two items
Click the "Add Iced Latte" button.
Click the "Add Butter Croissant" button.

## Check the cart total
Verify the element with data-testid "cart-total" shows exactly "$7.50".
Store the text of the cart total as 'cart_total'.

## Place the order
Click the "Place order" button.
Verify the status message contains "Total charged: $7.50".
