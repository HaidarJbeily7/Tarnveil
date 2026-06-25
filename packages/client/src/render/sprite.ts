import Phaser from "phaser";

/**
 * UI_FIX_2 F4 — sprite helper with a glaring fallback.
 *
 * A world entity must always render from a real loaded texture. If the
 * key is missing we render a 32×32 magenta square instead of falling back
 * to a "nice" primitive — magenta is loud so the asset pipeline bug
 * surfaces immediately. console.error makes it visible in CI logs too.
 */
export function sprite(
  scene: Phaser.Scene,
  x: number,
  y: number,
  key: string,
  frame?: string | number,
): Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle {
  if (!scene.textures.exists(key)) {
    // eslint-disable-next-line no-console
    console.error(`MISSING TEXTURE: ${key}`);
    return scene.add.rectangle(x, y, 32, 32, 0xff00ff);
  }
  if (frame !== undefined) {
    return scene.add.sprite(x, y, key, frame);
  }
  return scene.add.image(x, y, key);
}
