/**
 * ---- WHAT THERE IS TO BUY.  Data only, by stable id: the shops, the condo,
 * the missions and the save all refer to things by these ids, so a line can
 * be added here without touching any of them.
 *
 *   FOODS      eaten or drunk: food, water and drinks, cheap to premium
 *   INGREDIENTS for cooking in the condo
 *   RECIPES     what the ingredients make, and how long it takes
 *   FURNITURE   for the condo, by category, with a size on the floor
 *   COSMETICS   clothes and hair, as recolours of the drifter's own rig
 */

import type { Look } from '../art/player';

// ------------------------------------------------------------------ food

export type FoodTier = 'cheap' | 'standard' | 'premium';

export interface FoodDef {
  id: string;
  name: string;
  /** Cash, at the shop.  0 = cannot be bought (only cooked or given). */
  price: number;
  /** Fullness restored, 0..100. */
  hunger: number;
  /** Hydration restored, 0..100 (may be negative: salty food). */
  thirst: number;
  /** Energy restored. */
  energy: number;
  tier: FoodTier;
  /** Where it is sold: 'market' (the corner shop), or nowhere ('cooked'). */
  sold: 'market' | 'cooked';
  note: string;
  colour: number;
}

export const FOODS: FoodDef[] = [
  // ---- water: always cheap, always there
  { id: 'water', name: 'BOTTLE OF WATER', price: 1, hunger: 0, thirst: 40, energy: 0, tier: 'cheap', sold: 'market', note: 'THE ESSENTIAL', colour: 0x8fd0f0 },
  { id: 'water_big', name: 'BIG WATER JUG', price: 3, hunger: 0, thirst: 100, energy: 0, tier: 'cheap', sold: 'market', note: 'A WHOLE DAY OF WATER', colour: 0x6fb8e8 },
  // ---- cheap food: enough to live on
  { id: 'bread', name: 'BREAD ROLL', price: 2, hunger: 20, thirst: -2, energy: 2, tier: 'cheap', sold: 'market', note: 'CHEAP AND FILLING ENOUGH', colour: 0xd8a860 },
  { id: 'apple', name: 'APPLE', price: 2, hunger: 12, thirst: 8, energy: 3, tier: 'cheap', sold: 'market', note: 'CRISP', colour: 0xd84838 },
  { id: 'noodle_cup', name: 'CUP NOODLES', price: 3, hunger: 30, thirst: -8, energy: 4, tier: 'cheap', sold: 'market', note: 'SALTY. DRINK SOMETHING', colour: 0xe8c048 },
  { id: 'banana', name: 'BANANA', price: 2, hunger: 15, thirst: 2, energy: 8, tier: 'cheap', sold: 'market', note: 'QUICK ENERGY', colour: 0xf0d850 },
  // ---- standard
  { id: 'sandwich', name: 'SANDWICH', price: 6, hunger: 40, thirst: 0, energy: 6, tier: 'standard', sold: 'market', note: 'A PROPER LUNCH', colour: 0xe0c090 },
  { id: 'soup_can', name: 'TIN OF SOUP', price: 5, hunger: 30, thirst: 12, energy: 5, tier: 'standard', sold: 'market', note: 'WARM AND WET', colour: 0xc86040 },
  { id: 'coffee', name: 'COFFEE', price: 3, hunger: 0, thirst: 10, energy: 22, tier: 'standard', sold: 'market', note: 'WAKES YOU UP', colour: 0x6a4028 },
  { id: 'juice', name: 'ORANGE JUICE', price: 4, hunger: 4, thirst: 45, energy: 6, tier: 'standard', sold: 'market', note: 'FRESH SQUEEZED', colour: 0xf09828 },
  // ---- premium: nice, never needed
  { id: 'sushi', name: 'SUSHI BOX', price: 24, hunger: 55, thirst: 4, energy: 12, tier: 'premium', sold: 'market', note: 'PREMIUM. A TREAT', colour: 0xf0f0e8 },
  { id: 'steak', name: 'STEAK DINNER', price: 38, hunger: 85, thirst: 0, energy: 18, tier: 'premium', sold: 'market', note: 'PREMIUM. FILLS YOU UP', colour: 0x8a3a28 },
  { id: 'cake', name: 'BAKERY CAKE', price: 16, hunger: 30, thirst: -4, energy: 16, tier: 'premium', sold: 'market', note: 'PREMIUM. SWEET', colour: 0xf0a8c8 },
  { id: 'smoothie', name: 'BERRY SMOOTHIE', price: 12, hunger: 12, thirst: 50, energy: 14, tier: 'premium', sold: 'market', note: 'PREMIUM. COLD', colour: 0xb05090 },
  // ---- cooked at home (see RECIPES)
  { id: 'meal_fried_rice', name: 'FRIED RICE', price: 0, hunger: 50, thirst: -4, energy: 10, tier: 'standard', sold: 'cooked', note: 'HOME COOKED', colour: 0xe0c070 },
  { id: 'meal_omelette', name: 'OMELETTE', price: 0, hunger: 38, thirst: 0, energy: 12, tier: 'standard', sold: 'cooked', note: 'HOME COOKED', colour: 0xf0d860 },
  { id: 'meal_noodle_soup', name: 'NOODLE SOUP', price: 0, hunger: 42, thirst: 20, energy: 8, tier: 'standard', sold: 'cooked', note: 'HOME COOKED', colour: 0xd89848 },
  { id: 'meal_veg_stew', name: 'VEGETABLE STEW', price: 0, hunger: 55, thirst: 15, energy: 10, tier: 'standard', sold: 'cooked', note: 'HOME COOKED', colour: 0xa86030 },
  { id: 'meal_pancakes', name: 'PANCAKES', price: 0, hunger: 40, thirst: -2, energy: 18, tier: 'standard', sold: 'cooked', note: 'HOME COOKED', colour: 0xe8b860 },
  { id: 'meal_steak_rice', name: 'STEAK AND RICE', price: 0, hunger: 75, thirst: 0, energy: 20, tier: 'premium', sold: 'cooked', note: 'HOME COOKED. HEARTY', colour: 0x9a4a30 },
  { id: 'meal_tomato_pasta', name: 'TOMATO PASTA', price: 0, hunger: 52, thirst: 4, energy: 12, tier: 'standard', sold: 'cooked', note: 'HOME COOKED', colour: 0xd04830 },
];

export interface IngredientDef {
  id: string;
  name: string;
  price: number;
  colour: number;
}

export const INGREDIENTS: IngredientDef[] = [
  { id: 'ing_rice', name: 'RICE', price: 2, colour: 0xf0ece0 },
  { id: 'ing_egg', name: 'EGG', price: 1, colour: 0xf8f0d8 },
  { id: 'ing_veg', name: 'VEGETABLES', price: 2, colour: 0x58a848 },
  { id: 'ing_noodles', name: 'DRY NOODLES', price: 2, colour: 0xe8d088 },
  { id: 'ing_meat', name: 'MEAT', price: 6, colour: 0xb04a40 },
  { id: 'ing_cheese', name: 'CHEESE', price: 3, colour: 0xf0c840 },
  { id: 'ing_flour', name: 'FLOUR', price: 2, colour: 0xf4f0e8 },
  { id: 'ing_milk', name: 'MILK', price: 2, colour: 0xf8f8f8 },
  { id: 'ing_tomato', name: 'TOMATOES', price: 1, colour: 0xe04030 },
  { id: 'ing_spice', name: 'SPICES', price: 1, colour: 0xc87830 },
];

export interface RecipeDef {
  id: string;
  name: string;
  needs: Record<string, number>;
  /** Seconds of cooking (game-active seconds). */
  seconds: number;
  makes: string;
}

export const RECIPES: RecipeDef[] = [
  { id: 'rcp_fried_rice', name: 'FRIED RICE', needs: { ing_rice: 1, ing_egg: 1, ing_veg: 1 }, seconds: 20, makes: 'meal_fried_rice' },
  { id: 'rcp_omelette', name: 'OMELETTE', needs: { ing_egg: 2, ing_cheese: 1 }, seconds: 12, makes: 'meal_omelette' },
  { id: 'rcp_noodle_soup', name: 'NOODLE SOUP', needs: { ing_noodles: 1, ing_veg: 1, ing_spice: 1 }, seconds: 18, makes: 'meal_noodle_soup' },
  { id: 'rcp_veg_stew', name: 'VEGETABLE STEW', needs: { ing_veg: 2, ing_tomato: 1, ing_spice: 1 }, seconds: 30, makes: 'meal_veg_stew' },
  { id: 'rcp_pancakes', name: 'PANCAKES', needs: { ing_flour: 1, ing_egg: 1, ing_milk: 1 }, seconds: 16, makes: 'meal_pancakes' },
  { id: 'rcp_steak_rice', name: 'STEAK AND RICE', needs: { ing_meat: 1, ing_rice: 1, ing_spice: 1 }, seconds: 25, makes: 'meal_steak_rice' },
  { id: 'rcp_tomato_pasta', name: 'TOMATO PASTA', needs: { ing_noodles: 1, ing_tomato: 2, ing_cheese: 1 }, seconds: 20, makes: 'meal_tomato_pasta' },
];

// ------------------------------------------------------------- furniture

export type FurnitureCat = 'painting' | 'poster' | 'table' | 'chair' | 'sofa' | 'tv' | 'radio' | 'lamp' | 'rug' | 'storage' | 'decor' | 'bed';

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
  F('fur_paint_lily', 'LILY PAD PAINTING', 'painting', 40, 24, 18, true, 0x2f6b36, 0xf0a8c8, 'OIL ON CANVAS'),
  F('fur_paint_sea', 'SEASCAPE', 'painting', 65, 28, 18, true, 0x2a5a8a, 0xe8e0c8, 'A STORMY HARBOUR'),
  F('fur_paint_gold', 'GILT PORTRAIT', 'painting', 180, 22, 26, true, 0xd8a838, 0x5a3a28, 'LATE COLLECTION'),
  F('fur_clock', 'WALL CLOCK', 'decor', 15, 10, 10, true, 0xf0ece0, 0x3a2a1e, 'TICKS QUIETLY'),
  // floor
  F('fur_table_crate', 'CRATE TABLE', 'table', 6, 20, 10, false, 0x9a7048, 0x6a4a2a, 'A CRATE. IT WORKS'),
  F('fur_table_wood', 'WOODEN TABLE', 'table', 35, 28, 12, false, 0x8a5a32, 0x5a3a1e, 'SOLID PINE'),
  F('fur_table_glass', 'GLASS TABLE', 'table', 120, 30, 10, false, 0xb8d8e8, 0x6a7a8a, 'LATE COLLECTION'),
  F('fur_chair_stool', 'STOOL', 'chair', 5, 8, 12, false, 0x8a6a48, 0x5a4028, 'THREE LEGS'),
  F('fur_chair_wood', 'WOODEN CHAIR', 'chair', 18, 10, 18, false, 0x7a4a28, 0x4a2a18, 'STURDY'),
  F('fur_chair_arm', 'ARMCHAIR', 'chair', 60, 16, 18, false, 0x7b2a3a, 0x4a1a24, 'DEEP AND SOFT'),
  F('fur_sofa_old', 'SECOND-HAND SOFA', 'sofa', 30, 40, 16, false, 0x6a6a44, 0x4a4a30, 'A FEW STAINS'),
  F('fur_sofa_new', 'VELVET SOFA', 'sofa', 140, 44, 18, false, 0x3a2a6a, 0x241a48, 'LATE COLLECTION'),
  F('fur_tv_old', 'OLD TV', 'tv', 25, 18, 16, false, 0x3a3a3a, 0x7ab0c0, 'TWO CHANNELS'),
  F('fur_tv_flat', 'FLAT SCREEN', 'tv', 150, 30, 20, false, 0x14161c, 0x46c4bd, 'BIG AND BRIGHT'),
  F('fur_radio', 'RADIO', 'radio', 12, 12, 8, false, 0x8a5a32, 0xe8d0a0, 'TINNY BUT CHEERFUL'),
  F('fur_radio_retro', 'RETRO RADIO', 'radio', 45, 14, 10, false, 0xc87830, 0xf0e0b0, 'WARM VALVES'),
  F('fur_lamp_floor', 'FLOOR LAMP', 'lamp', 14, 8, 30, false, 0xf0d890, 0x3a3a3a, 'A WARM CORNER'),
  F('fur_lamp_neon', 'NEON FROG LAMP', 'lamp', 55, 14, 16, false, 0x6dd36d, 0xff4fa3, 'BUZZES SOFTLY'),
  F('fur_rug_mat', 'DOOR MAT', 'rug', 4, 24, 4, false, 0x8a6a48, 0x5a4028, 'WELCOME'),
  F('fur_rug_round', 'ROUND RUG', 'rug', 22, 40, 6, false, 0xc85a3a, 0xf0c070, 'COSY'),
  F('fur_rug_persian', 'PERSIAN RUG', 'rug', 110, 60, 8, false, 0x8a2a3a, 0xd8a838, 'LATE COLLECTION'),
  F('fur_shelf', 'BOOKSHELF', 'storage', 28, 18, 30, false, 0x7a4a28, 0xc8b070, 'FULL OF PAPERBACKS'),
  F('fur_cabinet', 'CABINET', 'storage', 40, 20, 20, false, 0x5a3a28, 0x8a6a48, 'FOR YOUR THINGS'),
  F('fur_plant', 'POT PLANT', 'decor', 9, 10, 16, false, 0x3a8a3a, 0xa86a40, 'GREEN'),
  F('fur_mattress', 'MATTRESS', 'bed', 20, 40, 6, false, 0xe8e0c8, 0x9a9480, 'BETTER THAN THE FLOOR'),
  F('fur_bed', 'PROPER BED', 'bed', 90, 44, 14, false, 0x7b2a3a, 0xe8e0c8, 'SLEEP LIKE A KING'),
  // reward-only
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
  { id: 'hair_col_brown', name: 'DYE: BROWN', slot: 'dye', shop: 'barber', price: 5, cols: { r: 0x5a4a3a, G: 0x6a5040, g: 0x4a3828 } },
  { id: 'hair_col_black', name: 'DYE: BLACK', slot: 'dye', shop: 'barber', price: 7, cols: { r: 0x1e1814, G: 0x2a2420, g: 0x1a1612 } },
  { id: 'hair_col_blond', name: 'DYE: BLOND', slot: 'dye', shop: 'barber', price: 10, cols: { r: 0xd8b060, G: 0xc8a050, g: 0xa88038 } },
  { id: 'hair_col_pink', name: 'DYE: PINK', slot: 'dye', shop: 'barber', price: 15, cols: { r: 0xff4fa3, G: 0xe04090, g: 0xb03070 } },
];

/** The cosmetics the drifter starts in, owned from the beginning. */
export const STARTER_COSMETICS = ['cos_coat_olive', 'cos_trousers_baggy', 'cos_boots_worn', 'cos_scarf_grubby', 'cos_beanie', 'cos_no_hat'];

export const foodById = (id: string): FoodDef | undefined => FOODS.find((f) => f.id === id);
export const ingredientById = (id: string): IngredientDef | undefined => INGREDIENTS.find((f) => f.id === id);
export const recipeById = (id: string): RecipeDef | undefined => RECIPES.find((r) => r.id === id);
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
  if (hat && hat.id !== 'cos_no_hat') head = hat.head; // the beanie: the rig's own head
  if (hat?.id === 'cos_no_hat' && !head) head = HEAD_SHORT;
  return { cols, head };
}
