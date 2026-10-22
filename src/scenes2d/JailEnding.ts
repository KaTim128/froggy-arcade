/**
 * ---- CAUGHT.  Picked up on the street by a patrol, the day after the
 * Grand Lily, with your face on every wall: the run ends here.
 *
 *   THE CELL.  A bench, a steel pan, the bars, and you sat on the bench.
 *   THE PAPER.  The next morning's front page (the same broadsheet as the
 *     hotel ending's: ArrestEnding `paintNewspaper`), spun in and held.
 *   THE END OF THE PROFILE.  JUSTICE PREVAILS, and the plain words: this
 *     profile cannot be played again.  Its badges stay to be looked at.
 *
 * Every beat waits for a click (or E, SPACE, ENTER).
 */

import Phaser from 'phaser';
import { audio, SILENCE } from '../core/audio';
import { store } from '../core/state';
import { centerText } from '../core/ui';
import { PALETTE } from '../render/palette';
import { GAME_W, GAME_H } from '../render/pixelScaler';
import { froggyLayer } from '../render/froggyLayer';
import { Player } from '../art/player';
import { backPlate } from '../ui/plate';
import { earnBadge } from '../game/badges';
import { PAPER_H, PAPER_W, paintNewspaper, type PaperStory } from './ArrestEnding';

const PATROL_STORY: PaperStory = {
  banner: 'WANTED DRIFTER PICKED UP',
  deck: 'ON ARCADE STREET PATROL',
  sub: 'Suspect in Lily\'s Condos wrecking taken in the day after the night',
  cap1: ['WANTED: the notice posted outside the arcade on the edge of town, which officers', 'say led directly to yesterday\'s arrest. (Staff photo)'],
  cap2: 'THE SUSPECT is led to a patrol car. He did not resist.',
  body:
    'A man wanted in connection with the destruction at Lily\'s Condos was arrested yesterday by officers on a routine foot patrol near the arcade on the edge of town. ' +
    'Police had circulated his description since the night the building was left with its front doors smashed, its stairwell door torn away and a sixth-floor room "turned over completely." ' +
    'Officers say he was recognised from the poster displayed on the arcade\'s own wall, a few steps from where he was stopped. ' +
    'Witnesses describe a short pursuit along the pavement. "He ran, but not far," said one. ' +
    'The suspect is understood to have been living locally in a flat rented in another person\'s name. Police are keen to speak to the leaseholder, described as "a man in a black hat." ' +
    'In interview the suspect is reported to have repeated earlier claims that the damage was done by "a giant frog." ' +
    'He has been remanded in custody. A trial date is expected to be set within the month.',
  side: {
    head: 'ARCADE "BUSINESS AS USUAL"',
    text: 'The arcade near the arrest stayed open throughout. Asked about missing staff and talk of a frog, the counter offered only a prize catalogue and the words "no comment."',
  },
  inside: ['Patrols to continue ........ 3', 'Condos reopen Level 6 ...... 5', 'Crossword ................. 19'],
};

type Act = 'cell' | 'paper' | 'end';

export class JailEnding extends Phaser.Scene {
  private act: Act = 'cell';
  private t = 0;
  private paper: HTMLCanvasElement | null = null;
  private line!: Phaser.GameObjects.BitmapText;
  private lines: string[] = [];
  private next: (() => void) | null = null;
  private layer!: Phaser.GameObjects.Container;

  constructor() {
    super('JailEnding');
  }

  create(): void {
    froggyLayer.clear();
    store.patch({ jailed: true, route: 'ended' });
    store.flush();
    audio.setScene(SILENCE);
    this.act = 'cell';
    this.t = 0;
    this.layer = this.add.container(0, 0);
    this.paintCell();
    this.line = centerText(this, GAME_W / 2, GAME_H - 14, '', PALETTE.cream).setDepth(901).setMaxWidth(290);
    backPlate(this, this.line);
    const go = () => this.next?.();
    this.input.on('pointerdown', go);
    for (const k of ['SPACE', 'ENTER', 'E']) this.input.keyboard?.on(`keydown-${k}`, go);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => froggyLayer.clear());
    this.cameras.main.fadeIn(900, 0, 0, 0);
    audio.sfx('door_shut', 0.8);
    this.time.delayedCall(500, () => audio.sfx('metal_distant', 0.5));
    this.lines = ['The door slams. The lock turns.', 'Two weeks of keeping my head down.', 'One officer. One poster.', 'Nobody is going to believe a word about the frog.'];
    this.time.delayedCall(900, () => this.nextLine());
  }

  private nextLine(): void {
    const l = this.lines.shift();
    if (!l) {
      this.next = null;
      this.cameras.main.fadeOut(800, 0, 0, 0);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.toPaper());
      return;
    }
    this.line.setText(l).setAlpha(0);
    this.tweens.add({ targets: this.line, alpha: 1, duration: 400 });
    this.next = null;
    this.time.delayedCall(450, () => (this.next = () => this.nextLine()));
  }

  /** A holding cell, side-on: concrete, a bench and a pan, you sat down, and the bars over the lot. */
  private paintCell(): void {
    const g = this.add.graphics();
    this.layer.add(g);
    g.fillStyle(0x5a5852, 1).fillRect(0, 0, GAME_W, GAME_H);
    g.fillStyle(0x6a6860, 1).fillRect(40, 30, 240, 120);
    for (let y = 36; y < 150; y += 8) g.fillStyle(0x000000, 0.08).fillRect(40, y, 240, 1);
    for (let x = 52; x < 280; x += 16) g.fillStyle(0x000000, 0.06).fillRect(x, 30, 1, 120);
    // a slot of a window, high up, barred
    g.fillStyle(0x1c2230, 1).fillRect(150, 40, 24, 10);
    g.fillStyle(0x8a9aaa, 0.4).fillRect(151, 41, 22, 3);
    for (let x = 154; x < 174; x += 5) g.fillStyle(0x2a2a2e, 1).fillRect(x, 40, 1, 10);
    // the floor
    g.fillStyle(0x4a4842, 1).fillRect(0, 150, GAME_W, 30);
    g.fillStyle(0x3a3832, 1).fillRect(0, 150, GAME_W, 1);
    // the bench, bolted to the wall
    g.fillStyle(0x14100c, 1).fillRect(70, 132, 90, 5);
    g.fillStyle(0x8a8478, 1).fillRect(71, 133, 88, 3);
    g.fillStyle(0x3a3832, 1).fillRect(76, 137, 3, 13).fillRect(150, 137, 3, 13);
    // the pan
    g.fillStyle(0x14100c, 1).fillRect(226, 132, 22, 18);
    g.fillStyle(0xb8bcc4, 1).fillRect(227, 133, 20, 4);
    g.fillStyle(0x8a8e94, 1).fillRect(229, 137, 16, 13);
    // the light: one caged bulb
    g.fillStyle(0xfff4d0, 1).fillRect(158, 30, 6, 4);
    const glow = this.add.ellipse(160, 40, 160, 90, 0xfff0c0, 0.08).setBlendMode(Phaser.BlendModes.ADD);
    this.layer.add(glow);
    // you, on the bench
    const p = new Player(this, 110, 136, false);
    p.sit('chair', { facing: 1 });
    this.layer.add(p.sprite);
    // the bars, in front of everything
    const bars = this.add.graphics().setDepth(800);
    bars.fillStyle(0x14141a, 1).fillRect(0, 18, GAME_W, 4).fillRect(0, 150, GAME_W, 3);
    for (let x = 6; x < GAME_W; x += 14) {
      bars.fillStyle(0x14141a, 1).fillRect(x, 18, 4, 135);
      bars.fillStyle(0x5a5e66, 1).fillRect(x + 1, 18, 1, 135);
    }
    bars.fillStyle(0x14141a, 1).fillRect(0, 84, GAME_W, 3);
    bars.fillStyle(0x5a5e66, 1).fillRect(0, 84, GAME_W, 1);
    this.layer.add(bars);
  }

  // ------------------------------------------------------------- the paper

  private toPaper(): void {
    this.act = 'paper';
    this.layer.removeAll(true);
    this.line.setText('');
    this.t = 0;
    this.paper = paintNewspaper(PATROL_STORY);
    this.cameras.main.fadeIn(200, 0, 0, 0);
    audio.sfx('throw_whoosh', 0.5);
    this.next = null;
    this.time.delayedCall(3500, () => (this.next = () => this.toEnd()));
  }

  update(_t: number, delta: number): void {
    this.t += delta / 1000;
    if (this.act !== 'paper' || !this.paper) return;
    const p = this.paper;
    const t = this.t;
    const spin = Math.min(1, t / 1.3);
    const e = 1 - Math.pow(1 - spin, 3);
    const zoomIn = Math.max(0, t - 2.4) * 0.035;
    const scale = (0.06 + e * 0.074) * (1 + Math.min(0.55, zoomIn));
    const rot = (1 - e) * Math.PI * 4 - 0.035;
    const lift = (PAPER_H / 2 - 430) * scale * Math.min(1, zoomIn / 0.55);
    froggyLayer.paint((ctx) => {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, GAME_W, GAME_H);
      ctx.save();
      ctx.translate(GAME_W / 2, GAME_H / 2 + lift);
      ctx.rotate(rot);
      ctx.scale(scale, scale);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(-PAPER_W / 2 + 18, -PAPER_H / 2 + 22, PAPER_W, PAPER_H);
      ctx.drawImage(p, -PAPER_W / 2, -PAPER_H / 2);
      ctx.restore();
      const v = ctx.createRadialGradient(GAME_W / 2, GAME_H / 2, 40, GAME_W / 2, GAME_H / 2, 200);
      v.addColorStop(0, 'rgba(0,0,0,0)');
      v.addColorStop(1, 'rgba(0,0,0,0.6)');
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, GAME_W, GAME_H);
    });
  }

  // ------------------------------------------------------------- the end

  private toEnd(): void {
    if (this.act === 'end') return;
    this.act = 'end';
    this.next = null;
    froggyLayer.clear();
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000).setOrigin(0, 0).setDepth(850);
    const title = centerText(this, GAME_W / 2, 84, 'JUSTICE PREVAILS', PALETTE.gold, 16).setDepth(900).setAlpha(0);
    const a = centerText(this, GAME_W / 2, 108, 'YOUR STORY ENDS IN A CELL.', PALETTE.cream).setDepth(900).setAlpha(0);
    const b = centerText(this, GAME_W / 2, 122, 'THIS PROFILE CAN NO LONGER BE PLAYED.', PALETTE.ash).setDepth(900).setAlpha(0);
    const c = centerText(this, GAME_W / 2, 136, 'ITS BADGES ARE KEPT. MAKE A NEW PROFILE TO PLAY.', PALETTE.ash).setDepth(900).setAlpha(0);
    this.tweens.add({ targets: title, alpha: 1, duration: 1200 });
    this.tweens.add({ targets: [a, b, c], alpha: 1, duration: 1000, delay: 1200 });
    this.time.delayedCall(900, () => earnBadge('justice', this));
    this.time.delayedCall(3500, () => {
      const more = centerText(this, GAME_W / 2, 160, '[CLICK] TITLE SCREEN', PALETTE.steel).setDepth(900);
      this.tweens.add({ targets: more, alpha: 0.4, duration: 700, yoyo: true, repeat: -1 });
      this.next = () => {
        this.next = null;
        this.cameras.main.fadeOut(700, 0, 0, 0);
        this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('StartScreen'));
      };
    });
  }
}
