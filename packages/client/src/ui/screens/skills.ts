import { createBar, createButton, createIcon, createPanel } from "../components/index.js";
import type { IconSlug } from "../components/icon.js";
import { SKILL_LEVEL_CAP } from "@tarnveil/shared";
import "./skills.css";

interface SkillRow {
  id: string;
  label: string;
  icon: IconSlug;
  level: number;
  xp: number;
  xpNext: number;
  unlocks: string;
}

const SAMPLE: SkillRow[] = [
  { id: "combat", label: "Combat", icon: "shield", level: 1, xp: 0, xpNext: 100, unlocks: "Next: stronger strikes at L2" },
  { id: "woodcutting", label: "Woodcutting", icon: "wood-axe", level: 1, xp: 0, xpNext: 100, unlocks: "Next: hardwood at L3" },
  { id: "mining", label: "Mining", icon: "pickaxe", level: 1, xp: 0, xpNext: 100, unlocks: "Next: iron ore at L4" },
  { id: "fishing", label: "Fishing", icon: "fishing-rod", level: 1, xp: 0, xpNext: 100, unlocks: "Next: trout at L3" },
  { id: "cooking", label: "Cooking", icon: "cooking-pot", level: 1, xp: 0, xpNext: 100, unlocks: "Next: stew at L2" },
];

export function mountSkills(target: HTMLElement = document.body): () => void {
  const root = document.createElement("div");
  root.className = "skills-screen";
  root.setAttribute("data-testid", "skills-screen");

  const h = document.createElement("h1");
  h.className = "skills-screen__title";
  h.textContent = "Skills";
  root.appendChild(h);

  const list = document.createElement("div");
  list.className = "skills-screen__list";
  list.setAttribute("data-testid", "skills-list");
  for (const s of SAMPLE) {
    list.appendChild(renderRow(s));
  }
  root.appendChild(list);

  const back = createButton({
    label: "← Back",
    variant: "secondary",
    size: "small",
    onClick: () => {
      const url = new URL(window.location.href);
      url.searchParams.delete("ui");
      window.history.pushState({}, "", url);
      window.dispatchEvent(new PopStateEvent("popstate"));
    },
  });
  back.classList.add("skills-screen__back");
  root.appendChild(back);

  target.appendChild(root);
  return () => root.remove();
}

function renderRow(s: SkillRow): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "skills-screen__row";
  wrap.setAttribute("data-testid", "skill-row");
  wrap.setAttribute("data-skill", s.id);

  const icon = createIcon({ slug: s.icon, size: 32, ariaLabel: s.label });
  icon.classList.add("skills-screen__icon");
  wrap.appendChild(icon);

  const panel = createPanel({ ariaLabel: s.label });
  const head = document.createElement("div");
  head.className = "skills-screen__head";
  const name = document.createElement("span");
  name.className = "skills-screen__name";
  name.textContent = s.label;
  const lvl = document.createElement("span");
  lvl.className = "skills-screen__level";
  // Hard cap from shared (SKILL_LEVEL_CAP = 20).
  lvl.textContent = `Level ${Math.min(s.level, SKILL_LEVEL_CAP)} / ${SKILL_LEVEL_CAP}`;
  head.appendChild(name);
  head.appendChild(lvl);
  panel.appendChild(head);

  const bar = createBar({ value: s.xp, max: s.xpNext, variant: "reed", showNumbers: true });
  panel.appendChild(bar.root);

  const unlock = document.createElement("p");
  unlock.className = "skills-screen__unlock";
  unlock.textContent = s.unlocks;
  panel.appendChild(unlock);

  wrap.appendChild(panel);
  return wrap;
}
