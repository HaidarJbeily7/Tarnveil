import type { FastifyInstance } from "fastify";
import { GAME } from "@tarnveil/shared/game.config";

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Tiny inline page: no session, polls /api/chat once per second and renders.
function buildPage(): string {
  const title = escape(GAME.name);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>${title} — spectate</title>
    <style>
      body { font-family: monospace; background: #111; color: #eee; margin: 0; padding: 16px; }
      h1 { font-size: 16px; margin: 0 0 8px; color: #ffd166; }
      #feed { display: flex; flex-direction: column; gap: 4px; max-height: 80vh; overflow-y: auto; }
      .msg { padding: 4px 6px; background: #1c1c1c; border-radius: 4px; font-size: 13px; }
      .msg .author { color: #66ccff; margin-right: 6px; }
    </style>
  </head>
  <body>
    <h1>${title} — live world chat</h1>
    <div id="feed" data-test-id="spectate-feed"></div>
    <script>
      const feed = document.getElementById("feed");
      let cursor = 0;
      async function tick() {
        try {
          const res = await fetch("/api/chat?after=" + cursor + "&region=global&shard=0");
          const data = await res.json();
          for (const msg of data.messages) {
            const div = document.createElement("div");
            div.className = "msg";
            div.innerHTML = '<span class="author">' + msg.author + ':</span>' + msg.body;
            feed.appendChild(div);
            cursor = Math.max(cursor, msg.id);
          }
        } catch (e) {
          // best-effort polling
        }
      }
      setInterval(tick, 1000);
      tick();
    </script>
  </body>
</html>`;
}

export function registerSpectateRoute(app: FastifyInstance): void {
  app.get("/spectate", async (_req, reply) => {
    reply.header("Content-Type", "text/html; charset=utf-8");
    reply.header("Cache-Control", "public, max-age=60");
    return buildPage();
  });
}
