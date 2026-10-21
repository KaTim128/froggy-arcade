/**
 * The street, in the middle of the day.  The other half of the job.
 *
 * The arcade is a machine for turning tokens into prizes.  This is where the
 * prizes turn into money, and it is the only place in the game where money
 * exists at all.  The man is always here; the doors are always open; you can
 * go in and come out as many times as you like.
 *
 * Nothing bad happens on this street.  That is deliberate — the whole horror
 * act is the arcade at night, and it only lands because the daytime loop was
 * safe and ordinary and you were happy to keep walking back inside.
 *
 * YOU CAN JUST CLICK THE DOOR.  Both things worth touching out here — the
 * doorway and the man — are hit areas as well as walk-up spots: point at one
 * and the player walks there and does the thing, which is how a phone plays
 * this scene and how anybody who would rather not hold a key plays it too.
 * The door lights up under a cursor so it reads as a door you can press, and
 * the `[E]` prompt still appears when you arrive on foot, because neither way
 * of getting there replaces the other.
 */

import Phaser from 'phaser';
import { caughtByPolice, stealthPhase } from '../game/patrol';
import { lookFor } from '../game/catalog';
import { Patrol } from '../game/patrol';
import { TokenHud } from '../ui/hud';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { store } from '../core/state';
import { KEYS } from '../core/input';
import { centerText, fadeIn, fadeToScene, text } from '../core/ui';
import { paintExterior, startSignFlicker, KERB_Y, MAN_X } from '../art/exterior';
import { MysteryMan } from '../art/mysteryMan';
import { Player } from '../art/player';
import { CAMERA_PRIZE, shelfStock } from '../game/content';
import { froggyLayer } from '../render/froggyLayer';
import { GAME_W, GAME_H } from '../render/pixelScaler';
import { backWayOpen } from '../game/closingPull';
import { attachPockets } from '../ui/pockets';
import { ensureKeyInPocket, heldItems } from '../game/inventory';
import { Pedestrians } from '../art/pedestrians';
import { paintWantedPoster } from '../art/wantedPoster';
import { earnBadge } from '../game/badges';
import { evict, payDebt, moveInto213, payRent, rent, rentInDays, RENT_DAYS, RENT_PRICE } from '../game/life';
import { broke, streetTheft, NIGHT_HOUR } from '../game/life';
import { SUNRISE_HOUR, twelveHour, BEG_MS, begNextMs, canBeg, clock, collectBegging, sleep, startBegging, stopBegging, visit } from '../game/life';
import { nightfallOnce, onPhaseTurn } from '../game/dayNight';
import { openTalkPanel, speak } from '../ui/talkPanel';
import { backPlate, fitPrompt, SUBTITLE_Y } from '../ui/plate';
import { resumeSpot, trackPlace } from '../game/place';
import { BEG_SPOT_X, BEG_SPOT_Y, paintBegCup, paintBegSpot } from '../art/begSpot';

const WALK_Y = KERB_Y;
/** Where the alley mouth is, off the arcade's right-hand corner. */
const ALLEY_X = GAME_W - 24;
/** The alley is open to you once you have come through the night in the arcade. */
const alleyOpen = (): boolean => store.get().froggyGone || backWayOpen();
type Spot = 'door' | 'man' | 'alley' | 'beg' | null;
/**
 * THE PITCH: the patch of pavement against the arcade's wall, just left of
 * its doors, where you can sit with a can.  It used to sit out by the kerb
 * halfway along the frontage, a pitch nobody coming out of the arcade would
 * pass; it is up against the building now, a few steps from the doors, where
 * the people with tokens in their pockets actually walk.
 */
const BEG_X = BEG_SPOT_X;
/** And the line it is laid along: back from the walk line, at the wall. */
const BEG_Y = BEG_SPOT_Y;

export class ExteriorDay extends Phaser.Scene {
  private player!: Player;
  private keys: Record<string, Phaser.Input.Keyboard.Key[]> = {};
  private prompt!: Phaser.GameObjects.BitmapText;
  private promptPlate!: Phaser.GameObjects.Rectangle;
  private mutter!: Phaser.GameObjects.BitmapText;
  private spot: Spot = null;
  private locked = false;
  private doorX = GAME_W / 2;
  /** Where a click told the player to go, and what to do on arrival. */
  private errand: Spot = null;
  private doorGlow!: Phaser.GameObjects.Rectangle;

  constructor() {
    super('ExteriorDay');
  }

  /** Where the player came from: the arcade's doors, or the street to the west. */
  private cameFrom: 'arcade' | 'west' | 'alley' | 'east' | 'other' = 'other';
  private people: Pedestrians | null = null;
  private begging = false;
  private begText!: Phaser.GameObjects.BitmapText;
  private cup: Phaser.GameObjects.Graphics | null = null;
  /** It has just turned midnight: the thoughts play, and nobody moves till they have. */
  private nightfall = false;

  init(data: { fromArcade?: boolean; fromWest?: boolean; fromAlley?: boolean; fromEast?: boolean; nightfall?: boolean; atX?: number; woke?: string; opening?: boolean; respawn?: string } = {}): void {
    this.opening = data.opening === true;
    this.cameFrom = data.fromArcade ? 'arcade' : data.fromWest ? 'west' : data.fromAlley ? 'alley' : data.fromEast ? 'east' : 'other';
    this.nightfall = data.nightfall === true;
    this.atX = data.atX ?? null;
    this.woke = data.woke ?? null;
    this.respawn = data.respawn ?? null;
  }

  /** Caught in the stealth phase, and put back here to try again. */
  private respawn: string | null = null;

  /** Where you stood when the light turned: the forecourt repaints round you. */
  private atX: number | null = null;
  /** Just woken on the mat, and what the night came to. */
  private woke: string | null = null;
  /** The life clock's night (not the story's midnight): the forecourt in the dark. */
  private lifeDark = false;
  /** Sunrise has just come: the shutters go up as you watch. */
  private opening = false;
  /** Down over the doors at night (after the night in the arcade, when it keeps hours). */
  private shutter: Phaser.GameObjects.Container | null = null;

  create(): void {
    this.talking = null;
    froggyLayer.clear();
    this.locked = false;
    this.spot = null;
    // out of the night with the key in a pocket, however you got here
    ensureKeyInPocket();

    // ---- WHAT TIME IT IS.
    //
    // NOTHING OUT HERE MOVES THE STORY'S CLOCK ON.  Walking out of the doors
    // with a full pocket used to force the evening, which meant a player who
    // had done well found the sky changed under them for no reason they
    // could see, and the hour they had been keeping went with it.  The life
    // clock (game/life) owns the time and the light now, all day, every day.
    //
    // The ONE thing that turns the world dark is the man in the suit paying
    // out: when he hands over enough for a room (ROOM_MONEY) he calls it a
    // day, and putting his table away is what sets midnight (see
    // PrizeExchange `afterSale` / `close`).  Carrying prizes worth that much
    // does nothing; selling them for it is the whole of it.
    const st0 = store.get();
    const time = st0.timeOfDay;
    this.time0 = time;

    fadeIn(this);
    audio.setScene(time === 'midnight' ? { music: 'neon_buzz', ambience: ['wind_low', 'crickets'] } : { music: 'theme_arcade', ambience: ['street_dusk'] });

    // the clock's night (twelve hours of it, as long as the day): the
    // forecourt at dusk colours under a dark sky, the lamps and the arcade's
    // lit front glowing in it.  (The story's midnight paints its own.)
    // the sky follows the clock: morning, evening (the sun going down), night.
    // (The story's evening keeps its dusk; the story's midnight paints its own.)
    const phase = clock().phase;
    this.lifeDark = time !== 'midnight' && phase === 'night';
    const sunny = time === 'day' && phase === 'morning';
    const refs = paintExterior(this, { night: time === 'midnight', day: sunny, darkSky: this.lifeDark });
    if (this.lifeDark) this.paintNight(refs.doorX);
    // after the night in the arcade it keeps hours: shuttered all night, and
    // the shutters roll up at sunrise
    this.shutter = null;
    // (and before it, once it has shut for the night: nobody is let back in at the front)
    if (time !== 'midnight' && (this.lifeDark || ((this.opening || this.woke) && st0.froggyGone))) this.shutter = this.paintShutter(refs.doorRect);
    startSignFlicker(this, refs);
    this.doorX = refs.doorX;
    this.errand = null;
    this.makeSpotsClickable(refs.doorRect);

    // He stands where he stands.  Nothing in this scene ever moves him, so he
    // does not need keeping hold of -- and at midnight he is not there.
    if (time !== 'midnight') new MysteryMan(this, MAN_X, WALK_Y + 4);
    else this.paintClosed(refs.doorRect);
    // TWO WEEKS ON: your face, pasted over the arcade's own posters by the doors
    if (st0.arc !== 'none') {
      // (one either side of the doors, each over one of the arcade's own --
      // the face you had when they went up, whatever you look like now)
      const face = st0.wantedOutfit ? lookFor(st0.wantedOutfit) : undefined;
      paintWantedPoster(this, 97, 95, 41, face);
      paintWantedPoster(this, 199, 95, 41, face);
    }
    // You come out of the doors standing at them, so going back in is one key
    // press away — the loop is meant to be walked dozens of times.
    // DAY COLOURS, on the one scene in the game that is painted in daylight.
    // It was building him with the NIGHT flag on, which runs every colour he
    // has through `nightify`: cap, hood, coat and trousers all came out the
    // same desaturated blue-grey, stood on a sunlit forecourt.  The night
    // scenes -- the alley, the dark arcade, the street after hours -- keep it.
    // On the pavement in front of the arcade's windows, clear of the doors
    // (or at the end you walked in from: the road west, the alley mouth).
    // (caught, in the hunt: back here, at the start, by the man)
    const startX = this.respawn ? MAN_X - 20 : this.woke ? BEG_X - 3 : this.atX ?? (this.cameFrom === 'west' ? 26 : this.cameFrom === 'alley' ? ALLEY_X - 6 : this.cameFrom === 'east' ? GAME_W - 10 : this.doorX + 46);
    this.player = new Player(this, startX, WALK_Y, time === 'midnight');
    // The forecourt is loose ground, not the arcade's carpet.  This scene
    // never said so, which left the walk outside sounding like the walk in.
    this.player.setSurface('gravel');
    // kept with the run, and back on the spot when resumed here (game/place)
    trackPlace(this, () => this.player, {}, resumeSpot(this.sys.settings.data));

    // now and then, two weeks on: an officer walking the pavement (game/patrol)
    this.patrol = time === 'midnight' ? null : this.makePatrol();
    // What you are carrying: cash and tokens, side by side and never added
    // together -- the same HUD as inside.
    // THE HUNT OVER: a new face, and back outside the arcade -- the purse,
    // the tokens and the time come back (ui/hud 'labeled')
    const reveal = st0.arc === 'live' && st0.disguised && !st0.hudShown;
    if (reveal) {
      store.patch({ hudShown: true });
      store.flush();
    }
    const hud = new TokenHud(this);
    if (reveal) {
      hud.revealIn();
      this.time.delayedCall(700, () => this.say('THE HUNT IS OVER. NOBODY KNOWS THIS FACE.'));
    }
    attachPockets(this, () => this.locked || this.busy());

    this.promptPlate = this.add.rectangle(0, 0, 4, 12, PALETTE.black, 0.7).setDepth(800).setVisible(false);
    this.prompt = text(this, 0, 0, '', PALETTE.gold).setDepth(801).setOrigin(0.5, 0.5).setVisible(false);
    this.mutter = centerText(this, GAME_W / 2, SUBTITLE_Y, '', PALETTE.cream).setDepth(802).setVisible(false);
    backPlate(this, this.mutter);

    this.keys = { left: this.bind(KEYS.left), right: this.bind(KEYS.right) };
    this.input.keyboard?.on('keydown-E', () => this.interact());

    // The exchange hands back here; the purse and the man's line may both have
    // changed while it was open.
    this.events.on('exchange-closed', () => {
      this.checkFinished();
      if (store.get().timeOfDay === 'midnight' && this.time0 !== 'midnight') {
        // He packs up and goes; the light goes with him.
        this.locked = true;
        fadeToScene(this, 'ExteriorDay', { nightfall: true });
        return;
      }
    });

    this.checkFinished();
    // ---- THE STREET IS NOT EMPTY.  People going past, and by the wall a
    // flattened cardboard box and a paper cup: the begging spot.
    this.begging = false;
    if (time !== 'midnight') {
      this.people = new Pedestrians(this, GAME_W, WALK_Y + 3, 3, false);
      paintBegSpot(this, BEG_X, BEG_Y);
      // the can, on the cardboard until somebody sits down with it
      this.cup = paintBegCup(this, BEG_X, BEG_Y);
      this.add.zone(BEG_X - 14, BEG_Y - 30, 28, 36).setOrigin(0, 0).setDepth(61).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.send('beg'));
      visit('forecourt');
    } else this.people = null;
    this.begText = centerText(this, BEG_X, WALK_Y - 52, '', PALETTE.gold).setDepth(803).setVisible(false);
    backPlate(this, this.begText);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.begging) stopBegging();
    });
    // and the way east, to the shops
    if (time !== 'midnight') text(this, GAME_W - 10, WALK_Y + 4, '>', PALETTE.cream).setDepth(800).setAlpha(0.7);
    // the way west, marked at the edge of the pavement
    text(this, 6, WALK_Y + 4, '<', time === 'midnight' ? PALETTE.ash : PALETTE.cream).setDepth(800).setAlpha(0.7);
    if (time === 'midnight' && this.nightfall) this.midnightThoughts();
    if (time !== 'midnight') {
      // dusk or dawn while you are out here: the forecourt repaints for it
      onPhaseTurn(
        this,
        (p) => {
          this.locked = true;
          fadeToScene(this, 'ExteriorDay', { atX: Math.round(this.player.x), opening: p === 'morning' });
        },
        () => !this.locked && !this.busy() && !this.begging,
      );
      if (this.opening && !this.woke) this.raiseShutter();
      if (st0.arc === 'back') this.time.delayedCall(700, () => this.comeBack());
      else if (this.respawn) this.time.delayedCall(500, () => this.say("BACK AT THE START. SHARP'S IS EAST - STAY OUT OF SIGHT."));
      else if (this.woke) this.wakeUp(this.woke);
      else {
        const line = nightfallOnce();
        if (line) this.time.delayedCall(500, () => this.say(line));
      }
    }
  }

  private time0: 'day' | 'evening' | 'midnight' = 'day';
  private patrol: Patrol | null = null;

  /** Now and then (or, in the hunt, always) an officer on the pavement. */
  private makePatrol(grace = 0): Patrol {
    return new Patrol({
      grace: grace || (this.respawn ? 4 : 0),
      scene: this,
      worldW: GAME_W,
      y: WALK_Y,
      player: () => this.player,
      dark: () => this.lifeDark,
      lowProfile: () => this.begging,
      lock: (on) => {
        this.locked = on;
        if (on) this.errand = null;
      },
    });
  }

  /**
   * The arcade shut: the glass doors chained through their handles (see
   * paintExterior), the sign dark, and CLOSED over the door.
   */
  private paintClosed(door: { x: number; y: number; w: number; h: number }): void {
    // (hung above the doors, where the door's prompt does not cover it)
    this.add.rectangle(door.x + door.w / 2, door.y - 7, 42, 10, 0x14100c).setDepth(46).setStrokeStyle(1, 0xc31f2e);
    centerText(this, door.x + door.w / 2, door.y - 7, 'CLOSED', 0xc31f2e).setDepth(47);
  }

  /**
   * ---- MIDNIGHT.  The man has gone, the arcade is shut, and the player
   * stands on the pavement and thinks, three thoughts, and does not move
   * until they have.
   */
  /**
   * Nightfall, thought aloud: each line holds for a few seconds, and a click
   * or a tap on the words (or SPACE / ENTER) moves on to the next at once.
   */
  private midnightThoughts(): void {
    this.locked = true;
    const lines = [
      "It's getting dark...",
      'I finally have enough to afford a decent place to rest. Maybe I should try those condos down the street.',
      'I can get back to grabbing arcade prizes tomorrow.',
    ];
    let i = -1;
    let timer: Phaser.Time.TimerEvent | null = null;
    // the text area: the bottom of the screen, where the line is written
    const zone = this.add.zone(0, GAME_H - 64, GAME_W, 64).setOrigin(0, 0).setScrollFactor(0).setDepth(900).setInteractive({ useHandCursor: true });
    const kb = this.input.keyboard;
    const next = (): void => {
      timer?.remove(false);
      timer = null;
      if (i >= lines.length) return;
      i++;
      if (i < lines.length) {
        this.mutter.setText(lines[i]).setVisible(true).setAlpha(1).setMaxWidth(290);
        this.tweens.killTweensOf(this.mutter);
        timer = this.time.delayedCall(3200, next);
        return;
      }
      zone.destroy();
      kb?.off('keydown-SPACE', next);
      kb?.off('keydown-ENTER', next);
      this.tweens.add({ targets: this.mutter, alpha: 0, duration: 600 });
      this.locked = false;
    };
    zone.on('pointerdown', next);
    kb?.on('keydown-SPACE', next);
    kb?.on('keydown-ENTER', next);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      kb?.off('keydown-SPACE', next);
      kb?.off('keydown-ENTER', next);
    });
    timer = this.time.delayedCall(800, next);
  }

  /**
   * The door and the man, as things you can point at.
   *
   * A click is an ERRAND, not a teleport: the player walks over on their own
   * legs and the interaction fires when they get there, so clicking and
   * walking end in exactly the same place and the scene never has two ways of
   * being somewhere.  Clicking what you are already standing at just does it.
   *
   * Only the door lights up.  It is the way out of the scene and the thing a
   * new player is looking for; the man is a person standing in the open, and a
   * glowing rectangle around him would read as something being wrong with him.
   */
  private makeSpotsClickable(door: { x: number; y: number; w: number; h: number }): void {
    this.doorGlow = this.add
      .rectangle(door.x - 2, door.y - 2, door.w + 4, door.h + 4)
      .setOrigin(0, 0)
      .setStrokeStyle(1, PALETTE.gold)
      // behind whoever is standing at the door (people are 50 and up), in
      // front of the shopfront and its CLOSED sign
      .setDepth(48)
      .setAlpha(0)
      .setFillStyle(PALETTE.gold, 0.12);

    const zone = this.add
      .zone(door.x, door.y, door.w, door.h)
      .setOrigin(0, 0)
      .setDepth(61)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => {
      if (!this.locked && !this.busy()) this.tweens.add({ targets: this.doorGlow, alpha: 1, duration: 110 });
    });
    zone.on('pointerout', () => this.tweens.add({ targets: this.doorGlow, alpha: 0, duration: 160 }));
    zone.on('pointerdown', () => this.send('door'));

    // And the alley mouth, once it is somewhere you can go.
    if (alleyOpen()) {
      this.add
        .zone(GAME_W - 46, 76, 46, 74)
        .setOrigin(0, 0)
        .setDepth(61)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.send('alley'));
    }

    // The man gets the same reach, sized to him rather than to the doorway.
    this.add
      .zone(MAN_X - 14, WALK_Y - 34, 28, 40)
      .setOrigin(0, 0)
      .setDepth(61)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.send('man'));
  }

  /** Go and do that.  Arriving is `update`'s job; this only sets the errand. */
  private send(where: Spot): void {
    if (this.locked || this.busy()) return;
    if (this.begging && where !== 'beg') {
      this.say('YOU ARE SITTING WITH THE CAN. [E] TO GET UP FIRST.');
      return;
    }
    audio.sfx('ui_blip', 0.4);
    if (this.spot === where) {
      this.errand = null;
      this.interact();
      return;
    }
    this.errand = where;
  }

  private targetX(where: Spot): number {
    return where === 'man' ? MAN_X + 16 : where === 'alley' ? ALLEY_X : where === 'beg' ? BEG_X : this.doorX;
  }

  private bind(names: readonly string[]): Phaser.Input.Keyboard.Key[] {
    const kb = this.input.keyboard;
    return kb ? names.map((n) => kb.addKey(n)) : [];
  }

  private held(g: string): boolean {
    return this.keys[g]?.some((k) => k.isDown) ?? false;
  }

  /**
   * Everything on the shelf sold: nothing is said, and the game goes on.  The
   * case is restocked quietly, so the next time you are inside the arcade
   * there is a fresh lot behind the glass.  (The camera is not one of the
   * shelf's set: it does not count towards clearing it.)
   */
  private checkFinished(): void {
    const s = store.get();
    const shelf = shelfStock(s).filter((p) => p.id !== CAMERA_PRIZE.id);
    if (!shelf.length || !shelf.every((p) => s.prizesSold.includes(p.id))) return;
    store.patch({ prizeWave: s.prizeWave + 1 });
    store.flush();
  }

  private interact(): void {
    if (this.locked || this.busy() || !this.spot) return;
    if (this.patrol?.chasing && this.spot !== 'door' && this.spot !== 'alley') {
      this.say('NO TIME - GET OUT OF SIGHT!');
      return;
    }

    if (this.spot === 'door') {
      if (this.time0 === 'midnight') {
        audio.sfx('door_rattle', 0.7);
        this.say('Shut. The lights are off inside, all of them.');
        return;
      }
      if (this.shutter) {
        audio.sfx('door_rattle', 0.7);
        this.say(`THE SHUTTERS ARE DOWN. THE ARCADE OPENS AT ${twelveHour(SUNRISE_HOUR)}.`);
        return;
      }
      this.locked = true;
      audio.sfx('door_open');
      this.patrol?.safe();
      fadeToScene(this, 'ArcadeHub', { fromDoor: 'street' });
      return;
    }
    if (this.spot === 'beg') {
      if (this.begging) {
        this.getUp();
        return;
      }
      // a place of your own: no can, and your bed is there
      if (!canBeg()) {
        this.say("YOU RENT A PLACE AT LILY'S NOW. NO NEED FOR THE CAN - SLEEP THERE.");
        return;
      }
      return this.pitchChoice();
    }
    if (this.spot === 'alley') {
      this.locked = true;
      audio.sfx('footstep_gravel', 0.5);
      this.patrol?.hideAway();
      fadeToScene(this, 'BackAlley', {});
      return;
    }

    const s = store.get();
    if (stealthPhase()) {
      this.manSays('"Sharp\'s. East of here. Change that face before you do anything else -- and don\'t you dare lie down anywhere until you have."');
      return;
    }
    // ---- THE RENT ON 213 IS HIS: due (or a week ahead), or the flat to take back
    if (s.arc === 'live' && !this.rentAsked && (!s.life.rented || rentInDays(s.life) <= RENT_DAYS - 1)) return this.rentTalk();
    this.rentAsked = false;
    if (broke()) {
      this.manSays('"You expect me to lend you money when you\'ve got nothing? Go earn it by begging!"');
      return;
    }
    const toSell = s.prizesOwned.filter((id) => !s.prizesSold.includes(id));
    if (toSell.length === 0 && heldItems(s).length === 0) {
      this.manSays(s.prizesOwned.length === 0
        ? '"Nothing yet?  The counter is inside, friend."'
        : '"You have sold me everything you are carrying."');
      return;
    }
    this.scene.launch('PrizeExchange', { from: 'ExteriorDay' });
  }


  /**
   * ---- THE PITCH: BEG, OR SLEEP.  With no place of your own the cardboard
   * is both -- sit with the can ($1 every 15 minutes, any time), or, at
   * night only, lie down on it.  The card says plainly what a night out here
   * risks before you choose it.
   */
  private pitchChoice(): void {
    if (this.talking) return;
    const dark = clock().dark;
    const line = dark
      ? `BEG WITH THE CAN ($1 EVERY 15 MINUTES), OR SLEEP HERE TILL MORNING. THIEVES WORK THIS STREET AT NIGHT: ONE NIGHT IN FOUR THEY TAKE HALF YOUR CASH AND TOKENS.`
      : `BEG WITH THE CAN: $1 EVERY 15 MINUTES. SLEEPING OUT HERE IS FOR NIGHT-TIME ONLY.`;
    this.talking = openTalkPanel(this, {
      who: 'YOUR PITCH',
      color: PALETTE.gold,
      line,
      depth: 950,
      options: [
        { label: 'BEG', fn: () => ((this.talking = null), this.startBeg()) },
        {
          label: dark ? 'SLEEP' : 'SLEEP (NIGHT)',
          fn: () => {
            this.talking = null;
            if (!clock().dark) {
              this.say(`TOO LIGHT AND TOO BUSY TO SLEEP. WAIT FOR DARK, AFTER ${twelveHour(NIGHT_HOUR)}.`);
              return;
            }
            // the man's warning: no sleeping until the face on the poster is gone
            if (stealthPhase()) {
              this.locked = true;
              caughtByPolice(this, 'sleep');
              return;
            }
            this.sleepRough();
          },
        },
        { label: 'CANCEL', fn: () => (this.talking = null) },
      ],
    });
  }

  /** Down onto the cardboard, the can held out; nobody walks off from here. */
  private startBeg(): void {
    startBegging();
    this.begging = true;
    this.errand = null;
    this.player.setPosition(BEG_X - 3, BEG_Y);
    this.player.sit('floor', { can: true, facing: 1 });
    this.cup?.setVisible(false);
    this.say('YOU SIT DOWN WITH THE CAN. $1 EVERY 15 MINUTES. [E] TO GET UP.');
  }

  /** Up off the cardboard: begging over, and what is in the can is yours. */
  /**
   * A night on the pavement: down onto the mat, flat out, the Zs going up,
   * the dark coming in; then the clock to the morning, and the forecourt in
   * daylight with the shops open again.
   */
  private sleepRough(): void {
    this.locked = true;
    this.errand = null;
    this.prompt.setVisible(false);
    this.promptPlate.setVisible(false);
    this.player.setPosition(BEG_X - 3, BEG_Y);
    this.player.lie(1);
    this.cup?.setVisible(false);
    // (over the mat, clear of the sleeper)
    this.begText.setText('GOOD NIGHT...').setPosition(BEG_X, WALK_Y - 40).setVisible(true).setAlpha(1);
    const zs = this.time.addEvent({
      delay: 650,
      loop: true,
      callback: () => {
        const z = text(this, BEG_X - 10 + Math.random() * 6, WALK_Y - 10, 'Z', PALETTE.cream).setDepth(805);
        this.tweens.add({ targets: z, x: z.x - 8, y: z.y - 22, alpha: 0, duration: 1600, onComplete: () => z.destroy() });
      },
    });
    this.time.delayedCall(2200, () => {
      this.cameras.main.fadeOut(1400, 0, 0, 0);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        zs.remove();
        this.begText.setVisible(false);
        const r = sleep('street');
        // ---- AND IN THE NIGHT, MAYBE, A HAND IN YOUR POCKETS: said on the
        // dark, before the morning comes up
        const got = streetTheft();
        if (!got) {
          this.scene.restart({ woke: r.msg });
          return;
        }
        const what =
          got.cash || got.tokens
            ? `SOMEONE STOLE ${[got.cash ? `$${got.cash} OF YOUR CASH` : '', got.tokens ? `${got.tokens} OF YOUR TOKENS` : ''].filter(Boolean).join(' AND ')} WHILE YOU WERE ASLEEP.`
            : 'SOMEONE WENT THROUGH YOUR POCKETS IN THE NIGHT. THERE WAS NOTHING TO TAKE.';
        this.cameras.main.resetFX();
        this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 1).setOrigin(0, 0).setDepth(5000);
        const t = centerText(this, GAME_W / 2, GAME_H / 2 - 6, what, PALETTE.cream).setDepth(5001).setMaxWidth(270).setAlpha(0);
        const t2 = centerText(this, GAME_W / 2, GAME_H / 2 + 20, 'THIEVES.', 0xd06060).setDepth(5001).setAlpha(0);
        audio.sfx('eerie_swell', 0.25);
        this.tweens.add({ targets: [t, t2], alpha: 1, duration: 700 });
        this.time.delayedCall(4200, () => this.scene.restart({ woke: got.cash || got.tokens ? 'MORNING. LIGHTER POCKETS THAN LAST NIGHT.' : r.msg }));
      });
    });
  }

  /** On the mat at first light: a moment flat out, then up. */
  private wakeUp(msg: string): void {
    this.locked = true;
    this.player.lie(1);
    this.cup?.setVisible(false);
    this.time.delayedCall(1300, () => {
      this.player.getUp();
      this.cup?.setVisible(true);
      this.locked = false;
      this.say(msg);
      this.raiseShutter();
    });
  }

  private getUp(): void {
    const got = stopBegging();
    this.begging = false;
    this.begText.setVisible(false);
    this.player.getUp();
    this.cup?.setVisible(true);
    this.say(got ? `YOU GET UP. $${got} IN THE CAN.` : 'YOU GET UP.');
  }

  /**
   * The forecourt after dark: the sky and the street under a deep blue, the
   * arcade's front and its lamps glowing through it, a lamp's pool on the
   * pavement by the mat.
   */
  private paintNight(doorX: number): void {
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x080c24, 0.42).setOrigin(0, 0).setDepth(700);
    const glow = (x: number, y: number, w: number, h: number, col: number, a: number) =>
      this.add.ellipse(x, y, w, h, col, a).setDepth(701).setBlendMode(Phaser.BlendModes.ADD);
    glow(doorX, 70, 150, 40, 0xff4fa3, 0.22);
    glow(doorX, 132, 60, 40, 0xffe0a0, 0.25);
    glow(doorX - 33, 102, 26, 26, 0xffe0a0, 0.3);
    glow(doorX + 33, 102, 26, 26, 0xffe0a0, 0.3);
    glow(BEG_X, BEG_Y + 4, 46, 10, 0xffd890, 0.12);
    // a few windows lit in the buildings behind
    const w = this.add.graphics().setDepth(701);
    for (let i = 0; i < 9; i++) w.fillStyle(0xf0d070, 0.55).fillRect(12 + ((i * 71) % 290), 40 + ((i * 29) % 20), 2, 2);
  }

  /**
   * The roller shutter over the doors: steel slats in a box under the sign,
   * a padlocked bottom rail, and OPENS 7:00 AM stencilled on it.
   */
  private paintShutter(door: { x: number; y: number; w: number; h: number }): Phaser.GameObjects.Container {
    const x = door.x - 3;
    const w = door.w + 6;
    const top = door.y - 4;
    const h = door.h + 4;
    const g = this.add.graphics();
    g.fillStyle(0x14100c, 1).fillRect(0, 0, w, h);
    g.fillStyle(0x8a929e, 1).fillRect(1, 0, w - 2, h - 1);
    for (let y = 2; y < h - 3; y += 3) {
      g.fillStyle(0x5a626e, 1).fillRect(1, y, w - 2, 1);
      g.fillStyle(0xb8c0ca, 0.6).fillRect(1, y + 1, w - 2, 1);
    }
    g.fillStyle(0x3a3f48, 1).fillRect(0, h - 4, w, 4);
    g.fillStyle(0xd8a838, 1).fillRect(w / 2 - 2, h - 4, 4, 3);
    const label = centerText(this, w / 2, h / 2 - 2, 'OPENS', 0x2a2e36);
    const label2 = centerText(this, w / 2, h / 2 + 7, twelveHour(SUNRISE_HOUR).replace(':00', ''), 0x2a2e36);
    // the box it rolls up into
    const box = this.add.rectangle(x - 1, top - 4, w + 2, 5, 0x3a3f48).setOrigin(0, 0).setStrokeStyle(1, 0x14100c).setDepth(46);
    const c = this.add.container(x, top, [g, label, label2]).setDepth(45);
    c.setData('h', h);
    c.once(Phaser.GameObjects.Events.DESTROY, () => box.destroy());
    return c;
  }

  /** Sunrise: the shutter rattles up into its box, and the doors are open. */
  private raiseShutter(): void {
    const sh = this.shutter;
    if (!sh) return;
    audio.sfx('door_rattle', 0.6);
    this.tweens.add({
      targets: sh,
      scaleY: 0.04,
      delay: 500,
      duration: 1800,
      ease: 'Quad.InOut',
      onComplete: () => {
        sh.destroy();
        if (this.shutter === sh) this.shutter = null;
        this.say(`${twelveHour(SUNRISE_HOUR)}. SUNRISE - THE ARCADE IS OPEN.`);
      },
    });
  }

  /** Asked about the rent this visit: the next [E] goes on to the prizes. */
  private rentAsked = false;

  /**
   * ---- ROOM 213'S RENT, TO HIM.  $100 a week, paid here, on the street;
   * or, if it has lapsed, the flat to have again.  The prizes are the other
   * answer.
   */
  private rentTalk(): void {
    if (this.talking) return;
    const l = store.get().life;
    const d = rentInDays(l);
    const short = store.get().cash < RENT_PRICE ? ' Short? Sell some of your things at Lily\'s desk -- or move out.' : '';
    const line = !l.rented && l.debt > 0
      ? `"You walked out owing me ${l.debt === 1 ? 'a week' : `${l.debt} weeks`}. That first, $${RENT_PRICE}. Then this week, $${RENT_PRICE}."${short ? `${short.replace(' or move out', '')}` : ''}`
      : !l.rented
      ? `"213's empty since you stopped paying. $${RENT_PRICE} and the key's yours again."`
      : d < 0
        ? `"You're late. $${RENT_PRICE} for 213, now, or I find a tenant who pays."`
        : d === 0
          ? `"Rent day. $${RENT_PRICE} for 213, cash, to me."`
          : `"Rent on 213's due in ${d} ${d === 1 ? 'day' : 'days'}. Pay ahead if you like: $${RENT_PRICE}."`;
    const lineFull = l.rented && d <= 0 ? line + short : line;
    const done = (msg: string) => {
      this.talking = null;
      this.say(msg);
    };
    const pay = (fn: () => { ok: boolean; msg: string }) => () => {
      const r = fn();
      if (r.ok) audio.sfx('coin_drop', 0.6);
      store.flush();
      done(r.msg);
    };
    this.talking = openTalkPanel(this, {
      speaker: 'man',
      line: lineFull,
      depth: 950,
      options: [
        // one button per week: what is owed from before, then this week
        ...(!l.rented && l.debt > 0 ? [{ label: `OVERDUE WEEK $${RENT_PRICE}`, fn: pay(payDebt) }] : []),
        { label: l.rented ? `PAY THIS WEEK $${RENT_PRICE}` : l.debt > 0 ? `THIS WEEK $${RENT_PRICE}` : `RENT 213 - $${RENT_PRICE}`, fn: pay(l.rented ? payRent : rent) },
        ...(l.rented && d <= 0 ? [{ label: 'MOVE OUT', fn: pay(() => (evict(), { ok: true, msg: store.get().life.notice || 'MOVED OUT.' })) }] : []),
        {
          label: 'PRIZES',
          fn: () => {
            this.talking = null;
            this.rentAsked = true;
            this.spot = 'man';
            this.interact();
          },
        },
        { label: 'LATER', fn: () => (this.talking = null) },
      ],
    });
  }

  /**
   * ---- BACK, TWO WEEKS LATER.  Your own face on the arcade's wall, and the
   * man has a word: $200 for the trouble, a flat at Lily's (Level 2, room
   * 213, the middle door -- a week free, then the rent is his), and the
   * police on the streets now and then.  Nobody moves till he has said it.
   */
  private comeBack(): void {
    this.locked = true;
    this.errand = null;
    this.player.face(1);
    this.say('...IS THAT MY FACE? ON THE WALL?');
    earnBadge('most_wanted', this);
    // the face on the poster: what you have on now
    store.patch({ wantedOutfit: { ...(store.get().life.outfit as Record<string, string>) } });
    const lines = [
      '"Well, well. If it isn\'t the most famous face on the street."',
      '"Something strange went on at Lily\'s that night. And you were right in the middle of it. I\'d bet my hat."',
      '"A word of warning: the police are all over these streets. Every one of them has seen that poster."',
      '"If you want to get away from them, change your appearance. Sharp\'s, the barber, east of here. A new cut, a new colour."',
      '"Keep out of their sight on the way. Duck down an alley if one comes. Into the arcade, or any gap between the shops."',
      '"And don\'t even think of trying to find a place to sleep until your appearance is changed. If you try to sleep before changing your look, you will get caught."',
      '"Home is Lily\'s again. I rented you a flat: LEVEL 2, ROOM 213. The middle door."',
      `"The first week's on me. After that the rent comes to me, not the landlord. $${RENT_PRICE} a week."`,
      '"Why? A roof over your head keeps you winning prizes. And I do like easy money."',
      '"Here. $200. Call it compensation for the rental situation... and everything after it."',
      '"Don\'t go soft on me, though. I still want my prizes. And I still want them cheap. Now go and get that haircut."',
    ];
    let i = 0;
    const next = (): void => {
      if (i >= lines.length) {
        store.earnCash(200);
        moveInto213();
        store.patch({ arc: 'live' });
        store.flush();
        // and the hunt is on, from here (a moment's start on them)
        this.patrol = this.makePatrol(5);
        audio.sfx('coin_drop', 0.7);
        this.talking = null;
        this.locked = false;
        this.say("$200. NOW TO SHARP'S, EAST - WITHOUT BEING SEEN.");
        return;
      }
      this.talking = speak(this, 'man', lines[i++], () => {
        this.talking = null;
        // (the next on the next frame: not the same press)
        this.time.delayedCall(60, next);
      });
    };
    this.time.delayedCall(2600, next);
  }

  /** The man in black says something, in his own box. */
  private manSays(line: string): void {
    if (this.talking) return;
    this.talking = speak(this, 'man', line, () => (this.talking = null));
  }

  private talking: Phaser.GameObjects.Container | null = null;

  private busy(): boolean {
    return !!this.talking || this.scene.isActive('PrizeExchange') || this.scene.isActive('SettingsModal') || this.scene.isActive('Goals') || this.scene.isActive('InventoryModal');
  }

  private say(msg: string): void {
    this.mutter.setText(msg).setVisible(true).setAlpha(1);
    this.tweens.killTweensOf(this.mutter);
    this.tweens.add({ targets: this.mutter, alpha: 0, delay: 2200, duration: 600 });
  }

  update(_t: number, delta: number): void {
    this.people?.update(delta);
    this.patrol?.update(delta);
    if (this.begging) {
      const got = collectBegging();
      if (got) {
        audio.sfx('coin_drop', 0.6);
        this.say(`SOMEONE DROPS $${got} IN THE CUP.`);
      }
      const ms = begNextMs();
      const m = Math.floor(ms / 60000);
      const sec = Math.floor((ms % 60000) / 1000);
      this.begText.setText(`NEXT $1 IN ${m}:${String(sec).padStart(2, '0')}`).setVisible(true);
      void BEG_MS;
    }
    if (this.locked || this.busy()) {
      this.prompt.setVisible(false);
      this.promptPlate.setVisible(false);
      return;
    }

    let dx = (this.held('right') ? 1 : 0) - (this.held('left') ? 1 : 0);
    // A hand on the keys always wins: touching a movement key drops whatever
    // the last click asked for, so the two never fight over the same legs.
    if (dx !== 0) this.errand = null;
    // sat with the can, you stay sat: only [E] gets you up
    if (this.begging) {
      dx = 0;
      this.errand = null;
      this.spot = 'beg';
      this.showPrompt('[E] GET UP');
      return;
    }
    if (this.errand) {
      const gap = this.targetX(this.errand) - this.player.x;
      if (Math.abs(gap) <= 2) {
        const done = this.errand;
        this.errand = null;
        this.spot = done;
        this.interact();
        return;
      }
      dx = gap > 0 ? 1 : -1;
    }
    this.player.move(dx, 0, delta, new Phaser.Geom.Rectangle(4, WALK_Y, GAME_W - 8, 0));
    // ---- EAST, off the right-hand end: the shops (not at midnight).
    if (this.player.x >= GAME_W - 5 && dx > 0 && this.time0 !== 'midnight') {
      this.locked = true;
      this.patrol?.leaveBy('left');
      fadeToScene(this, 'StreetEast', {});
      return;
    }
    // ---- WEST, off the left-hand end: the street to the hotel by day and
    // by evening; at midnight, the night road.
    if (this.player.x <= 5 && dx < 0) {
      this.locked = true;
      this.patrol?.leaveBy('right');
      fadeToScene(this, this.time0 === 'midnight' ? 'NightRoad3D' : 'StreetWest', {});
      return;
    }

    const px = this.player.x;
    this.spot =
      this.time0 !== 'midnight' && Math.abs(px - MAN_X) < 22
        ? 'man'
        : Math.abs(px - this.doorX) < 24
          ? 'door'
          : this.time0 !== 'midnight' && Math.abs(px - BEG_X) < 10
            ? 'beg'
          : px > ALLEY_X - 8 && alleyOpen()
            ? 'alley'
            : null;

    if (!this.spot) {
      this.prompt.setVisible(false);
      this.promptPlate.setVisible(false);
      return;
    }

    const begLabel = !canBeg() ? 'YOUR BED IS AT LILY\'S' : clock().dark ? '[E] BEG OR SLEEP' : '[E] BEG';
    const label = this.spot === 'beg' ? begLabel : this.spot === 'man' ? '[E] TALK' : this.spot === 'alley' ? '[E] ALLEY' : this.time0 === 'midnight' ? '[E] DOOR' : '[E] GO IN';
    this.showPrompt(label);
  }

  private showPrompt(label: string): void {
    const x = Phaser.Math.Clamp(this.player.x, 40, GAME_W - 40);
    this.prompt.setText(label).setPosition(x, WALK_Y - 34).setVisible(true);
    fitPrompt(this.promptPlate, this.prompt);
  }
}
