/**
 * The street stealth, after the escape from the building: the whole change
 * of clothes, the patrols on the pavement, the alleys, the police indoors,
 * the arcade cabinets.
 *
 *   node tools/stealth.mjs [--url http://localhost:5173]
 */

import puppeteer from 'puppeteer-core';
import { existsSync, mkdirSync } from 'node:fs';
import { argv } from 'node:process';

const arg = (n, d) => {
  const i = argv.indexOf(n);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const URL = arg('--url', 'http://localhost:5173');
const SHOTS = 'tools/shots/stealth';
mkdirSync(SHOTS, { recursive: true });

const CHROME = [
  process.env.CHROME_PATH ?? '',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
].find((p) => existsSync(p));
if (!CHROME) {
  console.error('No Chrome/Edge found.');
  process.exit(2);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
let failed = 0;
let ran = 0;
const check = (name, ok, note = '') => {
  ran++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${note ? `  — ${note}` : ''}`);
  if (!ok) failed++;
};

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});

const newPage = async (qs) => {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error' && !/favicon|vite\.svg/i.test(t)) errors.push(`console.error: ${t}`);
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  await page.goto(`${URL}/${qs}`, { waitUntil: 'networkidle2' });
  await sleep(2500);
  await page.mouse.click(640, 60);
  await sleep(400);
  return page;
};

/** The hunt on: back the following day, the poster up, nothing changed yet. */
const hunt = (page, extra = {}) =>
  page.evaluate((extra) => {
    const f = window.__froggy;
    const st = f.state();
    f.patch({ arc: 'live', route: 'normal', jailed: false, disguised: false, hudShown: false, wantedOutfit: { ...st.life.outfit }, ...extra });
    // midday: the shops open, the light good
    f.setHour(12);
  }, extra);

const start = async (page, key, data = {}) => {
  await page.evaluate(
    (key, data) => {
      const g = window.__froggy.game();
      for (const s of g.scene.getScenes(true)) if (s.scene.key !== key) s.scene.stop();
      g.scene.start(key, data);
    },
    key,
    data,
  );
  for (let i = 0; i < 40; i++) {
    await sleep(250);
    const ok = await page.evaluate((key) => window.__froggy.activeScenes().includes(key), key);
    if (ok) break;
  }
  await sleep(1200);
};

/** Poll `fn` (run in the page) until it gives something truthy. */
const until = async (page, fn, ms = 20000, ...a) => {
  const t0 = Date.now();
  let v = await page.evaluate(fn, ...a);
  while (!v && Date.now() - t0 < ms) {
    await sleep(250);
    v = await page.evaluate(fn, ...a);
  }
  return v;
};

try {
  // ------------------------------------------------------------- 1. the whole look
  console.log('\nstealth  the whole change of clothes');
  {
    const page = await newPage('?intro=1&charity=1&key=1&scene=ArcadeHub');
    await hunt(page);
    const p0 = await page.evaluate(() => window.__froggy.stealth.progress());
    check('nothing changed yet: 0 of 7, shoes and glasses among what is left', p0.changed === 0 && p0.total === 7 && p0.left.includes('SHOES') && p0.left.includes('GLASSES'), JSON.stringify(p0));
    // own a piece for every slot, and put them on one at a time
    const ids = ['cos_hoodie_grey', 'cos_jeans', 'cos_sneakers', 'cos_scarf_red', 'cos_cap', 'cos_sunglasses', 'hair_buzz'];
    await page.evaluate((ids) => {
      const st = window.__froggy.state();
      st.life.wardrobe.push(...ids);
      window.__froggy.patch({ life: st.life });
    }, ids);
    const steps = [];
    for (const id of ids) {
      const r = await page.evaluate((id) => {
        window.__froggy.stealth.wear(id);
        return { p: window.__froggy.stealth.progress(), disguised: window.__froggy.state().disguised };
      }, id);
      steps.push(r);
    }
    const counts = steps.map((r) => r.p.changed).join(',');
    // (the cut takes the cap off: the hat counts as changed either way)
    check('each piece changed counts, one at a time', steps.slice(0, 6).every((r, i) => r.p.changed === i + 1), counts);
    check('not a new face until the last piece (the hair)', steps.slice(0, 6).every((r) => !r.disguised) && steps[6].disguised, steps.map((r) => r.disguised).join(','));
    const shoesOnly = await page.evaluate(() => {
      const f = window.__froggy;
      const st = f.state();
      // back to the poster's clothes except the shoes
      f.patch({ disguised: false, life: { ...st.life, outfit: { ...st.wantedOutfit, shoes: 'cos_sneakers' } } });
      return f.stealth.progress();
    });
    check('the shoes are tracked on their own', shoesOnly.changed === 1 && !shoesOnly.left.includes('SHOES'), JSON.stringify(shoesOnly));
    await page.close();
  }

  // ------------------------------------------------------------- 2. the pavement
  console.log('\nstealth  the patrols on the pavement');
  {
    const page = await newPage('?intro=1&charity=1&key=1&scene=StreetEast');
    await hunt(page);
    await start(page, 'StreetEast', { atX: 200 });
    // (out of their sight while we count them)
    await page.evaluate(() => (window.__froggy.game().scene.getScene('StreetEast').player.sprite.visible = false));
    const n = await until(page, () => window.__froggy.game().scene.getScene('StreetEast').patrol?.count >= 2, 40000);
    const states = await page.evaluate(() => window.__froggy.game().scene.getScene('StreetEast').patrol.states);
    check('two or more officers walking the street in the hunt', !!n, JSON.stringify(states));

    // one stood in front of you, facing you: known at once, no questions
    const seen = await page.evaluate(() => {
      const s = window.__froggy.game().scene.getScene('StreetEast');
      s.player.sprite.visible = true;
      const u = s.patrol.units.find((u) => u.cop);
      for (const o of s.patrol.units) if (o !== u && o.cop) o.cop.setPosition(-200, o.cop.y), (o.state = 'leave'), (o.dir = -1);
      u.cop.setPosition(s.player.x - 50, u.cop.y);
      u.cop.face(1);
      u.dir = 1;
      u.state = 'walk';
      u.nextPause = 99;
      u.eyeCool = 99;
      u.doorCool = 99;
      return true;
    });
    const st = await until(page, () => {
      const s = window.__froggy.game().scene.getScene('StreetEast');
      return s.patrol.units.find((u) => u.state === 'chase' || u.state === 'question')?.state;
    }, 8000);
    check('in sight with the poster face: straight to the chase, no questioning', seen && st === 'chase', String(st));
    await page.screenshot({ path: `${SHOTS}/street_cone.png` });
    await page.close();
  }
  {
    // the same with a whole new look: they have to look hard first
    const page = await newPage('?intro=1&charity=1&key=1&scene=StreetEast&police=1');
    await hunt(page);
    await page.evaluate(() => window.__froggy.patch({ disguised: true }));
    await start(page, 'StreetEast', { atX: 40 });
    await until(page, () => window.__froggy.game().scene.getScene('StreetEast').patrol?.units?.length > 0, 10000);
    const r = await until(page, () => {
      const s = window.__froggy.game().scene.getScene('StreetEast');
      const u = s.patrol.units[0];
      if (!u) return false;
      if (!u.cop) u.wait = 0;
      return !!u.cop;
    }, 30000);
    await page.evaluate(() => {
      const s = window.__froggy.game().scene.getScene('StreetEast');
      const u = s.patrol.units[0];
      u.cop.setPosition(s.player.x - 50, u.cop.y);
      u.cop.face(1);
      u.dir = 1;
      u.state = 'pause';
      u.pauseT = 99;
      u.pauseLen = 99;
      u.eyeCool = 99;
      u.doorCool = 99;
    });
    await sleep(700);
    const st = await page.evaluate(() => window.__froggy.game().scene.getScene('StreetEast').patrol.units[0].state);
    check('with a new look, no instant chase', r && st !== 'chase', st);
    await page.close();
  }

  // ------------------------------------------------------------- 3. the old man
  console.log('\nstealth  they watch the old man');
  {
    const page = await newPage('?intro=1&charity=1&key=1&scene=StreetEast');
    await hunt(page);
    await start(page, 'StreetEast', { atX: 40 });
    // (you out of it: this is about him)
    await page.evaluate(() => (window.__froggy.game().scene.getScene('StreetEast').player.sprite.visible = false));
    const has = await page.evaluate(() => !!window.__froggy.game().scene.getScene('StreetEast').oldMan);
    if (!has) check('the old man is on the street', false, 'not painted (donated?)');
    else {
      await until(page, () => window.__froggy.game().scene.getScene('StreetEast').patrol?.units?.length > 0, 10000);
      await until(page, () => {
        const u = window.__froggy.game().scene.getScene('StreetEast').patrol.units[0];
        if (!u.cop) u.wait = 0;
        return !!u.cop;
      }, 20000);
      await page.evaluate(() => {
        const s = window.__froggy.game().scene.getScene('StreetEast');
        const u = s.patrol.units[0];
        // between you and him, facing him, you behind them
        s.player.setPosition(s.oldMan.x - 90, s.player.y);
        u.cop.setPosition(s.oldMan.x - 50, u.cop.y);
        u.cop.face(1);
        u.dir = 1;
        u.state = 'walk';
        u.eyeCool = 0;
        u.nextPause = 99;
        u.doorCool = 99;
      });
      const eye = await until(page, () => window.__froggy.game().scene.getScene('StreetEast').patrol.units[0].state === 'eye', 6000);
      check('an officer with him in sight stops and looks him over', !!eye);
    }
    await page.close();
  }

  // ------------------------------------------------------------- 4. the alleys
  console.log('\nstealth  the alleys: only if they saw you go in');
  {
    const page = await newPage('?intro=1&charity=1&key=1&scene=StreetEast');
    await hunt(page);
    await start(page, 'StreetEast', { atX: 40 });
    await until(page, () => {
      const u = window.__froggy.game().scene.getScene('StreetEast').patrol?.units?.[0];
      if (u && !u.cop) u.wait = 0;
      return !!u?.cop;
    }, 20000);
    const witnessed = await page.evaluate(() => {
      const s = window.__froggy.game().scene.getScene('StreetEast');
      const u = s.patrol.units[0];
      u.cop.setPosition(s.player.x - 40, u.cop.y);
      u.cop.face(1);
      u.state = 'chase';
      u.startT = 9;
      s.patrol.hideAway();
      return window.__froggy.stealth.pursuit();
    });
    check('chasing and in sight as you duck in: they follow', witnessed?.alley === true, JSON.stringify(witnessed));
    const unseen = await page.evaluate(() => {
      const s = window.__froggy.game().scene.getScene('StreetEast');
      const u = s.patrol.units[0];
      u.cop.setPosition(s.player.x - 200, u.cop.y);
      u.lastSeen = -Infinity;
      s.patrol.hideAway();
      return window.__froggy.stealth.pursuit();
    });
    check('chasing but too far back to see you go in: they go by', unseen && unseen.alley === false, JSON.stringify(unseen));
    // down the alley, unseen: nobody comes down it
    await start(page, 'SideAlley', { variant: 0, streetX: 120 });
    await sleep(3000);
    const none = await page.evaluate(() => window.__froggy.game().scene.getScene('SideAlley').patrol?.units?.length ?? 0);
    check('unseen: no officer comes down the alley', none === 0, String(none));
    // seen: one does
    await page.evaluate(() => window.__froggy.stealth.chase('left', true));
    await start(page, 'SideAlley', { variant: 0, streetX: 120 });
    const comes = await until(page, () => window.__froggy.game().scene.getScene('SideAlley').patrol?.chasing, 6000);
    check('seen going in: one comes down after you', !!comes);
    await page.screenshot({ path: `${SHOTS}/alley_follow.png` });
    await page.close();
  }

  // ------------------------------------------------------------- 5. indoors: the cone and the cover
  console.log('\nstealth  indoors: cones, tall and low cover');
  {
    const page = await newPage('?intro=1&charity=1&key=1&scene=ArcadeHub');
    await hunt(page, { disguised: true });
    await page.evaluate(() => window.__froggy.stealth.visits.put('arcade', 60000));
    await start(page, 'ArcadeHub', {});
    const present = await until(page, () => window.__froggy.game().scene.getScene('ArcadeHub').police?.present, 8000);
    check('an officer already in the arcade is in the room', !!present);
    const cov = await page.evaluate(() => {
      const s = window.__froggy.game().scene.getScene('ArcadeHub');
      const cab = s.cabinets[0].def;
      const pol = s.police;
      // them in front of the machine, looking straight up at it
      pol.devPut(cab.x, cab.y + 40, -Math.PI / 2);
      // you right behind it
      s.player.setPosition(cab.x, cab.y - 14);
      const behind = pol.sees();
      // you out beside it in the open, in the cone
      s.player.setPosition(cab.x + 14, cab.y + 10);
      const open = pol.sees();
      return { behind, open, cab: { x: cab.x, y: cab.y } };
    });
    check('behind an arcade machine: out of their sight', cov.behind === 0, JSON.stringify(cov));
    check('out in the open in the cone: seen', cov.open > 0, JSON.stringify(cov));
    const cone = await page.evaluate(() => {
      const pol = window.__froggy.game().scene.getScene('ArcadeHub').police;
      return pol.cone && pol.cone.commandBuffer.length > 0;
    });
    check('the vision cone is drawn', !!cone);
    await sleep(300);
    await page.screenshot({ path: `${SHOTS}/arcade_cone.png` });
    await page.close();
  }
  {
    // low cover (a sofa) hides nothing; tall (a wardrobe or bookcase) does
    const page = await newPage('?intro=1&charity=1&key=1&scene=FurnitureStore');
    await hunt(page, { disguised: true });
    await page.evaluate(() => window.__froggy.stealth.visits.put('furniture', 60000));
    await start(page, 'FurnitureStore', {});
    await until(page, () => window.__froggy.game().scene.getScene('FurnitureStore').police?.present, 8000);
    const r = await page.evaluate(() => {
      const s = window.__froggy.game().scene.getScene('FurnitureStore');
      const pol = s.police;
      const out = {};
      for (const { def, x, y } of s.layoutCache) {
        if (def.wall || def.cat === 'rug') continue;
        const cover = s.covers().find((c) => Math.abs(c.x + c.w / 2 - x) < 1 && c.y < y);
        pol.devPut(x, Math.min(s.bounds.bottom, y + 40), -Math.PI / 2);
        s.player.setPosition(x, y - (cover && cover.high ? cover.h - 2 : 4));
        out[def.id] = { h: def.h, high: !!cover?.high, sees: pol.sees() };
      }
      return out;
    });
    const low = Object.entries(r).filter(([, v]) => !v.high);
    const high = Object.entries(r).filter(([, v]) => v.high);
    check('low furniture does not hide you', low.length > 0 && low.every(([, v]) => v.sees > 0), JSON.stringify(low.slice(0, 4)));
    check('tall furniture does', high.length === 0 || high.every(([, v]) => v.sees === 0), JSON.stringify(high));
    await page.close();
  }
  {
    // an officer comes into a shop after you, and with the poster face knows you
    const page = await newPage('?intro=1&charity=1&key=1&scene=ClothesStore&police=1');
    await hunt(page);
    await start(page, 'ClothesStore', {});
    const came = await until(page, () => window.__froggy.game().scene.getScene('ClothesStore').police?.present, 15000);
    check('with the police out, an officer comes into the shop', !!came);
    const chased = await until(page, () => {
      const s = window.__froggy.game().scene.getScene('ClothesStore');
      const pol = s.police;
      if (!pol?.present) return false;
      const i = pol.info;
      // stand in front of them
      s.player.setPosition(i.x + Math.cos(i.ang) * 30, Math.min(s.bounds.bottom, Math.max(s.bounds.y, i.y + Math.sin(i.ang) * 30)));
      return pol.chasing || window.__froggy.activeScenes().includes('ExteriorDay');
    }, 15000);
    check('in their cone with the poster face: after you', !!chased);
    await page.close();
  }
  {
    // Lily's: the lobby and your flat
    const page = await newPage('?intro=1&charity=1&key=1&scene=Hotel');
    await hunt(page, { disguised: true });
    await page.evaluate(() => window.__froggy.stealth.visits.put('lily', 60000));
    await start(page, 'Hotel', { area: 'lobby' });
    const lobby = await until(page, () => window.__froggy.game().scene.getScene('Hotel').police?.present, 8000);
    check("an officer looks round Lily's lobby", !!lobby);
    await page.close();
  }

  // ------------------------------------------------------------- 6. the cabinets
  console.log('\nstealth  an officer comes over while you play');
  {
    const page = await newPage('?intro=1&charity=1&key=1&scene=ArcadeHub&tokens=50');
    await hunt(page);
    await start(page, 'ArcadeHub', {});
    const id = await page.evaluate(() => {
      const s = window.__froggy.game().scene.getScene('ArcadeHub');
      const def = s.cabinets.map((c) => c.def).find((d) => !d.freeToEnter && d.cost > 0);
      const st = window.__froggy.state();
      window.__froggy.patch({ gamesPlayed: { ...st.gamesPlayed, [def.id]: 3 } });
      window.__froggy.stealth.visits.clear('arcade');
      return def.id;
    });
    const before = await page.evaluate(() => window.__froggy.state().tokens ?? null);
    await start(page, 'Minigame', { id, from: 'ArcadeHub', straight: true });
    await until(page, () => !!window.__minigame, 8000);
    const paidBal = await page.evaluate(() => ({ stake: window.__minigame.stake() }));
    await page.evaluate(() => window.__minigame.cop(0.6));
    await sleep(2500);
    const panel = await page.evaluate(() => {
      const s = window.__froggy.game().scene.getScene('Minigame');
      const texts = s.children.list.filter((o) => o.type === 'BitmapText' || o.text !== undefined).map((o) => o.text ?? '');
      const deep = [];
      const walk = (l) => l.forEach((o) => (o.list ? walk(o.list) : o.text !== undefined && deep.push(o.text)));
      walk(s.children.list);
      return { settled: s.settled, texts: deep.join(' | ') };
    });
    check('the game stops, and the officer asks about the poster', panel.settled && /POSTER/i.test(panel.texts), panel.texts.slice(0, 200));
    check('no FORFEIT on the screen', !/FORFEIT/.test(panel.texts));
    await page.screenshot({ path: `${SHOTS}/cabinet_interrupt.png` });
    // through the line, back to the room: they are stood right there
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('KeyE');
      await sleep(500);
    }
    const back = await until(
      page,
      () => {
        const f = window.__froggy;
        const pol = f.activeScenes().includes('ArcadeHub') && f.game().scene.getScene('ArcadeHub').police;
        return pol?.present ? pol.info.state : f.activeScenes().join(',').includes('ExteriorDay') ? 'caught' : '';
      },
      10000,
    );
    const after = await page.evaluate(() => window.__froggy.state().tokens ?? null);
    check('back in the room with the officer by you, after you', ['chase', 'arrest', 'caught'].includes(back), JSON.stringify(back) + ' ' + JSON.stringify(await page.evaluate(() => window.__froggy.activeScenes())));
    check('the tokens it took stay taken', paidBal.stake > 0 && (before === null || after === null || after <= before - paidBal.stake), `stake ${paidBal.stake}, before ${before}, after ${after}`);
    await page.close();
  }
} catch (e) {
  console.error(e);
  failed++;
} finally {
  await browser.close();
}

if (errors.length) {
  console.log('\nerrors:');
  for (const e of [...new Set(errors)].slice(0, 20)) console.log('  ' + e);
}
console.log(`\n${ran - failed}/${ran} passed${errors.length ? `, ${errors.length} page errors` : ''}`);
process.exit(failed || errors.length ? 1 : 0);
