/**
 * Arcade hub.  PRD §7.5.
 *
 * Warm, loud, busy, and completely uninterested in the player.  Six cabinets
 * (seven games), a prize case behind glass, a counter nobody is standing at,
 * and a bell that does nothing.  Ever.  (VOC-18 — it will be tempting to make
 * the bell do something.  Do not.)
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { store, type GameId } from '../core/state';
import { ledger } from '../core/ledger';
import { canEnter } from '../core/routes';
import { evaluateBroke } from '../core/broke';
import { KEYS } from '../core/input';
import { fadeIn, fadeToScene, text } from '../core/ui';
import { paintArcadeDressing, paintChangeMachine, paintHubRoom, paintOpening, ROOM } from '../art/hubRoom';
import { Player } from '../art/player';
import { Cabinet, CAB_W, CAB_H } from '../art/cabinet';
import { TokenHud } from '../ui/hud';
import { ANNEX_DOOR, BELL, CABINETS, COUNTER, COUNTER_DEPTH, PRIZE_CASE, cabinetsIn, prizesForWave } from '../game/content';
import { DialogueBox } from '../froggy/dialogue';
import { CounterStaff } from '../art/counterStaff';
import { drawFroggy, FROGGY_DESIGN } from '../froggy/froggy';
import { button } from '../core/ui';
import { tutorialScript } from '../froggy/script';
import { froggyLayer } from '../render/froggyLayer';
import { GAME_W, GAME_H } from '../render/pixelScaler';

const INTERACT_RANGE = 24;

type Target =
  | { kind: 'cabinet'; cab: Cabinet }
  | { kind: 'counter' }
  | { kind: 'staff' }
  | { kind: 'bell' }
  | { kind: 'door' }
  | { kind: 'change' }
  | { kind: 'annex' }
  | null;

/** Where the player has to stand to use the change machine on the back wall. */
const CHANGE_SPOT = { x: 272, y: 62 };

/**
 * ---- WHO IS ON THE COUNTER, AND WHERE THEY STAND.
 *
 * The right-hand end of it, clear of the prize case (which owns 126-226) and
 * of the bell.  Before the night that is Froggy, leaning over the glass; after
 * it, it is a member of staff, standing in the same place.  Never both: the
 * whole point of the swap is that the player walks back in and somebody else
 * is there.
 *
 * `STAFF_DEPTH` puts whoever it is UNDER the counter's own depth, so the
 * counter covers them from the chest down.  They are behind it, they are not
 * standing on any floor the player can walk, and nothing about the walkable
 * box changes.
 */
const COUNTER_POST = { x: 243, y: COUNTER.y + 17 };
/**
 * And where FROGGY leans on it, which is not the same place.
 *
 * He is smaller than the staff who replace him and he stands further along,
 * just off the end of the prize case: head and eyes over the glass, hands out
 * of sight behind it.  The member of staff is a person and stands like one;
 * he is a mascot leaning on a counter, and at the height he was first drawn at
 * he loomed over the prizes he is pointing at.
 */
const FROG_POST = { x: 230, y: COUNTER.y + 13, height: 30 };
/**
 * The player, measured, because Froggy is cut around him.  See
 * `stepCounterFroggy`: hood and head are ten wide over twenty rows, the torso
 * twelve wide over twelve, and the legs are below the counter and do not
 * matter.  Taken from `art/player.ts` -- if he is ever rebuilt, these move.
 */
const PLAYER_BOX = { headW: 10, headTop: 28, headH: 20, torsoW: 12, torsoH: 12 };
/**
 * ---- AND WHAT YOU CAN SEE OF HIM IS SOLID.
 *
 * The counter stops the player's FEET, and the player is not a pair of feet.
 * He is head and shoulders over the glass, and a customer walking up to the
 * right-hand end of the counter put their own head straight through his face:
 * the overlay cut a player-shaped hole in him so the sorting stayed honest,
 * which is the right answer to "who is in front of whom" and no answer at all
 * to "may I stand there".
 *
 * So this is the box, and it is what is VISIBLE of him rather than where his
 * feet are: his feet are behind a counter that is already solid, and colliding
 * with those would stop nobody.  The paint is clipped at `COUNTER.y + 2`, so
 * that line is the bottom of him, and everything else comes off the drawing's
 * own extents (`FROGGY_DESIGN`) through `FROG_POST` -- move him or resize him
 * and the box follows, at the top of his breath so it does not shrink and grow
 * under the player twice a second.
 */
/**
 * AND A FEW PIXELS OF DAYLIGHT AROUND IT.
 *
 * Edge to edge is not far enough apart.  A box that stops the player the frame
 * the two silhouettes would touch leaves a head resting against his chin with
 * nothing at all between them, and on a screen three hundred and twenty pixels
 * across what that reads as is a player standing INSIDE him -- he is on the
 * overlay, above everything, so the two are one shape and there is no gap to
 * say otherwise.  Six pixels in front of him and four either side is a gap you
 * can see at this size.
 */
const FROG_CLEAR = { front: 6, side: 4 };
const FROG_SCALE = (FROG_POST.height / FROGGY_DESIGN.h) * FROGGY_DESIGN.breath;
const FROG_BODY = {
  left: FROG_POST.x - FROGGY_DESIGN.halfW * FROG_SCALE - FROG_CLEAR.side,
  right: FROG_POST.x + FROGGY_DESIGN.halfW * FROG_SCALE + FROG_CLEAR.side,
  top: FROG_POST.y + (FROGGY_DESIGN.top - FROGGY_DESIGN.feet - FROGGY_DESIGN.lift) * FROG_SCALE,
  bottom: COUNTER.y + 2 + FROG_CLEAR.front,
};
const STAFF_DEPTH = COUNTER_DEPTH - 0.01;
/**
 * ---- AND THE HIGHLIGHTS GO BEHIND EVERYBODY.
 *
 * They were at 55, which is over the whole room: a gold outline drawn across
 * the front of Froggy's face and across the player stood at the machine.  A
 * highlight is a thing ON the furniture, so it belongs between the furniture
 * and the people in front of it.
 *
 * `GLOW_DEPTH` is under the staff (STAFF_DEPTH) and under the player, whose
 * depth is 50 plus a thousandth per pixel down the room and so never comes
 * below 50.058 at the top of the walkable floor -- and over the wall and the
 * prize case, which are painted at the bottom of the pile.
 *
 * The counter's own edge is the exception: it is drawn ON the counter, which
 * is above both of them, so it goes a thousandth over the counter instead --
 * still under the player stood at it, and the part of Froggy it crosses is
 * behind the counter already.
 */
const GLOW_DEPTH = 50.04;
const GLOW_ON_COUNTER = COUNTER_DEPTH + 0.001;
/** How close you have to be to the post to be talking to them rather than shopping. */
const POST_RANGE = 22;
/** What the key is worth to the arcade, in cash, once. */
const KEY_REWARD = 500;

/**
 * ---- THE SHAPE OF THE WHOLE THING, IN MILLISECONDS.
 *
 * A second of his face.  A hard cut back to the arcade.  And then five
 * seconds in which NOTHING HAPPENS except that the sound has gone.
 *
 * The second is short on purpose: long enough to see, too short to study, and
 * far too short to decide what you saw.  The five that follow are the whole
 * of the idea -- the room is exactly as it was, the player has their feet
 * back, and the only thing in the world that is wrong is that a building
 * which has had a tune and a crowd in it since they walked in has neither.
 * There is nothing to look at, which means there is nothing to check, which
 * means the only place the question can go is inward.
 *
 * Then the speakers come back badly, for nine tenths of a second, and then
 * the arcade is an arcade again.
 */
const APP_FACE_MS = 1000;
const APP_HUSH_MS = 5000;
const APP_GLITCH_MS = 900;
/** What the arcade sounds like when nothing is wrong with it. */
const HUB_AUDIO = { music: 'room_hub', ambience: ['cabinet_bleeps', 'crowd_hum'] };

export class ArcadeHub extends Phaser.Scene {
  private player!: Player;
  private bounds!: Phaser.Geom.Rectangle;
  private keys!: Record<string, Phaser.Input.Keyboard.Key[]>;
  private cabinets: Cabinet[] = [];
  private prompt!: Phaser.GameObjects.BitmapText;
  private promptPlate!: Phaser.GameObjects.Rectangle;
  private target: Target = null;
  private locked = false;
  /**
   * THE TWO THINGS ON THE BACK WALL THAT ARE NOT MACHINES.
   *
   * The cabinets advertise themselves -- a marquee, a cost badge, a highlight
   * when you can afford them -- and the prize counter and the change machine
   * advertised nothing at all: two pieces of scenery that happened to do
   * something if you walked into the right patch of carpet and pressed a key
   * nothing had told you about.
   *
   * Each gets the same two-stage cue a cabinet gets: a faint outline on the
   * object while nobody is near it, and the same outline up and pulsing with
   * the ordinary [E] prompt over the player once somebody is.  The outlines
   * sit over the back wall, above where the player's head can reach, so they
   * never cover him.
   */
  private cues: Array<{
    glow: Phaser.GameObjects.Rectangle[];
    kind: 'counter' | 'change';
  }> = [];
  private cueT = 0;
  /** Whoever is on the counter.  One of these is null at all times. */
  private staff: CounterStaff | null = null;
  private frogOnCounter = false;
  private frogT = 0;
  /** Whether he has already said it since the player last walked away. */
  private frogSpoke = false;
  /** His line, while it is up.  Not modal: see `showFrogLine`. */
  private frogSays: Phaser.GameObjects.Container | null = null;
  /** The staff conversation, while it is up. */
  private talk: Phaser.GameObjects.Container | null = null;
  /** The thing outside the glass, and the silence after it.  See `startApparition`. */
  private appT = 0;
  private apparition: 'off' | 'face' | 'hush' | 'glitch' = 'off';
  private dialogue!: DialogueBox;
  private mutter!: Phaser.GameObjects.BitmapText;
  private returnTo: GameId | null = null;

  constructor() {
    super('ArcadeHub');
  }

  init(data: { atCabinet?: GameId } = {}): void {
    this.returnTo = data.atCabinet ?? null;
  }

  create(): void {
    froggyLayer.clear();
    // Phaser reuses scene instances across start/stop, so every mutable field
    // has to be reset here.  Left alone, `locked` stayed true after the first
    // minigame and froze the player in the hub for the rest of the run.
    this.locked = false;
    this.target = null;
    this.cabinets = [];

    fadeIn(this);
    audio.setScene(HUB_AUDIO);

    paintHubRoom(this, { night: false });
    // The counter owns the middle of the back wall, so the signs and posters
    // are hung either side of it.
    paintArcadeDressing(this, {
      night: false,
      // The counter and the change machine own their stretches of the back
      // wall; the dressing goes wherever they are not.
      avoid: [
        { from: COUNTER.x - 6, to: COUNTER.x + COUNTER.w + 6 },
        { from: 256, to: GAME_W },
      ],
      // Between the left-hand cabinets and the counter, and in the gap between
      // the two right-hand cabinets: the only two patches of hub floor with
      // nothing standing on them and nothing walked through them.  The plant
      // used to stand in the approach to the change machine, which is somewhere
      // the player has to be able to get to.
      props: [
        // Under the left-hand vent, in the strip of back wall the doorway does
        // not reach and no cabinet stands on.  At 95 it ended up behind a
        // machine and at 117 half inside the counter.
        { x: 22, y: 66, kind: 'bin' },
        // Bottom of the floor, clear of the last cabinet in the row by a dozen
        // pixels.  Wedged into the gap between two machines it overlapped one
        // or the other at every x that fitted, because the gap is twenty
        // pixels wide and the plant is seventeen.
        { x: 126, y: 170, kind: 'plant' },
      ],
      // The prize case owns 126-226 of the back wall and the change machine
      // 262-282; the vents go in what is left of it.
      vents: [24, 232],
    });
    paintChangeMachine(this, false);
    this.paintCounter();

    this.cabinets = cabinetsIn('hub').map((def) => new Cabinet(this, def));

    // A cabinet advertises itself as clickable — cost badge, affordable
    // highlight — so it has to BE clickable.  Walking up and pressing [E] still
    // works; this is the mouse path, and without it clicking a cabinet from
    // across the room did nothing at all, with no feedback.
    for (const cab of this.cabinets) {
      // Cabinets in a column sit 38px apart, so the hit area stays at the
      // cabinet's own size — any more and neighbours overlap and you launch the
      // one you were not pointing at.
      this.add
        .zone(cab.def.x, cab.def.y - CAB_H / 2, CAB_W + 4, CAB_H + 2)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          if (this.busy()) return;
          this.launchGame(cab, 'card');
        });
    }

    // The prize case is the whole reason to earn tokens, and it was viewable
    // only by walking into the counter — so the prizes may as well not have
    // existed.  Clicking the case (or the counter under it) opens the list.
    this.add
      .zone(PRIZE_CASE.x + PRIZE_CASE.w / 2, PRIZE_CASE.y - 15, PRIZE_CASE.w, 30)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.openCounter());
    this.add
      .zone(COUNTER.x + COUNTER.w / 2, COUNTER.y + COUNTER.h / 2, COUNTER.w, COUNTER.h)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.openCounter());

    // The change machine is on the wall with the rest of the furniture and had
    // nothing clickable on it, so the mouse path stopped at the counter.
    this.add
      .zone(272, 26, 26, 38)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.openChangeMachine());

    // The bell still summons nobody (VOC-18) — but it has to at least answer a
    // click, or it reads as broken rather than as ignored.
    this.add
      .zone(BELL.x + 8, BELL.y - 8, 40, 22)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        if (this.busy()) return;
        audio.sfx('bell_ding');
        this.say('nobody comes.');
      });

    this.paintCounterStaff();
    this.paintCues();
    this.paintAnnexDoor();

    this.bounds = new Phaser.Geom.Rectangle(
      ROOM.left + 8,
      ROOM.top + 6,
      ROOM.right - ROOM.left - 16,
      ROOM.bottom - ROOM.top - 6,
    );
    // A few steps in from the doors, not stood on them.  The door now actually
    // goes somewhere, and spawning inside its interact zone meant one stray
    // click on the carpet walked you straight back out again.
    const spawn = this.spawnPoint({ x: GAME_W / 2, y: ROOM.bottom - 34 });
    this.player = new Player(this, spawn.x, spawn.y);

    new TokenHud(this);

    this.promptPlate = this.add.rectangle(0, 0, 4, 12, PALETTE.black, 0.7).setDepth(800).setVisible(false);
    this.prompt = text(this, 0, 0, '', PALETTE.gold).setDepth(801).setOrigin(0.5, 0.5).setVisible(false);
    this.mutter = text(this, GAME_W / 2, GAME_H - 26, '', PALETTE.fog)
      .setOrigin(0.5, 0.5)
      .setDepth(802)
      .setVisible(false);

    this.keys = {
      up: this.bindKeys(KEYS.up),
      down: this.bindKeys(KEYS.down),
      left: this.bindKeys(KEYS.left),
      right: this.bindKeys(KEYS.right),
    };
    this.input.keyboard?.on('keydown-E', () => this.interact());
    // `over` is what the pointer is actually on.  When that is a cabinet zone,
    // the zone's own handler runs and this must not also fire the proximity
    // target — otherwise clicking a cabinet from the spawn point would open the
    // door standing behind you.
    this.input.on('pointerdown', (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.length > 0 || this.busy()) return;
      // A click on bare floor is not an instruction to play.  Standing next to
      // a machine and clicking past it used to charge a token and open the
      // game, which is an accident every time -- so the floor works the doors
      // and the counter and nothing else.  A machine starts on a click ON THE
      // MACHINE, or on [E] while stood at it, and on nothing else.
      if (
        this.target?.kind === 'cabinet' ||
        this.target?.kind === 'counter' ||
        this.target?.kind === 'staff' ||
        this.target?.kind === 'change'
      ) {
        return;
      }
      this.interact();
    });
    this.input.keyboard?.on('keydown-ESC', () => {
      if (!this.busy()) this.scene.launch('SettingsModal', { from: 'ArcadeHub' });
    });

    this.dialogue = new DialogueBox(this);
    store.flush();

    // PRD BR-1: the broke check runs on hub entry as well as on the ledger
    // event, which covers spending the last token on a game you then quit.
    if (!store.get().seenIntro) this.runTutorial();
    else this.checkBroke();
  }

  // ------------------------------------------------------------------ tutorial

  private runTutorial(): void {
    this.locked = true;
    // Both have to be cabinets that are actually IN this room — the expensive
    // ones moved to the annex, and the tutorial was pointing at a wall.
    const inHere = cabinetsIn('hub');
    const cheap = inHere.reduce((a, b) => (b.cost < a.cost ? b : a));
    const hard = inHere.reduce((a, b) => (b.cost > a.cost ? b : a));
    this.dialogue.play(
      tutorialScript({
        tokenHud: { x: 30, y: 11, w: 56, h: 16 },
        cheapCabinet: { x: cheap.x, y: cheap.y - 18, w: 30, h: 40 },
        hardCabinet: { x: hard.x, y: hard.y - 18, w: 30, h: 40 },
        prizeCounter: { x: PRIZE_CASE.x + PRIZE_CASE.w / 2, y: PRIZE_CASE.y + 9, w: PRIZE_CASE.w, h: 22 },
      }),
      () => {
        store.patch({ seenIntro: true });
        store.flush();
        this.locked = false;
        this.checkBroke();
      },
    );
  }

  // ------------------------------------------------------------------ the room

  /**
   * The idle cues, built once.  Nothing here is read by the game: it is two
   * icons and four outlines, and `stepCues` below is all that touches them.
   */
  private paintCues(): void {
    // ---- NO FLOATING ICONS.  There was a ticket on the carpet in front of
    // the counter and a coin beside the change machine, and both of them read
    // as PICKUPS: small gold things lying about to be walked over and
    // collected, in a game that has those.  What is left is the outline on the
    // object itself, which is the half of the cue that points at the thing it
    // is advertising rather than at the floor next to it.
    this.cues = [
      {
        kind: 'counter',
        glow: [
          // the case, and the front edge of the counter under it
          this.add
            .rectangle(PRIZE_CASE.x + PRIZE_CASE.w / 2, PRIZE_CASE.y - 15, PRIZE_CASE.w + 4, 34)
            .setStrokeStyle(1, PALETTE.gold)
            .setFillStyle()
            .setDepth(GLOW_DEPTH),
          this.add
            .rectangle(COUNTER.x, COUNTER.y, COUNTER.w, 2, PALETTE.gold)
            .setOrigin(0, 0)
            .setDepth(GLOW_ON_COUNTER),
        ],
      },
      {
        kind: 'change',
        glow: [
          this.add
            .rectangle(272, 26, 24, 36)
            .setStrokeStyle(1, PALETTE.gold)
            .setFillStyle()
            .setDepth(GLOW_DEPTH),
        ],
      },
    ];

  }

  /** The cues, once a frame: whether the player is stood at one, and a pulse. */
  private stepCues(delta: number): void {
    this.cueT += delta;
    const pulse = 0.55 + 0.3 * (0.5 + 0.5 * Math.sin(this.cueT / 260));
    for (const cue of this.cues) {
      // The staff on the counter are talked to from the same patch of floor
      // the prizes are looked at from, so their target lights the counter too.
      const near =
        this.target?.kind === cue.kind || (cue.kind === 'counter' && this.target?.kind === 'staff');
      for (const g of cue.glow) g.setAlpha(near ? pulse : 0.2);
    }
  }

  /**
   * THE SWAP.  `froggyGone` is set the moment the player gets the staff door
   * of the dark arcade open, and it never clears -- so the arcade they come
   * back to has somebody else on the counter, permanently, across reloads,
   * because it is part of the saved run.
   *
   * Froggy is painted rather than built: he is the mascot's own drawing and it
   * lives on the overlay above the Phaser canvas (see `stepCounterFroggy`),
   * which is the same way the casino puts a dealer behind its table.
   */
  private paintCounterStaff(): void {
    if (store.get().froggyGone) {
      this.staff = new CounterStaff(this, COUNTER_POST.x, COUNTER_POST.y, STAFF_DEPTH);
      this.frogOnCounter = false;

      // Phaser reuses scene instances, so the tween inside him has to be
      // stopped with the room or it keeps running against a destroyed object.
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        this.staff?.destroy();
        this.staff = null;
      });
      return;
    }
    this.frogOnCounter = true;
  }

  /**
   * ---- HIM, ON THE OVERLAY, WITH A PLAYER-SHAPED HOLE IN HIM.
   *
   * He has to be on the overlay.  Everything inside the Phaser canvas is drawn
   * into a 320x180 buffer and blown up with nearest-neighbour, so a mascot
   * thirty pixels tall in there is thirty pixels of blocks however finely it
   * was drawn -- which is what a texture at four times the resolution found
   * out.  The overlay is a separate canvas at device resolution with smoothing
   * on, and it is the entire reason Froggy looks like Froggy anywhere else in
   * this game (see `render/froggyLayer`).
   *
   * The trouble with the overlay is that it is ABOVE the room: a frog painted
   * on it is painted over the player as well.  So the paint is clipped to
   * everything above the counter MINUS the two rectangles the player is made
   * of -- his head and his torso, at his own position, taken from the sprite
   * rather than guessed at.  The cut follows him exactly, so there is no halo
   * of missing frog around him and no frog across his face: he walks up to the
   * counter and stands IN FRONT of the mascot, which is where a customer
   * stands.
   *
   * The two hole rectangles are deliberately edge to edge rather than
   * overlapping -- the clip is even-odd, and two overlapping holes cancel each
   * other out and put the frog back.
   */
  private paintCounterFroggy(): void {
    const px = this.player.x;
    const py = this.player.y;
    froggyLayer.paint((ctx) => {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, GAME_W, COUNTER.y + 2);
      ctx.rect(px - PLAYER_BOX.headW / 2, py - PLAYER_BOX.headTop, PLAYER_BOX.headW, PLAYER_BOX.headH);
      ctx.rect(
        px - PLAYER_BOX.torsoW / 2,
        py - (PLAYER_BOX.headTop - PLAYER_BOX.headH),
        PLAYER_BOX.torsoW,
        PLAYER_BOX.torsoH,
      );
      ctx.clip('evenodd');
      drawFroggy(ctx, {
        x: FROG_POST.x,
        y: FROG_POST.y,
        height: FROG_POST.height,
        variant: 'cozy',
        pose: 'idleA',
        bounce: Math.sin(this.frogT / 640) * 0.5 + 0.5,
      });
      ctx.restore();
    });
  }

  /** What he does every frame, which is say hello and nothing else. */
  private stepCounterFroggy(delta: number): void {
    if (!this.frogOnCounter) return;
    this.frogT += delta;
    this.paintCounterFroggy();

    // ---- AND HE SAYS SOMETHING AS YOU GO PAST.
    //
    // Not an interaction: walking into earshot is enough, and there is nothing
    // to press.  It re-arms when the player leaves, so it is a greeting rather
    // than a loop -- he says it once each time you come over, and never twice
    // for one visit.
    const d = Math.hypot(this.player.x - FROG_POST.x, this.player.y - (COUNTER.y + 24));
    if (d < 46 && !this.frogSpoke && !this.busy()) {
      this.frogSpoke = true;
      this.showFrogLine();
    } else if (d > 52) {
      // He says it EVERY TIME you come over.  The gap between the two numbers
      // is only there to stop a player stood exactly on the line setting him
      // off once a frame -- step back off the counter and walk up again and he
      // greets you again, which is what a mascot on a counter does.
      this.frogSpoke = false;
      this.hideFrogLine();
    }
  }

  /**
   * ---- WHAT HE SAYS, AND WHAT IT IS SAID IN.
   *
   * A box, not a mutter: the line used to go in the small grey text at the
   * bottom of the screen that the room uses for its own asides, where a thing
   * a CHARACTER says looks like a thing the building is thinking.  It is the
   * same panel the staff on the counter get, in his own colours, without the
   * buttons -- and it is not modal.  Walking up to a mascot should not take
   * the controls off you: it appears when you are close enough to talk to him,
   * it goes when you walk away, and the game carries on underneath it.
   */
  private showFrogLine(): void {
    this.hideFrogLine();
    const LINE = '"FEEL FREE TO TAKE A LOOK AT THE PRIZES AVAILABLE!"';
    const PAD = 7;
    const HEAD = 11;
    const body = text(this, 22, 0, LINE, PALETTE.cream).setMaxWidth(GAME_W - 46);
    const h = PAD + HEAD + Math.max(8, Math.ceil(body.height)) + PAD;
    const y = GAME_H - h - 5;
    body.setY(y + PAD + HEAD);
    const panel = this.add.rectangle(GAME_W / 2, y + h / 2, GAME_W - 24, h, PALETTE.ink, 0.95);
    panel.setStrokeStyle(1, PALETTE.mossLight);
    const who = text(this, 22, y + PAD, 'FROGGY', PALETTE.mossLight);
    this.frogSays = this.add.container(0, 0, [panel, who, body]).setDepth(880);
  }

  private hideFrogLine(): void {
    this.frogSays?.destroy(true);
    this.frogSays = null;
  }

  /**
   * ---- THE STAFF, AND THE KEY.
   *
   * One panel, built on demand and torn down on the way out: a line from
   * whoever is on the counter, and -- only if the player is actually carrying
   * the key -- the two things they can do about it.
   *
   * WHAT IT SAYS DEPENDS ON THREE FLAGS AND NOTHING ELSE.  `keyReturned` is
   * the quest, `keyRewardClaimed` is the money, and `hasKey` is the player's
   * pocket; they are separate because handing it over and being paid are two
   * events, and a reward gated on one flag is a reward that can be claimed
   * twice.  KEEP KEY changes nothing at all, on purpose: the panel closes, the
   * key stays in the pocket, and the offer is still there the next time.
   */
  private talkToStaff(): void {
    if (this.busy()) return;
    const s = store.get();
    const canGive = s.hasKey && !s.keyReturned;
    const line = s.keyReturned
      ? '"THANKS AGAIN FOR THE KEY. THE BOSS PUT IT STRAIGHT BACK ON THE HOOK."'
      : '"HEY THERE! WE ACTUALLY LOST A KEY RECENTLY, SO WE HAD TO BOARD UP ONE OF THE ' +
        'DOORS WITH A WOODEN PLANK. PRETTY CRAZY, RIGHT? THE BOSS SAID IF ANYONE MANAGES ' +
        `TO FIND THE MISSING KEY, THERE IS A ${KEY_REWARD} CASH REWARD WAITING FOR THEM."`;
    this.openTalk(line, canGive);
  }

  /** The panel itself.  `withKey` decides whether it has the two buttons on it. */
  private openTalk(line: string, withKey: boolean): void {
    // ---- THE PANEL IS BUILT ROUND THE TEXT, NOT THE OTHER WAY ABOUT.
    //
    // It used to be a fixed 74 tall with the buttons pinned to the bottom of
    // it, which is fine until the line wraps to six rows -- and then the
    // buttons sit ON TOP OF the last two, covering the half of the sentence
    // that says what the reward is.  The line is measured first, and
    // everything else is laid out from what it actually came to: header,
    // text, and the buttons in a band of their own under it.
    const PAD = 7;
    const HEAD = 11;
    const ROW = 19;
    const body = text(this, 22, 0, line, PALETTE.cream).setMaxWidth(GAME_W - 46);
    const textH = Math.max(8, Math.ceil(body.height));
    const h = PAD + HEAD + textH + PAD + (withKey ? ROW : 10);
    const y = GAME_H - h - 5;
    body.setY(y + PAD + HEAD);

    const panel = this.add.rectangle(GAME_W / 2, y + h / 2, GAME_W - 24, h, PALETTE.ink, 0.95);
    panel.setStrokeStyle(1, PALETTE.neon);
    const who = text(this, 22, y + PAD, 'ARCADE STAFF', PALETTE.neon);
    // The panel is drawn under the words it is behind.
    const parts: Phaser.GameObjects.GameObject[] = [panel, who, body];
    panel.setDepth(0);

    const rowY = y + h - (withKey ? ROW / 2 + 3 : 9);
    if (withKey) {
      parts.push(
        button(this, GAME_W / 2 - 56, rowY, 'GIVE KEY', () => this.giveKey(), { width: 92 }),
        button(this, GAME_W / 2 + 56, rowY, 'KEEP KEY', () => this.closeTalk(), { width: 92 }),
      );
    } else {
      parts.push(text(this, GAME_W / 2, rowY, '[E] LEAVE IT', PALETTE.ash).setOrigin(0.5, 0.5));
    }

    this.talk = this.add.container(0, 0, parts).setDepth(900);
    // E closes it, through `interact` -- the same key that opened it, on the
    // same handler.  A `once` listener registered here instead was left armed
    // when a BUTTON closed the panel, and swallowed the next press: the player
    // walked back up and E did nothing.
  }

  private closeTalk(): void {
    this.talk?.destroy(true);
    this.talk = null;
  }

  /**
   * THE HAND-OVER.  The key leaves the pocket, the cash arrives, and both
   * flags go down in the same patch -- so a reload in the next quarter of a
   * second cannot land between them and leave the arcade owing money.
   */
  private giveKey(): void {
    const s = store.get();
    if (!s.hasKey || s.keyReturned) {
      this.closeTalk();
      return;
    }
    store.patch({
      hasKey: false,
      keyReturned: true,
      keyRewardClaimed: true,
      cash: s.cash + KEY_REWARD,
    });
    store.flush();
    audio.sfx('coin_drop');
    this.closeTalk();
    this.openTalk(
      '"OH! YOU ACTUALLY FOUND THE MISSING KEY! THANK YOU SO MUCH FOR BRINGING IT BACK. ' +
        `THE BOSS WILL BE VERY HAPPY ABOUT THIS. HERE IS THE ${KEY_REWARD} CASH REWARD I PROMISED!"`,
      false,
    );
  }

  /**
   * ---- THE APPARITION.
   *
   * The player buys tokens, closes the machine, and for one second his face is
   * the entire screen.  Then it is not, and the arcade is exactly where they
   * left it -- same carpet, same cabinets, same counter, their own feet back
   * under them -- and the sound has gone out of the building.
   *
   * THE SILENCE IS THE SCENE.  It used to be eight seconds of him with
   * screaming under it, which is a thing that happens TO a player: they watch
   * it, it ends, they know what it was.  A second of a face and then five
   * seconds of a room they can walk around in with no music in it is not
   * something that happens to them.  There is nothing to look at, so there is
   * nothing to check; there is no effect running, so there is nothing to wait
   * out.  The only evidence left is an absence, and an absence is the one
   * kind of evidence a person argues themselves out of.
   *
   * Then the speakers come back wrong for nine tenths of a second, which is
   * the room admitting something without saying what, and then the tune is
   * back as though it had never stopped.
   *
   * ONCE A RUN.  `sawApparition` is set the moment the face goes, so buying
   * tokens is buying tokens for the rest of the game.
   */
  private startApparition(): void {
    this.locked = true;
    this.apparition = 'face';
    this.appT = 0;
    this.hideFrogLine();
    // The music does NOT stop here.  It stops at the cut, a second from now,
    // with him already gone and the room already normal -- so the thing the
    // player is left holding is a quiet arcade rather than a scare with a
    // soundtrack.
  }

  /**
   * Three beats, and only the first of them is on the screen.
   *
   *   face    one second of him, holding the overlay, controls off the player
   *   hush    the room back, exactly as it was, and no sound in the building
   *   glitch  the speakers failing for nine tenths of a second
   *
   * The cut out of `face` is a CUT.  No lids, no fade, no wipe: the overlay is
   * cleared on one frame and the frame after it is an ordinary arcade.  A
   * transition is a thing to watch, and watching it is the player being told
   * that something is over.
   */
  private stepApparition(delta: number): void {
    if (this.apparition === 'off') return;
    this.appT += delta;
    const t = this.appT;

    if (this.apparition === 'face') {
      froggyLayer.paint((ctx) => this.paintApparition(ctx, t));
      if (t < APP_FACE_MS) return;
      // ---- AND HE IS SIMPLY NOT THERE ANY MORE.
      this.apparition = 'hush';
      froggyLayer.clear();
      // THE SOUND GOES WITH HIM, and this is the only moment anything about
      // the room changes.
      //
      // `hardCut`, not `setScene(SILENCE)`.  Declaring silence is the polite
      // way to do it and it CROSSFADES: eight hundred milliseconds of the
      // arcade ebbing away, which is a sixth of the hush spent listening to
      // the tune die rather than to nothing.  Measured at 0.0115 RMS into a
      // stretch that is supposed to read as a signal cut.  This yanks every
      // source out mid-note, so the building is not quiet, it is OFF.
      audio.hardCut();
      store.patch({ sawApparition: true });
      store.flush();
      // Their feet back.  The five seconds are only worth anything if they
      // can be walked around in: a player held still is a player watching a
      // cutscene, and a cutscene is something they know happened.
      this.locked = false;
      return;
    }

    if (this.apparition === 'hush') {
      if (t < APP_FACE_MS + APP_HUSH_MS) return;
      this.apparition = 'glitch';
      audio.sfx('speaker_fault', 0.9);
      return;
    }

    if (t < APP_FACE_MS + APP_HUSH_MS + APP_GLITCH_MS) return;
    this.apparition = 'off';
    // And the arcade comes back on, mid-tune, as though it had never been off
    // -- which is the last thing that makes the player doubt it.
    audio.setScene(HUB_AUDIO);
  }

  /**
   * ---- WHAT THE APPARITION LOOKS LIKE.
   *
   * HIS FACE, AND ALMOST NOTHING ELSE.  He used to be a small figure standing
   * in a doorway at the back of a picture of the arcade, which is a room with
   * a frog in it: the eye reads the room first and finds him second, by which
   * time the moment has gone.  The camera is right up against him now -- two
   * eyes most of the width of the screen, pupils the size of a full stop
   * pointed straight out of it, and the rest of him running off all four
   * edges.
   *
   * AND NOTHING ELSE AT ALL.  Behind him used to be this arcade, darkened --
   * the purple wall and its strip light, the grey floor, a cabinet either
   * side, the doorway he was stood in.  Every one of those is something for
   * the eye to read on its way to him, and on the way back out again.  There
   * is nothing to read now: one flat grey, edge to edge, with no light in it,
   * no depth to it and nowhere for it to be.  He is not somewhere.  He is
   * just there.
   *
   * IN BLACK AND WHITE.  The colour comes out in one pass over the finished
   * picture rather than out of the drawing, so Froggy's greens and golds come
   * through as the tones they always were: the same face with the colour
   * taken off it, not a different face drawn in grey.
   */
  private paintApparition(ctx: CanvasRenderingContext2D, t: number): void {
    // ---- the background: one flat grey, and not one other thing.
    ctx.fillStyle = '#5b5b5b';
    ctx.fillRect(0, 0, GAME_W, GAME_H);

    // ---- HIM.  Right up against the glass, filling it.
    drawFroggy(ctx, {
      x: GAME_W / 2,
      // Anchored between the eyes rather than at the feet: what has to be in
      // frame is the part of him that is looking at you.
      y: 62,
      height: 205,
      anchor: 'face',
      variant: 'cozy',
      // The fourth pose: the same face, with the pupils down to a full stop.
      pose: 'blank',
      bounce: 0,
    });

    // ---- AND THE COLOUR COMES OUT OF ALL OF IT.
    //
    // One composite pass over the finished picture: `saturation` takes the
    // saturation of what is painted over it, which is none, and keeps the
    // luma underneath -- so every tone survives and every hue goes, and the
    // drawing below never has to know.  This was a `grayscale()` filter on
    // the context to begin with, which does the same thing but runs on every
    // path Froggy is made of, at device resolution, every frame, and cost the
    // scene most of its frame rate: the eight seconds took the best part of a
    // minute to play.
    ctx.save();
    ctx.globalCompositeOperation = 'saturation';
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, GAME_W, GAME_H);
    ctx.restore();

    // ---- the static.  A scatter of light and dark, redrawn every frame, so
    // the picture is never quite the same picture twice.
    const grain = Math.floor(t / 40);
    for (let i = 0; i < 260; i++) {
      const n = Math.sin((i * 12.9898 + grain * 78.233) * 43758.5453);
      const r = n - Math.floor(n);
      const x = Math.floor((r * GAME_W * 7.3) % GAME_W);
      const y = Math.floor((r * GAME_H * 13.1) % GAME_H);
      ctx.fillStyle = r > 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.10)';
      ctx.fillRect(x, y, 1, 1);
    }
    // and a couple of rolling bands, which is what says SIGNAL rather than dust
    const band = (t / 9) % (GAME_H + 40);
    ctx.fillStyle = 'rgba(255,255,255,0.035)';
    ctx.fillRect(0, band - 40, GAME_W, 3);
    ctx.fillRect(0, GAME_H - band, GAME_W, 2);

    // The vignette that used to sit here is gone with the room: a grey that
    // goes dark at the corners has a shape and a light source, and the whole
    // point of this one is that it has neither.
    //
    // And the blink that used to end it is gone too.  An eye closing over him
    // and opening on an empty doorway is a piece of staging: it tells the
    // player, in the language of film, that the moment is finished and they
    // may stop looking.  Nothing tells them anything now.  He is on the screen
    // and then he is not, and the only thing left behind is a room with no
    // sound in it.
  }

  private paintCounter(): void {
    // Ticket counter along the back wall, prizes visible behind glass.  The
    // front face sorts by its own front edge, so anyone up against it is cut
    // off at the waist by it instead of standing on top of it.
    this.add.rectangle(COUNTER.x, COUNTER.y, COUNTER.w, COUNTER.h, PALETTE.brown).setOrigin(0, 0).setDepth(COUNTER_DEPTH);
    this.add.rectangle(COUNTER.x, COUNTER.y, COUNTER.w, 3, PALETTE.brownLight).setOrigin(0, 0).setDepth(COUNTER_DEPTH);

    this.add
      .rectangle(PRIZE_CASE.x, PRIZE_CASE.y - 30, PRIZE_CASE.w, 30, PALETTE.ink)
      .setOrigin(0, 0)
      .setStrokeStyle(1, PALETTE.fog);
    // What is actually still on the shelf, in the same hundred pixels of
    // glass: the pitch follows the list, and a prize that has been redeemed
    // leaves a gap in the case exactly as it leaves a gap on the counter.
    const s = store.get();
    const stock = prizesForWave(s.prizeWave);
    const pitch = Math.floor((PRIZE_CASE.w - 12) / stock.length);
    stock.forEach((p, i) => {
      const x = PRIZE_CASE.x + 6 + i * pitch;
      if (s.prizesOwned.includes(p.id)) {
        // an empty peg where it stood
        this.add.rectangle(x + (pitch - 2) / 2, PRIZE_CASE.y - 10, 1, 4, PALETTE.steel).setOrigin(0.5, 1).setAlpha(0.5);
        return;
      }
      this.add.rectangle(x, PRIZE_CASE.y - 22, pitch - 2, 14, p.color).setOrigin(0, 0);
      this.add.rectangle(x, PRIZE_CASE.y - 22, pitch - 2, 3, PALETTE.white).setOrigin(0, 0).setAlpha(0.18);
    });
    // glass sheen
    this.add.rectangle(PRIZE_CASE.x + 4, PRIZE_CASE.y - 27, 3, 25, PALETTE.white).setOrigin(0, 0).setAlpha(0.14);

    // RING FOR SERVICE.  Nobody is coming.
    this.add.rectangle(BELL.x, BELL.y, 7, 4, PALETTE.gold).setOrigin(0.5, 1);
    this.add.rectangle(BELL.x, BELL.y - 4, 2, 2, PALETTE.cream).setOrigin(0.5, 1);
    // The sign is legible.  That matters: the player has to read it, try it,
    // and get nothing.  (VOC-18)
    text(this, BELL.x + 10, BELL.y - 12, 'RING FOR', PALETTE.cream, 8);
    text(this, BELL.x + 10, BELL.y - 4, 'SERVICE', PALETTE.cream, 8);
  }


  /**
   * Where to stand when a cabinet hands you back.  Just below its base, which
   * is inside interact range — so the prompt is already up and you can play it
   * again without walking anywhere.
   */
  private spawnPoint(fallback: { x: number; y: number }): { x: number; y: number } {
    if (!this.returnTo) return fallback;
    const def = CABINETS.find((c) => c.id === this.returnTo);
    if (!def) return fallback;
    return {
      x: Phaser.Math.Clamp(def.x, ROOM.left + 12, ROOM.right - 12),
      y: Phaser.Math.Clamp(def.y + 12, ROOM.top + 12, ROOM.bottom - 8),
    };
  }

  private bindKeys(names: readonly string[]): Phaser.Input.Keyboard.Key[] {
    const kb = this.input.keyboard;
    if (!kb) return [];
    return names.map((n) => kb.addKey(n));
  }

  private held(group: string): boolean {
    return this.keys[group]?.some((k) => k.isDown) ?? false;
  }

  // --------------------------------------------------------------- interaction

  /**
   * The hub keeps running underneath the modals it launches, so its input has
   * to stand down while one is open.
   */
  private busy(): boolean {
    return (
      !!this.talk ||
      this.locked ||
      this.dialogue.isActive() ||
      this.scene.isActive('SettingsModal') ||
      this.scene.isActive('PrizeCounter') ||
      this.scene.isActive('ChangeMachine')
    );
  }

  /** The opening in the left wall, through to the back room. */
  private paintAnnexDoor(): void {
    // Teal, the colour of the room it goes to, spilling out onto this carpet.
    paintOpening(this, { side: 'left', y: ANNEX_DOOR.y, glow: PALETTE.tealLight });

    this.add
      .zone(ANNEX_DOOR.x, ANNEX_DOOR.y, 26, 50)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        if (!this.busy()) this.toAnnex();
      });
  }

  private toAnnex(): void {
    this.locked = true;
    audio.sfx('footstep_carpet');
    fadeToScene(this, 'ArcadeAnnex');
  }

  private openCounter(): void {
    if (this.busy()) return;
    this.scene.launch('PrizeCounter');
    this.locked = true;
    this.events.once('prize-closed', () => {
      this.locked = false;
    });
  }

  /** The machine on the back wall.  Cash in, half of it back out in tokens. */
  private openChangeMachine(): void {
    if (this.busy()) return;
    this.scene.launch('ChangeMachine', { from: 'ArcadeHub' });
    this.locked = true;
    this.events.once('change-closed', () => {
      // ---- AND SOMETIMES HE IS OUTSIDE WHEN YOU LOOK UP.
      //
      // Once a run, after the night, when the player closes the change
      // machine: see `startApparition`.  The lock stays on through it -- the
      // apparition takes the controls off the player for its two seconds and
      // hands them back itself.
      const st = store.get();
      if (st.froggyGone && !st.sawApparition) {
        this.startApparition();
        return;
      }
      this.locked = false;
    });
  }

  private interact(): void {
    // The staff panel is the one thing E closes as well as opens, so it is
    // answered before `busy` -- which the panel itself sets.
    if (this.talk) {
      this.closeTalk();
      return;
    }
    if (this.busy() || !this.target) return;
    const t = this.target;

    if (t.kind === 'annex') {
      this.toAnnex();
      return;
    }

    if (t.kind === 'bell') {
      // PRD EC-7: fifty rings, fifty nothings.  No counter, no easter egg.
      audio.sfx('bell_ding');
      return;
    }

    if (t.kind === 'counter') {
      this.openCounter();
      return;
    }

    if (t.kind === 'staff') {
      this.talkToStaff();
      return;
    }

    if (t.kind === 'change') {
      this.openChangeMachine();
      return;
    }

    if (t.kind === 'door') {
      // The door is a door.  It goes outside, where the man is, and it comes
      // back in again — the daytime loop is walking through it with your arms
      // full and walking back through it with money.  It used to commit
      // `route: 'ejected'` and send you to the closed arcade at night, which
      // meant leaving with a prize ended the game whether you meant it to or
      // not.
      this.locked = true;
      fadeToScene(this, 'ExteriorDay');
      return;
    }

    this.launchGame(t.cab, 'play');
  }

  /**
   * Into a cabinet, one of two ways.
   *
   * `how` is WHICH KIND OF ASK THIS WAS, and it is the whole of the rule:
   *
   *   'card'   the player clicked the machine itself.  That is a question --
   *            what is this, what does it cost -- so it gets the how-to-play
   *            card and nothing is charged until they press PLAY.
   *   'play'   the player pressed E, or clicked somewhere else on the floor
   *            while stood at a machine.  That is not a question, it is an
   *            instruction, so it goes straight into the game and the token
   *            moves on the way in.
   *
   * It used to be one route for both, which meant a click anywhere on the
   * floor near a cabinet opened the card for it -- the player had asked to
   * play and been handed a leaflet.
   */
  private launchGame(cab: Cabinet, how: 'card' | 'play'): void {
    // Nothing is charged for walking up to a machine (MG-2).  The shell opens
    // on the how-to-play card with the game unbuilt behind it, and the tokens
    // move when the player presses PLAY — so a player who cannot afford this
    // cabinet may still read what it wants and walk away.
    if (!canEnter('Minigame', store.get(), {})) {
      audio.sfx('buzzer');
      return;
    }
    this.locked = true;
    fadeToScene(this, 'Minigame', { id: cab.def.id, from: 'ArcadeHub', straight: how === 'play' });
  }

  private say(msg: string): void {
    this.mutter.setText(msg).setVisible(true).setAlpha(1);
    this.tweens.killTweensOf(this.mutter);
    this.tweens.add({ targets: this.mutter, alpha: 0, delay: 1200, duration: 500 });
  }

  // ---------------------------------------------------------------- broke check

  private checkBroke(): void {
    const outcome = evaluateBroke();
    if (!outcome) return;
    this.locked = true;
    const scene = outcome === 'charity' ? 'FroggyCharity' : 'SecondBust';
    if (this.scene.get(scene)) {
      this.time.delayedCall(400, () => fadeToScene(this, scene));
    } else {
      // Phase 4 has not landed yet.
      console.warn(`[hub] broke outcome "${outcome}" — ${scene} not built yet`);
      this.locked = false;
    }
  }

  // --------------------------------------------------------------------- update

  update(_time: number, delta: number): void {
    // The apparition runs while the room is locked, because taking the
    // controls away is half of what makes it one.
    this.stepApparition(delta);

    if (this.locked || this.dialogue.isActive()) {
      this.promptPlate.setVisible(false);
      this.prompt.setVisible(false);
      // Whatever has the room -- a cabinet, the counter, the thing outside the
      // glass -- has it on its own.  He waits.
      this.hideFrogLine();
      this.frogSpoke = false;
      return;
    }

    const dx = (this.held('right') ? 1 : 0) - (this.held('left') ? 1 : 0);
    const dy = (this.held('down') ? 1 : 0) - (this.held('up') ? 1 : 0);
    const before = { x: this.player.x, y: this.player.y };
    this.player.move(dx, dy, delta, this.bounds);
    this.keepOutOfCounter();
    this.keepOffFroggy(before);

    const bal = ledger.balance();
    for (const c of this.cabinets) c.setAffordable(bal >= c.def.cost);

    this.target = this.findTarget();
    this.renderPrompt();
    this.stepCues(delta);
    this.stepCounterFroggy(delta);
  }

  /**
   * The counter is staff-side.  The room's walkable box is a rectangle and the
   * counter stands inside the top of it, so a player who walked up the middle
   * of the room ended up BEHIND it, in the two-foot strip between the counter
   * and the prize case — on the wrong side of the one piece of furniture in
   * the building that has a wrong side.
   *
   * Pushing them back out on the frame they enter it is enough: the counter is
   * against the back wall, so there is only one way in and one way out of the
   * strip, and the interact range still reaches across the counter from the
   * customer's side.
   */
  private keepOutOfCounter(): void {
    const front = COUNTER.y + COUNTER.h + 2;
    if (this.player.y >= front) return;
    if (this.player.x < COUNTER.x - 3 || this.player.x > COUNTER.x + COUNTER.w + 3) return;
    this.player.setPosition(this.player.x, front);
  }

  /**
   * You cannot walk through him either.
   *
   * His box against the player's own -- torso width, head to heel, both
   * measured off the sprites rather than guessed at -- and a step that ends
   * inside it is undone on the axis that walked in.  Come up the room at him
   * and you stop a head short of the glass; come along the counter and you
   * stop at his shoulder and go round, under him, at which point the counter
   * is yours again.
   *
   * Nothing this does puts the counter out of reach.  The furthest back it can
   * push anybody is the line where their head clears the top of the glass,
   * four pixels inside the range the prize case answers from -- so the prompt
   * is up before you are stopped, and it stays up while you are.
   *
   * Only while it is HIM on the counter.  After the night it is a member of
   * staff, who is a Phaser sprite sorted under the counter like everything
   * else in the room and needs none of this.
   */
  private keepOffFroggy(before: { x: number; y: number }): void {
    if (!this.frogOnCounter) return;
    const halfW = PLAYER_BOX.torsoW / 2;
    const hits = (px: number, py: number): boolean =>
      px + halfW > FROG_BODY.left &&
      px - halfW < FROG_BODY.right &&
      py > FROG_BODY.top &&
      py - PLAYER_BOX.headTop < FROG_BODY.bottom;
    if (!hits(this.player.x, this.player.y)) return;
    if (!hits(before.x, this.player.y)) this.player.setPosition(before.x, this.player.y);
    else if (!hits(this.player.x, before.y)) this.player.setPosition(this.player.x, before.y);
    // Both ends of the step inside him -- put somewhere by a spawn, or walked
    // in diagonally on the one frame both axes crossed.  Out the front, which
    // is the only side of him there is any floor on.
    else this.player.setPosition(this.player.x, FROG_BODY.bottom + PLAYER_BOX.headTop);
  }

  private findTarget(): Target {
    const px = this.player.x;
    const py = this.player.y;

    let best: Cabinet | null = null;
    let bestD = INTERACT_RANGE;
    for (const c of this.cabinets) {
      const d = c.distanceTo(px, py);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    if (best) return { kind: 'cabinet', cab: best };

    if (px < ANNEX_DOOR.x + 20 && Math.abs(py - ANNEX_DOOR.y) < 28) return { kind: 'annex' };
    if (Phaser.Math.Distance.Between(px, py, CHANGE_SPOT.x, CHANGE_SPOT.y) < INTERACT_RANGE) {
      return { kind: 'change' };
    }
    if (Phaser.Math.Distance.Between(px, py, BELL.x, BELL.y) < INTERACT_RANGE) return { kind: 'bell' };
    // ---- HOW FAR OUT THE COUNTER STILL ANSWERS.
    //
    // Thirty-four was the depth of a customer stood at the glass, and the frog
    // now holds them six pixels further back than that: at thirty-four the
    // prompt went out exactly where the room stops you, which is the one place
    // it has to be up.  Forty-four is past everywhere you are allowed to stand
    // in front of it and still nowhere near the machines, which are eighty
    // pixels further down the room and answer first anyway.
    if (py < COUNTER.y + 44 && px > COUNTER.x && px < COUNTER.x + COUNTER.w) {
      // The right-hand end of the counter is a PERSON, not a shelf: stood
      // there you are talking to whoever is on it, and anywhere else along it
      // you are looking at the prizes.  Only once there is somebody to talk
      // to -- before the night the post is Froggy's and he has nothing to say
      // about a key that has not been lost yet.
      if (store.get().froggyGone && Math.abs(px - COUNTER_POST.x) < POST_RANGE) {
        return { kind: 'staff' };
      }
      return { kind: 'counter' };
    }
    if (py > ROOM.bottom - 22 && Math.abs(px - GAME_W / 2) < 26) return { kind: 'door' };
    return null;
  }

  private renderPrompt(): void {
    const t = this.target;
    if (!t) {
      this.promptPlate.setVisible(false);
      this.prompt.setVisible(false);
      return;
    }

    let msg: string;
    let color: number = PALETTE.gold;
    if (t.kind === 'cabinet') {
      const { cost } = t.cab.def;
      const can = ledger.balance() >= cost;
      // Name the game on the prompt.  A row of cabinets that all say PLAY is a
      // row of identical boxes: the marquee is too small to read at this size,
      // so the thing you are about to spend tokens on says so here.
      msg = `[E] ${t.cab.def.title} - ${cost} TOKEN${cost === 1 ? '' : 'S'}`;
      color = can ? PALETTE.gold : PALETTE.ash;
    } else if (t.kind === 'counter') {
      msg = '[E] PRIZE COUNTER';
    } else if (t.kind === 'staff') {
      msg = '[E] TALK TO THE STAFF';
    } else if (t.kind === 'annex') {
      msg = '[E] BACK ROOM';
    } else if (t.kind === 'bell') {
      msg = '[E] RING';
    } else if (t.kind === 'change') {
      // The prompt carries the wallet: cash only exists out on the street, so
      // this is the one place inside the building that mentions it.
      const cash = store.get().cash;
      msg = cash > 0 ? `[E] CHANGE - $${cash}` : '[E] CHANGE MACHINE';
    } else {
      msg = '[E] OUTSIDE';
    }

    this.prompt.setText(msg).setTint(color === PALETTE.gold ? 0xffd45e : 0x5c6b7d);
    const x = Phaser.Math.Clamp(this.player.x, 60, GAME_W - 60);
    // OVER HIS HEAD, EXCEPT WHERE HIS HEAD IS IN FRONT OF THE PRIZES.  The
    // counter and the change machine are the two things you walk UP TO rather
    // than stand beside, so a prompt 34 pixels above the player lands square
    // on the prize case or on the machine itself -- covering the very thing it
    // is naming.  For those two it goes on the carpet in front of him instead,
    // which is empty floor in both cases.
    const below = t.kind === 'counter' || t.kind === 'staff' || t.kind === 'change';
    const y = below ? this.player.y + 15 : this.player.y - 34;
    this.prompt.setPosition(x, y).setVisible(true);
    this.promptPlate
      .setPosition(x, y)
      .setSize(this.prompt.width + 6, 11)
      .setVisible(true);
  }
}
