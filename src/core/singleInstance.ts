/**
 * ---- ONE COPY OF THE GAME PER DEVICE.
 *
 * Two tabs of the same game write the same save over each other (and two
 * clocks run the same life twice), so only one may be playing at a time.
 *
 * WHAT IT KEYS ON.  Not the IP address -- that changes with the network and is
 * shared by everyone behind a router -- but the device's own browser storage:
 *
 *   - an INSTALLATION ID, made once and kept in this browser's storage
 *     (`froggy.installId`), that names this copy of the game on this device;
 *   - a WEB LOCK (`navigator.locks`) held by the tab that is playing.  The
 *     browser holds it for that tab across every tab and window of the same
 *     browser on the device, whatever network it is on, and lets it go by
 *     itself the moment that tab is closed, reloaded or crashes -- so a lock
 *     is never left behind by a tab that is gone.
 *
 * Where a browser has no Web Locks, a heartbeat in shared storage does the
 * same job (renewed every second by the tab that is playing; stale after a
 * few seconds, so a closed tab frees it).
 *
 * WHAT A SECOND TAB DOES.  It never boots the game -- the save is not even
 * read -- and shows a card instead: the game is already open.  From there:
 *
 *   SWITCH TO IT        asks the playing tab to bring itself forward (where
 *                       the browser allows a page to do that) and says where
 *                       it is;
 *   PLAY HERE INSTEAD   asks the playing tab to save and step aside; it does,
 *                       and this one takes over with the save it just wrote.
 *
 * And if the playing tab is simply closed, the waiting one takes over by
 * itself.
 *
 * LIMITS, honestly: a web page cannot see past its own browser.  Two
 * different browsers (or a private window, which has its own storage) on one
 * device are two installations as far as any page can tell; within one
 * browser, every tab and window is covered.
 *
 * (The test harness drives several pages at once; in a development build a
 * page under automation is let through.)
 */

const LOCK = 'froggy-arcade-instance';
const CHANNEL = 'froggy-arcade-instance';
const BEAT_KEY = 'froggy.instance';
const ID_KEY = 'froggy.installId';
const BEAT_MS = 1000;
const STALE_MS = 4000;

type Msg = { type: 'takeover' | 'focus' | 'stepped-aside'; from: string };

/** This browser's installation of the game: made once, kept. */
export function installId(): string {
  try {
    let id = localStorage.getItem(ID_KEY);
    if (!id) {
      id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(ID_KEY, id);
    }
    return id;
  } catch {
    return 'no-storage';
  }
}

/** This tab, for telling tabs apart in messages. */
const tabId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

let channel: BroadcastChannel | null = null;
const send = (type: Msg['type']): void => channel?.postMessage({ type, from: tabId } satisfies Msg);

let releaseLock: (() => void) | null = null;
let beatTimer: number | null = null;

// ------------------------------------------------------------------ the card

let card: HTMLDivElement | null = null;

function showCard(title: string, lines: string[], buttons: Array<{ label: string; primary?: boolean; fn: () => void }>): void {
  card?.remove();
  const el = document.createElement('div');
  el.id = 'instance-card';
  Object.assign(el.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '3000',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    padding: '24px',
    boxSizing: 'border-box',
    background: '#000',
    color: '#f4ecd8',
    font: '14px/1.4 ui-monospace, "Courier New", monospace',
    letterSpacing: '2px',
    textAlign: 'center',
    touchAction: 'manipulation',
  } as Partial<CSSStyleDeclaration>);
  const img = document.createElement('img');
  img.src = 'icon.svg';
  img.width = 64;
  img.height = 64;
  img.style.imageRendering = 'pixelated';
  el.appendChild(img);
  const h = document.createElement('div');
  h.textContent = title;
  h.style.cssText = 'font-size:17px;color:#f0c040';
  el.appendChild(h);
  for (const l of lines) {
    const p = document.createElement('div');
    p.textContent = l;
    p.style.cssText = 'font-size:12px;color:#9aa8b4;max-width:460px';
    el.appendChild(p);
  }
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:12px;flex-wrap:wrap;justify-content:center;margin-top:8px';
  for (const b of buttons) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = b.label;
    btn.style.cssText = `padding:10px 18px;background:${b.primary ? '#3d2a5c' : '#141a24'};color:#f4ecd8;border:2px solid ${b.primary ? '#ff4fa3' : '#46546a'};font:inherit;font-size:12px;letter-spacing:2px;cursor:pointer`;
    btn.addEventListener('click', b.fn);
    row.appendChild(btn);
  }
  el.appendChild(row);
  document.body.appendChild(el);
  card = el;
}

function blockedCard(): void {
  showCard(
    'FROGGY ARCADE IS ALREADY OPEN',
    ['THE GAME IS RUNNING IN ANOTHER TAB OR WINDOW ON THIS DEVICE.', 'ONLY ONE COPY CAN PLAY AT A TIME, SO YOUR SAVE STAYS SAFE.'],
    [
      {
        label: 'SWITCH TO IT',
        primary: true,
        fn: () => {
          send('focus');
          showCard('SWITCH TO YOUR OTHER TAB', ['THE GAME IS WAITING FOR YOU IN THE OTHER TAB OR WINDOW.', 'YOU CAN CLOSE THIS ONE.'], [
            { label: 'PLAY HERE INSTEAD', fn: takeOver },
          ]);
        },
      },
      { label: 'PLAY HERE INSTEAD', fn: takeOver },
    ],
  );
}

function takeOver(): void {
  showCard('MOVING THE GAME HERE...', ['SAVING IN THE OTHER TAB FIRST.'], []);
  send('takeover');
}

// ------------------------------------------------------------------ the tab that is playing

/** Asked to step aside: save, stop, let go -- and say how to come back. */
async function stepAside(): Promise<void> {
  try {
    const [{ capturePlace }, { captureGame }, { store }, { getGame }, { audio }] = await Promise.all([
      import('../game/place'),
      import('./session'),
      import('./state'),
      import('./sceneManager'),
      import('./audio'),
    ]);
    capturePlace();
    captureGame();
    store.flush();
    try {
      audio.hold('pagehide');
    } catch {
      // (no sound running)
    }
    getGame()?.destroy(true);
  } catch {
    // (the save is written on every change anyway; nothing is lost by going on)
  }
  document.querySelectorAll('canvas').forEach((c) => c.remove());
  for (const id of ['game-root', 'froggy-layer', 'rotate-card', 'fullscreen-hint']) document.getElementById(id)?.remove();
  if (beatTimer !== null) window.clearInterval(beatTimer);
  beatTimer = null;
  try {
    const raw = localStorage.getItem(BEAT_KEY);
    if (raw && JSON.parse(raw).tab === tabId) localStorage.removeItem(BEAT_KEY);
  } catch {
    // (nothing to clear)
  }
  showCard('THE GAME MOVED TO ANOTHER TAB', ['YOUR PROGRESS WAS SAVED AND CARRIED OVER.', 'YOU CAN CLOSE THIS TAB.'], [
    { label: 'PLAY HERE', primary: true, fn: () => window.location.reload() },
  ]);
  releaseLock?.();
  releaseLock = null;
  send('stepped-aside');
}

function listenWhilePlaying(): void {
  if (!channel) return;
  channel.onmessage = (e: MessageEvent<Msg>) => {
    if (!e.data || e.data.from === tabId) return;
    if (e.data.type === 'focus') window.focus();
    else if (e.data.type === 'takeover' && (releaseLock || beatTimer !== null)) void stepAside();
  };
}

// ------------------------------------------------------------------ claiming it

/** Under automation in a development build (the test harness): let it through. */
function harness(): boolean {
  return !!import.meta.env?.DEV && typeof navigator !== 'undefined' && navigator.webdriver === true;
}

/** The Web Locks way: true once this tab holds the lock (waiting for it if `wait`). */
function lockRequest(wait: boolean): Promise<boolean> {
  return new Promise((resolve) => {
    navigator.locks
      .request(LOCK, wait ? {} : { ifAvailable: true }, (lock) => {
        if (!lock) {
          resolve(false);
          return undefined;
        }
        resolve(true);
        // held until this tab goes, or steps aside
        return new Promise<void>((release) => {
          releaseLock = release;
        });
      })
      .catch(() => resolve(false));
  });
}

/** The fallback: a heartbeat in shared storage. */
function beatFree(): boolean {
  try {
    const raw = localStorage.getItem(BEAT_KEY);
    if (!raw) return true;
    const b = JSON.parse(raw) as { tab: string; t: number };
    return b.tab === tabId || Date.now() - b.t > STALE_MS;
  } catch {
    return true;
  }
}
function startBeat(): void {
  const beat = (): void => {
    try {
      localStorage.setItem(BEAT_KEY, JSON.stringify({ tab: tabId, id: installId(), t: Date.now() }));
    } catch {
      // (no storage: nothing to guard with)
    }
  };
  beat();
  beatTimer = window.setInterval(beat, BEAT_MS);
  window.addEventListener('pagehide', () => {
    try {
      const raw = localStorage.getItem(BEAT_KEY);
      if (raw && JSON.parse(raw).tab === tabId) localStorage.removeItem(BEAT_KEY);
    } catch {
      // (gone anyway)
    }
  });
}

/**
 * Resolves when this tab may run the game.  Until then (another copy is
 * playing) the page shows the ALREADY OPEN card, and the game is not loaded.
 */
export async function claimInstance(): Promise<void> {
  installId();
  if (harness()) return;
  try {
    channel = new BroadcastChannel(CHANNEL);
  } catch {
    channel = null;
  }
  const locks = typeof navigator !== 'undefined' && 'locks' in navigator && !!navigator.locks;
  if (locks) {
    if (await lockRequest(false)) {
      listenWhilePlaying();
      return;
    }
    blockedCard();
    // wait in line: granted when the other tab closes or steps aside
    await lockRequest(true);
  } else {
    if (!beatFree()) {
      blockedCard();
      await new Promise<void>((resolve) => {
        const check = window.setInterval(() => {
          if (beatFree()) {
            window.clearInterval(check);
            resolve();
          }
        }, 500);
        if (channel) {
          channel.addEventListener('message', (e: MessageEvent<Msg>) => {
            if (e.data?.type === 'stepped-aside' && beatFree()) {
              window.clearInterval(check);
              resolve();
            }
          });
        }
      });
    }
    startBeat();
  }
  card?.remove();
  card = null;
  listenWhilePlaying();
}
