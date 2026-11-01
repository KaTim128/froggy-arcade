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
  F('fur_sleeping_bag', 'SLEEPING BAG', 'bed', 10, 38, 5, false, 0x3a6a5a, 0x2a3450, 'COMES WITH THE UNIT. SWAP IT FOR A BED'),
  F('fur_mattress', 'MATTRESS', 'bed', 20, 40, 6, false, 0xe8e0c8, 0x9a9480, 'BETTER THAN THE FLOOR'),
  F('fur_bed', 'SINGLE BED', 'bed', 120, 32, 13, false, 0x3a5a8a, 0xe8e0c8, 'A SMALL BED, ALL YOURS'),
  // the flat comes without a bathroom fitted: these are bought and put in
  F('fur_toilet', 'TOILET', 'bath', 60, 12, 16, false, 0xf2f2ee, 0xc8d0d8, 'A FLAT NEEDS ONE'),
  F('fur_sink', 'WASH BASIN', 'bath', 45, 14, 18, false, 0xf2f2ee, 0x9aa8b4, 'HOT AND COLD'),
  F('fur_bathtub', 'BATHTUB', 'bath', 150, 40, 14, false, 0xf2f2ee, 0x8ac0e0, 'A LONG HOT SOAK'),
  // and for its walls: the flat has bare tile where these go
  F('fur_bath_mirror', 'BATHROOM MIRROR', 'bath', 35, 22, 24, true, 0xc8a040, 0xcfdde2, 'WITH A LIGHT OVER IT'),
  F('fur_towel_rail', 'TOWEL RAIL', 'bath', 18, 18, 14, true, 0xc4c8cc, 0x3a7a80, 'TWO FRESH TOWELS'),
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
  F('fur_bed_premium', 'PREMIUM BED', 'bed', 700, 56, 26, false, 0x3a7a80, 0xf6f2ea, 'KING-SIZE. SLEEP LIKE A GUEST'),
  F('fur_bed_double', 'DOUBLE BED', 'bed', 260, 46, 14, false, 0x6a3a5a, 0xf0e8d8, 'THE GOOD ONE'),
  F('fur_shower', 'SHOWER', 'bath', 190, 20, 34, false, 0xdfe8ee, 0x8ac0e0, 'HOT WATER, EVENTUALLY'),
  F('fur_bath_mat', 'BATH MAT', 'bath', 8, 20, 4, false, 0x7ab0c8, 0xc8e4f0, 'WARM UNDERFOOT'),
  // ---- MORE OF THE RANGE (the van brings a different dozen every day)
  // four more mirrors, each its own shape, all of them showing you (rooms/piece)
  F('fur_mirror_round', 'ROUND BRASS MIRROR', 'decor', 40, 18, 18, true, 0xc89a40, 0xdfe8ee, 'LIKE A PORTHOLE'),
  F('fur_mirror_tall', 'DRESSING MIRROR', 'decor', 75, 14, 34, true, 0x6a4a2a, 0xdfe8ee, 'HEAD TO TOE'),
  F('fur_mirror_sunburst', 'SUNBURST MIRROR', 'decor', 120, 26, 26, true, 0xd8a838, 0xdfe8ee, 'GOLD RAYS ALL ROUND'),
  F('fur_mirror_vanity', 'VANITY MIRROR', 'decor', 95, 26, 22, true, 0xf0ece4, 0xdfe8ee, 'RINGED WITH BULBS'),
  // the same pieces in other colours, and a few new ones
  F('fur_sofa_mustard', 'MUSTARD SOFA', 'sofa', 140, 40, 16, false, 0xc89a30, 0x8a6a1e, 'SEVENTIES AND PROUD'),
  F('fur_sofa_teal', 'TEAL SOFA', 'sofa', 160, 42, 16, false, 0x2a7a78, 0x1a5250, 'CALM AS A POND'),
  F('fur_sofa_rose', 'ROSE SOFA', 'sofa', 175, 42, 16, false, 0xc87a8a, 0x8a4a5a, 'BLUSHING VELVET'),
  F('fur_sofa_leather', 'LEATHER SOFA', 'sofa', 230, 44, 17, false, 0x6a3a22, 0x3a2012, 'CREAKS WHEN YOU SIT'),
  F('fur_chair_painted', 'PAINTED CHAIR', 'chair', 22, 10, 18, false, 0x3a7aa0, 0x2a5070, 'A COAT OF BLUE'),
  F('fur_chair_red', 'RED KITCHEN CHAIR', 'chair', 20, 10, 18, false, 0xb03a3a, 0x702020, 'DINER STYLE'),
  F('fur_table_white', 'WHITE TABLE', 'table', 42, 28, 12, false, 0xf0ece4, 0xa8a49c, 'CLEAN LINES'),
  F('fur_table_walnut', 'WALNUT TABLE', 'table', 90, 30, 12, false, 0x5a3a22, 0x3a2414, 'DARK AND HEAVY'),
  F('fur_lamp_brass', 'BRASS FLOOR LAMP', 'lamp', 48, 8, 30, false, 0xffe0a0, 0xc89a40, 'A GOLDEN GLOW'),
  F('fur_lamp_teal', 'TEAL FLOOR LAMP', 'lamp', 30, 8, 30, false, 0xbff0e8, 0x2a7a78, 'A COOL CORNER'),
  F('fur_rug_blue', 'BLUE ROUND RUG', 'rug', 24, 40, 6, false, 0x3a5a9a, 0xb8c8f0, 'LIKE STANDING IN A POOL'),
  F('fur_rug_green', 'MOSS RUG', 'rug', 28, 40, 6, false, 0x4a7a3a, 0xc8d890, 'SOFT AS A LILY PAD'),
  F('fur_rug_stripe', 'STRIPED RUNNER', 'rug', 18, 36, 5, false, 0xd8a838, 0x3a2a6a, 'BOLD STRIPES'),
  F('fur_shelf_white', 'WHITE BOOKSHELF', 'storage', 34, 18, 30, false, 0xf0ece4, 0x5a8ab0, 'BOOKS IN EVERY COLOUR'),
  F('fur_cabinet_green', 'GREEN CABINET', 'storage', 62, 20, 20, false, 0x3a6a4a, 0xc8a050, 'BRASS HANDLES'),
  F('fur_plant_cactus', 'CACTUS', 'decor', 12, 8, 14, false, 0x4a8a4a, 0xd8784a, 'DO NOT HUG'),
  F('fur_plant_fern', 'FERN', 'decor', 16, 14, 14, false, 0x3a9a4a, 0x8a5a3a, 'FROND OF YOU'),
  F('fur_plant_palm', 'PARLOUR PALM', 'decor', 38, 16, 30, false, 0x2a6a3a, 0xc8b8a0, 'A BIT OF HOLIDAY'),
  F('fur_poster_retro', 'RETRO GAME POSTER', 'poster', 12, 14, 18, true, 0x7b4bd8, 0xff4fa3, 'INSERT COIN'),
  F('fur_poster_jungle', 'JUNGLE POSTER', 'poster', 14, 22, 14, true, 0x2f7a3a, 0xf0d050, 'SOMEWHERE WARM'),
  F('fur_paint_moon', 'MOON OVER WATER', 'painting', 85, 24, 18, true, 0x1a2a5a, 0xf0e8c0, 'QUIET AND BLUE'),
  F('fur_paint_flowers', 'STILL LIFE', 'painting', 70, 18, 22, true, 0x8a3a3a, 0xf0d870, 'FLOWERS IN A JUG'),
  F('fur_bed_green', 'GREEN SINGLE BED', 'bed', 130, 32, 13, false, 0x3a7a4a, 0xf0e8d8, 'LIKE SLEEPING ON A LEAF'),
  F('fur_bed_navy', 'NAVY DOUBLE BED', 'bed', 280, 46, 14, false, 0x2a3a6a, 0xf0e8d8, 'DEEP BLUE DREAMS'),
  F('fur_trophy', 'ARCADE TROPHY', 'decor', 0, 10, 14, false, 0xd8a838, 0x8a6a28, 'EARNED, NOT BOUGHT', true),
  F('fur_frog_statue', 'FROG STATUE', 'decor', 0, 14, 18, false, 0x5aa85f, 0x2f6b36, 'EARNED, NOT BOUGHT', true),
];

// ------------------------------------------------------------- cosmetics

/**
 * GLASSES, over the eye row and the one under it (the head is 12 wide, the
 * eyes at columns 5 and 7).  Two lenses with a bridge between them and an arm
 * back to the hair, each lens two by two with a glint on it: a single dark
 * line across the face read as a blindfold, not a pair of glasses.
 */
const SHADES = ['..qqQLqQLq..', '....QQ.QQ...'];
/** Reading specs: thin frames round the eyes, the glass pale where it catches the light. */
const SPECS = ['..qqlEqElq..', '....qq.qq...'];

export type CosmeticSlot = 'top' | 'legs' | 'shoes' | 'scarf' | 'hair' | 'dye' | 'hat' | 'glasses';

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
  /** For glasses: the rows over the eyes. */
  glasses?: string[];
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
// ---- more cuts: the barber's book has four of these out on any one day (see `cosmeticStockFor`)
const HEAD_BOWL = ['............', '...rrrrrr...', '..rrrrrrrr..', '..rrrrrrrr..', '..rSSSSSSr..', '...SSSSSs...', '...SSSSSs...', '....SSSs....', '.....ss.....'];
const HEAD_CURTAINS = ['............', '...rrrrrr...', '..rrrrrrrr..', '..rrSSSSrr..', '..rSSSSSSr..', '..rSSSSSsr..', '...GGGGGg...', '....GGGg....', '.....gg.....'];
const HEAD_SPIKES = ['..r.r..r.r..', '..rrrrrrrr..', '..rrrrrrrr..', '..rSSSSSSr..', '..sSSSSSSs..', '...SSSSSs...', '...SSSSSs...', '....SSSs....', '.....ss.....'];
const HEAD_MULLET = ['............', '...rrrrrr...', '..rrrrrrrr..', '..rSSSSSSr..', '.rrSSSSSSs..', '.rr.SSSSs...', '.rr.GGGGg...', '.r...GGg....', '.....gg.....'];
const HEAD_PONYTAIL = ['............', '...rrrrrr...', '..rrrrrrrr..', '..rSSSSSSr.r', '..rSSSSSSsrr', '...SSSSSs.r.', '...SSSSSs...', '....SSSs....', '.....ss.....'];
const HEAD_DREADS = ['..r.rrrr.r..', '.rrrrrrrrrr.', '.rrrrrrrrrr.', '.rrSSSSSSrr.', '.r.SSSSSSs.r', '.r.SSSSSs..r', '.r.GGGGGg..r', '.....GGg....', '.....gg.....'];
const HEAD_QUIFF = ['......rrr...', '....rrrrrr..', '..rrrrrrrr..', '..rSSSSSSr..', '..sSSSSSSs..', '...SSSSSs...', '...GSSSSG...', '....GGGg....', '.....gg.....'];
const HEAD_UNDERCUT = ['............', '..rrrrrrr...', '..rrrrrrrrr.', '..sSSSSSSr..', '..sSSSSSSs..', '...SSSSSs...', '...SSSSSs...', '....SSSs....', '.....ss.....'];
const HEAD_FLATTOP = ['..rrrrrrrr..', '..rrrrrrrr..', '..rrrrrrrr..', '..sSSSSSSs..', '..sSSSSSSs..', '...SSSSSs...', '...GGGGGg...', '....GGGg....', '.....gg.....'];
const HEAD_CURLY = ['...r.rr.r...', '..rrrrrrrr..', '.rrrrrrrrrr.', '.rrSSSSSSrr.', '..rSSSSSSs..', '...SSSSSs...', '...SSSSSs...', '....SSSs....', '.....ss.....'];
const HEAD_FRINGE = ['............', '...rrrrrrr..', '..rrrrrrrrr.', '..rrrrrSSr..', '..rrrSSSSs..', '..rSSSSSs...', '..rSSSSSs...', '....SSSs....', '.....ss.....'];
const HEAD_SWEEP_BEARD = ['............', '....rrrrr...', '..rrrrrrrrr.', '..rSSSSSSsr.', '..rSSSSSSs..', '...SSSSSs...', '...GGGGGg...', '...GGGGGg...', '....GGGg....'];
const HEAD_SHOULDER = ['...rrrrrr...', '..rrrrrrrr..', '.rrrrrrrrrr.', '.rrSSSSSSrr.', '.rrSSSSSSsr.', '.rrSSSSSsrr.', '.rr.SSSSsrr.', '.rr..SSs.rr.', '.r...ss...r.'];
const HEAD_BRAIDS = ['............', '...rrrrrr...', '..rrrrrrrr..', '..rSSSSSSr..', '.rrSSSSSSsr.', '.r.SSSSSs.r.', '.r.SSSSSs.r.', '.r..SSSs..r.', '.r...ss...r.'];
const HEAD_MANBUN = ['.....rrr....', '.....rr.....', '...rrrrrr...', '..rSSSSSSr..', '..rSSSSSSs..', '...SSSSSs...', '...gSSSSg...', '....gggs....', '.....ss.....'];
const HEAD_SHAG = ['..rrrrrrrr..', '.rrrrrrrrrr.', '.rrrrrrrrrr.', '.rrrSSSSrrr.', '.rrSSSSSSsr.', '.r.SSSSSs.r.', '...GGGGGg...', '....GGGg....', '.....gg.....'];
const HEAD_CAP = ['............', '...BBBBBB...', '..BBBBBBBB..', '..bbbbbbbbbb', '..rSSSSSSs..', '...SSSSSs...', '...GGGGGg...', '....GGGg....', '.....gg.....'];

/** New hat shapes: the crown over a short back-and-sides, for when you have no cut of your own. */
const CROWN_BUCKET = ['............', '...BBBBBB...', '..BBBBBBBB..', '.bbbbbbbbbb.'];
const CROWN_FEDORA = ['....BBBB....', '...BBBBBB...', '...bbbbbb...', '.BBBBBBBBBB.'];
const CROWN_BERET = ['............', '..BBBBBBB...', '.BBBBBBBBBB.', '..bbbbbbbb..'];
const CROWN_FLATCAP = ['............', '..BBBBBBB...', '.BBBBBBBBBb.', '..bbbbbbbbbb'];
const CROWN_CAP = ['............', '...BBBBBB...', '..BBBBBBBB..', '..bbbbbbbbbb'];
const hatHead = (crown: string[]): string[] => underHat(HEAD_SHORT, crown);

export const COSMETICS: CosmeticDef[] = [
  // tops (the coat)
  { id: 'cos_coat_olive', name: 'OLD ARMY COAT', slot: 'top', shop: 'clothes', price: 0, cols: C3(0x6a6a44, 0x7e7e54, 0x4a4a30) },
  { id: 'cos_hoodie_grey', name: 'GREY HOODIE', slot: 'top', shop: 'clothes', price: 12, cols: C3(0x8a8a90, 0xa0a0a8, 0x6a6a70) },
  { id: 'cos_hoodie_red', name: 'RED HOODIE', slot: 'top', shop: 'clothes', price: 15, cols: C3(0xb03838, 0xc84a4a, 0x802828) },
  { id: 'cos_jacket_denim', name: 'DENIM JACKET', slot: 'top', shop: 'clothes', price: 30, cols: C3(0x3a5a8a, 0x4a6ea0, 0x2a4068) },
  { id: 'cos_jacket_leather', name: 'LEATHER JACKET', slot: 'top', shop: 'clothes', price: 70, cols: C3(0x2a1e18, 0x3a2a22, 0x1a120e) },
  { id: 'cos_suit', name: 'SHARP SUIT', slot: 'top', shop: 'clothes', price: 150, cols: C3(0x2a2a3a, 0x3a3a52, 0x1a1a28) },
  // ---- the rails turn over daily: these and the above, a few at a time (see `cosmeticStockFor`)
  { id: 'cos_hoodie_navy', name: 'NAVY HOODIE', slot: 'top', shop: 'clothes', price: 14, cols: C3(0x2a3a5a, 0x3a4e74, 0x1a2640) },
  { id: 'cos_hoodie_green', name: 'GREEN HOODIE', slot: 'top', shop: 'clothes', price: 14, cols: C3(0x3a7a4a, 0x4a945a, 0x285a34) },
  { id: 'cos_hoodie_purple', name: 'PURPLE HOODIE', slot: 'top', shop: 'clothes', price: 16, cols: C3(0x6a3a8a, 0x8048a6, 0x4a2864) },
  { id: 'cos_hoodie_yellow', name: 'YELLOW HOODIE', slot: 'top', shop: 'clothes', price: 16, cols: C3(0xd8b030, 0xecc848, 0xa88420) },
  { id: 'cos_hoodie_pink', name: 'PINK HOODIE', slot: 'top', shop: 'clothes', price: 16, cols: C3(0xe07aa8, 0xf094bc, 0xb05a84) },
  { id: 'cos_hoodie_black', name: 'BLACK HOODIE', slot: 'top', shop: 'clothes', price: 18, cols: C3(0x22222a, 0x34343e, 0x16161c) },
  { id: 'cos_jacket_denim_black', name: 'BLACK DENIM JACKET', slot: 'top', shop: 'clothes', price: 34, cols: C3(0x2a2a30, 0x3e3e48, 0x1a1a20) },
  { id: 'cos_jacket_denim_light', name: 'STONEWASH JACKET', slot: 'top', shop: 'clothes', price: 32, cols: C3(0x7a9ac0, 0x94b2d4, 0x5a789c) },
  { id: 'cos_jacket_leather_brown', name: 'BROWN LEATHER JACKET', slot: 'top', shop: 'clothes', price: 75, cols: C3(0x6a3a22, 0x82502e, 0x4a2816) },
  { id: 'cos_jacket_leather_red', name: 'RED LEATHER JACKET', slot: 'top', shop: 'clothes', price: 85, cols: C3(0x8a2028, 0xa83038, 0x601418) },
  { id: 'cos_puffer_orange', name: 'ORANGE PUFFER', slot: 'top', shop: 'clothes', price: 55, cols: C3(0xe0702a, 0xf08a40, 0xb0521c) },
  { id: 'cos_puffer_silver', name: 'SILVER PUFFER', slot: 'top', shop: 'clothes', price: 60, cols: C3(0xb0b4bc, 0xccd0d8, 0x8a8e96) },
  { id: 'cos_track_top', name: 'TRACKSUIT TOP', slot: 'top', shop: 'clothes', price: 24, cols: C3(0x1e5aa0, 0xe8e8e8, 0x14407a) },
  { id: 'cos_cardigan', name: 'OATMEAL CARDIGAN', slot: 'top', shop: 'clothes', price: 28, cols: C3(0xc8b898, 0xdccca8, 0xa49474) },
  { id: 'cos_varsity', name: 'VARSITY JACKET', slot: 'top', shop: 'clothes', price: 48, cols: C3(0x7a1e2a, 0xe8e0c8, 0x561420) },
  { id: 'cos_suit_navy', name: 'NAVY SUIT', slot: 'top', shop: 'clothes', price: 150, cols: C3(0x1e2a4a, 0x2c3c64, 0x141c34) },
  { id: 'cos_suit_grey', name: 'GREY SUIT', slot: 'top', shop: 'clothes', price: 140, cols: C3(0x5a5e66, 0x72767e, 0x42464c) },
  { id: 'cos_suit_burgundy', name: 'BURGUNDY SUIT', slot: 'top', shop: 'clothes', price: 165, cols: C3(0x5a1a2a, 0x74263a, 0x3e101c) },
  { id: 'cos_frog_jacket', name: 'FROGGY JACKET', slot: 'top', shop: 'clothes', price: 0, cols: C3(0x3d7a42, 0x5aa85f, 0x24492a), reward: true },
  // legs
  { id: 'cos_trousers_baggy', name: 'BAGGY TROUSERS', slot: 'legs', shop: 'clothes', price: 0, cols: { J: 0x5a5048, j: 0x463e38 } },
  { id: 'cos_jeans', name: 'BLUE JEANS', slot: 'legs', shop: 'clothes', price: 14, cols: { J: 0x3a5078, j: 0x2a3a5a } },
  { id: 'cos_chinos', name: 'CHINOS', slot: 'legs', shop: 'clothes', price: 18, cols: { J: 0xb09a70, j: 0x8a7850 } },
  { id: 'cos_black_trousers', name: 'BLACK TROUSERS', slot: 'legs', shop: 'clothes', price: 25, cols: { J: 0x1e1e24, j: 0x141418 } },
  { id: 'cos_jeans_black', name: 'BLACK JEANS', slot: 'legs', shop: 'clothes', price: 16, cols: { J: 0x22222a, j: 0x16161c } },
  { id: 'cos_jeans_light', name: 'LIGHT JEANS', slot: 'legs', shop: 'clothes', price: 16, cols: { J: 0x7a9ac0, j: 0x5a789c } },
  { id: 'cos_jeans_grey', name: 'GREY JEANS', slot: 'legs', shop: 'clothes', price: 15, cols: { J: 0x6a6e76, j: 0x4e5258 } },
  { id: 'cos_chinos_olive', name: 'OLIVE CHINOS', slot: 'legs', shop: 'clothes', price: 20, cols: { J: 0x6a7044, j: 0x4e5432 } },
  { id: 'cos_chinos_navy', name: 'NAVY CHINOS', slot: 'legs', shop: 'clothes', price: 20, cols: { J: 0x2a3654, j: 0x1c243c } },
  { id: 'cos_cargo', name: 'CARGO TROUSERS', slot: 'legs', shop: 'clothes', price: 22, cols: { J: 0x8a7a54, j: 0x6a5c3c } },
  { id: 'cos_track_bottoms', name: 'TRACKSUIT BOTTOMS', slot: 'legs', shop: 'clothes', price: 18, cols: { J: 0x1e5aa0, j: 0x14407a } },
  { id: 'cos_red_trousers', name: 'RED TROUSERS', slot: 'legs', shop: 'clothes', price: 26, cols: { J: 0x9a2a2a, j: 0x701c1c } },
  // shoes
  { id: 'cos_boots_worn', name: 'WORN BOOTS', slot: 'shoes', shop: 'clothes', price: 0, cols: { K: 0x3a2a1e, W: 0x6a5a48, T: 0xc8b8a0 } },
  { id: 'cos_sneakers', name: 'WHITE SNEAKERS', slot: 'shoes', shop: 'clothes', price: 16, cols: { K: 0xe8e8e8, W: 0xa0a0a0, T: 0xe8e8e8 } },
  { id: 'cos_dress_shoes', name: 'DRESS SHOES', slot: 'shoes', shop: 'clothes', price: 40, cols: { K: 0x141010, W: 0x2a2020, T: 0x141010 } },
  { id: 'cos_sneakers_red', name: 'RED SNEAKERS', slot: 'shoes', shop: 'clothes', price: 18, cols: { K: 0xc83a3a, W: 0xe8e8e8, T: 0xc83a3a } },
  { id: 'cos_sneakers_black', name: 'BLACK SNEAKERS', slot: 'shoes', shop: 'clothes', price: 18, cols: { K: 0x1e1e24, W: 0xe8e8e8, T: 0x1e1e24 } },
  { id: 'cos_sneakers_blue', name: 'BLUE SNEAKERS', slot: 'shoes', shop: 'clothes', price: 18, cols: { K: 0x2a5aa0, W: 0xe8e8e8, T: 0x2a5aa0 } },
  { id: 'cos_hightops', name: 'YELLOW HIGH-TOPS', slot: 'shoes', shop: 'clothes', price: 24, cols: { K: 0xe0b830, W: 0xf0f0f0, T: 0xe0b830 } },
  { id: 'cos_boots_tan', name: 'TAN BOOTS', slot: 'shoes', shop: 'clothes', price: 35, cols: { K: 0xa8743a, W: 0x4a3420, T: 0xa8743a } },
  { id: 'cos_loafers', name: 'BROWN LOAFERS', slot: 'shoes', shop: 'clothes', price: 38, cols: { K: 0x5a3420, W: 0x2a1a10, T: 0x5a3420 } },
  // scarf / accessories
  { id: 'cos_scarf_grubby', name: 'GRUBBY SCARF', slot: 'scarf', shop: 'clothes', price: 0, cols: { w: 0x9a9480 } },
  { id: 'cos_scarf_red', name: 'RED SCARF', slot: 'scarf', shop: 'clothes', price: 8, cols: { w: 0xc83a3a } },
  { id: 'cos_scarf_gold', name: 'GOLD SCARF', slot: 'scarf', shop: 'clothes', price: 35, cols: { w: 0xd8a838 } },
  { id: 'cos_scarf_blue', name: 'BLUE SCARF', slot: 'scarf', shop: 'clothes', price: 8, cols: { w: 0x3a6ab0 } },
  { id: 'cos_scarf_green', name: 'GREEN SCARF', slot: 'scarf', shop: 'clothes', price: 8, cols: { w: 0x3a8a4a } },
  { id: 'cos_scarf_cream', name: 'CREAM SCARF', slot: 'scarf', shop: 'clothes', price: 10, cols: { w: 0xe8dcc0 } },
  { id: 'cos_scarf_purple', name: 'PURPLE SCARF', slot: 'scarf', shop: 'clothes', price: 10, cols: { w: 0x7a4aa0 } },
  { id: 'cos_scarf_tartan', name: 'TARTAN SCARF', slot: 'scarf', shop: 'clothes', price: 18, cols: { w: 0xa83030 } },
  // hats (the beanie is the drifter's own)
  { id: 'cos_beanie', name: 'MAROON BEANIE', slot: 'hat', shop: 'clothes', price: 0, cols: { B: 0x5a3a3a, b: 0x7a5050 } },
  { id: 'cos_beanie_teal', name: 'TEAL BEANIE', slot: 'hat', shop: 'clothes', price: 9, cols: { B: 0x2a7a78, b: 0x46c4bd } },
  { id: 'cos_cap', name: 'BASEBALL CAP', slot: 'hat', shop: 'clothes', price: 12, cols: { B: 0x2a4a8a, b: 0x3a5aa0 }, head: HEAD_CAP },
  { id: 'cos_beanie_black', name: 'BLACK BEANIE', slot: 'hat', shop: 'clothes', price: 9, cols: { B: 0x22222a, b: 0x3a3a44 } },
  { id: 'cos_beanie_mustard', name: 'MUSTARD BEANIE', slot: 'hat', shop: 'clothes', price: 10, cols: { B: 0xc89a30, b: 0xe0b848 } },
  { id: 'cos_beanie_pink', name: 'PINK BEANIE', slot: 'hat', shop: 'clothes', price: 10, cols: { B: 0xd86a9a, b: 0xf08ab4 } },
  { id: 'cos_cap_red', name: 'RED CAP', slot: 'hat', shop: 'clothes', price: 12, cols: { B: 0xb03030, b: 0xc84646 }, head: hatHead(CROWN_CAP) },
  { id: 'cos_cap_black', name: 'BLACK CAP', slot: 'hat', shop: 'clothes', price: 12, cols: { B: 0x22222a, b: 0x3a3a44 }, head: hatHead(CROWN_CAP) },
  { id: 'cos_bucket_hat', name: 'BUCKET HAT', slot: 'hat', shop: 'clothes', price: 16, cols: { B: 0xc8b890, b: 0xa89870 }, head: hatHead(CROWN_BUCKET) },
  { id: 'cos_bucket_green', name: 'GREEN BUCKET HAT', slot: 'hat', shop: 'clothes', price: 16, cols: { B: 0x4a7a3a, b: 0x36602a }, head: hatHead(CROWN_BUCKET) },
  { id: 'cos_fedora', name: 'FEDORA', slot: 'hat', shop: 'clothes', price: 40, cols: { B: 0x3a3028, b: 0x1e1814 }, head: hatHead(CROWN_FEDORA) },
  { id: 'cos_fedora_grey', name: 'GREY FEDORA', slot: 'hat', shop: 'clothes', price: 42, cols: { B: 0x6a6a70, b: 0x2a2a30 }, head: hatHead(CROWN_FEDORA) },
  { id: 'cos_beret', name: 'BERET', slot: 'hat', shop: 'clothes', price: 18, cols: { B: 0x8a1e2a, b: 0x6a141e }, head: hatHead(CROWN_BERET) },
  { id: 'cos_beret_navy', name: 'NAVY BERET', slot: 'hat', shop: 'clothes', price: 18, cols: { B: 0x1e2a4a, b: 0x141c34 }, head: hatHead(CROWN_BERET) },
  { id: 'cos_flat_cap', name: 'FLAT CAP', slot: 'hat', shop: 'clothes', price: 20, cols: { B: 0x6a5a44, b: 0x4a3e2e }, head: hatHead(CROWN_FLATCAP) },
  { id: 'cos_no_hat', name: 'NO HAT', slot: 'hat', shop: 'clothes', price: 0, cols: {} },
  // glasses (the drifter has none: NO GLASSES is his own)
  { id: 'cos_no_glasses', name: 'NO GLASSES', slot: 'glasses', shop: 'clothes', price: 0, cols: {} },
  { id: 'cos_sunglasses', name: 'SUNGLASSES', slot: 'glasses', shop: 'clothes', price: 10, cols: { Q: 0x101018, q: 0x1e1e26 }, glasses: SHADES },
  { id: 'cos_specs', name: 'READING SPECS', slot: 'glasses', shop: 'clothes', price: 8, cols: { q: 0x6a4a2a }, glasses: SPECS },
  { id: 'cos_specs_round', name: 'ROUND GOLD SPECS', slot: 'glasses', shop: 'clothes', price: 14, cols: { q: 0xc8a040 }, glasses: SPECS },
  { id: 'cos_specs_black', name: 'THICK BLACK FRAMES', slot: 'glasses', shop: 'clothes', price: 12, cols: { q: 0x14141a }, glasses: SPECS },
  { id: 'cos_shades_aviator', name: 'AVIATORS', slot: 'glasses', shop: 'clothes', price: 22, cols: { Q: 0x4a3a20, q: 0xc8a040, L: 0x8a7a5a }, glasses: SHADES },
  { id: 'cos_shades_red', name: 'RED SHADES', slot: 'glasses', shop: 'clothes', price: 16, cols: { Q: 0x6a1418, q: 0xc83a3a, L: 0xa84a50 }, glasses: SHADES },
  { id: 'cos_shades_blue', name: 'MIRRORED SHADES', slot: 'glasses', shop: 'clothes', price: 20, cols: { Q: 0x1e3a6a, q: 0xc8ccd2, L: 0x8ab0e0 }, glasses: SHADES },
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
  { id: 'hair_bowl', name: 'BOWL CUT', slot: 'hair', shop: 'barber', price: 10, cols: {}, head: HEAD_BOWL },
  { id: 'hair_curtains', name: 'CURTAINS + BEARD', slot: 'hair', shop: 'barber', price: 16, cols: {}, head: HEAD_CURTAINS },
  { id: 'hair_spikes', name: 'SPIKES', slot: 'hair', shop: 'barber', price: 18, cols: {}, head: HEAD_SPIKES },
  { id: 'hair_mullet', name: 'MULLET', slot: 'hair', shop: 'barber', price: 20, cols: {}, head: HEAD_MULLET },
  { id: 'hair_ponytail', name: 'PONYTAIL', slot: 'hair', shop: 'barber', price: 18, cols: {}, head: HEAD_PONYTAIL },
  { id: 'hair_dreads', name: 'DREADLOCKS', slot: 'hair', shop: 'barber', price: 30, cols: {}, head: HEAD_DREADS },
  { id: 'hair_quiff', name: 'QUIFF + GOATEE', slot: 'hair', shop: 'barber', price: 24, cols: {}, head: HEAD_QUIFF },
  { id: 'hair_undercut', name: 'UNDERCUT', slot: 'hair', shop: 'barber', price: 20, cols: {}, head: HEAD_UNDERCUT },
  { id: 'hair_flattop', name: 'FLAT TOP', slot: 'hair', shop: 'barber', price: 18, cols: {}, head: HEAD_FLATTOP },
  { id: 'hair_curly', name: 'CURLY TOP', slot: 'hair', shop: 'barber', price: 20, cols: {}, head: HEAD_CURLY },
  { id: 'hair_fringe', name: 'SIDE FRINGE', slot: 'hair', shop: 'barber', price: 16, cols: {}, head: HEAD_FRINGE },
  { id: 'hair_sweep_beard', name: 'SWEPT + FULL BEARD', slot: 'hair', shop: 'barber', price: 26, cols: {}, head: HEAD_SWEEP_BEARD },
  { id: 'hair_shoulder', name: 'SHOULDER LENGTH', slot: 'hair', shop: 'barber', price: 22, cols: {}, head: HEAD_SHOULDER },
  { id: 'hair_braids', name: 'LONG BRAIDS', slot: 'hair', shop: 'barber', price: 28, cols: {}, head: HEAD_BRAIDS },
  { id: 'hair_manbun', name: 'MAN BUN + STUBBLE', slot: 'hair', shop: 'barber', price: 22, cols: {}, head: HEAD_MANBUN },
  { id: 'hair_shag', name: 'SHAG', slot: 'hair', shop: 'barber', price: 20, cols: {}, head: HEAD_SHAG },
  { id: 'hair_col_brown', name: 'DYE: BROWN', slot: 'dye', shop: 'barber', price: 5, cols: { r: 0x5a4a3a, G: 0x6a5040, g: 0x4a3828 } },
  { id: 'hair_col_black', name: 'DYE: BLACK', slot: 'dye', shop: 'barber', price: 7, cols: { r: 0x1e1814, G: 0x2a2420, g: 0x1a1612 } },
  { id: 'hair_col_blond', name: 'DYE: BLOND', slot: 'dye', shop: 'barber', price: 10, cols: { r: 0xd8b060, G: 0xc8a050, g: 0xa88038 } },
  { id: 'hair_col_pink', name: 'DYE: PINK', slot: 'dye', shop: 'barber', price: 15, cols: { r: 0xff4fa3, G: 0xe04090, g: 0xb03070 } },
  { id: 'hair_col_blue', name: 'DYE: BLUE', slot: 'dye', shop: 'barber', price: 15, cols: { r: 0x3a6ad0, G: 0x2e58b4, g: 0x22448c } },
  { id: 'hair_col_green', name: 'DYE: GREEN', slot: 'dye', shop: 'barber', price: 15, cols: { r: 0x3ab05a, G: 0x2e9a4a, g: 0x227838 } },
  { id: 'hair_col_silver', name: 'DYE: SILVER', slot: 'dye', shop: 'barber', price: 12, cols: { r: 0xc8ccd2, G: 0xb0b4ba, g: 0x8a8e94 } },
  { id: 'hair_col_red', name: 'DYE: FIERY RED', slot: 'dye', shop: 'barber', price: 12, cols: { r: 0xc8401e, G: 0xb03418, g: 0x882612 } },
];

/** The cosmetics the drifter starts in, owned from the beginning. */
export const STARTER_COSMETICS = ['cos_coat_olive', 'cos_trousers_baggy', 'cos_boots_worn', 'cos_scarf_grubby', 'cos_beanie', 'cos_no_hat', 'cos_no_glasses'];

/**
 * Every slot a whole change of clothes covers (the stealth phase's
 * CHANGE YOUR LOOK): the hair counts once, as a cut or a colour.
 */
export const ATTIRE_SLOTS = ['hat', 'top', 'scarf', 'legs', 'shoes', 'glasses'] as const;
/** What a slot holds with nothing bought for it (an old save, or a slot added later). */
export const DEFAULT_WORN: Partial<Record<CosmeticSlot, string>> = {
  top: 'cos_coat_olive', legs: 'cos_trousers_baggy', shoes: 'cos_boots_worn', scarf: 'cos_scarf_grubby', hat: 'cos_beanie', glasses: 'cos_no_glasses',
};

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
export const STOCK_ALWAYS = ['fur_mattress', 'fur_bed_premium', 'fur_toilet', 'fur_sink', 'fur_rug_mat'];
/** How many of the rest are out on any one day. */
export const STOCK_ROTATING = 12;

/** The mirrors Home and Hearth sells for the main room: one of them is always out (see `stockFor`). */
export const ROOM_MIRRORS = ['fur_mirror_wall', 'fur_mirror_round', 'fur_mirror_tall', 'fur_mirror_sunburst', 'fur_mirror_vanity'];

/** `pool` in the order `day` shuffles it to (the same day, the same order, everywhere); `salt` keeps lists apart. */
function dayOrder<T>(pool: T[], day: number, salt: number): T[] {
  return pool
    .map((v, i) => ({ v, k: hash(day * 7919 + i * 104729 + salt * 15485863) }))
    .sort((a, b) => a.k - b.k)
    .map((o) => o.v);
}

export function stockFor(day: number): FurnitureDef[] {
  const pool = FURNITURE.filter((f) => !f.reward && f.price > 0 && !STOCK_ALWAYS.includes(f.id));
  // a shuffle the day seeds: the same day gives the same shop, everywhere
  const order = dayOrder(pool, day, 0);
  const out = STOCK_ALWAYS.map((id) => furnitureById(id)!).filter(Boolean);
  // a mirror of the day, whichever the shuffle put first, and then the rest
  const mirror = order.find((f) => ROOM_MIRRORS.includes(f.id));
  if (mirror) out.push(mirror);
  out.push(...order.filter((f) => f !== mirror).slice(0, STOCK_ROTATING).map((f) => f));
  // cheapest first inside each kind, so the list reads like a price list
  return out.sort((a, b) => Number(a.wall) - Number(b.wall) || a.price - b.price);
}

/**
 * ---- WHAT IS ON THE RAILS, AND IN THE BARBER'S BOOK, TODAY.
 *
 * Like Home and Hearth, Threads and the Clip Joint put out a few things at a
 * time and change them every game day: four cuts in the book (the colours
 * are always all there), and so many of each kind of thing on the rails.
 * The same day gives the same stock, everywhere.  What you already own is
 * yours to put on whatever is out (see the shops), so a day it is not on
 * the rail does not take it off you.
 */
export const DAILY_CUTS = 4;
export const DAILY_CLOTHES: Partial<Record<CosmeticSlot, number>> = { top: 4, legs: 3, shoes: 3, hat: 3, scarf: 2, glasses: 2 };

export function cosmeticStockFor(day: number, shop: 'clothes' | 'barber'): CosmeticDef[] {
  const pool = COSMETICS.filter((c) => c.shop === shop && !c.reward && c.price > 0);
  if (shop === 'barber') {
    const cuts = dayOrder(pool.filter((c) => c.slot === 'hair'), day, 1).slice(0, DAILY_CUTS);
    return [...cuts, ...pool.filter((c) => c.slot === 'dye')];
  }
  const out: CosmeticDef[] = [];
  let salt = 2;
  for (const [slot, n] of Object.entries(DAILY_CLOTHES) as Array<[CosmeticSlot, number]>) {
    out.push(...dayOrder(pool.filter((c) => c.slot === slot), day, salt++).slice(0, n));
  }
  return out;
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
  let glasses: string[] | undefined;
  for (const c of hairStyle) {
    if (c.slot === 'hair' && c.head) head = c.head;
    if (c.slot === 'glasses' && c.glasses) glasses = c.glasses;
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
  return { cols, head, glasses };
}

/** The top rows of each hat: what it covers of the head. */
export const CROWNS: Record<string, string[]> = {
  cos_beanie: ['....BBBB....', '...BBBBBB...', '..bbbbbbbb..'],
  cos_beanie_teal: ['....BBBB....', '...BBBBBB...', '..bbbbbbbb..'],
  cos_cap: ['............', '...BBBBBB...', '..BBBBBBBB..', '..bbbbbbbbbb'],
  cos_cap_red: CROWN_CAP,
  cos_cap_black: CROWN_CAP,
  cos_bucket_hat: CROWN_BUCKET,
  cos_bucket_green: CROWN_BUCKET,
  cos_fedora: CROWN_FEDORA,
  cos_fedora_grey: CROWN_FEDORA,
  cos_beret: CROWN_BERET,
  cos_beret_navy: CROWN_BERET,
  cos_flat_cap: CROWN_FLATCAP,
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
