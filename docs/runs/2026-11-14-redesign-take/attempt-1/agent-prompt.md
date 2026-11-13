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

- **Kane saw:** The cart total displays "$04.503.00" instead of "$7.50" for the two items shown.
- **Why it stopped:** assertion_failed: @ step 3
- **Kane's root cause:** The order summary is putting the item prices together as text rather than adding them into one total.
- **Kane bug triage:** application_issue/ui_data_defect, severity major, confidence 0.99 — "Cart total concatenates item prices"
- **What Kane did in that step:**
  - analyze: Reading the cart total from the order summary
  - analyze: Extracting the cart total text from the order summary
- **Steps that passed before it:** "Open the menu", "Add two items"

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
  <meta name="description" content="Brew Bar: order your iced latte, croissant or matcha ahead and pick it up in five minutes." />
  <meta name="theme-color" content="#f3ead8" />
  <title>Brew Bar · order ahead</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,800&family=Instrument+Sans:wght@400;500;600&family=JetBrains+Mono:wght@500;700&display=swap" />
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <header class="top">
    <div class="brand"><span class="dot" aria-hidden="true"></span> Brew Bar</div>
    <span class="tag">order ahead · pick up in 5 min</span>
  </header>

  <main class="layout">
    <section class="menu" aria-label="Menu">
      <h1>What are we drinking?</h1>
      <ul class="items" id="menu">
        <li class="item item--latte">
          <span class="swatch" aria-hidden="true"></span>
          <div class="info"><h2>Iced Latte</h2><p>double shot, oat milk</p></div>
          <span class="price">$4.50</span>
          <button class="add" data-name="Iced Latte" data-price="4.50">Add Iced Latte</button>
        </li>
        <li class="item item--croissant">
          <span class="swatch" aria-hidden="true"></span>
          <div class="info"><h2>Butter Croissant</h2><p>baked this morning</p></div>
          <span class="price">$3.00</span>
          <button class="add" data-name="Butter Croissant" data-price="3.00">Add Butter Croissant</button>
        </li>
        <li class="item item--matcha">
          <span class="swatch" aria-hidden="true"></span>
          <div class="info"><h2>Matcha Cloud</h2><p>ceremonial grade, foam top</p></div>
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
/* Hallmark · Brew Bar order-ahead · theme: custom "café zine" — cream paper, espresso ink, tangerine accent, matcha for success */
/* Critique: old build was a generic dark template (system font, lime glow dot, grey cards). This one leans on a big characterful
   display face, a printed-receipt cart, and colour swatches per drink so the menu reads like a real café, not a demo. */
/* Note: the middle-dot copy ("order ahead · pick up in 5 min", cart lines) is existing product copy kept verbatim for the Kane tests and cart.js. */
:root {
  --paper: oklch(95.5% 0.025 85);
  --paper-2: oklch(91% 0.035 80);
  --ink: oklch(22% 0.035 45);
  --ink-soft: oklch(42% 0.03 50);
  --line: oklch(84% 0.03 75);
  --accent: oklch(68% 0.2 42);
  --matcha: oklch(55% 0.13 135);
  --latte: oklch(78% 0.07 65);
  --butter: oklch(84% 0.13 88);
  --receipt: oklch(99% 0.006 90);
  --grain: oklch(80% 0.04 70 / .35);
  --display: "Bricolage Grotesque", ui-sans-serif, system-ui, sans-serif;
  --body: "Instrument Sans", ui-sans-serif, system-ui, sans-serif;
  --mono: "JetBrains Mono", ui-monospace, monospace;
  --r-lg: 28px; --r-md: 18px; --r-pill: 999px;
  --dur-micro: 120ms; --dur-short: 220ms; --dur-long: 420ms;
  --ease: cubic-bezier(.2, .8, .2, 1);
}
* { box-sizing: border-box; }
html, body { overflow-x: clip; }
body {
  margin: 0; min-height: 100dvh; background: var(--paper); color: var(--ink);
  font: 400 17px/1.55 var(--body); -webkit-font-smoothing: antialiased;
  background-image: radial-gradient(var(--grain) 1px, transparent 1.2px);
  background-size: 22px 22px;
}

.top {
  max-width: 1160px; margin: 0 auto; padding: 24px clamp(16px, 4vw, 40px);
  display: flex; justify-content: space-between; align-items: center; gap: 16px;
}
.brand { font: 800 26px/1 var(--display); letter-spacing: -0.03em; display: flex; gap: 12px; align-items: center; }
.dot { width: 22px; height: 22px; border-radius: 50% 50% 50% 8px; background: var(--accent); transform: rotate(-12deg); }
.tag { font-size: 15px; color: var(--ink-soft); background: var(--paper-2); border: 1px solid var(--line); padding: 8px 16px; border-radius: var(--r-pill); }

.layout {
  max-width: 1160px; margin: 0 auto; padding: 8px clamp(16px, 4vw, 40px) 64px;
  display: grid; grid-template-columns: minmax(0, 1fr) 380px; gap: 40px; align-items: start;
}
h1 {
  font: 800 clamp(48px, 7.4vw, 104px)/0.92 var(--display); letter-spacing: -0.045em;
  margin: 24px 0 40px; text-wrap: balance; overflow-wrap: break-word; min-width: 0; max-width: 11ch;
}

.items { list-style: none; padding: 0; margin: 0; display: grid; gap: 12px; }
.item {
  display: grid; grid-template-columns: 64px minmax(0, 1fr) auto auto; gap: 16px; align-items: center;
  background: var(--receipt); border: 1.5px solid var(--ink); border-radius: var(--r-lg); padding: 16px;
  box-shadow: 4px 4px 0 var(--ink); transition: transform var(--dur-short) var(--ease), box-shadow var(--dur-short) var(--ease);
}
.item:hover { transform: translate(-2px, -2px); box-shadow: 6px 6px 0 var(--ink); }
.swatch { width: 64px; height: 64px; border-radius: var(--r-md); border: 1.5px solid var(--ink); }
.item--latte .swatch { background: linear-gradient(180deg, var(--paper) 0 30%, var(--latte) 30% 100%); }
.item--croissant .swatch { background: radial-gradient(circle at 35% 35%, var(--receipt) 0 10%, var(--butter) 11% 100%); }
.item--matcha .swatch { background: linear-gradient(180deg, var(--receipt) 0 26%, var(--matcha) 26% 100%); }
.info { min-width: 0; }
.item h2 { margin: 0; font: 800 24px/1.1 var(--display); letter-spacing: -0.02em; }
.item p { margin: 4px 0 0; color: var(--ink-soft); font-size: 15px; }
.price { font: 700 17px/1 var(--mono); font-variant-numeric: tabular-nums; }

button { font: 600 15px/1 var(--body); cursor: pointer; border-radius: var(--r-pill); color: var(--ink); }
button:focus-visible { outline: 3px solid var(--accent); outline-offset: 3px; }
.add {
  border: 1.5px solid var(--ink); background: var(--paper); padding: 12px 20px;
  transition: background-color var(--dur-micro) var(--ease), color var(--dur-micro) var(--ease), transform var(--dur-micro) var(--ease);
}
.add:hover { background: var(--ink); color: var(--paper); }
.add:active { transform: scale(.96); }

.cart {
  position: sticky; top: 24px; background: var(--receipt); color: var(--ink);
  border: 1.5px solid var(--ink); border-radius: var(--r-lg); padding: 28px 24px 24px;
  box-shadow: 6px 6px 0 var(--accent);
}
.cart h2 { margin: 0 0 16px; font: 800 30px/1 var(--display); letter-spacing: -0.03em; }
.lines { list-style: none; padding: 0 0 16px; margin: 0; display: grid; gap: 8px; font: 500 15px/1.4 var(--mono); border-bottom: 2px dashed var(--line); }
.lines .empty { font-family: var(--body); color: var(--ink-soft); }
.total-row { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; padding-top: 16px; font-weight: 600; }
.total-row strong { font: 700 clamp(34px, 4vw, 44px)/1 var(--mono); letter-spacing: -0.03em; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.checkout {
  width: 100%; margin-top: 24px; padding: 20px; border: 1.5px solid var(--ink);
  background: var(--accent); color: var(--ink); font: 800 19px/1 var(--display); letter-spacing: -0.01em;
  box-shadow: 0 4px 0 var(--ink); transition: transform var(--dur-micro) var(--ease), box-shadow var(--dur-micro) var(--ease);
}
.checkout:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 5px 0 var(--ink); }
.checkout:active:not(:disabled) { transform: translateY(3px); box-shadow: 0 1px 0 var(--ink); }
.checkout:disabled { background: var(--paper-2); color: var(--ink-soft); box-shadow: none; cursor: not-allowed; }
.status { min-height: 1.5em; margin: 16px 0 0; font-weight: 600; color: var(--matcha); }

@media (max-width: 860px) {
  .layout { grid-template-columns: minmax(0, 1fr); gap: 28px; }
  .cart { position: static; }
  h1 { margin: 8px 0 28px; }
}
@media (max-width: 520px) {
  .top { flex-direction: column; align-items: flex-start; gap: 12px; }
  .item { grid-template-columns: 52px minmax(0, 1fr) auto; gap: 12px; }
  .swatch { width: 52px; height: 52px; }
  .item h2 { font-size: 20px; }
  .add { grid-column: 1 / -1; width: 100%; padding: 16px; }
}
@media (prefers-reduced-motion: reduce) {
  .item, .add, .checkout { transition: none; }
  .item:hover { transform: none; }
}

```