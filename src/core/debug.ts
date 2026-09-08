/**
 * Dev debug panel.  PRD §6.9 / DB-1 / QFD A6.
 *
 * Toggle with the backtick key.  Stripped from production by the __DEV__ define
 * in vite.config.ts.  You will use this constantly.
 */

import type Phaser from 'phaser';
import { store, type Route } from './state';
import { canEnter, SCENES } from './routes';
import { evaluateBroke } from './broke';
import { ledger } from './ledger';
import { audio } from './audio';

declare const __DEV__: boolean;

const JUMPABLE = [
  'Boot',
  'StartScreen',
  'IntroCutscene',
  'ArcadeHub',
  'FroggyCharity',
  'SecondBust',
  'EjectionCutscene',
  'ExteriorNight',
  'BackAlley',
  'ArcadeDark',
  'BasementSequence',
  'Chase3D',
  'OutroCutscene3D',
  'EndCard',
];

let game: Phaser.Game | null = null;
let panel: HTMLElement | null = null;
let open = false;
let refreshTimer: number | null = null;

export function initDebug(g: Phaser.Game): void {
  if (!__DEV__) return;
  game = g;
  panel = document.getElementById('debug-panel');
  if (!panel) return;

  // Dev bridge: lets the automated harness assert the real predicates rather
  // than a reimplementation of them.  Stripped from production with the panel.
  (window as unknown as Record<string, unknown>).__froggy = {
    state: () => JSON.parse(JSON.stringify(store.get())),
    audioSources: () => audio.sourceCount(),
    broke: () => evaluateBroke(),
    scenes: () => SCENES,
    canEnter: (scene: string, route: string, tokens = 0) =>
      canEnter(scene as never, { ...store.get(), route: route as Route, tokens }, { cost: 0 }),
    activeScenes: () => g.scene.getScenes(true).map((s) => s.scene.key),
    game: () => g,
    // Same setter `?tokens=` uses, for tests that need to change a balance
    // mid-session rather than at load.
    setTokens: (n: number) => ledger.debugSet(n),
  };

  applyLaunchParams(g);

  window.addEventListener('keydown', (e) => {
    if (e.key === '`' || e.code === 'Backquote') {
      e.preventDefault();
      toggle();
    }
  });
  render();
}

/**
 * Dev-only deep links, the debug panel's URL equivalent (PRD DB-1):
 *   ?scene=BasementSequence   jump straight to a scene
 *   ?game=chompman            jump straight into a cabinet
 *   ?tokens=200&route=ejected&key=1   set state first
 * Used by the automated harness so each piece can be verified on its own.
 */
function applyLaunchParams(g: Phaser.Game): void {
  const q = new URLSearchParams(location.search);
  if (![...q.keys()].length) return;

  const tokens = q.get('tokens');
  if (tokens !== null) ledger.debugSet(Number(tokens));
  const route = q.get('route');
  if (route) store.patch({ route: route as Route });
  if (q.get('key') === '1') store.patch({ hasKey: true });
  const hideRoom = q.get('hideRoom');
  if (hideRoom !== null) store.patch({ hideRoom: Math.max(0, Number(hideRoom) | 0) });
  if (q.get('intro') === '1') store.patch({ seenIntro: true });
  if (q.get('charity') === '1') store.patch({ charityUsed: true });

  const game = q.get('game');
  const scene = q.get('scene');
  if (!game && !scene) return;

  window.setTimeout(() => {
    for (const s of g.scene.getScenes(true)) s.scene.stop();
    if (game) g.scene.start('Minigame', { id: game });
    else if (scene && g.scene.getScene(scene)) g.scene.start(scene);
  }, 350);
}

function toggle(): void {
  if (!panel) return;
  open = !open;
  panel.style.display = open ? 'block' : 'none';
  if (open) {
    render();
    refreshTimer = window.setInterval(render, 500);
  } else if (refreshTimer !== null) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

function jump(scene: string): void {
  if (!game) return;
  for (const s of game.scene.getScenes(true)) s.scene.stop();
  if (game.scene.getScene(scene)) game.scene.start(scene);
  else console.warn(`[debug] scene "${scene}" does not exist yet`);
}

function render(): void {
  if (!panel || !open) return;
  const s = store.get();

  panel.innerHTML = `
    <h3>Froggy Arcade — debug</h3>
    <div class="row"><span class="dim">tokens</span>
      <input id="dbg-tokens" type="number" value="${s.tokens}" />
      <button data-act="set-tokens">set</button></div>
    <div class="row">
      <button data-tok="0">0</button>
      <button data-tok="1">1</button>
      <button data-tok="5">5</button>
      <button data-tok="20">20</button>
      <button data-tok="200">200</button>
      <button data-tok="750">750</button>
    </div>
    <div class="row"><span class="dim">route</span>
      <select id="dbg-route">
        ${(['normal', 'ejected', 'basement', 'chase', 'ended'] as Route[])
          .map((r) => `<option value="${r}" ${r === s.route ? 'selected' : ''}>${r}</option>`)
          .join('')}
      </select></div>
    <div class="row">
      <button data-flag="charityUsed">charityUsed: ${s.charityUsed}</button>
    </div>
    <div class="row">
      <button data-flag="hasKey">hasKey: ${s.hasKey}</button>
      <button data-flag="seenIntro">seenIntro: ${s.seenIntro}</button>
    </div>
    <div class="row dim">prizes: ${s.prizesOwned.length ? s.prizesOwned.join(', ') : '—'}</div>
    <h3>audio</h3>
    <div class="row dim">sustained sources: <b style="color:${audio.sourceCount() === 0 ? '#3fe39b' : '#ffb038'}">${audio.sourceCount()}</b></div>
    <div class="row dim">master ${s.settings.master} · music ${s.settings.music} · sfx ${s.settings.sfx}</div>
    <h3>jump to scene</h3>
    <div>${JUMPABLE.map((k) => `<button data-scene="${k}">${k}</button>`).join('')}</div>
    <h3>active minigame</h3>
    <div class="row">
      <button data-act="mg-win">force win</button>
      <button data-act="mg-lose">force lose</button>
      <span class="dim">${(window as unknown as Record<string, { id?: string }>).__minigame?.id ?? 'none'}</span>
    </div>
    <h3>run</h3>
    <div class="row">
      <button data-act="reset">reset run</button>
      <button data-act="dump">dump state</button>
    </div>
    <div class="row dim">backtick closes this panel</div>
  `;

  panel.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
    b.onclick = () => {
      const { scene, flag, tok, act } = b.dataset;
      if (scene) jump(scene);
      else if (flag) store.patch({ [flag]: !(s as unknown as Record<string, boolean>)[flag] } as never);
      else if (tok) ledger.debugSet(Number(tok));
      else if (act === 'set-tokens') {
        const el = document.getElementById('dbg-tokens') as HTMLInputElement | null;
        if (el) ledger.debugSet(Number(el.value));
      } else if (act === 'reset') {
        store.resetRun();
        jump('Boot');
      } else if (act === 'mg-win' || act === 'mg-lose') {
        const mg = (window as unknown as Record<string, { win?: () => void; lose?: () => void }>).__minigame;
        if (act === 'mg-win') mg?.win?.();
        else mg?.lose?.();
      } else if (act === 'dump') console.log(JSON.parse(JSON.stringify(store.get())));
      render();
    };
  });

  const routeSel = document.getElementById('dbg-route') as HTMLSelectElement | null;
  if (routeSel) {
    routeSel.onchange = () => {
      store.patch({ route: routeSel.value as Route });
      render();
    };
  }
}
