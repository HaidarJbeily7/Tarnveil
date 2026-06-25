import { createIcon, createPanel, createSlot, createTabs } from "../components/index.js";
import type { IconSlug } from "../components/icon.js";
import "./bank.css";

interface BankCell {
  slug?: IconSlug;
  label?: string;
  qty?: number;
}

const PAGE_COUNT = 3;
const SLOTS_PER_PAGE = 24;

const PAGES: BankCell[][] = [
  fillPage([
    { slug: "wood-pile", label: "Wood", qty: 250 },
    { slug: "rock", label: "Stone", qty: 80 },
    { slug: "fishing-rod", label: "Spare rod" },
    { slug: "wood-axe", label: "Spare axe" },
  ]),
  fillPage([
    { slug: "cooking-pot", label: "Cooking pot" },
    { slug: "shield", label: "Old shield" },
  ]),
  fillPage([
    { slug: "coins", label: "Gold pouch", qty: 1234 },
  ]),
];

function fillPage(seed: BankCell[]): BankCell[] {
  const out: BankCell[] = [];
  for (let i = 0; i < SLOTS_PER_PAGE; i++) out.push(seed[i] ?? {});
  return out;
}

export function mountBank(target: HTMLElement = document.body): () => void {
  const root = document.createElement("div");
  root.className = "bank";
  root.setAttribute("data-testid", "bank-screen");

  const h = document.createElement("h1");
  h.className = "bank__title";
  h.textContent = "Vault";
  root.appendChild(h);

  const panel = createPanel({ ariaLabel: "vault" });
  panel.classList.add("bank__panel");

  let activeTab = "bank";
  const tabs = createTabs({
    tabs: [
      { id: "bank", label: "Bank" },
      { id: "character", label: "Character" },
    ],
    onChange: (id) => {
      activeTab = id;
      paint();
    },
  });
  panel.appendChild(tabs.root);

  const body = document.createElement("div");
  body.setAttribute("data-testid", "bank-body");
  panel.appendChild(body);

  function paint(): void {
    body.replaceChildren();
    if (activeTab === "bank") paintBank(body);
    else paintCharacter(body);
  }
  paint();

  root.appendChild(panel);
  target.appendChild(root);
  return () => root.remove();
}

function paintBank(host: HTMLElement): void {
  let activePage = 0;
  let query = "";

  const pageRow = document.createElement("div");
  pageRow.className = "bank__pages";
  pageRow.setAttribute("data-testid", "bank-pages");
  for (let i = 0; i < PAGE_COUNT; i++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "bank__page-btn";
    btn.setAttribute("aria-pressed", i === activePage ? "true" : "false");
    btn.textContent = String(i + 1);
    btn.addEventListener("click", () => {
      activePage = i;
      for (const c of pageRow.children) c.setAttribute("aria-pressed", "false");
      btn.setAttribute("aria-pressed", "true");
      renderGrid();
    });
    pageRow.appendChild(btn);
  }
  host.appendChild(pageRow);

  const search = document.createElement("input");
  search.className = "bank__search";
  search.type = "search";
  search.placeholder = "Search this page…";
  search.setAttribute("aria-label", "search bank");
  search.setAttribute("data-testid", "bank-search");
  search.addEventListener("input", () => {
    query = search.value.toLowerCase().trim();
    renderGrid();
  });
  host.appendChild(search);

  const grid = document.createElement("div");
  grid.className = "bank__grid";
  grid.setAttribute("data-testid", "bank-grid");
  host.appendChild(grid);

  const total = document.createElement("p");
  total.className = "bank__total";
  total.setAttribute("data-testid", "bank-total");
  host.appendChild(total);

  function renderGrid(): void {
    grid.replaceChildren();
    const page = PAGES[activePage]!;
    let visible = 0;
    page.forEach((cell, i) => {
      const matches = query === "" || (cell.label ?? "").toLowerCase().includes(query);
      if (!matches && cell.slug !== undefined) return;
      const ariaLabel = cell.label !== undefined
        ? `${cell.label}${cell.qty !== undefined ? ` x${cell.qty}` : ""}`
        : `Empty slot ${i + 1}`;
      const opts: { ariaLabel: string; qty?: number } = { ariaLabel };
      if (cell.qty !== undefined) opts.qty = cell.qty;
      const slot = createSlot(opts);
      if (cell.slug !== undefined) {
        slot.insertBefore(createIcon({ slug: cell.slug, size: 30, ariaLabel: cell.label ?? "" }), slot.firstChild);
      }
      grid.appendChild(slot);
      visible += 1;
    });
    total.textContent = `Page ${activePage + 1} of ${PAGE_COUNT} · ${visible} entries`;
  }
  renderGrid();
}

function paintCharacter(host: HTMLElement): void {
  const wrap = document.createElement("div");
  wrap.className = "character-sheet";
  wrap.setAttribute("data-testid", "character-sheet");

  const doll = document.createElement("div");
  doll.className = "character-sheet__doll";

  const slots: Array<{ key: string; label: string; icon?: IconSlug }> = [
    { key: "head", label: "Helm" },
    { key: "torso", label: "Chest" },
    { key: "main", label: "Main-hand", icon: "wood-axe" },
    { key: "off", label: "Off-hand", icon: "shield" },
    { key: "legs", label: "Legs" },
    { key: "feet", label: "Boots" },
  ];

  for (const s of slots) {
    const cell = createSlot({ ariaLabel: s.label });
    cell.classList.add(`character-sheet__slot--${s.key}`);
    cell.setAttribute("data-equip-slot", s.key);
    if (s.icon !== undefined) {
      cell.insertBefore(createIcon({ slug: s.icon, size: 30, ariaLabel: s.label }), cell.firstChild);
    }
    doll.appendChild(cell);
  }
  wrap.appendChild(doll);

  const stats = document.createElement("aside");
  stats.className = "character-sheet__stats";
  stats.setAttribute("data-testid", "character-stats");
  const derived: Array<{ label: string; value: string }> = [
    { label: "Attack", value: "+8" },
    { label: "Defence", value: "+12" },
    { label: "HP max", value: "10" },
    { label: "Crit chance", value: "4%" },
    { label: "Speed", value: "1.0" },
  ];
  for (const d of derived) {
    const row = document.createElement("div");
    row.className = "character-sheet__stat-row";
    const lbl = document.createElement("b");
    lbl.textContent = d.label;
    const val = document.createElement("span");
    val.textContent = d.value;
    row.appendChild(lbl);
    row.appendChild(val);
    stats.appendChild(row);
  }
  wrap.appendChild(stats);
  host.appendChild(wrap);
}
