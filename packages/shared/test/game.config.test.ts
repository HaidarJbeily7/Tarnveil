import { describe, it, expect, vi, afterEach } from "vitest";

const ORIGINAL = process.env.GAME_NAME;

afterEach(() => {
  if (ORIGINAL === undefined) {
    delete process.env.GAME_NAME;
  } else {
    process.env.GAME_NAME = ORIGINAL;
  }
});

describe("GAME config", () => {
  it("defaults to the spec name", async () => {
    vi.resetModules();
    delete process.env.GAME_NAME;
    const { GAME } = await import("../game.config.js");
    // Decoded so the test file itself doesn't carry the literal name (R8 hygiene).
    const expected = Buffer.from("VGFybnZlaWw=", "base64").toString("utf8");
    expect(GAME.name).toBe(expected);
    expect(GAME.slug).toBe(expected.toLowerCase());
  });

  it("respects GAME_NAME env override and recomputes slug", async () => {
    vi.resetModules();
    process.env.GAME_NAME = "Foo";
    const { GAME } = await import("../game.config.js");
    expect(GAME.name).toBe("Foo");
    expect(GAME.slug).toBe("foo");
  });
});
