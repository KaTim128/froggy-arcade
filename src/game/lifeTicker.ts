/**
 * The game clock's heartbeat: a second of LIFE time for every second the game
 * is open, in front of the player, and somewhere ordinary -- the arcade, the
 * street, the condo, a cabinet.  Not during the night's horror, not under the
 * pause menu, not on the title screen: those are not time spent living here.
 */

import type Phaser from 'phaser';
import { store } from '../core/state';
import { DAY_SECONDS, refreshGoals, tick } from './life';

/** Where the clock runs. */
export const LIFE_SCENES = new Set([
  'ArcadeHub', 'ArcadeAnnex', 'ArcadeCasino', 'ArcadeLounge', 'CraneGame', 'PrizeCounter', 'PrizeExchange', 'ChangeMachine',
  'ExteriorDay', 'StreetWest', 'StreetEast', 'Condo', 'FurnitureStore', 'ClothesStore', 'BarberShop', 'Shop', 'Goals', 'Minigame', 'Hotel', 'CreatureHub', 'CreatureArena', 'InventoryModal',
]);

/**
 * ONE GAME MINUTE AT A TIME.  A game day is DAY_SECONDS of real time for
 * 1440 minutes on the clock, so a real second is 1.2 minutes.  The clock used
 * to tick a whole real second at once, and 1.2 minutes floored shows 0, 1, 2,
 * 3, 4 -- then 6: every fifth minute was never on the wall.  Now the real time
 * that passes is banked, from the browser's own clock (so a slow or skipped
 * timer neither loses nor doubles any), and paid out one minute's worth at a
 * time.
 */
const MINUTE_S = DAY_SECONDS / (24 * 60);

let installed = false;

export function installLifeTicker(game: Phaser.Game): void {
  // (once: a second copy -- a hot reload -- would run the clock double speed)
  if (installed) return;
  installed = true;
  let last = performance.now();
  let banked = 0;
  window.setInterval(() => {
    const now = performance.now();
    // at most a few seconds' worth at once: a tab coming back from the
    // background does not fast-forward the day
    const dt = Math.min(5, (now - last) / 1000);
    last = now;
    if (document.visibilityState !== 'visible' || !store.activeSlotId()) return;
    const s = store.get();
    if (!s.seenIntro) return;
    const running = game.scene.getScenes(true).map((x) => x.scene.key);
    if (running.includes('SettingsModal')) return;
    // (the night story keeps its own time)
    if (s.timeOfDay === 'midnight' || s.route !== 'normal') return;
    if (!running.some((k) => LIFE_SCENES.has(k))) return;
    banked += dt;
    while (banked >= MINUTE_S) {
      banked -= MINUTE_S;
      tick(MINUTE_S);
    }
  }, 200);
  refreshGoals();
  // and the goals roll over at midnight, real time
  window.setInterval(() => refreshGoals(), 60_000);
}
