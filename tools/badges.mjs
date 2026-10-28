/**
 * Badges and achievements (log #42, #49, #58, #59, #60, #64, #83).
 *
 *   - every badge has a picture of its own, and the kinds are all there
 *   - a badge is earned once: the second time is refused, and says nothing
 *   - BADGE UNLOCKED comes down for each, one after the other
 *   - earned badges survive a reload
 *   - the record-shaped mastery lines: just short earns nothing, on the line earns it
 *   - Frog Cross: the road badges at 5 crossings, in a real go -- and a practice
 *     go earns nothing
 *   - ERROR FROG-04: seeing him in Whack-a-Frog
 *   - the badge screen: secrets are ??? until found, and it scrolls
 *   - the goals card: no THIS WEEK, the achievements scroll, CLAIM only when done
 *
 *   node tools/badges.mjs
 */

import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';

const URL = 'http://localhost:5173';
const CHROME = [process.env.CHROME_PATH ?? '', '/usr/bin/google-chrome', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => p && existsSync(p));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  if (!ok) failures++;
};

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const errs = [];
const open = async (q) => {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${URL}/${q}`, { waitUntil: 'networkidle2' });
  await sleep(2200);
  return page;
};
const B = (page, fn, ...a) => page.evaluate(fn, ...a);

// ---- the list, and the pictures
{
  const page = await open('?intro=1');
  await B(page, () => window.__froggy.newProfile('BADGES'));
  const info = await B(page, () => ({ ids: window.__froggy.badges.ids(), icons: window.__froggy.badges.icons() }));
  const kinds = new Set(info.ids.map((b) => b.kind));
  const noIcon = info.ids.filter((b) => !info.icons.includes(b.id)).map((b) => b.id);
  check('every badge has a picture of its own', noIcon.length === 0 && new Set(info.ids.map((b) => b.id)).size === info.ids.length, noIcon.length ? `missing ${noIcon.join(',')}` : `${info.ids.length} badges`);
  check('story, mastery, Creature Clash and secret badges are all there', ['story', 'mastery', 'clash', 'secret'].every((k) => kinds.has(k)), [...kinds].join(','));

  // ---- once, and the drop-down
  const first = await B(page, () => window.__froggy.badges.earn('m_slots'));
  const again = await B(page, () => window.__froggy.badges.earn('m_slots'));
  check('a badge is earned once: the second time is refused', first === true && again === false, `${first}, ${again}`);
  await B(page, () => {
    window.__froggy.badges.earn('hide_seek');
    window.__froggy.badges.earn('s_roof');
  });
  const queued = await B(page, () => window.__froggy.badges.toast());
  await sleep(4600);
  const later = await B(page, () => window.__froggy.badges.toast());
  check('BADGE UNLOCKED comes down for each, one after the other', queued >= 2 && later < queued, `${queued} waiting, then ${later}`);
  const toastTop = await B(page, () => {
    const g = window.__froggy.game();
    return { touchTop: g.scene.getScenes(true).map((s) => s.scene.key) };
  });
  check('the drop-down takes no input', await B(page, () => window.__froggy.game().scene.getScene('BadgeToast').input.enabled === false), toastTop.touchTop.join(','));

  // ---- the record-shaped lines
  const lines = await B(page, () => {
    const b = window.__froggy.badges;
    const out = {};
    const pairs = [['whack', 89, 90, 'm_whack', false], ['hoops', 22, 21.9, 'm_hoops', true], ['roulette', 9, 10, 'm_chamber', false], ['wheel', 500, 1000, 'm_wheel', false], ['battleship', 21, 20, 'm_pond', true]];
    for (const [game, short, on, id] of pairs) {
      b.onRecord(game, short);
      const before = b.has(id);
      b.onRecord(game, on);
      out[id] = [before, b.has(id)];
    }
    return out;
  });
  const linesOk = Object.values(lines).every(([a, c]) => a === false && c === true);
  check('mastery on a record: just short earns nothing, over the line earns it', linesOk, JSON.stringify(lines));

  // ---- a reload keeps them
  await page.reload({ waitUntil: 'networkidle2' });
  await sleep(2200);
  const kept = await B(page, () => ['m_slots', 'hide_seek', 's_roof', 'm_whack'].every((id) => window.__froggy.badges.has(id)));
  check('earned badges survive a reload', kept);

  // ---- the badge screen
  await B(page, () => {
    const g = window.__froggy.game();
    for (const s of g.scene.getScenes(true)) if (s.scene.key !== 'BadgeToast') s.scene.stop();
    g.scene.start('StartScreen');
  });
  await sleep(1200);
  await B(page, () => window.__froggy.game().scene.run('BadgesModal', { from: 'StartScreen' }));
  await sleep(800);
  const screen = await B(page, () => {
    const s = window.__froggy.game().scene.getScene('BadgesModal');
    const all = [];
    const walk = (o) => {
      if (o.list) o.list.forEach(walk);
      else if (typeof o.text === 'string') all.push(o.text);
    };
    s.children.list.forEach(walk);
    return { texts: all, scroll: s.scrolled() };
  });
  check('a secret not found is ??? on the badge screen, and its words say nothing', screen.texts.includes('???') && !screen.texts.includes('LAZY HIDING') && screen.texts.includes('UP ON THE ROOF'), `${screen.texts.filter((t) => t === '???').length} hidden`);
  await page.mouse.move(640, 360);
  for (let i = 0; i < 10; i++) {
    await page.mouse.wheel({ deltaY: 120 });
    await sleep(50);
  }
  const moved = await B(page, () => window.__froggy.game().scene.getScene('BadgesModal').scrolled());
  check('the badge screen scrolls', screen.scroll.most > 0 && moved.top > 0, `${moved.top} of ${moved.most}`);
  await page.close();
}

// A cabinet on a profile of its own (the badges are the profile's, and every
// page shares the browser's storage), past its screen and into the go.
const playOn = async (game, profile, bridge) => {
  const page = await open('?intro=1&tokens=50');
  await B(page, (name) => window.__froggy.newProfile(name), profile);
  await B(page, () => window.__froggy.setTokens(50));
  await B(page, (id) => {
    const g = window.__froggy.game();
    for (const s of g.scene.getScenes(true)) s.scene.stop();
    g.scene.start('Minigame', { id, from: 'ArcadeHub' });
  }, game);
  for (let i = 0; i < 24 && !(await B(page, () => !!window.__froggy.game().scene.getScene('Minigame')?.card)); i++) await sleep(250);
  await sleep(600);
  // (HOW TO PLAY first, on a first go: Space plays from either page)
  for (let i = 0; i < 3 && !(await B(page, (n) => !!window[n], bridge)); i++) {
    await page.keyboard.press('Space');
    for (let j = 0; j < 12 && !(await B(page, (n) => !!window[n], bridge)); j++) await sleep(250);
  }
  return page;
};

// ---- Frog Cross in a real go, and in practice
const crossFive = async (practice) => {
  const page = await playOn('frogcross', practice ? 'ROADP' : 'ROAD', '__frog');
  if (practice) await B(page, () => (window.__froggy.game().scene.getScene('Minigame').practicing = true));
  const seen = [];
  for (let i = 0; i < 5; i++) {
    // (a hop is refused during the opening and mid-hop: try until it counts)
    for (let t = 0; t < 40 && (await B(page, () => window.__frog.state().crossings)) <= i; t++) {
      await B(page, () => window.__frog.cross());
      await sleep(250);
    }
    await sleep(500);
    seen.push(await B(page, () => window.__froggy.badges.has('m_cross5')));
  }
  const st = await B(page, () => window.__frog.state());
  await page.close();
  return { seen, crossings: st.crossings };
};
{
  const real = await crossFive(false);
  check('Frog Cross: ROAD RUNNER on the fifth crossing, not before', real.crossings === 5 && real.seen.slice(0, 4).every((x) => !x) && real.seen[4], `${real.crossings} crossings, ${real.seen.join(',')}`);
  const prac = await crossFive(true);
  check('a practice go earns no badge', prac.crossings === 5 && prac.seen.every((x) => !x), `${prac.crossings} crossings, ${prac.seen.join(',')}`);
}

// ---- ERROR FROG-04
{
  const page = await playOn('whack', 'WHACK', '__whack');
  const before = await B(page, () => window.__froggy.badges.has('s_404'));
  await B(page, () => window.__whack.forceCameo());
  let guest = false;
  for (let i = 0; i < 40 && !guest; i++) {
    guest = await B(page, () => window.__whack.state().guest);
    await sleep(100);
  }
  const after = await B(page, () => window.__froggy.badges.has('s_404'));
  check('ERROR FROG-04: seeing him in Whack-a-Frog is the secret', !before && guest && after, `before ${before}, he came up ${guest}, after ${after}`);
  await page.close();
}

// ---- the goals card
{
  const page = await open('?intro=1&scene=ArcadeHub');
  await B(page, () => {
    const life = window.__froggy.state().life;
    window.__froggy.patch({ life: { ...life, stats: { ...life.stats, game_won: 25, won_slots: 1, won_whack: 1 } } });
    window.__froggy.game().scene.run('Goals', { from: 'ArcadeHub' });
  });
  await sleep(800);
  const labels = () =>
    B(page, () => {
      const s = window.__froggy.game().scene.getScene('Goals');
      const all = [];
      const walk = (o) => {
        if (o.list) o.list.forEach(walk);
        else if (typeof o.text === 'string') all.push(o.text);
      };
      s.children.list.forEach(walk);
      return all;
    });
  const t1 = await labels();
  check('the goals card has no THIS WEEK', !t1.includes('THIS WEEK') && t1.includes('TODAY') && t1.includes('ACHIEVEMENTS'), t1.filter((t) => /WEEK|TODAY|ACHIEVE/.test(t)).join('|'));
  // ACHIEVEMENTS (the second tab)
  await page.mouse.click(884, 144);
  await sleep(500);
  const t2 = await labels();
  check('a win at different cabinets counts each cabinet once', t2.includes('2/10'), t2.filter((t) => /\/10$/.test(t)).join('|'));
  const scroll0 = await B(page, () => window.__froggy.game().scene.getScene('Goals').scrolled());
  await page.mouse.move(400, 400);
  for (let i = 0; i < 6; i++) {
    await page.mouse.wheel({ deltaY: 120 });
    await sleep(50);
  }
  const scroll1 = await B(page, () => window.__froggy.game().scene.getScene('Goals').scrolled());
  check('the achievements scroll', scroll0.most > 0 && scroll1.top > 0, `${scroll1.top} of ${scroll1.most}`);
  const claims = await B(page, () => {
    const life = window.__froggy.state().life;
    return { achieved: life.achieved };
  });
  check('nothing is claimed by itself', !claims.achieved.includes('a_wins_100'), claims.achieved.join(','));
  await page.close();
}

check('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
console.log(failures ? `\n${failures} FAILED` : '\nAll badge checks passed.');
await browser.close();
process.exit(failures ? 1 : 0);
