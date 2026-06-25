import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
    testTimeout: 20_000,
    hookTimeout: 20_000,
    // Colyseus's IPC module hijacks process.send for matchmaking, which collides
    // with vitest's parent-fork IPC channel. Worker threads sidestep that.
    pool: "threads",
    poolOptions: { threads: { singleThread: true, isolate: false } },
  },
});
