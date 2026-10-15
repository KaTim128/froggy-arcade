/**
 * ---- WHAT THERE IS TO BUY.  Data only, by stable id: the shops, the condo,
 * the missions and the save all refer to things by these ids, so a line can
 * be added here without touching any of them.
 *
 *   FURNITURE   for the condo, by category, with a size on the floor
 *   COSMETICS   clothes and hair, as recolours of the drifter's own rig
 */

import type { Look } from '../art/player';

// ------------------------------------------------------------- furniture

export type FurnitureCat = 'painting' | 'poster' | 'table' | 'chair' | 'sofa' | 'tv' | 'radio' | 'lamp' | 'rug' | 'storage' | 'decor' | 'bed' | 'bath';

export interface FurnitureDef {
  id: string;
  name: string;
  cat: FurnitureCat;
  price: number;
  /** Size in the room, in pixels (floor items) -- wall items hang on the back wall. */
  w: number;
  h: number;
  wall: boolean;
  /** The two colours it is drawn in. */
  a: number;
  b: number;
  note: string;
  /** Only obtainable as a mission or achievement reward. */
  reward?: boolean;
}

const F = (id: string, name: string, cat: FurnitureCat, price: number, w: number, h: number, wall: boolean, a: number, b: number, note: string, reward = false): FurnitureDef => ({
  id, name, cat, price, w, h, wall, a, b, note, reward,
});

export const FURNITURE: FurnitureDef[] = [
  // posters and paintings, on the back wall
  F('fur_poster_frog', 'FROGGY POSTER', 'poster', 8, 14, 18, true, 0x5aa85f, 0xffd45e, 'THE ARCADE MASCOT'),
  F('fur_poster_band', 'BAND POSTER', 'poster', 10, 14, 20, true, 0xc31f2e, 0x14161c, 'A BAND NOBODY KNOWS'),
  F('fur_poster_city', 'CITY POSTER', 'poster', 12, 22, 14, true, 0x3a6ab0, 0xf0d890, 'SKYLINE AT DUSK'),
  F('fur_paint_lily', 'LILY PAD PAINTING', 'painting', 65, 24, 18, true, 0x2f6b36, 0xf0a8c8, 'OIL ON CANVAS'),
  F('fur_paint_sea', 'SEASCAPE', 'painting', 110, 28, 18, true, 0x2a5a8a, 0xe8e0c8, 'A STORMY HARBOUR'),
  F('fur_paint_gold', 'GILT PORTRAIT', 'painting', 320, 22, 26, true, 0xd8a838, 0x5a3a28, 'LATE COLLECTION'),
  F('fur_clock', 'WALL CLOCK', 'decor', 15, 10, 10, true, 0xf0ece0, 0x3a2a1e, 'TICKS QUIETLY'),
  // floor
  F('fur_table_crate', 'CRATE TABLE', 'table', 6, 20, 10, false, 0x9a7048, 0x6a4a2a, 'A CRATE. IT WORKS'),
  F('fur_table_wood', 'WOODEN TABLE', 'table', 35, 28, 12, false, 0x8a5a32, 0x5a3a1e, 'SOLID PINE'),
  F('fur_table_glass', 'GLASS TABLE', 'table', 220, 30, 10, false, 0xb8d8e8, 0x6a7a8a, 'LATE COLLECTION'),
  F('fur_chair_stool', 'STOOL', 'chair', 5, 8, 12, false, 0x8a6a48, 0x5a4028, 'THREE LEGS'),
  F('fur_chair_wood', 'WOODEN CHAIR', 'chair', 18, 10, 18, false, 0x7a4a28, 0x4a2a18, 'STURDY'),
  F('fur_chair_arm', 'ARMCHAIR', 'chair', 95, 16, 18, false, 0x7b2a3a, 0x4a1a24, 'DEEP AND SOFT'),
  F('fur_sofa_old', 'SECOND-HAND SOFA', 'sofa', 30, 40, 16, false, 0x6a6a44, 0x4a4a30, 'A FEW STAINS'),
  F('fur_sofa_new', 'VELVET SOFA', 'sofa', 260, 44, 18, false, 0x3a2a6a, 0x241a48, 'LATE COLLECTION'),
  F('fur_tv_old', 'OLD TV', 'tv', 25, 18, 16, false, 0x3a3a3a, 0x7ab0c0, 'TWO CHANNELS'),
  F('fur_tv_flat', 'FLAT SCREEN', 'tv', 280, 30, 20, false, 0x14161c, 0x46c4bd, 'BIG AND BRIGHT'),
  F('fur_radio', 'RADIO', 'radio', 12, 12, 8, false, 0x8a5a32, 0xe8d0a0, 'TINNY BUT CHEERFUL'),
  F('fur_radio_retro', 'RETRO RADIO', 'radio', 70, 14, 10, false, 0xc87830, 0xf0e0b0, 'WARM VALVES'),
  F('fur_lamp_floor', 'FLOOR LAMP', 'lamp', 14, 8, 30, false, 0xf0d890, 0x3a3a3a, 'A WARM CORNER'),
  F('fur_lamp_neon', 'NEON FROG LAMP', 'lamp', 85, 14, 16, false, 0x6dd36d, 0xff4fa3, 'BUZZES SOFTLY'),
  F('fur_rug_mat', 'DOOR MAT', 'rug', 4, 24, 4, false, 0x8a6a48, 0x5a4028, 'WELCOME'),
  F('fur_rug_round', 'ROUND RUG', 'rug', 22, 40, 6, false, 0xc85a3a, 0xf0c070, 'COSY'),
  F('fur_rug_persian', 'PERSIAN RUG', 'rug', 210, 60, 8, false, 0x8a2a3a, 0xd8a838, 'LATE COLLECTION'),
  F('fur_shelf', 'BOOKSHELF', 'storage', 28, 18, 30, false, 0x7a4a28, 0xc8b070, 'FULL OF PAPERBACKS'),
  F('fur_cabinet', 'CABINET', 'storage', 55, 20, 20, false, 0x5a3a28, 0x8a6a48, 'FOR YOUR THINGS'),
  F('fur_plant', 'POT PLANT', 'decor', 9, 10, 16, false, 0x3a8a3a, 0xa86a40, 'GREEN'),
  F('fur_mattress', 'MATTRESS', 'bed', 20, 40, 6, false, 0xe8e0c8, 0x9a9480, 'BETTER THAN THE FLOOR'),
  F('fur_bed', 'SINGLE BED', 'bed', 120, 32, 13, false, 0x3a5a8a, 0xe8e0c8, 'A SMALL BED, ALL YOURS'),
  // the flat comes without a bathroom fitted: these are bought and put in
  F('fur_toilet', 'TOILET', 'bath', 60, 12, 16, false, 0xf2f2ee, 0xc8d0d8, 'A FLAT NEEDS ONE'),
  F('fur_sink', 'WASH BASIN', 'bath', 45, 14, 18, false, 0xf2f2ee, 0x9aa8b4, 'HOT AND COLD'),
  F('fur_bathtub', 'BATHTUB', 'bath', 150, 40, 14, false, 0xf2f2ee, 0x8ac0e0, 'A LONG HOT SOAK'),
  // reward-only
  // ---- and the rest of the range.  Home and Hearth does not have all of
  // this out at once: what is on the floor changes with the day (see
  // `stockFor`), so coming back tomorrow is worth doing.
  F('fur_poster_map', 'OLD MAP', 'poster', 14, 24, 16, true, 0xd8c08a, 0x6a5230, 'SOMEWHERE ELSE'),
  F('fur_poster_film', 'FILM POSTER', 'poster', 16, 14, 20, true, 0x2a2a3a, 0xe8d060, 'ONE NIGHT ONLY'),
  F('fur_paint_frog', 'FROG IN OILS', 'painting', 140, 22, 20, true, 0x3a7a42, 0xe8d8a8, 'HE IS WATCHING YOU'),
  F('fur_mirror_wall', 'WALL MIRROR', 'decor', 48, 16, 22, true, 0xdfe8ee, 0x8a9098, 'CHECK YOURSELF'),
  F('fur_shelf_wall', 'FLOATING SHELF', 'storage', 22, 26, 6, true, 0x8a5a32, 0x5a3a1e, 'FOR LITTLE THINGS'),
  F('fur_table_coffee', 'COFFEE TABLE', 'table', 48, 26, 9, false, 0x6a4a2a, 0x4a3018, 'RINGS ON THE TOP'),
  F('fur_desk', 'WRITING DESK', 'table', 85, 30, 16, false, 0x7a5230, 0x4a3018, 'A DRAWER THAT STICKS'),
  F('fur_chair_office', 'SWIVEL CHAIR', 'chair', 45, 12, 18, false, 0x2a2a34, 0x4a4a58, 'IT SPINS'),
  F('fur_chair_bean', 'BEAN BAG', 'chair', 26, 18, 12, false, 0x8a4a7a, 0xc07aaa, 'SWALLOWS YOU WHOLE'),
  F('fur_sofa_corner', 'CORNER SOFA', 'sofa', 190, 48, 18, false, 0x4a6a5a, 0x2e4a3c, 'ROOM FOR EVERYONE'),
  F('fur_tv_crt', 'PORTABLE TV', 'tv', 45, 14, 13, false, 0x6a6a60, 0x8ac0c8, 'A HANDLE ON TOP'),
  F('fur_record_player', 'RECORD PLAYER', 'radio', 110, 18, 10, false, 0x5a3a22, 0xd8c8a0, 'CRACKLES BEAUTIFULLY'),
  F('fur_lamp_desk', 'DESK LAMP', 'lamp', 20, 8, 14, false, 0x2a6a8a, 0xf0e0a0, 'A POOL OF LIGHT'),
  F('fur_lamp_paper', 'PAPER LANTERN', 'lamp', 34, 14, 14, false, 0xf0ead8, 0xc8bfa8, 'SOFT AND ROUND'),
  F('fur_rug_rag', 'RAG RUG', 'rug', 12, 32, 5, false, 0x8a6a8a, 0xd8c070, 'MADE OF OLD CLOTHES'),
  F('fur_chest', 'STORAGE CHEST', 'storage', 40, 24, 14, false, 0x6a4a2a, 0xc8a050, 'A LID THAT SHUTS'),
  F('fur_wardrobe', 'WARDROBE', 'storage', 130, 24, 32, false, 0x7a5230, 0x4a3018, 'ROOM FOR A COAT'),
  F('fur_plant_tall', 'TALL PLANT', 'decor', 26, 14, 26, false, 0x2f7a3a, 0xa86a40, 'NEEDS WATERING'),
  F('fur_bookcase_tall', 'TALL BOOKCASE', 'storage', 95, 22, 38, false, 0x5a3a22, 0xc8b070, 'TO THE CEILING'),
  F('fur_bed_double', 'DOUBLE BED', 'bed', 260, 46, 14, false, 0x6a3a5a, 0xf0e8d8, 'THE GOOD ONE'),
  F('fur_shower', 'SHOWER', 'bath', 190, 20, 34, false, 0xdfe8ee, 0x8ac0e0, 'HOT WATER, EVENTUALLY'),
  F('fur_bath_mat', 'BATH MAT', 'bath', 8, 20, 4, false, 0x7ab0c8, 0xc8e4f0, 'WARM UNDERFOOT'),
  F('fur_trophy', 'ARCADE TROPHY', 'decor', 0, 10, 14, false, 0xd8a838, 0x8a6a28, 'EARNED, NOT BOUGHT', true),
  F('fur_frog_statue', 'FROG STATUE', 'decor', 0, 14, 18, false, 0x5aa85f, 0x2f6b36, 'EARNED, NOT BOUGHT', true),
];

// ------------------------------------------------------------- cosmetics

export type CosmeticSlot = 'top' | 'legs' | 'shoes' | 'scarf' | 'hair' | 'dye' | 'hat';

export interface CosmeticDef {
  id: string;
  name: string;
  slot: CosmeticSlot;
  /** Where it is sold. */
  shop: 'clothes' | 'barber';
  price: number;
  /** Colours by the rig's letters (see art/player COLS). */
  cols: Partial<Record<string, number>>;
  /** For hats and hairstyles: the head rows. */
  head?: string[];
  reward?: boolean;
}

const C3 = (main: number, lit: number, shade: number) => ({ C: main, c: lit, D: shade });

/** Hair rows: a bare head with hair, the drifter's face and beard below. */
const HEAD_SHORT = ['............', '...rrrrrr...', '..rrrrrrrr..', '..rSSSSSSr..', '..rSSSSSSs..', '...SSSSSs...', '...GGGGGg...', '....GGGg....', '.....gg.....'];
const HEAD_LONG = ['...rrrrrr...', '..rrrrrrrr..', '.rrrrrrrrrr.', '.rrSSSSSSrr.', '.rrSSSSSSsr.', '.rr.SSSSsrr.', '.rr.GGGGgrr.', '.r...GGGg.r.', '.....gg.....'];
const HEAD_MOHAWK = ['.....rr.....', '.....rr.....', '....rrrr....', '..sSSSSSSs..', '..sSSSSSSs..', '...SSSSSs...', '...GGGGGg...', '....GGGg....', '.....gg.....'];
const HEAD_BALD = ['............', '............', '...SSSSSS...', '..SSSSSSSS..', '..sSSSSSSs..', '...SSSSSs...', '...GGGGGg...', '....GGGg....', '.....gg.....'];
const HEAD_SHAVEN = ['............', '...rrrrrr...', '..rrrrrrrr..', '..rSSSSSSr..', '..rSSSSSSs..', '...SSSSSs...', '...SSSSSs...', '....SSSs....', '.....ss.....'];
const HEAD_POMP = ['...rrrrrrr..', '..rrrrrrrrr.', '..rrrrrrrr..', '..rSSSSSSr..', '..SSSSSSSs..', '...SSSSSs...', '...SSSSSs...', '....SSSs....', '.....ss.....'];
const HEAD_SIDEPART = ['............', '..rrrrrrrr..', '..rrrSrrrrr.', '..rSSSSSSr..', '..rSSSSSSs..', '...SSSSSs...', '...GGGGGg...', '....GGGg....', '.....gg.....'];
const HEAD_BUZZ = ['............', '............', '...rrrrrr...', '..rSSSSSSr..', '..sSSSSSSs..', '...SSSSSs...', '...SSSSSs...', '....SSSs....', '.....ss.....'];
const HEAD_AFRO = ['..rrrrrrrr..', '.rrrrrrrrrr.', '.rrrrrrrrrr.', '.rrSSSSSSrr.', '.rrSSSSSSsr.', '..rSSSSSsr..', '...GGGGGg...', '....GGGg....', '.....gg.....'];
const HEAD_BUN = ['.....rr.....', '....rrrr....', '...rrrrrr...', '..rSSSSSSr..', '..rSSSSSSs..', '...SSSSSs...', '...GGGGGg...', '....GGGg....', '.....gg.....'];
const HEAD_SLICK = ['............', '...rrrrrr...', '..rrrrrrrrr.', '..rSSSSSSr..', '..sSSSSSSs..', '...SSSSSs...', '...SGGGSs...', '....SSSs....', '.....ss.....'];
const HEAD_CAP = ['............', '...BBBBBB...', '..BBBBBBBB..', '..bbbbbbbbbb', '..rSSSSSSs..', '...SSSSSs...', '...GGGGGg...', '....GGGg....', '.....gg.....'];

export const COSMETICS: CosmeticDef[] = [
  // tops (the coat)
  { id: 'cos_coat_olive', name: 'OLD ARMY COAT', slot: 'top', shop: 'clothes', price: 0, cols: C3(0x6a6a44, 0x7e7e54, 0x4a4a30) },
  { id: 'cos_hoodie_grey', name: 'GREY HOODIE', slot: 'top', shop: 'clothes', price: 12, cols: C3(0x8a8a90, 0xa0a0a8, 0x6a6a70) },
  { id: 'cos_hoodie_red', name: 'RED HOODIE', slot: 'top', shop: 'clothes', price: 15, cols: C3(0xb03838, 0xc84a4a, 0x802828) },
  { id: 'cos_jacket_denim', name: 'DENIM JACKET', slot: 'top', shop: 'clothes', price: 30, cols: C3(0x3a5a8a, 0x4a6ea0, 0x2a4068) },
  { id: 'cos_jacket_leather', name: 'LEATHER JACKET', slot: 'top', shop: 'clothes', price: 70, cols: C3(0x2a1e18, 0x3a2a22, 0x1a120e) },
  { id: 'cos_suit', name: 'SHARP SUIT', slot: 'top', shop: 'clothes', price: 150, cols: C3(0x2a2a3a, 0x3a3a52, 0x1a1a28) },
  { id: 'cos_frog_jacket', name: 'FROGGY JACKET', slot: 'top', shop: 'clothes', price: 0, cols: C3(0x3d7a42, 0x5aa85f, 0x24492a), reward: true },
  // legs
  { id: 'cos_trousers_baggy', name: 'BAGGY TROUSERS', slot: 'legs', shop: 'clothes', price: 0, cols: { J: 0x5a5048, j: 0x463e38 } },
  { id: 'cos_jeans', name: 'BLUE JEANS', slot: 'legs', shop: 'clothes', price: 14, cols: { J: 0x3a5078, j: 0x2a3a5a } },
  { id: 'cos_chinos', name: 'CHINOS', slot: 'legs', shop: 'clothes', price: 18, cols: { J: 0xb09a70, j: 0x8a7850 } },
  { id: 'cos_black_trousers', name: 'BLACK TROUSERS', slot: 'legs', shop: 'clothes', price: 25, cols: { J: 0x1e1e24, j: 0x141418 } },
  // shoes
  { id: 'cos_boots_worn', name: 'WORN BOOTS', slot: 'shoes', shop: 'clothes', price: 0, cols: { K: 0x3a2a1e, W: 0x6a5a48, T: 0xc8b8a0 } },
  { id: 'cos_sneakers', name: 'WHITE SNEAKERS', slot: 'shoes', shop: 'clothes', price: 16, cols: { K: 0xe8e8e8, W: 0xa0a0a0, T: 0xe8e8e8 } },
  { id: 'cos_dress_shoes', name: 'DRESS SHOES', slot: 'shoes', shop: 'clothes', price: 40, cols: { K: 0x141010, W: 0x2a2020, T: 0x141010 } },
  // scarf / accessories
  { id: 'cos_scarf_grubby', name: 'GRUBBY SCARF', slot: 'scarf', shop: 'clothes', price: 0, cols: { w: 0x9a9480 } },
  { id: 'cos_scarf_red', name: 'RED SCARF', slot: 'scarf', shop: 'clothes', price: 8, cols: { w: 0xc83a3a } },
  { id: 'cos_scarf_gold', name: 'GOLD SCARF', slot: 'scarf', shop: 'clothes', price: 35, cols: { w: 0xd8a838 } },
  // hats (the beanie is the drifter's own)
  { id: 'cos_beanie', name: 'MAROON BEANIE', slot: 'hat', shop: 'clothes', price: 0, cols: { B: 0x5a3a3a, b: 0x7a5050 } },
  { id: 'cos_beanie_teal', name: 'TEAL BEANIE', slot: 'hat', shop: 'clothes', price: 9, cols: { B: 0x2a7a78, b: 0x46c4bd } },
  { id: 'cos_cap', name: 'BASEBALL CAP', slot: 'hat', shop: 'clothes', price: 12, cols: { B: 0x2a4a8a, b: 0x3a5aa0 }, head: HEAD_CAP },
  { id: 'cos_no_hat', name: 'NO HAT', slot: 'hat', shop: 'clothes', price: 0, cols: {} },
  // hair (barber): only seen with NO HAT
  { id: 'hair_short', name: 'SHORT CUT', slot: 'hair', shop: 'barber', price: 8, cols: {}, head: HEAD_SHORT },
  { id: 'hair_long', name: 'LONG HAIR', slot: 'hair', shop: 'barber', price: 14, cols: {}, head: HEAD_LONG },
  { id: 'hair_mohawk', name: 'MOHAWK', slot: 'hair', shop: 'barber', price: 20, cols: {}, head: HEAD_MOHAWK },
  { id: 'hair_bald', name: 'CLEAN SHAVE', slot: 'hair', shop: 'barber', price: 6, cols: {}, head: HEAD_BALD },
  { id: 'hair_shaven', name: 'SHORT, NO BEARD', slot: 'hair', shop: 'barber', price: 12, cols: {}, head: HEAD_SHAVEN },
  { id: 'hair_pomp', name: 'POMPADOUR', slot: 'hair', shop: 'barber', price: 25, cols: {}, head: HEAD_POMP },
  { id: 'hair_sidepart', name: 'SIDE PART', slot: 'hair', shop: 'barber', price: 15, cols: {}, head: HEAD_SIDEPART },
  { id: 'hair_buzz', name: 'BUZZ CUT', slot: 'hair', shop: 'barber', price: 8, cols: {}, head: HEAD_BUZZ },
  { id: 'hair_afro', name: 'AFRO', slot: 'hair', shop: 'barber', price: 22, cols: {}, head: HEAD_AFRO },
  { id: 'hair_bun', name: 'TOP KNOT', slot: 'hair', shop: 'barber', price: 18, cols: {}, head: HEAD_BUN },
  { id: 'hair_slick', name: 'SLICKED BACK + TASH', slot: 'hair', shop: 'barber', price: 28, cols: {}, head: HEAD_SLICK },
  { id: 'hair_col_brown', name: 'DYE: BROWN', slot: 'dye', shop: 'barber', price: 5, cols: { r: 0x5a4a3a, G: 0x6a5040, g: 0x4a3828 } },
  { id: 'hair_col_black', name: 'DYE: BLACK', slot: 'dye', shop: 'barber', price: 7, cols: { r: 0x1e1814, G: 0x2a2420, g: 0x1a1612 } },
  { id: 'hair_col_blond', name: 'DYE: BLOND', slot: 'dye', shop: 'barber', price: 10, cols: { r: 0xd8b060, G: 0xc8a050, g: 0xa88038 } },
  { id: 'hair_col_pink', name: 'DYE: PINK', slot: 'dye', shop: 'barber', price: 15, cols: { r: 0xff4fa3, G: 0xe04090, g: 0xb03070 } },
];

/** The cosmetics the drifter starts in, owned from the beginning. */
export const STARTER_COSMETICS = ['cos_coat_olive', 'cos_trousers_baggy', 'cos_boots_worn', 'cos_scarf_grubby', 'cos_beanie', 'cos_no_hat'];

/**
 * ---- WHAT IS ON THE FLOOR TODAY.
 *
 * Home and Hearth is a shop, not a catalogue: it puts out a dozen pieces at
 * a time and the van brings something different tomorrow.  The day decides
 * it, the same way for everybody, so a player who wants the velvet sofa can
 * come back for it -- and the four things a flat cannot do without (a bed, a
 * toilet, a basin and a mat) are always in, because being unable to buy a
 * toilet for three days is not an interesting shop.
 *
 * `day` is the life clock's day number (game/life `clock`).
 */
export const STOCK_ALWAYS = ['fur_mattress', 'fur_toilet', 'fur_sink', 'fur_rug_mat'];
/** How many of the rest are out on any one day. */
export const STOCK_ROTATING = 12;

export function stockFor(day: number): FurnitureDef[] {
  const pool = FURNITURE.filter((f) => !f.reward && f.price > 0 && !STOCK_ALWAYS.includes(f.id));
  // a shuffle the day seeds: the same day gives the same shop, everywhere
  const order = pool.map((f, i) => ({ f, k: hash(day * 7919 + i * 104729) }));
  order.sort((a, b) => a.k - b.k);
  const out = STOCK_ALWAYS.map((id) => furnitureById(id)!).filter(Boolean);
  out.push(...order.slice(0, STOCK_ROTATING).map((o) => o.f));
  // cheapest first inside each kind, so the list reads like a price list
  return out.sort((a, b) => Number(a.wall) - Number(b.wall) || a.price - b.price);
}

function hash(n: number): number {
  let x = (n ^ 0x9e3779b9) >>> 0;
  x = (x ^ (x >>> 16)) * 0x45d9f3b;
  x = (x ^ (x >>> 16)) * 0x45d9f3b;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

export const furnitureById = (id: string): FurnitureDef | undefined => FURNITURE.find((f) => f.id === id);
export const cosmeticById = (id: string): CosmeticDef | undefined => COSMETICS.find((c) => c.id === id);

/** The look the player's rig is drawn in, from what they have on. */
export function lookFor(outfit: Record<string, string>): Look {
  const cols: Partial<Record<string, number>> = {};
  let head: string[] | undefined;
  // hair first, then the hat over it
  const hairStyle = Object.values(outfit)
    .map((id) => cosmeticById(id))
    .filter((c): c is CosmeticDef => !!c);
  for (const c of hairStyle) {
    if (c.slot === 'hair' && c.head) head = c.head;
  }
  for (const c of hairStyle) Object.assign(cols, c.cols);
  const hat = outfit.hat ? cosmeticById(outfit.hat) : undefined;
  if (hat && hat.id !== 'cos_no_hat') {
    // A haircut of your own: the hat goes ON it -- its crown over the top of
    // the head, and the cut still there under the brim (the beard, the
    // sideburns, long hair down the sides, an afro wider than the hat).
    // Without one, the hat's own head, as before (the beanie: the rig's).
    head = head ? underHat(head, CROWNS[hat.id] ?? CROWNS.cos_beanie) : hat.head;
  }
  if (hat?.id === 'cos_no_hat' && !head) head = HEAD_SHORT;
  return { cols, head };
}

/** The top rows of each hat: what it covers of the head. */
const CROWNS: Record<string, string[]> = {
  cos_beanie: ['....BBBB....', '...BBBBBB...', '..bbbbbbbb..'],
  cos_beanie_teal: ['....BBBB....', '...BBBBBB...', '..bbbbbbbb..'],
  cos_cap: ['............', '...BBBBBB...', '..BBBBBBBB..', '..bbbbbbbbbb'],
};

/**
 * `hair` with `crown` on it.  The crown's own pixels always show; over its
 * rows, hair shows only where it stands out wider than the brim; under them,
 * the cut is as it was.
 */
export function underHat(hair: string[], crown: string[]): string[] {
  const brim = crown[crown.length - 1];
  const l = brim.search(/[^.]/);
  const r = brim.length - 1 - [...brim].reverse().join('').search(/[^.]/);
  return hair.map((row, i) => {
    if (i >= crown.length) return row;
    const c = crown[i];
    return [...row]
      .map((ch, x) => (c[x] !== '.' ? c[x] : ch !== '.' && (x < l || x > r) ? ch : '.'))
      .join('');
  });
}
