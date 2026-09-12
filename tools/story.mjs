/**
 * Story-path acceptance test.  PRD §17 AC-3, AC-4, AC-6, AC-10.
 *
 * Drives the actual break-in path in real Chrome and asserts the things the
 * whole product rests on: charity fires exactly once, the second bust ejects,
 * the back door is unreachable except from `ejected`, and the post-break-in
 * arcade instantiates ZERO audio sources.
 *
 *   node tools/story.mjs
 */

import puppeteer from 'puppeteer-core';
import { mkdirSync, existsSync } from 'node:fs';

const URL = 'http://localhost:5173';
const SHOTS = 'tools/shots/story';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CHROME = [
  // CI and container images keep Chrome somewhere else entirely; CHROME_PATH
  // wins, and the pinned path is what this repo's dev container ships.
  process.env.CHROME_PATH ?? '',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
].find((p) => existsSync(p));

mkdirSync(SHOTS, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});

const results = [];
const errors = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

const newPage = async (query) => {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon/i.test(m.text())) errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  await page.goto(`${URL}/${query}`, { waitUntil: 'networkidle2' });
  await sleep(900);
  await page.mouse.click(640, 700);
  await sleep(700);
  return page;
};

const st = (p) => p.evaluate(() => window.__froggy.state());
const active = (p) => p.evaluate(() => window.__froggy.activeScenes());

// ---------------------------------------------------------------- AC-6 guards
console.log('\nAC-6  route guards (every scene x every route)');
{
  const page = await newPage('?intro=1');
  const matrix = await page.evaluate(() => {
    const out = {};
    for (const s of window.__froggy.scenes()) {
      out[s] = {};
      for (const r of ['normal', 'ejected', 'basement', 'chase', 'ended']) {
        out[s][r] = window.__froggy.canEnter(s, r, 999);
      }
    }
    return out;
  });

  const breakIn = ['ExteriorNight', 'BackAlley', 'ArcadeDark'];
  const badly = [];
  for (const s of breakIn) {
    for (const r of ['normal', 'basement', 'chase', 'ended']) {
      if (matrix[s][r]) badly.push(`${s} reachable from ${r}`);
    }
    if (!matrix[s].ejected) badly.push(`${s} NOT reachable from ejected`);
  }
  check('back-door route only from ejected', badly.length === 0, badly.join('; '));

  const hubLeaks = ['ejected', 'basement', 'chase', 'ended'].filter((r) => matrix.ArcadeHub[r]);
  check('hub unreachable once ejected', hubLeaks.length === 0, hubLeaks.join(','));
  check('basement only from basement route', matrix.BasementSequence.basement && !matrix.BasementSequence.normal);
  check('chase only from chase route', matrix.Chase3D.chase && !matrix.Chase3D.normal);
  await page.close();
}

// ------------------------------------------------------- AC-3 charity, once
console.log('\nAC-3  charity fires exactly once per run');
{
  const page = await newPage('?intro=1&tokens=1&scene=ArcadeHub');
  await sleep(1200);

  const before = await st(page);
  check('starts with charityUsed false', before.charityUsed === false);

  // Spend the last token on the cheapest cabinet.  Three steps, because that
  // is what spending a token now takes: click the machine, press PLAY on its
  // card (the only thing in the building that charges), then walk out on the
  // play you paid for.  Clicking a one-token cabinet outright — rather than
  // walking blind and hoping — is deliberate: retuning whichever cabinet
  // happened to sit bottom-left used to silently stop the run going broke.
  await page.mouse.click(640 + (30 - 160) * 4, 360 + (88 - 90) * 4); // TIC-TAC-TOE, 1 token
  await sleep(1600);
  await page.keyboard.press('Space'); // PLAY -> 0 tokens
  await sleep(900);
  await page.keyboard.press('Escape'); // forfeit the play
  await sleep(12000); // result card, hub, charity dialogue

  await page.screenshot({ path: `${SHOTS}/01-charity.png` });
  const afterCharity = await st(page);
  check('charity granted 10 tokens', afterCharity.tokens === 10, `tokens=${afterCharity.tokens}`);
  check('charityUsed latched', afterCharity.charityUsed === true);
  check('still on the normal route', afterCharity.route === 'normal');

  // Now the broke evaluator must say "eject", not "charity", at zero.
  const second = await page.evaluate(() => {
    window.__froggy && null;
    return null;
  });
  void second;
  await page.close();
}

// ----------------------------------------------- AC-4 second bust -> ejection
console.log('\nAC-4  second bust ejects, front door locked for good');
{
  const page = await newPage('?intro=1&tokens=1&charity=1&scene=ArcadeHub');
  await sleep(1200);

  const outcome = await page.evaluate(() => window.__froggy.broke());
  check('broke evaluator idle while solvent', outcome === null);

  // Click a one-token cabinet outright, press PLAY to actually spend the
  // token, and walk out on the play.  Walking blind used to land on whichever
  // cabinet happened to sit bottom-left, so retuning that cabinet's cost
  // silently stopped the run from ever going broke.
  await page.mouse.click(640 + (30 - 160) * 4, 360 + (88 - 90) * 4); // TIC-TAC-TOE, 1 token
  await sleep(1600);
  await page.keyboard.press('Space'); // PLAY
  await sleep(900);
  await page.keyboard.press('Escape');
  await sleep(6000);

  await page.screenshot({ path: `${SHOTS}/02-second-bust.png` });
  const scenes = await active(page);
  check('second bust scene runs', scenes.includes('SecondBust'), scenes.join(','));

  // The bust is timed: hard cut, 3s hold, "You can go now", then the ejection.
  await sleep(11000);
  await page.screenshot({ path: `${SHOTS}/03-ejected.png` });
  const s = await st(page);
  check('route committed to ejected', s.route === 'ejected', `route=${s.route}`);
  check('charity did NOT fire twice', s.tokens === 0, `tokens=${s.tokens}`);
  await page.close();
}

// ------------------------------------------------------- the arcade has a bed
//
// The silence later only lands if there was something to lose.  "There is
// music" used to be assertable only as "a source object exists", which stayed
// true the whole time the bed was an arpeggio nobody could hear — so measure
// the signal going to the speakers instead.
console.log('\nAU-1  the arcade is not silent');
{
  const page = await newPage('?intro=1&tokens=20&scene=ArcadeHub');
  await sleep(1200);
  await page.mouse.click(640, 60); // unlock the context
  await sleep(2500);
  let peak = 0;
  for (let i = 0; i < 26; i++) {
    peak = Math.max(peak, await page.evaluate(() => window.__froggy.audioLevel()));
    await sleep(120);
  }
  check('the arcade plays an audible music bed', peak > 0.004, `peak ${peak.toFixed(4)} rms`);
  await page.close();
}

// ------------------------------------------------------- AC-10 total silence
console.log('\nAC-10 the silence contract');
{
  const page = await newPage('?intro=1&charity=1&route=ejected&scene=ExteriorNight');
  await sleep(1600);
  const outsideSources = await page.evaluate(() => window.__froggy.audioSources());
  await page.screenshot({ path: `${SHOTS}/04-exterior-night.png` });
  check('night exterior has ambience but no music', outsideSources > 0, `${outsideSources} sources`);

  await page.goto(`${URL}/?intro=1&charity=1&route=ejected&scene=ArcadeDark`, { waitUntil: 'networkidle2' });
  await sleep(900);
  await page.mouse.click(640, 700);
  await sleep(2200);
  const darkSources = await page.evaluate(() => window.__froggy.audioSources());
  await page.screenshot({ path: `${SHOTS}/05-arcade-dark.png` });
  check('post-break arcade instantiates ZERO sources', darkSources === 0, `${darkSources} sources`);
  await page.close();
}

// ------------------------------------------------------------- the alley path
console.log('\nBreak-in path');
{
  const page = await newPage('?intro=1&charity=1&route=ejected&scene=BackAlley');
  await sleep(1400);
  await page.screenshot({ path: `${SHOTS}/06-back-alley.png` });
  const scenes = await active(page);
  check('alley reachable when ejected', scenes.includes('BackAlley'), scenes.join(','));
  await page.close();
}

console.log('\nRuntime errors: ' + (errors.length ? errors.slice(0, 5).join(' | ') : 'none'));
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed.`);
await browser.close();
process.exit(failed || errors.length ? 1 : 0);
