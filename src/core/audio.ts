/**
 * Audio manager.  PRD §6.6 / QFD C1, C2, C3.
 *
 * Three buses (master / music / sfx), persisted, live-applied.  Every scene
 * declares its ambience; the manager crossfades over 800ms.
 *
 * THE SILENCE CONTRACT (PRD AU-2, QFD AC-10, FMEA #6):
 *   A scene that declares neither music nor ambience instantiates ZERO sources.
 *   Not muted.  Not created.  `sourceCount()` must return 0 in ArcadeDark and
 *   every basement frame.  This is a hard constraint from the customer.
 *
 * Phase 1 ships with synthesized placeholder audio so the buses are testable
 * before a single asset exists (PRD §11.5 placeholder strategy).  `registerAsset`
 * is the seam where real Howler-backed files land in Phase 7.
 */

import { Howl } from 'howler';
import { store } from './state';

export const CROSSFADE_MS = 800; // PRD AU-1

export type BusName = 'music' | 'sfx';

export interface SceneAudio {
  music?: string;
  /** Ambience rides the sfx bus: it is atmosphere, not score. */
  ambience?: string[];
}

/** The empty declaration.  Use it to mean silence, explicitly. */
export const SILENCE: SceneAudio = {};

interface Sustained {
  id: string;
  bus: BusName;
  gain: GainNode;
  stop: () => void;
}

class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private busGain: Record<BusName, GainNode | null> = { music: null, sfx: null };
  private sustained: Sustained[] = [];
  private assets = new Map<string, { howl: Howl; bus: BusName }>();
  private current: SceneAudio = SILENCE;
  private unlocked = false;
  private analyser: AnalyserNode | null = null;

  /** Called from the Boot click gate (PRD EC-9). */
  unlock(): void {
    if (this.unlocked) return;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);
    for (const bus of ['music', 'sfx'] as const) {
      const g = this.ctx.createGain();
      g.connect(this.masterGain);
      this.busGain[bus] = g;
    }
    this.unlocked = true;
    this.applyVolumes();
    void this.ctx.resume();
    // A scene that declared its bed before the context existed would otherwise
    // stay silent for its whole lifetime.  Re-apply what the current scene asked
    // for.  (Silence declarations re-apply as silence, which is free.)
    const pending = this.current;
    this.current = SILENCE;
    this.setScene(pending);
  }

  isUnlocked(): boolean {
    return this.unlocked;
  }

  /** PRD AU-6: slider changes apply live, no scene reload. */
  applyVolumes(): void {
    const { master, music, sfx } = store.get().settings;
    if (this.masterGain) this.masterGain.gain.value = master / 100;
    if (this.busGain.music) this.busGain.music.gain.value = music / 100;
    if (this.busGain.sfx) this.busGain.sfx.gain.value = sfx / 100;
    for (const [, a] of this.assets) {
      const busVal = a.bus === 'music' ? music : sfx;
      a.howl.volume((master / 100) * (busVal / 100));
    }
  }

  busLevel(bus: BusName): number {
    const s = store.get().settings;
    return (s.master / 100) * ((bus === 'music' ? s.music : s.sfx) / 100);
  }

  /** Phase 7 seam: register a real audio file against an id. */
  registerAsset(id: string, url: string, bus: BusName, loop = false): void {
    if (this.assets.has(id)) return;
    const howl = new Howl({ src: [url], loop, preload: true, volume: this.busLevel(bus) });
    this.assets.set(id, { howl, bus });
  }

  /**
   * Swap the scene's audio bed.  PRD AU-1 (800ms), AU-2 (silence = nothing),
   * AU-3 (crossfades into silence finish before input is accepted).
   */
  setScene(decl: SceneAudio): void {
    this.current = decl;
    const wanted = new Set<string>([...(decl.music ? [decl.music] : []), ...(decl.ambience ?? [])]);

    for (const s of [...this.sustained]) {
      if (!wanted.has(s.id)) this.fadeOutAndStop(s);
    }

    if (!this.unlocked) return;

    for (const id of wanted) {
      if (this.sustained.some((s) => s.id === id)) continue;
      const bus: BusName = id === decl.music ? 'music' : 'sfx';
      const src = this.startSustained(id, bus);
      if (src) this.sustained.push(src);
    }
  }

  /** DV-3 / AC-10: the number of sustained sources currently instantiated. */
  sourceCount(): number {
    return this.sustained.length;
  }

  /**
   * RMS of everything currently going to the speakers, 0..1.
   *
   * "There is music" was previously only assertable as "a source object
   * exists", which stayed true the whole time the bed was an arpeggio nobody
   * could hear.  This measures the signal instead.
   */
  probeLevel(): number {
    if (!this.ctx || !this.masterGain) return 0;
    if (!this.analyser) {
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 1024;
      this.masterGain.connect(this.analyser);
    }
    const buf = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (const v of buf) sum += v * v;
    return Math.sqrt(sum / buf.length);
  }

  currentScene(): SceneAudio {
    return this.current;
  }

  /** Hard cut, no fade.  PRD §7.8: the second bust CUTS the music. */
  hardCut(): void {
    for (const s of this.sustained) s.stop();
    this.sustained = [];
    this.current = SILENCE;
  }

  private fadeOutAndStop(s: Sustained): void {
    this.sustained = this.sustained.filter((x) => x !== s);
    if (!this.ctx) {
      s.stop();
      return;
    }
    const now = this.ctx.currentTime;
    s.gain.gain.cancelScheduledValues(now);
    s.gain.gain.setValueAtTime(s.gain.gain.value, now);
    s.gain.gain.linearRampToValueAtTime(0.0001, now + CROSSFADE_MS / 1000);
    window.setTimeout(() => s.stop(), CROSSFADE_MS + 60);
  }

  private startSustained(id: string, bus: BusName): Sustained | null {
    const asset = this.assets.get(id);
    if (asset) {
      asset.howl.play();
      const fake = this.ctx?.createGain() ?? null;
      return {
        id,
        bus,
        gain: fake as GainNode,
        stop: () => asset.howl.stop(),
      };
    }
    return this.startPlaceholder(id, bus);
  }

  // ---------------------------------------------------------------- placeholders

  private startPlaceholder(id: string, bus: BusName): Sustained | null {
    if (!this.ctx) return null;
    const busNode = this.busGain[bus];
    if (!busNode) return null;

    const gain = this.ctx.createGain();
    gain.gain.value = 0.0001;
    gain.connect(busNode);
    const now = this.ctx.currentTime;
    gain.gain.linearRampToValueAtTime(1, now + CROSSFADE_MS / 1000);

    const stops: Array<() => void> = [];

    if (id === 'hub_lofi' || id === 'theme_arcade') {
      stops.push(this.placeholderMusic(gain, id === 'theme_arcade'));
    } else if (id === 'neon_buzz') {
      stops.push(this.placeholderDrone(gain, 120, 0.012, 'sawtooth'));
    } else if (id === 'crowd_hum') {
      stops.push(this.placeholderNoise(gain, 320, 0.02));
    } else if (id === 'cabinet_bleeps') {
      stops.push(this.placeholderBleeps(gain));
    } else if (id === 'crickets') {
      stops.push(this.placeholderCrickets(gain));
    } else if (id === 'wind_low') {
      stops.push(this.placeholderNoise(gain, 180, 0.035));
    } else if (id === 'street_dusk') {
      stops.push(this.placeholderNoise(gain, 500, 0.015));
    } else if (id === 'car_passby') {
      stops.push(this.placeholderCars(gain));
    } else {
      stops.push(this.placeholderNoise(gain, 400, 0.01));
    }

    return {
      id,
      bus,
      gain,
      stop: () => {
        for (const s of stops) s();
        try {
          gain.disconnect();
        } catch {
          /* already gone */
        }
      },
    };
  }

  /**
   * The arcade's music bed.  Synthesized, because there are no audio assets yet
   * (PRD §11.5) — `registerAsset` is still the seam where real files land.
   *
   * This used to be a bare six-note arpeggio, written to prove the music bus
   * worked rather than to be listened to, and the arcade played as though it
   * had no soundtrack at all.  It is now an actual loop: a four-chord bed on
   * soft detuned triangles, a bass note under each change, and a quiet
   * kick/hat pulse.  Warm, slow, and repetitive on purpose — it is a room you
   * are meant to stay in.
   */
  private placeholderMusic(out: GainNode, bright: boolean): () => void {
    const ctx = this.ctx!;

    // Dusk outside is a shade brighter than the floor inside.
    const BEAT_MS = bright ? 460 : 520;
    const chords = bright
      ? [
          [261.63, 329.63, 392.0, 493.88], // Cmaj7
          [220.0, 261.63, 329.63, 392.0], // Am7
          [174.61, 220.0, 261.63, 329.63], // Fmaj7
          [196.0, 246.94, 293.66, 349.23], // G7
        ]
      : [
          [146.83, 174.61, 220.0, 261.63], // Dm7
          [130.81, 155.56, 196.0, 233.08], // Cm7-ish
          [174.61, 207.65, 261.63, 311.13], // Fm7
          [196.0, 233.08, 293.66, 349.23], // Gm7
        ];
    const bassOf = (chord: number[]) => chord[0] / 2;

    let beat = 0;
    let stopped = false;

    // Master shaping for the whole bed: gentle low-pass so nothing is sharp.
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = bright ? 2400 : 1500;
    tone.Q.value = 0.4;
    tone.connect(out);

    const pluck = (freq: number, at: number, dur: number, vol: number, detune = 0) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      osc.detune.value = detune;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.linearRampToValueAtTime(vol, at + 0.08); // soft attack, no click
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      osc.connect(g);
      g.connect(tone);
      osc.start(at);
      osc.stop(at + dur + 0.05);
    };

    const thump = (at: number, hat: boolean) => {
      const len = Math.floor(ctx.sampleRate * (hat ? 0.05 : 0.16));
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** (hat ? 1.4 : 3);
      const src = ctx.createBufferSource();
      const f = ctx.createBiquadFilter();
      const g = ctx.createGain();
      f.type = hat ? 'highpass' : 'lowpass';
      f.frequency.value = hat ? 6000 : 190;
      g.gain.value = hat ? 0.016 : 0.062;
      src.buffer = buf;
      src.connect(f);
      f.connect(g);
      g.connect(out);
      src.start(at);
    };

    const tick = () => {
      if (stopped) return;
      const t = ctx.currentTime + 0.02;
      const bar = Math.floor(beat / 4) % chords.length;
      const chord = chords[bar];
      const inBar = beat % 4;

      if (inBar === 0) {
        // the chord itself, voices spread slightly in time so it breathes
        chord.forEach((f, i) => {
          pluck(f, t + i * 0.045, (BEAT_MS * 3.4) / 1000, 0.042, i % 2 ? 6 : -6);
        });
        pluck(bassOf(chord), t, (BEAT_MS * 2.2) / 1000, 0.08);
      }
      if (inBar === 2) pluck(bassOf(chord) * 1.5, t, (BEAT_MS * 1.2) / 1000, 0.05);

      thump(t, inBar % 2 === 1);
      if (inBar === 0 || inBar === 2) thump(t, false);

      beat++;
    };

    tick();
    const timer = window.setInterval(tick, BEAT_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
      try {
        tone.disconnect();
      } catch {
        /* already gone */
      }
    };
  }

  private placeholderDrone(out: GainNode, freq: number, vol: number, type: OscillatorType): () => void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.value = vol;
    osc.connect(g);
    g.connect(out);
    osc.start();
    return () => {
      try {
        osc.stop();
        osc.disconnect();
        g.disconnect();
      } catch {
        /* ignore */
      }
    };
  }

  private placeholderNoise(out: GainNode, cutoff: number, vol: number): () => void {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(filter);
    filter.connect(g);
    g.connect(out);
    src.start();
    return () => {
      try {
        src.stop();
        src.disconnect();
        g.disconnect();
      } catch {
        /* ignore */
      }
    };
  }

  private placeholderBleeps(out: GainNode): () => void {
    const ctx = this.ctx!;
    let stopped = false;
    const schedule = () => {
      if (stopped) return;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = 400 + Math.random() * 900;
      const t = ctx.currentTime;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.018, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      osc.connect(g);
      g.connect(out);
      osc.start(t);
      osc.stop(t + 0.12);
      timer = window.setTimeout(schedule, 400 + Math.random() * 1400);
    };
    let timer = window.setTimeout(schedule, 300);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }

  private placeholderCrickets(out: GainNode): () => void {
    const ctx = this.ctx!;
    let stopped = false;
    const chirp = () => {
      if (stopped) return;
      const t = ctx.currentTime;
      for (let k = 0; k < 3; k++) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = 4200 + Math.random() * 500;
        const at = t + k * 0.055;
        g.gain.setValueAtTime(0.0001, at);
        g.gain.linearRampToValueAtTime(0.02, at + 0.006);
        g.gain.exponentialRampToValueAtTime(0.0001, at + 0.04);
        osc.connect(g);
        g.connect(out);
        osc.start(at);
        osc.stop(at + 0.06);
      }
      timer = window.setTimeout(chirp, 900 + Math.random() * 1400);
    };
    let timer = window.setTimeout(chirp, 500);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }

  private placeholderCars(out: GainNode): () => void {
    const ctx = this.ctx!;
    let stopped = false;
    const pass = () => {
      if (stopped) return;
      const buf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filt = ctx.createBiquadFilter();
      filt.type = 'bandpass';
      filt.frequency.value = 300;
      const g = ctx.createGain();
      const t = ctx.currentTime;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.06, t + 1.2);
      g.gain.linearRampToValueAtTime(0.0001, t + 2.6);
      filt.frequency.setValueAtTime(200, t);
      filt.frequency.linearRampToValueAtTime(700, t + 2.6);
      src.connect(filt);
      filt.connect(g);
      g.connect(out);
      src.start(t);
      src.stop(t + 2.8);
      timer = window.setTimeout(pass, 14000 + Math.random() * 14000);
    };
    let timer = window.setTimeout(pass, 6000 + Math.random() * 8000);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }

  // ------------------------------------------------------------------- one-shots

  /**
   * One-shot sfx.  These are transient and do NOT count as instantiated sources,
   * which is what lets footsteps exist inside the silence contract (PRD AD-1).
   */
  sfx(name: SfxName, gain = 1): void {
    if (!this.unlocked || !this.ctx) return;
    const asset = this.assets.get(name);
    if (asset) {
      asset.howl.play();
      return;
    }
    const bus = this.busGain.sfx;
    if (!bus) return;
    const ctx = this.ctx;
    // A per-call trim, for sounds whose loudness IS the information: how far
    // away he is in the hide rooms is a distance the player reads by ear.
    let out: AudioNode = bus;
    if (gain !== 1) {
      const trim = ctx.createGain();
      trim.gain.value = Math.max(0, Math.min(1, gain));
      trim.connect(bus);
      out = trim;
    }
    const t = ctx.currentTime;

    const beep = (freq: number, dur: number, vol: number, type: OscillatorType = 'square', delay = 0) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      const at = t + delay;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.linearRampToValueAtTime(vol, at + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      osc.connect(g);
      g.connect(out);
      osc.start(at);
      osc.stop(at + dur + 0.05);
    };

    const noise = (dur: number, vol: number, cutoff: number, delay = 0) => {
      const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filt = ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = cutoff;
      const g = ctx.createGain();
      g.gain.value = vol;
      src.connect(filt);
      filt.connect(g);
      g.connect(out);
      src.start(t + delay);
    };

    switch (name) {
      case 'ui_blip':
        beep(880, 0.06, 0.10);
        break;
      case 'ui_hover':
        beep(1320, 0.04, 0.06, 'triangle');
        break;
      case 'dialogue_blip':
        beep(620 + Math.random() * 60, 0.03, 0.045, 'triangle');
        break;
      case 'coin_spin':
        beep(1046, 0.05, 0.09);
        beep(1568, 0.07, 0.08, 'square', 0.05);
        break;
      case 'coin_drop':
        beep(1200, 0.04, 0.08);
        beep(900, 0.05, 0.07, 'square', 0.04);
        beep(1400, 0.06, 0.06, 'square', 0.09);
        break;
      case 'buzzer':
        beep(120, 0.28, 0.13, 'sawtooth');
        break;
      case 'chime':
        beep(523, 0.18, 0.10, 'triangle');
        beep(659, 0.18, 0.09, 'triangle', 0.08);
        beep(784, 0.32, 0.09, 'triangle', 0.16);
        break;
      case 'bell_ding':
        beep(2093, 0.5, 0.09, 'sine');
        beep(3136, 0.35, 0.04, 'sine');
        break;
      case 'footstep_carpet':
        noise(0.09, 0.055, 700);
        break;
      case 'footstep_concrete':
        noise(0.12, 0.12, 2200);
        break;
      case 'door_open':
        noise(0.35, 0.09, 900);
        break;
      case 'door_shut':
        noise(0.16, 0.16, 500);
        beep(90, 0.12, 0.10, 'sine', 0.02);
        break;
      case 'lock_click':
        beep(2400, 0.03, 0.09, 'square');
        beep(1600, 0.04, 0.07, 'square', 0.04);
        break;
      case 'door_rattle':
        for (let i = 0; i < 4; i++) noise(0.06, 0.11, 3000, i * 0.11);
        break;
      case 'door_creak':
        for (let i = 0; i < 14; i++) beep(180 + i * 22 + Math.random() * 40, 0.14, 0.028, 'sawtooth', i * 0.1);
        break;
      // A lid or a door coming open on a hiding place.  Unmistakable on
      // purpose: it is the one sound that tells you where he is and that he is
      // looking INSIDE things, and a player who misses it dies in a box.
      case 'spot_open':
        noise(0.05, 0.2, 2600);
        for (let i = 0; i < 9; i++) beep(150 + i * 34, 0.13, 0.05, 'sawtooth', 0.04 + i * 0.055);
        noise(0.22, 0.13, 700, 0.56);
        break;
      // A floorboard going under YOUR foot.  Long, wooden, and unmistakably
      // not him — the player has to know instantly that they made it, because
      // the whole point is the second of dread afterwards.
      case 'floor_creak':
        for (let i = 0; i < 10; i++) {
          beep(90 + i * 9 + Math.random() * 14, 0.16, 0.035, 'sawtooth', i * 0.045);
        }
        noise(0.12, 0.05, 900, 0.42);
        break;
      // His step: heavier and wetter than yours, so two sets of footsteps in a
      // dark room are never confusable.
      case 'froggy_step':
        noise(0.1, 0.16, 420);
        beep(70, 0.09, 0.07, 'sine', 0.01);
        break;
      case 'drip':
        beep(1800, 0.05, 0.06, 'sine');
        beep(900, 0.12, 0.05, 'sine', 0.03);
        break;
      case 'bulb_flicker':
        for (let i = 0; i < 5; i++) noise(0.03, 0.05, 6000, i * 0.05);
        break;
      case 'vault':
        noise(0.3, 0.09, 1200);
        break;
      case 'whack':
        noise(0.07, 0.16, 1800);
        beep(220, 0.08, 0.08, 'square');
        break;
      case 'stinger':
        // The jumpscare.  Loud, dissonant, short.  PRD §7.14 frame 10.
        for (const f of [55, 58, 82, 110, 147]) beep(f, 1.2, 0.19, 'sawtooth');
        noise(0.9, 0.3, 8000);
        break;
      case 'death_stinger':
        for (const f of [41, 44, 62]) beep(f, 1.6, 0.2, 'square');
        noise(1.2, 0.25, 5000);
        break;
      case 'hop_wet':
        noise(0.11, 0.14, 900);
        beep(150, 0.1, 0.07, 'sine', 0.02);
        break;
      case 'ticket_machine':
        for (let i = 0; i < 8; i++) beep(760, 0.04, 0.05, 'square', i * 0.11);
        break;
    }
  }

  /**
   * The jumpscare, and only the jumpscare.
   *
   * Routed straight to the destination — past the master gain and past both
   * buses — so the sliders cannot soften it.  The whole beat is built on the
   * contrast between a silent room and this, and a player who has turned the
   * sfx bus down to hear the room would otherwise defuse it.
   *
   * A muted master is still honoured.  Someone who has set the game to zero has
   * said something clear, and blasting them in headphones is not a scare, it is
   * an injury.  The peak is also capped below full scale for the same reason.
   */
  scare(): void {
    if (!this.unlocked || !this.ctx) return;
    if (store.get().settings.master === 0) return;

    const ctx = this.ctx;
    const t = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.value = 0.72; // ceiling, not unity
    out.connect(ctx.destination);

    // sub impact — the punch you feel before you hear it
    for (const f of [38, 41, 55, 58]) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f * 3, t);
      osc.frequency.exponentialRampToValueAtTime(f, t + 0.5);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.5, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
      osc.connect(g);
      g.connect(out);
      osc.start(t);
      osc.stop(t + 1.7);
    }

    // the shriek, detuned against itself so it beats
    for (const f of [1180, 1213, 1760]) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.linearRampToValueAtTime(f * 0.7, t + 0.9);
      g.gain.setValueAtTime(0.0001, t + 0.02);
      g.gain.linearRampToValueAtTime(0.16, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
      osc.connect(g);
      g.connect(out);
      osc.start(t);
      osc.stop(t + 1.1);
    }

    // wet noise burst over the top
    const len = Math.floor(ctx.sampleRate * 1.2);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 1.6;
    const src = ctx.createBufferSource();
    const bp = ctx.createBiquadFilter();
    const ng = ctx.createGain();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(3200, t);
    bp.frequency.exponentialRampToValueAtTime(420, t + 1.0);
    bp.Q.value = 0.8;
    ng.gain.value = 0.42;
    src.buffer = buf;
    src.connect(bp);
    bp.connect(ng);
    ng.connect(out);
    src.start(t);
  }
}

export type SfxName =
  | 'ui_blip'
  | 'ui_hover'
  | 'dialogue_blip'
  | 'coin_spin'
  | 'coin_drop'
  | 'buzzer'
  | 'chime'
  | 'bell_ding'
  | 'footstep_carpet'
  | 'footstep_concrete'
  | 'door_open'
  | 'door_shut'
  | 'lock_click'
  | 'door_rattle'
  | 'door_creak'
  | 'drip'
  | 'bulb_flicker'
  | 'vault'
  | 'whack'
  | 'stinger'
  | 'death_stinger'
  | 'hop_wet'
  | 'spot_open'
  | 'floor_creak'
  | 'froggy_step'
  | 'ticket_machine';

export const audio = new AudioManager();
