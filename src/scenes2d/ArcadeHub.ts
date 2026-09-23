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
import { drawFroggy } from '../froggy/froggy';
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
const FROG_POST = { x: 230, y: COUNTER.y + 8, height: 28 };
const STAFF_DEPTH = COUNTER_DEPTH - 0.01;
/** How close you have to be to the post to be talking to them rather than shopping. */
const POST_RANGE = 22;
/** What the key is worth to the arcade, in cash, once. */
const KEY_REWARD = 500;

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
  /** Kept so the room can tell who is on the counter without guessing. */
  private frog: Phaser.GameObjects.Image | null = null;
  private frogT = 0;
  /** Whether he has already said it since the player last walked away. */
  private frogSpoke = false;
  /** The staff conversation, while it is up. */
  private talk: Phaser.GameObjects.Container | null = null;
  /** The thing outside the glass.  See `startApparition`. */
  private appT = 0;
  private apparition: 'off' | 'stare' | 'blink' = 'off';
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
    audio.setScene({ music: 'room_hub', ambience: ['cabinet_bleeps', 'crowd_hum'] });

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
            .setFillStyle(),
          this.add.rectangle(COUNTER.x, COUNTER.y, COUNTER.w, 2, PALETTE.gold).setOrigin(0, 0),
        ],
      },
      {
        kind: 'change',
        glow: [this.add.rectangle(272, 26, 24, 36).setStrokeStyle(1, PALETTE.gold).setFillStyle()],
      },
    ];
    for (const cue of this.cues) {
      for (const g of cue.glow) g.setDepth(55);
    }
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
      this.frog = null;
      // Phaser reuses scene instances, so the tween inside him has to be
      // stopped with the room or it keeps running against a destroyed object.
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        this.staff?.destroy();
        this.staff = null;
      });
      return;
    }
    this.frogOnCounter = true;
    this.frog = this.drawFrogOnCounter();
  }

  /**
   * ---- HIM, BAKED INTO A TEXTURE AND PUT IN THE ROOM.
   *
   * He was painted straight onto the overlay, which is a canvas ABOVE the
   * whole Phaser canvas: whatever was clipped off him, everything left was
   * drawn in front of every other thing in the room -- including the player,
   * who is twenty-eight pixels tall and whose head comes up well past the
   * counter when he stands at it.  A mascot drawn over the customer's face is
   * a mascot standing in FRONT of the counter, which is the one place he is
   * not.
   *
   * The drawing is rendered ONCE into a texture instead and hung in the scene
   * like any other piece of furniture, at a depth just under the counter's.
   * The counter then covers him from the chest down, the player walks in front
   * of him, and the two of them sort themselves out the way everything else in
   * this room does.
   */
  private drawFrogOnCounter(): Phaser.GameObjects.Image {
    const key = 'hub-counter-froggy';
    if (this.textures.exists(key)) this.textures.remove(key);
    const w = 44;
    const h = FROG_POST.height + 6;
    const tex = this.textures.createCanvas(key, w, h)!;
    const ctx = tex.getContext();
    ctx.clearRect(0, 0, w, h);
    drawFroggy(ctx, {
      x: w / 2,
      y: h - 2,
      height: FROG_POST.height,
      variant: 'cozy',
      pose: 'idleA',
      bounce: 0.55,
    });
    tex.refresh();
    const img = this.add.image(FROG_POST.x, FROG_POST.y, key).setOrigin(0.5, 1).setDepth(STAFF_DEPTH);
    // The same slow breath the staff who replace him have, so the counter is
    // never completely still whoever is on it.
    this.tweens.add({
      targets: img,
      y: FROG_POST.y - 1,
      duration: 2100,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.textures.exists(key)) this.textures.remove(key);
      this.frog = null;
    });
    return img;
  }

  /** What he does every frame, which is say hello and nothing else. */
  private stepCounterFroggy(delta: number): void {
    if (!this.frogOnCounter) return;
    this.frogT += delta;

    // ---- AND HE SAYS SOMETHING AS YOU GO PAST.
    //
    // Not an interaction: walking into earshot is enough, and there is nothing
    // to press.  It re-arms when the player leaves, so it is a greeting rather
    // than a loop -- he says it once each time you come over, and never twice
    // for one visit.
    if (!this.frog) return;
    const near = Math.hypot(this.player.x - FROG_POST.x, this.player.y - (COUNTER.y + 24)) < 46;
    if (near && !this.frogSpoke && !this.busy()) {
      this.frogSpoke = true;
      this.say('"FEEL FREE TO CHECK WHAT PRIZES YOU CAN GET! \u{1F438}"');
    } else if (!near && Math.hypot(this.player.x - FROG_POST.x, this.player.y - (COUNTER.y + 24)) > 70) {
      this.frogSpoke = false;
    }
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
   * The player buys tokens, closes the machine, turns round, and he is stood
   * outside the front doors looking in.  Not moving, not coming, not doing
   * anything: just there, at the glass, with nothing in his eyes.  Then the
   * picture blinks -- the way an eye blinks, lids from the top and the bottom
   * -- and when it opens he is gone.  No walk-off, no fade: gone while the
   * screen was shut, which is the whole trick and the reason it is a blink
   * rather than a cut.
   *
   * IT IS THIS ROOM, DARKENED.  Nothing is rebuilt and nothing is moved: the
   * cabinets, the counter, the staff on it and the carpet are exactly where
   * they were a frame ago, under a wash of black and a vignette.  The player
   * is meant to recognise the room they were just standing in.
   *
   * ONCE A RUN.  `sawApparition` is set the moment it finishes, so buying
   * tokens is buying tokens for the rest of the game.
   */
  private startApparition(): void {
    this.locked = true;
    this.apparition = 'stare';
    this.appT = 0;
    audio.sfx('door_creak', 0.5);
  }

  private stepApparition(delta: number): void {
    if (this.apparition === 'off') return;
    this.appT += delta;

    // The timings, in order: how long he is simply there, then the lids.
    const STARE = 1500;
    const SHUT = 190;
    const BLACK = 110;
    const OPEN = 260;
    const t = this.appT;
    const gone = t > STARE + SHUT + BLACK * 0.5;

    // 0 open, 1 shut.  Closing, held, then opening.
    let lid = 0;
    if (t > STARE + SHUT + BLACK) lid = Math.max(0, 1 - (t - STARE - SHUT - BLACK) / OPEN);
    else if (t > STARE + SHUT) lid = 1;
    else if (t > STARE) lid = (t - STARE) / SHUT;

    froggyLayer.paint((ctx) => {
      // ---- the room, dimmed.  Not hidden: the layout underneath is the
      // point, and this is a wash over it rather than a curtain in front.
      ctx.fillStyle = 'rgba(2,3,6,0.72)';
      ctx.fillRect(0, 0, GAME_W, GAME_H);
      const v = ctx.createRadialGradient(
        GAME_W / 2, GAME_H * 0.62, GAME_W * 0.12,
        GAME_W / 2, GAME_H * 0.62, GAME_W * 0.62,
      );
      v.addColorStop(0, 'rgba(0,0,0,0)');
      v.addColorStop(1, 'rgba(0,0,0,0.85)');
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, GAME_W, GAME_H);

      // ---- him, in the doorway, facing in.  Still: no bounce, no idle, and
      // nothing in his eyes.
      if (!gone) {
        const glow = ctx.createRadialGradient(GAME_W / 2, GAME_H - 18, 2, GAME_W / 2, GAME_H - 18, 34);
        glow.addColorStop(0, 'rgba(120,150,130,0.16)');
        glow.addColorStop(1, 'rgba(120,150,130,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(GAME_W / 2 - 40, GAME_H - 56, 80, 56);
        drawFroggy(ctx, {
          x: GAME_W / 2,
          y: GAME_H - 2,
          height: 38,
          variant: 'cozy',
          pose: 'idleA',
          bounce: 0,
          pupils: false,
          alpha: 0.96,
        });
      }

      // ---- the blink itself, from the top and the bottom at once.
      if (lid > 0) {
        const h = (GAME_H / 2) * lid;
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, GAME_W, h + 1);
        ctx.fillRect(0, GAME_H - h - 1, GAME_W, h + 1);
      }
    });

    if (t > STARE + SHUT + BLACK + OPEN) {
      this.apparition = 'off';
      froggyLayer.clear();
      store.patch({ sawApparition: true });
      store.flush();
      this.locked = false;
    }
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
      return;
    }

    const dx = (this.held('right') ? 1 : 0) - (this.held('left') ? 1 : 0);
    const dy = (this.held('down') ? 1 : 0) - (this.held('up') ? 1 : 0);
    this.player.move(dx, dy, delta, this.bounds);
    this.keepOutOfCounter();

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
    if (py < COUNTER.y + 34 && px > COUNTER.x && px < COUNTER.x + COUNTER.w) {
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
