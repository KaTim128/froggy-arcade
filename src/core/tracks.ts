/**
 * The music.  One small sequencer and a preset per room and per game.
 *
 * Everything is synthesized (PRD §11.5): a preset is a tempo, a chord loop,
 * a bass pattern, a lead line, a waveform for each and a drum feel, and the
 * engine plays it on WebAudio oscillators in eighth-note steps.  Loops are
 * seamless because there is no file to restart — the step counter just keeps
 * going.  `registerAsset` on the same id still replaces any of these with a
 * real recording without touching a scene.
 *
 * Notes are semitones from A4 (440 Hz).  A chord is its tones; the bass
 * takes the lowest an octave down.  A lead step is a note or a rest.
 *
 * Every track is a different key, tempo and feel on purpose: walking into a
 * room, or starting a cabinet, should sound like somewhere else.
 */

export interface TrackPreset {
  bpm: number;
  /** One entry per bar, looping. */
  chords: number[][];
  /** Eight steps a bar: null rest, 0 root, 1 fifth, 2 octave, 3 third. */
  bass: Array<number | null>;
  /** Any length that is a multiple of eight; null is a rest. */
  lead: Array<number | null>;
  leadWave: OscillatorType;
  bassWave: OscillatorType;
  /** Set to run an arpeggio of the chord under the lead. */
  arpWave?: OscillatorType;
  drums: 'four' | 'half' | 'shuffle' | 'sparse' | 'none';
  cutoff: number;
  vol: { lead: number; bass: number; arp: number; drums: number };
  /** 0..0.3: how late the off-beat eighths land. */
  swing?: number;
  /** How long a lead note rings, in steps. */
  ring?: number;
}

const C = { c4: -9, d4: -7, e4: -5, f4: -4, g4: -2, a4: 0, b4: 2, c5: 3, d5: 5, e5: 7, f5: 8, g5: 10, a5: 12, b5: 14, c6: 15 };
const _ = null;

/** Major and minor triads by root (semitones from A4). */
const maj = (r: number): number[] => [r, r + 4, r + 7];
const min = (r: number): number[] => [r, r + 3, r + 7];
const maj7 = (r: number): number[] => [r, r + 4, r + 7, r + 11];
const min7 = (r: number): number[] => [r, r + 3, r + 7, r + 10];

const base: TrackPreset = {
  bpm: 128,
  chords: [maj(C.c4), min(C.a4 - 12), maj(C.f4 - 12), maj(C.g4 - 12)],
  bass: [0, _, 0, 1, 0, _, 2, 1],
  lead: [C.e5, C.g5, C.c6, C.g5, C.e5, _, C.g5, _],
  leadWave: 'square',
  bassWave: 'triangle',
  arpWave: 'square',
  drums: 'four',
  cutoff: 3200,
  vol: { lead: 0.035, bass: 0.05, arp: 0.016, drums: 1 },
  ring: 1.4,
};

const preset = (p: Partial<TrackPreset>): TrackPreset => ({ ...base, ...p, vol: { ...base.vol, ...(p.vol ?? {}) } });

export const TRACKS: Record<string, TrackPreset> = {
  // ------------------------------------------------------------- the rooms
  // The front room: bright, bouncy, the tune a kid would hum.
  room_hub: preset({
    bpm: 124,
    chords: [maj(C.c4), maj(C.g4 - 12), min(C.a4 - 12), maj(C.f4 - 12)],
    bass: [0, _, 2, _, 0, 1, 2, _],
    lead: [C.e5, _, C.g5, C.e5, C.d5, _, C.c5, _, C.d5, C.e5, C.d5, _, C.b4, _, _, _, C.c5, _, C.e5, C.c5, C.a4, _, C.c5, _, C.a4, C.g4, C.a4, _, C.c5, _, _, _],
    drums: 'four',
  }),
  // The back room: minor, quicker, the cabinets that take your afternoon.
  room_annex: preset({
    bpm: 140,
    chords: [min(C.d4), maj(C.b4 - 12 - 1), maj(C.f4 - 12), maj(C.a4 - 12)],
    bass: [0, 0, _, 0, 2, _, 0, 1],
    lead: [C.d5, _, C.f5, _, C.a5, C.g5, C.f5, _, C.e5, _, C.d5, _, C.f5, _, C.e5, C.d5, C.c5, _, C.d5, _, C.f5, _, C.a5, _, C.a4, _, C.c5, _, C.e5, _, _, _],
    bassWave: 'sawtooth',
    cutoff: 2800,
  }),

  // ------------------------------------------------------------ the games
  // Noughts and crosses: light, ticking, a music box.
  game_tictactoe: preset({
    bpm: 104,
    chords: [maj7(C.c4), maj7(C.f4 - 12), min7(C.a4 - 12), maj7(C.g4 - 12)],
    bass: [0, _, _, _, 1, _, _, _],
    lead: [C.g5, C.e5, C.c5, C.e5, C.g5, _, C.a5, _, C.f5, C.a5, C.c6, _, C.a5, C.f5, _, _],
    leadWave: 'triangle',
    arpWave: 'triangle',
    drums: 'sparse',
    ring: 2,
  }),
  // Air hockey: organ chords at rink speed.
  game_airhockey: preset({
    bpm: 160,
    chords: [maj(C.a4 - 12), maj(C.d4), maj(C.e4), maj(C.d4)],
    bass: [0, 0, 2, 0, 0, 0, 2, 1],
    lead: [C.a5, C.a5, _, C.a5, C.b5, _, C.a5, _, C.f5 + 1, _, C.e5, _, C.d5, _, C.e5, _],
    leadWave: 'square',
    bassWave: 'square',
    cutoff: 3600,
    vol: { lead: 0.028, bass: 0.04, arp: 0.014, drums: 1 },
  }),
  // Hoops: funky, syncopated, a little swing.
  game_hoops: preset({
    bpm: 108,
    chords: [min7(C.e4 - 12), min7(C.a4 - 12), min7(C.e4 - 12), maj7(C.d4)],
    bass: [0, _, 0, 3, _, 0, 1, _],
    lead: [C.e5, _, _, C.g5, _, C.e5, _, C.d5, _, C.b4, _, _, C.d5, _, C.e5, _],
    leadWave: 'triangle',
    bassWave: 'sawtooth',
    drums: 'shuffle',
    swing: 0.18,
    cutoff: 2400,
  }),
  // Whack-a-frog: a silly oom-pah at speed.
  game_whack: preset({
    bpm: 150,
    chords: [maj(C.f4 - 12), maj(C.c4), maj(C.f4 - 12), maj(C.c4)],
    bass: [0, _, 1, _, 0, _, 1, _],
    lead: [C.f5, C.a5, C.c6, C.a5, C.f5, _, C.c5, _, C.e5, C.g5, C.c6, C.g5, C.e5, _, C.c5, _],
    arpWave: undefined,
    drums: 'four',
  }),
  // Chomp-Man: chromatic and hurried, something behind you.
  game_chompman: preset({
    bpm: 145,
    chords: [min(C.c4), min(C.c4), maj(C.a4 - 12 - 1), maj(C.g4 - 12)],
    bass: [0, 2, 0, 2, 0, 2, 0, 2],
    lead: [C.c5, C.c5 + 1, C.d5, C.d5 + 1, C.e5, _, C.d5 + 1, C.d5, C.c5 + 1, C.c5, _, C.g5, _, C.f5 + 1, C.g5, _],
    bassWave: 'square',
    cutoff: 3000,
  }),
  // Grudge: power chords and a snare that hits.
  game_grudge: preset({
    bpm: 150,
    chords: [[C.e4 - 12, C.b4 - 12, C.e4], [C.g4 - 12, C.d4, C.g4], [C.a4 - 12, C.e4, C.a4], [C.g4 - 12, C.d4, C.g4]],
    bass: [0, 0, _, 0, 0, _, 0, 0],
    lead: [C.e5, _, C.e5, C.g5, _, C.e5, C.d5, _, C.b4, _, C.d5, C.e5, _, C.g5, C.e5, _],
    leadWave: 'sawtooth',
    bassWave: 'sawtooth',
    arpWave: undefined,
    cutoff: 2600,
    vol: { lead: 0.03, bass: 0.045, arp: 0, drums: 1.2 },
  }),
  // Barrel Climb: a rising arpeggio, always climbing.
  game_donkeykong: preset({
    bpm: 132,
    chords: [maj(C.c4), maj(C.d4), maj(C.e4), maj(C.g4 - 12)],
    bass: [0, _, 0, _, 2, _, 1, _],
    lead: [C.c5, C.e5, C.g5, C.c6, C.d5, C.f5 + 1, C.a5, C.d5 + 12, C.e5, C.g5 + 1, C.b5, C.e5 + 12, C.g5, C.b5, C.d5 + 12, _],
    arpWave: undefined,
    drums: 'four',
  }),
  // Battleship: slow, minor, a drum under the fog.
  game_battleship: preset({
    bpm: 88,
    chords: [min(C.d4), min(C.d4), maj(C.b4 - 12 - 1), maj(C.a4 - 12)],
    bass: [0, _, _, 0, _, _, 1, _],
    lead: [C.d5, _, _, _, C.f5, _, C.e5, _, C.d5, _, _, _, C.a4, _, _, _],
    leadWave: 'triangle',
    arpWave: 'triangle',
    drums: 'sparse',
    cutoff: 2000,
    ring: 2.4,
  }),
  // Blackjack: a lounge swing on sevenths.
  game_blackjack: preset({
    bpm: 96,
    chords: [maj7(C.f4 - 12), min7(C.d4), min7(C.g4 - 12), [C.c4, C.e4, C.g4, C.b4 - 1]],
    bass: [0, _, 3, _, 1, _, 2, _],
    lead: [C.a5, _, C.g5, _, C.f5, _, C.e5, _, C.d5, _, _, C.f5, _, C.a5, _, _],
    leadWave: 'triangle',
    bassWave: 'triangle',
    arpWave: 'triangle',
    drums: 'shuffle',
    swing: 0.25,
    cutoff: 2200,
    ring: 1.8,
  }),
  // Slots: bells and a fast bright bounce.
  game_slots: preset({
    bpm: 150,
    chords: [maj(C.c4), maj(C.f4 - 12), maj(C.g4 - 12), maj(C.c4)],
    bass: [0, _, 2, _, 0, _, 2, _],
    lead: [C.c6, C.g5, C.e5, C.g5, C.c6, _, C.e5 + 12, _, C.a5, C.f5, C.c5, C.f5, C.a5, _, C.c6, _],
    leadWave: 'triangle',
    cutoff: 4000,
    ring: 1.2,
  }),
  // The chamber: a low pulse and not much else.
  game_roulette: preset({
    bpm: 84,
    chords: [min(C.a4 - 12), min(C.a4 - 12), [C.f4 - 12, C.a4 - 12, C.c4], maj(C.e4 - 12)],
    bass: [0, _, _, _, 0, _, _, _],
    lead: [_, _, C.e5, _, _, _, C.c5, _, _, _, C.b4, _, _, _, _, _],
    leadWave: 'sine',
    bassWave: 'sawtooth',
    arpWave: undefined,
    drums: 'sparse',
    cutoff: 1400,
    vol: { lead: 0.03, bass: 0.05, arp: 0, drums: 0.8 },
    ring: 3,
  }),
  // Frog Cross: hoppy staccato.
  game_frogcross: preset({
    bpm: 138,
    chords: [maj(C.g4 - 12), maj(C.c4), maj(C.g4 - 12), maj(C.d4)],
    bass: [0, _, 0, _, 1, _, 0, _],
    lead: [C.g5, _, C.b5, _, C.d5 + 12, C.b5, C.g5, _, C.a5, _, C.c6, _, C.a5, C.f5 + 1, C.d5, _],
    ring: 0.6,
  }),
  // Car Chase: driving saw bass, sirens in the lead.
  game_carchase: preset({
    bpm: 170,
    chords: [min(C.e4 - 12), min(C.e4 - 12), maj(C.c4), maj(C.d4)],
    bass: [0, 0, 2, 0, 0, 0, 2, 0],
    lead: [C.e5, _, C.b5, _, C.e5, _, C.g5, C.f5 + 1, C.e5, _, C.b5, _, C.a5, _, C.g5, _],
    leadWave: 'sawtooth',
    bassWave: 'sawtooth',
    cutoff: 3000,
    vol: { lead: 0.026, bass: 0.045, arp: 0.012, drums: 1.1 },
  }),
  // Dance Off: four on the floor and a hook you can hit arrows to.  The chart
  // is written at this tempo, so the arrows land where the kick does.
  game_danceoff: preset({
    bpm: 128,
    chords: [min(C.a4 - 12), maj(C.f4 - 12), maj(C.c4), maj(C.g4 - 12)],
    bass: [0, 0, 2, 0, 0, 0, 2, 1],
    lead: [C.a5, _, C.e5, C.a5, _, C.c6, _, C.b5, C.a5, _, C.g5, _, C.e5, _, C.g5, _, C.f5, _, C.a5, _, C.c6, _, C.a5, C.g5, C.e5, _, C.d5, _, C.e5, _, _, _],
    leadWave: 'square',
    bassWave: 'sawtooth',
    arpWave: 'square',
    drums: 'four',
    cutoff: 3600,
    vol: { lead: 0.03, bass: 0.05, arp: 0.014, drums: 1.15 },
    ring: 0.9,
  }),
  // Dance Off, round two: same room, quicker feet.  Up a fourth and up twelve
  // bpm, the bass on every eighth, and the lead stops resting — the chart is
  // cut to this tempo, so the round is audibly busier before a single arrow
  // has climbed the mat.
  game_danceoff_2: preset({
    bpm: 140,
    chords: [min(C.d4), maj(C.b4 - 13), maj(C.f4 - 12), maj(C.c4)],
    bass: [0, 0, 2, 0, 1, 0, 2, 0],
    lead: [C.d5, _, C.a5, C.d5 + 12, C.a5, _, C.f5, C.a5, C.g5, _, C.d5, C.g5, C.a5, _, C.c6, _, C.a5, C.g5, C.f5, _, C.d5, _, C.f5, C.a5, C.c6, _, C.a5, _, C.g5, _, C.f5, _],
    leadWave: 'square',
    bassWave: 'sawtooth',
    arpWave: 'square',
    drums: 'four',
    cutoff: 4000,
    vol: { lead: 0.032, bass: 0.052, arp: 0.016, drums: 1.2 },
    ring: 0.8,
  }),
  // And the final round: the fastest tune in the building, in a minor key,
  // with the lead running sixteenths.  By here he is landing nearly nine in
  // ten and the music is telling you so.
  game_danceoff_3: preset({
    bpm: 152,
    chords: [min(C.e4 - 12), maj(C.c4), maj(C.g4 - 12), maj(C.d4)],
    bass: [0, 0, 0, 2, 0, 0, 2, 1],
    lead: [C.e5, C.g5, C.b5, C.e5 + 12, C.b5, C.g5, C.b5, _, C.c6, _, C.b5, C.g5, C.e5, _, C.g5, _, C.d5 + 12, C.b5, C.g5, C.d5, C.g5, _, C.b5, _, C.a5, C.b5, C.c6, C.b5, C.a5, _, C.g5, _],
    leadWave: 'sawtooth',
    bassWave: 'sawtooth',
    arpWave: 'square',
    drums: 'four',
    cutoff: 4400,
    vol: { lead: 0.03, bass: 0.055, arp: 0.018, drums: 1.25 },
    ring: 0.7,
  }),
  // The Flood: a climbing tune in a hurry.  Rising figures over a walking
  // bass, because the whole game is upward and the water is the clock.
  game_flood: preset({
    bpm: 146,
    chords: [min(C.a4 - 12), maj(C.c4), maj(C.f4 - 12), maj(C.g4 - 12)],
    bass: [0, _, 1, _, 2, _, 1, _],
    lead: [C.a4, C.c5, C.e5, C.a5, C.e5, _, C.c5, _, C.c5, C.e5, C.g5, C.c6, C.g5, _, C.e5, _, C.f5, C.a5, C.c6, C.f5 + 12, C.c6, _, C.a5, _, C.g5, C.b5, C.d5 + 12, C.g5 + 12, _, C.d5 + 12, C.b5, _],
    leadWave: 'square',
    bassWave: 'triangle',
    arpWave: 'square',
    drums: 'four',
    cutoff: 3900,
    vol: { lead: 0.03, bass: 0.05, arp: 0.015, drums: 1.1 },
    ring: 0.8,
  }),
  // The wheel: a fairground vamp, all bounce and no menace, because the thing
  // taking your money is painted in primary colours.
  game_wheel: preset({
    bpm: 136,
    chords: [maj(C.c4), maj(C.g4 - 12), maj(C.c4), maj(C.f4 - 12)],
    bass: [0, _, 1, _, 0, _, 2, 1],
    lead: [C.c5, C.e5, C.g5, C.e5, C.c6, _, C.g5, _, C.a5, C.f5, C.c5, C.f5, C.a5, _, C.g5, _],
    leadWave: 'square',
    bassWave: 'triangle',
    arpWave: 'square',
    drums: 'four',
    cutoff: 3800,
    ring: 1.1,
  }),
  // Frog vs Lizard: a fast minor march with a taunt in the lead — two
  // neighbours over a fence, and neither of them backing down.
  game_frogvslizard: preset({
    bpm: 152,
    chords: [min(C.e4 - 12), maj(C.c4), maj(C.g4 - 12), maj(C.d4)],
    bass: [0, 0, 1, 0, 2, _, 0, 1],
    lead: [C.e5, _, C.e5, C.g5, C.b5, _, C.a5, C.g5, C.e5, _, C.c5, _, C.d5, C.e5, _, _, C.g5, _, C.g5, C.b5, C.d5 + 12, _, C.b5, C.a5, C.g5, _, C.e5, _, C.d5, _, _, _],
    leadWave: 'square',
    bassWave: 'sawtooth',
    arpWave: 'square',
    drums: 'four',
    cutoff: 3200,
    vol: { lead: 0.032, bass: 0.048, arp: 0.014, drums: 1.1 },
    ring: 1,
  }),
  // Bowling: brassy squares, a sports-hall fanfare.
  game_bowling: preset({
    bpm: 128,
    chords: [maj(C.f4 - 12), maj(C.b4 - 12 - 1), maj(C.c4), maj(C.f4 - 12)],
    bass: [0, _, 1, _, 2, _, 1, _],
    lead: [C.f5, C.f5, C.a5, _, C.c6, _, C.a5, _, C.b5 - 1, _, C.d5 + 12, _, C.c6, C.a5, C.f5, _],
    leadWave: 'square',
    bassWave: 'square',
    drums: 'four',
    cutoff: 3400,
  }),
};

/** Play a preset into `out` until the returned function is called. */
export function runTrack(ctx: AudioContext, out: GainNode, p: TrackPreset): () => void {
  const STEP_MS = 30000 / p.bpm;
  const hz = (semis: number) => 440 * 2 ** (semis / 12);
  let step = 0;
  let stopped = false;

  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = p.cutoff;
  tone.Q.value = 0.5;
  tone.connect(out);

  const note = (freq: number, at: number, dur: number, vol: number, type: OscillatorType) => {
    if (vol <= 0) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(vol, at + 0.008);
    g.gain.setValueAtTime(vol, at + dur * 0.55);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(g);
    g.connect(tone);
    osc.start(at);
    osc.stop(at + dur + 0.03);
  };

  const drum = (at: number, kind: 'kick' | 'snare' | 'hat', vol: number) => {
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
    g.gain.value = (kind === 'kick' ? 0.07 : kind === 'snare' ? 0.035 : 0.012) * vol;
    src.buffer = buf;
    src.connect(f);
    f.connect(g);
    g.connect(out);
    src.start(at);
  };

  const tick = () => {
    if (stopped) return;
    const inBar = step % 8;
    const bar = Math.floor(step / 8) % p.chords.length;
    const chord = p.chords[bar];
    const dur = STEP_MS / 1000;
    const late = inBar % 2 === 1 ? (p.swing ?? 0) * dur : 0;
    const t = ctx.currentTime + 0.02 + late;

    const b = p.bass[inBar];
    if (b !== null && b !== undefined) {
      const root = chord[0] - 12;
      const semis = b === 0 ? root : b === 1 ? root + 7 : b === 2 ? root + 12 : root + (chord[1] - chord[0]);
      note(hz(semis), t, dur * 0.85, p.vol.bass, p.bassWave);
    }
    if (p.arpWave) note(hz(chord[step % chord.length]), t, dur * 0.7, p.vol.arp, p.arpWave);
    const n = p.lead[step % p.lead.length];
    if (n !== null && n !== undefined) note(hz(n), t, dur * (p.ring ?? 1.4), p.vol.lead, p.leadWave);

    const v = p.vol.drums;
    if (p.drums === 'four') {
      drum(t, 'hat', v);
      if (inBar === 0 || inBar === 4) drum(t, 'kick', v);
      if (inBar === 2 || inBar === 6) drum(t, 'snare', v);
    } else if (p.drums === 'half') {
      if (inBar % 2 === 0) drum(t, 'hat', v);
      if (inBar === 0) drum(t, 'kick', v);
      if (inBar === 4) drum(t, 'snare', v);
    } else if (p.drums === 'shuffle') {
      drum(t, 'hat', v * 0.8);
      if (inBar === 0 || inBar === 3 || inBar === 4) drum(t, 'kick', v);
      if (inBar === 2 || inBar === 6) drum(t, 'snare', v);
    } else if (p.drums === 'sparse') {
      if (inBar === 0) drum(t, 'kick', v);
      if (inBar % 2 === 0) drum(t, 'hat', v * 0.5);
    }
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
