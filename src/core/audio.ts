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
import { TRACKS, runTrack } from './tracks';

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

    if (TRACKS[id]) {
      // The rooms' and the cabinets' own tunes.  See tracks.ts.
      stops.push(runTrack(this.ctx, gain, TRACKS[id]));
    } else if (id === 'hub_lofi' || id === 'theme_arcade') {
      stops.push(this.placeholderMusic(gain, id === 'theme_arcade'));
    } else if (id === 'casino_chiptune') {
      stops.push(this.placeholderChiptune(gain));
    } else if (id === 'chase_pulse') {
      stops.push(this.placeholderChase(gain));
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

  /**
   * The back room's music.  Where `hub_lofi` is a bed you sit in, this is a
   * cabinet attract loop: square-wave lead over a running arpeggio, an
   * eighth-note bass, and a kick/snare/hat pulse at about 158 BPM.  Four bright
   * chords (C, Am, F, G) so it reads as an arcade and not as the lounge the
   * rest of the building is.
   *
   * Same seam as the other placeholders: `registerAsset('casino_chiptune', …)`
   * replaces it with a real file without touching the scene.
   */
  private placeholderChiptune(out: GainNode): () => void {
    const ctx = this.ctx!;
    const STEP_MS = 190; // one eighth note
    const hz = (semisFromA4: number) => 440 * 2 ** (semisFromA4 / 12);

    // One chord per bar, eight steps per bar.  Roots, and the arpeggio's
    // three tones an octave above them.
    const roots = [-21, -24, -28, -26]; // C3 A2 F2 G2
    const arps = [
      [-9, -5, -2], // C E G
      [-12, -9, -5], // A C E
      [-16, -12, -9], // F A C
      [-14, -10, -7], // G B D
    ];
    // The lead, 32 steps.  null is a rest.
    const lead: Array<number | null> = [
      7, 10, 15, 10, 7, null, 10, null, // over C
      12, null, 7, 3, 7, 12, null, null, // over Am
      8, 12, 15, 12, 8, null, 12, 15, // over F
      14, null, 10, 5, 10, 14, 17, null, // over G
    ];

    let step = 0;
    let stopped = false;

    // Squares are harsh at full bandwidth; a low-pass takes the edge off
    // without losing the character.
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 3600;
    tone.Q.value = 0.5;
    tone.connect(out);

    const blip = (freq: number, at: number, dur: number, vol: number) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.linearRampToValueAtTime(vol, at + 0.006); // near-instant: it is a chip
      g.gain.setValueAtTime(vol, at + dur * 0.6);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      osc.connect(g);
      g.connect(tone);
      osc.start(at);
      osc.stop(at + dur + 0.03);
    };

    const drum = (at: number, kind: 'kick' | 'snare' | 'hat') => {
      const secs = kind === 'kick' ? 0.12 : kind === 'snare' ? 0.1 : 0.03;
      const len = Math.floor(ctx.sampleRate * secs);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      const curve = kind === 'kick' ? 3 : kind === 'snare' ? 1.8 : 1.2;
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** curve;
      const src = ctx.createBufferSource();
      const f = ctx.createBiquadFilter();
      const g = ctx.createGain();
      f.type = kind === 'kick' ? 'lowpass' : kind === 'snare' ? 'bandpass' : 'highpass';
      f.frequency.value = kind === 'kick' ? 160 : kind === 'snare' ? 1800 : 7000;
      g.gain.value = kind === 'kick' ? 0.07 : kind === 'snare' ? 0.035 : 0.014;
      src.buffer = buf;
      src.connect(f);
      f.connect(g);
      g.connect(out);
      src.start(at);
    };

    const tick = () => {
      if (stopped) return;
      const t = ctx.currentTime + 0.02;
      const bar = Math.floor(step / 8) % 4;
      const inBar = step % 8;
      const dur = STEP_MS / 1000;

      // bass: root on the beat, octave up on the off-beat
      blip(hz(roots[bar] + (inBar % 2 ? 12 : 0)), t, dur * 0.8, 0.05);
      // arpeggio, cycling through the chord every step
      blip(hz(arps[bar][inBar % 3]), t, dur * 0.7, 0.02);
      // lead
      const n = lead[step % lead.length];
      if (n !== null) blip(hz(n), t, dur * 1.6, 0.04);

      drum(t, 'hat');
      if (inBar === 0 || inBar === 4) drum(t, 'kick');
      if (inBar === 2 || inBar === 6) drum(t, 'snare');

      step++;
    };

    tick();
    const timer = window.setInterval(tick, STEP_MS);
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

  /**
   * The chase.  Not a tune: a pulse.  A kick on every beat at about 150 BPM
   * over a low sawtooth that alternates a semitone — the oldest trick there
   * is for "something is wrong" — and, above it, a thin string tremolo that
   * climbs a little every bar and never resolves.  It stops the instant he
   * loses you, which is the point of it.
   */
  private placeholderChase(out: GainNode): () => void {
    const ctx = this.ctx!;
    const BEAT_MS = 400;
    let beat = 0;
    let stopped = false;

    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 2600;
    tone.connect(out);

    const hit = (freq: number, at: number, dur: number, vol: number, type: OscillatorType) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.linearRampToValueAtTime(vol, at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      osc.connect(g);
      g.connect(tone);
      osc.start(at);
      osc.stop(at + dur + 0.05);
    };
    const kick = (at: number) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(140, at);
      osc.frequency.exponentialRampToValueAtTime(38, at + 0.12);
      g.gain.setValueAtTime(0.16, at);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
      osc.connect(g);
      g.connect(out);
      osc.start(at);
      osc.stop(at + 0.25);
    };

    const tick = () => {
      if (stopped) return;
      const t = ctx.currentTime + 0.02;
      const bar = Math.floor(beat / 4);
      kick(t);
      // the low growl, a semitone apart on alternate beats
      hit(beat % 2 ? 43.65 : 41.2, t, 0.38, 0.05, 'sawtooth');
      // the string, off the beat, creeping up over eight bars then falling back
      const climb = (bar % 8) * 0.35;
      hit(880 * Math.pow(2, climb / 12), t + 0.2, 0.18, 0.012, 'triangle');
      hit(932 * Math.pow(2, climb / 12), t + 0.3, 0.14, 0.01, 'triangle');
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
  sfx(name: SfxName, gain = 1, place?: SfxPlace): void {
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
    // WHERE IT IS COMING FROM.
    //
    // `pan` is stereo and honest.  `behind` is not -- stereo cannot put a
    // sound behind a head -- but the ear reads a dulled version of a sound it
    // expects to be bright as one coming from behind, because that is what the
    // shape of an ear actually does to it.  A lowpass and a little pan is the
    // whole trick, and at the far end of a dark room it works on everybody.
    if (place && (place.behind || place.pan)) {
      if (place.behind) {
        const filt = ctx.createBiquadFilter();
        filt.type = 'lowpass';
        // 2400 down to about 700 as `behind` goes 0 -> 1.
        filt.frequency.value = 2400 - Math.max(0, Math.min(1, place.behind)) * 1700;
        filt.Q.value = 0.4;
        filt.connect(out);
        out = filt;
      }
      if (place.pan !== undefined && ctx.createStereoPanner) {
        const pan = ctx.createStereoPanner();
        pan.pan.value = Math.max(-1, Math.min(1, place.pan));
        pan.connect(out);
        out = pan;
      }
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
      // A KEY GOING INTO A LOCK AND TURNING.
      //
      // `lock_click` is one tumbler dropping -- a tick, and the right sound
      // for a bolt that has already decided to move.  It is the wrong sound
      // for the ten seconds at the arcade's front doors, which is somebody
      // fighting a barrel with a key that was cut for a different door: the
      // scrape of brass going in, the grind of it being turned against the
      // wards, and a tumbler or two giving under it.  Three layers, because
      // that is what the ear is listening for.
      case 'key_turn':
        // the key finding the slot: short, bright, metallic
        noise(0.07, 0.09, 5200);
        noise(0.05, 0.05, 3000, 0.05);
        // the barrel turning under it: a low grind that rises as it goes
        for (let i = 0; i < 7; i++) {
          beep(240 + i * 46 + Math.random() * 30, 0.07, 0.035, 'sawtooth', 0.11 + i * 0.03);
        }
        // and the wards knocking on the way round
        beep(1900, 0.03, 0.07, 'square', 0.2);
        beep(1350, 0.04, 0.055, 'square', 0.27);
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
      // Your steps, in the rooms.  A walk is a soft sole coming down: a low
      // thump with almost no hiss.  A run is the same foot hitting harder — a
      // sharper thump with a scuff on top.  The old concrete step was a burst
      // of bright noise that read as static, and it was the same at any speed.
      case 'step_walk':
        beep(58, 0.06, 0.09, 'sine');
        noise(0.05, 0.03, 320, 0.005);
        break;
      case 'step_run':
        beep(64, 0.07, 0.13, 'sine');
        noise(0.04, 0.05, 260, 0.004);
        noise(0.03, 0.045, 1600, 0.02);
        break;
      // You made it out of a zone.  A soft rising pair of notes and their
      // echoes, dying away down a long corridor.  Deliberately not a scare:
      // the room provides those, and this is the one kind thing it says.
      // A low swell that rises out of nothing and goes back into it.  It is
      // not him.  It is the sound of a room you are not sure is empty.
      case 'eerie_swell':
        beep(52, 2.4, 0.06, 'sine');
        beep(52.7, 2.4, 0.04, 'sine', 0.05);
        beep(78, 1.8, 0.02, 'triangle', 0.4);
        noise(1.6, 0.012, 240, 0.3);
        break;
      case 'zone_clear':
        beep(392, 0.28, 0.05, 'sine');
        beep(587, 0.42, 0.045, 'sine', 0.24);
        beep(392, 0.24, 0.022, 'sine', 0.62);
        beep(587, 0.36, 0.02, 'sine', 0.86);
        beep(587, 0.5, 0.009, 'sine', 1.4);
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
      // The till.  A cash register: the drawer's clack, then the two-note
      // chime every shop in the world has, with the second note over the top
      // of the first so it rings rather than trills.
      case 'cha_ching':
        noise(0.05, 0.1, 3200);
        beep(1318, 0.16, 0.1, 'triangle', 0.02); // E6
        beep(1760, 0.3, 0.09, 'triangle', 0.08); // A6, held
        beep(2637, 0.22, 0.045, 'sine', 0.1);
        break;
      // ---- the flooded shaft (minigames/flood.ts)
      // Something going INTO water: the slap of the surface, then the fizz of
      // the air coming back up through it.
      case 'splash':
        noise(0.06, 0.22, 1500);
        noise(0.34, 0.09, 620);
        beep(240, 0.18, 0.05, 'sine', 0.03);
        break;
      // The water finding another foot of the shaft: low, wide and patient.
      case 'water_rise':
        noise(0.9, 0.05, 340);
        beep(70, 0.8, 0.05, 'sine', 0.05);
        break;
      // A ledge giving way under a foot.
      case 'crumble':
        noise(0.24, 0.11, 1100);
        beep(180, 0.2, 0.04, 'square', 0.04);
        break;
      // ---- the throwing match (minigames/frogvslizard.ts)
      // An arm coming over: air moving, and the item leaving the hand.
      case 'throw_whoosh':
        noise(0.16, 0.07, 2600);
        beep(420, 0.09, 0.035, 'sine', 0.02);
        break;
      // Something solid landing on something soft.  The ordinary hit.
      case 'item_thud':
        noise(0.09, 0.17, 800);
        beep(140, 0.1, 0.09, 'square');
        break;
      // Dynamite.  Low, long and clearly a different order of event.
      case 'boom':
        noise(0.55, 0.3, 520);
        beep(58, 0.42, 0.17, 'sawtooth');
        beep(92, 0.26, 0.1, 'square', 0.03);
        beep(41, 0.6, 0.09, 'sine', 0.05);
        break;
      // Health going the other way: a bright rising third.
      case 'heal_up':
        beep(659, 0.12, 0.07, 'sine');
        beep(880, 0.14, 0.07, 'sine', 0.09);
        beep(1174, 0.24, 0.06, 'sine', 0.18);
        break;
      // Poison taking hold, and the tick it makes on every turn after.
      case 'poison_hiss':
        for (let i = 0; i < 5; i++) noise(0.12, 0.045, 3400 - i * 400, i * 0.07);
        beep(233, 0.34, 0.035, 'sawtooth', 0.05);
        beep(220, 0.34, 0.03, 'sawtooth', 0.09);
        break;
      // The peg going past on the casino wheel.  One per face, so the sound of
      // it slowing down is the sound of the odds narrowing.
      case 'wheel_tick':
        beep(1500, 0.02, 0.05, 'square');
        noise(0.02, 0.04, 5000);
        break;
      // The fence taking one instead of the other fellow.
      case 'fence_thunk':
        beep(180, 0.11, 0.09, 'triangle');
        noise(0.07, 0.08, 620, 0.01);
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
    out.gain.value = 0.85; // ceiling, not unity
    out.connect(ctx.destination);

    // The scream: three detuned saws through a hard clip, sweeping down from
    // a shriek to a roar over most of a second.  The clipping is what makes
    // it a voice and not a synth.
    const clip = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i / 127.5) - 1;
      curve[i] = Math.tanh(x * 4.5);
    }
    clip.curve = curve;
    const clipGain = ctx.createGain();
    clipGain.gain.setValueAtTime(0.0001, t);
    clipGain.gain.linearRampToValueAtTime(0.45, t + 0.03);
    clipGain.gain.setValueAtTime(0.45, t + 0.5);
    clipGain.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
    clip.connect(clipGain);
    clipGain.connect(out);
    for (const [f0, f1, d] of [
      [920, 260, 0],
      [935, 270, 0.01],
      [1380, 390, 0.02],
      [610, 180, 0.03],
    ]) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f0, t + d);
      osc.frequency.exponentialRampToValueAtTime(f1, t + d + 0.9);
      // a wobble in the throat
      const lfo = ctx.createOscillator();
      const lfoG = ctx.createGain();
      lfo.frequency.value = 11 + d * 100;
      lfoG.gain.value = 22;
      lfo.connect(lfoG);
      lfoG.connect(osc.frequency);
      osc.connect(clip);
      lfo.start(t);
      osc.start(t + d);
      osc.stop(t + 1.6);
      lfo.stop(t + 1.6);
    }
    // a second hit a third of a second in, when you thought it was over
    for (const f of [44, 47]) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(f * 4, t + 0.34);
      osc.frequency.exponentialRampToValueAtTime(f, t + 0.7);
      g.gain.setValueAtTime(0.0001, t + 0.34);
      g.gain.linearRampToValueAtTime(0.4, t + 0.35);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
      osc.connect(g);
      g.connect(out);
      osc.start(t + 0.34);
      osc.stop(t + 1.5);
    }

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

/**
 * Where a one-shot is standing, for the handful of sounds whose direction is
 * the information rather than a decoration on it.
 */
export interface SfxPlace {
  /** -1 hard left, 0 centred, 1 hard right. */
  pan?: number;
  /** 0..1 how far behind the listener.  Dulls it; see `sfx`. */
  behind?: number;
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
  | 'key_turn'
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
  | 'step_walk'
  | 'step_run'
  | 'zone_clear'
  | 'eerie_swell'
  | 'ticket_machine'
  | 'cha_ching'
  | 'throw_whoosh'
  | 'item_thud'
  | 'boom'
  | 'heal_up'
  | 'poison_hiss'
  | 'fence_thunk'
  | 'wheel_tick'
  | 'splash'
  | 'water_rise'
  | 'crumble';

export const audio = new AudioManager();
