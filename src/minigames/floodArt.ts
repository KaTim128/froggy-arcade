/**
 * The Flood's surfaces, painted once into textures: the shaft's brickwork
 * (a near wall and a far one, so the climb has depth) and one face per kind
 * of ledge.  The colour table in flood.ts still decides what a kind LOOKS
 * like at a glance -- these keep that colour and give it a material: planks
 * hold, grates move, a riveted bar turns, a girder slides out of the wall,
 * cracked stone is about to go.
 */

import type Phaser from 'phaser';

const tex = (scene: Phaser.Scene, key: string, w: number, h: number, paint: (g: Phaser.GameObjects.Graphics) => void): void => {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  paint(g);
  g.generateTexture(key, w, h);
  g.destroy();
};

const shade = (c: number, k: number): number => {
  const r = Math.min(255, Math.max(0, Math.round(((c >> 16) & 0xff) * k)));
  const gg = Math.min(255, Math.max(0, Math.round(((c >> 8) & 0xff) * k)));
  const b = Math.min(255, Math.max(0, Math.round((c & 0xff) * k)));
  return (r << 16) | (gg << 8) | b;
};

/** Bricks: rows of 16x8, offset every other row, with stains and the odd dark one. */
function bricks(g: Phaser.GameObjects.Graphics, base: number, mortar: number, seed: number): void {
  g.fillStyle(mortar, 1).fillRect(0, 0, 64, 64);
  let s = seed;
  const rnd = (): number => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let row = 0; row < 8; row++) {
    const off = row % 2 ? 8 : 0;
    for (let col = -1; col < 4; col++) {
      const x = col * 16 + off;
      const k = 0.85 + rnd() * 0.3;
      g.fillStyle(shade(base, k), 1).fillRect(x + 1, row * 8 + 1, 14, 6);
      g.fillStyle(shade(base, k * 1.15), 1).fillRect(x + 1, row * 8 + 1, 14, 1);
      if (rnd() < 0.15) g.fillStyle(shade(base, 0.6), 1).fillRect(x + 3 + Math.floor(rnd() * 8), row * 8 + 3, 3, 2);
    }
  }
  // water stains running down
  for (let i = 0; i < 3; i++) {
    const x = Math.floor(rnd() * 60);
    g.fillStyle(0x0a1a2a, 0.25).fillRect(x, 0, 2, 64);
  }
}

export function makeFloodTextures(scene: Phaser.Scene, colours: Record<string, number>): void {
  tex(scene, 'flood_wall_far', 64, 64, (g) => bricks(g, 0x1e2a3e, 0x101724, 7));
  tex(scene, 'flood_wall_near', 64, 64, (g) => bricks(g, 0x2c3a52, 0x141c2a, 13));

  const ledge = (key: string, col: number, paint: (g: Phaser.GameObjects.Graphics) => void): void =>
    tex(scene, key, 16, 6, (g) => {
      g.fillStyle(col, 1).fillRect(0, 0, 16, 6);
      paint(g);
      g.fillStyle(shade(col, 0.55), 1).fillRect(0, 5, 16, 1);
    });
  // planks: grain and a nail
  ledge('flood_static', colours.static, (g) => {
    g.fillStyle(shade(colours.static, 1.2), 1).fillRect(0, 1, 16, 1);
    g.fillStyle(shade(colours.static, 0.75), 1).fillRect(0, 3, 6, 1).fillRect(9, 3, 7, 1);
    g.fillStyle(shade(colours.static, 0.6), 1).fillRect(15, 0, 1, 5);
    g.fillStyle(0xc8c8c8, 1).fillRect(2, 2, 1, 1);
  });
  // grates: open slots you can see the dark through
  const grate = (key: string, col: number): void =>
    ledge(key, col, (g) => {
      g.fillStyle(shade(col, 0.45), 1);
      for (let x = 1; x < 16; x += 4) g.fillRect(x, 2, 2, 2);
      g.fillStyle(shade(col, 1.3), 1).fillRect(0, 0, 16, 1);
    });
  grate('flood_slide', colours.slide);
  grate('flood_rise', colours.rise);
  // a riveted bar
  ledge('flood_spin', colours.spin, (g) => {
    g.fillStyle(shade(colours.spin, 1.35), 1).fillRect(0, 0, 16, 1);
    g.fillStyle(0xe8e0f0, 1).fillRect(3, 2, 1, 1).fillRect(11, 2, 1, 1);
  });
  // a lit rail
  ledge('flood_orbit', colours.orbit, (g) => {
    g.fillStyle(0xffffff, 0.8).fillRect(0, 0, 16, 1);
    g.fillStyle(shade(colours.orbit, 0.6), 1).fillRect(7, 1, 2, 4);
  });
  // an I-beam
  ledge('flood_retract', colours.retract, (g) => {
    g.fillStyle(shade(colours.retract, 1.3), 1).fillRect(0, 0, 16, 1);
    g.fillStyle(shade(colours.retract, 0.7), 1).fillRect(0, 2, 16, 2);
    g.fillStyle(shade(colours.retract, 1.1), 1).fillRect(5, 2, 1, 2);
  });
  // cracked stone
  ledge('flood_crumble', colours.crumble, (g) => {
    g.fillStyle(shade(colours.crumble, 0.55), 1).fillRect(4, 0, 1, 2).fillRect(5, 2, 1, 2).fillRect(11, 1, 1, 3).fillRect(12, 3, 2, 1);
    g.fillStyle(shade(colours.crumble, 1.2), 1).fillRect(0, 0, 4, 1).fillRect(7, 0, 4, 1);
  });

  // a pipe section and a caged lamp, for the walls
  tex(scene, 'flood_pipe', 6, 16, (g) => {
    g.fillStyle(0x3a4a5a, 1).fillRect(0, 0, 6, 16);
    g.fillStyle(0x5a6e82, 1).fillRect(1, 0, 1, 16);
    g.fillStyle(0x222c38, 1).fillRect(0, 14, 6, 2);
  });
  tex(scene, 'flood_lamp', 9, 9, (g) => {
    g.fillStyle(0x2a2a2a, 1).fillRect(0, 0, 9, 2);
    g.fillStyle(0xffe08a, 1).fillCircle(4.5, 5, 3);
    g.lineStyle(1, 0x2a2a2a, 1).lineBetween(2, 2, 2, 8).lineBetween(7, 2, 7, 8).lineBetween(1, 8, 8, 8);
  });
}
