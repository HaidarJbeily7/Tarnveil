import { defineConfig } from "@playwright/test";

const DEFAULT_PORT = 5173;
const BRANDED_PORT = 5174;

export default defineConfig({
  testDir: "e2e",
  retries: 0,
  reporter: [["list"]],
  projects: [
    {
      name: "default",
      use: { baseURL: `http://localhost:${DEFAULT_PORT}` },
      testMatch: /(?:title\.default|chop|gallery|landing|connect)\.spec\.ts/,
    },
    {
      name: "branded",
      use: { baseURL: `http://localhost:${BRANDED_PORT}` },
      testMatch: /title\.branded\.spec\.ts/,
    },
  ],
  webServer: [
    {
      command: `pnpm vite --port ${DEFAULT_PORT} --strictPort`,
      url: `http://localhost:${DEFAULT_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: `pnpm vite --port ${BRANDED_PORT} --strictPort`,
      url: `http://localhost:${BRANDED_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: { GAME_NAME: "Foo" },
    },
  ],
});
