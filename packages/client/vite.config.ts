import { defineConfig, loadEnv } from "vite";

const PASSTHROUGH_ENV = [
  "GAME_NAME",
  "GAME_TOKEN_SYMBOL",
  "GAME_GOLD_LABEL",
  "GAME_TAGLINE",
] as const;

export default defineConfig(({ mode }) => {
  // loadEnv reads .env / .env.<mode> from cwd; process.env covers shell overrides.
  const fileEnv = loadEnv(mode, process.cwd(), "");
  const define: Record<string, string> = {};
  for (const key of PASSTHROUGH_ENV) {
    const value = process.env[key] ?? fileEnv[key];
    // Replace the literal `process.env.X` expression at build time so game.config.ts
    // works in the browser without polyfilling `process`.
    define[`process.env.${key}`] = value === undefined ? "undefined" : JSON.stringify(value);
  }
  return {
    root: ".",
    server: { port: 5173, strictPort: true },
    define,
  };
});
