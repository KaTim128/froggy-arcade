/**
 * The ending.  PRD §7.16 / AC-9.
 *
 *   node tools/outro.mjs [--shots dir] [--url http://localhost:5173]
 *
 * The outro is the last thing anyone sees, and it was the only sequence with no
 * coverage.  Four things have to hold: the camera never moves, Froggy actually
 * appears in the doorway, he is recognisably Froggy (both eyes, symmetric — a
 * half-drawn sprite reads as a generic monster), and the scene hands off to the
 * end card instead of hanging on the hold.
 */

import puppeteer from 'puppeteer-core';
import { mkdirSync, existsSync } from 'node:fs';
import { argv } from 'node:process';

const arg = (name, dflt) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};

const URL = arg('--url', 'http://localhost:5173');
const SHOTS = arg('--shots', 'tools/shots/outro');

const CHROME_CANDIDATES = [
  // CI and container images keep Chrome somewhere else entirely; CHROME_PATH
  // wins, and the pinned path is what this repo's dev container ships.
  process.env.CHROME_PATH ?? '',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/chromium',
];
const executablePath = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!executablePath) {
  console.error('No Chrome/Edge found.');
  process.exit(2);
}

mkdirSync(SHOTS, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
let failed = 0;
const check = (name, ok, note = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${note ? `  — ${note}` : ''}`);
  if (!ok) failed++;
};

const browser = await puppeteer.launch({
  executablePath,
  headless: 'new',
  args: [
    '--no-sandbox',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--autoplay-policy=no-user-gesture-required',
    '--window-size=1280,720',
  ],
});

const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
page.on('console', (m) => {
  const t = m.text();
  if (m.type() === 'error' && !/favicon|vite\.svg/i.test(t)) errors.push(`console.error: ${t}`);
});
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

const state = () => page.evaluate(() => window.__froggy.state());
const active = () => page.evaluate(() => window.__froggy.activeScenes());

/**
 * Sample a region of what is actually on screen.
 *
 * The three.js stage renders without preserveDrawingBuffer, so drawImage() on
 * its canvas comes back blank.  Going through a real screenshot uses the
 * compositor, which sees the composed frame the player sees.
 */
const sample = async (x, y, w, h) => {
  const b64 = await page.screenshot({ encoding: 'base64' });
  return page.evaluate(
    async (b64, x, y, w, h) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const tmp = document.createElement('canvas');
      tmp.width = w;
      tmp.height = h;
      const ctx = tmp.getContext('2d');
      ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
      return [...ctx.getImageData(0, 0, w, h).data];
    },
    b64,
    x,
    y,
    w,
    h,
  );
};

const luma = (px) => {
  const out = [];
  for (let i = 0; i < px.length; i += 4) out.push(0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]);
  return out;
};

try {
  console.log('AC-9  the ending');
  await page.goto(`${URL}/?intro=1&charity=1&key=1&route=ended&scene=OutroCutscene3D`, {
    waitUntil: 'networkidle2',
    timeout: 30000,
  });
  await sleep(1600);

  check('outro is running', (await active()).includes('OutroCutscene3D'), (await active()).join(','));

  await page.screenshot({ path: `${SHOTS}/01-empty-doorway.png` });

  // --- he steps into the doorway at t=1.5s, fully opaque by t=2.0s
  await sleep(1400);
  await page.screenshot({ path: `${SHOTS}/02-froggy-watching.png` });

  const W = 180;
  const H = 220;
  const region = await sample(560, 230, W, H);
  const doorwayAfter = luma(region);

  // --- is that actually Froggy?  "Something is brighter" would also pass for a
  // grey box, so look for the one colour only he has here: the jaundiced belly.
  let belly = 0;
  for (let i = 0; i < region.length; i += 4) {
    const [r, g, b] = [region[i], region[i + 1], region[i + 2]];
    if (r > 90 && g > 80 && b < g * 0.72 && Math.abs(r - g) < 60) belly++;
  }
  check('Froggy is in the doorway, belly and all', belly > 400, `${belly} belly px`);
  let diff = 0;
  let n = 0;
  for (let row = 0; row < H; row++) {
    for (let col = 0; col < W / 2; col++) {
      const l = doorwayAfter[row * W + col];
      const r = doorwayAfter[row * W + (W - 1 - col)];
      if (l > 24 || r > 24) {
        diff += Math.abs(l - r);
        n++;
      }
    }
  }
  // He is drawn symmetric, so he must render symmetric.  This is the check that
  // catches him being depth-clipped by the facade: losing one eye and one arm
  // pushed this to 27.6.  Fog and the streetlight fall off left to right, so
  // there is always some genuine asymmetry — hence 20 rather than something
  // tighter.
  const meanDiff = n ? diff / n : 999;
  check('he is symmetric — both eyes, not half a face', meanDiff < 20, `mean L/R delta ${meanDiff.toFixed(1)}`);

  // --- the camera is LOCKED (PRD §7.16).  The streetlight pole is a fixed,
  // high-contrast vertical: if the camera moved, its column moves with it.
  const poleColumn = async () => {
    const strip = luma(await sample(120, 300, 220, 4));
    let best = -1;
    let bestV = -1;
    for (let i = 0; i < 220; i++) {
      const v = strip[i] + strip[220 + i] + strip[440 + i] + strip[660 + i];
      if (v > bestV) {
        bestV = v;
        best = i;
      }
    }
    return best;
  };
  const pole1 = await poleColumn();
  await sleep(1800);
  const pole2 = await poleColumn();
  await page.screenshot({ path: `${SHOTS}/03-runner-gone.png` });
  check('the camera never moves', Math.abs(pole1 - pole2) <= 1, `pole col ${pole1} -> ${pole2}`);

  // --- he watches, then it ends.  Runner clears frame ~4.3s, +3s hold, +1.4s fade.
  let ended = false;
  for (let i = 0; i < 40; i++) {
    if ((await active()).includes('EndCard')) {
      ended = true;
      break;
    }
    await sleep(500);
  }
  await sleep(900);
  await page.screenshot({ path: `${SHOTS}/04-end-card.png` });

  check('the hold resolves to the end card', ended, (await active()).join(','));
  check('route committed to ended', (await state()).route === 'ended', `route=${(await state()).route}`);

  if (errors.length) {
    console.log('\nRuntime errors:');
    for (const e of errors) console.log('  ' + e);
  } else {
    console.log('\nRuntime errors: none');
  }

  const total = 6;
  console.log(`\n${total - failed}/${total} checks passed.`);
  await browser.close();
  process.exit(failed > 0 || errors.length > 0 ? 1 : 0);
} catch (e) {
  console.error('OUTRO FAILED:', e.message);
  for (const err of errors) console.error('  ' + err);
  await browser.close();
  process.exit(1);
}
