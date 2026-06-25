/**
 * Live chat feed — polls the public spectate endpoint (no auth) and renders
 * the rolling tail. Used on the landing screen (C1) and as the basis for
 * the in-game chat panel (C10). Degrades gracefully if the API is offline.
 */

export interface ChatFeedOptions {
  region?: string;
  shard?: number;
  /** Poll cadence in ms. Default 1500 ms — chat is latency-tolerant. */
  intervalMs?: number;
  /** Endpoint base — defaults to same-origin. */
  baseUrl?: string;
  /** Max messages to keep on screen at once. */
  maxMessages?: number;
}

export interface ChatFeedHandle {
  root: HTMLElement;
  start(): void;
  stop(): void;
}

interface ChatMessage {
  id: number;
  author: string;
  body: string;
  ts: number;
}

const DEFAULT_INTERVAL = 1500;
const DEFAULT_MAX = 30;

export function createChatFeed(opts: ChatFeedOptions = {}): ChatFeedHandle {
  const region = opts.region ?? "global";
  const shard = opts.shard ?? 0;
  const intervalMs = opts.intervalMs ?? DEFAULT_INTERVAL;
  const max = opts.maxMessages ?? DEFAULT_MAX;
  const baseUrl = opts.baseUrl ?? "";

  const root = document.createElement("div");
  root.className = "chat-feed";

  const list = document.createElement("ul");
  list.className = "chat-feed__list";
  list.setAttribute("role", "log");
  list.setAttribute("aria-label", "world chat");
  list.setAttribute("aria-live", "polite");
  root.appendChild(list);

  const emptyState = document.createElement("li");
  emptyState.className = "chat-feed__empty";
  emptyState.textContent = "— quiet right now —";
  list.appendChild(emptyState);

  let cursor = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  async function tick(): Promise<void> {
    if (stopped) return;
    try {
      const url = `${baseUrl}/api/chat?after=${cursor}&region=${region}&shard=${shard}`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (res.ok) {
        const data = (await res.json()) as { messages: ChatMessage[] };
        appendMessages(data.messages);
      }
    } catch {
      // best-effort — landing still renders without a live feed
    } finally {
      if (!stopped) timer = setTimeout(tick, intervalMs);
    }
  }

  function appendMessages(messages: ChatMessage[]): void {
    if (messages.length === 0) return;
    if (emptyState.parentNode === list) list.removeChild(emptyState);
    for (const m of messages) {
      cursor = Math.max(cursor, m.id);
      const li = document.createElement("li");
      li.className = "chat-feed__item";
      const author = document.createElement("span");
      author.className = "chat-feed__author";
      author.textContent = m.author;
      const body = document.createElement("span");
      body.className = "chat-feed__body";
      body.textContent = m.body;
      li.appendChild(author);
      li.appendChild(body);
      list.appendChild(li);
    }
    // Trim from the head
    while (list.childElementCount > max) {
      const first = list.firstElementChild;
      if (first === null) break;
      list.removeChild(first);
    }
    // Auto-scroll to the bottom
    list.scrollTop = list.scrollHeight;
  }

  return {
    root,
    start() {
      stopped = false;
      void tick();
    },
    stop() {
      stopped = true;
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    },
  };
}
