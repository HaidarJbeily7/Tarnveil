export function mountFriends(_target?: HTMLElement): () => void {
  const div = document.createElement("div");
  div.setAttribute("data-testid", "friends-screen");
  div.textContent = "friends — coming next";
  (_target ?? document.body).appendChild(div);
  return () => div.remove();
}
