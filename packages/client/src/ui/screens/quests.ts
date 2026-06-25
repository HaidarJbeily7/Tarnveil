export function mountQuests(_target?: HTMLElement): () => void {
  const div = document.createElement("div");
  div.setAttribute("data-testid", "quests-screen");
  div.textContent = "quests — coming next";
  (_target ?? document.body).appendChild(div);
  return () => div.remove();
}
