export function mountLoading(_target?: HTMLElement): () => void {
  const div = document.createElement("div");
  div.setAttribute("data-testid", "loading-screen");
  div.textContent = "loading — coming next";
  (_target ?? document.body).appendChild(div);
  return () => div.remove();
}
