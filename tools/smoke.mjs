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
/**
 * The persisted run for the active profile.  Reading storage rather than the
 * live store keeps this an assertion about what actually got saved.
 */
const readState = () =>
  page.evaluate(() => {
    try {
      const index = JSON.parse(localStorage.getItem('froggy.slots') || 'null');
      if (!index || !index.active) return {};
      return JSON.parse(localStorage.getItem(`froggy.run.${index.active}`) || '{}');
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

  // With no profile the picker opens on its own — there is nowhere to save a
  // run until one exists, so this is the real first-run path.
  console.log('2. profile picker -> create one');
  await shot('02a-profile-picker');
  await click(640 + (237 - 160) * 4, 360 + (66 - 90) * 4); // NEW on the first row
  await sleep(500);
  for (const ch of 'SMOKE') {
    await page.keyboard.press(`Key${ch}`);
    await sleep(90);
  }
  await shot('02b-profile-naming');
  await page.keyboard.press('Enter');
  await sleep(900);

  console.log('2. start screen');
  await shot('02-start-screen');

  console.log('3. settings modal (audio + controls)');
  await click(640, 360 + (148 - 90) * 4); // SETTINGS button
  await sleep(600);
  await shot('03-settings-audio');
  await click(640 + (176 - 160) * 4, 360 + (34 - 90) * 4); // CONTROLS tab
  await sleep(400);
  await shot('04-settings-controls');
  await page.keyboard.press('Escape');
  await sleep(500);

  console.log('4. START -> intro cutscene');
  await click(640, 360 + (112 - 90) * 4); // START
  await sleep(2600);
  await shot('05-intro-walk');
  await page.keyboard.press('Escape'); // skip
  await sleep(2200);

  // The intro now puts you out on the street with the man, not inside: the
  // arcade is somewhere you choose to walk into.  You land at the doors.
  console.log('4b. street -> in through the doors');
  await shot('05b-street-daytime');
  await page.keyboard.press('KeyE');
  await sleep(2200);

  console.log('5. arcade hub + tutorial');
  await shot('06-hub-tutorial-line1');

  // Click through the tutorial until the game itself says it is done.
  // Blind click counts screenshot the wrong frame.
  let clicks = 0;
  let midShot = false;
  while (clicks < 60) {
    const st = await readState();
    if (st.seenIntro) break;
    // A frame from the middle of the tutorial.  This used to hunt for the
    // frozen foreshadowing line by watching for the overlay to stop moving;
    // that line has been cut, so there is nothing to wait for.
    if (!midShot && clicks > 8) {
      await shot('07-hub-tutorial-mid');
      midShot = true;
    }
    await click(640, 200);
    await sleep(320);
    clicks++;
  }
  if (!midShot) await shot('07-hub-tutorial-mid');
  console.log(`   tutorial done after ${clicks} clicks`);
  await sleep(900);
  await shot('08-hub-free-roam');

  const overlayAfter = await overlayPixels();
  // Report who is on screen with it: a non-zero overlay here has been a race,
  // and knowing which scene is painting is the whole diagnosis.
  console.log(
    `   overlay opaque pixels after tutorial: ${overlayAfter}` +
      (overlayAfter ? ` (scenes: ${(await page.evaluate(() => window.__froggy.activeScenes())).join(',')})` : ''),
  );

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
  // Read the economy off the cabinet the walk actually reached, rather than
  // hardcoding it — cabinets get retuned, and the test should follow.
  const def = await page.evaluate(async () => {
    if (!window.__minigame) return null;
    const { cabinetById } = await import('/src/game/content.ts');
    const d = cabinetById(window.__minigame.id);
    return { id: d.id, cost: d.cost, reward: d.reward };
  });
  console.log(`   launched ${def?.id} (cost ${def?.cost}, reward ${def?.reward})`);
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
  const def2 = await page.evaluate(async () => {
    if (!window.__minigame) return null;
    const { cabinetById } = await import('/src/game/content.ts');
    const d = cabinetById(window.__minigame.id);
    return { id: d.id, cost: d.cost };
  });
  await shot('12-second-launch');
  await page.keyboard.press('Escape');
  await sleep(3600);
  const forfeited = await readState();
  console.log(`   forfeit: ${won.tokens} -> ${paid.tokens} -> ${forfeited.tokens}`);

  console.log('\nState checks:');
  const checks = [
    ['seed credited 20 tokens', before.tokens === 20],
    ['cost debited on launch', !!def && after.tokens === before.tokens - def.cost],
    ['reward credited on win', !!def && won.tokens === after.tokens + def.reward],
    ['seenIntro latched', won.seenIntro === true],
    ['route still normal', won.route === 'normal'],
    ['overlay cleared when Froggy leaves', overlayAfter === 0],
    ['Esc forfeits the entry cost', !!def2 && paid.tokens === won.tokens - def2.cost && forfeited.tokens === paid.tokens],
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
