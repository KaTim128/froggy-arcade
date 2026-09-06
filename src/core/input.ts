/**
 * Input map.  PRD §6.7 / QFD B6.
 *
 * IN-1: no binding appears anywhere else in the codebase.  The in-game controls
 * manual is RENDERED FROM THIS OBJECT (PRD §7.3), so it can never drift.
 */

export interface Binding {
  action: string;
  /** Keycap labels, drawn as pixel keycaps in the manual. */
  keys: string[];
  context: string;
}

export const BINDINGS: Binding[] = [
  { action: 'Move', keys: ['W', 'A', 'S', 'D'], context: 'Arcade / chase' },
  { action: 'Move (alt)', keys: ['↑', '←', '↓', '→'], context: 'Arcade / chase' },
  { action: 'Interact / select', keys: ['E', 'CLICK'], context: 'Arcade' },
  { action: 'Basketball shot (hold)', keys: ['SPACE'], context: 'Hoops' },
  { action: 'Fighter move / jump / crouch', keys: ['A', 'D', 'W', 'S'], context: 'Grudge' },
  { action: 'Fighter punch / kick / block', keys: ['J', 'K', 'L'], context: 'Grudge' },
  { action: 'Fighter special', keys: ['I'], context: 'Grudge' },
  { action: 'Chomp-Man movement', keys: ['↑', '←', '↓', '→'], context: 'Chomp-Man' },
  { action: 'Advance basement image', keys: ['CLICK'], context: 'Basement' },
  { action: 'Pause / back / quit', keys: ['ESC'], context: 'Everywhere' },
];

/** Phaser key codes, referenced by scenes. */
export const KEYS = {
  up: ['W', 'UP'],
  down: ['S', 'DOWN'],
  left: ['A', 'LEFT'],
  right: ['D', 'RIGHT'],
  interact: ['E'],
  charge: ['SPACE'],
  punch: ['J'],
  kick: ['K'],
  block: ['L'],
  special: ['I'],
  quit: ['ESC'],
  debug: ['BACKTICK'],
} as const;
