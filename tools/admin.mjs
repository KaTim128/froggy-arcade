/**
 * The admin's game settings (core/gameConfig, scenes2d/AdminConfig):
 * permissions, the test zone kept apart from live, reset, publish, a
 * conflict refused, one game's defaults restored without touching another,
 * persistence after a reload, every profile on the browser seeing what was
 * published, and another tab picking it up.
 *
 *   node tools/admin.mjs [--url http://localhost:5173]
 */

import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';
import { argv } from 'node:process';

const arg = (n, d) => {
  const i = argv.indexOf(n);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const URL = arg('--url', 'http://localhost:5173');
const CHROME = [process.env.CHROME_PATH ?? '', '/usr/bin/google-chrome', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => existsSync(p));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
let ran = 0;
const check = (name, ok, note = '') => {
  ran++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${note ? `  — ${note}` : ''}`);
  if (!ok) failed++;
};

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
const open = async () => {
  const page = await browser.newPage();
  await page.setViewport({ width: 960, height: 540 });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${URL}/?intro=1&charity=1&tokens=50&scene=ArcadeHub`, { waitUntil: 'load' });
  await sleep(2500);
  return page;
};
const ev = (page, fn, ...a) => page.evaluate((fn, a) => new (Object.getPrototypeOf(async () => {}).constructor)('f', 'a', fn)(window.__froggy, a), fn, a);

try {
  const page = await open();
  // a clean slate: no settings from an earlier run
  await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('froggy.config.')).forEach((k) => localStorage.removeItem(k)));
  await ev(page, 'f.config.reload()');

  // ---- a player cannot change anything
  await ev(page, "f.useProfile('PLAYER1')");
  const r1 = await ev(page, "return [f.config.saveTest({'crane.clock': 30}), f.config.publish(), f.config.setTestZone(true), f.config.restoreDefaults('crane'), f.config.resetTest()]");
  check('a player is refused every write', r1.every((r) => !r.ok && r.msg === 'ADMIN ONLY.'), JSON.stringify(r1.map((r) => r.msg)));
  check('the player plays the default', (await ev(page, "return f.config.cfg('crane.clock')")) === 14);

  // ---- the admin's test zone
  await ev(page, "f.useProfile('ADDMIN128')");
  const bad = await ev(page, "return f.config.saveTest({'crane.clock': 999})");
  check('an out-of-range value is refused', !bad.ok, bad.msg);
  const badChoice = await ev(page, "return f.config.saveTest({'grudge.foe': 'dragon'})");
  check('a choice not on the list is refused', !badChoice.ok, badChoice.msg);
  await ev(page, "f.config.saveTest({'crane.clock': 30, 'tictactoe.cost': 3, 'grudge.foe': 'rhino'})");
  check('test zone off: the admin still plays live', (await ev(page, "return f.config.cfg('crane.clock')")) === 14);
  await ev(page, 'f.config.setTestZone(true)');
  check('test zone on: the admin plays the test value', (await ev(page, "return f.config.cfg('crane.clock')")) === 30);
  check('test zone on: a cabinet price follows', (await ev(page, "return (await import('/src/game/content.ts')).CABINETS.find((c) => c.id === 'tictactoe').cost")) === 3);
  check('test zone on: a test-only pick is read', (await ev(page, "return f.config.cfg('grudge.foe')")) === 'rhino');

  // ---- unpublished changes never reach a player
  await ev(page, "f.useProfile('PLAYER2')");
  check('an unpublished value does not reach a player', (await ev(page, "return f.config.cfg('crane.clock')")) === 14);
  check('a test-only pick never reaches a player', (await ev(page, "return f.config.cfg('grudge.foe')")) === 'none');

  // ---- reset
  await ev(page, "f.useProfile('ADDMIN128')");
  await ev(page, 'f.config.resetTest()');
  check('reset throws the test values away', (await ev(page, "return f.config.layersOf('crane.clock').test")) === undefined);
  check('reset leaves live alone', (await ev(page, "return f.config.layersOf('crane.clock').live")) === undefined);

  // ---- publish
  await ev(page, "f.config.saveTest({'crane.clock': 25, 'grudge.round': 60, 'grudge.foe': 'lion'})");
  const pub = await ev(page, 'return f.config.publish()');
  check('publish succeeds', pub.ok, pub.msg);
  check('publish bumps the live version', (await ev(page, 'return f.config.liveVersion()')) === 1);
  check('a test-only pick is not published', (await ev(page, "return f.config.layersOf('grudge.foe').live")) === undefined);
  await ev(page, "f.useProfile('PLAYER1')");
  check('a published value reaches a player', (await ev(page, "return f.config.cfg('crane.clock')")) === 25);

  // ---- a conflict: live moved on since the test began
  await ev(page, "f.useProfile('ADDMIN128')");
  await ev(page, "f.config.saveTest({'crane.clock': 40})");
  // (another tab publishes in between)
  await page.evaluate(() => {
    const live = JSON.parse(localStorage.getItem('froggy.config.live'));
    live.version += 1;
    live.values['bowling.cost'] = 7;
    localStorage.setItem('froggy.config.live', JSON.stringify(live));
  });
  const clash = await ev(page, 'return f.config.publish()');
  check('a publish over a newer live is refused', !clash.ok, clash.msg);
  await ev(page, 'f.config.reload()');
  check("the other tab's publish stands", (await ev(page, "return f.config.layersOf('bowling.cost').live")) === 7);

  // ---- one game's defaults
  await ev(page, 'f.config.resetTest()');
  const rd = await ev(page, "return f.config.restoreDefaults('crane')");
  check('restore defaults succeeds', rd.ok, rd.msg);
  check("the crane is back to its default", (await ev(page, "return f.config.cfg('crane.clock')")) === 14);
  check('the grudge keeps its published value', (await ev(page, "return f.config.cfg('grudge.round')")) === 60);
  check('the bowling keeps its published value', (await ev(page, "return f.config.layersOf('bowling.cost').live")) === 7);

  // ---- persistence: after a reload, and in a second tab
  await page.reload({ waitUntil: 'load' });
  await sleep(2500);
  check('published settings survive a reload', (await ev(page, "return f.config.cfg('grudge.round')")) === 60);
  const tab2 = await open();
  await ev(page, "f.config.setTestZone(false); f.config.saveTest({'grudge.round': 45}); f.config.publish()");
  await sleep(400);
  check('another tab picks a publish up', (await ev(tab2, "return f.config.cfg('grudge.round')")) === 45);

  // ---- the screen opens for the admin, not for a player (this tab in front again: a hidden tab does not tick)
  await page.bringToFront();
  await ev(page, "f.game().scene.start('AdminConfig')");
  await sleep(600);
  check('the settings screen opens for the admin', await ev(page, "return f.game().scene.isActive('AdminConfig')"));
  await ev(page, "f.game().scene.stop('AdminConfig')");
  await sleep(300);
  const who = await ev(page, "f.useProfile('PLAYER2'); f.game().scene.start('AdminConfig'); return f.state().tokens");
  await sleep(600);
  const st = await ev(page, "const s = f.game().scene.getScene('AdminConfig'); return [s.sys.settings.status, s.children.length, f.state().tokens]");
  check('the settings screen refuses a player', !(await ev(page, "return f.game().scene.isActive('AdminConfig')")), `tokens ${who} ${JSON.stringify(st)}`);

  // (leave nothing behind for other tests)
  await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('froggy.config.')).forEach((k) => localStorage.removeItem(k)));
  check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
} finally {
  await browser.close();
}
console.log(`\n${ran - failed}/${ran} passed`);
process.exit(failed ? 1 : 0);
