/**
 * Profiles / save slots.
 *
 *   node tools/profiles.mjs [--url http://localhost:5173]
 *
 * The arcade used to keep one anonymous save, so a run that had committed its
 * route left you stuck there with no way to start over.  Three things matter:
 * a run belongs to exactly one profile, profiles cannot bleed into each other,
 * and the single old save is adopted rather than orphaned.
 */

import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';
import { argv } from 'node:process';

const arg = (n, d) => {
  const i = argv.indexOf(n);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const URL = arg('--url', 'http://localhost:5173');

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].find((p) => existsSync(p));
if (!CHROME) {
  console.error('No Chrome/Edge found.');
  process.exit(2);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
let failed = 0;
const check = (name, ok, note = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${note ? `  — ${note}` : ''}`);
  if (!ok) failed++;
};

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
page.on('console', (m) => {
  const t = m.text();
  if (m.type() === 'error' && !/favicon|vite\.svg/i.test(t)) errors.push(`console.error: ${t}`);
});
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

// Game pixels -> screen pixels at zoom 4, origin centred on a 1280x720 canvas.
const gx = (x) => 640 + (x - 160) * 4;
const gy = (y) => 360 + (y - 90) * 4;
const click = async (x, y) => {
  await page.mouse.click(gx(x), gy(y));
  await sleep(450);
};
const scenes = () => page.evaluate(() => window.__froggy.activeScenes());
const index = () => page.evaluate(() => JSON.parse(localStorage.getItem('froggy.slots') || 'null'));
const keys = () => page.evaluate(() => Object.keys(localStorage).sort());
const type = async (s) => {
  for (const ch of s) {
    // Chrome wants the physical key name: KeyA, never Keya.
    const key = ch === ' ' ? 'Space' : /[0-9]/.test(ch) ? `Digit${ch}` : `Key${ch.toUpperCase()}`;
    await page.keyboard.press(key);
    await sleep(80);
  }
};

const bootFresh = async () => {
  await page.goto(URL, { waitUntil: 'networkidle2' });
  await page.evaluate(() => localStorage.clear());
  await page.goto(URL, { waitUntil: 'networkidle2' });
  await sleep(1400);
  await page.mouse.click(640, 360); // click-to-begin gate
  await sleep(1600);
};

const newProfile = async (row, name) => {
  await click(237, [66, 96, 126][row]); // NEW
  await sleep(300);
  await type(name);
  await page.keyboard.press('Enter');
  await sleep(900);
};

try {
  // ------------------------------------------------- there must be a profile
  console.log('\nprofiles  a run needs somewhere to live');
  await bootFresh();
  check('the picker opens itself when there is no profile', (await scenes()).includes('ProfileModal'));

  await newProfile(0, 'KAI');
  const i1 = await index();
  check('creating a profile makes it active', i1?.slots?.length === 1 && i1.active === i1.slots[0].id,
    i1?.slots?.[0]?.name);
  check('its run is stored under its own key', (await keys()).includes(`froggy.run.${i1.slots[0].id}`),
    (await keys()).join(' '));
  check('settings stay device-wide, outside the profile', (await keys()).includes('froggy.prefs'));

  // ------------------------------------------------------ profiles stay apart
  console.log('\nprofiles  two runs cannot bleed into each other');
  // Give KAI some progress, then make a second profile and check it starts clean.
  await page.evaluate(() => window.__froggy.setTokens(42));
  await page.evaluate(() => window.__froggy.state());
  await sleep(500);

  await click(160, 130); // PROFILES
  await sleep(700);
  await newProfile(1, 'SAM');

  const samTokens = await page.evaluate(() => window.__froggy.state().tokens);
  check('a new profile starts from zero', samTokens === 0, `${samTokens} tokens`);

  // Switch back to KAI; the 42 has to still be there.
  await click(160, 130);
  await sleep(700);
  await click(216, 66); // PLAY on row 1 (KAI)
  await sleep(900);
  const kaiTokens = await page.evaluate(() => window.__froggy.state().tokens);
  check('switching back restores that profile\'s run', kaiTokens === 42, `${kaiTokens} tokens`);

  // ------------------------------------------------------------ deleting one
  console.log('\nprofiles  deleting asks first, and takes only its own data');
  await click(160, 130);
  await sleep(700);
  await click(258, 96); // DEL on SAM
  const armed = await page.evaluate(() => {
    const s = window.__froggy.game().scene.getScene('ProfileModal');
    let found = false;
    const visit = (o) => {
      if (o.type === 'Container') return o.list.forEach(visit);
      if (o.type === 'BitmapText' && o.text === 'SURE?') found = true;
    };
    s.children.list.forEach(visit);
    return found;
  });
  check('one click only arms the delete', armed);

  const before = await index();
  const samId = before.slots.find((s) => s.name === 'SAM').id;
  await click(258, 96); // confirm
  await sleep(500);
  const after = await index();
  check('the second click deletes it', after.slots.length === 1 && after.slots[0].name === 'KAI',
    after.slots.map((s) => s.name).join(','));
  check('its save is gone with it', !(await keys()).includes(`froggy.run.${samId}`));
  check('the surviving profile keeps its run',
    (await page.evaluate(() => window.__froggy.state().tokens)) === 42);

  // ------------------------------------------------------- the unlimited run
  console.log('\nprofiles  a run named admin128 never runs out');

  /** Play the dearest cabinet on the floor, through the room's own launch. */
  const playTheDearestCabinet = () =>
    page.evaluate(async () => {
      const hub = window.__froggy.game().scene.getScene('ArcadeHub');
      const d = hub.dialogue;
      for (let i = 0; i < 40 && d && d.state !== 'idle'; i++) {
        d.advance();
        await new Promise((r) => setTimeout(r, 40));
      }
      const cab = hub.cabinets.reduce((a, b) => (b.def.cost > a.def.cost ? b : a));
      const before = window.__froggy.state().tokens;
      hub.launchGame(cab); // canEnter + ledger.debit, exactly as a click does
      await new Promise((r) => setTimeout(r, 1500));
      return {
        cost: cab.def.cost,
        before,
        after: window.__froggy.state().tokens,
        launched: window.__froggy.activeScenes().includes('Minigame'),
      };
    });

  // Typed in lower case, on a real keyboard: names are uppercased on the way
  // in, so this is the same name.  Spacing is not — see the near-miss below.
  await bootFresh();
  await newProfile(0, 'admin128');
  const admin = await index();
  const adminTokens = await page.evaluate(() => window.__froggy.state().tokens);
  check('the name is matched whatever the capitalisation', admin?.slots?.[0]?.name === 'ADMIN128',
    admin?.slots?.[0]?.name);
  check('it starts full without waiting for the intro', adminTokens === 9999, `${adminTokens} tokens`);

  await page.goto(`${URL}?scene=ArcadeHub`, { waitUntil: 'networkidle2' });
  await sleep(2400);
  const adminPlay = await playTheDearestCabinet();
  check('the priciest cabinet in the building opens for it', adminPlay.launched,
    `${adminPlay.cost} tokens a go`);
  check('and playing it costs nothing', adminPlay.before === 9999 && adminPlay.after === 9999,
    `${adminPlay.before} -> ${adminPlay.after}`);

  // The edge of the door.  A name that merely looks like it is an ordinary run,
  // so nobody unlocks this by typing something close.
  await bootFresh();
  await newProfile(0, 'admin 128');
  const near = await index();
  const nearTokens = await page.evaluate(() => window.__froggy.state().tokens);
  check('a name that only looks like it does nothing',
    near?.slots?.[0]?.name === 'ADMIN 128' && nearTokens === 0,
    `${near?.slots?.[0]?.name} with ${nearTokens}`);

  // And an ordinary run still pays for everything, down the same path.
  await bootFresh();
  await newProfile(0, 'PLAYER TWO');
  await page.goto(`${URL}?scene=ArcadeHub&tokens=40`, { waitUntil: 'networkidle2' });
  await sleep(2400);
  const normalPlay = await playTheDearestCabinet();
  check('an ordinary run still pays its way',
    normalPlay.launched && normalPlay.after === normalPlay.before - normalPlay.cost,
    `${normalPlay.before} -> ${normalPlay.after} for ${normalPlay.cost}`);

  // --------------------------------------------------- the pre-profile save
  console.log('\nprofiles  the old single save is adopted, not orphaned');
  await page.goto(URL, { waitUntil: 'networkidle2' });
  await page.evaluate(() => {
    localStorage.clear();
    // Exactly what the game wrote before profiles existed.
    localStorage.setItem('froggy.run', JSON.stringify({
      schemaVersion: 1, tokens: 17, charityUsed: false, prizesOwned: [],
      gamesPlayed: { tictactoe: 2, snakes: 0, airhockey: 0, hoops: 0, whack: 0, chompman: 0, grudge: 0 },
      route: 'normal', hasKey: false, seenIntro: true,
    }));
  });
  await page.goto(URL, { waitUntil: 'networkidle2' });
  await sleep(1600);

  const migrated = await index();
  check('the legacy run becomes a profile', migrated?.slots?.length === 1, migrated?.slots?.[0]?.name);
  const tokens = await page.evaluate(() => window.__froggy.state().tokens);
  check('its progress survives the move', tokens === 17, `${tokens} tokens`);
  check('the old key is cleared', !(await keys()).includes('froggy.run'), (await keys()).join(' '));

  if (errors.length) {
    console.log('\nRuntime errors:');
    for (const e of errors) console.log('  ' + e);
  } else {
    console.log('\nRuntime errors: none');
  }

  const total = 19;
  console.log(`\n${total - failed}/${total} checks passed.`);
  await browser.close();
  process.exit(failed > 0 || errors.length > 0 ? 1 : 0);
} catch (e) {
  console.error('PROFILES FAILED:', e.message);
  for (const err of errors) console.error('  ' + err);
  await browser.close();
  process.exit(1);
}
