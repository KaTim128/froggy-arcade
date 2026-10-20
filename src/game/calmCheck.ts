/**
 * STAYING CALM: the skill checks you do to keep quiet while you hide.
 *
 * One gauge, five ways of playing it.  The bar is red all along, with a
 * yellow band and a green one inside it; you stop, release or press when the
 * marker is in the band, and how close to the middle decides how well it
 * went.  Harder (later, or with him close) means a faster marker and smaller
 * bands.  Pure logic -- the scene draws it and feeds it the key.
 */

export type CheckKind = 'marker' | 'breath' | 'hold' | 'pulse' | 'react';
export type CheckResult = 'perfect' | 'success' | 'fail' | 'critical';

export interface CalmCheck {
  kind: CheckKind;
  /** Seconds since it came up. */
  t: number;
  /** Seconds before doing nothing counts as failing it. */
  dur: number;
  speed: number;
  /** The bands, as [from, to] along the bar (0..1). */
  green: [number, number];
  yellow: [number, number];
  /** Where the marker is (0..1). */
  pos: number;
  holding: boolean;
  /** `react`: when the prompt fires, and whether it has. */
  goAt: number;
  result: CheckResult | null;
}

export const CHECK_TITLE: Record<CheckKind, string> = {
  marker: 'STEADY YOURSELF',
  breath: 'CONTROL YOUR BREATHING',
  hold: 'HOLD YOUR BREATH',
  pulse: 'SLOW YOUR HEART',
  react: 'DO NOT FLINCH',
};

/**
 * What to do, in two short lines that fit under the bar: what the bar is
 * doing, then what you do about it.  `act` is the key or the button's name.
 * (`checkLive` is the line that replaces the second one while it is playing.)
 */
export function checkHow(kind: CheckKind, act: string): [string, string] {
  switch (kind) {
    case 'hold':
      return [`HOLD ${act} TO FILL THE BAR`, 'LET GO IN THE GREEN'];
    case 'react':
      return ['WAIT FOR IT TO GO GREEN', `THEN PRESS ${act} AT ONCE`];
    case 'pulse':
      return ['YOUR HEART SWEEPS ACROSS', `PRESS ${act} IN THE GREEN`];
    case 'breath':
      return ['BREATH RISES AND FALLS', `PRESS ${act} IN THE GREEN`];
    default:
      return ['THE LINE SWINGS ACROSS', `PRESS ${act} IN THE GREEN`];
  }
}

/**
 * What the check says right now, as it plays: NOW when the line is in the
 * green (or the bar has gone green), WAIT before it has, HOLDING while the
 * key is down on a hold.  Null when there is nothing live to say.
 */
export function checkLive(c: CalmCheck): { text: string; good: boolean } | null {
  if (c.result) return null;
  if (c.kind === 'react') return c.pos >= 1 ? { text: 'NOW!', good: true } : { text: 'WAIT...', good: false };
  const inGreen = c.pos >= c.green[0] && c.pos <= c.green[1];
  if (c.kind === 'hold') {
    if (!c.holding) return c.pos > 0 ? null : { text: 'HOLD IT DOWN', good: false };
    return inGreen ? { text: 'LET GO NOW!', good: true } : { text: 'HOLDING...', good: false };
  }
  return inGreen ? { text: 'NOW!', good: true } : null;
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/**
 * A new check.  `hard` 0..1 is how long you have been hiding and how close
 * he is; `near` shrinks the green on top of that.
 */
export function newCheck(hard: number, near: boolean, rnd: () => number = Math.random): CalmCheck {
  const kinds: CheckKind[] = ['marker', 'breath', 'hold', 'pulse', 'react'];
  const kind = kinds[Math.floor(rnd() * kinds.length)];
  const h = Math.max(0, Math.min(1, hard));
  const gw = lerp(0.16, 0.06, h) * (near ? 0.7 : 1);
  const yw = gw + lerp(0.24, 0.12, h);
  const mid = kind === 'hold' ? lerp(0.55, 0.8, rnd()) : kind === 'react' ? 0.5 : lerp(0.25, 0.75, rnd());
  return {
    kind,
    t: 0,
    dur: kind === 'react' ? 3 : kind === 'hold' ? 5 : 4,
    speed: lerp(0.7, 1.6, h) * (kind === 'breath' ? 0.45 : kind === 'hold' ? 0.38 : kind === 'pulse' ? 0.8 : 1),
    green: [mid - gw / 2, mid + gw / 2],
    yellow: [mid - yw / 2, mid + yw / 2],
    pos: 0,
    holding: false,
    goAt: kind === 'react' ? lerp(0.6, 1.8, rnd()) : 0,
    result: null,
  };
}

function judge(c: CalmCheck, at: number): CheckResult {
  if (at >= c.green[0] && at <= c.green[1]) return 'perfect';
  if (at >= c.yellow[0] && at <= c.yellow[1]) return 'success';
  return 'fail';
}

/** Move it on.  Returns a result if it ended on its own (ran out, or burst). */
export function stepCheck(c: CalmCheck, dt: number): CheckResult | null {
  if (c.result) return null;
  c.t += dt;
  switch (c.kind) {
    case 'marker': {
      const p = (c.t * c.speed) % 2;
      c.pos = p < 1 ? p : 2 - p;
      break;
    }
    case 'breath':
      c.pos = 0.5 - 0.5 * Math.cos(c.t * c.speed * Math.PI);
      break;
    case 'hold':
      if (c.holding) {
        c.pos = Math.min(1, c.pos + dt * c.speed);
        // held too long: the breath bursts out of you
        if (c.pos >= 1) return (c.result = 'critical');
      }
      break;
    case 'pulse':
      c.pos = (c.t * c.speed) % 1;
      break;
    case 'react':
      c.pos = c.t >= c.goAt ? 1 : 0;
      break;
  }
  if (c.t >= c.dur && !c.holding) return (c.result = 'fail');
  return null;
}

/** The key went down. */
export function pressCheck(c: CalmCheck): CheckResult | null {
  if (c.result) return null;
  if (c.kind === 'hold') {
    c.holding = true;
    return null;
  }
  if (c.kind === 'react') {
    if (c.t < c.goAt) return (c.result = 'fail');
    const r = c.t - c.goAt;
    return (c.result = r < 0.35 ? 'perfect' : r < 0.7 ? 'success' : 'fail');
  }
  return (c.result = judge(c, c.pos));
}

/** The key came up (only `hold` cares). */
export function releaseCheck(c: CalmCheck): CheckResult | null {
  if (c.result || c.kind !== 'hold' || !c.holding) return null;
  c.holding = false;
  return (c.result = judge(c, c.pos));
}
