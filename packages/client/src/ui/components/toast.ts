export type ToastTone = "info" | "success" | "danger" | "lantern";

export interface ToastOptions {
  message: string;
  title?: string;
  tone?: ToastTone;
  durationMs?: number;
}

let stack: HTMLElement | null = null;

function ensureStack(): HTMLElement {
  if (stack !== null) return stack;
  const el = document.createElement("div");
  el.className = "toast-stack";
  el.setAttribute("role", "region");
  el.setAttribute("aria-label", "notifications");
  el.setAttribute("aria-live", "polite");
  document.body.appendChild(el);
  stack = el;
  return el;
}

/** Push a toast onto the top-right stack. Auto-dismisses after duration. */
export function showToast(opts: ToastOptions): HTMLElement {
  const root = ensureStack();
  const t = document.createElement("div");
  t.className = "toast";
  if (opts.tone === "success") t.classList.add("toast--success");
  else if (opts.tone === "danger") t.classList.add("toast--danger");
  else if (opts.tone === "lantern") t.classList.add("toast--lantern");
  // aria-live announces the message text; titles read first.
  t.setAttribute("role", "status");

  if (opts.title !== undefined) {
    const title = document.createElement("span");
    title.className = "toast__title";
    title.textContent = opts.title;
    t.appendChild(title);
  }
  const msg = document.createElement("span");
  msg.className = "toast__msg";
  msg.textContent = opts.message;
  t.appendChild(msg);
  root.appendChild(t);

  // Trigger the slide-in next frame so the transition runs.
  requestAnimationFrame(() => t.setAttribute("data-show", "true"));

  const duration = opts.durationMs ?? 4000;
  setTimeout(() => {
    t.removeAttribute("data-show");
    setTimeout(() => t.remove(), 240);
  }, duration);

  return t;
}
