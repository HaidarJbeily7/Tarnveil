export function mountSettingsTabs(_target?: HTMLElement): () => void {
  const div = document.createElement("div");
  div.setAttribute("data-testid", "settings-tabs-screen");
  div.textContent = "settings tabs — coming next";
  (_target ?? document.body).appendChild(div);
  return () => div.remove();
}
