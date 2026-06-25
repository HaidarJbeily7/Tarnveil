import { GAME } from "@tarnveil/shared/game.config";
import { createButton, createPanel, createTabs } from "../components/index.js";
import "./market.css";

interface Listing {
  id: string;
  item: string;
  qty: number;
  price: number;
}

const SAMPLE_LISTINGS: Listing[] = [
  { id: "L1", item: "Oak log", qty: 50, price: 120 },
  { id: "L2", item: "Stone", qty: 30, price: 90 },
  { id: "L3", item: "Trout", qty: 12, price: 60 },
  { id: "L4", item: "Hide", qty: 4, price: 200 },
];

const TREASURY_BPS = 500;
const TOTAL_BPS = 10_000;
const MOCK_TOKEN_USD = 0.42; // pretend quote: 1 token = $0.42

export function mountMarket(target: HTMLElement = document.body): () => void {
  const root = document.createElement("div");
  root.className = "market";
  root.setAttribute("data-testid", "market-screen");

  const title = document.createElement("h1");
  title.className = "market__title";
  title.textContent = "Marketplace";
  root.appendChild(title);

  const panel = createPanel({ ariaLabel: "marketplace" });
  panel.classList.add("market__panel");

  const body = document.createElement("div");
  body.setAttribute("data-testid", "market-body");

  let active = "browse";
  const tabs = createTabs({
    tabs: [
      { id: "browse", label: "Browse" },
      { id: "list", label: "List item" },
      { id: "bridge", label: `Gold → ${GAME.tokenSymbol}` },
    ],
    onChange: (id) => {
      active = id;
      paint();
    },
  });
  panel.appendChild(tabs.root);
  panel.appendChild(body);

  function paint(): void {
    body.replaceChildren();
    if (active === "browse") paintBrowse(body);
    else if (active === "list") paintList(body);
    else paintBridge(body);
  }
  paint();

  root.appendChild(panel);
  target.appendChild(root);
  return () => root.remove();
}

function paintBrowse(host: HTMLElement): void {
  const filters = document.createElement("div");
  filters.className = "market__filters";
  filters.setAttribute("data-testid", "market-filters");
  const input = document.createElement("input");
  input.type = "search";
  input.placeholder = "Filter by item…";
  input.setAttribute("aria-label", "filter by item");
  input.className = "market__filter-input";
  Object.assign(input.style, {
    flex: "1",
    background: "color-mix(in srgb, var(--ink) 60%, transparent)",
    border: "1px solid var(--hairline)",
    borderRadius: "var(--radius-sm)",
    padding: "var(--space-1) var(--space-2)",
    color: "var(--mist)",
    fontFamily: "var(--font-body)",
  });
  filters.appendChild(input);
  host.appendChild(filters);

  const list = document.createElement("div");
  list.setAttribute("data-testid", "market-listings");
  function render(): void {
    list.replaceChildren();
    const q = input.value.toLowerCase().trim();
    for (const l of SAMPLE_LISTINGS) {
      if (q !== "" && !l.item.toLowerCase().includes(q)) continue;
      const row = document.createElement("div");
      row.className = "market__row";
      const name = document.createElement("b");
      name.textContent = l.item;
      const qty = document.createElement("span");
      qty.className = "qty";
      qty.textContent = `×${l.qty}`;
      const price = document.createElement("span");
      price.className = "price";
      price.textContent = `${l.price} gold`;
      const buy = createButton({ label: "Buy", variant: "primary", size: "small" });
      buy.setAttribute("data-testid", `market-buy-${l.id}`);
      row.appendChild(name);
      row.appendChild(qty);
      row.appendChild(price);
      row.appendChild(buy);
      list.appendChild(row);
    }
  }
  render();
  input.addEventListener("input", render);
  host.appendChild(list);
}

function paintList(host: HTMLElement): void {
  const form = document.createElement("form");
  form.className = "market__list-form";
  form.setAttribute("data-testid", "market-list-form");

  const item = makeLabel("Item kind", "wood");
  const qty = makeLabel("Quantity", "10", "number");
  const price = makeLabel("Total gold price", "200", "number");
  form.appendChild(item.row);
  form.appendChild(qty.row);
  form.appendChild(price.row);

  const submit = createButton({ label: "List for sale", variant: "primary", type: "submit" });
  form.appendChild(submit);

  const escrow = document.createElement("div");
  escrow.className = "market__escrow";
  escrow.setAttribute("data-testid", "market-escrow");
  escrow.hidden = true;
  form.appendChild(escrow);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    escrow.hidden = false;
    escrow.textContent = `${qty.input.value} ${item.input.value} held in escrow; buyers pay ${price.input.value} gold.`;
  });
  host.appendChild(form);
}

function paintBridge(host: HTMLElement): void {
  const row = document.createElement("div");
  row.className = "market__bridge-row";
  const gold = makeLabel("Gold to sell", "1000", "number");
  const usd = makeLabel("Quote USD price", "20.00", "number", "0.01");
  row.appendChild(gold.row);
  row.appendChild(usd.row);
  host.appendChild(row);

  const quote = document.createElement("dl");
  quote.className = "market__quote";
  quote.setAttribute("data-testid", "bridge-quote");
  const tokenTotal = document.createElement("dd");
  tokenTotal.className = "total";
  tokenTotal.setAttribute("data-testid", "bridge-token-total");
  const sellerCut = document.createElement("dd");
  sellerCut.className = "seller";
  sellerCut.setAttribute("data-testid", "bridge-seller");
  const treasuryCut = document.createElement("dd");
  treasuryCut.className = "treasury";
  treasuryCut.setAttribute("data-testid", "bridge-treasury");

  function updateQuote(): void {
    const totalUsd = parseFloat(usd.input.value);
    if (!Number.isFinite(totalUsd) || totalUsd <= 0) return;
    const tokenAmount = totalUsd / MOCK_TOKEN_USD;
    const treasury = (tokenAmount * TREASURY_BPS) / TOTAL_BPS;
    const seller = tokenAmount - treasury;
    quote.replaceChildren();
    addRow(quote, "Quoted at", `${MOCK_TOKEN_USD.toFixed(4)} USD / ${GAME.tokenSymbol}`);
    addRow(quote, `Buyer pays`, `${tokenAmount.toFixed(2)} ${GAME.tokenSymbol}`, tokenTotal);
    addRow(quote, "Seller receives (95%)", `${seller.toFixed(2)} ${GAME.tokenSymbol}`, sellerCut);
    addRow(quote, "Treasury receives (5%)", `${treasury.toFixed(2)} ${GAME.tokenSymbol}`, treasuryCut);
  }
  updateQuote();
  usd.input.addEventListener("input", updateQuote);
  gold.input.addEventListener("input", updateQuote);
  host.appendChild(quote);

  const sign = createButton({ label: "Sign + send tx", variant: "primary" });
  sign.setAttribute("data-testid", "bridge-sign");
  host.appendChild(sign);

  const status = document.createElement("p");
  status.className = "market__settle-status";
  status.setAttribute("data-testid", "bridge-status");
  status.setAttribute("data-state", "idle");
  status.textContent = "";
  host.appendChild(status);

  sign.addEventListener("click", () => {
    status.setAttribute("data-state", "pending");
    status.textContent = "Awaiting on-chain confirmation…";
    setTimeout(() => {
      status.setAttribute("data-state", "confirmed");
      status.textContent = "Confirmed. Gold credited to buyer.";
    }, 600);
  });
}

function makeLabel(label: string, defaultValue: string, type = "text", step?: string): {
  row: HTMLElement;
  input: HTMLInputElement;
} {
  const row = document.createElement("label");
  const span = document.createElement("span");
  span.textContent = label;
  const input = document.createElement("input");
  input.type = type;
  input.value = defaultValue;
  if (step !== undefined) input.step = step;
  row.appendChild(span);
  row.appendChild(input);
  return { row, input };
}

function addRow(parent: HTMLElement, label: string, value: string, target?: HTMLElement): void {
  const dt = document.createElement("dt");
  dt.textContent = label;
  parent.appendChild(dt);
  const dd = target ?? document.createElement("dd");
  dd.textContent = value;
  parent.appendChild(dd);
}
