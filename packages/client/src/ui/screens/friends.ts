import { createButton, createPanel } from "../components/index.js";
import "./friends.css";

interface Friend {
  id: string;
  name: string;
  presence: "online" | "offline";
  zone: string;
}

const SAMPLE: Friend[] = [
  { id: "f1", name: "Aelune", presence: "online", zone: "Mainland" },
  { id: "f2", name: "Brennor", presence: "online", zone: "Gathering realm" },
  { id: "f3", name: "Cora", presence: "offline", zone: "—" },
  { id: "f4", name: "Dymas", presence: "offline", zone: "—" },
];

const PENDING: Array<{ id: string; name: string }> = [{ id: "p1", name: "Eril" }];

export function mountFriends(target: HTMLElement = document.body): () => void {
  const root = document.createElement("div");
  root.className = "friends";
  root.setAttribute("data-testid", "friends-screen");

  const h = document.createElement("h1");
  h.className = "friends__title";
  h.textContent = "Friends";
  root.appendChild(h);

  const panel = createPanel({ ariaLabel: "friends" });
  panel.classList.add("friends__panel");

  // Add-friend form
  const add = document.createElement("form");
  add.className = "friends__add";
  add.setAttribute("data-testid", "friends-add");
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Character name…";
  input.setAttribute("aria-label", "character name");
  const submit = createButton({ label: "Send request", variant: "primary", type: "submit" });
  add.appendChild(input);
  add.appendChild(submit);
  add.addEventListener("submit", (e) => {
    e.preventDefault();
    if (input.value.trim() === "") return;
    PENDING.push({ id: `p-${Date.now()}`, name: input.value.trim() });
    input.value = "";
    paint();
  });
  panel.appendChild(add);

  const pendingBox = document.createElement("div");
  panel.appendChild(pendingBox);

  const list = document.createElement("div");
  list.setAttribute("data-testid", "friends-list");
  panel.appendChild(list);

  function paint(): void {
    pendingBox.replaceChildren();
    if (PENDING.length > 0) {
      const first = PENDING[0]!;
      const row = document.createElement("div");
      row.className = "friends__pending";
      row.setAttribute("data-testid", "friends-pending");
      const text = document.createElement("span");
      text.textContent = `${first.name} wants to be your friend.`;
      const actions = document.createElement("div");
      actions.style.display = "flex";
      actions.style.gap = "var(--space-2)";
      actions.appendChild(
        createButton({
          label: "Accept",
          variant: "primary",
          size: "small",
          onClick: () => {
            SAMPLE.push({ id: first.id, name: first.name, presence: "online", zone: "Mainland" });
            PENDING.shift();
            paint();
          },
        }),
      );
      actions.appendChild(
        createButton({
          label: "Decline",
          variant: "secondary",
          size: "small",
          onClick: () => {
            PENDING.shift();
            paint();
          },
        }),
      );
      row.appendChild(text);
      row.appendChild(actions);
      pendingBox.appendChild(row);
    }

    list.replaceChildren();
    for (const f of SAMPLE) {
      const row = document.createElement("div");
      row.className = "friends__row";
      row.setAttribute("data-testid", "friend-row");
      row.setAttribute("data-friend", f.id);

      const dot = document.createElement("span");
      dot.className = "friends__dot";
      dot.setAttribute("data-presence", f.presence);
      row.appendChild(dot);

      const meta = document.createElement("div");
      const name = document.createElement("div");
      name.className = "friends__name";
      name.textContent = f.name;
      const zone = document.createElement("div");
      zone.className = "friends__zone";
      zone.textContent = f.presence === "online" ? `online — in ${f.zone}` : "offline";
      meta.appendChild(name);
      meta.appendChild(zone);
      row.appendChild(meta);

      const dm = createButton({
        label: "Open DM",
        variant: "secondary",
        size: "small",
        onClick: () => {
          const url = new URL(window.location.href);
          url.searchParams.set("ui", "chat");
          url.searchParams.set("with", f.name);
          window.history.pushState({}, "", url);
          window.dispatchEvent(new PopStateEvent("popstate"));
        },
      });
      dm.setAttribute("data-testid", `friend-dm-${f.id}`);
      row.appendChild(dm);

      const block = createButton({
        label: "Block",
        variant: "danger",
        size: "small",
        onClick: () => {
          const i = SAMPLE.findIndex((x) => x.id === f.id);
          if (i >= 0) {
            SAMPLE.splice(i, 1);
            paint();
          }
        },
      });
      row.appendChild(block);

      list.appendChild(row);
    }
  }
  paint();

  root.appendChild(panel);
  target.appendChild(root);
  return () => root.remove();
}
