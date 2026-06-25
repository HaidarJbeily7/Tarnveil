export function mountMarket(_target?: HTMLElement): () => void {
  const div = document.createElement("div");
  div.setAttribute("data-testid", "market-screen");
  div.textContent = "marketplace — coming next";
  (_target ?? document.body).appendChild(div);
  return () => div.remove();
}
