/**
 * Distances and times as players read them, for every line of Creature
 * Clash text a player sees.
 */

/** One TILE, the length players read distances in: about a creature's width (log #60: TILE, not STEP). */
const TILE_PX = 14;

/**
 * PLAIN WORDS.  The numbers underneath are in pixels and seconds, which is
 * how the arena counts them, not how anyone playing does: "A 68PX BLINK"
 * says nothing.  On the card, a distance is in TILES (a creature's width,
 * so 5 TILES is five of them side by side) and a time in SEC.
 */
export function plainWords(line: string): string {
  const tiles = (px: string): number => Math.max(1, Math.round(Number(px) / TILE_PX));
  return (
    line
      // "A 44PX RING", "AN 80PX DASH": a 3-TILE RING, a 6-TILE DASH
      .replace(/\bAN? (\d+)PX (?=[A-Z])/g, (_m, px: string) => `A ${tiles(px)}-TILE `)
      // "UP TO 64PX AWAY": UP TO 5 TILES AWAY
      .replace(/(\d+)PX\b/g, (_m, px: string) => {
        const n = tiles(px);
        return `${n} TILE${n === 1 ? '' : 'S'}`;
      })
      // "FOR 3S", "0.5S": FOR 3 SEC, 0.5 SEC
      .replace(/(\d+(?:\.\d+)?)S\b/g, '$1 SEC')
  );
}
