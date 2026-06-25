import { GAME } from "@tarnveil/shared/game.config";
import { createButton, createPanel } from "../components/index.js";
import { createChatFeed } from "../chat-feed.js";
import "./landing.css";

/**
 * Phase C1 — Landing / splash screen.
 *
 * Hero: wordmark (from GAME.name), tagline (from GAME.tagline), and a
 * primary "Enter <name>" CTA that routes to ?ui=connect (Phase C2).
 *
 * Chat: a fixed bottom-left lakeglass panel polling the public spectate
 * endpoint so the world reads as alive before sign-in.
 */
export function mountLanding(target: HTMLElement = document.body): () => void {
  const root = document.createElement("div");
  root.className = "landing";
  root.setAttribute("data-testid", "landing");

  // Drifting mist band (animation collapsed under reduced-motion).
  const mist = document.createElement("div");
  mist.className = "landing__mist";
  mist.setAttribute("aria-hidden", "true");
  root.appendChild(mist);

  // --- Hero ---
  const hero = document.createElement("section");
  hero.className = "landing__hero";

  const meta = document.createElement("span");
  meta.className = "landing__meta";
  meta.textContent = "an isometric MMO";
  hero.appendChild(meta);

  const wordmark = document.createElement("h1");
  wordmark.className = "landing__wordmark";
  wordmark.setAttribute("data-testid", "wordmark");
  // R8: the only place we write GAME.name into the DOM directly.
  wordmark.textContent = GAME.name;
  hero.appendChild(wordmark);

  const tagline = document.createElement("p");
  tagline.className = "landing__tagline";
  tagline.setAttribute("data-testid", "tagline");
  tagline.textContent = GAME.tagline;
  hero.appendChild(tagline);

  const cta = createButton({
    label: `Enter ${GAME.name}`,
    variant: "primary",
    onClick: () => {
      const url = new URL(window.location.href);
      url.searchParams.set("ui", "connect");
      window.history.pushState({}, "", url);
      // Trigger a re-render via popstate so future routes are observable.
      window.dispatchEvent(new PopStateEvent("popstate"));
    },
  });
  cta.classList.add("landing__cta-btn");
  cta.setAttribute("data-testid", "enter-cta");
  const ctaWrap = document.createElement("div");
  ctaWrap.className = "landing__cta";
  ctaWrap.appendChild(cta);
  hero.appendChild(ctaWrap);

  root.appendChild(hero);

  // --- Live chat panel ---
  const chatWrap = document.createElement("aside");
  chatWrap.className = "landing__chat";
  chatWrap.setAttribute("data-testid", "landing-chat");
  const chatPanel = createPanel({ ariaLabel: "live world chat" });
  const chatTitle = document.createElement("h2");
  chatTitle.className = "landing__chat-title";
  chatTitle.textContent = "World chat";
  chatPanel.appendChild(chatTitle);
  const feed = createChatFeed({ region: "global", shard: 0 });
  chatPanel.appendChild(feed.root);
  chatWrap.appendChild(chatPanel);
  root.appendChild(chatWrap);

  target.appendChild(root);
  feed.start();

  return () => {
    feed.stop();
    root.remove();
  };
}
