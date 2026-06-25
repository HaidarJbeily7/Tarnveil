import { createButton, createPanel } from "../components/index.js";
import "./combat.css";

/**
 * C8 — Gathering and combat feedback showcase.
 *
 * Demonstrates: progress ring on gather, "+N item" floater, mob HP pips,
 * floating damage/heal numbers (water-ripple ease), and the death/tombstone
 * screen. Every animation honours prefers-reduced-motion.
 */
export function mountCombat(target: HTMLElement = document.body): () => void {
  const root = document.createElement("div");
  root.className = "combat-demo";
  root.setAttribute("data-testid", "combat-demo");

  const h1 = document.createElement("h1");
  h1.className = "t-display t-display--md";
  h1.textContent = "Gathering & combat feedback";
  root.appendChild(h1);

  // --- Progress ring ---
  const ringSection = document.createElement("section");
  const ringTitle = document.createElement("h2");
  ringTitle.textContent = "Gather progress ring";
  ringSection.appendChild(ringTitle);
  const ringRow = document.createElement("div");
  ringRow.className = "combat-demo__row";
  const ring = makeRing();
  ringRow.appendChild(ring.root);
  ringRow.appendChild(
    createButton({
      label: "Start gather (2s)",
      variant: "primary",
      onClick: () => ring.run(2000),
    }),
  );
  ringSection.appendChild(ringRow);
  root.appendChild(ringSection);

  // --- Mob HP + damage floaters ---
  const mobSection = document.createElement("section");
  const mobTitle = document.createElement("h2");
  mobTitle.textContent = "Mob HP + damage / heal floaters";
  mobSection.appendChild(mobTitle);

  let mobHp = 8;
  const MOB_MAX = 8;
  const mob = document.createElement("div");
  mob.className = "combat-mob";
  mob.setAttribute("data-testid", "combat-mob");
  const mobHead = document.createElement("div");
  mobHead.className = "combat-mob__name";
  const mobName = document.createElement("b");
  mobName.textContent = "Wolf";
  const mobValue = document.createElement("span");
  mobValue.setAttribute("data-testid", "combat-mob-hp");
  mobValue.textContent = `${mobHp} / ${MOB_MAX}`;
  mobHead.appendChild(mobName);
  mobHead.appendChild(mobValue);
  mob.appendChild(mobHead);
  // HP pip strip
  const pips = document.createElement("div");
  pips.style.display = "flex";
  pips.style.gap = "2px";
  for (let i = 0; i < MOB_MAX; i++) {
    const pip = document.createElement("span");
    pip.style.flex = "1";
    pip.style.height = "5px";
    pip.style.borderRadius = "2px";
    pip.style.background = i < mobHp ? "var(--rust)" : "var(--hpBg, color-mix(in srgb, var(--rust) 25%, var(--ink)))";
    pip.setAttribute("data-pip-index", String(i));
    pips.appendChild(pip);
  }
  mob.appendChild(pips);

  const stage = document.createElement("div");
  stage.className = "combat-stage";
  stage.setAttribute("data-testid", "combat-stage");

  function repaintPips(): void {
    for (let i = 0; i < MOB_MAX; i++) {
      const pip = pips.children[i] as HTMLElement;
      pip.style.background = i < mobHp ? "var(--rust)" : "color-mix(in srgb, var(--rust) 25%, var(--ink))";
    }
    mobValue.textContent = `${mobHp} / ${MOB_MAX}`;
  }

  function spawnFloat(text: string, kind: "dmg" | "heal"): void {
    const float = document.createElement("span");
    float.className = `combat-float combat-float--${kind}`;
    float.style.left = `${30 + Math.random() * 40}%`;
    float.style.bottom = "60%";
    float.textContent = text;
    stage.appendChild(float);
    requestAnimationFrame(() => float.setAttribute("data-animate", "true"));
    setTimeout(() => float.remove(), 1100);
  }

  const mobRow = document.createElement("div");
  mobRow.className = "combat-demo__row";
  mobRow.appendChild(mob);
  mobRow.appendChild(
    createButton({
      label: "Hit (-2)",
      variant: "danger",
      onClick: () => {
        mobHp = Math.max(0, mobHp - 2);
        repaintPips();
        spawnFloat("-2", "dmg");
      },
    }),
  );
  mobRow.appendChild(
    createButton({
      label: "Heal (+1)",
      variant: "secondary",
      onClick: () => {
        mobHp = Math.min(MOB_MAX, mobHp + 1);
        repaintPips();
        spawnFloat("+1", "heal");
      },
    }),
  );
  mobRow.appendChild(
    createButton({
      label: "Pickup +1 wood",
      variant: "secondary",
      onClick: () => spawnFloat("+1 wood", "heal"),
    }),
  );
  mobSection.appendChild(mobRow);
  mobSection.appendChild(stage);
  root.appendChild(mobSection);

  // --- Death screen toggle ---
  const deathSection = document.createElement("section");
  const deathTitle = document.createElement("h2");
  deathTitle.textContent = "Death / tombstone screen";
  deathSection.appendChild(deathTitle);
  const deathRow = document.createElement("div");
  deathRow.className = "combat-demo__row";
  let deathOverlay: HTMLElement | null = null;
  function openDeath(): void {
    if (deathOverlay !== null) return;
    deathOverlay = document.createElement("div");
    deathOverlay.className = "combat-death";
    deathOverlay.setAttribute("data-testid", "combat-death");
    const panel = createPanel({ ariaLabel: "you died" });
    const title = document.createElement("h2");
    title.className = "combat-death__title";
    title.textContent = "You died";
    panel.appendChild(title);
    const lead = document.createElement("p");
    lead.className = "combat-death__lead";
    lead.textContent = "Lost to a wolf in the PvP wilderness. Your gear stayed where you fell.";
    panel.appendChild(lead);
    const meta = document.createElement("p");
    meta.className = "combat-death__meta";
    meta.textContent = "Respawn at Mainland · 5 s cooldown";
    panel.appendChild(meta);
    const actions = document.createElement("div");
    actions.className = "combat-death__actions";
    actions.appendChild(
      createButton({
        label: "Respawn",
        variant: "primary",
        onClick: () => {
          if (deathOverlay !== null) {
            deathOverlay.remove();
            deathOverlay = null;
          }
        },
      }),
    );
    actions.appendChild(
      createButton({
        label: "View tombstone",
        variant: "secondary",
      }),
    );
    panel.appendChild(actions);
    deathOverlay.appendChild(panel);
    document.body.appendChild(deathOverlay);
  }
  deathRow.appendChild(
    createButton({ label: "Open death screen", variant: "danger", onClick: openDeath }),
  );
  deathSection.appendChild(deathRow);
  root.appendChild(deathSection);

  target.appendChild(root);
  return () => {
    if (deathOverlay !== null) deathOverlay.remove();
    root.remove();
  };
}

function makeRing(): { root: HTMLElement; run(durationMs: number): void } {
  const wrap = document.createElement("div");
  wrap.className = "combat-ring";
  wrap.setAttribute("data-testid", "combat-ring");
  wrap.style.setProperty("--progress", "0");
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "64");
  svg.setAttribute("height", "64");
  svg.setAttribute("viewBox", "0 0 64 64");
  svg.classList.add("combat-ring__svg");
  const trk = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  trk.setAttribute("cx", "32");
  trk.setAttribute("cy", "32");
  trk.setAttribute("r", "28");
  trk.classList.add("combat-ring__track");
  const fill = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  fill.setAttribute("cx", "32");
  fill.setAttribute("cy", "32");
  fill.setAttribute("r", "28");
  fill.classList.add("combat-ring__fill");
  svg.appendChild(trk);
  svg.appendChild(fill);
  wrap.appendChild(svg);
  const label = document.createElement("span");
  label.className = "combat-ring__label";
  label.setAttribute("data-testid", "combat-ring-label");
  label.textContent = "0%";
  wrap.appendChild(label);

  return {
    root: wrap,
    run(durationMs) {
      const start = Date.now();
      const tick = (): void => {
        const dt = Date.now() - start;
        const p = Math.min(1, dt / durationMs);
        wrap.style.setProperty("--progress", String(p));
        label.textContent = `${Math.round(p * 100)}%`;
        if (p < 1) requestAnimationFrame(tick);
        else label.textContent = "✓";
      };
      tick();
    },
  };
}
