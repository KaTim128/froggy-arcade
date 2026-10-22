/**
 * Distances and times as players read them, for every line of Creature
 * Clash text a player sees.
 */

/** One STEP, the length players read distances in: about a creature's width. */
const STEP_PX = 14;

/**
 * PLAIN WORDS.  The numbers underneath are in pixels and seconds, which is
 * how the arena counts them, not how anyone playing does: "A 68PX BLINK"
 * says nothing.  On the card, a distance is in STEPS (a creature's width,
 * so 5 STEPS is five of them side by side) and a time in SEC.
 */
export function plainWords(line: string): string {
  const steps = (px: string): number => Math.max(1, Math.round(Number(px) / STEP_PX));
  return (
    line
      // "A 44PX RING", "AN 80PX DASH": a 3-STEP RING, a 6-STEP DASH
      .replace(/\bAN? (\d+)PX (?=[A-Z])/g, (_m, px: string) => `A ${steps(px)}-STEP `)
      // "UP TO 64PX AWAY": UP TO 5 STEPS AWAY
      .replace(/(\d+)PX\b/g, (_m, px: string) => {
        const n = steps(px);
        return `${n} STEP${n === 1 ? '' : 'S'}`;
      })
      // "FOR 3S", "0.5S": FOR 3 SEC, 0.5 SEC
      .replace(/(\d+(?:\.\d+)?)S\b/g, '$1 SEC')
  );
}
