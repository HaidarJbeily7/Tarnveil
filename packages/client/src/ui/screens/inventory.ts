import {
  attachTooltip,
  createButton,
  createIcon,
  createPanel,
  createSlot,
} from "../components/index.js";
import type { IconSlug } from "../components/icon.js";
import "./inventory.css";

interface Item {
  slug: IconSlug;
  name: string;
  meta: string;
  stats: string;
  qty?: number;
  canDrop?: boolean;
  dropReason?: string;
}

const ITEMS: ReadonlyArray<Item | null> = [
  { slug: "wood-axe", name: "Iron axe", meta: "Tool · Woodcutting", stats: "Chops oak and pine. +1 logs/swing." },
  { slug: "pickaxe", name: "Pickaxe", meta: "Tool · Mining", stats: "Stone and copper." },
  { slug: "fishing-rod", name: "Fishing rod", meta: "Tool · Fishing", stats: "Trout, perch." },
  { slug: "wood-pile", name: "Wood", meta: "Material · Stack", stats: "Common firewood.", qty: 12 },
  { slug: "rock", name: "Stone", meta: "Material · Stack", stats: "Quarry stone.", qty: 4 },
  { slug: "cooking-pot", name: "Cooking pot", meta: "Tool · Cooking", stats: "Stews and soups." },
  { slug: "shield", name: "Round shield", meta: "Equipment · Off-hand", stats: "+2 block.", canDrop: false, dropReason: "Equipped — unequip first." },
  null, null, null, null, null,
  null, null, null, null, null, null,
  null, null, null, null, null, null,
];

export function mountInventory(target: HTMLElement = document.body): () => void {
  const root = document.createElement("div");
  root.className = "inventory";
  root.setAttribute("data-testid", "inventory-screen");

  const title = document.createElement("h1");
  title.className = "inventory__title";
  title.textContent = "Inventory";
  root.appendChild(title);

  const lead = document.createElement("p");
  lead.className = "inventory__lead";
  lead.textContent = "Click a slot to inspect, equip, or drop. Tooltips appear on hover or focus.";
  root.appendChild(lead);

  const layout = document.createElement("div");
  layout.className = "inventory__layout";

  const grid = document.createElement("div");
  grid.className = "inventory__grid";
  grid.setAttribute("data-testid", "inventory-grid");

  const detail = document.createElement("div");
  detail.className = "inventory__detail";
  const detailPanel = createPanel({ ariaLabel: "item detail" });
  detailPanel.setAttribute("data-testid", "inventory-detail");
  detail.appendChild(detailPanel);

  let selected: number | null = null;

  function paintDetail(): void {
    detailPanel.replaceChildren();
    if (selected === null) {
      const p = document.createElement("p");
      p.className = "inventory__detail-empty";
      p.textContent = "Pick a slot to see the item details.";
      detailPanel.appendChild(p);
      return;
    }
    const item = ITEMS[selected];
    if (!item) {
      const p = document.createElement("p");
      p.className = "inventory__detail-empty";
      p.textContent = "This slot is empty.";
      detailPanel.appendChild(p);
      return;
    }
    const name = document.createElement("h2");
    name.className = "inventory__detail-name";
    name.textContent = item.name;
    detailPanel.appendChild(name);

    const meta = document.createElement("span");
    meta.className = "inventory__detail-meta";
    meta.textContent = item.meta;
    detailPanel.appendChild(meta);

    const stats = document.createElement("p");
    stats.className = "inventory__detail-stats";
    stats.textContent = item.stats;
    detailPanel.appendChild(stats);

    const actions = document.createElement("div");
    actions.className = "inventory__actions";
    actions.appendChild(createButton({ label: "Use", variant: "primary" }));
    actions.appendChild(createButton({ label: "Equip", variant: "secondary" }));
    actions.appendChild(createButton({ label: "Sell", variant: "secondary" }));
    const dropBtn = createButton({
      label: "Drop",
      variant: "danger",
      disabled: item.canDrop === false,
    });
    actions.appendChild(dropBtn);
    detailPanel.appendChild(actions);

    if (item.canDrop === false) {
      const reason = document.createElement("p");
      reason.className = "inventory__reason";
      reason.setAttribute("data-testid", "inventory-reason");
      reason.textContent = item.dropReason ?? "This item can't be dropped here.";
      detailPanel.appendChild(reason);
    }
  }

  ITEMS.forEach((item, i) => {
    const opts: { ariaLabel: string; qty?: number } = {
      ariaLabel: item === null ? `Empty slot ${i + 1}` : `${item.name}${item.qty !== undefined ? ` x${item.qty}` : ""}`,
    };
    if (item?.qty !== undefined) opts.qty = item.qty;
    const cell = createSlot(opts);
    cell.setAttribute("data-slot-index", String(i));
    if (item !== null) {
      const icon = createIcon({ slug: item.slug, size: 32, ariaLabel: item.name });
      cell.insertBefore(icon, cell.firstChild);
      attachTooltip(cell, `${item.name}\n${item.meta}\n${item.stats}`);
    }
    cell.addEventListener("click", () => {
      selected = i;
      // mark selected for CSS state
      for (const c of grid.children) c.removeAttribute("data-selected");
      cell.setAttribute("data-selected", "true");
      paintDetail();
    });
    grid.appendChild(cell);
  });

  paintDetail();
  layout.appendChild(grid);
  layout.appendChild(detail);
  root.appendChild(layout);

  target.appendChild(root);
  return () => root.remove();
}
