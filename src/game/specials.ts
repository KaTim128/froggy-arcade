/**
 * ---- THE 120 SPECIALS.  Every creature and boss fights with one plain
 * attack of its own (`normal` in creatures) and two of these -- and each of
 * these belongs to exactly one creature in the whole game (checked in
 * creatures).  No two do the same thing: where two share an effect (two
 * different pulls, two heals) they deliver it differently or under
 * different conditions, and every description says exactly how.
 *
 * `kind` is how it is delivered (a shot, a charge, a ring...: what the arena
 * draws and what the card calls it); `mod` is a generic special the arena
 * already knows (game/attackInfo MODS); a special with neither doing the
 * whole job has its own handler in scenes2d/CreatureArena (`CAST`), keyed by
 * its id.  `ai` says when the computer reaches for it.
 */

import type { AttackKind, Mod } from './creatures';

/** When the AI uses it: at range with a clear shot, up close, on itself, ... */
export type AiUse =
  | 'poke' // a clear line, inside its range
  | 'close' // inside its reach
  | 'mid' // a middling distance, clear or not
  | 'self' // whenever it is ready
  | 'defend' // a shot coming at it
  | 'escape' // the other one is on top of it
  | 'heal' // hurt
  | 'hidden' // no line on them: a lob, a rune, a trap
  | 'never'; // a boss's floor mechanic (fired on its own clock)

export interface SpecialDef {
  id: string;
  name: string;
  kind: AttackKind;
  dmg: number;
  cd: number;
  reach: number;
  mod: Mod;
  ai: AiUse;
  /** One sentence: exactly what it does, with the numbers. */
  desc: string;
}

const D = (id: string, name: string, kind: AttackKind, dmg: number, cd: number, reach: number, ai: AiUse, desc: string, mod: Mod = 'none'): SpecialDef => ({ id, name, kind, dmg, cd, reach, mod, ai, desc });

export const SPECIAL_LIST: SpecialDef[] = [
  // ------------------------------------------------------------------ ember
  D('magma_rush', 'MAGMA RUSH', 'dash', 15, 3.4, 232, 'close', 'DASHES 65PX, LEAVING A STRIP OF FIRE THAT BURNS FOR 3S.', 'linger'),
  D('flare_ring', 'FLARE RING', 'nova', 18, 6.5, 44, 'close', 'A 44PX RING OF FLAME THAT KNOCKS EVERYTHING INSIDE IT 60PX AWAY.', 'push'),
  D('splitflame', 'SPLITFLAME', 'bolt', 12, 2.4, 200, 'poke', 'A FIREBALL THAT BREAKS INTO 3 SHARDS (40% DAMAGE EACH) WHEN IT HITS OR STOPS.', 'split'),
  D('afterburn', 'AFTERBURN', 'arc', 16, 5, 110, 'hidden', 'A LOBBED BLOB THAT BURSTS, THEN BURSTS AGAIN 0.6S LATER AT HALF DAMAGE.', 'echo'),
  D('lava_flow', 'LAVA FLOW', 'beam', 0, 6, 80, 'mid', 'POURS AN 80PX RIVER FOR 4S THAT CARRIES ANYTHING IN IT DOWNSTREAM AND BURNS 2 A SECOND.'),
  D('molten_skin', 'MOLTEN SKIN', 'aura', 0, 9, 5, 'self', 'FOR 5S, TOUCHING IT DEALS 4 AND SETS THE TOUCHER ALIGHT.'),
  D('venom_sting', 'VENOM STING', 'beam', 12, 2.6, 70, 'close', 'AN INSTANT 70PX TAIL STRIKE THAT POISONS FOR 3 A SECOND OVER 4S.', 'poison'),
  D('ash_burrow', 'ASH BURROW', 'blink', 0, 4, 64, 'escape', 'UNTARGETABLE UNDERGROUND FOR 1S, THEN SURFACES UP TO 64PX AWAY WITH A GUARD AGAINST THE NEXT HIT.'),
  D('bellows', 'BELLOWS RAM', 'dash', 14, 3.6, 250, 'close', 'A 70PX CHARGE THAT DRIVES THE TARGET BACK; SLAMMED INTO COVER, THEY TAKE 8 MORE AND REEL FOR 0.4S.'),
  D('slag_armour', 'SLAG ARMOUR', 'aura', 0, 9, 5, 'self', 'FOR 4S IT TAKES 40% LESS DAMAGE BUT MOVES 30% SLOWER.'),
  D('heat_lance', 'HEAT LANCE', 'beam', 18, 5, 160, 'poke', 'AIMS FOR 0.5S, THEN A 160PX BEAM THAT DEALS +60% TO TARGETS UNDER 40% HEALTH.'),
  D('ember_plumes', 'EMBER PLUME', 'spread', 4, 3, 170, 'poke', 'A FAN OF 5 SPARKS; EACH HIT ADDS A BURN STACK (UP TO 5) THAT DEALS 1 A SECOND FOR 4S.'),
  // ------------------------------------------------------------------- tide
  D('tongue_lash', 'TONGUE LASH', 'beam', 12, 3, 56, 'close', 'A 56PX TONGUE THAT INSTANTLY YANKS THE TARGET 40PX CLOSER.'),
  D('gulp', 'GULP', 'shield', 0, 7, 2, 'defend', 'FOR 2S, SWALLOWS THE NEXT SHOT THAT WOULD HIT IT AND HEALS 22% OF ITS HEALTH.'),
  D('sea_glide', 'SEA GLIDE', 'blink', 0, 2.6, 72, 'escape', 'A 72PX BLINK THAT ALSO CLEARS EVERY SLOW, HOLD, BURN AND POISON ON IT.', 'cleanse'),
  D('rolling_swell', 'GROUNDSWELL', 'nova', 14, 5, 80, 'close', 'A WAVE THAT ROLLS OUT 80PX OVER 0.6S, SHOVING WHATEVER IT CROSSES.'),
  D('puff_up', 'PUFF UP', 'shield', 0, 6.5, 1.6, 'defend', 'INFLATES FOR 1.6S; SHOTS THAT HIT IT FLY BACK AT WHOEVER FIRED THEM.', 'reflect'),
  D('bubble_cage', 'BUBBLE CAGE', 'arc', 6, 6, 115, 'mid', 'A LOBBED BUBBLE THAT TRAPS THE TARGET FOR 1S: THEY CANNOT ACT, BUT CANNOT BE HURT EITHER.'),
  D('urchin_field', 'SPINE FIELD', 'mine', 10, 5, 0, 'mid', 'SCATTERS 3 SPINE TRAPS THAT EACH HOLD WHOEVER STEPS ON THEM FOR 0.8S.'),
  D('spine_shed', 'SPINE SHED', 'spread', 6, 4, 160, 'close', 'FIRES 8 SPINES OUTWARD IN EVERY DIRECTION AT ONCE.'),
  D('regrowth', 'REGROWTH', 'mend', 0, 9, 30, 'heal', 'HEALS 4 A SECOND FOR 5S - TWICE THAT WHILE IT STANDS STILL.'),
  D('slick_spit', 'SLICK SPIT', 'bolt', 7, 3.5, 190, 'poke', 'A GLOB THAT MAKES THE TARGET SLIPPERY FOR 3S: THEY KEEP SLIDING AFTER THEY STOP.'),
  D('riptide_dash', 'RIPTIDE', 'dash', 12, 3.6, 286, 'close', 'AN 80PX DASH THAT DRAGS THE TARGET ALONG BEHIND IT THE WHOLE WAY.'),
  D('current_ward', 'EDDY WARD', 'aura', 0, 8, 5, 'defend', 'FOR 4S, ENEMY SHOTS THAT PASS WITHIN 18PX ARE BENT OFF COURSE.'),
  // ------------------------------------------------------------------- moss
  D('shell_up', 'SHELL UP', 'shield', 0, 6, 1.6, 'defend', 'BLOCKS ALL DAMAGE FOR 1.6S.'),
  D('kelp_weave', 'KELP WEAVE', 'wall', 0, 6, 28, 'mid', 'RAISES A CURVED SEAWEED WALL FOR 9S. SHOTS CAN TEAR IT DOWN, BUT IT IS BACK SOON.'),
  D('root_grip', 'ROOT GRIP', 'snare', 10, 5, 165, 'poke', 'A ROOT THAT CURVES AFTER THE TARGET AND HOLDS THEM FOR 1.3S.', 'homing'),
  D('sneeze_spores', 'ACHOO SPORE', 'nova', 12, 6, 46, 'close', 'A 46PX RING OF SPORES: ANYONE CAUGHT FIRES THEIR NEXT ATTACK IN A RANDOM DIRECTION.'),
  D('antler_rush', 'ANTLER RUSH', 'dash', 15, 3.6, 250, 'close', 'A 70PX CHARGE THAT PINS THE TARGET TO THE SPOT FOR 1S.'),
  D('forest_air', 'FOREST AIR', 'mend', 0, 8, 30, 'heal', 'HEALS 22% AND REMOVES EVERY HARMFUL EFFECT ON IT.', 'cleanse'),
  D('bark_hide', 'BARK HIDE', 'aura', 0, 8, 5, 'self', 'THE NEXT 3 HITS IT TAKES EACH DEAL 10 LESS.'),
  D('honey_slam', 'HONEY SLAM', 'nova', 10, 6, 28, 'close', 'A SLAM THAT LEAVES 30PX OF HONEY FOR 4S, SLOWING ANYONE IN IT BY 60%.'),
  D('hibernate', 'HIBERNATE', 'mend', 0, 12, 30, 'heal', 'ROOTS ITSELF FOR 2S, UNABLE TO ACT, AND HEALS 35% OF ITS HEALTH.'),
  D('vine_leash', 'VINE LEASH', 'snare', 6, 7, 170, 'poke', 'TIES A VINE TO THE TARGET FOR 3S: THEY CANNOT GET MORE THAN 60PX AWAY.'),
  D('pollinate', 'POLLINATE', 'bolt', 6, 5, 200, 'poke', 'DUSTS THE TARGET FOR 4S: EVERY HIT IT LANDS ON THEM HEALS IT 3.'),
  D('hive_call', 'HIVE CALL', 'aura', 0, 10, 5, 'self', 'THREE DRONES CIRCLE IT FOR 5S, STINGING ANYTHING THEY TOUCH FOR 3.'),
  // ------------------------------------------------------------------ frost
  D('glacier_slab', 'ICE SLAB', 'wall', 0, 8, 30, 'mid', 'A LONG ICE WALL NOTHING CAN BREAK - FOR ONLY 4S. THEN IT SHATTERS: 10 TO ANYONE WITHIN 20PX.'),
  D('hailburst', 'HAILBURST', 'spread', 12, 6, 180, 'poke', '3 HAILSTONES THAT GROW AND HIT HARDER THE FURTHER THEY FLY.', 'grow'),
  D('cold_tether', 'COLD TETHER', 'snare', 9, 5, 170, 'poke', 'HOLDS THE TARGET, THEN HALVES THEIR SPEED FOR 3S AFTER IT LETS GO.', 'chill'),
  D('prism_stasis', 'PRISM HALT', 'nova', 0, 7, 40, 'defend', 'A FLASH THAT FREEZES EVERY SHOT IN FLIGHT FOR 1S BEFORE LETTING THEM GO ON.'),
  D('ram_charge', 'RAM CHARGE', 'dash', 16, 4, 321, 'close', 'THE LONGEST CHARGE IN THE GAME (90PX); IT FREEZES THE TARGET SOLID FOR 0.6S.'),
  D('hoof_stamp', 'HOOF STAMP', 'nova', 14, 6, 40, 'close', 'A STAMP THAT CUTS SHORT ANY CHARGE OR WIND-UP WITHIN 40PX AND STUNS 0.3S.', 'stagger'),
  D('belly_slide', 'BELLY SLIDE', 'dash', 13, 3.2, 268, 'close', 'A 75PX SLIDE THAT BOUNCES OFF COVER ONCE AND CARRIES ON.'),
  D('ice_floe', 'ICE FLOE', 'wall', 0, 8, 40, 'self', 'LAYS A 40PX ICE SHEET FOR 5S: OPPONENTS ON IT ARE 40% SLOWER, IT IS 40% FASTER.'),
  D('ice_boulder', 'ICE BOULDER', 'arc', 15, 4.5, 110, 'hidden', 'A LOBBED BOULDER; A DIRECT HIT ENCASES THE TARGET IN ICE FOR 0.8S.'),
  D('war_roar', 'WAR ROAR', 'nova', 0, 8, 60, 'mid', 'A ROAR THAT STRIPS THE OPPONENT OF THEIR POWER-UP, SHIELD, GUARD AND SPEED.'),
  // ------------------------------------------------------------------- volt
  D('volt_pounce', 'VOLT POUNCE', 'dash', 14, 3.2, 245, 'close', 'A POUNCE THAT MARKS THE TARGET: THE NEXT HIT ON THEM DEALS +50%.', 'mark'),
  D('storm_howl', 'STORM HOWL', 'aura', 0, 8.5, 5, 'self', '5S OF +35% SPEED AND +25% DAMAGE.'),
  D('web_mine', 'WEB MINE', 'mine', 14, 3.6, 0, 'mid', 'A MINE THAT HOLDS WHOEVER SETS IT OFF FOR 1.3S.', 'root'),
  D('live_wire', 'LIVE WIRE', 'snare', 11, 5.5, 180, 'mid', 'A SNARE WIRE THAT PASSES STRAIGHT THROUGH COVER.', 'drill'),
  D('seeker_sparks', 'SEEKER ZAPS', 'spread', 6, 2.6, 180, 'mid', '3 SPARKS THAT CURVE TOWARDS THE TARGET AS THEY FLY.', 'homing'),
  D('wall_cling', 'WALL CLING', 'blink', 0, 4, 80, 'escape', 'BLINKS ONTO THE NEAREST COVER AND HEALS 3 A SECOND WHILE IT CLINGS (UP TO 3S).'),
  D('static_steal', 'SPARK THEFT', 'dash', 9, 4.5, 220, 'close', 'A SHORT DASH; ON A HIT IT RESETS ITS OWN LONGEST COOLDOWN AND ADDS 2S TO ALL OF THEIRS.'),
  D('spark_chain', 'SPARK CHAIN', 'bolt', 9, 2.8, 220, 'poke', 'A BOLT THAT STRIKES AGAIN FROM ABOVE 0.4S LATER, WHEREVER THE TARGET HAS MOVED TO.'),
  D('thunder_charge', 'STORM RUSH', 'dash', 15, 4.2, 250, 'close', 'A 70PX CHARGE THAT NOTHING CAN SLOW, HOLD OR STUN, AND STUNS FOR 0.5S.'),
  D('capacitor', 'CAPACITOR', 'aura', 0, 9, 5, 'defend', 'FOR 4S IT STORES EVERY HIT IT TAKES, THEN RELEASES 3 PER HIT IN A 50PX SHOCK.'),
  D('eel_dive', 'EEL DIVE', 'blink', 0, 6, 40, 'escape', 'INVISIBLE FOR 2S; THE FIRST HIT IT LANDS OUT OF HIDING STUNS FOR 0.6S.'),
  D('live_current', 'LIVE LINE', 'beam', 10, 4, 90, 'poke', 'A 90PX LINE THAT LEAVES THE GROUND ALONG IT ELECTRIFIED FOR 2S.', 'linger'),
  // ------------------------------------------------------------------ stone
  D('pebble_mortar', 'PEBBLE RAIN', 'arc', 8, 4, 120, 'hidden', 'LOBS 3 PEBBLES THAT LAND IN A LINE, ONE AFTER ANOTHER.'),
  D('horn_toss', 'HORN TOSS', 'dash', 13, 3.6, 235, 'close', 'CHARGES AND FLIPS THE TARGET OVER ITS BACK TO LAND 40PX BEHIND IT.'),
  D('roll_out', 'ROLL OUT', 'dash', 15, 3.6, 268, 'close', 'ROLLS 75PX; WHATEVER IT HITS IS KNOCKED DOWN FOR 0.6S AND CANNOT ATTACK OR MOVE.'),
  D('dig_in', 'DIG IN', 'shield', 0, 6.5, 1.8, 'defend', 'SHIELDS FOR 1.8S; ANYTHING THAT HITS IT TAKES 6 DAMAGE.', 'thorns'),
  D('crag_lob', 'CRAG LOB', 'arc', 13, 4.5, 105, 'hidden', 'A LOBBED ROCK THAT STANDS WHERE IT LANDS AS A PILLAR FOR 7S, UNTIL IT IS SHOT DOWN.'),
  D('hide_away', 'HIDE AWAY', 'shield', 0, 7, 1.8, 'defend', 'IMMUNE INSIDE ITS SHELL FOR 1.8S, HEALING 3 A SECOND.', 'regen'),
  D('gravity_rune', 'PULL RUNE', 'mine', 0, 7, 0, 'mid', 'A RUNE ON THE FLOOR THAT SLOWLY DRAGS THE OPPONENT TOWARDS IT FOR 4S.'),
  D('petrify_gaze', 'STONE GAZE', 'beam', 8, 6, 120, 'poke', 'A 120PX STARE THAT TURNS THE TARGET TO STONE FOR 1S: STUNNED, BUT TAKING 50% LESS DAMAGE.'),
  D('crystal_quills', 'QUILL RING', 'spread', 3, 4.5, 150, 'close', 'A RING OF 8 QUILLS; EACH ONE THAT STICKS DEALS 1 A SECOND FOR 4S.'),
  D('geode_curl', 'GEODE CURL', 'aura', 0, 7, 5, 'close', 'CURLS UP FOR 2S: NOTHING KNOCKS IT BACK, AND IT ROLLS AT THE TARGET, HURTING ON CONTACT.'),
  // ------------------------------------------------------------------- gale
  D('dust_devil', 'DUST DEVIL', 'aura', 0, 7, 5, 'mid', 'A LITTLE WHIRLWIND THAT DRIFTS AFTER THE TARGET FOR 4S, DEALING 3 EACH TIME IT TOUCHES.'),
  D('sleep_dust', 'SLEEP DUST', 'mine', 0, 6, 0, 'mid', 'A DUST TRAP: WHOEVER SETS IT OFF FALLS ASLEEP FOR 1.2S - ANY HIT WAKES THEM.'),
  D('wind_cutter', 'WIND CUTTER', 'spread', 6, 2.8, 150, 'mid', '3 BLADES IN A FAN; ANYONE HIT TAKES 25% MORE DAMAGE FOR 3S.', 'shred'),
  D('sidestep', 'SIDESTEP', 'blink', 0, 2.6, 60, 'escape', 'A 60PX BLINK THAT DEALS 10 TO EVERYTHING AROUND WHERE IT LANDS.', 'strike'),
  D('gust_kick', 'GUST KICK', 'bolt', 9, 2, 210, 'poke', 'A KICKED GUST, AFTER WHICH IT MOVES 40% FASTER FOR 2S.', 'haste'),
  D('bounding_hops', 'TRIPLE HOP', 'blink', 0, 4, 40, 'escape', 'UP TO 3 CHAINED 40PX HOPS WITHIN 2S.'),
  D('mirage_decoy', 'MIRAGE', 'blink', 0, 6, 50, 'escape', 'LEAVES A DECOY THAT DRAWS THE OPPONENT FOR 2S WHILE IT BLINKS 50PX AWAY.'),
  D('updraft', 'UPDRAFT', 'blink', 6, 5, 0, 'defend', 'AIRBORNE FOR 1S - FLOOR TRAPS AND CHARGES MISS IT - THEN LANDS IN A 30PX GUST.'),
  D('dive_bomb', 'DIVE BOMB', 'arc', 20, 5.5, 160, 'hidden', 'MARKS A SPOT, THEN DIVES ONTO IT 0.8S LATER FOR HEAVY DAMAGE IN 20PX.'),
  D('tailwind', 'TAILWIND', 'aura', 0, 8, 5, 'self', 'FOR 4S ITS SHOTS FLY 50% FASTER AND 30% FURTHER.'),
  // ------------------------------------------------------------------- murk
  D('mire_glob', 'MIRE GLOB', 'bolt', 8, 3.5, 185, 'poke', 'A STICKY GLOB THAT HALVES HOW FAR THE TARGET CAN DASH OR BLINK FOR 4S.'),
  D('coil_snap', 'COIL SNAP', 'beam', 13, 2.9, 54, 'close', 'AN INSTANT 54PX STRIKE THAT DEALS +60% TO TARGETS UNDER 40% HEALTH.', 'execute'),
  D('echo_shriek', 'ECHO SHRIEK', 'spread', 5, 5, 150, 'mid', 'A SOUND CONE THAT FLIPS THE TARGET\'S MOVEMENT CONTROLS FOR 1.5S.'),
  D('hit_and_run', 'HIT AND RUN', 'dash', 14, 3.4, 250, 'close', 'A DIVE THAT, IF IT LANDS, CARRIES IT STRAIGHT BACK TO WHERE IT STARTED.'),
  D('spore_puff', 'SPORE PUFF', 'nova', 12, 4, 42, 'close', 'A 42PX RING; ANYONE CAUGHT DEALS 30% LESS DAMAGE FOR 3S.', 'weaken'),
  D('mycelium_net', 'SPORE WEB', 'mine', 0, 9, 0, 'self', 'SPREADS A 60PX WEB OF ROOTS FOR 6S; IT HEALS 2 A SECOND WHILE THE OPPONENT STANDS ON IT.'),
  D('ill_omen', 'ILL OMEN', 'bolt', 6, 6, 200, 'poke', 'CURSES THE TARGET FOR 5S: EVERY HEAL THEY GET IS HALVED.'),
  D('murder', 'CROW MURDER', 'aura', 0, 8, 5, 'mid', '4 CROWS CIRCLE THE TARGET FOR 3S, PECKING 2 EACH TIME ONE PASSES THROUGH.'),
  D('shadow_step', 'SHADOW STEP', 'blink', 0, 4.5, 90, 'mid', 'BLINKS TO THE FAR SIDE OF THE TARGET; ITS NEXT HIT WITHIN 2S DEALS DOUBLE.'),
  D('pounce_pin', 'POUNCE PIN', 'dash', 6, 4.5, 235, 'close', 'LEAPS ON THE TARGET AND HOLDS THEM FOR 1S WHILE CLAWING 3 TIMES.'),
  D('phase', 'PHASE', 'aura', 0, 6, 5, 'self', 'FOR 1.5S IT DRIFTS THROUGH COVER AS IF IT WERE NOT THERE.'),
  D('soul_siphon', 'SOUL SIPHON', 'beam', 0, 7, 100, 'mid', 'A 3S TETHER THAT DRAINS 4 A SECOND FROM THE TARGET TO ITSELF WHILE WITHIN 100PX.'),
  // ------------------------------------------------------------------- glow
  D('pierce_gaze', 'PIERCE GAZE', 'beam', 15, 3.2, 120, 'poke', 'AN INSTANT 120PX BEAM THAT ADDS 1.2S TO ALL OF THE TARGET\'S COOLDOWNS.', 'silence'),
  D('silent_glide', 'HUSH GLIDE', 'blink', 0, 2.6, 68, 'escape', 'GLIDES 68PX AND CANNOT BE HIT FOR 0.5S AFTER IT LANDS.'),
  D('boomer_spit', 'BOOMER SPIT', 'bolt', 9, 2.2, 220, 'poke', 'A SHOT THAT FLIES OUT AND BACK, AND CAN HIT ON BOTH PASSES.', 'boomerang'),
  D('bright_coil', 'BRIGHT COIL', 'aura', 0, 8, 5, 'defend', 'FOR 3S IT SOAKS UP SHOTS AIMED AT IT; EACH ONE ADDS 2 DAMAGE TO ITS NEXT SHOT.'),
  D('dangling_lure', 'DANGLE LURE', 'mine', 0, 7, 0, 'mid', 'HANGS A LURE 50PX AWAY FOR 4S; COME WITHIN 15PX OF IT AND YOU ARE REELED IN.'),
  D('deep_beam', 'DEEP BEAM', 'beam', 6, 6, 110, 'poke', 'A HELD BEAM: ITS DAMAGE CLIMBS UP TO 3 TIMES OVER 1.5S ON TARGET.'),
  D('beacon', 'BEACON', 'wall', 0, 9, 0, 'self', 'PLANTS A LANTERN FOR 6S; WHILE IT STAYS WITHIN 40PX OF IT, ITS SHOTS GO THROUGH COVER.'),
  D('dazzle', 'DAZZLE', 'nova', 4, 5, 50, 'close', 'A FLASH THAT SENDS THE TARGET\'S NEXT 2 SHOTS 30 DEGREES OFF COURSE.'),
  D('star_shell', 'STAR SHELL', 'shield', 0, 8, 2, 'defend', 'IMMUNE IN ITS SHELL FOR 2S, THEN RELEASES THE DAMAGE IT WOULD HAVE TAKEN AS A 40PX BURST.'),
  D('comet_trail', 'COMET TRAIL', 'aura', 0, 8, 5, 'self', 'LEAVES A GLOWING TRAIL FOR 5S AND MOVES 50% FASTER ALONG ITS OWN TRAIL.'),
  // ------------------------------------------------------------------ bosses
  D('phantom_blink', 'PHANTOM BLINK', 'blink', 0, 4.5, 0, 'never', 'MARKS OF GRAVE-LIGHT ROUND YOU, AND IT TELEPORTS TO WHEREVER IT CAN SEE YOU.'),
  D('raise_husks', 'RAISE HUSKS', 'aura', 0, 9, 5, 'mid', 'RAISES 2 SLOW HUSKS THAT WALK AT YOU AND BURST FOR 12. SHOOT THEM DOWN.'),
  D('meteor_fall', 'METEOR FALL', 'arc', 26, 5.5, 0, 'never', '3 METEORS, EACH WITH A 1.6S GROWING SHADOW, FOR 26 DAMAGE APIECE.'),
  D('halo_prison', 'HALO PRISON', 'nova', 10, 8, 40, 'mid', 'DROPS A 40PX RING OF LIGHT ROUND YOU FOR 4S; CROSSING ITS EDGE DEALS 10.'),
  D('tri_breath', 'TRI-BREATH', 'beam', 18, 4.2, 0, 'never', 'THREE TELEGRAPHED LINES OF BREATH, ONE FROM EACH HEAD.'),
  D('regrow_head', 'REGROW HEAD', 'mend', 0, 999, 30, 'heal', 'ONCE, BELOW HALF HEALTH: IT HEALS 15% AND ITS BREATH COMES TWICE AS OFTEN.'),
  D('web_field', 'WEB FIELD', 'mine', 11, 4.5, 0, 'never', 'THROWS HOLDING WEBS ROUND YOUR FEET AND THE WAYS OUT.'),
  D('brood_clock', 'BROOD CLOCK', 'aura', 0, 10, 5, 'mid', 'WINDS UP 3 SPIDERLINGS THAT RUN AT YOU AND CLING ON, EACH SLOWING YOU 15%.'),
  D('root_eruption', 'ROOT ERUPTION', 'mine', 12, 3.8, 0, 'never', 'ROOTS BURST UP UNDER YOU AND WHERE YOU ARE HEADING, AND HOLD YOU.'),
  D('devour', 'DEVOUR', 'nova', 30, 7, 30, 'close', 'OPENS ITS JAWS FOR 1S, THEN BITES ANYTHING WITHIN 30PX FOR 30 AND HEALS THAT MUCH.'),
  D('walk_lightning', 'WALKING BOLTS', 'beam', 14, 4, 0, 'never', 'A LINE OF LIGHTNING STRIKES THAT MARCHES ACROSS THE FLOOR AT YOU.'),
  D('storm_eye', 'EYE OF STORM', 'aura', 0, 9, 5, 'mid', 'FOR 4S IT PULLS YOU TOWARDS ITS EYE WHILE THE RAIN SLOWS YOU 20%.'),
  D('surface_strike', 'SURFACE STRIKE', 'blink', 18, 4.5, 0, 'never', 'IT BURROWS, AND AFTER A RUMBLE ERUPTS UNDERNEATH YOU.'),
  D('cave_in', 'CAVE-IN', 'aura', 0, 10, 5, 'mid', 'ROCKS FALL ALONG THE EDGES FOR 6S: THE ARENA SHRINKS, AND THE EDGES HURT.'),
  D('pounce_line', 'POUNCE LINE', 'dash', 22, 4.5, 0, 'never', 'DRAWS A LINE AT YOU, THEN POUNCES THE WHOLE LENGTH OF IT.'),
  D('mirror_riddle', 'MIRROR RIDDLE', 'aura', 0, 10, 5, 'mid', 'MAKES 2 MIRROR COPIES OF ITSELF; HIT A COPY AND IT FLASHES BACK AT YOU FOR 15.'),
  D('tentacle_waves', 'TENTACLE WAVES', 'mine', 13, 5, 0, 'never', 'WAVES OF TENTACLES SWEEP THE FLOOR, EACH WITH ONE GAP TO SLIP THROUGH.'),
  D('ink_blackout', 'INK BLACKOUT', 'nova', 0, 9, 5, 'mid', 'FLOODS THE ARENA WITH INK: YOUR SIGHT SHRINKS TO 50PX FOR 3S.'),
  D('quake_rings', 'QUAKE RINGS', 'nova', 14, 4.8, 0, 'never', 'IT STAMPS, AND THREE SHOCKWAVE RINGS RUN OUT FROM IT. BE BETWEEN THEM.'),
  D('glacier_drift', 'GLACIER DRIFT', 'nova', 14, 9, 70, 'close', 'FREEZES THE GROUND WITHIN 70PX FOR 4S - YOU ARE HALF SPEED ON IT - THEN ICE SPIKES BURST FROM IT FOR 14.'),
];

export const SPECIALS: Record<string, SpecialDef> = Object.fromEntries(SPECIAL_LIST.map((s) => [s.id, s]));
export const specialById = (id: string): SpecialDef | undefined => SPECIALS[id];
