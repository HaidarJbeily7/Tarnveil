export function mountInventory(_target?: HTMLElement): () => void {
  // Stub — populated by Phase C5 commit.
  const div = document.createElement("div");
  div.setAttribute("data-testid", "inventory-screen");
  div.textContent = "inventory — coming next";
  (_target ?? document.body).appendChild(div);
  return () => div.remove();
}
