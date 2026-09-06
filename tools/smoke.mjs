/**
 * Runtime smoke test.  Drives the real game in real Chrome and screenshots it.
 *
 *   node tools/smoke.mjs [--shots dir] [--url http://localhost:5173]
 *
 * Fails loudly on any console error or page exception, which is the point:
 * a typecheck cannot tell you that a Phaser scene threw on create().
 */

import puppeteer from 'puppeteer-core';
import { mkdirSync, existsSync } from 'node:fs';
import { argv } from 'node:process';

const arg = (name, dflt) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};

const URL = arg('--url', 'http://localhost:5173');
const SHOTS = arg('--shots', 'tools/shots');

const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];
const executablePath = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!executablePath) {
  console.error('No Chrome/Edge found.');
  process.exit(2);
}

mkdirSync(SHOTS, { recursive: true });

const errors = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
page.on('response', (r) => {
  if (r.status() >= 400 && !/favicon/i.test(r.url())) errors.push(`http ${r.status()}: ${r.url()}`);
});

const shot = async (name) => {
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
  console.log(`  shot: ${SHOTS}/${name}.png`);
};

/** Read game state out of the running page. */
const readState = () =>
  page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem('froggy.run') || '{}');
    } catch {
      return {};
    }
  });

/** Count non-transparent pixels on Froggy's overlay canvas. */
const overlayPixels = () =>
  page.evaluate(() => {
    const c = document.getElementById('froggy-layer');
    if (!c) return -1;
    const ctx = c.getContext('2d');
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
    return n;
  });

/** True if the overlay changed between two samples ~150ms apart. */
const overlayMoved = async () => {
  const a = await overlayPixels();
  await sleep(160);
  const b = await overlayPixels();
  return a !== b;
};

const click = async (x, y) => {
  await page.mouse.click(x, y);
  await sleep(120);
};

try {
  console.log(`Loading ${URL}`);
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(1400); // boot bar

  console.log('1. boot / click gate');
  await shot('01-boot');
  await click(640, 360); // unlock audio + advance
  await sleep(1200);

  console.log('2. start screen');
  await shot('02-start-screen');

  console.log('3. settings modal (audio + controls)');
  await click(640, 360 + (138 - 90) * 4); // SETTINGS button
  await sleep(600);
  await shot('03-settings-audio');
  await click(640 + (176 - 160) * 4, 360 + (44 - 90) * 4); // CONTROLS tab
  await sleep(400);
  await shot('04-settings-controls');
  await page.keyboard.press('Escape');
  await sleep(500);

  console.log('4. START -> intro cutscene');
  await click(640, 360 + (118 - 90) * 4);
  await sleep(2600);
  await shot('05-intro-walk');
  await page.keyboard.press('Escape'); // skip
  await sleep(1600);

  console.log('5. arcade hub + tutorial');
  await shot('06-hub-tutorial-line1');

  // Click through the tutorial until the game itself says it is done.
  // Blind click counts screenshot the wrong frame.
  let clicks = 0;
  let sawFreeze = false;
  while (clicks < 60) {
    const st = await readState();
    if (st.seenIntro) break;
    // Line 6 is the frozen one: grab it the moment the overlay stops moving.
    if (!sawFreeze && clicks > 8) {
      const moved = await overlayMoved();
      if (!moved) {
        await shot('07-hub-tutorial-line6-freeze');
        sawFreeze = true;
      }
    }
    await click(640, 200);
    await sleep(320);
    clicks++;
  }
  if (!sawFreeze) await shot('07-hub-tutorial-line6-freeze');
  console.log(`   tutorial done after ${clicks} clicks`);
  await sleep(900);
  await shot('08-hub-free-roam');

  const overlayAfter = await overlayPixels();
  console.log(`   overlay opaque pixels after tutorial: ${overlayAfter}`);

  console.log('6. walk to a cabinet');
  await page.keyboard.down('KeyA');
  await sleep(2600);
  await page.keyboard.up('KeyA');
  await page.keyboard.down('KeyS');
  await sleep(900);
  await page.keyboard.up('KeyS');
  await sleep(300);
  await shot('09-hub-cabinet-prompt');

  const before = await readState();
  console.log(`   tokens before: ${before.tokens}`);
  await page.keyboard.press('KeyE');
  await sleep(1200);
  await shot('10-minigame-placeholder');
  const after = await readState();
  console.log(`   tokens after launch: ${after.tokens}`);

  // The cabinet now holds a real game, so the reward path is driven through
  // the debug hook (PRD §6.9 force-win) rather than by beating Tic-Tac-Toe.
  const hooked = await page.evaluate(() => {
    if (!window.__minigame) return false;
    window.__minigame.win();
    return true;
  });
  await sleep(1400);
  await shot('11-minigame-win');
  const won = await readState();
  console.log(`   debug force-win available: ${hooked}`);
  console.log(`   tokens after win: ${won.tokens}`);

  // And the forfeit path: cost debited, nothing credited back.  The hub puts
  // you back at the door, so walk to a cabinet again first.
  await sleep(4200); // result card (2s) + both fades
  await page.keyboard.down('KeyA');
  await sleep(2600);
  await page.keyboard.up('KeyA');
  await page.keyboard.down('KeyS');
  await sleep(900);
  await page.keyboard.up('KeyS');
  await page.keyboard.press('KeyE');
  await sleep(2200);
  const paid = await readState();
  await shot('12-second-launch');
  await page.keyboard.press('Escape');
  await sleep(3600);
  const forfeited = await readState();
  console.log(`   forfeit: ${won.tokens} -> ${paid.tokens} -> ${forfeited.tokens}`);

  console.log('\nState checks:');
  const checks = [
    ['seed credited 20 tokens', before.tokens === 20],
    ['cost debited on launch', after.tokens === before.tokens - 1],
    ['reward credited on win', won.tokens === after.tokens + 3],
    ['seenIntro latched', won.seenIntro === true],
    ['route still normal', won.route === 'normal'],
    ['overlay cleared when Froggy leaves', overlayAfter === 0],
    ['Esc forfeits the entry cost', paid.tokens === won.tokens - 1 && forfeited.tokens === paid.tokens],
  ];
  let failed = 0;
  for (const [name, ok] of checks) {
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`);
    if (!ok) failed++;
  }

  if (errors.length) {
    console.log('\nRuntime errors:');
    for (const e of errors) console.log('  ' + e);
  } else {
    console.log('\nNo console errors, no page exceptions.');
  }

  await browser.close();
  process.exit(failed > 0 || errors.length > 0 ? 1 : 0);
} catch (e) {
  console.error('SMOKE FAILED:', e.message);
  for (const err of errors) console.error('  ' + err);
  try {
    await shot('99-failure');
  } catch {
    /* ignore */
  }
  await browser.close();
  process.exit(1);
}
