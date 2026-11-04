/**
 * ---- WHAT A CREATURE IS GOOD AND BAD AT, IN FULL (user, 3 Nov: "more
 * detailed, clear spacing").
 *
 * The roster's own one-liners (`strong` / `weak`) come first, then what its
 * numbers and moves actually say about it, measured against the rest of the
 * roster: how much health and speed it has, how hard its plain attack hits,
 * how far it reaches, and whether its two specials let it heal, block,
 * escape, hold you down or hit through cover.  Each point is one short line
 * with the number in it, so the STATS page can list them as bullets.
 */

import { TILE_PX } from './plainWords';
import { CREATURES, ELEMENTS, type Attack, type Creature } from './creatures';
import { SPECIALS } from './specials';

/** Where `v` sits in the roster's spread of `of`: 0 the lowest, 1 the highest. */
function rank(v: number, of: (c: Creature) => number): number {
  const all = CREATURES.map(of).sort((a, b) => a - b);
  const below = all.filter((x) => x < v).length;
  return all.length > 1 ? below / (all.length - 1) : 0.5;
}

const tiles = (px: number): number => Math.max(1, Math.round(px / TILE_PX));
const dps = (a: Attack): number => a.dmg / Math.max(0.1, a.cd);

/** What its specials can do, by what they are and what they say. */
function kit(c: Creature): Record<'heal' | 'block' | 'escape' | 'control' | 'pierce' | 'trap' | 'buff' | 'debuff' | 'area', boolean> {
  const sp = c.attacks.slice(1);
  const txt = sp.map((a) => `${SPECIALS[a.sp ?? '']?.desc ?? ''}`).join(' ');
  const has = (re: RegExp): boolean => re.test(txt);
  return {
    heal: sp.some((a) => a.kind === 'mend' || ['regen', 'drain'].includes(a.mod)) || has(/HEALS|GETS BACK|DRAINS/),
    block: sp.some((a) => a.kind === 'shield' || ['guard', 'reflect', 'thorns'].includes(a.mod)) || has(/BLOCK|IMMUNE|LESS DAMAGE|SOAK/),
    escape: sp.some((a) => a.kind === 'blink' || a.sp === 'hit_and_run' || a.sp === 'sucker_punch') || has(/INVISIBLE|VANISH|UNTARGETABLE|AWAY/),
    control: sp.some((a) => a.kind === 'snare' || ['root', 'stagger', 'chill', 'silence', 'pull'].includes(a.mod)) || has(/HOLD|STUN|SLEEP|FREEZE|PIN|TRAP|SLOW|BLIND/),
    pierce: sp.some((a) => a.mod === 'drill' || a.mod === 'bounce' || a.kind === 'arc') || c.element === 'glow' || has(/THROUGH COVER|OVER COVER/),
    trap: sp.some((a) => a.kind === 'mine'),
    buff: sp.some((a) => a.kind === 'aura' || ['haste', 'fury', 'focus', 'quicken', 'evade'].includes(a.mod)),
    debuff: sp.some((a) => ['weaken', 'shred', 'mark', 'poison'].includes(a.mod)) || has(/POISON|LESS DAMAGE FOR|MORE DAMAGE|CURSE|MARK/),
    area: sp.some((a) => a.kind === 'nova' || a.kind === 'spread') || has(/RING|ALL ROUND|EVERY DIRECTION/),
  };
}

export interface Traits {
  strengths: string[];
  weaknesses: string[];
  /** Melee or ranged, with its reach. */
  style: string;
  /** Its element's effect, in a line. */
  element: string;
}

export function traitsOf(c: Creature): Traits {
  const n = c.attacks[0];
  const melee = (n.kind === 'beam' && n.reach < 50) || n.kind === 'dash';
  const k = kit(c);
  const hp = rank(c.hp, (x) => x.hp);
  const spd = rank(c.speed, (x) => x.speed);
  const hit = rank(dps(n), (x) => dps(x.attacks[0]));
  const s: string[] = [c.strong];
  const w: string[] = [c.weak];
  // its body
  if (hp >= 0.7) s.push(`TOUGH: ${c.hp} HP, MORE THAN MOST`);
  else if (hp <= 0.3) w.push(`FRAGILE: ONLY ${c.hp} HP`);
  if (spd >= 0.7) s.push(`QUICK: SPEED ${c.speed}, HARD TO CATCH`);
  else if (spd <= 0.3) w.push(`SLOW: SPEED ${c.speed}, EASY TO KITE`);
  if (hit >= 0.7) s.push(`HARD PLAIN HITS: ${n.dmg} EVERY ${n.cd}S`);
  else if (hit <= 0.25) w.push(`LIGHT PLAIN HITS: ${n.dmg} EVERY ${n.cd}S`);
  // its reach
  if (melee) w.push('MUST GET CLOSE: NO REAL SHOT AT RANGE');
  else s.push(`HITS FROM ${tiles(n.reach)} TILES AWAY`);
  // what its specials give it, and what they leave out
  if (k.heal) s.push('CAN HEAL ITSELF MID-FIGHT');
  if (k.block) s.push('CAN BLOCK OR SOFTEN HITS');
  if (k.escape) s.push('HAS A WAY OUT WHEN CORNERED');
  else if (spd < 0.5) w.push('NO ESCAPE MOVE: STUCK IF CORNERED');
  if (k.control) s.push('CAN SLOW, HOLD OR STUN YOU');
  if (k.pierce) s.push('REACHES YOU BEHIND COVER');
  if (k.trap) s.push('LAYS TRAPS ON THE FLOOR');
  if (k.debuff) s.push('WEAKENS OR POISONS YOU');
  if (k.area) s.push('HITS AN AREA: HARD TO DODGE');
  if (!k.heal && !k.block && hp < 0.5) w.push('NO HEAL OR SHIELD TO SAVE IT');
  if (!k.control && !k.debuff && melee) w.push('NOTHING TO STOP YOU RUNNING AWAY');
  const el = ELEMENTS[c.element];
  return {
    strengths: [...new Set(s)].slice(0, 6),
    weaknesses: [...new Set(w)].slice(0, 5),
    style: melee ? `MELEE: FIGHTS UP CLOSE (${tiles(n.reach)} TILES)` : `RANGED: SHOTS UP TO ${tiles(n.reach)} TILES`,
    element: `${el.name}: ${el.effect}`,
  };
}
