import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
    testTimeout: 15_000,
    // Each suite touches a shared Redis instance; serialize so they don't race.
    pool: "threads",
    poolOptions: { threads: { singleThread: true } },
    fileParallelism: false,
  },
});
