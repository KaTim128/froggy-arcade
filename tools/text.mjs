/**
 * The font.  PRD AR-2.
 *
 *   node tools/text.mjs [--url http://localhost:5173]
 *
 * Three things have to hold, and all three broke at least once while the 1-bit
 * font was going in:
 *
 *   1. Every character the game can put on screen has a glyph.  The arrow keys
 *      in the Settings keycap diagram had none and rendered as blank caps.
 *   2. Text is genuinely 1-bit.  This is the whole point: the browser font it
 *      replaced was antialiased into a 320x180 buffer and then nearest-upscaled
 *      4x, which turned every soft edge into a grey block.
 *   3. Nothing overflows the screen.  Phaser's word wrap ignores letterSpacing,
 *      so spacing the font that way ran dialogue straight off the right edge.
 */

import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';
import { argv } from 'node:process';

const arg = (name, dflt) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};
const URL = arg('--url', 'http://localhost:5173');

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

/**
 * A fresh browser has no profile, so the picker opens over the start screen and
 * swallows the clicks below.  This suite is about glyphs, not the save flow —
 * give it a profile and get out of the way.
 */
const seedProfile = () =>
  page.evaluate(() => {
    const id = 'textsuite';
    localStorage.setItem(
      'froggy.slots',
      JSON.stringify({ active: id, slots: [{ id, name: 'TEST', createdAt: Date.now() }] }),
    );
    localStorage.setItem(
      `froggy.run.${id}`,
      JSON.stringify({
        schemaVersion: 1,
        tokens: 20,
        charityUsed: false,
        prizesOwned: [],
        gamesPlayed: { tictactoe: 0, snakes: 0, airhockey: 0, hoops: 0, whack: 0, chompman: 0, grudge: 0 },
        route: 'normal',
        hasKey: false,
        seenIntro: true,
      }),
    );
  });

try {
  await page.goto(`${URL}/?intro=1&scene=StartScreen`, { waitUntil: 'networkidle2', timeout: 30000 });
  await seedProfile();
  await page.goto(`${URL}/?intro=1&scene=StartScreen`, { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(2200);

  // ---------------------------------------------------------- glyph coverage
  console.log('AR-2  every character the game can show has a glyph');
  const coverage = await page.evaluate(async () => {
    const font = await import('/src/render/pixelFont.ts');
    const input = await import('/src/core/input.ts');
    const script = await import('/src/froggy/script.ts');
    const content = await import('/src/game/content.ts');

    // Every string these modules can put in front of the player.
    const strings = [];
    const walk = (v, depth = 0) => {
      if (depth > 6 || v == null) return;
      if (typeof v === 'string') strings.push(v);
      else if (Array.isArray(v)) v.forEach((x) => walk(x, depth + 1));
      else if (typeof v === 'object') Object.values(v).forEach((x) => walk(x, depth + 1));
    };
    walk(input.BINDINGS);
    walk(script);
    walk(content);

    const missing = new Set();
    for (const s of strings) {
      for (const ch of s) {
        if (ch === '\n' || ch === '\r' || ch === '*') continue; // stripped before drawing
        if (!font.hasGlyph(ch)) missing.add(ch);
      }
    }
    return { missing: [...missing], strings: strings.length };
  });

  check(
    'no missing glyphs in bindings, script or prize names',
    coverage.missing.length === 0,
    coverage.missing.length ? `missing ${JSON.stringify(coverage.missing.join(''))}` : `${coverage.strings} strings`,
  );

  // ------------------------------------------------------------ truly 1-bit
  // "SETTINGS" is gold on the flat ink panel, so every pixel of it must be one
  // of exactly those two colours.  Any blend is antialiasing.
  console.log('\nAR-2  the text is 1-bit, not antialiased');
  await page.mouse.click(640, 360 + (148 - 90) * 4); // SETTINGS
  await sleep(900);

  const b64 = await page.screenshot({ encoding: 'base64' });
  const tones = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    // The heading, in game pixels, scaled to the 1280x720 shot.
    const z = img.width / 320;
    const d = ctx.getImageData(120 * z, 12 * z, 80 * z, 12 * z).data;
    const seen = new Map();
    for (let i = 0; i < d.length; i += 4) {
      const key = `${d[i]},${d[i + 1]},${d[i + 2]}`;
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    return [...seen.entries()].sort((a, b) => b[1] - a[1]);
  }, b64);

  // Flat panel + flat glyphs = two colours. Antialiasing adds a spread of
  // in-between tones, each covering a sliver of the region.
  const significant = tones.filter(([, n]) => n > 40);
  check(
    'the heading uses only its two flat colours',
    significant.length === 2,
    `${significant.length} tones over 40px: ${significant.map(([c, n]) => `${c}(${n})`).join(' ')}`,
  );

  // ------------------------------------------------------- nothing overflows
  console.log('\nAR-2  no text runs off the screen');
  const scenes = [
    ['StartScreen', '?intro=1&scene=StartScreen'],
    ['ArcadeHub', '?intro=1&tokens=20&scene=ArcadeHub'],
    ['ArcadeAnnex', '?intro=1&tokens=20&scene=ArcadeAnnex'],
    ['PrizeCounter', '?intro=1&tokens=800&scene=PrizeCounter'],
    ['FroggyCharity', '?intro=1&tokens=0&scene=FroggyCharity'],
    ['ArcadeDark', '?route=ejected&scene=ArcadeDark'],
    ['EndCard', '?route=ended&scene=EndCard'],
  ];

  const overflows = [];
  for (const [name, qs] of scenes) {
    await page.goto(`${URL}/${qs}`, { waitUntil: 'networkidle2' });
    await sleep(name === 'FroggyCharity' ? 4000 : 2400);
    const bad = await page.evaluate(() => {
      const g = window.__froggy.game();
      const out = [];
      for (const s of g.scene.getScenes(true)) {
        const visit = (o, ox = 0, oy = 0) => {
          if (o.type === 'Container') {
            o.list.forEach((c) => visit(c, ox + o.x, oy + o.y));
            return;
          }
          if (o.type !== 'BitmapText' || !o.visible || !o.text) return;
          const left = ox + o.x - o.width * o.originX;
          if (left < -1 || left + o.width > 321) {
            out.push({ text: o.text.slice(0, 30), left: Math.round(left), right: Math.round(left + o.width) });
          }
        };
        s.children.list.forEach((o) => visit(o));
      }
      return out;
    });
    if (bad.length) overflows.push({ scene: name, bad });
    console.log(`    ${name}: ${bad.length ? `${bad.length} overflowing` : 'clean'}`);
  }

  check(
    'every label fits inside the 320px frame',
    overflows.length === 0,
    overflows.length
      ? overflows.map((o) => `${o.scene}: "${o.bad[0].text}" ${o.bad[0].left}..${o.bad[0].right}`).join('; ')
      : `${scenes.length} scenes`,
  );

  // The Settings keycap diagram is the densest layout in the game.
  await page.goto(`${URL}/?intro=1&scene=StartScreen`, { waitUntil: 'networkidle2' });
  await sleep(2200);
  await page.mouse.click(640, 360 + (148 - 90) * 4);
  await sleep(600);
  await page.mouse.click(640 + (176 - 160) * 4, 360 + (34 - 90) * 4); // CONTROLS
  await sleep(700);

  const controls = await page.evaluate(async () => {
    const { BINDINGS } = await import('/src/core/input.ts');
    // Only the rows the diagram draws — not the modal's own chrome, which sits
    // lower on purpose.
    const rowText = new Set(BINDINGS.flatMap((b) => [b.action, ...b.keys]));
    const g = window.__froggy.game();
    const s = g.scene.getScene('SettingsModal');
    const labels = [];
    const visit = (o, ox = 0, oy = 0) => {
      if (o.type === 'Container') return o.list.forEach((c) => visit(c, ox + o.x, oy + o.y));
      if (o.type !== 'BitmapText' || !o.visible || !rowText.has(o.text)) return;
      labels.push({
        text: o.text,
        left: ox + o.x - o.width * o.originX,
        right: ox + o.x + o.width * (1 - o.originX),
        bottom: oy + o.y + o.height * (1 - o.originY),
      });
    };
    s.children.list.forEach((o) => visit(o));
    return labels;
  });

  // Action names live left of the keycap column at x=216; nothing may reach it.
  const actions = controls.filter((l) => /[a-z]/.test(l.text));
  const widest = actions.reduce((a, l) => (l.right > a.right ? l : a), { right: 0, text: '' });
  check('action names stay clear of the keycap column', widest.right <= 204, `"${widest.text}" ends at ${Math.round(widest.right)}`);

  const lowest = controls.reduce((a, l) => (l.bottom > a.bottom ? l : a), { bottom: 0, text: '' });
  check('the last binding clears the BACK button', lowest.bottom <= 151, `"${lowest.text}" bottom ${Math.round(lowest.bottom)}`);

  if (errors.length) {
    console.log('\nRuntime errors:');
    for (const e of errors) console.log('  ' + e);
  } else {
    console.log('\nRuntime errors: none');
  }

  const total = 5;
  console.log(`\n${total - failed}/${total} checks passed.`);
  await browser.close();
  process.exit(failed > 0 || errors.length > 0 ? 1 : 0);
} catch (e) {
  console.error('TEXT FAILED:', e.message);
  for (const err of errors) console.error('  ' + err);
  await browser.close();
  process.exit(1);
}
