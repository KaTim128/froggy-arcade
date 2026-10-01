/**
 * The machines that take money.  Through the opening on the annex's left wall.
 *
 * Slots, Froggy's blackjack table, and the chamber cabinet.  Same token economy
 * as every other cabinet in the building — nothing here costs anything but
 * tokens, and the chamber machine is a cylinder diagram on a cabinet face, not
 * a person.
 *
 * Blackjack is the exception to the wall of machines: a felt table with Froggy
 * dealing behind it.  He is drawn on the overlay, never as a sprite (FR-1).
 *
 * Darker and quieter than the arcade floor.  Nobody has ever won in here.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { store, type GameId } from '../core/state';
import { ledger } from '../core/ledger';
import { canEnter } from '../core/routes';
import { KEYS } from '../core/input';
import { fadeIn, fadeToScene, text } from '../core/ui';
import { openTalkPanel } from '../ui/talkPanel';
import { paintCasinoDressing, paintHubRoom, paintOpening, ROOM } from '../art/hubRoom';
import { Player } from '../art/player';
import { Cabinet } from '../art/cabinet';
import { BlackjackTable, TABLE_H, TABLE_W } from '../art/blackjackTable';
import { PrizeWheel } from '../art/prizeWheel';
import { TokenHud } from '../ui/hud';
import { CABINETS, cabinetsIn } from '../game/content';
import { froggyLayer } from '../render/froggyLayer';
import { drawFroggy } from '../froggy/froggy';
import { drawSuitedMan } from '../froggy/suit';
import { GAME_W, GAME_H } from '../render/pixelScaler';

const INTERACT_RANGE = 24;
/**
 * How far in front of the table's near edge the player's feet come to rest.
 *
 * The felt is furniture, not floor.  Nothing in this room stops anybody
 * walking, which was fine while every fixture was a cabinet shoved against a
 * wall -- the table stands in the middle of the carpet, and a player who held
 * UP walked straight through the apron and came out stood ON the green with
 * their head level with the dealer's.  Twenty pixels puts them at the chair,
 * in front of the table, with the whole top of it between them and the man
 * dealing.
 */
const TABLE_STAND = 20;
/** How far behind the felt the table stops being walkable. */
const TABLE_BACK = TABLE_H + 4;
/** The way back, on this room's right wall. */
const BACK_DOOR = { x: GAME_W - 20, y: 118 };

/** Anything you can walk up to and play.  The table is not a cabinet. */
type Fixture = Cabinet | BlackjackTable | PrizeWheel;

type Target = { kind: 'cabinet'; cab: Fixture } | { kind: 'back' } | null;

export class ArcadeCasino extends Phaser.Scene {
  private player!: Player;
  private bounds!: Phaser.Geom.Rectangle;
  private keys!: Record<string, Phaser.Input.Keyboard.Key[]>;
  private cabinets: Fixture[] = [];
  private table: BlackjackTable | null = null;
  /** The conversation with the man in the suit, while it is open. */
  private talk: Phaser.GameObjects.Container | null = null;
  /** Seconds, for the dealer's idle.  He breathes; the room does not. */
  private clock = 0;
  private prompt!: Phaser.GameObjects.BitmapText;
  private promptPlate!: Phaser.GameObjects.Rectangle;
  private mutter!: Phaser.GameObjects.BitmapText;
  private target: Target = null;
  private locked = false;
  private returnTo: GameId | null = null;

  constructor() {
    super('ArcadeCasino');
  }

  init(data: { atCabinet?: GameId } = {}): void {
    this.returnTo = data.atCabinet ?? null;
  }

  create(): void {
    froggyLayer.clear();
    // Phaser reuses scene instances, so every mutable field resets here.
    this.locked = false;
    this.target = null;
    this.cabinets = [];
    this.table = null;
    this.clock = 0;
    this.talk = null;

    fadeIn(this);
    // Its own music, and no ambience: the neon buzz read as static in here.
    audio.setScene({ music: 'casino_chiptune' });

    // No front door in here: the only way out of the building is the hub.
    paintHubRoom(this, { night: false, frontDoor: false, theme: 'casino' });
    paintCasinoDressing(this);
    this.paintDoorway();

    this.cabinets = cabinetsIn('casino').map((def) => {
      if (def.fixture === 'wheel') return new PrizeWheel(this, def);
      if (def.fixture !== 'table') return new Cabinet(this, def);
      const t = new BlackjackTable(this, def);
      this.table = t;
      return t;
    });
    for (const cab of this.cabinets) {
      const b = cab.bounds;
      this.add
        .zone(b.centerX, b.centerY, b.width, b.height)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          if (this.busy()) return;
          this.launchGame(cab, 'card');
        });
    }

    this.bounds = new Phaser.Geom.Rectangle(
      ROOM.left + 8,
      ROOM.top + 6,
      ROOM.right - ROOM.left - 16,
      ROOM.bottom - ROOM.top - 6,
    );
    // You come in through the right-hand doorway, so you arrive next to it.
    const spawn = this.spawnPoint({ x: BACK_DOOR.x - 16, y: BACK_DOOR.y });
    this.player = new Player(this, spawn.x, spawn.y);

    new TokenHud(this);

    this.promptPlate = this.add.rectangle(0, 0, 4, 12, PALETTE.black, 0.7).setDepth(800).setVisible(false);
    this.prompt = text(this, 0, 0, '', PALETTE.gold).setDepth(801).setOrigin(0.5, 0.5).setVisible(false);
    // Below the interact prompt, not level with it: the prompt at the table
    // drops UNDER the player (Froggy used to eat the line above his head), and
    // at 26 up the two of them sat on top of each other.
    this.mutter = text(this, GAME_W / 2, GAME_H - 14, '', PALETTE.fog)
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
    // ---- AND A CLICK ON THE FLOOR IS A CLICK ON THE FLOOR.
    //
    // It used to fall through to `interact()`, which acts on whatever the
    // player happens to be standing near -- so a click on bare carpet by the
    // doorway walked you out of the room.  The doorway, the table and the
    // machines each own a hitbox and answer a click on themselves; [E] is the
    // other way in, and the only thing proximity does.

    // The overlay is one canvas shared by every scene, so this room hands it
    // back the moment it stops owning it.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => froggyLayer.clear());

    store.flush();
  }

  /**
   * The dealer, sat at his own table.
   *
   * He is drawn LOW and clipped off at the felt, so the table edge crosses his
   * belly and everything below it is behind the table: from the floor he reads
   * as someone sitting at the far side dealing, rather than a mascot standing
   * behind a piece of furniture.  That is the whole point of him being there —
   * a player who walks past has to be able to tell at a glance that the frog
   * runs this game.
   */
  private paintDealer(): void {
    const spot = this.table?.dealerSpot();
    if (!spot) return;
    const atTable = this.target?.kind === 'cabinet' && this.target.cab === this.table;
    // AFTER THE NIGHT, SOMEBODY ELSE IS DEALING.  Same seat, same clip, same
    // height: everything about the shot is identical so that the ONE thing
    // that changed is the thing the player sees.  He is not explained and he
    // does not explain himself.
    const gone = store.get().froggyGone;
    froggyLayer.paint((ctx) => {
      // Clip to everything above the felt: no legs, no feet, no floating.
      ctx.save();
      ctx.beginPath();
      // ...and above the conversation panel, when there is one: the overlay
      // is over every Phaser object, the panel included.
      const panelTop = this.talk ? this.talk.getBounds().top : GAME_H;
      ctx.rect(0, 0, GAME_W, Math.min(spot.y, panelTop));
      ctx.clip();
      if (gone) {
        drawSuitedMan(ctx, {
          x: spot.x,
          y: spot.y + 8,
          height: 40,
          pose: this.talk ? (Math.floor(this.clock * 7) % 2 ? 'talk' : 'idle') : atTable ? 'talk' : 'idle',
          // A third of the frog's sway.  He breathes and that is all, and a
          // player who watched Froggy bob at this table for an afternoon reads
          // the stillness before they read the suit.
          bounce: (this.clock * 0.22) % 1,
        });
      } else {
        drawFroggy(ctx, {
          x: spot.x,
          // Below the cut line, so the bottom of him is behind the table.
          // EIGHT, not thirteen: the cut moved back to the felt's rail, and
          // at thirteen that rail came up across his mouth and left a frog
          // peering over the table.  At eight it crosses his chest, which is
          // where a table crosses anyone sitting at one.
          y: spot.y + 8,
          // SMALLER THAN HE WAS.  At forty he filled the back of the table and
          // read as leaning over it; at thirty he is sat behind it, which is
          // what a dealer does.  Same spot, same drawing, same everything else
          // -- the anchor is his feet, so shrinking him takes the top down and
          // leaves him sat exactly where he was sat.
          height: 30,
          variant: 'cozy',
          pose: atTable ? 'talk' : 'idleA',
          // Seated, so he sways rather than bounces: half the travel of a stand.
          bounce: (this.clock * 0.4) % 1,
        });
      }
      ctx.restore();
    });
  }

  private paintDoorway(): void {
    // The opening back to the back room, cut into the right wall.
    paintOpening(this, { side: 'right', y: BACK_DOOR.y, glow: PALETTE.tealLight });

    this.add
      .zone(BACK_DOOR.x, BACK_DOOR.y, 26, 50)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        if (!this.busy()) this.toAnnex();
      });
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
    // The table is deeper than a cabinet and it is solid now, so twelve
    // pixels below its front edge is INSIDE it: you would come back from a
    // hand stood in the middle of the felt.
    const drop = def.fixture === 'table' ? TABLE_STAND + 2 : 12;
    return {
      x: Phaser.Math.Clamp(def.x, ROOM.left + 12, ROOM.right - 12),
      y: Phaser.Math.Clamp(def.y + drop, ROOM.top + 12, ROOM.bottom - 8),
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

  private busy(): boolean {
    return this.locked || !!this.talk || this.scene.isActive('SettingsModal');
  }

  private interact(): void {
    // The conversation is the one thing E closes as well as opens.
    if (this.talk) {
      this.closeTalk();
      return;
    }
    if (this.busy() || !this.target) return;
    if (this.target.kind === 'back') {
      this.toAnnex();
      return;
    }
    if (this.target.cab === this.table && this.dealerHasAQuestion()) {
      this.openDealerTalk();
      return;
    }
    this.launchGame(this.target.cab, 'play');
  }

  /**
   * ---- "WHERE IS FROGGY?"
   *
   * After the night, the first time you step up to the table the man in the
   * suit waits for you to say something, and you can ask him the one thing
   * you want to know.  He answers it the way he answers everything: politely,
   * and without the slightest idea what you are talking about.  Froggy is the
   * mascot.  He is on the cups.
   *
   * ONCE.  Asking it sets `dealerAskedFroggy`, and from then on the table is
   * a table again: E deals you in.  BACK leaves the question unasked, so it is
   * still there next time; DEAL ME IN plays without asking.
   */
  private dealerHasAQuestion(): boolean {
    const s = store.get();
    return s.froggyGone && !s.dealerAskedFroggy;
  }

  private openDealerTalk(): void {
    this.talk = openTalkPanel(this, {
      who: 'DEALER',
      color: PALETTE.gold,
      line: '"GOOD EVENING. TAKE A SEAT WHENEVER YOU ARE READY."',
      options: [
        { label: 'WHERE IS FROGGY?', fn: () => this.askWhereFroggyIs() },
        { label: 'DEAL ME IN', fn: () => this.dealMeIn() },
        { label: 'BACK', fn: () => this.closeTalk() },
      ],
    });
  }

  private askWhereFroggyIs(): void {
    store.patch({ dealerAskedFroggy: true });
    store.flush();
    this.closeTalk();
    this.talk = openTalkPanel(this, {
      who: 'DEALER',
      color: PALETTE.gold,
      line:
        '"FROGGY? THE FROG ON THE CUPS AND THE CARPET. HE IS OUR MASCOT, SIR, A DRAWING, AND A ' +
        'COSTUME AT BIRTHDAY PARTIES. I CONFESS I HAVE NEVER UNDERSTOOD WHY PEOPLE SPEAK OF HIM ' +
        'AS IF HE WALKS AROUND."',
      options: [
        { label: 'DEAL ME IN', fn: () => this.dealMeIn() },
        { label: 'BACK', fn: () => this.closeTalk() },
      ],
    });
  }

  private dealMeIn(): void {
    this.closeTalk();
    if (this.table) this.launchGame(this.table, 'play');
  }

  /** Esc with a conversation open closes the conversation, not the room. */
  handleEscape(): boolean {
    if (!this.talk) return false;
    this.closeTalk();
    return true;
  }

  private closeTalk(): void {
    this.talk?.destroy(true);
    this.talk = null;
  }

  private toAnnex(): void {
    this.locked = true;
    audio.sfx('footstep_carpet');
    froggyLayer.clear();
    fadeToScene(this, 'ArcadeAnnex');
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
  private launchGame(cab: Fixture, how: 'card' | 'play'): void {
    const { cost } = cab.def;
    // Two different bars, and which one applies is decided by where the money
    // changes hands.  A coin-op cabinet takes nothing at the door: the
    // how-to-play card is free to read and PLAY is what charges, so anyone may
    // walk up to one.  The table and the wheel charge INSIDE, which means a
    // player with nothing in their pocket would sit down to a game they cannot
    // make a move in — so those two are refused here, out loud, with the
    // number they are short.
    if (cab.def.freeToEnter && ledger.balance() < cost) {
      audio.sfx('buzzer');
      this.say(
        cab.def.fixture === 'table'
          ? `NO MONEY, NO CARDS — THE MINIMUM IS ${cost}`
          : `NO MONEY, NO SPIN — IT IS ${cost} A GO`,
      );
      return;
    }
    // ---- AND THE SAME REFUSAL FOR THE ROUTE THAT SKIPS THE CARD.
    //
    // Pressing E at a machine is an instruction to play, not a question, so a
    // player who cannot cover it must be told at the machine: the card is what
    // answers the question, and this route never opens one.  Clicking the
    // machine still opens the card, which says the same sentence and lets the
    // rules be read for nothing.
    if (how === 'play' && !cab.def.freeToEnter && ledger.balance() < cost) {
      audio.sfx('buzzer');
      this.say(`You need ${cost} tokens to play.`);
      return;
    }
    if (!canEnter('Minigame', store.get(), {})) {
      audio.sfx('buzzer');
      return;
    }
    this.locked = true;
    froggyLayer.clear();
    fadeToScene(this, 'Minigame', { id: cab.def.id, from: 'ArcadeCasino', straight: how === 'play' });
  }

  private say(msg: string): void {
    this.mutter.setText(msg).setVisible(true).setAlpha(1);
    this.tweens.killTweensOf(this.mutter);
    this.tweens.add({ targets: this.mutter, alpha: 0, delay: 1200, duration: 500 });
  }

  update(_time: number, delta: number): void {
    if (this.busy()) {
      this.promptPlate.setVisible(false);
      this.prompt.setVisible(false);
      // Talking to him, he stays where he is and keeps talking; anything
      // else that stops the room takes him off the overlay.
      if (this.talk) {
        this.clock += delta / 1000;
        this.paintDealer();
      } else {
        froggyLayer.clear();
      }
      return;
    }

    this.clock += delta / 1000;
    this.paintDealer();

    const dx = (this.held('right') ? 1 : 0) - (this.held('left') ? 1 : 0);
    const dy = (this.held('down') ? 1 : 0) - (this.held('up') ? 1 : 0);
    const before = { x: this.player.x, y: this.player.y };
    this.player.move(dx, dy, delta, this.bounds);
    this.keepOffTheTable(before);

    const bal = ledger.balance();
    // The table and the wheel go dark when the pocket cannot cover a go: they
    // are the two fixtures that refuse you at the door, so they have to look
    // like it before you walk over.
    for (const c of this.cabinets) c.setAffordable(bal >= c.def.cost);

    this.target = this.findTarget();
    this.renderPrompt();
  }

  /**
   * The table is solid, the way a table is.
   *
   * Its footprint is a box, and a step that ends inside it is undone on the
   * axis that walked in -- so you stop dead against the edge you walked into
   * and keep sliding along the other one, which is what running a shoulder
   * down a table feels like.  You may still walk round either end of it and
   * along the wall behind it; what you may not do is end up stood in the
   * MIDDLE of it, which is the one arrangement that makes the picture
   * unreadable, with the dealer, the player and every card on one line.
   *
   * If both the old position and the new one are inside -- a spawn that
   * landed on the felt, a scene reused with a stale position -- it puts the
   * player out at the front edge rather than leaving them stuck in the
   * furniture.
   */
  private keepOffTheTable(before: { x: number; y: number }): void {
    const t = this.table;
    if (!t) return;
    const { x, y } = t.def;
    const inside = (px: number, py: number): boolean =>
      Math.abs(px - x) < TABLE_W / 2 && py > y - TABLE_BACK && py < y + TABLE_STAND;
    if (!inside(this.player.x, this.player.y)) return;
    if (!inside(before.x, this.player.y)) this.player.setPosition(before.x, this.player.y);
    else if (!inside(this.player.x, before.y)) this.player.setPosition(this.player.x, before.y);
    else this.player.setPosition(this.player.x, y + TABLE_STAND);
  }

  private findTarget(): Target {
    const px = this.player.x;
    const py = this.player.y;

    let best: Fixture | null = null;
    let bestD = INTERACT_RANGE;
    for (const c of this.cabinets) {
      const d = c.distanceTo(px, py);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    if (best) return { kind: 'cabinet', cab: best };

    if (px > BACK_DOOR.x - 22 && Math.abs(py - BACK_DOOR.y) < 28) return { kind: 'back' };
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
    let colour: number = PALETTE.gold;
    if (t.kind === 'cabinet') {
      const { cost } = t.cab.def;
      // The table and the wheel take a bet, not a price — walking up to them
      // costs nothing, so the prompt says what a go costs rather than what the
      // door costs, and it never greys out: you can always read the rules.
      if (t.cab.def.freeToEnter) {
        // These two take a bet rather than a price, and they are the two you
        // cannot walk into empty-handed — so the prompt names the bet.
        msg =
          t.cab.def.fixture === 'table'
            ? this.dealerHasAQuestion()
              ? '[E] TALK TO THE DEALER'
              : `[E] ${t.cab.def.title} - ${cost} MIN BET`
            : `[E] ${t.cab.def.title} - ${cost} A SPIN`;
      } else {
        msg = `[E] ${t.cab.def.title} - ${cost} TOKEN${cost === 1 ? '' : 'S'}`;
      }
      colour = ledger.balance() >= cost ? PALETTE.gold : PALETTE.ash;
    } else {
      msg = '[E] BACK ROOM';
    }

    this.prompt.setText(msg).setTint(colour === PALETTE.gold ? 0xffd45e : 0x5c6b7d);
    const x = Phaser.Math.Clamp(this.player.x, 70, GAME_W - 70);
    // Above the player's head, except at the table: Froggy stands there, on an
    // overlay nothing in the world can draw over, and he ate half the line.
    const atTable = t.kind === 'cabinet' && t.cab.def.fixture === 'table';
    const y = atTable ? Math.min(this.player.y + 20, GAME_H - 36) : this.player.y - 34;
    this.prompt.setPosition(x, y).setVisible(true);
    this.promptPlate
      .setPosition(x, y)
      .setSize(this.prompt.width + 6, 11)
      .setVisible(true);
  }
}
