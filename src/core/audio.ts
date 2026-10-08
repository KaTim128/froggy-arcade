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

/**
 * The scream's shape, so a face can scream it: full from the first hundredth
 * of a second, held for SCREAM_HOLD, gone by SCREAM_DUR.  (Seconds.)
 */
export const SCREAM_DUR = 2.15;
export const SCREAM_HOLD = SCREAM_DUR * 0.62;
/** 0..1, how loud the scream is `s` seconds after `scare()`. */
export const screamLevel = (s: number): number =>
  s < 0 ? 0 : s < 0.012 ? s / 0.012 : s < SCREAM_HOLD ? 1 : s < SCREAM_DUR ? ((SCREAM_DUR - s) / (SCREAM_DUR - SCREAM_HOLD)) ** 2 : 0;

/**
 * ---- HIS THREE SCREAMS.
 *
 * The same throat and the same recording, pushed three different ways, so a
 * scare is never the same noise twice running -- and all three have the same
 * shape in time (`screamLevel`), so his jaw opens on any of them exactly as
 * it does now.
 *
 *   THE ROAR     the one he has always had: a torn voice a little under its
 *                pitch, a shriek over it and a growl under it.
 *   THE SHRIEK   higher and sharper, the top end loud, the sweep down fast,
 *                and the voice stuttering fourteen times a second.
 *   THE CROAK    lower and slower, driven harder, the growl the loudest part
 *                and fluttering slower, opening on two wet croaks.
 *
 * `voice`/`shriek`/`growl` are [rate at the start, rate at the end, gain, and
 * drive / delay / flutter Hz]; `pitch` and `sweep` bend the synthesized half.
 */
export interface ScreamVoice {
  voice: [number, number, number, number];
  shriek: [number, number, number, number];
  growl: [number, number, number, number];
  pitch: number;
  sweep: number;
  stutter?: number;
  croak?: boolean;
}
export const SCREAMS: ScreamVoice[] = [
  { voice: [0.93, 0.84, 0.9, 2.2], shriek: [1.36, 1.22, 0.42, 0.018], growl: [0.54, 0.47, 0.95, 38], pitch: 1, sweep: 0.9 },
  { voice: [1.12, 0.96, 0.85, 2.6], shriek: [1.62, 1.38, 0.62, 0.01], growl: [0.64, 0.58, 0.6, 46], pitch: 1.32, sweep: 0.55, stutter: 14 },
  { voice: [0.79, 0.66, 0.9, 3.4], shriek: [1.18, 1.05, 0.24, 0.11], growl: [0.46, 0.38, 1.15, 24], pitch: 0.74, sweep: 1.25, croak: true },
];

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
  /** Between the music bus and the master: open, until the music malfunctions. */
  private musicTone: BiquadFilterNode | null = null;
  private sustained: Sustained[] = [];
  private assets = new Map<string, { howl: Howl; bus: BusName }>();
  private current: SceneAudio = SILENCE;
  private unlocked = false;
  private analyser: AnalyserNode | null = null;
  /** The recorded scream, fetched once and decoded as soon as there is a context. */
  private screamBytes: Promise<ArrayBuffer | null> | null = null;
  private screamBuf: AudioBuffer | null = null;
  private screamDecoding = false;

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
      if (bus === 'music') {
        // The music goes out through a filter that is wide open and does
        // nothing -- until `musicMalfunction` closes it.
        const tone = this.ctx.createBiquadFilter();
        tone.type = 'lowpass';
        tone.frequency.value = 22000;
        tone.Q.value = 0.7;
        g.connect(tone);
        tone.connect(this.masterGain);
        this.musicTone = tone;
      } else {
        g.connect(this.masterGain);
      }
      this.busGain[bus] = g;
    }
    this.unlocked = true;
    this.applyVolumes();
    void this.ctx.resume();
    // Decoded now, on the gesture that made the context, so the first scare
    // never waits on a decode.
    this.preloadScream();
    // A scene that declared its bed before the context existed would otherwise
    // stay silent for its whole lifetime.  Re-apply what the current scene asked
    // for.  (Silence declarations re-apply as silence, which is free.)
    const pending = this.current;
    this.current = SILENCE;
    this.setScene(pending);
  }

  /**
   * A context that a phone suspended behind our back (a call, the lock
   * screen, a tab switch) is resumed on the next touch rather than left
   * silent until the scare that needed it.
   */
  wake(): void {
    if (this.ctx && this.ctx.state !== 'running') void this.ctx.resume();
  }

  /**
   * ---- THE SCREAM, FETCHED AND DECODED BEFORE IT IS NEEDED.
   *
   * Called when a horror level starts (and on unlock).  The bytes are fetched
   * once whether or not there is a context yet; the decode happens the moment
   * there is one.  By the time anything can catch the player the buffer is
   * sitting ready, and `scare()` starts it on the same call.
   */
  preloadScream(): void {
    if (!this.screamBytes) {
      const url = `${import.meta.env.BASE_URL}audio/froggy-scream.mp3`;
      this.screamBytes = fetch(url)
        .then((r) => (r.ok ? r.arrayBuffer() : null))
        .catch(() => null);
    }
    if (this.screamBuf || this.screamDecoding || !this.ctx) return;
    const ctx = this.ctx;
    this.screamDecoding = true;
    void this.screamBytes
      .then((bytes) => (bytes ? ctx.decodeAudioData(bytes.slice(0)) : null))
      .then((buf) => {
        this.screamBuf = buf;
      })
      .catch(() => {
        this.screamBuf = null;
      })
      .finally(() => {
        this.screamDecoding = false;
      });
  }

  /** True once the recorded scream is decoded and will play on the next scare. */
  screamReady(): boolean {
    return !!this.screamBuf;
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

  /**
   * THE MUSIC COMING BACK WRONG.
   *
   * For `ms` after it is called, whatever the music bus is playing is played
   * through a broken speaker: it cuts in and out on an irregular stutter,
   * muffled at first as if through a wall, and it opens back up to the tune
   * everyone knows only at the very end.  The arcade's music, restarting, not
   * quite managing it.  Nothing is changed for good: the filter ends wide
   * open and the gain ends where the music slider has it.
   */
  musicMalfunction(ms: number): void {
    const ctx = this.ctx;
    const g = this.busGain.music;
    const tone = this.musicTone;
    if (!ctx || !g || !tone) return;
    const level = store.get().settings.music / 100;
    const now = ctx.currentTime;
    const dur = ms / 1000;
    g.gain.cancelScheduledValues(now);
    g.gain.setValueAtTime(0, now);
    // the stutter: bursts of the tune with holes in them, the holes getting
    // shorter, the bursts getting longer
    let t = 0.05;
    while (t < dur * 0.7) {
      const on = 0.05 + Math.random() * 0.12 + (t / dur) * 0.25;
      const off = Math.max(0.02, 0.14 - (t / dur) * 0.12) * (0.5 + Math.random());
      g.gain.setValueAtTime(level * (0.55 + Math.random() * 0.45), now + t);
      g.gain.setValueAtTime(0, now + t + on);
      t += on + off;
    }
    g.gain.setValueAtTime(level * 0.7, now + dur * 0.7);
    g.gain.linearRampToValueAtTime(level, now + dur);
    // and the muffle, opening up
    tone.frequency.cancelScheduledValues(now);
    tone.frequency.setValueAtTime(320, now);
    tone.frequency.exponentialRampToValueAtTime(900, now + dur * 0.6);
    tone.frequency.exponentialRampToValueAtTime(22000, now + dur);
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
  /**
   * HOW BAD THE CHASE HAS GOT, 0 to 1.  The room sets it every frame from how
   * long he has had you in sight; the chase bed reads it on every beat -- it
   * plays faster, brighter, and grows a snare and a pair of dissonant stabs as
   * it climbs.  Nothing else in the building reads it.
   */
  private chaseHeat = 0;
  setChaseHeat(h: number): void {
    this.chaseHeat = Math.max(0, Math.min(1, h));
  }

  /**
   * One heartbeat: lub-dub, two low thumps felt more than heard.  Louder and
   * harder with `gain`, on the sfx bus, so it survives the music being down.
   */
  heartbeat(gain = 0.5): void {
    if (!this.unlocked || !this.ctx) return;
    const ctx = this.ctx;
    const bus = this.busGain.sfx;
    if (!bus) return;
    const now = ctx.currentTime + 0.01;
    const thump = (at: number, vol: number, f0: number) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f0, at);
      osc.frequency.exponentialRampToValueAtTime(34, at + 0.14);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.linearRampToValueAtTime(vol, at + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.2);
      osc.connect(g);
      g.connect(bus);
      osc.start(at);
      osc.stop(at + 0.24);
    };
    thump(now, 0.5 * gain, 70);
    thump(now + 0.15, 0.36 * gain, 62);
  }

  private placeholderChase(out: GainNode): () => void {
    const ctx = this.ctx!;
    let beat = 0;
    let stopped = false;
    let timer = 0;

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
    const kick = (at: number, vol: number) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(140, at);
      osc.frequency.exponentialRampToValueAtTime(38, at + 0.12);
      g.gain.setValueAtTime(vol, at);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
      osc.connect(g);
      g.connect(out);
      osc.start(at);
      osc.stop(at + 0.25);
    };
    const snare = (at: number, vol: number) => {
      const len = Math.floor(ctx.sampleRate * 0.09);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 1.8;
      const src = ctx.createBufferSource();
      const f = ctx.createBiquadFilter();
      const g = ctx.createGain();
      f.type = 'bandpass';
      f.frequency.value = 1900;
      g.gain.value = vol;
      src.buffer = buf;
      src.connect(f);
      f.connect(g);
      g.connect(out);
      src.start(at);
    };

    // ---- AND IT BUILDS.  The beat shortens from 400ms to 250 as the chase
    // goes on, the filter opens, a snare comes in on the off-beat, and past
    // two thirds a tritone stab lands on every other beat.
    const tick = () => {
      if (stopped) return;
      const heat = this.chaseHeat;
      const beatMs = 400 - 150 * heat;
      const t = ctx.currentTime + 0.02;
      const bar = Math.floor(beat / 4);
      tone.frequency.setTargetAtTime(2600 + 3000 * heat, t, 0.3);
      kick(t, 0.16 + 0.06 * heat);
      // the low growl, a semitone apart on alternate beats
      hit(beat % 2 ? 43.65 : 41.2, t, (beatMs / 1000) * 0.95, 0.05 + 0.03 * heat, 'sawtooth');
      // the string, off the beat, creeping up over eight bars then falling back
      const climb = (bar % 8) * 0.35 + heat * 3;
      const off = beatMs / 2000;
      hit(880 * Math.pow(2, climb / 12), t + off, 0.18, 0.012 + 0.01 * heat, 'triangle');
      hit(932 * Math.pow(2, climb / 12), t + off * 1.5, 0.14, 0.01 + 0.008 * heat, 'triangle');
      if (heat > 0.3) snare(t + off, 0.03 * heat);
      if (heat > 0.66 && beat % 2 === 0) {
        hit(233.08, t, 0.12, 0.03 * heat, 'square');
        hit(329.63, t, 0.12, 0.024 * heat, 'square');
      }
      beat++;
      timer = window.setTimeout(tick, beatMs);
    };
    tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
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

    // A voice rather than a note: a tone that MOVES.  `beep` holds a pitch,
    // and nothing that holds a pitch has ever sounded like a person.
    const glide = (
      from: number,
      to: number,
      dur: number,
      vol: number,
      type: OscillatorType = 'sawtooth',
      delay = 0,
    ) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      const at = t + delay;
      osc.frequency.setValueAtTime(from, at);
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), at + dur);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.linearRampToValueAtTime(vol, at + dur * 0.16);
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
      // ---- FOOTSTEPS, ONE PER FLOOR, AND ALL OF THEM QUIET.
      //
      // These were one loud noise burst each and the only difference between
      // them was the filter, so the arcade and the street sounded like the
      // same person stamping in two different rooms.  What the ear actually
      // sorts a footstep by is not brightness, it is the SHAPE: how much body
      // the landing has, how long the tail rings, and whether anything
      // rattles after it.  So each one is a body plus a surface now, and the
      // level came down a long way -- a footstep is the quietest thing in a
      // room you are walking through, not the loudest.
      //
      // CARPET: almost all body and no tail.  A low thud with the top taken
      // off it, which is what a shoe on pile does -- it lands, the pile
      // swallows it, there is nothing after.
      case 'footstep_carpet':
        noise(0.055, 0.020, 260);
        noise(0.10, 0.013, 420, 0.004);
        break;
      // CONCRETE: a hard little tap with a short bright tail.  Same idea and
      // the opposite balance -- not much body, and the room gives it back for
      // a moment.  It was at 0.12, which was louder than most of the music.
      case 'footstep_concrete':
        noise(0.03, 0.026, 900);
        noise(0.085, 0.020, 2400, 0.005);
        break;
      // GRAVEL, FOR OUTSIDE: the body of a concrete step with loose stone on
      // top of it.  The landing is duller than a paving slab because the
      // gravel gives, and then two or three grains shift under the weight --
      // which is the whole of what makes it read as rough ground rather than
      // as a floor.  Softer than the concrete: outdoors has no walls to hand
      // the sound back to you.
      case 'footstep_gravel': {
        noise(0.045, 0.022, 520);
        noise(0.07, 0.014, 1700, 0.006);
        // the grit, scattered so no two steps crunch the same way
        const grains = 2 + Math.floor(Math.random() * 2);
        for (let i = 0; i < grains; i++) {
          noise(0.018, 0.006 + Math.random() * 0.005, 3200 + Math.random() * 1800, 0.02 + Math.random() * 0.06);
        }
        break;
      }
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
      // A door or a lid SLAMMED shut by something that wants you to hear it:
      // the body of it hitting the frame, a clang off the metal, and the
      // whole thing shaking in its hinges for a moment after.
      case 'spot_slam':
        noise(0.09, 0.3, 380);
        beep(62, 0.2, 0.2, 'sine');
        beep(410, 0.09, 0.07, 'square', 0.01);
        beep(1230, 0.06, 0.04, 'square', 0.015);
        for (let i = 0; i < 3; i++) noise(0.04, 0.07 - i * 0.02, 2400, 0.1 + i * 0.07);
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
      // A metal bin's lid lifted or let drop: a short tinny clank.
      case 'bin_lid':
        beep(880, 0.06, 0.05, 'square');
        beep(1320, 0.12, 0.03, 'triangle', 0.01);
        noise(0.05, 0.12, 3200);
        break;
      // A hand in a bin: paper and plastic crackling.
      case 'bin_rummage':
        noise(0.08, 0.1, 4200);
        noise(0.06, 0.08, 2600, 0.09);
        noise(0.07, 0.07, 5200, 0.2);
        break;
      // Dynamite.  Low, long and clearly a different order of event.
      case 'boom':
        noise(0.55, 0.3, 520);
        beep(58, 0.42, 0.17, 'sawtooth');
        beep(92, 0.26, 0.1, 'square', 0.03);
        beep(41, 0.6, 0.09, 'sine', 0.05);
        break;
      // ---- THE MAGIC STAFF.  The cast is a rising arpeggio as the orb fills;
      // the blast is a bright crack falling into a low thump, a burst of
      // noise for the fire, and a glassy shimmer ringing on after it -- like
      // nothing else in the arena, so it is known by ear from across the sand.
      case 'arcane_cast':
        beep(440, 0.1, 0.03, 'triangle');
        beep(587, 0.1, 0.03, 'triangle', 0.08);
        beep(784, 0.1, 0.035, 'triangle', 0.16);
        beep(1046, 0.16, 0.04, 'sine', 0.24);
        break;
      // ---- the hotel, at three in the morning
      // Knuckles on glass from outside: a hard tap and the pane ringing.
      case 'knock_glass':
        noise(0.04, 0.22, 3800);
        beep(1900, 0.09, 0.03, 'sine');
        beep(240, 0.07, 0.08, 'sine');
        break;
      // A blow on the window: a thump through the frame and the crack running.
      case 'glass_crack':
        beep(62, 0.22, 0.2, 'sine');
        noise(0.08, 0.32, 1200);
        noise(0.18, 0.16, 7000, 0.02);
        beep(2400, 0.05, 0.04, 'square', 0.03);
        beep(3100, 0.04, 0.03, 'square', 0.07);
        break;
      // The whole pane going: the burst, then the pieces raining down.
      case 'glass_shatter':
        noise(0.12, 0.4, 9000);
        beep(55, 0.4, 0.2, 'sawtooth');
        for (let i = 0; i < 9; i++) {
          beep(2600 + Math.random() * 2400, 0.06, 0.035, 'sine', 0.08 + i * 0.07);
          noise(0.05, 0.08, 8000, 0.1 + i * 0.08);
        }
        break;
      // The reveal: one huge low orchestral hit.
      case 'dun':
        for (const f of [41, 55, 82, 110]) beep(f, 1.6, 0.17, 'sawtooth');
        beep(27.5, 2, 0.2, 'sine');
        noise(0.35, 0.3, 900);
        noise(1.2, 0.08, 300, 0.05);
        break;
      // A door coming off its hinges: the split, the slam, the splinters.
      case 'door_smash':
        noise(0.12, 0.38, 2400);
        beep(48, 0.5, 0.22, 'sawtooth');
        beep(90, 0.3, 0.14, 'square', 0.02);
        for (let i = 0; i < 6; i++) noise(0.04, 0.12, 4200, 0.06 + i * 0.05);
        break;
      // A lift that will not come: the button's click and a dead clunk.
      case 'lift_dead':
        beep(1400, 0.03, 0.05, 'square');
        beep(70, 0.25, 0.12, 'square', 0.12);
        noise(0.1, 0.06, 500, 0.12);
        break;
      // A lamp switched off.
      case 'lamp_click':
        noise(0.015, 0.12, 5000);
        beep(2200, 0.02, 0.03, 'square');
        break;
      case 'arcane_blast':
        beep(1320, 0.08, 0.06, 'square');
        beep(990, 0.1, 0.06, 'triangle', 0.03);
        beep(660, 0.18, 0.07, 'sawtooth', 0.05);
        noise(0.35, 0.18, 2400, 0.02);
        beep(70, 0.45, 0.12, 'sine', 0.04);
        beep(1760, 0.3, 0.03, 'sine', 0.12);
        beep(2093, 0.28, 0.025, 'sine', 0.18);
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
      // ---- SOMEBODY, A LONG WAY OFF, THROUGH A WALL AND A FLOOR.
      //
      // It climbs, breaks at the top, and falls away, and it is never clear
      // enough to swear to -- which is the point, and why the call sites pass
      // `behind`, whose lowpass is the same thing distance does to everything.
      // The pitch is different every time, which is what keeps it a person
      // rather than a sound effect being played again.
      // ---- HIM, THROUGH THE GLASS OF THE TUBE.
      //
      // Not the jumpscare -- that one goes past the sliders -- but a close,
      // wet, rising shriek, three voices detuned against each other so they
      // beat, with a gargle of noise under it and a crack at the top where it
      // breaks: something big in a small space, and very unhappy about the
      // heat.
      // ---- THE VOICES IN THE TUBE.  One kind per sequence, none of them his,
      // each layered (see the lab) with the tube's own echo, a breath run
      // backwards, radio crackle and something metal a long way off.
      case 'voice_whisper': {
        // deep, breathy, ghostly: hiss shaped by a low moving formant
        const base = 70 + Math.random() * 15;
        for (let k = 0; k < 4; k++) {
          noise(0.42, 0.05, 900 + k * 260, k * 0.36);
          glide(base * (1 + k * 0.08), base * 0.82, 0.45, 0.022, 'sine', k * 0.36);
        }
        break;
      }
      case 'voice_children': {
        // high, frightened, a few of them at once and none in step
        for (let k = 0; k < 3; k++) {
          const f = 620 + Math.random() * 260;
          glide(f, f * 1.45, 0.22, 0.03, 'triangle', k * 0.13);
          glide(f * 1.45, f * 0.9, 0.5, 0.026, 'triangle', k * 0.13 + 0.22);
          glide(f * 2.01, f * 1.3, 0.6, 0.008, 'sine', k * 0.13 + 0.1);
        }
        noise(0.9, 0.012, 3000, 0.05);
        break;
      }
      case 'voice_robot': {
        // a warning, in a voice made of square waves that keeps breaking up
        const f = 140;
        for (let k = 0; k < 5; k++) {
          const at = k * 0.17;
          beep(k % 2 ? f : f * 1.26, 0.13, 0.04, 'square', at);
          beep((k % 2 ? f : f * 1.26) * 2.01, 0.13, 0.015, 'sawtooth', at);
          if (Math.random() < 0.5) noise(0.05, 0.05, 5000, at + 0.08);
        }
        break;
      }
      case 'voice_croak': {
        // something big and wet in its throat: low pulsed croaks
        for (let k = 0; k < 4; k++) {
          const f = 55 + Math.random() * 18;
          glide(f * 1.4, f, 0.16, 0.09, 'sawtooth', k * 0.19);
          glide(f * 2.1, f * 1.4, 0.16, 0.03, 'square', k * 0.19);
          noise(0.14, 0.04, 500, k * 0.19);
        }
        break;
      }
      case 'voice_laugh': {
        // spectral laughter: a falling ha-ha-ha, each one fainter, echoing
        for (let k = 0; k < 6; k++) {
          const f = 420 - k * 26;
          const v = 0.045 * (1 - k * 0.12);
          glide(f * 1.2, f, 0.12, v, 'triangle', k * 0.16);
          glide(f * 1.2, f, 0.12, v * 0.35, 'triangle', k * 0.16 + 0.32);
          noise(0.08, v * 0.5, 2400, k * 0.16);
        }
        break;
      }
      case 'voice_muffled': {
        // a call from something that is not in any book, through a wall
        const f = 160 + Math.random() * 60;
        glide(f, f * 1.6, 0.4, 0.05, 'sine');
        glide(f * 1.6, f * 0.7, 0.7, 0.045, 'sine', 0.38);
        glide(f * 0.5, f * 0.8, 1.0, 0.03, 'triangle', 0.1);
        noise(1.0, 0.02, 380, 0.05);
        break;
      }
      case 'tube_echo': {
        // a hollow ring down the glass, and its echoes
        for (let k = 0; k < 4; k++) glide(220, 205, 0.5, 0.03 * (1 - k * 0.22), 'sine', k * 0.24);
        noise(0.6, 0.012, 1200, 0);
        break;
      }
      case 'reverse_breath': {
        // a breath played backwards: swelling up out of nothing and cut off
        const len = 0.9;
        const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * len), ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(i / d.length, 2.2);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const filt = ctx.createBiquadFilter();
        filt.type = 'bandpass';
        filt.frequency.value = 1100;
        const g = ctx.createGain();
        g.gain.value = 0.12;
        src.connect(filt);
        filt.connect(g);
        g.connect(out);
        src.start(t);
        break;
      }
      case 'radio_static': {
        for (let k = 0; k < 6; k++) noise(0.06 + Math.random() * 0.08, 0.035, 4000 + Math.random() * 3000, k * 0.09 + Math.random() * 0.04);
        beep(1900, 0.04, 0.012, 'square', 0.2);
        break;
      }
      case 'metal_distant': {
        // something metal, struck, a long way off down the pipes
        beep(310, 1.2, 0.02, 'triangle');
        beep(457, 1.0, 0.012, 'sine', 0.01);
        beep(683, 0.7, 0.008, 'sine', 0.02);
        noise(0.08, 0.02, 2500, 0);
        break;
      }
      case 'froggy_screech': {
        const base = 520 + Math.random() * 60;
        glide(base * 0.55, base * 1.9, 0.34, 0.07, 'sawtooth');
        glide(base * 0.57, base * 1.95, 0.34, 0.06, 'sawtooth', 0.01);
        glide(base * 1.9, base * 0.7, 0.95, 0.075, 'sawtooth', 0.33);
        glide(base * 1.97, base * 0.66, 0.95, 0.06, 'square', 0.34);
        glide(base * 0.5, base * 0.32, 1.1, 0.05, 'triangle', 0.3);
        noise(1.25, 0.05, 1800, 0.05);
        noise(0.12, 0.08, 6000, 0.32);
        break;
      }
      case 'distant_scream': {
        const base = 280 + Math.random() * 150;
        glide(base * 0.8, base * 1.72, 0.5, 0.105);
        glide(base * 1.72, base * 0.86, 0.9, 0.082, 'sawtooth', 0.46);
        glide(base * 1.2, base * 0.66, 0.75, 0.038, 'triangle', 0.6);
        noise(1.1, 0.022, 700, 0.04);
        break;
      }
      // ---- AND SOMEBODY ELSE WHO HAS BEEN AT IT LONGER.
      //
      // Three catches of breath, each a short rise that breaks and falls
      // away, and each smaller than the one before it: crying that has been
      // going on for a while rather than crying that has just started.  The
      // breath under each one is what makes it a person and not a note.
      case 'distant_cry': {
        const base = 330 + Math.random() * 100;
        for (let i = 0; i < 3; i++) {
          const at = i * 0.62;
          const k = 1 - i * 0.2;
          glide(base * 0.84, base * 1.26 * k, 0.16, 0.058 * k, 'triangle', at);
          glide(base * 1.26 * k, base * 0.7, 0.42, 0.05 * k, 'triangle', at + 0.15);
          noise(0.1, 0.014, 1400, at + 0.02);
        }
        break;
      }
      // ---- A SPEAKER WITH SOMETHING WRONG WITH IT.
      //
      // Three bursts of noise at dropping cutoffs, a buzz under them that
      // slides and gives out, and crackle scattered across the whole thing --
      // a cone being asked for something it cannot make.  Nine tenths of a
      // second, under the static `ArcadeHub` puts on the picture while it
      // plays, before the arcade's music restarts through the same fault.
      case 'speaker_fault': {
        for (let i = 0; i < 3; i++) noise(0.16, 0.09 - i * 0.015, 5200 - i * 1500, i * 0.24);
        for (let i = 0; i < 9; i++) noise(0.02, 0.05, 7000, 0.05 + i * 0.09 + Math.random() * 0.04);
        glide(140, 96, 0.55, 0.05, 'square', 0.06);
        glide(70, 52, 0.4, 0.04, 'sawtooth', 0.42);
        beep(41, 0.3, 0.035, 'square', 0.6);
        break;
      }
      // The fence taking one instead of the other fellow.
      case 'fence_thunk':
        beep(180, 0.11, 0.09, 'triangle');
        noise(0.07, 0.08, 620, 0.01);
        break;
      // ---- the night road (scenes2d/NightRoad3D.ts)
      // A frog the size of a man, somewhere behind you: two deep, wet,
      // rattling pulls, the second lower than the first.
      case 'croak':
        for (let i = 0; i < 2; i++) {
          const at = i * 0.42;
          for (let j = 0; j < 7; j++) beep(68 - i * 10 + j * 2, 0.045, 0.12, 'sawtooth', at + j * 0.045);
          glide(130 - i * 18, 82 - i * 12, 0.32, 0.07, 'square', at);
          noise(0.3, 0.05, 420, at);
        }
        break;
      // A crow, put out by something moving under it.
      case 'crow_caw':
        for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) {
          const at = i * 0.32;
          glide(820, 560, 0.2, 0.05, 'sawtooth', at);
          noise(0.18, 0.05, 2400, at);
        }
        break;
      // Wings going up out of the trees all at once.
      case 'wings':
        for (let i = 0; i < 10; i++) noise(0.06, 0.06 - i * 0.004, 1800, i * 0.07 + Math.random() * 0.03);
        break;
      // Pine boughs dragged past a body: a soft, airy shush with the dry
      // tick of needles in it, in a few overlapping strokes.
      // (three takes, so a run through the trees is never the same shush twice)
      case 'leaf_rustle': {
        const take = Math.floor(Math.random() * 3);
        const n = take === 0 ? 4 : take === 1 ? 6 : 3;
        for (let i = 0; i < n; i++) {
          noise(0.07 + Math.random() * (take === 2 ? 0.14 : 0.06), 0.045 - i * 0.005, (take === 1 ? 3600 : 2400) + Math.random() * 1800, i * (take === 1 ? 0.035 : 0.06) + Math.random() * 0.03);
        }
        noise(0.02, 0.03, 6000, 0.04);
        if (take === 2) noise(0.015, 0.05, 7000, 0.09); // a needle-tick snap
        break;
      }
      // A body going into a thick bush: a broad leafy thrash, twigs ticking
      // against each other in it, lower and fuller than a brush past a pine.
      case 'bush_rustle':
        for (let i = 0; i < 6; i++) noise(0.1 + Math.random() * 0.1, 0.06 - i * 0.006, 1500 + Math.random() * 1500, i * 0.045 + Math.random() * 0.03);
        for (let i = 0; i < 3; i++) noise(0.012, 0.05, 6500, 0.03 + Math.random() * 0.25);
        break;
      // A branch moving against its trunk: a slow wooden groan, bending pitch.
      case 'branch_creak': {
        const f = 70 + Math.random() * 60;
        glide(f, f * (0.75 + Math.random() * 0.4), 0.7 + Math.random() * 0.6, 0.022, 'sawtooth');
        glide(f * 2.02, f * 1.7, 0.5, 0.01, 'triangle', 0.1);
        noise(0.4, 0.012, 900, 0.05);
        break;
      }
      // The river: a wide rush, laid in overlapping swells so that, played
      // every second and a half, it never quite gaps.
      case 'river_flow':
        for (let i = 0; i < 3; i++) noise(1.9, 0.045, 520 + Math.random() * 380, i * 0.5);
        noise(1.5, 0.018, 2200, 0.2 + Math.random() * 0.3);
        break;
      // White water over rocks: brighter, choppier, a constant churn.
      case 'river_rapids':
        for (let i = 0; i < 5; i++) noise(0.4 + Math.random() * 0.4, 0.04, 1800 + Math.random() * 2400, i * 0.18);
        noise(1.2, 0.03, 700, 0);
        break;
      // Something small breaking the surface: a drop, a fish.
      case 'water_plip':
        glide(600 + Math.random() * 500, 1500 + Math.random() * 600, 0.08, 0.04, 'sine');
        noise(0.05, 0.03, 2500, 0.01);
        break;
      // The wind coming up through the trees, and dying again.
      case 'wind_gust':
        for (let i = 0; i < 5; i++) noise(1.6, 0.03 + i * 0.006, 380 + i * 260, i * 0.35);
        for (let i = 0; i < 6; i++) noise(0.3, 0.02, 3200, 0.8 + i * 0.3 + Math.random() * 0.2);
        break;
      // Wading: a leg pushing water aside, low and sloshing, and the drip back.
      case 'wade':
        noise(0.22, 0.11, 520);
        noise(0.12, 0.05, 1300, 0.08);
        beep(180, 0.12, 0.025, 'sine', 0.05);
        break;
      // A dry branch going under a foot.  Short, sharp and very loud at night.
      case 'twig_snap':
        noise(0.03, 0.22, 5200);
        beep(1900, 0.02, 0.06, 'square', 0.005);
        noise(0.05, 0.08, 1400, 0.03);
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
  /** The last scream's voice, so the next is a different one; see `SCREAMS`. */
  private lastScream = -1;
  /** The scream bus still sounding, and until when -- one scream at a time. */
  private scareBus: GainNode | null = null;
  private scareUntil = 0;

  scare(variant?: number): void {
    if (!this.unlocked || !this.ctx) return;
    if (store.get().settings.master === 0) return;

    const ctx = this.ctx;
    this.wake();
    const t = ctx.currentTime;
    // ---- ONE SCREAM AT A TIME.  A scream still sounding is cut, fast, before
    // the next one starts, so two never pile up into one noise.
    if (this.scareBus && t < this.scareUntil) {
      const old = this.scareBus;
      old.gain.cancelScheduledValues(t);
      old.gain.setValueAtTime(old.gain.value, t);
      old.gain.linearRampToValueAtTime(0, t + 0.03);
      setTimeout(() => old.disconnect(), 80);
    }
    // ---- AND ONE OF THREE.  Picked at random, never the same twice running.
    let v = variant ?? Math.floor(Math.random() * SCREAMS.length);
    if (variant === undefined && v === this.lastScream) v = (v + 1 + Math.floor(Math.random() * (SCREAMS.length - 1))) % SCREAMS.length;
    this.lastScream = v;
    const V = SCREAMS[v];
    // Everything below goes through a hard limiter: louder than it was, and
    // still held under full scale however the layers stack.
    const limit = ctx.createDynamicsCompressor();
    limit.threshold.value = -14;
    limit.knee.value = 4;
    limit.ratio.value = 16;
    limit.attack.value = 0.002;
    limit.release.value = 0.25;
    const ceiling = ctx.createGain();
    ceiling.gain.value = 1.9;
    const out = ctx.createGain();
    out.gain.value = 1;
    out.connect(limit);
    this.scareBus = out;
    this.scareUntil = t + SCREAM_DUR + 0.2;
    limit.connect(ceiling);
    // makeup gain after the limiter, then capped below unity again
    const cap = ctx.createGain();
    cap.gain.value = 0.5;
    ceiling.connect(cap);
    cap.connect(ctx.destination);

    // THE VOICE.  The recorded scream, made his: see `screamVoice`.  With it
    // playing, the synthesized scream below steps back to a texture under it.
    const recorded = this.screamBuf ? this.screamVoice(ctx, t, out, this.screamBuf, V) : false;
    const synth = recorded ? 0.35 : 1;

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
    clipGain.gain.linearRampToValueAtTime(0.45 * synth, t + 0.03);
    clipGain.gain.setValueAtTime(0.45 * synth, t + 0.5);
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
      osc.frequency.setValueAtTime(f0 * V.pitch, t + d);
      osc.frequency.exponentialRampToValueAtTime(f1 * V.pitch, t + d + V.sweep);
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
    for (const f0 of [1180, 1213, 1760]) {
      const f = f0 * V.pitch;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.linearRampToValueAtTime(f * 0.7, t + V.sweep);
      g.gain.setValueAtTime(0.0001, t + 0.02);
      g.gain.linearRampToValueAtTime(0.16 * synth, t + 0.05);
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
    // ---- THE CROAK.  The third voice opens with two wet, sub-heavy croaks
    // under the scream -- the frog in it, which is worse.
    if (V.croak) {
      for (const at of [0, 0.16]) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(160, t + at);
        osc.frequency.exponentialRampToValueAtTime(62, t + at + 0.13);
        g.gain.setValueAtTime(0.0001, t + at);
        g.gain.linearRampToValueAtTime(0.5, t + at + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, t + at + 0.15);
        osc.connect(g);
        g.connect(out);
        osc.start(t + at);
        osc.stop(t + at + 0.18);
      }
    }
  }

  /**
   * ---- HIS SCREAM.
   *
   * The recording is a person's scream, and he is not a person.  It is played
   * three times at once, each copy pushed somewhere a throat cannot go:
   *
   *   THE VOICE: a little under its own pitch and bending lower as it goes,
   *   driven into saturation so it tears rather than rings.
   *   THE SHRIEK: the same scream half an octave up, only its top end, a hair
   *   late -- a second mouth screaming over the first.
   *   THE GROWL: almost an octave down, cut to the chest, clipped hard and
   *   fluttered at 38Hz, which is the part that is no animal's.
   *
   * The leading silence of the file is skipped, so it starts on the frame the
   * scare does.  Returns false if it could not play.
   */
  private screamVoice(ctx: AudioContext, t: number, out: AudioNode, buf: AudioBuffer, V: ScreamVoice = SCREAMS[0]): boolean {
    const OFFSET = 0.17;
    const DUR = SCREAM_DUR;
    const shaper = (drive: number): WaveShaperNode => {
      const w = ctx.createWaveShaper();
      const c = new Float32Array(1024);
      for (let i = 0; i < 1024; i++) c[i] = Math.tanh(((i / 511.5) - 1) * drive);
      w.curve = c;
      return w;
    };
    const layer = (rate0: number, rate1: number, delay: number, gain: number, chain: AudioNode[]): void => {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.setValueAtTime(rate0, t + delay);
      src.playbackRate.linearRampToValueAtTime(rate1, t + delay + DUR * 0.9);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + delay);
      g.gain.linearRampToValueAtTime(gain, t + delay + 0.012);
      g.gain.setValueAtTime(gain, t + delay + SCREAM_HOLD);
      g.gain.exponentialRampToValueAtTime(0.0001, t + delay + DUR);
      let at: AudioNode = src;
      for (const n of chain) {
        at.connect(n);
        at = n;
      }
      at.connect(g);
      g.connect(out);
      src.start(t + delay, OFFSET);
      src.stop(t + delay + DUR + 0.05);
    };
    try {
      // the voice
      const body = ctx.createBiquadFilter();
      body.type = 'peaking';
      body.frequency.value = 1100;
      body.gain.value = 5;
      body.Q.value = 0.9;
      // a stutter in the throat on the shrieking one: the voice chopped at
      // fourteen a second, which no throat can do
      const chain: AudioNode[] = [shaper(V.voice[3]), body];
      if (V.stutter) {
        const chop = ctx.createGain();
        chop.gain.value = 0.6;
        const lfo2 = ctx.createOscillator();
        const depth = ctx.createGain();
        lfo2.type = 'square';
        lfo2.frequency.value = V.stutter;
        depth.gain.value = 0.4;
        lfo2.connect(depth);
        depth.connect(chop.gain);
        lfo2.start(t);
        lfo2.stop(t + DUR + 0.1);
        chain.push(chop);
      }
      layer(V.voice[0], V.voice[1], 0, V.voice[2], chain);

      // the shriek over it
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 2300;
      hp.Q.value = 0.7;
      layer(V.shriek[0], V.shriek[1], V.shriek[3], V.shriek[2], [hp, shaper(1.6)]);

      // the growl under it
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 820;
      lp.Q.value = 1.4;
      const flutter = ctx.createGain();
      flutter.gain.value = 0.55;
      const lfo = ctx.createOscillator();
      const lfoDepth = ctx.createGain();
      lfo.type = 'triangle';
      lfo.frequency.value = V.growl[3];
      lfoDepth.gain.value = 0.45;
      lfo.connect(lfoDepth);
      lfoDepth.connect(flutter.gain);
      lfo.start(t);
      lfo.stop(t + DUR + 0.1);
      layer(V.growl[0], V.growl[1], 0.006, V.growl[2], [lp, shaper(6), flutter]);
      return true;
    } catch {
      return false;
    }
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
  | 'footstep_gravel'
  | 'door_open'
  | 'door_shut'
  | 'lock_click'
  | 'key_turn'
  | 'door_rattle'
  | 'spot_slam'
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
  | 'bin_lid'
  | 'bin_rummage'
  | 'boom'
  | 'heal_up'
  | 'poison_hiss'
  | 'speaker_fault'
  | 'froggy_screech'
  | 'voice_whisper'
  | 'voice_children'
  | 'voice_robot'
  | 'voice_croak'
  | 'voice_laugh'
  | 'voice_muffled'
  | 'tube_echo'
  | 'reverse_breath'
  | 'radio_static'
  | 'metal_distant'
  | 'distant_scream'
  | 'distant_cry'
  | 'fence_thunk'
  | 'croak'
  | 'crow_caw'
  | 'wings'
  | 'twig_snap'
  | 'leaf_rustle'
  | 'bush_rustle'
  | 'branch_creak'
  | 'river_flow'
  | 'river_rapids'
  | 'water_plip'
  | 'wind_gust'
  | 'wade'
  | 'wheel_tick'
  | 'splash'
  | 'water_rise'
  | 'crumble'
  | 'arcane_cast'
  | 'arcane_blast'
  | 'knock_glass'
  | 'glass_crack'
  | 'glass_shatter'
  | 'dun'
  | 'door_smash'
  | 'lift_dead'
  | 'lamp_click';

export const audio = new AudioManager();
