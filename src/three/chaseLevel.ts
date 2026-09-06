/**
 * The chase level.  PRD §7.15 / QFD C8.
 *
 * A grid, extruded.  Using a grid rather than hand-placed geometry buys two
 * things that matter: walls that cannot have gaps, and a pursuit AI that can
 * actually pathfind instead of walking into corners.
 *
 * The layout is a serpentine reversal of the basement corridors with two
 * dead-end forks that look exactly like the correct turn (PRD CH-4: the danger
 * is navigation, not speed — Froggy is half as fast and can never catch a
 * player who knows the way).
 */

export const CELL = 3; // metres
export const COLS = 13;
export const ROWS = 15;

/** '#' wall, '.' floor, 'S' start, 'E' the stairs up. */
function buildGrid(): string[][] {
  const g: string[][] = Array.from({ length: ROWS }, () => Array<string>(COLS).fill('#'));

  const openRow = (r: number, c0: number, c1: number) => {
    for (let c = c0; c <= c1; c++) g[r][c] = '.';
  };
  const openCol = (c: number, r0: number, r1: number) => {
    for (let r = r0; r <= r1; r++) g[r][c] = '.';
  };

  // Four long runs, linked alternately at the right and left ends.  Three wall
  // rows between each pair, which is what leaves room for a fork to dead-end
  // instead of accidentally becoming a shortcut.
  openRow(1, 1, 11);
  openCol(11, 1, 5);
  openRow(5, 1, 11);
  openCol(1, 5, 9);
  openRow(9, 1, 11);
  openCol(11, 9, 13);
  openRow(13, 1, 11);

  // Two dead ends.  Each sits at a junction that reads exactly like the way on,
  // and each stops one cell short of the next corridor — they must NOT connect
  // anything, or they stop being traps and become shortcuts.
  openCol(4, 2, 3);
  openCol(8, 10, 11);

  g[1][1] = 'S';
  g[13][1] = 'E';
  return g;
}

export const GRID = buildGrid();

export const isWall = (col: number, row: number): boolean =>
  col < 0 || row < 0 || col >= COLS || row >= ROWS || GRID[row][col] === '#';

export function findCell(ch: string): { col: number; row: number } {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) if (GRID[r][c] === ch) return { col: c, row: r };
  }
  return { col: 1, row: 1 };
}

export const worldX = (col: number) => (col - (COLS - 1) / 2) * CELL;
export const worldZ = (row: number) => (row - (ROWS - 1) / 2) * CELL;
export const cellOf = (x: number, z: number) => ({
  col: Math.round(x / CELL + (COLS - 1) / 2),
  row: Math.round(z / CELL + (ROWS - 1) / 2),
});

/**
 * Breadth-first search across the grid.  Froggy pathfinds directly toward the
 * player and never stops (CH-1) — no teleporting, no shortcuts, no rubber
 * banding.  He is simply always coming.
 */
export function nextStepToward(
  from: { col: number; row: number },
  to: { col: number; row: number },
): { col: number; row: number } | null {
  if (from.col === to.col && from.row === to.row) return null;

  const key = (c: number, r: number) => r * COLS + c;
  const prev = new Map<number, number>();
  const seen = new Set<number>([key(from.col, from.row)]);
  const queue: Array<{ col: number; row: number }> = [from];

  while (queue.length) {
    const cur = queue.shift()!;
    if (cur.col === to.col && cur.row === to.row) {
      // walk the chain back to the first step out of `from`
      let k = key(cur.col, cur.row);
      let step = cur;
      while (prev.has(k)) {
        const pk = prev.get(k)!;
        if (pk === key(from.col, from.row)) return step;
        step = { col: pk % COLS, row: Math.floor(pk / COLS) };
        k = pk;
      }
      return step;
    }
    for (const [dc, dr] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nc = cur.col + dc;
      const nr = cur.row + dr;
      if (isWall(nc, nr)) continue;
      const nk = key(nc, nr);
      if (seen.has(nk)) continue;
      seen.add(nk);
      prev.set(nk, key(cur.col, cur.row));
      queue.push({ col: nc, row: nr });
    }
  }
  return null;
}

/** Optimal route length in metres — used to sanity-check the 90s budget. */
export function optimalRouteLength(): number {
  const start = findCell('S');
  const end = findCell('E');
  let cur = start;
  let steps = 0;
  while (steps < 500) {
    const next = nextStepToward(cur, end);
    if (!next) break;
    cur = next;
    steps++;
  }
  return steps * CELL;
}
