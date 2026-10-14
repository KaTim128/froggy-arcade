/**
 * The game clock's heartbeat: a second of LIFE time for every second the game
 * is open, in front of the player, and somewhere ordinary -- the arcade, the
 * street, the condo, a cabinet.  Not during the night's horror, not under the
 * pause menu, not on the title screen: those are not time spent living here.
 */

import type Phaser from 'phaser';
import { store } from '../core/state';
import { refreshGoals, tick } from './life';

/** Where the clock runs. */
export const LIFE_SCENES = new Set([
  'ArcadeHub', 'ArcadeAnnex', 'ArcadeCasino', 'ArcadeLounge', 'CraneGame', 'PrizeCounter', 'PrizeExchange', 'ChangeMachine',
  'ExteriorDay', 'StreetWest', 'StreetEast', 'Condo', 'FurnitureStore', 'ClothesStore', 'BarberShop', 'Shop', 'Goals', 'Minigame', 'Hotel', 'CreatureHub', 'CreatureArena', 'InventoryModal',
]);

export function installLifeTicker(game: Phaser.Game): void {
  window.setInterval(() => {
    if (document.visibilityState !== 'visible' || !store.activeSlotId()) return;
    const s = store.get();
    if (!s.seenIntro) return;
    const running = game.scene.getScenes(true).map((x) => x.scene.key);
    if (running.includes('SettingsModal')) return;
    // (the night story keeps its own time)
    if (s.timeOfDay === 'midnight' || s.route !== 'normal') return;
    if (!running.some((k) => LIFE_SCENES.has(k))) return;
    tick(1);
  }, 1000);
  refreshGoals();
  // and the goals roll over at midnight, real time
  window.setInterval(() => refreshGoals(), 60_000);
}
