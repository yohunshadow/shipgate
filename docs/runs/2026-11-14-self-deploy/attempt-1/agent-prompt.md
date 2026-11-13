<!-- system -->
You are a senior engineer fixing a web app so that its end-to-end tests pass.
Kane CLI (an AI browser tester) ran the user flows and reported a failure. Find the real root cause in the code and fix it.
Never edit *_test.md files and never hard-code expected values.

Reply with a one-sentence diagnosis, then one or more edit blocks in EXACTLY this format:

FILE: relative/path/to/file.js
<<<<<<< SEARCH
exact lines copied from the current file
=======
the replacement lines
>>>>>>> REPLACE

SEARCH must match the current file text exactly (copy it). Keep edits minimal.

<!-- user -->
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

---

# Project files

FILE: app/cart.js
```
// Brew Bar cart logic.
const cart = [];

function cartTotal(lines) {
  let total = 0;
  for (const line of lines) {
    total += line.price;
  }
  return total;
}

function formatMoney(value) {
  return "$" + value;
}

function render() {
  const list = document.getElementById("cart-lines");
  list.innerHTML = "";
  if (cart.length === 0) {
    list.innerHTML = '<li class="empty">Nothing yet.</li>';
  }
  for (const line of cart) {
    const li = document.createElement("li");
    li.textContent = line.name + " · " + "$" + line.price;
    list.appendChild(li);
  }
  document.getElementById("cart-total").textContent = formatMoney(cartTotal(cart));
  document.getElementById("checkout").disabled = cart.length === 0;
}

document.querySelectorAll("button.add").forEach((btn) => {
  btn.addEventListener("click", () => {
    cart.push({ name: btn.dataset.name, price: btn.dataset.price });
    render();
  });
});

document.getElementById("checkout").addEventListener("click", () => {
  document.getElementById("status").textContent =
    "Order placed! Total charged: " + formatMoney(cartTotal(cart));
});

render();

```

FILE: app/index.html
```
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Brew Bar · order ahead</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <header class="top">
    <div class="brand"><span class="dot"></span> Brew Bar</div>
    <span class="tag">order ahead · pick up in 5 min</span>
  </header>

  <main class="layout">
    <section class="menu" aria-label="Menu">
      <h1>What are we drinking?</h1>
      <ul class="items" id="menu">
        <li class="item">
          <div><h2>Iced Latte</h2><p>double shot, oat milk</p></div>
          <span class="price">$4.50</span>
          <button class="add" data-name="Iced Latte" data-price="4.50">Add Iced Latte</button>
        </li>
        <li class="item">
          <div><h2>Butter Croissant</h2><p>baked this morning</p></div>
          <span class="price">$3.00</span>
          <button class="add" data-name="Butter Croissant" data-price="3.00">Add Butter Croissant</button>
        </li>
        <li class="item">
          <div><h2>Matcha Cloud</h2><p>ceremonial grade, foam top</p></div>
          <span class="price">$5.25</span>
          <button class="add" data-name="Matcha Cloud" data-price="5.25">Add Matcha Cloud</button>
        </li>
      </ul>
    </section>

    <aside class="cart" aria-label="Your order">
      <h2>Your order</h2>
      <ul id="cart-lines" class="lines"><li class="empty">Nothing yet.</li></ul>
      <div class="total-row">
        <span>Total</span>
        <strong id="cart-total" data-testid="cart-total">$0.00</strong>
      </div>
      <button id="checkout" class="checkout" disabled>Place order</button>
      <p id="status" class="status" role="status"></p>
    </aside>
  </main>

  <script src="cart.js"></script>
</body>
</html>

```

FILE: app/styles.css
```
:root { --bg:#0f0e0c; --card:#1a1815; --ink:#f4efe6; --mute:#a39b8c; --accent:#d9ff57; --line:#2c2924; }
* { box-sizing: border-box; }
body { margin:0; background:var(--bg); color:var(--ink); font:16px/1.5 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
.top { display:flex; justify-content:space-between; align-items:center; padding:20px 32px; border-bottom:1px solid var(--line); }
.brand { font-weight:800; letter-spacing:-.02em; font-size:20px; display:flex; gap:10px; align-items:center; }
.dot { width:12px; height:12px; border-radius:50%; background:var(--accent); box-shadow:0 0 18px var(--accent); }
.tag { color:var(--mute); font-size:13px; }
.layout { display:grid; grid-template-columns: 1fr 340px; gap:32px; padding:32px; max-width:1040px; margin:0 auto; }
h1 { font-size:40px; letter-spacing:-.03em; margin:0 0 20px; }
.items { list-style:none; padding:0; margin:0; display:grid; gap:12px; }
.item { display:grid; grid-template-columns: 1fr auto auto; gap:16px; align-items:center; background:var(--card); border:1px solid var(--line); border-radius:16px; padding:16px 18px; }
.item h2 { margin:0; font-size:18px; } .item p { margin:2px 0 0; color:var(--mute); font-size:14px; }
.price { font-variant-numeric: tabular-nums; color:var(--mute); }
button { font:inherit; cursor:pointer; border-radius:999px; border:1px solid var(--line); background:#24211d; color:var(--ink); padding:8px 14px; }
button.add:hover { border-color:var(--accent); }
.cart { background:var(--card); border:1px solid var(--line); border-radius:20px; padding:20px; height:fit-content; position:sticky; top:24px; }
.cart h2 { margin:0 0 12px; font-size:18px; }
.lines { list-style:none; padding:0; margin:0 0 16px; display:grid; gap:6px; color:var(--mute); }
.total-row { display:flex; justify-content:space-between; align-items:baseline; border-top:1px dashed var(--line); padding-top:14px; }
.total-row strong { font-size:28px; font-variant-numeric: tabular-nums; }
.checkout { width:100%; margin-top:16px; background:var(--accent); color:#111; border:none; font-weight:700; padding:12px; }
.checkout:disabled { opacity:.35; cursor:not-allowed; }
.status { min-height:1.5em; color:var(--accent); font-size:14px; }
@media (max-width: 760px) { .layout { grid-template-columns:1fr; } }

```