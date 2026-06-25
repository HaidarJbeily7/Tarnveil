import { GAME } from "@tarnveil/shared/game.config";
import { createButton, createPanel } from "../components/index.js";
import "./connect.css";

/**
 * Phase C2 — Wallet sign-in screen.
 *
 * Visible states:
 *   idle              ready to connect
 *   connecting        spinner; wallet adapter selecting
 *   signing           "approve in your wallet" — user can simulate rejection
 *   rejected          recovery action: try again
 *   wrong-network     recovery action: switch network
 *   below-min-balance gate copy uses GAME.tokenSymbol
 *   admitted          success; CTA forwards to /?ui=character
 *
 * Real wallet adapter integration plugs in later (Phase 6 already shipped
 * /api/wallet/nonce + /api/wallet/sign-in on the API). Until then the
 * buttons simulate each state so design + accessibility can be reviewed.
 */

export type ConnectState =
  | "idle"
  | "connecting"
  | "signing"
  | "rejected"
  | "wrong-network"
  | "below-min-balance"
  | "admitted";

interface RenderProps {
  state: ConnectState;
  setState(next: ConnectState): void;
  goLanding(): void;
  goCharacter(): void;
}

const STATE_LABELS: Record<ConnectState, string> = {
  idle: "Ready",
  connecting: "Connecting to wallet",
  signing: "Awaiting signature",
  rejected: "Signature rejected",
  "wrong-network": "Wrong network",
  "below-min-balance": "Insufficient balance",
  admitted: "Admitted",
};

const STATE_KIND: Record<ConnectState, "idle" | "working" | "error" | "ok"> = {
  idle: "idle",
  connecting: "working",
  signing: "working",
  rejected: "error",
  "wrong-network": "error",
  "below-min-balance": "error",
  admitted: "ok",
};

export function mountConnect(target: HTMLElement = document.body): () => void {
  const root = document.createElement("div");
  root.className = "connect";
  root.setAttribute("data-testid", "connect");

  const panel = createPanel({ ariaLabel: "wallet sign-in" });
  panel.classList.add("connect__card");

  let state: ConnectState = "idle";

  const renderArea = document.createElement("div");
  renderArea.setAttribute("data-testid", "connect-body");
  panel.appendChild(renderArea);

  const setState = (next: ConnectState): void => {
    state = next;
    render(renderArea, {
      state,
      setState,
      goLanding: () => navigate("landing"),
      goCharacter: () => navigate("character"),
    });
    // Re-paint the state pill marker for e2e visibility.
    renderArea.setAttribute("data-state", state);
  };

  setState("idle");

  // Back-to-landing link sits outside the panel.
  const back = document.createElement("button");
  back.type = "button";
  back.className = "btn btn--secondary btn--small connect__back";
  back.textContent = "← Back";
  back.addEventListener("click", () => navigate("landing"));
  panel.appendChild(back);

  root.appendChild(panel);
  target.appendChild(root);

  return () => root.remove();
}

function navigate(ui: string): void {
  const url = new URL(window.location.href);
  url.searchParams.set("ui", ui);
  window.history.pushState({}, "", url);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function render(container: HTMLElement, p: RenderProps): void {
  container.replaceChildren();

  const title = document.createElement("h1");
  title.className = "connect__title";
  title.textContent = "Sign in with your wallet";
  container.appendChild(title);

  const pill = document.createElement("span");
  pill.className = `connect__state connect__state--${STATE_KIND[p.state]}`;
  pill.setAttribute("data-testid", "connect-state");
  pill.textContent = STATE_LABELS[p.state];
  container.appendChild(pill);

  const lead = document.createElement("p");
  lead.className = "connect__lead";
  lead.setAttribute("data-testid", "connect-lead");
  container.appendChild(lead);

  const actions = document.createElement("div");
  actions.className = "connect__actions";
  container.appendChild(actions);

  switch (p.state) {
    case "idle":
      lead.textContent =
        `Connect your Solana wallet to enter ${GAME.name}. ` +
        "We never ask for a seed phrase — only a message signature.";
      actions.appendChild(
        createButton({
          label: "Connect wallet",
          variant: "primary",
          onClick: () => p.setState("connecting"),
        }),
      );
      // Test affordances so e2e can step through each state
      addStateSwitcher(actions, p);
      break;
    case "connecting":
      lead.textContent = "Pick the wallet you'd like to use…";
      actions.appendChild(
        createButton({
          label: "Continue",
          variant: "primary",
          onClick: () => p.setState("signing"),
        }),
      );
      actions.appendChild(
        createButton({
          label: "Wrong network",
          variant: "secondary",
          onClick: () => p.setState("wrong-network"),
        }),
      );
      break;
    case "signing":
      lead.textContent =
        "Approve the sign-in message in your wallet. " +
        "Nothing leaves your wallet other than the signature itself.";
      actions.appendChild(
        createButton({
          label: "Approve",
          variant: "primary",
          onClick: () => p.setState("admitted"),
        }),
      );
      actions.appendChild(
        createButton({
          label: "I rejected",
          variant: "secondary",
          onClick: () => p.setState("rejected"),
        }),
      );
      actions.appendChild(
        createButton({
          label: "Below balance",
          variant: "secondary",
          onClick: () => p.setState("below-min-balance"),
        }),
      );
      break;
    case "rejected":
      lead.textContent =
        "The signature was declined in your wallet. " +
        "Approve the message to enter the world.";
      actions.appendChild(
        createButton({
          label: "Try again",
          variant: "primary",
          onClick: () => p.setState("signing"),
        }),
      );
      break;
    case "wrong-network":
      lead.textContent =
        "Your wallet is on the wrong chain. Switch to Solana devnet, " +
        "then try again.";
      actions.appendChild(
        createButton({
          label: "Switch network",
          variant: "primary",
          onClick: () => p.setState("connecting"),
        }),
      );
      break;
    case "below-min-balance": {
      const gate = document.createElement("div");
      gate.className = "connect__gate";
      gate.setAttribute("data-testid", "connect-gate");
      // R8: token symbol from GAME, not a literal.
      gate.innerHTML = `You need at least <strong>10 ${GAME.tokenSymbol}</strong> to enter. ` +
        "Acquire more, then sign in again.";
      container.insertBefore(gate, actions);
      actions.appendChild(
        createButton({
          label: "Try again",
          variant: "primary",
          onClick: () => p.setState("signing"),
        }),
      );
      break;
    }
    case "admitted":
      lead.textContent = "Signed in. Pick a character to continue.";
      actions.appendChild(
        createButton({
          label: "Choose character →",
          variant: "primary",
          onClick: () => p.goCharacter(),
        }),
      );
      break;
  }
}

function addStateSwitcher(actions: HTMLElement, p: RenderProps): void {
  // Tiny secondary row that lets QA / e2e drive states deterministically.
  // Only attached to the idle screen — once flowing, the natural buttons
  // are enough.
  const others: ConnectState[] = ["rejected", "wrong-network", "below-min-balance"];
  for (const s of others) {
    actions.appendChild(
      createButton({
        label: `Sim: ${s}`,
        variant: "secondary",
        size: "small",
        onClick: () => p.setState(s),
      }),
    );
  }
}
