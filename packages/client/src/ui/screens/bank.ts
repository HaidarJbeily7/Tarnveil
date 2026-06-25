export function mountBank(_target?: HTMLElement): () => void {
  const div = document.createElement("div");
  div.setAttribute("data-testid", "bank-screen");
  div.textContent = "bank — coming next";
  (_target ?? document.body).appendChild(div);
  return () => div.remove();
}
