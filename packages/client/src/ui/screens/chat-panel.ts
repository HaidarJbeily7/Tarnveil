import { createButton, createPanel, createTabs } from "../components/index.js";
import { createChatFeed } from "../chat-feed.js";
import "./chat-panel.css";

const MAX_BODY = 240;
const RATE_LIMIT = 5; // messages
const RATE_WINDOW_MS = 10_000;

interface Channel {
  id: string;
  label: string;
  region?: string;
  shard?: number;
  /** local cache of mock messages for local/DMs tabs */
  messages: Array<{ author: string; body: string }>;
}

const CHANNELS: Channel[] = [
  { id: "world", label: "World", region: "global", shard: 0, messages: [] },
  { id: "local", label: "Local", messages: [{ author: "you", body: "Hello, mainland." }] },
  { id: "dms", label: "DMs", messages: [{ author: "alice", body: "ping" }] },
];

export function mountChatPanel(target: HTMLElement = document.body): () => void {
  const root = document.createElement("div");
  root.className = "chat-panel";
  root.setAttribute("data-testid", "chat-panel-screen");

  const panel = createPanel({ ariaLabel: "chat" });
  panel.classList.add("chat-panel__panel");

  let active = "world";
  const tabs = createTabs({
    tabs: CHANNELS.map((c) => ({ id: c.id, label: c.label })),
    onChange: (id) => {
      active = id;
      paintFeed();
    },
  });
  tabs.root.setAttribute("data-testid", "chat-tabs");
  panel.appendChild(tabs.root);

  const feedHost = document.createElement("div");
  feedHost.className = "chat-panel__feed";
  feedHost.setAttribute("role", "log");
  feedHost.setAttribute("aria-live", "polite");
  feedHost.setAttribute("data-testid", "chat-feed");
  panel.appendChild(feedHost);

  // Live feed (only the World channel polls /api/chat).
  const live = createChatFeed({ region: "global", shard: 0 });

  function paintFeed(): void {
    feedHost.replaceChildren();
    const channel = CHANNELS.find((c) => c.id === active)!;
    if (channel.id === "world") {
      feedHost.appendChild(live.root);
      live.start();
    } else {
      live.stop();
      if (channel.messages.length === 0) {
        const empty = document.createElement("p");
        empty.textContent = "— no messages —";
        empty.style.color = "color-mix(in srgb, var(--mist) 40%, transparent)";
        feedHost.appendChild(empty);
      }
      for (const m of channel.messages) {
        const row = document.createElement("div");
        row.className = "chat-panel__msg";
        const a = document.createElement("span");
        a.className = "author";
        a.textContent = m.author;
        const b = document.createElement("span");
        b.className = "body";
        b.textContent = m.body;
        row.appendChild(a);
        row.appendChild(b);
        feedHost.appendChild(row);
      }
    }
  }
  paintFeed();

  // --- Send form ---
  const form = document.createElement("form");
  form.className = "chat-panel__form";
  const input = document.createElement("input");
  input.className = "chat-panel__input";
  input.type = "text";
  input.placeholder = "say something…";
  input.maxLength = MAX_BODY;
  input.setAttribute("data-testid", "chat-input");
  input.setAttribute("aria-label", "message");
  const send = createButton({ label: "Send", variant: "primary", type: "submit" });
  form.appendChild(input);
  form.appendChild(send);
  panel.appendChild(form);

  const counter = document.createElement("div");
  counter.className = "chat-panel__counter";
  counter.setAttribute("data-testid", "chat-counter");
  counter.textContent = `0 / ${MAX_BODY}`;
  panel.appendChild(counter);

  const sendTimes: number[] = [];
  let notice: HTMLElement | null = null;

  function clearNotice(): void {
    if (notice !== null) {
      notice.remove();
      notice = null;
    }
  }
  function showRateNotice(): void {
    clearNotice();
    notice = document.createElement("div");
    notice.className = "chat-panel__rate-notice";
    notice.setAttribute("data-testid", "chat-rate-notice");
    notice.setAttribute("role", "alert");
    notice.textContent = "Slow down — you're sending messages too fast.";
    panel.appendChild(notice);
  }

  input.addEventListener("input", () => {
    counter.textContent = `${input.value.length} / ${MAX_BODY}`;
  });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const body = input.value.trim();
    if (body.length === 0) return;
    const now = Date.now();
    while (sendTimes.length > 0 && now - sendTimes[0]! > RATE_WINDOW_MS) sendTimes.shift();
    if (sendTimes.length >= RATE_LIMIT) {
      showRateNotice();
      return;
    }
    sendTimes.push(now);
    clearNotice();
    const channel = CHANNELS.find((c) => c.id === active)!;
    channel.messages.push({ author: "you", body });
    input.value = "";
    counter.textContent = `0 / ${MAX_BODY}`;
    paintFeed();
  });

  // --- Mute placeholder ---
  const muteRow = document.createElement("div");
  muteRow.className = "chat-panel__mute-row";
  muteRow.appendChild(
    createButton({
      label: "Mute selected sender",
      variant: "secondary",
      size: "small",
      onClick: () => {
        const channel = CHANNELS.find((c) => c.id === active)!;
        const last = channel.messages[channel.messages.length - 1];
        if (last !== undefined && last.author !== "you") {
          channel.messages = channel.messages.filter((m) => m.author !== last.author);
          paintFeed();
        }
      },
    }),
  );
  panel.appendChild(muteRow);

  root.appendChild(panel);
  target.appendChild(root);

  return () => {
    live.stop();
    root.remove();
  };
}
