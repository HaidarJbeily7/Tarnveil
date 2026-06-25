export function mountChatPanel(_target?: HTMLElement): () => void {
  const div = document.createElement("div");
  div.setAttribute("data-testid", "chat-panel-screen");
  div.textContent = "chat panel — coming next";
  (_target ?? document.body).appendChild(div);
  return () => div.remove();
}
