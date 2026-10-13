/**
 * ---- LIVING HERE.  Time, rent, food, water, sleep, the condo, the street.
 *
 * One save field (`GameState.life`), versioned, sanitised on load, and only
 * ever changed through the functions in this file -- so every purchase is
 * checked and paid exactly once, nothing is handed out twice, and no scene
 * keeps its own copy of any of it.
 *
 * TIME.  One game day is twenty minutes of the game being open and in front
 * of the player (`DAY_SECONDS` of `tick`).  Time the game is closed or hidden
 * does not pass at all: that is the offline rule, and it means a deadline can
 * never arrive while nobody is looking.  The day starts at 08:00.
 *
 * RENT.  Two hundred cash for seven game days, paid to the landlord at Lily's
 * Condos.  It falls due on the morning of the eighth day; there is one day of
 * grace, and then you are evicted -- your things put into storage, never
 * deleted, and you can rent again whenever you can pay.
 */

import { store, type GameState } from '../core/state';
import { ledger } from '../core/ledger';
import { COSMETICS, FOODS, FURNITURE, INGREDIENTS, RECIPES, STARTER_COSMETICS, cosmeticById, foodById, furnitureById, ingredientById, recipeById } from './catalog';
import type { LifeState } from './lifeState';
export { LIFE_VERSION, defaultLife, sanitizeLife, type LifeState, type Placement } from './lifeState';

/** Seconds of play in one game day. */
export const DAY_SECONDS = 20 * 60;
export const RENT_PRICE = 200;
export const RENT_DAYS = 7;
/** The arcade shuts at 22:00. */
export const CLOSE_HOUR = 22;
/** Dark from 20:00 to 06:00. */
export const DUSK_HOUR = 20;
export const DAWN_HOUR = 6;
/** Begging: one cash per this many real milliseconds of sitting there. */
export const BEG_MS = 15 * 60 * 1000;
/** What a sold thing fetches: this fraction of what it cost.  Never more. */
export const RESALE = 0.4;

// ------------------------------------------------------------------- access

const L = (): LifeState => store.get().life;
/** Write the life back.  Every change goes through here. */
function put(next: LifeState): void {
  store.patch({ life: next } as Partial<GameState>);
}
const edit = (fn: (l: LifeState) => void): void => {
  const l = structuredClone(L());
  fn(l);
  put(l);
};

// --------------------------------------------------------------------- time

export interface Clock {
  day: number;
  hour: number;
  minute: number;
  /** "08:15" */
  text: string;
  dark: boolean;
  /** The arcade's hours are over. */
  closed: boolean;
}

export function clock(t = L().t): Clock {
  const day = Math.floor(t / DAY_SECONDS);
  const into = (t - day * DAY_SECONDS) / DAY_SECONDS;
  const mins = Math.floor(into * 24 * 60 + 8 * 60) % (24 * 60);
  const hour = Math.floor(mins / 60);
  const minute = mins % 60;
  return {
    day,
    hour,
    minute,
    text: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    dark: hour >= DUSK_HOUR || hour < DAWN_HOUR,
    closed: hour >= CLOSE_HOUR || hour < 8,
  };
}

/** Days until rent is due (0 = due today, negative = overdue). */
export function rentInDays(l = L()): number {
  return l.rentDue - clock(l.t).day;
}

/**
 * A second (or a few) of the game being played.  Needs go down, the hob
 * finishes, rent comes due -- and eviction, once the grace day is gone.
 */
export function tick(seconds: number): void {
  if (!(seconds > 0)) return;
  const l = structuredClone(L());
  const dayWas = clock(l.t).day;
  l.t += seconds;
  const perDay = seconds / DAY_SECONDS;
  // a day's worth: fed twice and watered three times keeps you level
  l.hunger = Math.max(0, l.hunger - 60 * perDay);
  l.thirst = Math.max(0, l.thirst - 85 * perDay);
  l.energy = Math.max(0, l.energy - 70 * perDay);
  // going hungry or thirsty wears you out faster
  if (l.hunger < 10 || l.thirst < 10) l.energy = Math.max(0, l.energy - 40 * perDay);
  // the hob
  if (l.cooking && l.t >= l.cooking.ready) finishCooking(l);
  // rent
  if (l.rented && clock(l.t).day > l.rentDue) {
    l.rented = false;
    l.evicted = true;
    l.notice = 'EVICTED. YOUR THINGS ARE IN STORAGE. YOU CAN RENT AGAIN.';
  } else if (l.rented && clock(l.t).day !== dayWas && rentInDays(l) <= 0) {
    l.notice = `RENT OF $${RENT_PRICE} IS DUE TODAY. PAY THE LANDLORD.`;
  }
  // warnings, once as each line is crossed
  const crossed = (was: number, now: number, at: number) => was > at && now <= at;
  const was = L();
  if (crossed(was.thirst, l.thirst, 20)) l.notice = 'THIRSTY. DRINK SOMETHING - THE FOUNTAIN IS FREE.';
  else if (crossed(was.hunger, l.hunger, 20)) l.notice = 'HUNGRY. EAT SOMETHING.';
  else if (crossed(was.energy, l.energy, 15)) l.notice = 'EXHAUSTED. FIND SOMEWHERE TO SLEEP.';
  put(l);
}

/** Take the waiting notice, if any. */
export function takeNotice(): string {
  const n = L().notice;
  if (n) edit((l) => (l.notice = ''));
  return n;
}

// ----------------------------------------------------------------- pantry

export function pantryCount(id: string, l = L()): number {
  return l.pantry[id] ?? 0;
}

/** What a cooking recipe has taken off the shelf until it is done. */
function reserved(l: LifeState, id: string): number {
  if (!l.cooking) return 0;
  return recipeById(l.cooking.recipe)?.needs[id] ?? 0;
}

export function available(id: string, l = L()): number {
  return pantryCount(id, l) - reserved(l, id);
}

export type Result = { ok: true; msg: string } | { ok: false; msg: string };
const ok = (msg: string): Result => ({ ok: true, msg });
const no = (msg: string): Result => ({ ok: false, msg });

/** Buy `qty` of a food, drink or ingredient.  Paid once, or not at all. */
export function buyFood(id: string, qty = 1): Result {
  const f = foodById(id);
  const g = ingredientById(id);
  const price = f?.sold === 'market' ? f.price : g ? g.price : 0;
  if (!price || qty < 1) return no('NOT FOR SALE.');
  const total = price * qty;
  if (pantryCount(id) + qty > 99) return no('YOU CANNOT CARRY ANY MORE OF THAT.');
  if (!store.spendCash(total)) return no(`NOT ENOUGH CASH. IT IS $${total}.`);
  edit((l) => {
    l.pantry[id] = (l.pantry[id] ?? 0) + qty;
  });
  record(f ? (f.thirst > f.hunger ? 'buy_water' : 'buy_food') : 'buy_ingredient', qty);
  return ok(`BOUGHT ${qty} x ${(f ?? g)!.name} FOR $${total}.`);
}

/** Eat or drink one of something you have. */
export function consume(id: string): Result {
  const f = foodById(id);
  if (!f) return no('YOU CANNOT EAT THAT.');
  if (available(id) < 1) return no('YOU HAVE NONE.');
  edit((l) => {
    l.pantry[id] -= 1;
    if (l.pantry[id] <= 0) delete l.pantry[id];
    l.hunger = Math.min(100, Math.max(0, l.hunger + f.hunger));
    l.thirst = Math.min(100, Math.max(0, l.thirst + f.thirst));
    l.energy = Math.min(100, l.energy + f.energy);
  });
  record(f.thirst > f.hunger ? 'drink' : 'eat');
  if (f.tier === 'premium') record('eat_premium');
  return ok(`${f.name}. ${f.thirst > f.hunger ? 'REFRESHING.' : 'THAT HIT THE SPOT.'}`);
}

/** The fountain: free, always, a little at a time. */
export function drinkFountain(): Result {
  edit((l) => (l.thirst = Math.min(100, l.thirst + 25)));
  record('drink');
  record('fountain');
  return ok('COLD WATER. FREE.');
}

// ---------------------------------------------------------------- cooking

/** Why a recipe cannot be started right now, or null when it can. */
export function cannotCook(recipeId: string): string | null {
  const l = L();
  const r = recipeById(recipeId);
  if (!r) return 'NO SUCH RECIPE.';
  if (!l.rented) return 'YOU NEED YOUR CONDO TO COOK.';
  if (l.cooking) return 'SOMETHING IS ALREADY COOKING.';
  for (const [id, n] of Object.entries(r.needs)) {
    if (available(id, l) < n) return `MISSING ${ingredientById(id)?.name ?? id}.`;
  }
  return null;
}

/** Put it on.  Nothing is used up until it is done (see `finishCooking`). */
export function startCooking(recipeId: string): Result {
  const why = cannotCook(recipeId);
  if (why) return no(why);
  const r = recipeById(recipeId)!;
  edit((l) => (l.cooking = { recipe: r.id, ready: l.t + r.seconds }));
  return ok(`COOKING ${r.name}...`);
}

/** Done: the ingredients go and the meal arrives, in one step, or neither. */
function finishCooking(l: LifeState): void {
  const r = l.cooking ? recipeById(l.cooking.recipe) : undefined;
  l.cooking = null;
  if (!r) return;
  for (const [id, n] of Object.entries(r.needs)) if ((l.pantry[id] ?? 0) < n) {
    l.notice = `THE ${r.name} DID NOT WORK - SOMETHING WAS MISSING.`;
    return;
  }
  for (const [id, n] of Object.entries(r.needs)) {
    l.pantry[id] -= n;
    if (l.pantry[id] <= 0) delete l.pantry[id];
  }
  l.pantry[r.makes] = (l.pantry[r.makes] ?? 0) + 1;
  l.stats.cook = (l.stats.cook ?? 0) + 1;
  bump(l, 'cook', 1);
  l.notice = `${r.name} IS READY. IT IS IN YOUR PANTRY.`;
}

/** Called by the condo while it is open, so a meal finishes in front of you. */
export function cookingLeft(): number {
  const l = L();
  return l.cooking ? Math.max(0, l.cooking.ready - l.t) : 0;
}

// ------------------------------------------------------------------- rent

export function rent(): Result {
  const l = L();
  if (l.rented) return no('YOU ALREADY RENT UNIT 612.');
  if (!store.spendCash(RENT_PRICE)) return no(`IT IS $${RENT_PRICE} FOR ${RENT_DAYS} DAYS. YOU HAVE $${store.get().cash}.`);
  edit((x) => {
    x.rented = true;
    x.evicted = false;
    x.rentDue = clock(x.t).day + RENT_DAYS;
  });
  record('pay_rent');
  return ok(`UNIT 612 IS YOURS FOR ${RENT_DAYS} DAYS.`);
}

/** Pay the rent that is due (or up to one week ahead).  Never twice for the same week. */
export function payRent(): Result {
  const l = L();
  if (!l.rented) return no('YOU DO NOT RENT HERE.');
  if (rentInDays(l) > RENT_DAYS - 1) return no('YOUR RENT IS PAID UP.');
  if (!store.spendCash(RENT_PRICE)) return no(`RENT IS $${RENT_PRICE}. YOU HAVE $${store.get().cash}.`);
  edit((x) => (x.rentDue += RENT_DAYS));
  record('pay_rent');
  return ok(`PAID. NEXT RENT IN ${rentInDays()} DAYS.`);
}

/** What the landlord will give for something you own, and whether it can go. */
export function resaleValue(kind: 'furniture' | 'cosmetic', id: string): number {
  const price = kind === 'furniture' ? furnitureById(id)?.price ?? 0 : cosmeticById(id)?.price ?? 0;
  return Math.floor(price * RESALE);
}

/** Sell one owned thing to the landlord for its resale value. */
export function sellAsset(kind: 'furniture' | 'cosmetic', id: string): Result {
  const value = resaleValue(kind, id);
  if (value <= 0) return no('THAT IS WORTH NOTHING TO HIM.');
  const l = L();
  if (kind === 'furniture') {
    if ((l.furniture[id] ?? 0) < 1) return no('YOU DO NOT OWN THAT.');
    edit((x) => {
      x.furniture[id] -= 1;
      if (x.furniture[id] <= 0) delete x.furniture[id];
      // the placed copy goes with it
      const at = x.placed.findIndex((p) => p.id === id);
      const owned = x.furniture[id] ?? 0;
      if (at >= 0 && x.placed.filter((p) => p.id === id).length > owned) x.placed.splice(at, 1);
    });
  } else {
    if (!l.wardrobe.includes(id) || STARTER_COSMETICS.includes(id)) return no('YOU CANNOT SELL THAT.');
    edit((x) => {
      x.wardrobe = x.wardrobe.filter((w) => w !== id);
      for (const [slot, on] of Object.entries(x.outfit)) if (on === id) delete (x.outfit as Record<string, string>)[slot];
    });
  }
  store.earnCash(value);
  return ok(`SOLD FOR $${value}.`);
}

/** Give up: evicted now, with everything kept in storage. */
export function evict(): void {
  edit((l) => {
    l.rented = false;
    l.evicted = true;
    l.cooking = null;
    l.notice = 'EVICTED. YOUR THINGS ARE IN STORAGE. YOU CAN RENT AGAIN.';
  });
}

// ------------------------------------------------------- furniture / looks

export function buyFurniture(id: string): Result {
  const f = furnitureById(id);
  if (!f || f.reward || f.price <= 0) return no('NOT FOR SALE.');
  if ((L().furniture[id] ?? 0) >= 9) return no('YOU HAVE ENOUGH OF THOSE.');
  if (!store.spendCash(f.price)) return no(`NOT ENOUGH CASH. IT IS $${f.price}.`);
  edit((l) => (l.furniture[id] = (l.furniture[id] ?? 0) + 1));
  record('buy_furniture');
  return ok(`${f.name} BOUGHT. PLACE IT FROM DECORATE IN YOUR CONDO.`);
}

export function placeFurniture(id: string, x: number, y: number): Result {
  const l = L();
  const placed = l.placed.filter((p) => p.id === id).length;
  if ((l.furniture[id] ?? 0) <= placed) return no('YOU HAVE NONE LEFT TO PLACE.');
  edit((s) => s.placed.push({ uid: s.nextUid++, id, x, y, flip: false }));
  record('place_furniture');
  return ok('PLACED.');
}

export function movePlacement(uid: number, x: number, y: number, flip?: boolean): void {
  edit((l) => {
    const p = l.placed.find((q) => q.uid === uid);
    if (!p) return;
    p.x = x;
    p.y = y;
    if (flip !== undefined) p.flip = flip;
  });
}

export function removePlacement(uid: number): void {
  edit((l) => (l.placed = l.placed.filter((p) => p.uid !== uid)));
}

export function buyCosmetic(id: string): Result {
  const c = cosmeticById(id);
  if (!c || c.reward || c.price <= 0) return no('NOT FOR SALE.');
  if (L().wardrobe.includes(id)) return no('YOU ALREADY OWN THAT.');
  if (!store.spendCash(c.price)) return no(`NOT ENOUGH CASH. IT IS $${c.price}.`);
  edit((l) => l.wardrobe.push(id));
  record(c.shop === 'barber' ? 'barber' : 'buy_clothes');
  return ok(`${c.name} IS YOURS.`);
}

export function wear(id: string): Result {
  const c = cosmeticById(id);
  if (!c || !L().wardrobe.includes(id)) return no('YOU DO NOT OWN THAT.');
  edit((l) => ((l.outfit as Record<string, string>)[c.slot] = id));
  return ok(`WEARING ${c.name}.`);
}

// ------------------------------------------------------------- sleep / beg

/**
 * Sleep until morning: on the condo floor (or a mattress, or a bed), or on
 * the street.  The clock goes to 08:00 of the next day; how rested you wake
 * depends on what you slept on.
 */
export function sleep(where: 'street' | 'floor' | 'mattress' | 'bed'): Result {
  const c = clock();
  if (where === 'street' && !c.dark) return no('TOO LIGHT AND TOO BUSY. WAIT FOR DARK.');
  const restored = { street: 55, floor: 75, mattress: 90, bed: 100 }[where];
  edit((l) => {
    const day = clock(l.t).day;
    // to 08:00 on the next morning (or this one, before dawn)
    const morning = (c.hour < 8 ? day : day + 1) * DAY_SECONDS;
    const slept = Math.max(0, morning - l.t);
    l.t = morning;
    l.energy = Math.max(l.energy, restored);
    // a night costs some food and water, less than a day awake
    const k = slept / DAY_SECONDS;
    l.hunger = Math.max(5, l.hunger - 25 * k);
    l.thirst = Math.max(5, l.thirst - 35 * k);
    if (l.cooking && l.t >= l.cooking.ready) finishCooking(l);
    if (l.rented && clock(l.t).day > l.rentDue) {
      l.rented = false;
      l.evicted = true;
      l.notice = 'EVICTED IN THE NIGHT. YOUR THINGS ARE IN STORAGE.';
    }
  });
  record('sleep');
  return ok(where === 'street' ? 'A HARD NIGHT ON THE PAVEMENT. MORNING.' : 'YOU SLEEP RIGHT THROUGH TO MORNING.');
}

/** Below this, the cardboard outside offers a nap instead of the cup. */
export const NAP_BELOW = 40;

/**
 * A daytime nap on the cardboard: +35 energy and up to three hours gone,
 * but never past half an hour before the arcade shuts -- a nap must not
 * sleep through closing time (the day's end, and before Hide and Seek, the
 * night that follows it).
 */
export function nap(): Result {
  const c = clock();
  if (c.dark || c.closed) return no('TOO LATE FOR A NAP. SLEEP INSTEAD.');
  const l0 = L();
  if (l0.energy >= NAP_BELOW) return no('NOT TIRED ENOUGH TO NAP.');
  const day = c.day;
  const latest = day * DAY_SECONDS + ((CLOSE_HOUR - 0.5 - 8) / 24) * DAY_SECONDS;
  const until = Math.min(l0.t + (3 / 24) * DAY_SECONDS, latest);
  if (until <= l0.t + 1) return no('TOO CLOSE TO CLOSING TIME TO NAP.');
  edit((l) => {
    const k = (until - l.t) / DAY_SECONDS;
    l.t = until;
    l.energy = Math.min(100, l.energy + 35);
    l.hunger = Math.max(5, l.hunger - 25 * k);
    l.thirst = Math.max(5, l.thirst - 35 * k);
    if (l.cooking && l.t >= l.cooking.ready) finishCooking(l);
  });
  return ok('A NAP ON THE CARDBOARD. A LITTLE BETTER.');
}

export function startBegging(now = Date.now()): void {
  edit((l) => (l.beg = { since: now, paid: 0 }));
}

/** Pay what sitting there has earned so far.  Returns how many cash were paid. */
export function collectBegging(now = Date.now()): number {
  const b = L().beg;
  if (!b) return 0;
  const due = Math.floor(Math.max(0, now - b.since) / BEG_MS) - b.paid;
  if (due <= 0) return 0;
  edit((l) => {
    if (l.beg) l.beg.paid += due;
  });
  store.earnCash(due);
  record('beg', due);
  return due;
}

export function stopBegging(now = Date.now()): number {
  const got = collectBegging(now);
  edit((l) => (l.beg = null));
  return got;
}

/** Milliseconds to the next coin, while begging. */
export function begNextMs(now = Date.now()): number {
  const b = L().beg;
  if (!b) return BEG_MS;
  const into = (now - b.since) % BEG_MS;
  return BEG_MS - into;
}

export function visit(place: string): void {
  if (L().visited.includes(place)) return;
  edit((l) => l.visited.push(place));
  record('visit');
}

// ------------------------------------------------------ missions & stats

/** Bump a stat and the current daily / weekly goals that count it. */
function bump(l: LifeState, stat: string, n: number): void {
  l.stats[stat] = (l.stats[stat] ?? 0) + n;
  for (const p of [l.daily, l.weekly]) {
    for (const id of p.ids) {
      const g = GOALS.find((x) => x.id === id);
      if (g && g.stat === stat) p.prog[id] = (p.prog[id] ?? 0) + n;
    }
  }
}

/** Something happened that goals might count. */
export function record(stat: string, n = 1): void {
  if (!(n > 0)) return;
  edit((l) => bump(l, stat, n));
}

export interface Reward {
  cash?: number;
  tokens?: number;
  items?: Record<string, number>;
  furniture?: string;
  cosmetic?: string;
}

export interface GoalDef {
  id: string;
  text: string;
  stat: string;
  need: number;
  reward: Reward;
  /** Only offered when this holds (so nothing asked for is out of reach). */
  when?: (l: LifeState, s: GameState) => boolean;
}

const rentedOnly = (l: LifeState) => l.rented;
export const GOALS: GoalDef[] = [
  // daily-sized
  { id: 'd_win2', text: 'WIN 2 ARCADE GAMES', stat: 'game_won', need: 2, reward: { tokens: 5 } },
  { id: 'd_play4', text: 'PLAY 4 ARCADE GAMES', stat: 'game_played', need: 4, reward: { cash: 4 } },
  { id: 'd_drink3', text: 'DRINK 3 TIMES', stat: 'drink', need: 3, reward: { items: { water: 2 } } },
  { id: 'd_eat2', text: 'EAT 2 MEALS', stat: 'eat', need: 2, reward: { items: { bread: 2 } } },
  { id: 'd_earn20', text: 'EARN $20', stat: 'earn_cash', need: 20, reward: { tokens: 6 } },
  { id: 'd_sell1', text: 'SELL A PRIZE TO THE MAN', stat: 'sell_prize', need: 1, reward: { cash: 5 } },
  { id: 'd_cook1', text: 'COOK A MEAL', stat: 'cook', need: 1, reward: { items: { ing_egg: 2, ing_rice: 1 } }, when: rentedOnly },
  { id: 'd_fountain', text: 'DRINK AT THE FOUNTAIN', stat: 'fountain', need: 1, reward: { cash: 2 } },
  { id: 'd_buyfood', text: 'BUY SOMETHING TO EAT', stat: 'buy_food', need: 1, reward: { items: { apple: 1 } } },
  // weekly-sized
  { id: 'w_win15', text: 'WIN 15 ARCADE GAMES', stat: 'game_won', need: 15, reward: { tokens: 30 } },
  { id: 'w_earn150', text: 'EARN $150', stat: 'earn_cash', need: 150, reward: { cash: 25 } },
  { id: 'w_cook5', text: 'COOK 5 MEALS', stat: 'cook', need: 5, reward: { items: { ing_meat: 1, ing_spice: 2 } }, when: rentedOnly },
  { id: 'w_place3', text: 'PLACE 3 PIECES OF FURNITURE', stat: 'place_furniture', need: 3, reward: { furniture: 'fur_frog_statue' }, when: (l) => l.rented },
  { id: 'w_sleep3', text: 'SLEEP 3 NIGHTS', stat: 'sleep', need: 3, reward: { items: { coffee: 2 } } },
  { id: 'w_rent', text: 'PAY YOUR RENT', stat: 'pay_rent', need: 1, reward: { cash: 20 }, when: rentedOnly },
  { id: 'w_play30', text: 'PLAY 30 ARCADE GAMES', stat: 'game_played', need: 30, reward: { cosmetic: 'cos_frog_jacket' } },
];

export interface AchievementDef {
  id: string;
  text: string;
  stat: string;
  need: number;
  reward: Reward;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'a_first_win', text: 'FIRST WIN', stat: 'game_won', need: 1, reward: { tokens: 3 } },
  { id: 'a_wins_50', text: '50 WINS', stat: 'game_won', need: 50, reward: { furniture: 'fur_trophy' } },
  { id: 'a_tenant', text: 'A ROOF OVER YOUR HEAD', stat: 'pay_rent', need: 1, reward: { cash: 10 } },
  { id: 'a_chef', text: 'HOME COOK (10 MEALS)', stat: 'cook', need: 10, reward: { cosmetic: 'cos_frog_jacket' } },
  { id: 'a_decorator', text: 'DECORATOR (10 PLACED)', stat: 'place_furniture', need: 10, reward: { cash: 40 } },
  { id: 'a_explorer', text: 'EXPLORER (6 PLACES)', stat: 'visit', need: 6, reward: { tokens: 10 } },
  { id: 'a_hydrated', text: 'WELL WATERED (50 DRINKS)', stat: 'drink', need: 50, reward: { items: { smoothie: 1 } } },
  { id: 'a_beggar', text: 'SPARE CHANGE (EARN $5 BEGGING)', stat: 'beg', need: 5, reward: { cash: 5 } },
  { id: 'a_gourmet', text: 'GOURMET (5 PREMIUM MEALS)', stat: 'eat_premium', need: 5, reward: { furniture: 'fur_paint_lily' } },
  { id: 'a_style', text: 'NEW LOOK (BUY CLOTHES)', stat: 'buy_clothes', need: 1, reward: { items: { coffee: 1 } } },
];

/** Today's and this week's keys: local calendar day, ISO-style week starting Monday. */
export function periodKeys(now = new Date()): { day: string; week: string } {
  const day = now.toLocaleDateString('en-CA');
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return { day, week: d.toLocaleDateString('en-CA') };
}

const seeded = (key: string): (() => number) => {
  let h = 2166136261;
  for (const ch of key) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
};

/** Roll new goals when the real day / week has turned.  Progress resets; achievements never do. */
export function refreshGoals(now = new Date()): void {
  const k = periodKeys(now);
  const l = L();
  if (l.daily.key === k.day && l.weekly.key === k.week) return;
  const s = store.get();
  const pick = (pool: GoalDef[], n: number, key: string): string[] => {
    const rnd = seeded(key);
    const ok2 = pool.filter((g) => !g.when || g.when(l, s));
    const out: string[] = [];
    while (out.length < n && ok2.length) out.push(ok2.splice(Math.floor(rnd() * ok2.length), 1)[0].id);
    return out;
  };
  edit((x) => {
    if (x.daily.key !== k.day) x.daily = { key: k.day, ids: pick(GOALS.filter((g) => g.id.startsWith('d_')), 3, k.day), prog: {}, claimed: [] };
    if (x.weekly.key !== k.week) x.weekly = { key: k.week, ids: pick(GOALS.filter((g) => g.id.startsWith('w_')), 3, k.week), prog: {}, claimed: [] };
  });
}

function grant(r: Reward): string {
  const bits: string[] = [];
  if (r.cash) {
    store.earnCash(r.cash);
    bits.push(`$${r.cash}`);
  }
  if (r.tokens) {
    ledger.credit(r.tokens, 'mission');
    bits.push(`${r.tokens} TOKENS`);
  }
  edit((l) => {
    for (const [id, n] of Object.entries(r.items ?? {})) {
      l.pantry[id] = Math.min(99, (l.pantry[id] ?? 0) + n);
      bits.push(`${n} x ${(foodById(id) ?? ingredientById(id))?.name ?? id}`);
    }
    if (r.furniture) {
      l.furniture[r.furniture] = (l.furniture[r.furniture] ?? 0) + 1;
      bits.push(furnitureById(r.furniture)?.name ?? r.furniture);
    }
    if (r.cosmetic && !l.wardrobe.includes(r.cosmetic)) {
      l.wardrobe.push(r.cosmetic);
      bits.push(cosmeticById(r.cosmetic)?.name ?? r.cosmetic);
    }
  });
  return bits.join(', ');
}

export function claimGoal(which: 'daily' | 'weekly', id: string): Result {
  const l = L();
  const p = l[which];
  const g = GOALS.find((x) => x.id === id);
  if (!g || !p.ids.includes(id)) return no('NOT A GOAL RIGHT NOW.');
  if (p.claimed.includes(id)) return no('ALREADY CLAIMED.');
  if ((p.prog[id] ?? 0) < g.need) return no('NOT DONE YET.');
  // marked claimed BEFORE it is paid: a second press finds it claimed
  edit((x) => x[which].claimed.push(id));
  return ok(`CLAIMED: ${grant(g.reward)}.`);
}

export function claimAchievement(id: string): Result {
  const a = ACHIEVEMENTS.find((x) => x.id === id);
  const l = L();
  if (!a) return no('NO SUCH ACHIEVEMENT.');
  if (l.achieved.includes(id)) return no('ALREADY CLAIMED.');
  if ((l.stats[a.stat] ?? 0) < a.need) return no('NOT DONE YET.');
  edit((x) => x.achieved.push(id));
  return ok(`ACHIEVEMENT: ${grant(a.reward)}.`);
}

/** How many goals and achievements are done and waiting to be claimed. */
export function claimable(): number {
  const l = L();
  let n = 0;
  for (const w of ['daily', 'weekly'] as const) {
    for (const id of l[w].ids) {
      const g = GOALS.find((x) => x.id === id);
      if (g && !l[w].claimed.includes(id) && (l[w].prog[id] ?? 0) >= g.need) n++;
    }
  }
  for (const a of ACHIEVEMENTS) if (!l.achieved.includes(a.id) && (l.stats[a.stat] ?? 0) >= a.need) n++;
  return n;
}

// (re-exported for the shops)
export { COSMETICS, FOODS, FURNITURE, INGREDIENTS, RECIPES };
