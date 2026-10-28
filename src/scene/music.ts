export type LakeVoice = "bed" | "glass" | "wood" | "pulse" | "bass";

export interface LakeNote {
  /** Seconds relative to the beginning of this phrase. */
  time: number;
  duration: number;
  midi: number;
  velocity: number;
  pan: number;
  voice: LakeVoice;
  attack: number;
  release: number;
}

export interface LakeHarmony {
  time: number;
  name: string;
  bass: number;
  upper: number[];
}

export interface LakePitchPoint {
  /** Offset within a continuous breath; the first point always starts at zero. */
  offset: number;
  midi: number;
  glide: number;
}

export interface LakeMelodyLine {
  time: number;
  duration: number;
  points: LakePitchPoint[];
  velocity: number;
  pan: number;
  attack: number;
  release: number;
}

export interface LakePhrase {
  duration: number;
  notes: LakeNote[];
  harmony: LakeHarmony[];
  melody: LakeMelodyLine[];
}

export interface LakeMusic {
  start(): Promise<void>;
  /** Resume on the user gesture, then silently render a settled cyclic score. */
  prepareLoop(duration: number): Promise<void>;
  /** Synchronous start for the recording-start callback; prepareLoop must finish first. */
  playPreparedLoop(): void;
  /** Prepared stereo WAV at current output gain by default; optional gain 0–1.
   * No browser download side effects or automatic normalization. */
  getLoopWav(gain?: number): Blob;
  stop(): void;
  dispose(): void;
  readonly stream: MediaStream | null;
  /** Normalized volume, 0–1; optional fade duration is clamped to 0–5 seconds. */
  setVolume(value: number, rampSeconds?: number): void;
}

export const LAKE_PHRASE_SECONDS = 48;
export const LAKE_MUSIC_SEED = 74291;
/** Dotted-quarter pulse: six eighth notes form a gently lilting 6/8 bar. */
export const LAKE_PULSE_BPM = 70;
export const LAKE_EIGHTH_SECONDS = 60 / (LAKE_PULSE_BPM * 3);

/** A full left/right/left return is audible within a short exported clip. */
export const LAKE_ORBIT_SECONDS = 9;

/** Positive-gain equal-power panning only: no inter-channel delay or inversion.
 * Time is playback-relative, so sentences share one orbit instead of resetting it.
 */
export function getLakePan(
  voice: LakeVoice,
  time: number,
  staticPan = 0,
  midi = 60,
  orbitSeconds = LAKE_ORBIT_SECONDS,
): number {
  const seconds = Number.isFinite(time) ? time : 0;
  const period = Number.isFinite(orbitSeconds) && orbitSeconds > 0 ? orbitSeconds : LAKE_ORBIT_SECONDS;
  const phase = ((seconds - 0.75) / period) * Math.PI * 2;
  if (voice === "glass") return -0.66 * Math.cos(phase);
  if (voice === "wood") return 0.56 * Math.cos(phase);
  if (voice === "pulse" || voice === "bass" || midi < 50) return 0;
  return Number.isFinite(staticPan)
    ? Math.max(-0.35, Math.min(0.35, staticPan))
    : 0;
}

export function createLakePanCurve(
  voice: LakeVoice,
  time: number,
  duration: number,
  staticPan = 0,
  midi = 60,
  orbitSeconds = LAKE_ORBIT_SECONDS,
): Float32Array {
  const seconds = Number.isFinite(duration) ? Math.max(0, duration) : 0;
  const curve = new Float32Array(
    Math.min(2048, Math.max(2, Math.ceil(seconds * 30) + 1)),
  );
  for (let i = 0; i < curve.length; i++) {
    curve[i] = getLakePan(
      voice,
      time + (seconds * i) / (curve.length - 1),
      staticPan,
      midi,
      orbitSeconds,
    );
  }
  return curve;
}

/** Additive spectra actually used by the synth. The rhythmic bass's second and
 * third harmonics carry its warm body on small speakers without bright overtones.
 */
export function getLakePartials(
  voice: LakeVoice,
): readonly (readonly [number, number, number])[] {
  if (voice === "bass")
    return [
      [1, 0.58, 0],
      [2, 0.28, 0],
      [3, 0.1, 0],
    ];
  if (voice === "pulse") return [[1, 0.18, 0]];
  if (voice === "wood")
    return [
      [1, 0.84, 0],
      [2.46, 0.075, 0],
      [3.74, 0.012, 0],
    ];
  return [
    [1, 0.48, -1.7],
    [1, 0.48, 1.7],
    [2, voice === "glass" ? 0.04 : 0.02, 0],
  ];
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** Original 48-second A / answer / departure / return arrangement. Generative
 * variation shapes phrasing and orchestration around a composed motif; it does
 * not choose the next scale note at random. Upper chord voices move <=3 semitones.
 * The first 15 seconds already contain a call, a rest, a reply and a chord change.
 */
export function generateLakePhrase(
  seed: number,
  phraseIndex: number,
): LakePhrase {
  const index = Number.isFinite(phraseIndex)
    ? Math.max(0, Math.floor(phraseIndex)) >>> 0
    : 0;
  const initial = Number.isFinite(seed) ? seed >>> 0 : LAKE_MUSIC_SEED;
  const random = seededRandom(initial ^ Math.imul(index + 1, 0x9e3779b1));
  const harmony: LakeHarmony[] = [
    { time: 0, name: "Fmaj9", bass: 41, upper: [53, 57, 64, 67, 72] },
    { time: 7, name: "Am9", bass: 45, upper: [55, 59, 64, 67, 72] },
    { time: 20, name: "G6/9", bass: 43, upper: [55, 57, 64, 67, 71] },
    { time: 34, name: "Cmaj9", bass: 48, upper: [55, 59, 64, 67, 74] },
  ];
  const notes: LakeNote[] = [];
  harmony.forEach((chord, section) => {
    const next = harmony[section + 1]?.time ?? LAKE_PHRASE_SECONDS;
    const duration = next - chord.time + 3.4;
    chord.upper.forEach((midi, i) => {
      notes.push({
        time: chord.time + i * 0.075,
        duration,
        midi,
        velocity: 0.25 + random() * 0.035,
        pan: (i - 2) * (0.14 + (section % 2) * 0.02),
        voice: "bed",
        attack: 2.1 + i * 0.12,
        release: 3.4,
      });
    });
    notes.push({
      time: chord.time,
      duration,
      midi: chord.bass,
      velocity: 0.2,
      pan: 0,
      voice: "bed",
      attack: 2.4,
      release: 3.4,
    });
  });

  // A darker modal/wood voice answers in a different register and articulation.
  // These are composed responses, not the lead doubled an octave below.
  const answers = [
    [2.15, 64, 1.65],
    [5.1, 60, 1.85],
    [12.15, 59, 1.9],
    [25.1, 62, 1.7],
    [35.2, 57, 1.8],
    [40.95, 64, 1.75],
  ];
  answers.forEach(([time, midi, duration], i) => {
    notes.push({
      time: time + (random() - 0.5) * 0.06,
      duration,
      midi,
      velocity: 0.125 + random() * 0.0225,
      pan: -0.28 + (i % 3) * 0.09,
      voice: "wood",
      attack: 0.11 + random() * 0.035,
      release: 0.88,
    });
  });
  // Quiet breaths underneath the phrases imply 6/8 rather than ticking every
  // beat. Off-beat pickups, omitted bars and a central break preserve space.
  const pulsePatterns = [[0, 3, 5], [0, 4], [], [2, 3]];
  const silentBars = new Set([10, 11, 12, 18, 19, 20, 25]);
  for (let bar = 2; bar < 28; bar++) {
    if (silentBars.has(bar)) continue;
    const pattern = pulsePatterns[(bar - 2) % pulsePatterns.length];
    for (const step of pattern) {
      const time = (bar * 6 + step) * LAKE_EIGHTH_SECONDS;
      const chord =
        [...harmony].reverse().find((item) => item.time <= time) ?? harmony[0];
      notes.push({
        time: time + (random() - 0.5) * 0.014,
        duration: 0.62 + random() * 0.045,
        midi: chord.bass,
        velocity: (step === 0 || step === 3 ? 0.12 : 0.095) + random() * 0.008,
        pan: step % 2 ? 0.11 : -0.09,
        voice: "pulse",
        attack: 0.13,
        release: 0.34,
      });
    }
  }
  // Grounded 6/8 bass: roots on selected first beats and fifths on selected
  // second-group beats. Whole silent bars and held roots keep it from plodding.
  // Independent variation preserves the accepted bed, lead, wood and air pulse.
  const bassRandom = seededRandom(initial ^ Math.imul(index + 1, 0xc2b2ae35));
  const bassPatterns = [[0], [0, 3], [0], [], [0, 3], [3], [0], []];
  for (let bar = 1; bar < 28; bar++) {
    const pattern = bassPatterns[(bar - 1) % bassPatterns.length];
    for (const step of pattern) {
      const time = (bar * 6 + step) * LAKE_EIGHTH_SECONDS;
      const chord =
        [...harmony].reverse().find((item) => item.time <= time) ?? harmony[0];
      notes.push({
        time,
        duration: step === 0 && pattern.length === 1 ? 1.1 : 0.78,
        midi: chord.bass + (step === 3 ? 7 : 0),
        velocity: (step === 0 ? 0.34 : 0.29) + bassRandom() * 0.02,
        pan: 0,
        voice: "bass",
        attack: 0.055 + bassRandom() * 0.01,
        release: 0.35 + bassRandom() * 0.04,
      });
    }
  }
  notes.sort((a, b) => a.time - b.time || a.midi - b.midi);
  return {
    duration: LAKE_PHRASE_SECONDS,
    notes,
    harmony,
    melody: generateLakeMelodyLines(initial, index),
  };
}

/** One sustained oscillator bank per sentence. Changing pitch never re-triggers
 * an amplitude attack: only the sentence's outer boundaries open/close the breath.
 */
export function generateLakeMelodyLines(
  seed: number,
  phraseIndex: number,
): LakeMelodyLine[] {
  const index = Number.isFinite(phraseIndex)
    ? Math.max(0, Math.floor(phraseIndex)) >>> 0
    : 0;
  const initial = Number.isFinite(seed) ? seed >>> 0 : LAKE_MUSIC_SEED;
  const random = seededRandom(initial ^ Math.imul(index + 1, 0x85ebca6b));
  const sentences = [
    {
      time: 0.75,
      duration: 5.95,
      pitches: [72, 76, 74],
      offsets: [0, 1.9, 3.85],
    },
    {
      time: 8.25,
      duration: 9.35,
      pitches: [69, 72, index % 3 === 2 ? 69 : 71],
      offsets: [0, 2.5, 5.95],
    },
    {
      time: 24.2,
      duration: 10.6,
      pitches: [71, 74, 69],
      offsets: [0, 3.35, 7.1],
    },
    {
      time: 37.15,
      duration: 10.45,
      pitches: [72, 76, 74, 72],
      offsets: [0, 2.75, 5.45, 8.05],
    },
  ];
  return sentences.map((sentence, i) => ({
    time: sentence.time + (random() - 0.5) * 0.1,
    duration: sentence.duration,
    points: sentence.pitches.map((midi, point) => ({
      offset: sentence.offsets[point],
      midi,
      glide: point === 0 ? 0 : 0.16 + random() * 0.075,
    })),
    velocity: (i === 0 ? 0.44 : 0.41) + random() * 0.025,
    pan: Math.sin(i * 0.78 + index * 0.3) * 0.2,
    attack: 0.36,
    release: 1.15,
  }));
}

/** Sentence envelope stays full and gently breathing across every pitch point. */
export function createLakeLineEnvelope(line: LakeMelodyLine): Float32Array {
  const curve = new Float32Array(512);
  for (let i = 0; i < curve.length; i++) {
    const t = (i / (curve.length - 1)) * line.duration;
    const attack = Math.min(1, t / line.attack);
    const release = Math.min(
      1,
      Math.max(0, (t - line.duration + line.release) / line.release),
    );
    const inhale = 0.5 - 0.5 * Math.cos(Math.PI * attack);
    const exhale = 0.5 + 0.5 * Math.cos(Math.PI * release);
    curve[i] = inhale * exhale * (0.95 + 0.05 * Math.cos(t * Math.PI * 0.48));
  }
  return curve;
}

export type LakeScheduledEvent =
  | { time: number; kind: "note"; note: LakeNote }
  | { time: number; kind: "line"; line: LakeMelodyLine };

/** Scheduler consumes sentence events, never individual melody pitch points. */
export function createLakeSchedule(phrase: LakePhrase): LakeScheduledEvent[] {
  return [
    ...phrase.notes.map(
      (note): LakeScheduledEvent => ({ time: note.time, kind: "note", note }),
    ),
    ...phrase.melody.map(
      (line): LakeScheduledEvent => ({ time: line.time, kind: "line", line }),
    ),
  ].sort((a, b) => a.time - b.time);
}

/** Fourteen 6/8 bars at the accepted 70 BPM dotted-quarter pulse. */
export const LAKE_LOOP_SECONDS = 14 * 6 * LAKE_EIGHTH_SECONDS;

/** A full harmonic arc written for the short visual loop, not sped-up playback. */
export function generateLakeLoopPhrase(duration = LAKE_LOOP_SECONDS): LakePhrase {
  if (!Number.isFinite(duration) || Math.abs(duration - LAKE_LOOP_SECONDS) > 0.000001) {
    throw new RangeError("The lake music loop is 24 seconds: fourteen full 6/8 bars.");
  }
  const source = generateLakePhrase(LAKE_MUSIC_SEED, 0);
  const bar = 6 * LAKE_EIGHTH_SECONDS;
  const harmony = source.harmony.map((chord, i) => ({ ...chord, time: [0, 4, 8, 12][i] * bar, upper: [...chord.upper] }));
  const notes: LakeNote[] = [];
  harmony.forEach((chord, i) => {
    const oldTime = source.harmony[i].time;
    const oldNext = source.harmony[i + 1]?.time ?? source.duration;
    const next = harmony[i + 1]?.time ?? duration;
    source.notes.filter((note) => note.voice === "bed" && note.time >= oldTime && note.time < oldNext).forEach((note) => {
      notes.push({ ...note, time: chord.time + note.time - oldTime, duration: next - chord.time + 3.4 });
    });
  });
  source.notes.filter((note) => (note.voice === "bass" || note.voice === "pulse") && note.time < duration).forEach((note) => {
    const chord = [...harmony].reverse().find((chord) => chord.time <= note.time) ?? harmony[0];
    const step = Math.round(note.time / LAKE_EIGHTH_SECONDS);
    notes.push({ ...note, midi: chord.bass + (note.voice === "bass" && step % 6 === 3 ? 7 : 0) });
  });
  const wood = source.notes.filter((note) => note.voice === "wood");
  notes.push(...wood.slice(0, 3).map((note) => ({ ...note })), { ...wood[4], time: 18.9 });
  const melody: LakeMelodyLine[] = [
    ...source.melody.slice(0, 2).map((line) => ({ ...line, points: line.points.map((point) => ({ ...point })) })),
    {
      time: 18.2, duration: 5.35, velocity: 0.42, pan: 0,
      attack: 0.36, release: 1.15,
      points: [
        { offset: 0, midi: 71, glide: 0 },
        { offset: 2.45, midi: 74, glide: 0.20 },
        { offset: 3.6, midi: 72, glide: 0.18 },
      ],
    },
  ];
  notes.sort((a, b) => a.time - b.time || a.midi - b.midi);
  return { duration, notes, harmony, melody };
}

/** Extract a settled cycle, with its incoming pad/reverb tails already present.
 * A tiny additive endpoint correction removes residual numerical discontinuity.
 * It never fades the music to silence, changes duration, or overlaps rhythmic beats.
 */
export function extractLakeLoopChannel(
  rendered: Float32Array,
  startFrame: number,
  frameCount: number,
  spliceFrames = 128,
): Float32Array {
  if (!Number.isInteger(startFrame) || !Number.isInteger(frameCount) || startFrame < 0 || frameCount < 4 || startFrame + frameCount > rendered.length) {
    throw new RangeError("The rendered audio does not contain a full loop cycle.");
  }
  const result = rendered.slice(startFrame, startFrame + frameCount);
  if (!result.every(Number.isFinite)) throw new Error("The rendered loop contains invalid audio samples.");
  const width = Math.max(2, Math.min(Math.floor(frameCount / 4), Number.isFinite(spliceFrames) ? Math.floor(spliceFrames) : 128));
  const seam = (result[0] + result[frameCount - 1]) * 0.5;
  const headCorrection = seam - result[0];
  const tailCorrection = seam - result[frameCount - 1];
  for (let i = 0; i < width; i++) {
    const weight = 0.5 + 0.5 * Math.cos(Math.PI * i / (width - 1));
    result[i] += headCorrection * weight;
    result[frameCount - 1 - i] += tailCorrection * weight;
  }
  result[0] = result[frameCount - 1] = seam;
  return result;
}

/** Float32 export with a fixed optional output gain, and no encoder delay,
 * resampling, normalization, fades or sample trimming. WAVE format 3 + fact chunk.
 * Gain 1 preserves every source sample exactly; a constant gain preserves the seam.
 */
export function createLakeLoopWav(channels: readonly Float32Array[], sampleRate: number, gain = 1): Blob {
  if (channels.length !== 2 || !Number.isInteger(sampleRate) || sampleRate < 1 || sampleRate > 384000) {
    throw new RangeError("Loop WAV export requires two channels and a valid sample rate.");
  }
  if (!Number.isFinite(gain) || gain < 0 || gain > 1) {
    throw new RangeError("Loop WAV gain must be a finite value from zero to one.");
  }
  const frames = channels[0].length;
  const dataBytes = frames * 2 * 4;
  if (frames === 0 || channels[1].length !== frames || dataBytes > 0xffffffff - 50) {
    throw new RangeError("Loop WAV export requires equally sized non-empty channels.");
  }
  const bytes = new ArrayBuffer(58 + dataBytes);
  const view = new DataView(bytes);
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  text(0, "RIFF");
  view.setUint32(4, bytes.byteLength - 8, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 18, true);
  view.setUint16(20, 3, true); // IEEE float; source AudioBuffer already uses float32.
  view.setUint16(22, 2, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 8, true);
  view.setUint16(32, 8, true);
  view.setUint16(34, 32, true);
  view.setUint16(36, 0, true); // WAVEFORMATEX extension size.
  text(38, "fact");
  view.setUint32(42, 4, true);
  view.setUint32(46, frames, true);
  text(50, "data");
  view.setUint32(54, dataBytes, true);
  for (let frame = 0; frame < frames; frame++) {
    for (let channel = 0; channel < 2; channel++) {
      const sample = channels[channel][frame];
      if (!Number.isFinite(sample)) throw new Error("The prepared audio contains invalid samples.");
      view.setFloat32(58 + (frame * 2 + channel) * 4, sample * gain, true);
    }
  }
  return new Blob([bytes], { type: "audio/wav" });
}

interface SynthGraph {
  context: BaseAudioContext;
  input: GainNode;
  space: GainNode;
  breath: AudioBuffer;
  master: GainNode;
  synth: GainNode;
  nodes: AudioNode[];
  modulators: OscillatorNode[];
}

interface AudioGraph extends SynthGraph {
  context: AudioContext;
  capture: MediaStreamAudioDestinationNode;
}

interface Voice {
  sources: AudioScheduledSourceNode[];
  nodes: AudioNode[];
}

function hold(param: AudioParam, time: number): void {
  if (typeof param.cancelAndHoldAtTime === "function")
    param.cancelAndHoldAtTime(time);
  else {
    const value = param.value;
    param.cancelScheduledValues(time);
    param.setValueAtTime(value, time);
  }
}

/** Normalized raised-cosine bow envelope: zero-ended, with no struck transient. */
export function createLakeEnvelope(note: LakeNote): Float32Array {
  const curve = new Float32Array(256);
  for (let i = 0; i < curve.length; i++) {
    const t = (i / (curve.length - 1)) * note.duration;
    const attack = Math.min(1, t / note.attack);
    const release = Math.min(
      1,
      Math.max(0, (t - note.duration + note.release) / note.release),
    );
    const inhale = 0.5 - 0.5 * Math.cos(Math.PI * attack);
    const exhale = 0.5 + 0.5 * Math.cos(Math.PI * release);
    const pressure = 0.95 + 0.05 * Math.cos((t / note.duration) * Math.PI * 2);
    curve[i] = inhale * exhale * pressure;
  }
  return curve;
}

function createSynthGraph(context: BaseAudioContext): SynthGraph {
  const nodes: AudioNode[] = [];
  const modulators: OscillatorNode[] = [];
  const own = <T extends AudioNode>(node: T): T => {
    nodes.push(node);
    return node;
  };
  try {
    const input = own(context.createGain());
    const space = own(context.createGain());
    const highpass = own(context.createBiquadFilter());
    highpass.type = "highpass";
    highpass.frequency.value = 62;
    highpass.Q.value = 0.5;
    const presence = own(context.createBiquadFilter());
    presence.type = "peaking";
    presence.frequency.value = 1850;
    presence.Q.value = 0.65;
    presence.gain.value = -3.5;
    const tone = own(context.createBiquadFilter());
    tone.type = "lowpass";
    tone.frequency.value = 2700;
    tone.Q.value = 0.32;
    const compressor = own(context.createDynamicsCompressor());
    compressor.threshold.value = -19;
    compressor.knee.value = 20;
    compressor.ratio.value = 2;
    compressor.attack.value = 0.08;
    compressor.release.value = 0.65;
    const master = own(context.createGain());
    master.gain.value = 0;
    master.channelCount = 2;
    master.channelCountMode = "explicit";
    input.connect(highpass);
    highpass.connect(presence);
    presence.connect(tone);
    tone.connect(compressor);
    const synth = own(context.createGain());
    synth.gain.value = 1;
    compressor.connect(synth);
    synth.connect(master);
    master.connect(context.destination);

    // A single mono injection alternates through two filtered delay paths.
    // Each return feeds the opposite side; there is no same-side feedback loop.
    const delaySend = own(context.createGain());
    delaySend.gain.value = 0.32;
    delaySend.channelCount = 1;
    delaySend.channelCountMode = "explicit";
    const delayHighpass = own(context.createBiquadFilter());
    delayHighpass.type = "highpass";
    delayHighpass.frequency.value = 260;
    delayHighpass.Q.value = 0.5;
    const leftDelay = own(context.createDelay(1));
    leftDelay.delayTime.value = 0.48;
    const rightDelay = own(context.createDelay(1));
    rightDelay.delayTime.value = 0.57;
    const leftTone = own(context.createBiquadFilter());
    leftTone.type = "lowpass";
    leftTone.frequency.value = 1450;
    leftTone.Q.value = 0.4;
    const rightTone = own(context.createBiquadFilter());
    rightTone.type = "lowpass";
    rightTone.frequency.value = 1250;
    rightTone.Q.value = 0.4;
    const leftFeedback = own(context.createGain());
    leftFeedback.gain.value = 0.28;
    const rightFeedback = own(context.createGain());
    rightFeedback.gain.value = 0.28;
    const leftPan = own(context.createStereoPanner());
    leftPan.pan.value = -0.7;
    const rightPan = own(context.createStereoPanner());
    rightPan.pan.value = 0.7;
    space.connect(delaySend);
    delaySend.connect(delayHighpass);
    delayHighpass.connect(leftDelay);
    leftDelay.connect(leftTone);
    leftTone.connect(leftPan);
    leftPan.connect(highpass);
    leftTone.connect(leftFeedback);
    leftFeedback.connect(rightDelay);
    rightDelay.connect(rightTone);
    rightTone.connect(rightPan);
    rightPan.connect(highpass);
    rightTone.connect(rightFeedback);
    rightFeedback.connect(leftDelay);

    // Quiet early reflections establish depth before the diffuse tail.
    for (const [seconds, level, position] of [
      [0.047, 0.13, -0.5],
      [0.089, 0.08, 0.5],
    ]) {
      const tap = own(context.createDelay(0.2));
      tap.delayTime.value = seconds;
      const gain = own(context.createGain());
      gain.gain.value = level;
      const pan = own(context.createStereoPanner());
      pan.pan.value = position;
      space.connect(tap);
      tap.connect(gain);
      gain.connect(pan);
      pan.connect(highpass);
    }

    const reverbSend = own(context.createGain());
    reverbSend.gain.value = 0.85;
    const preDelay = own(context.createDelay(0.2));
    preDelay.delayTime.value = 0.034;
    const convolver = own(context.createConvolver());
    convolver.normalize = false;
    const reverbTone = own(context.createBiquadFilter());
    reverbTone.type = "lowpass";
    reverbTone.frequency.value = 1850;
    const seconds = 3.2;
    const impulse = context.createBuffer(
      2,
      Math.ceil(context.sampleRate * seconds),
      context.sampleRate,
    );
    const random = seededRandom(91027);
    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel);
      let filtered = 0;
      let energy = 0;
      for (let i = 0; i < data.length; i++) {
        const t = i / context.sampleRate;
        filtered = filtered * 0.84 + (random() * 2 - 1) * 0.16;
        data[i] = filtered * Math.exp(-t * 1.55) * (1 - Math.exp(-t * 70));
        energy += data[i] * data[i];
      }
      const scale = 0.65 / Math.sqrt(Math.max(energy, 0.000001));
      for (let i = 0; i < data.length; i++) data[i] *= scale;
    }
    convolver.buffer = impulse;
    space.connect(reverbSend);
    reverbSend.connect(preDelay);
    preDelay.connect(convolver);
    convolver.connect(reverbTone);
    reverbTone.connect(highpass);

    const breath = context.createBuffer(
      1,
      context.sampleRate * 4,
      context.sampleRate,
    );
    const air = breath.getChannelData(0);
    let soft = 0;
    for (let i = 0; i < air.length; i++) {
      soft = soft * 0.8 + (random() * 2 - 1) * 0.2;
      air[i] = soft;
    }
    return {
      context,
      input,
      space,
      breath,
      master,
      synth,
      nodes,
      modulators,
    };
  } catch (error) {
    modulators.forEach((source) => source.stop());
    nodes.forEach((node) => node.disconnect());
    throw error;
  }
}

function releaseSynthVoice(voices: Set<Voice>, voice: Voice): void {
  if (!voices.delete(voice)) return;
  voice.sources.forEach((source) => { source.onended = null; });
  voice.nodes.forEach((node) => node.disconnect());
}

function renderLakeNote(
  graph: SynthGraph,
  voices: Set<Voice>,
  note: LakeNote,
  time: number,
  line?: LakeMelodyLine,
  scoreTime = time,
  orbitSeconds = LAKE_ORBIT_SECONDS,
): void {
  const { context, input, space } = graph;
  const gain = context.createGain();
  const pan = context.createStereoPanner();
  const filter = context.createBiquadFilter();
  const send = context.createGain();
  filter.type = "lowpass";
  const cutoff =
    note.voice === "bed"
      ? note.midi < 50
        ? 560
        : 1100
      : note.voice === "wood"
        ? 1350
        : note.voice === "bass"
          ? 700
          : note.voice === "pulse"
            ? 650
            : 2200;
  filter.frequency.setValueAtTime(cutoff * 0.82, time);
  filter.frequency.linearRampToValueAtTime(cutoff, time + note.attack + 0.4);
  filter.frequency.linearRampToValueAtTime(
    cutoff * 0.78,
    time + note.duration,
  );
  filter.Q.value = 0.3;
  pan.pan.setValueCurveAtTime(
    createLakePanCurve(
      note.voice,
      scoreTime,
      note.duration,
      note.pan,
      note.midi,
      orbitSeconds,
    ),
    time,
    note.duration,
  );
  send.gain.value =
    note.voice === "bed"
      ? note.midi < 50
        ? 0
        : 0.16
      : note.voice === "wood"
        ? 0.12
        : note.voice === "bass"
          ? 0
          : note.voice === "pulse"
            ? 0.15
            : 0.38;
  gain.connect(filter);
  filter.connect(pan);
  pan.connect(input);
  pan.connect(send);
  send.connect(space);
  const end = time + note.duration;
  const peak =
    note.velocity *
    (note.voice === "bed"
      ? 0.135
      : note.voice === "pulse"
        ? 0.32
        : note.voice === "wood"
          ? 0.18
          : note.voice === "bass"
            ? 0.15
            : 0.15);
  const envelope = line
    ? createLakeLineEnvelope(line)
    : createLakeEnvelope(note);
  for (let i = 0; i < envelope.length; i++) envelope[i] *= peak;
  gain.gain.setValueCurveAtTime(envelope, time, note.duration);
  // Existing near-unison lead stays intact; bass adds centered low harmonic body.
  const partials = getLakePartials(note.voice);
  const voice: Voice = { sources: [], nodes: [gain, filter, pan, send] };
  const drift = context.createOscillator();
  drift.frequency.value = 0.14 + (note.midi % 5) * 0.017;
  const pitchDepth = context.createGain();
  pitchDepth.gain.value =
    note.voice === "bed"
      ? 1.0
      : note.voice === "wood"
        ? 0.6
        : note.voice === "bass"
          ? 0.35
          : note.voice === "pulse"
            ? 0
            : 2.2;
  const colorDepth = context.createGain();
  colorDepth.gain.value =
    note.voice === "bed"
      ? 65
      : note.voice === "wood"
        ? 30
        : note.voice === "bass"
          ? 15
          : note.voice === "pulse"
            ? 0
            : 110;
  drift.connect(pitchDepth);
  drift.connect(colorDepth);
  colorDepth.connect(filter.frequency);
  voice.nodes.push(drift, pitchDepth, colorDepth);
  for (const [ratio, weight, detune] of partials) {
    const oscillator = context.createOscillator();
    const level = context.createGain();
    oscillator.type = "sine";
    const frequency = (midi: number) => 440 * 2 ** ((midi - 69) / 12) * ratio;
    oscillator.frequency.setValueAtTime(frequency(note.midi), time);
    if (line) {
      line.points.slice(1).forEach((point, i) => {
        const previous = line.points[i];
        // Hold the previous pitch, then glide without closing the gain gate.
        oscillator.frequency.setValueAtTime(
          frequency(previous.midi),
          time + point.offset,
        );
        oscillator.frequency.exponentialRampToValueAtTime(
          frequency(point.midi),
          time + point.offset + point.glide,
        );
      });
    }
    oscillator.detune.value = detune;
    pitchDepth.connect(oscillator.detune);
    level.gain.value = weight;
    oscillator.connect(level);
    level.connect(gain);
    voice.sources.push(oscillator);
    voice.nodes.push(oscillator, level);
    oscillator.start(time);
    oscillator.stop(end + 0.025);
  }
  // Band-limited breath sits well below the pitched layer, not a hiss attack.
  if (note.voice === "glass" || note.voice === "pulse") {
    const breath = context.createBufferSource();
    breath.buffer = graph.breath;
    breath.loop = true;
    const airFilter = context.createBiquadFilter();
    airFilter.type = "bandpass";
    airFilter.frequency.value = note.voice === "pulse" ? 420 : 1250;
    airFilter.Q.value = 0.7;
    const airLevel = context.createGain();
    airLevel.gain.value = note.voice === "pulse" ? 0.8 : 0.035;
    breath.connect(airFilter);
    airFilter.connect(airLevel);
    airLevel.connect(gain);
    voice.sources.push(breath);
    voice.nodes.push(breath, airFilter, airLevel);
    breath.start(time, (note.midi % 7) * 0.31);
    breath.stop(end + 0.025);
  }
  voice.sources.push(drift);
  drift.start(time);
  drift.stop(end + 0.025);
  voices.add(voice);
  voice.sources[0].onended = () => releaseSynthVoice(voices, voice);
}

export async function renderLakeLoopBuffer(context: BaseAudioContext, duration: number): Promise<AudioBuffer> {
  const score = generateLakeLoopPhrase(duration);
  const scope = globalThis as typeof globalThis & { webkitOfflineAudioContext?: typeof OfflineAudioContext };
  const Constructor = scope.OfflineAudioContext ?? scope.webkitOfflineAudioContext;
  if (!Constructor) throw new Error("This browser cannot prepare seamless audio loops.");
  const frameCount = Math.round(duration * context.sampleRate);
  // One full pre-roll lets prior chord/reverb tails arrive at the selected cycle.
  // A third cycle ensures the selected cycle's end also has a continuing future.
  const offline = new Constructor(2, frameCount * 3 + Math.ceil(context.sampleRate * 8), context.sampleRate);
  const synth = createSynthGraph(offline);
  const offlineVoices = new Set<Voice>();
  synth.master.gain.value = 1;
  const events = createLakeSchedule(score);
  const orbit = duration / Math.round(duration / LAKE_ORBIT_SECONDS);
  try {
    for (let cycle = 0; cycle < 3; cycle++) {
      for (const event of events) {
        const time = cycle * duration + event.time;
        if (event.kind === "note") renderLakeNote(synth, offlineVoices, event.note, time, undefined, time, orbit);
        else renderLakeNote(synth, offlineVoices, { ...event.line, midi: event.line.points[0].midi, voice: "glass" }, time, event.line, time, orbit);
      }
    }
    const rendered = await offline.startRendering();
    const result = context.createBuffer(2, frameCount, context.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      result.getChannelData(channel).set(extractLakeLoopChannel(rendered.getChannelData(channel), frameCount, frameCount));
    }
    return result;
  } finally {
    for (const voice of [...offlineVoices]) {
      voice.sources.forEach((source) => { try { source.stop(); } catch { /* Already ended. */ } });
      releaseSynthVoice(offlineVoices, voice);
    }
    synth.modulators.forEach((source) => { try { source.stop(); } catch { /* Already ended. */ } });
    synth.nodes.forEach((node) => node.disconnect());
  }
}

/** Five original roles: warm harmonic bed, bowed glass motif, rounded modal
 * wood replies, low-air pulse and grounded rhythmic bass. No struck bells.
 * Master output feeds speakers and a recording stream at the same quiet level.
 */
export function createLakeMusic(): LakeMusic {
  let graph: AudioGraph | null = null;
  let volume = 0.65;
  let playing = false;
  let disposed = false;
  let generation = 0;
  let pendingStart: Promise<void> | null = null;
  let pendingPrepare: Promise<void> | null = null;
  let preparedLoop: AudioBuffer | null = null;
  let loopSource: AudioBufferSourceNode | null = null;
  let timer: ReturnType<typeof setInterval> | undefined;
  let releaseTimer: ReturnType<typeof setTimeout> | undefined;
  const voices = new Set<Voice>();
  let epoch = 0;
  let phraseIndex = 0;
  let noteIndex = 0;
  let phrase = generateLakePhrase(LAKE_MUSIC_SEED, 0);
  let events = createLakeSchedule(phrase);

  function initialize(): AudioGraph {
    if (graph) return graph;
    const scope = globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext };
    const Constructor = scope.AudioContext ?? scope.webkitAudioContext;
    if (!Constructor) throw new Error("This browser does not support synthesized audio.");
    const context = new Constructor({ latencyHint: "playback" });
    let capture: MediaStreamAudioDestinationNode | undefined;
    try {
      capture = context.createMediaStreamDestination();
      capture.channelCount = 2;
      capture.channelCountMode = "explicit";
      const synthGraph = createSynthGraph(context);
      synthGraph.master.connect(capture);
      synthGraph.nodes.push(capture);
      graph = { ...synthGraph, context, capture };
      return graph;
    } catch (error) {
      capture?.stream.getTracks().forEach((track) => track.stop());
      void context.close().catch(() => undefined);
      throw error;
    }
  }

  function releaseVoice(voice: Voice): void {
    releaseSynthVoice(voices, voice);
  }

  function playNote(note: LakeNote, time: number, line?: LakeMelodyLine): void {
    if (graph) renderLakeNote(graph, voices, note, time, line, time - epoch);
  }

  function schedule(): void {
    if (!playing || !graph || graph.context.state !== "running") return;
    const now = graph.context.currentTime;
    // Skip missed notes after a long main-thread stall instead of replaying a burst.
    if (now - epoch > (phraseIndex + 2) * LAKE_PHRASE_SECONDS) {
      phraseIndex = Math.floor((now - epoch) / LAKE_PHRASE_SECONDS);
      phrase = generateLakePhrase(LAKE_MUSIC_SEED, phraseIndex);
      events = createLakeSchedule(phrase);
      noteIndex = 0;
    }
    const horizon =
      now + (typeof document !== "undefined" && document.hidden ? 2.1 : 0.45);
    for (;;) {
      const event = events[noteIndex];
      const at = epoch + phraseIndex * LAKE_PHRASE_SECONDS + event.time;
      if (at > horizon) break;
      if (at >= now - 0.03) {
        const time = Math.max(at, now + 0.015);
        if (event.kind === "note") playNote(event.note, time);
        else {
          const line = event.line;
          playNote(
            { ...line, midi: line.points[0].midi, voice: "glass" },
            time,
            line,
          );
        }
      }
      noteIndex++;
      if (noteIndex >= events.length) {
        phraseIndex++;
        phrase = generateLakePhrase(LAKE_MUSIC_SEED, phraseIndex);
        events = createLakeSchedule(phrase);
        noteIndex = 0;
      }
    }
  }

  function onVisibility(): void {
    schedule();
  }

  function clearPlaybackNow(): void {
    playing = false;
    clearInterval(timer);
    timer = undefined;
    clearTimeout(releaseTimer);
    releaseTimer = undefined;
    if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisibility);
    if (loopSource) {
      loopSource.onended = null;
      try { loopSource.stop(); } catch { /* Already ended. */ }
      loopSource.disconnect();
      loopSource = null;
    }
    for (const voice of [...voices]) {
      voice.sources.forEach((source) => { try { source.stop(); } catch { /* Already ended. */ } });
      releaseVoice(voice);
    }
  }

  function stop(): void {
    generation++;
    pendingStart = null;
    pendingPrepare = null;
    playing = false;
    clearInterval(timer);
    timer = undefined;
    clearTimeout(releaseTimer);
    if (typeof document !== "undefined")
      document.removeEventListener("visibilitychange", onVisibility);
    if (!graph) return;
    const current = graph;
    const now = current.context.currentTime;
    hold(current.master.gain, now);
    current.master.gain.linearRampToValueAtTime(0, now + 0.42);
    if (loopSource) {
      const source = loopSource;
      source.onended = () => { source.disconnect(); if (loopSource === source) loopSource = null; };
      try { source.stop(now + 0.48); } catch { /* Already ended. */ }
    }
    for (const voice of voices) {
      voice.sources.forEach((source) => {
        try {
          source.stop(now + 0.48);
        } catch {
          /* Already ended. */
        }
      });
    }
    releaseTimer = setTimeout(() => {
      releaseTimer = undefined;
      if (playing || disposed || graph !== current) return;
      for (const voice of [...voices]) releaseVoice(voice);
      if (current.context.state === "running")
        void current.context.suspend().catch(() => undefined);
    }, 640);
  }

  return {
    get stream() {
      return graph?.capture.stream ?? null;
    },
    prepareLoop(duration) {
      if (disposed) return Promise.reject(new Error("The music synthesizer is closed."));
      try { generateLakeLoopPhrase(duration); } catch (error) { return Promise.reject(error); }
      if (pendingPrepare) return pendingPrepare;
      let current: AudioGraph;
      try { current = initialize(); } catch (error) { return Promise.reject(error); }
      // This call must occur before the first await to preserve user activation.
      const resumed = current.context.resume();
      clearPlaybackNow();
      pendingStart = null;
      const token = ++generation;
      current.synth.gain.value = 0;
      hold(current.master.gain, current.context.currentTime);
      current.master.gain.setValueAtTime(0, current.context.currentTime);
      const request = resumed.then(async () => {
        if (disposed || token !== generation) throw new Error("Music loop preparation was cancelled.");
        if (current.context.state !== "running") throw new Error("Audio could not start. Click the music button to try again.");
        if (preparedLoop && Math.abs(preparedLoop.duration - duration) < 0.000001) return;
        const buffer = await renderLakeLoopBuffer(current.context, duration);
        if (disposed || token !== generation) throw new Error("Music loop preparation was cancelled.");
        preparedLoop = buffer;
      }).finally(() => { if (pendingPrepare === request) pendingPrepare = null; });
      pendingPrepare = request;
      return request;
    },
    getLoopWav(gain = volume * 0.85) {
      if (disposed) throw new Error("The music synthesizer is closed.");
      if (!preparedLoop) throw new Error("Prepare the music loop before exporting its audio.");
      return createLakeLoopWav([preparedLoop.getChannelData(0), preparedLoop.getChannelData(1)], preparedLoop.sampleRate, gain);
    },
    playPreparedLoop() {
      if (disposed) throw new Error("The music synthesizer is closed.");
      if (!graph || !preparedLoop) throw new Error("Prepare the music loop before starting playback.");
      if (graph.context.state !== "running") throw new Error("The prepared audio is suspended. Prepare the loop again before recording.");
      clearPlaybackNow();
      generation++;
      pendingStart = null;
      pendingPrepare = null;
      const source = graph.context.createBufferSource();
      source.buffer = preparedLoop;
      source.loop = true;
      source.loopStart = 0;
      source.loopEnd = preparedLoop.duration;
      // The buffer already contains the same EQ/compression/reverb. Bypass the
      // live synth bus so its tails cannot be doubled or spill into the recording.
      graph.synth.gain.value = 0;
      source.connect(graph.master);
      hold(graph.master.gain, graph.context.currentTime);
      graph.master.gain.setValueAtTime(volume * 0.85, graph.context.currentTime);
      loopSource = source;
      playing = true;
      source.start(graph.context.currentTime);
    },
    start() {
      if (disposed)
        return Promise.reject(new Error("The music synthesizer is closed."));
      if (playing) return Promise.resolve();
      if (pendingStart) return pendingStart;
      let current: AudioGraph;
      try {
        current = initialize();
      } catch (error) {
        return Promise.reject(error);
      }
      clearTimeout(releaseTimer);
      releaseTimer = undefined;
      const token = ++generation;
      // Call resume synchronously within the user gesture, before awaiting it.
      const request = current.context
        .resume()
        .then(() => {
          if (disposed || token !== generation) return;
          if (current.context.state !== "running")
            throw new Error(
              "Audio could not start. Click the music button to try again.",
            );
          clearPlaybackNow();
          current.synth.gain.value = 1;
          playing = true;
          epoch = current.context.currentTime + 0.1;
          phraseIndex = noteIndex = 0;
          phrase = generateLakePhrase(LAKE_MUSIC_SEED, 0);
          events = createLakeSchedule(phrase);
          hold(current.master.gain, current.context.currentTime);
          current.master.gain.linearRampToValueAtTime(
            volume * 0.85,
            current.context.currentTime + 0.8,
          );
          schedule();
          timer = setInterval(schedule, 50);
          if (typeof document !== "undefined")
            document.addEventListener("visibilitychange", onVisibility);
        })
        .finally(() => {
          if (pendingStart === request) pendingStart = null;
        });
      pendingStart = request;
      return request;
    },
    stop,
    setVolume(value, rampSeconds = 0.18) {
      volume = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
      const ramp = Number.isFinite(rampSeconds)
        ? Math.min(5, Math.max(0, rampSeconds))
        : 0.18;
      if (graph) {
        const now = graph.context.currentTime;
        hold(graph.master.gain, now);
        graph.master.gain.linearRampToValueAtTime(
          playing ? volume * 0.85 : 0,
          now + ramp,
        );
      }
    },
    dispose() {
      if (disposed) return;
      clearPlaybackNow();
      preparedLoop = null;
      pendingPrepare = null;
      disposed = true;
      generation++;
      pendingStart = null;
      playing = false;
      clearInterval(timer);
      clearTimeout(releaseTimer);
      if (typeof document !== "undefined")
        document.removeEventListener("visibilitychange", onVisibility);
      for (const voice of [...voices]) {
        voice.sources.forEach((source) => {
          try {
            source.stop();
          } catch {
            /* Already ended. */
          }
        });
        releaseVoice(voice);
      }
      if (graph) {
        graph.modulators.forEach((source) => source.stop());
        graph.capture.stream.getTracks().forEach((track) => track.stop());
        graph.nodes.forEach((node) => node.disconnect());
        void graph.context.close().catch(() => undefined);
        graph = null;
      }
    },
  };
}
