/**
 * ---- EVERY ABILITY ITS OWN ICON, AND THE ICON IS THE ABILITY.
 *
 * The icon beside a move used to say only what KIND of move it was -- an
 * arrow for every shot, a crosshair for every instant line -- so a frog's
 * WATER JET and a moth's GUST had the same picture.  Now each one is drawn
 * from its own name: a flame for anything of fire, a drop for water, a
 * snowflake, a web, a claw's three slashes, a horn, a beak, a clock for the
 * BROOD CLOCK.  A seven-by-seven glyph in the creature's element colour,
 * with its darker parts in a shade of it.
 *
 * NO TWO ARE THE SAME.  Each word of a name offers the glyphs it could be
 * (ICE BOULDER is ice, or a boulder), and every ability takes the first one
 * nobody before it has taken -- so the two ice moves come out as a snowflake
 * and a boulder, not two snowflakes.  When a name has run out of fresh ones
 * the glyph gets a marker in its corner that no other ability with that
 * glyph has (see `assign`), so it is still its own.
 */

import type Phaser from 'phaser';

type Glyph = readonly string[];

const G: Record<string, Glyph> = {
  flame: ['...#...', '..##...', '..###..', '.#####.', '.##o##.', '.#ooo#.', '..###..'],
  drop: ['...#...', '...#...', '..###..', '.#####.', '.##o##.', '.#####.', '..###..'],
  snow: ['...#...', '.#.#.#.', '..###..', '###o###', '..###..', '.#.#.#.', '...#...'],
  rock: ['.......', '..###..', '.#####.', '#####o#', '###oo##', '.#####.', '.......'],
  leaf: ['.....##', '...####', '..##o##', '.##o##.', '.#o##..', '#o.....', '#......'],
  seed: ['...#...', '..#....', '..###..', '.##o##.', '.#####.', '..###..', '.......'],
  bolt: ['....##.', '...##..', '..##...', '.#####.', '...##..', '..##...', '.##....'],
  wind: ['.####..', '#....#.', '...##..', '.......', '#####..', '.....#.', '.###...'],
  mushroom: ['..###..', '.#o#o#.', '#######', '...#...', '...#...', '..###..', '.......'],
  web: ['#.....#', '.#####.', '.#.#.#.', '.##o##.', '.#.#.#.', '.#####.', '#.....#'],
  skull: ['.#####.', '##o#o##', '#######', '.##o##.', '..#.#..', '.......', '.......'],
  venom: ['...#...', '..###..', '.##o##.', '.#o#o#.', '.##o##.', '..###..', '.......'],
  tongue: ['.......', '#####..', '....##.', '.....#.', '....##.', '...#.#.', '....#..'],
  claw: ['.#..#..', '..#..#.', '#..#..#', '.#..#..', '..#..#.', '...#..#', '.......'],
  jaws: ['#######', '#.#.#.#', '.......', '.......', '#.#.#.#', '#######', '.......'],
  horn: ['......#', '.....##', '....##.', '...##..', '..##...', '.##....', '###....'],
  hoof: ['.......', '.#####.', '#######', '##...##', '#.....#', '.......', '.......'],
  wing: ['.....##', '....###', '...###.', '..##o..', '.##o...', '##.....', '#......'],
  eye: ['.......', '.#####.', '#..o..#', '#.ooo.#', '#..o..#', '.#####.', '.......'],
  star: ['...#...', '...#...', '#######', '.#####.', '..###..', '.##.##.', '.#...#.'],
  moon: ['..###..', '.##....', '##.....', '##.....', '##.....', '.##....', '..###..'],
  ring: ['..###..', '.#...#.', '#..#..#', '#.###.#', '#..#..#', '.#...#.', '..###..'],
  shell: ['.......', '..###..', '.#####.', '##o#o##', '#######', '#.#.#.#', '.......'],
  bubble: ['.##....', '#..#...', '#.##...', '.##.##.', '...#..#', '...#.##', '....##.'],
  spines: ['#..#..#', '#..#..#', '.#.#.#.', '.#.#.#.', '..###..', '..###..', '...#...'],
  vine: ['.#.....', '#.#....', '..#....', '..##...', '...#.#.', '....#.#', '.....#.'],
  plus: ['..###..', '..#o#..', '###o###', '#ooooo#', '###o###', '..#o#..', '..###..'],
  honey: ['..###..', '.#ooo#.', '#ooooo#', '#ooooo#', '.#ooo#.', '..###..', '.......'],
  bee: ['.#.#...', '..#....', '.#####.', '#o#o#o#', '.#####.', '.......', '.......'],
  ghost: ['..###..', '.#####.', '##o#o##', '#######', '#######', '#.#.#.#', '.......'],
  sound: ['#.#.#..', '.#.#.#.', '.#.#.#.', '.#.#.#.', '.#.#.#.', '#.#.#..', '.......'],
  rush: ['.......', '##..#..', '.....#.', '#######', '.....#.', '##..#..', '.......'],
  hops: ['##.....', '##.....', '...##..', '...##..', '.....##', '.....##', '.......'],
  shadow: ['..###..', '.##oo..', '##ooo..', '##ooo..', '##ooo..', '.##oo..', '..###..'],
  gem: ['...#...', '..###..', '.##o##.', '##ooo##', '.##o##.', '..###..', '...#...'],
  mountain: ['.......', '...#...', '..###..', '.##o##.', '##ooo##', '#######', '.......'],
  meteor: ['.....##', '....###', '...###.', '.o###..', 'o.##...', '.o.....', 'o......'],
  tentacle: ['#......', '#....#.', '.#..#.#', '.#..#..', '..##...', '...#...', '...##..'],
  splat: ['#..#..#', '.#####.', '.##o##.', '###o###', '.#####.', '.#.#.#.', '#.....#'],
  chain: ['.##....', '#..#...', '.##.##.', '...#..#', '....##.', '.......', '.......'],
  mirror: ['.#####.', '#.....#', '#..#..#', '#.#...#', '#.....#', '.#####.', '...#...'],
  lantern: ['..###..', '.#...#.', '.#ooo#.', '.#ooo#.', '.#ooo#.', '.#####.', '...#...'],
  clock: ['..###..', '.#.#.#.', '#..#..#', '#..##.#', '#.....#', '.#...#.', '..###..'],
  bird: ['.......', '#.....#', '.#...#.', '..#.#..', '...#...', '.......', '.......'],
  bricks: ['#######', '#..#..#', '#######', '.#..#..', '#######', '#..#..#', '#######'],
  shield: ['#######', '#ooooo#', '#ooooo#', '#ooooo#', '.#ooo#.', '..###..', '...#...'],
  armour: ['.#.#.#.', '#######', '#.....#', '#######', '#.....#', '#######', '.#.#.#.'],
  cage: ['.#####.', '#.#.#.#', '#.#.#.#', '#.#.#.#', '#.#.#.#', '#.#.#.#', '.#####.'],
  sheet: ['.......', '.......', '.#####.', '#ooooo#', '.#####.', '.......', '.......'],
  rune: ['#######', '#.....#', '#.###.#', '#.#.#.#', '#.#...#', '#.....#', '#######'],
  twister: ['#######', '.#####.', '..###..', '..###..', '...#...', '..#....', '...#...'],
  sleep: ['#######', '....#..', '...#...', '..#....', '#######', '.......', '.......'],
  needle: ['......#', '.....#.', '....#..', '...#...', '..#....', '.##....', '##.....'],
  fist: ['.......', '.####..', '######.', '######.', '######.', '.####..', '.......'],
  boot: ['..##...', '..##...', '..##...', '..###..', '..####.', '..#####', '.......'],
  beak: ['.......', '..##...', '.####..', '#######', '.####..', '..##...', '.......'],
  pincer: ['#.....#', '##...##', '.#...#.', '.##.##.', '..###..', '...#...', '.......'],
  scythe: ['..####.', '.#....#', '#......', '.#.....', '..#....', '...#...', '....#..'],
  tusk: ['#......', '#......', '.#.....', '.#.....', '..##...', '...###.', '.......'],
  ear: ['.#.....', '#.#....', '#.#....', '#.#....', '#..#...', '.#..##.', '..##...'],
  tail: ['.......', '#......', '.#.....', '..#....', '..##...', '...###.', '.....##'],
  fin: ['...#...', '..##...', '..###..', '.####..', '######.', '#######', '.......'],
  paw: ['.#...#.', '.......', '#.###.#', '.#####.', '.#####.', '..###..', '.......'],
  spores: ['.#..#..', '...#..#', '#.#..#.', '..#.#..', '.#..#.#', '#..#...', '..#..#.'],
  blob: ['.......', '..##...', '.####..', '######.', '.####.#', '..##...', '.......'],
  sparkle: ['...#...', '...#...', '..#o#..', '###o###', '..#o#..', '...#...', '...#...'],
  pebbles: ['.......', '.#..#..', '....#.#', '#.#....', '...#.#.', '.#....#', '.......'],
  wire: ['.......', '#...#..', '.#.#.#.', '..#...#', '.......', '.......', '.......'],
  lure: ['..###..', '...#...', '...#...', '..#.#..', '.##.##.', '.#####.', '..###..'],
  blink: ['#.#.#..', '.......', '.....#.', '......#', '.....#.', '#.#.#..', '.......'],
  twins: ['.#...#.', '###.###', '.#...#.', '#.#.#.#', '.......', '.......', '.......'],
  hand: ['..#.#..', '..#.#.#', '.#####.', '.#####.', '..###..', '#######', '.......'],
  spiral: ['.####..', '#....#.', '#.##..#', '#.#.#.#', '#..#..#', '.#...#.', '..###..'],
  maw: ['.#####.', '#######', '##...##', '#.....#', '##...##', '#######', '.#####.'],
  head: ['..###..', '.#####.', '.#o#o#.', '.#####.', '..###..', '...#...', '..###..'],
  breath: ['.......', '##.....', '..##.#.', '#...###', '..##.#.', '##.....', '.......'],
  wave: ['.......', '..##...', '.#..#..', '#....##', '.......', '.......', '.......'],
  sword: ['......#', '.....#.', '....#..', '#..#...', '.##....', '.##....', '#..#...'],
  arrow: ['.......', '....#..', '.....#.', '#######', '.....#.', '....#..', '.......'],
  burst: ['#..#..#', '.#.#.#.', '..#o#..', '###o###', '..#o#..', '.#.#.#.', '#..#..#'],
  heart: ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...', '.......'],
  crown: ['#..#..#', '##.#.##', '#######', '#ooooo#', '#######', '.......', '.......'],
  sun: ['#..#..#', '.#####.', '.#ooo#.', '##ooo##', '.#ooo#.', '.#####.', '#..#..#'],
  dig: ['...#...', '...#...', '...#...', '.#####.', '.#####.', '..###..', '#.#.#.#'],
  roll: ['..###..', '.#.#.#.', '#..#..#', '#######', '#..#..#', '.#.#.#.', '..###..'],
  tether: ['#......', '.#.....', '..#....', '...#...', '....#..', '.....#.', '......#'],
};

/**
 * What each word of a name could be drawn as, best first.  A word that is
 * not here offers nothing, and the next word is asked.
 */
const WORDS: Record<string, string[]> = {
  MAGMA: ['flame', 'blob'], FLARE: ['sun', 'flame'], SPLITFLAME: ['flame'], AFTERBURN: ['flame'], LAVA: ['blob', 'flame'], MOLTEN: ['flame', 'armour'],
  EMBER: ['sparkle', 'flame'], HEAT: ['flame', 'sun'], SUNSPARK: ['sun', 'sparkle'], ASH: ['spores'], SLAG: ['armour'],
  VENOM: ['venom', 'skull'], STING: ['needle', 'venom'], BELLOWS: ['wind', 'rush'], LANCE: ['sword', 'needle'], PLUME: ['flame', 'spores'],
  TONGUE: ['tongue'], GULP: ['maw', 'jaws'], SEA: ['wave', 'drop'], GLIDE: ['wing', 'blink'], GROUNDSWELL: ['wave', 'mountain'],
  PUFF: ['bubble', 'spores'], BUBBLE: ['bubble'], CAGE: ['cage'], SPINE: ['spines', 'needle'], REGROWTH: ['leaf', 'plus'], SLICK: ['drop', 'blob'],
  SPIT: ['blob', 'drop'], RIPTIDE: ['wave', 'rush'], EDDY: ['spiral', 'wave'], WARD: ['shield', 'ring'], SHELL: ['shell', 'shield'], KELP: ['leaf', 'vine'],
  WEAVE: ['bricks', 'vine'], ROOT: ['vine', 'hand'], GRIP: ['hand', 'vine'], ACHOO: ['spores'], SPORE: ['spores', 'mushroom'], ANTLER: ['horn'], RUSH: ['rush', 'arrow'],
  FOREST: ['leaf', 'plus'], AIR: ['wind', 'plus'], BARK: ['armour', 'shield'], HIDE: ['shell', 'armour'], HONEY: ['honey'], SLAM: ['fist', 'burst'],
  HIBERNATE: ['sleep', 'plus'], VINE: ['vine'], LEASH: ['chain', 'tether'], POLLINATE: ['bee', 'spores'], HIVE: ['bee', 'honey'], CALL: ['sound', 'bee'],
  ICE: ['snow', 'gem', 'sheet', 'rock'], SLAB: ['bricks'], HAILBURST: ['snow', 'pebbles'], COLD: ['snow'], TETHER: ['tether', 'chain'], PRISM: ['gem', 'cage'], HALT: ['cage', 'clock'],
  RAM: ['horn', 'rush'], CHARGE: ['rush', 'arrow'], HOOF: ['hoof'], STAMP: ['hoof', 'burst'], BELLY: ['roll', 'rush'], SLIDE: ['rush', 'sheet'], FLOE: ['sheet'],
  BOULDER: ['rock', 'roll'], WAR: ['sound', 'crown'], ROAR: ['sound'], VOLT: ['bolt'], POUNCE: ['paw', 'rush'], STORM: ['bolt', 'twister', 'spiral'], HOWL: ['sound', 'moon'],
  WEB: ['web'], MINE: ['burst', 'web'], LIVE: ['bolt', 'wire'], WIRE: ['wire', 'bolt'], SEEKER: ['sparkle', 'arrow'], ZAPS: ['bolt', 'sparkle'], WALL: ['bricks', 'hand'],
  CLING: ['hand', 'bricks'], SPARK: ['sparkle', 'bolt'], THEFT: ['hand', 'sparkle'], CHAIN: ['chain', 'bolt'], CAPACITOR: ['bolt', 'armour'], EEL: ['wave', 'bolt'], DIVE: ['arrow', 'wave'],
  LINE: ['wire', 'bolt'], PEBBLE: ['pebbles'], RAIN: ['pebbles', 'drop'], HORN: ['horn'], TOSS: ['horn', 'arrow'], ROLL: ['roll'], OUT: ['roll'], DIG: ['dig'], IN: ['dig'],
  CRAG: ['mountain', 'rock'], LOB: ['rock'], AWAY: ['shell'], PULL: ['spiral', 'rune'], RUNE: ['rune'], STONE: ['eye', 'rock'], GAZE: ['eye'], QUILL: ['spines', 'needle'],
  GEODE: ['gem', 'shell'], CURL: ['shell', 'roll'], DUST: ['twister', 'spores', 'sleep'], DEVIL: ['twister'], SLEEP: ['sleep'], CUTTER: ['scythe', 'wind'], SIDESTEP: ['blink', 'hops'],
  GUST: ['wind'], KICK: ['boot'], TRIPLE: ['hops'], HOP: ['hops'], MIRAGE: ['twins', 'mirror'], UPDRAFT: ['wing', 'wind'], BOMB: ['burst', 'arrow'], TAILWIND: ['wind', 'rush'],
  MIRE: ['blob', 'drop'], GLOB: ['blob'], COIL: ['spiral', 'ring'], SNAP: ['jaws'], ECHO: ['sound'], SHRIEK: ['sound'], HIT: ['fist', 'rush'], RUN: ['rush', 'hops'],
  MYCELIUM: ['web', 'spores'], ILL: ['skull', 'bird'], OMEN: ['bird', 'skull'], CROW: ['bird'], MURDER: ['bird', 'skull'], SHADOW: ['shadow'], STEP: ['blink', 'hops'],
  PIN: ['paw', 'needle'], PHASE: ['ghost', 'blink'], SOUL: ['ghost'], SIPHON: ['ghost', 'heart'], PIERCE: ['eye', 'needle'], HUSH: ['wing', 'moon'], BOOMER: ['blob', 'roll'],
  BRIGHT: ['sun', 'sparkle'], DANGLE: ['lure'], LURE: ['lure'], DEEP: ['eye', 'wave'], BEAM: ['sun', 'sparkle'], BEACON: ['lantern'], DAZZLE: ['sparkle', 'sun'],
  STAR: ['star'], COMET: ['meteor', 'star'], TRAIL: ['meteor', 'rush'], PHANTOM: ['ghost', 'blink'], BLINK: ['blink'], RAISE: ['hand', 'skull'], HUSKS: ['skull', 'ghost'],
  METEOR: ['meteor'], FALL: ['meteor'], HALO: ['ring', 'cage'], PRISON: ['cage'], 'TRI-BREATH': ['breath', 'head'], REGROW: ['head', 'plus'], HEAD: ['head'], FIELD: ['web', 'spines'],
  BROOD: ['clock', 'bee'], CLOCK: ['clock'], ERUPTION: ['burst', 'vine'], DEVOUR: ['maw'], WALKING: ['bolt', 'hops'], BOLTS: ['bolt'], EYE: ['spiral', 'eye'], OF: [],
  SURFACE: ['wave', 'arrow'], STRIKE: ['arrow', 'burst'], 'CAVE-IN': ['mountain', 'rock'], RIDDLE: ['mirror'], MIRROR: ['mirror'], TENTACLE: ['tentacle'], WAVES: ['tentacle', 'wave'],
  INK: ['splat', 'drop'], BLACKOUT: ['splat', 'shadow'], QUAKE: ['mountain', 'burst'], RINGS: ['ring'], GLACIER: ['snow', 'sheet'], DRIFT: ['snow', 'wind'],
  // the everyday attacks
  BUTT: ['horn'], ARC: ['needle'], NEEDLE: ['needle'], BEAK: ['beak'], JAB: ['beak', 'fist'], BILE: ['venom', 'blob'], POP: ['bubble'], CAP: ['mushroom'], BONK: ['mushroom', 'fist'],
  CHILL: ['snow'], TOUCH: ['hand', 'snow'], CLAW: ['claw'], SWIPE: ['claw'], EAR: ['ear'], FANG: ['jaws'], BITE: ['jaws'], FIN: ['fin'], SLAP: ['fin', 'wing'], FIST: ['fist'],
  FLICKER: ['sparkle'], FROST: ['snow', 'breath'], BREATH: ['breath'], GLINT: ['gem', 'needle'], DART: ['needle', 'arrow'], GLOW: ['sparkle', 'sun'], GRAVE: ['skull', 'ghost'],
  LIGHT: ['lantern', 'sun'], GRAVEL: ['pebbles'], SPRAY: ['pebbles', 'spores'], GRIT: ['pebbles'], FLICK: ['tail', 'needle'], HIND: ['boot'], SHARD: ['gem', 'needle'],
  JET: ['drop', 'wave'], LUMEN: ['sun', 'sparkle'], BUMP: ['lure', 'fist'], MANDIBLES: ['pincer', 'jaws'], NIGHT: ['moon', 'claw'], OOZE: ['blob'], PAW: ['paw'], MAUL: ['paw', 'claw'],
  PECK: ['beak'], PINCER: ['pincer'], NIP: ['pincer', 'jaws'], QUICK: ['rush'], SCYTHE: ['scythe'], CUT: ['scythe', 'sword'], SEED: ['seed'], SHOT: ['seed', 'arrow'],
  VOLLEY: ['seed', 'spores'], SHOCK: ['bolt'], SLOW: ['clock', 'claw'], SNOUT: ['drop'], SONIC: ['sound'], SQUALL: ['wind', 'drop'], TALON: ['claw', 'bird'], RAKE: ['claw'],
  THORN: ['spines', 'vine'], TUSK: ['tusk'], GORE: ['tusk'], WATER: ['drop'], WING: ['wing'], ZAP: ['bolt'], TAIL: ['tail'],
};

/** What each kind of move falls back to when none of its words is in WORDS. */
const KIND_GLYPH: Record<string, string> = {
  bolt: 'arrow', spread: 'spores', nova: 'burst', dash: 'rush', beam: 'sword', mine: 'burst', shield: 'shield', blink: 'blink', arc: 'rock', mend: 'plus', aura: 'ring', snare: 'chain', wall: 'bricks',
};

/**
 * WHAT KIND OF MOVE IT IS, as a three-pixel badge in the icon's corner: an
 * arrow for a shot, a fan for a spread, a plus for a mend, a box for an aura.
 * The glyph says what the move IS and the badge what it DOES, and the two
 * together are what no two abilities share.
 */
const BADGE: Record<string, readonly string[]> = {
  bolt: ['..#', '###', '..#'],
  spread: ['#..', '.##', '#..'],
  nova: ['#.#', '.#.', '#.#'],
  dash: ['##.', '.##', '##.'],
  beam: ['...', '###', '...'],
  mine: ['.#.', '#.#', '.#.'],
  shield: ['###', '###', '.#.'],
  blink: ['#.#', '...', '#.#'],
  arc: ['.#.', '#.#', '#.#'],
  mend: ['.#.', '###', '.#.'],
  aura: ['###', '#.#', '###'],
  snare: ['#.#', '.#.', '.#.'],
  wall: ['#.#', '###', '#.#'],
};

/** The corner markers that keep two abilities on one glyph and badge apart. */
const MARKS: Array<Array<[number, number]>> = [[], [[6, 0]], [[0, 0]], [[6, 6]], [[0, 6]], [[6, 0], [0, 6]], [[0, 0], [6, 6]]];

const ASSIGNED = new Map<string, { glyph: string; mark: number }>();
const TAKEN = new Set<string>();

/**
 * The icon for one ability, by its name (which is unique across the roster).
 * First come, first served, in the order the roster is read: every ability
 * takes the first glyph its words offer that nobody has, and failing that
 * the first glyph-and-marker pair nobody has.
 */
export function assign(name: string, kind: string): { glyph: string; mark: number } {
  const had = ASSIGNED.get(name);
  if (had) return had;
  const words = name.toUpperCase().split(' ');
  const options: string[] = [];
  for (const w of words) for (const g of WORDS[w] ?? []) if (!options.includes(g)) options.push(g);
  const fallback = KIND_GLYPH[kind] ?? 'burst';
  if (!options.includes(fallback)) options.push(fallback);
  let pick: { glyph: string; mark: number } | null = null;
  // a glyph nobody has; then one nobody of THIS kind has (the badge tells
  // them apart); and only then a marker
  for (const g of options) if (![...TAKEN].some((t) => t.startsWith(`${g}:`))) {
    pick = { glyph: g, mark: 0 };
    break;
  }
  for (let m = 0; !pick && m < MARKS.length; m++) for (const g of options) if (!TAKEN.has(`${g}:${kind}:${m}`)) {
    pick = { glyph: g, mark: m };
    break;
  }
  pick ??= { glyph: options[0], mark: 0 };
  TAKEN.add(`${pick.glyph}:${kind}:${pick.mark}`);
  ASSIGNED.set(name, pick);
  return pick;
}

/** Fix every assignment up front, in roster order, so they never depend on what was drawn first. */
export function assignAll(moves: Array<{ name: string; kind: string }>): void {
  for (const m of moves) assign(m.name, m.kind);
}

/** The ability's icon, seven pixels square, centred on (x, y). */
export function drawAbilityIcon(g: Phaser.GameObjects.Graphics, move: { name: string; kind: string }, x: number, y: number, col: number): void {
  const { glyph, mark } = assign(move.name, move.kind);
  const rows = G[glyph] ?? G.burst;
  const dark = shade(col, 0.55);
  const ox = Math.round(x) - 3;
  const oy = Math.round(y) - 3;
  rows.forEach((row, ry) => {
    for (let rx = 0; rx < row.length; rx++) {
      const ch = row[rx];
      if (ch === '.') continue;
      g.fillStyle(ch === 'o' ? dark : col, 1).fillRect(ox + rx, oy + ry, 1, 1);
    }
  });
  for (const [mx, my] of MARKS[mark] ?? []) g.fillStyle(0xffffff, 1).fillRect(ox + mx, oy + my, 1, 1);
  // the kind badge, bottom right, on a dark backing so it reads over the glyph
  const badge = BADGE[move.kind];
  if (badge) {
    const bx = ox + 5;
    const by = oy + 5;
    g.fillStyle(0x0a0a14, 1).fillRect(bx - 1, by - 1, 5, 5);
    badge.forEach((row, ry) => {
      for (let rx = 0; rx < 3; rx++) if (row[rx] === '#') g.fillStyle(0xffffff, 0.95).fillRect(bx + rx, by + ry, 1, 1);
    });
  }
}

function shade(c: number, k: number): number {
  return (Math.round(((c >> 16) & 255) * k) << 16) | (Math.round(((c >> 8) & 255) * k) << 8) | Math.round((c & 255) * k);
}

/** DEV: every glyph is seven by seven, and no two abilities came out the same. */
export function checkIcons(moves: Array<{ name: string; kind: string }>): string[] {
  const bad: string[] = [];
  for (const [k, rows] of Object.entries(G)) if (rows.length !== 7 || rows.some((r) => r.length !== 7)) bad.push(`glyph ${k} is not 7x7`);
  const seen = new Map<string, string>();
  for (const m of moves) {
    const a = assign(m.name, m.kind);
    const key = `${a.glyph}:${m.kind}:${a.mark}`;
    const was = seen.get(key);
    if (was && was !== m.name) bad.push(`${m.name} and ${was} share ${key}`);
    seen.set(key, m.name);
  }
  return bad;
}
