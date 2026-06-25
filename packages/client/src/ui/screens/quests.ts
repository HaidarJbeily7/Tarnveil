import { createBar, createButton, createPanel } from "../components/index.js";
import { DAILY_QUESTS, DAILY_QUEST_RESET_MS } from "@tarnveil/shared";
import "./quests.css";

/** Per-quest UI state — sample numbers so the panel is visible end-to-end. */
const SAMPLE_PROGRESS: Record<string, number> = {
  "daily-wood-3": 2,
  "daily-stone-2": 2, // complete
  "daily-wolf-1": 0,
};

const CLAIMED = new Set<string>();

export function mountQuests(target: HTMLElement = document.body): () => void {
  const root = document.createElement("div");
  root.className = "quests";
  root.setAttribute("data-testid", "quests-screen");

  const title = document.createElement("h1");
  title.className = "quests__title";
  title.textContent = "Daily quests";
  root.appendChild(title);

  const sub = document.createElement("div");
  sub.className = "quests__sub";
  const lead = document.createElement("p");
  lead.textContent = "Complete every objective before the daily reset.";
  lead.style.margin = "0";
  lead.style.color = "color-mix(in srgb, var(--mist) 70%, transparent)";
  sub.appendChild(lead);
  const countdown = document.createElement("span");
  countdown.className = "quests__countdown";
  countdown.setAttribute("data-testid", "quests-countdown");
  sub.appendChild(countdown);
  root.appendChild(sub);

  // The "reset at" anchor is local-time midnight + 24h. We render mm:ss
  // relative to that anchor; updates every second.
  const resetAt = computeResetAt();
  let timer: ReturnType<typeof setInterval> | null = null;
  function tickCountdown(): void {
    const remaining = Math.max(0, resetAt - Date.now());
    countdown.textContent = `Resets in ${formatHMS(remaining)}`;
  }
  tickCountdown();
  timer = setInterval(tickCountdown, 1000);

  const list = document.createElement("div");
  list.className = "quests__list";
  list.setAttribute("data-testid", "quests-list");

  function paintList(): void {
    list.replaceChildren();
    let done = 0;
    for (const q of DAILY_QUESTS) {
      const progress = SAMPLE_PROGRESS[q.id] ?? 0;
      const complete = progress >= q.target;
      const claimed = CLAIMED.has(q.id);
      if (complete && claimed) done += 1;

      const row = document.createElement("article");
      row.className = "quests__row";
      row.setAttribute("data-testid", "quest-row");
      row.setAttribute("data-quest", q.id);

      const panel = createPanel({ ariaLabel: q.name });

      const head = document.createElement("div");
      head.className = "quests__head";
      const name = document.createElement("h2");
      name.className = "quests__name";
      name.textContent = q.name;
      const prog = document.createElement("span");
      prog.className = "quests__progress";
      prog.textContent = `${Math.min(progress, q.target)} / ${q.target}`;
      head.appendChild(name);
      head.appendChild(prog);
      panel.appendChild(head);

      const desc = document.createElement("p");
      desc.style.margin = "0";
      desc.style.color = "color-mix(in srgb, var(--mist) 70%, transparent)";
      desc.style.fontSize = "var(--type-body-sm)";
      desc.textContent = q.description;
      panel.appendChild(desc);

      const bar = createBar({
        value: Math.min(progress, q.target),
        max: q.target,
        variant: complete ? "reed" : "xp",
        showNumbers: false,
      });
      panel.appendChild(bar.root);

      const rewards = document.createElement("div");
      rewards.className = "quests__rewards";
      const gold = document.createElement("span");
      gold.className = "gold";
      gold.textContent = `+${q.rewardGold} gold`;
      const xp = document.createElement("span");
      xp.className = "xp";
      xp.textContent = `+${q.rewardXp} ${q.rewardSkill} xp`;
      rewards.appendChild(gold);
      rewards.appendChild(xp);
      panel.appendChild(rewards);

      const actions = document.createElement("div");
      actions.className = "quests__actions";
      const claimBtn = createButton({
        label: claimed ? "Claimed" : "Claim",
        variant: "primary",
        disabled: !complete || claimed,
        onClick: () => {
          CLAIMED.add(q.id);
          paintList();
        },
      });
      claimBtn.setAttribute("data-testid", `quest-claim-${q.id}`);
      actions.appendChild(claimBtn);
      panel.appendChild(actions);

      row.appendChild(panel);
      list.appendChild(row);
    }

    if (done === DAILY_QUESTS.length) {
      const empty = document.createElement("div");
      empty.className = "quests__done";
      empty.setAttribute("data-testid", "quests-done");
      empty.textContent = "All daily objectives claimed. Come back after the reset.";
      list.appendChild(empty);
    }
  }
  paintList();
  root.appendChild(list);

  target.appendChild(root);
  return () => {
    if (timer !== null) clearInterval(timer);
    root.remove();
  };
}

function computeResetAt(): number {
  // Anchor to the next 00:00 local time within DAILY_QUEST_RESET_MS.
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setHours(0, 0, 0, 0);
  tomorrow.setDate(tomorrow.getDate() + 1);
  // Cap at the spec's reset window in case timezone math overshoots.
  return Math.min(tomorrow.getTime(), Date.now() + DAILY_QUEST_RESET_MS);
}

function formatHMS(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
