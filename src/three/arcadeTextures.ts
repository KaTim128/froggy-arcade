/**
 * ---- THE ARCADE'S SURFACES, PAINTED.  The last hide-and-seek room was built
 * from flat-coloured boxes, which up close -- and the ending is all up close:
 * a key in your hand, a padlock in your face -- read as blocks.  These are the
 * pictures that go on them, painted once at a size that holds up close to the
 * lens (and cached, so twelve cabinets of one colour share one picture):
 *
 *   brass for the key and the padlock -- brushed, worn bright on the edges,
 *   darkened in the hollows, a maker's mark stamped into the lock;
 *   steel and chrome for the chain and the shackle; brushed aluminium for
 *   the door frames;
 *   and for the cabinets, the things a real one has: side art (a frog in
 *   a burst of colour, the game's name up the side), a lit marquee with the
 *   title on it, a screen with a game running on it, a control panel deck,
 *   and a coin door with its slots and its 25c.
 */

import * as THREE from 'three';

const cache = new Map<string, THREE.CanvasTexture>();

function paint(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, repeat = false): THREE.CanvasTexture {
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  cache.set(key, t);
  return t;
}

const rng = (seed: number) => {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
};
const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
const shade = (n: number, k: number) => {
  const c = new THREE.Color(n).multiplyScalar(k);
  return `rgb(${Math.min(255, Math.round(c.r * 255))},${Math.min(255, Math.round(c.g * 255))},${Math.min(255, Math.round(c.b * 255))})`;
};

/** Brushed metal: a base, fine streaks along one way, a few scratches. */
function brushed(g: CanvasRenderingContext2D, w: number, h: number, base: string, light: string, dark: string, seed: number): void {
  const r = rng(seed);
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  for (let k = 0; k < w * 3; k++) {
    g.fillStyle = r() < 0.5 ? light : dark;
    g.globalAlpha = 0.05 + r() * 0.12;
    g.fillRect(0, r() * h, w, 1);
  }
  g.globalAlpha = 0.35;
  for (let k = 0; k < 30; k++) {
    g.strokeStyle = r() < 0.5 ? light : dark;
    g.lineWidth = 0.6;
    g.beginPath();
    const x = r() * w;
    const y = r() * h;
    g.moveTo(x, y);
    g.lineTo(x + (r() - 0.5) * 40, y + (r() - 0.5) * 8);
    g.stroke();
  }
  g.globalAlpha = 1;
}

/** Brass: warm, brushed, worn bright toward the edges and dark in the middle of nothing. */
export function brassTex(): THREE.CanvasTexture {
  return paint('brass', 256, 256, (g, w, h) => {
    brushed(g, w, h, '#b8902e', '#f4d77e', '#6a4a12', 11);
    // the tarnish: blotches of darker, greener brass
    const r = rng(12);
    for (let k = 0; k < 40; k++) {
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1);
      gr.addColorStop(0, 'rgba(70,52,14,0.28)');
      gr.addColorStop(1, 'rgba(70,52,14,0)');
      g.save();
      g.translate(r() * w, r() * h);
      g.scale(8 + r() * 30, 6 + r() * 20);
      g.fillStyle = gr;
      g.beginPath();
      g.arc(0, 0, 1, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
    // the edges handled bright
    const edge = g.createLinearGradient(0, 0, 0, h);
    edge.addColorStop(0, 'rgba(255,236,170,0.35)');
    edge.addColorStop(0.15, 'rgba(255,236,170,0)');
    edge.addColorStop(0.85, 'rgba(255,236,170,0)');
    edge.addColorStop(1, 'rgba(255,236,170,0.3)');
    g.fillStyle = edge;
    g.fillRect(0, 0, w, h);
  });
}

/** The padlock's face: brass, a stamped maker's mark, a rivet in each corner. */
export function padlockFaceTex(): THREE.CanvasTexture {
  return paint('padlockFace', 256, 256, (g, w, h) => {
    const src = brassTex().image as HTMLCanvasElement;
    g.drawImage(src, 0, 0, w, h);
    // a raised border pressed into it
    g.strokeStyle = 'rgba(90,64,16,0.7)';
    g.lineWidth = 6;
    g.strokeRect(14, 14, w - 28, h - 28);
    g.strokeStyle = 'rgba(255,230,150,0.5)';
    g.lineWidth = 2;
    g.strokeRect(19, 19, w - 38, h - 38);
    // the maker's mark, stamped (dark, with a bright lip under it)
    g.textAlign = 'center';
    g.font = 'bold 30px monospace';
    g.fillStyle = 'rgba(255,232,160,0.55)';
    g.fillText('FROG-LOK', w / 2 + 1, 62);
    g.fillStyle = 'rgba(60,40,8,0.85)';
    g.fillText('FROG-LOK', w / 2, 60);
    g.font = 'bold 16px monospace';
    g.fillStyle = 'rgba(60,40,8,0.7)';
    g.fillText('HARDENED  50MM', w / 2, 86);
    g.fillText('NO. 1612', w / 2, 226);
    // rivets
    for (const [x, y] of [
      [34, 34],
      [w - 34, 34],
      [34, h - 34],
      [w - 34, h - 34],
    ]) {
      const rv = g.createRadialGradient(x - 2, y - 2, 1, x, y, 9);
      rv.addColorStop(0, '#fff0b8');
      rv.addColorStop(0.5, '#b88a2a');
      rv.addColorStop(1, '#4a320a');
      g.fillStyle = rv;
      g.beginPath();
      g.arc(x, y, 8, 0, Math.PI * 2);
      g.fill();
    }
  });
}

/** Steel for the chain: cold, brushed, a little rust in it. */
export function steelTex(): THREE.CanvasTexture {
  return paint('steel', 128, 128, (g, w, h) => {
    brushed(g, w, h, '#8a9098', '#e4e8ee', '#3a3e44', 21);
    const r = rng(22);
    for (let k = 0; k < 18; k++) {
      g.fillStyle = `rgba(120,62,24,${0.1 + r() * 0.2})`;
      g.fillRect(r() * w, r() * h, 2 + r() * 6, 1 + r() * 3);
    }
  });
}

/** Chrome for the shackle: bright bands of reflected light down it. */
export function chromeTex(): THREE.CanvasTexture {
  return paint('chrome', 128, 128, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#f4f6fa');
    gr.addColorStop(0.3, '#7a808a');
    gr.addColorStop(0.45, '#e8ecf2');
    gr.addColorStop(0.6, '#4a5058');
    gr.addColorStop(1, '#d8dce4');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    brushed(g, w, h, 'rgba(0,0,0,0)', '#ffffff', '#30343a', 31);
  });
}

/** Brushed aluminium for the doors' frames. */
export function aluminiumTex(): THREE.CanvasTexture {
  return paint('aluminium', 256, 256, (g, w, h) => brushed(g, w, h, '#7a828e', '#c8d0da', '#3e444c', 41), true);
}

const TITLES = ['FROG FIGHTER', 'LILY PAD RUN', 'CROAK ATTACK', 'BOG BLASTER', 'TADPOLE TURBO', 'FLY CATCHER', 'SWAMP RACER', 'POND PATROL'];
const titleFor = (color: number) => TITLES[((color ^ (color >>> 9) ^ (color >>> 17)) >>> 0) % TITLES.length];

/** A cabinet's side art: a frog leaping out of a burst of its own colour, the name up the side. */
export function cabinetSideTex(color: number): THREE.CanvasTexture {
  return paint(`side_${color}`, 256, 512, (g, w, h) => {
    const r = rng(color);
    // the black laminate it is printed on
    g.fillStyle = '#0c0e14';
    g.fillRect(0, 0, w, h);
    // the burst: rays out from behind the frog
    const cx = w * 0.5;
    const cy = h * 0.42;
    for (let k = 0; k < 18; k++) {
      const a0 = (k / 18) * Math.PI * 2;
      g.fillStyle = k % 2 ? hex(color) : shade(color, 0.5);
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(cx + Math.cos(a0) * 400, cy + Math.sin(a0) * 400);
      g.lineTo(cx + Math.cos(a0 + 0.17) * 400, cy + Math.sin(a0 + 0.17) * 400);
      g.closePath();
      g.fill();
    }
    const fade = g.createRadialGradient(cx, cy, 20, cx, cy, 260);
    fade.addColorStop(0, 'rgba(12,14,20,0)');
    fade.addColorStop(1, 'rgba(12,14,20,0.85)');
    g.fillStyle = fade;
    g.fillRect(0, 0, w, h);
    // the frog: a green body, two big eyes up top, a grin, legs out
    g.save();
    g.translate(cx, cy);
    g.fillStyle = '#2e8a3e';
    g.beginPath();
    g.ellipse(0, 10, 62, 50, 0, 0, Math.PI * 2);
    g.fill();
    for (const s of [-1, 1]) {
      g.fillStyle = '#2e8a3e';
      g.beginPath();
      g.ellipse(s * 36, -34, 24, 22, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#f4f0e0';
      g.beginPath();
      g.arc(s * 36, -36, 15, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#101010';
      g.beginPath();
      g.arc(s * 36 + 3, -34, 7, 0, Math.PI * 2);
      g.fill();
      // the legs, kicking out
      g.strokeStyle = '#257232';
      g.lineWidth = 14;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(s * 40, 40);
      g.lineTo(s * 86, 80);
      g.lineTo(s * 70, 118);
      g.stroke();
    }
    g.fillStyle = '#4ab85a';
    g.beginPath();
    g.ellipse(-12, -2, 28, 18, -0.4, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#0e2a12';
    g.lineWidth = 5;
    g.beginPath();
    g.arc(0, 14, 34, 0.2, Math.PI - 0.2);
    g.stroke();
    g.restore();
    // the name, big, down the bottom of the side
    g.save();
    g.translate(w * 0.5, h * 0.82);
    g.textAlign = 'center';
    g.font = 'bold 34px monospace';
    g.lineWidth = 6;
    g.strokeStyle = '#05060a';
    const title = titleFor(color);
    const words = title.split(' ');
    words.forEach((wd, i) => {
      g.strokeText(wd, 0, i * 38);
      g.fillStyle = i ? '#ffffff' : hex(color);
      g.fillText(wd, 0, i * 38);
    });
    g.restore();
    // stars and speed lines about it
    for (let k = 0; k < 26; k++) {
      g.fillStyle = r() < 0.5 ? '#ffffff' : hex(color);
      g.globalAlpha = 0.5 + r() * 0.5;
      const x = r() * w;
      const y = r() * h * 0.7;
      g.fillRect(x, y, 3, 3);
    }
    g.globalAlpha = 1;
    // wear: scuffs along the bottom where shoes have kicked it
    for (let k = 0; k < 140; k++) {
      g.fillStyle = `rgba(0,0,0,${0.1 + r() * 0.3})`;
      g.fillRect(r() * w, h - r() * 60, 1 + r() * 4, 1);
    }
  });
}

/** The marquee: the title, lit from behind, in the cabinet's colour. */
export function marqueeTex(color: number): THREE.CanvasTexture {
  return paint(`marquee_${color}`, 512, 128, (g, w, h) => {
    const bg = g.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, shade(color, 0.45));
    bg.addColorStop(0.5, shade(color, 0.85));
    bg.addColorStop(1, shade(color, 0.4));
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = 'bold 58px monospace';
    g.lineWidth = 10;
    g.strokeStyle = '#08090e';
    const title = titleFor(color);
    g.strokeText(title, w / 2, h / 2 + 4);
    g.fillStyle = '#fff6d8';
    g.fillText(title, w / 2, h / 2 + 4);
    // the bulbs of the light behind it, showing through at the edges
    for (let x = 12; x < w; x += 24) {
      for (const y of [8, h - 8]) {
        const b = g.createRadialGradient(x, y, 0, x, y, 7);
        b.addColorStop(0, '#ffffff');
        b.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = b;
        g.fillRect(x - 7, y - 7, 14, 14);
      }
    }
  });
}

/** The screen: a game left running -- a maze of dots, a little frog, the score. */
export function screenTex(color: number): THREE.CanvasTexture {
  return paint(`screen_${color}`, 256, 192, (g, w, h) => {
    const r = rng(color + 5);
    g.fillStyle = '#04060c';
    g.fillRect(0, 0, w, h);
    // the maze
    g.strokeStyle = hex(color);
    g.lineWidth = 3;
    for (let k = 0; k < 14; k++) {
      const x = 16 + Math.floor(r() * 7) * 32;
      const y = 30 + Math.floor(r() * 5) * 30;
      g.strokeRect(x, y, 24 + Math.floor(r() * 2) * 32, 18);
    }
    g.fillStyle = '#f4f0c0';
    for (let x = 12; x < w; x += 16) for (let y = 40; y < h - 10; y += 30) if (r() < 0.6) g.fillRect(x, y, 3, 3);
    // the frog, and the thing after it
    g.fillStyle = '#4ad85a';
    g.fillRect(100, 100, 14, 12);
    g.fillStyle = '#ff4a4a';
    g.fillRect(160, 130, 14, 14);
    // the score along the top
    g.font = 'bold 16px monospace';
    g.fillStyle = '#ffffff';
    g.fillText('1UP  004120', 10, 18);
    g.fillStyle = hex(color);
    g.fillText('HI  99999', 150, 18);
    // the scanlines, and the curve of the glass darkening the corners
    for (let y = 0; y < h; y += 2) {
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fillRect(0, y, w, 1);
    }
    const vg = g.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, w * 0.7);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.7)');
    g.fillStyle = vg;
    g.fillRect(0, 0, w, h);
  });
}

/** The control panel deck: printed overlay, the move list, worn round the stick. */
export function panelTex(color: number): THREE.CanvasTexture {
  return paint(`panel_${color}`, 256, 128, (g, w, h) => {
    g.fillStyle = '#16181f';
    g.fillRect(0, 0, w, h);
    g.fillStyle = shade(color, 0.55);
    g.fillRect(0, 0, w, 10);
    g.fillRect(0, h - 10, w, 10);
    g.font = 'bold 12px monospace';
    g.fillStyle = '#c8ccd8';
    g.fillText('1 PLAYER', 14, 30);
    g.fillText('JUMP   CROAK   TONGUE', 100, 30);
    g.fillStyle = 'rgba(255,255,255,0.1)';
    g.beginPath();
    g.arc(52, 74, 30, 0, Math.PI * 2);
    g.fill();
    const r = rng(color + 9);
    for (let k = 0; k < 200; k++) {
      g.fillStyle = `rgba(255,255,255,${r() * 0.06})`;
      g.fillRect(r() * w, r() * h, 2, 1);
    }
  });
}

/** The coin door: a steel plate, two coin slots lit red, the price, the lock. */
export function coinDoorTex(): THREE.CanvasTexture {
  return paint('coinDoor', 256, 128, (g, w, h) => {
    brushed(g, w, h, '#4a4e56', '#9aa0aa', '#1a1c20', 51);
    for (const x of [70, 186]) {
      g.fillStyle = '#1a0406';
      g.fillRect(x - 22, 24, 44, 50);
      g.fillStyle = '#d82a2a';
      g.fillRect(x - 14, 34, 28, 30);
      g.fillStyle = '#ff8a7a';
      g.fillRect(x - 3, 38, 6, 22);
      g.fillStyle = '#f4f0e0';
      g.font = 'bold 18px monospace';
      g.textAlign = 'center';
      g.fillText('25¢', x, 98);
    }
    g.fillStyle = '#c8ccd4';
    g.beginPath();
    g.arc(w / 2, 50, 8, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#101010';
    g.fillRect(w / 2 - 1.5, 44, 3, 12);
  });
}

/**
 * A MATCAP: a lit sphere, painted once, that a MeshMatcapMaterial wraps round
 * whatever it is on by the way each bit of surface faces the camera.  It is
 * shading that carries itself -- a soft key from the upper left, a mid, a
 * shadowed rim with a little warmth in it -- so a thing held half a metre from
 * a torch keeps its roundness instead of going to a white slab.
 */
export function matcapTex(light: number, mid: number, dark: number, rim = dark): THREE.CanvasTexture {
  return paint(`matcap:${light}:${mid}:${dark}:${rim}`, 256, 256, (g, w) => {
    const r = w / 2;
    g.fillStyle = hex(dark);
    g.fillRect(0, 0, w, w);
    const body = g.createRadialGradient(r * 0.78, r * 0.7, r * 0.05, r, r, r);
    body.addColorStop(0, hex(light));
    body.addColorStop(0.45, hex(mid));
    body.addColorStop(0.86, hex(dark));
    body.addColorStop(1, hex(rim));
    g.fillStyle = body;
    g.beginPath();
    g.arc(r, r, r, 0, Math.PI * 2);
    g.fill();
    // a soft sheen, the way skin and cotton both take a little of the light
    const sheen = g.createRadialGradient(r * 0.66, r * 0.56, 0, r * 0.66, r * 0.56, r * 0.42);
    sheen.addColorStop(0, 'rgba(255,248,240,0.32)');
    sheen.addColorStop(1, 'rgba(255,248,240,0)');
    g.fillStyle = sheen;
    g.fillRect(0, 0, w, w);
  });
}
