/**
 * ---- WHO THE ADMIN IS, WITHOUT SAYING SO (user, 3 Nov).
 *
 * Neither the admin profile's name nor its password is written anywhere in
 * the game: only a one-way hash of each (SHA-256, salted), so reading the
 * shipped code tells nobody what to type.  A profile is the admin's only
 * when its name hashes to NAME_HASH *and* the password was given for it on
 * this device -- which leaves an unlock mark for that profile (a hash of
 * the profile and the password's hash, never the password itself).
 *
 * The password is also kept in memory for the session once typed, so a
 * PUBLISH can send it to the settings server, which checks it again on its
 * side (api/config.js): the page can be tampered with; the server cannot.
 */

const NAME_HASH = '2bd21c17f073d77fee3badd40bf5eccbbdab80e0334c2fffbbd3845d898820ad';
const PASS_HASH = '1028e9cec7f1433e11f907cf92bfb3f91e494b755c4a06d25ecba96d54e38955';
const UNLOCK_PREFIX = 'froggy.unlock.';

// ---- SHA-256, synchronous (a small, standard implementation: the checks
// run every frame or so through store.isAdmin and cannot wait on crypto.subtle)
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

export function sha256(msg: string): string {
  const bytes = new TextEncoder().encode(msg);
  const len = bytes.length;
  const total = Math.ceil((len + 9) / 64) * 64;
  const buf = new Uint8Array(total);
  buf.set(bytes);
  buf[len] = 0x80;
  const bits = len * 8;
  const dv = new DataView(buf.buffer);
  dv.setUint32(total - 4, bits >>> 0);
  dv.setUint32(total - 8, Math.floor(bits / 2 ** 32));
  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const w = new Uint32Array(64);
  const rotr = (x: number, n: number): number => (x >>> n) | (x << (32 - n));
  for (let off = 0; off < total; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    h[0] = (h[0] + a) >>> 0;
    h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0;
    h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0;
    h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0;
    h[7] = (h[7] + hh) >>> 0;
  }
  return [...h].map((x) => x.toString(16).padStart(8, '0')).join('');
}

const nameCache = new Map<string, boolean>();
/** Whether `name` is the admin profile's name (any case). */
export function isAdminName(name: string | null | undefined): boolean {
  const n = (name ?? '').trim().toUpperCase();
  if (!n) return false;
  let v = nameCache.get(n);
  if (v === undefined) {
    v = sha256(`froggy-admin:${n}`) === NAME_HASH;
    nameCache.set(n, v);
  }
  return v;
}

/** Whether `pw` is the admin password (exactly as typed). */
export const isAdminPassword = (pw: string): boolean => sha256(`froggy-admin-pass:${pw}`) === PASS_HASH;

const unlockMark = (slotId: string): string => sha256(`froggy-unlock:${slotId}:${PASS_HASH}`);

let sessionPassword: string | null = null;

/** The password typed this session, for the settings server; null if not typed since the page opened. */
export const adminPassword = (): string | null => sessionPassword;

/** The right password for profile `slotId`: it is the admin's on this device from now on. */
export function unlockAdmin(slotId: string, pw: string): boolean {
  if (!isAdminPassword(pw)) return false;
  sessionPassword = pw;
  try {
    localStorage.setItem(UNLOCK_PREFIX + slotId, unlockMark(slotId));
  } catch {
    /* storage blocked: unlocked for this session only */
  }
  unlockedNow.add(slotId);
  return true;
}

/** Just keep the password for this session (asked again before a publish). */
export function rememberPassword(pw: string): boolean {
  if (!isAdminPassword(pw)) return false;
  sessionPassword = pw;
  return true;
}

const unlockedNow = new Set<string>();
const unlockChecked = new Map<string, boolean>();
/** Whether profile `slotId` was unlocked with the password on this device. */
export function isUnlocked(slotId: string | null): boolean {
  if (!slotId) return false;
  if (unlockedNow.has(slotId)) return true;
  let v = unlockChecked.get(slotId);
  if (v === undefined) {
    try {
      v = localStorage.getItem(UNLOCK_PREFIX + slotId) === unlockMark(slotId);
    } catch {
      v = false;
    }
    unlockChecked.set(slotId, v);
  }
  return v;
}

/** Forget a profile's unlock (it was deleted). */
export function forgetUnlock(slotId: string): void {
  unlockedNow.delete(slotId);
  unlockChecked.delete(slotId);
  try {
    localStorage.removeItem(UNLOCK_PREFIX + slotId);
  } catch {
    /* nothing to forget */
  }
}
