import { GAME } from "@tarnveil/shared/game.config";
import { createButton, createPanel } from "../components/index.js";
import "./character.css";

/**
 * Phase C3 — Character select / create.
 *
 * Cards list the existing characters from localStorage; an additional
 * "Create new" card opens an inline form. Picking a character routes to
 * ?ui=game (the Phaser world). The empty state on first run reads as an
 * invitation, not a blank — the only card visible is the create card.
 */

interface Character {
  id: string;
  name: string;
  tone: "lantern" | "lake" | "reed" | "rust";
  level: number;
}

const STORAGE_KEY = "tarn:characters:v1";

function load(): Character[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return [];
    const parsed = JSON.parse(raw) as Character[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(list: Character[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* noop */
  }
}

export function mountCharacter(target: HTMLElement = document.body): () => void {
  const root = document.createElement("div");
  root.className = "character";
  root.setAttribute("data-testid", "character-screen");

  const title = document.createElement("h1");
  title.className = "character__title";
  title.textContent = "Choose your character";
  root.appendChild(title);

  const lead = document.createElement("p");
  lead.className = "character__lead";
  lead.textContent = `Pick a character to enter ${GAME.name}, or create a new one.`;
  root.appendChild(lead);

  const grid = document.createElement("div");
  grid.className = "character__grid";
  root.appendChild(grid);

  let creating = false;

  const render = (): void => {
    grid.replaceChildren();
    const chars = load();

    for (const c of chars) {
      grid.appendChild(buildCard(c, () => {
        navigate("game");
      }));
    }

    if (creating) {
      grid.appendChild(
        buildCreateForm({
          onCreate: (name, tone) => {
            const next: Character = {
              id: crypto.randomUUID(),
              name,
              tone,
              level: 1,
            };
            save([...load(), next]);
            creating = false;
            render();
          },
          onCancel: () => {
            creating = false;
            render();
          },
        }),
      );
    } else {
      grid.appendChild(
        buildEmptyOrCreate(chars.length === 0, () => {
          creating = true;
          render();
        }),
      );
    }
  };
  render();

  const back = createButton({
    label: "← Back to sign-in",
    variant: "secondary",
    size: "small",
    onClick: () => navigate("connect"),
  });
  back.classList.add("character__back");
  root.appendChild(back);

  target.appendChild(root);
  return () => root.remove();
}

function buildCard(c: Character, onSelect: () => void): HTMLElement {
  const wrap = document.createElement("article");
  wrap.className = "character__card";
  wrap.setAttribute("data-testid", "character-card");

  const panel = createPanel({ ariaLabel: `Play as ${c.name}` });

  const sprite = document.createElement("div");
  sprite.className = "character__sprite";
  sprite.setAttribute("data-tone", c.tone);
  sprite.setAttribute("aria-hidden", "true");
  sprite.textContent = c.name.slice(0, 1).toUpperCase();
  panel.appendChild(sprite);

  const name = document.createElement("h2");
  name.className = "character__name";
  name.textContent = c.name;
  panel.appendChild(name);

  const summary = document.createElement("span");
  summary.className = "character__summary";
  summary.textContent = `Level ${c.level} · Mainland`;
  panel.appendChild(summary);

  panel.appendChild(
    createButton({ label: "Play", variant: "primary", onClick: onSelect }),
  );

  wrap.appendChild(panel);
  return wrap;
}

function buildEmptyOrCreate(isFirstRun: boolean, onClick: () => void): HTMLElement {
  const wrap = document.createElement("article");
  wrap.className = "character__card character__create-card";
  wrap.setAttribute("data-testid", "character-create-card");

  const panel = createPanel({ ariaLabel: "Create a new character" });

  const plus = document.createElement("span");
  plus.className = "character__empty-cta";
  plus.setAttribute("aria-hidden", "true");
  plus.textContent = "+";
  panel.appendChild(plus);

  const title = document.createElement("h2");
  title.className = "character__name";
  title.textContent = isFirstRun ? "Begin your story" : "Create new";
  panel.appendChild(title);

  const blurb = document.createElement("p");
  blurb.className = "character__empty-text";
  blurb.textContent = isFirstRun
    ? "No characters yet — make your first."
    : "Add another to switch between play styles.";
  panel.appendChild(blurb);

  panel.appendChild(
    createButton({
      label: isFirstRun ? "Start fresh" : "Create",
      variant: isFirstRun ? "primary" : "secondary",
      onClick,
    }),
  );

  wrap.appendChild(panel);
  return wrap;
}

function buildCreateForm(opts: {
  onCreate: (name: string, tone: Character["tone"]) => void;
  onCancel: () => void;
}): HTMLElement {
  const wrap = document.createElement("article");
  wrap.className = "character__card character__create-card";
  wrap.setAttribute("data-testid", "character-create-form");

  const panel = createPanel({ ariaLabel: "New character" });
  const form = document.createElement("form");
  form.className = "character__form";
  form.setAttribute("novalidate", "");

  let tone: Character["tone"] = "lantern";

  const nameLabel = document.createElement("label");
  nameLabel.textContent = "Name";
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.name = "name";
  nameInput.required = true;
  nameInput.minLength = 2;
  nameInput.maxLength = 24;
  nameInput.placeholder = "Two characters or more";
  nameInput.setAttribute("data-testid", "character-name");
  nameLabel.appendChild(nameInput);

  const toneLabel = document.createElement("label");
  toneLabel.textContent = "Tone";
  const tones = document.createElement("div");
  tones.className = "character__tones";
  tones.setAttribute("role", "radiogroup");
  for (const t of ["lantern", "lake", "reed", "rust"] as const) {
    const swatch = document.createElement("button");
    swatch.type = "button";
    swatch.setAttribute("data-tone", t);
    swatch.setAttribute("role", "radio");
    swatch.setAttribute("aria-label", t);
    swatch.setAttribute("aria-pressed", t === tone ? "true" : "false");
    swatch.addEventListener("click", () => {
      tone = t;
      for (const c of tones.children) {
        const el = c as HTMLElement;
        el.setAttribute(
          "aria-pressed",
          el.getAttribute("data-tone") === tone ? "true" : "false",
        );
      }
    });
    tones.appendChild(swatch);
  }
  toneLabel.appendChild(tones);

  const actions = document.createElement("div");
  actions.style.display = "flex";
  actions.style.gap = "var(--space-2)";
  actions.style.marginTop = "var(--space-2)";

  const create = createButton({
    label: "Create",
    variant: "primary",
    type: "submit",
  });
  const cancel = createButton({
    label: "Cancel",
    variant: "secondary",
    onClick: opts.onCancel,
  });
  actions.appendChild(create);
  actions.appendChild(cancel);

  form.appendChild(nameLabel);
  form.appendChild(toneLabel);
  form.appendChild(actions);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    if (name.length < 2) {
      nameInput.focus();
      return;
    }
    opts.onCreate(name, tone);
  });

  panel.appendChild(form);
  wrap.appendChild(panel);
  // Auto-focus the name field for keyboard users.
  setTimeout(() => nameInput.focus(), 0);
  return wrap;
}

function navigate(ui: string): void {
  const url = new URL(window.location.href);
  url.searchParams.set("ui", ui);
  window.history.pushState({}, "", url);
  window.dispatchEvent(new PopStateEvent("popstate"));
}
