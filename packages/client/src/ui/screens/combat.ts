export function mountCombat(_target?: HTMLElement): () => void {
  const div = document.createElement("div");
  div.setAttribute("data-testid", "combat-screen");
  div.textContent = "combat feedback — coming next";
  (_target ?? document.body).appendChild(div);
  return () => div.remove();
}
