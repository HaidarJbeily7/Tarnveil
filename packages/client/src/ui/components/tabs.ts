export interface TabsOptions {
  tabs: ReadonlyArray<{ id: string; label: string }>;
  active?: string;
  onChange?: (id: string) => void;
}

export interface TabsControl {
  root: HTMLElement;
  setActive(id: string): void;
}

export function createTabs(opts: TabsOptions): TabsControl {
  const root = document.createElement("div");
  root.className = "tabs";
  root.setAttribute("role", "tablist");

  const buttons = new Map<string, HTMLButtonElement>();
  let active = opts.active ?? opts.tabs[0]?.id ?? "";

  const setActive = (id: string): void => {
    if (!buttons.has(id)) return;
    active = id;
    for (const [tid, btn] of buttons) {
      const selected = tid === active;
      btn.setAttribute("aria-selected", selected ? "true" : "false");
      btn.tabIndex = selected ? 0 : -1;
    }
    opts.onChange?.(active);
  };

  for (const t of opts.tabs) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tabs__tab";
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-selected", t.id === active ? "true" : "false");
    btn.tabIndex = t.id === active ? 0 : -1;
    btn.textContent = t.label;
    btn.addEventListener("click", () => setActive(t.id));
    btn.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        const ids = opts.tabs.map((x) => x.id);
        const i = ids.indexOf(active);
        const dir = e.key === "ArrowRight" ? 1 : -1;
        const next = ids[(i + dir + ids.length) % ids.length]!;
        setActive(next);
        buttons.get(next)?.focus();
      }
    });
    buttons.set(t.id, btn);
    root.appendChild(btn);
  }

  return { root, setActive };
}
