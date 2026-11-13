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
