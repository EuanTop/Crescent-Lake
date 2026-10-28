export type LakeVoice = "bed" | "glass" | "wood" | "pulse";

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

interface AudioGraph {
  context: AudioContext;
  input: GainNode;
  space: GainNode;
  breath: AudioBuffer;
  master: GainNode;
  capture: MediaStreamAudioDestinationNode;
  nodes: AudioNode[];
  modulators: OscillatorNode[];
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

/** Four original roles: warm harmonic bed, bowed glass motif, rounded modal
 * wood replies and almost subliminal low-air pulse. No piano or sharp shakers.
 * Master output feeds speakers and a recording stream at the same quiet level.
 */
export function createLakeMusic(): LakeMusic {
  let graph: AudioGraph | null = null;
  let volume = 0.65;
  let playing = false;
  let disposed = false;
  let generation = 0;
  let pendingStart: Promise<void> | null = null;
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
    const scope = globalThis as typeof globalThis & {
      webkitAudioContext?: typeof AudioContext;
    };
    const Constructor = scope.AudioContext ?? scope.webkitAudioContext;
    if (!Constructor)
      throw new Error("This browser does not support synthesized audio.");
    const context = new Constructor({ latencyHint: "playback" });
    const nodes: AudioNode[] = [];
    const modulators: OscillatorNode[] = [];
    const own = <T extends AudioNode>(node: T): T => {
      nodes.push(node);
      return node;
    };
    let capture: MediaStreamAudioDestinationNode | undefined;
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
      capture = own(context.createMediaStreamDestination());
      input.connect(highpass);
      highpass.connect(presence);
      presence.connect(tone);
      tone.connect(compressor);
      compressor.connect(master);
      master.connect(context.destination);
      master.connect(capture);

      const delaySend = own(context.createGain());
      delaySend.gain.value = 0.3;
      const delay = own(context.createDelay(2));
      delay.delayTime.value = 0.83;
      const delayTone = own(context.createBiquadFilter());
      delayTone.type = "lowpass";
      delayTone.frequency.value = 1450;
      const feedback = own(context.createGain());
      feedback.gain.value = 0.17;
      const echoPan = own(context.createStereoPanner());
      echoPan.pan.value = -0.3;
      space.connect(delaySend);
      delaySend.connect(delay);
      delay.connect(delayTone);
      delayTone.connect(feedback);
      feedback.connect(delay);
      delayTone.connect(echoPan);
      echoPan.connect(highpass);
      const drift = own(context.createOscillator());
      const driftDepth = own(context.createGain());
      drift.frequency.value = 0.021;
      driftDepth.gain.value = 0.004;
      drift.connect(driftDepth);
      driftDepth.connect(delay.delayTime);
      drift.start();
      modulators.push(drift);

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
      graph = {
        context,
        input,
        space,
        breath,
        master,
        capture,
        nodes,
        modulators,
      };
      return graph;
    } catch (error) {
      modulators.forEach((source) => source.stop());
      nodes.forEach((node) => node.disconnect());
      capture?.stream.getTracks().forEach((track) => track.stop());
      void context.close().catch(() => undefined);
      throw error;
    }
  }

  function releaseVoice(voice: Voice): void {
    if (!voices.delete(voice)) return;
    voice.sources.forEach((source) => {
      source.onended = null;
    });
    voice.nodes.forEach((node) => node.disconnect());
  }

  function playNote(note: LakeNote, time: number, line?: LakeMelodyLine): void {
    if (!graph) return;
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
    pan.pan.value = note.pan;
    send.gain.value =
      note.voice === "bed"
        ? 0.16
        : note.voice === "wood"
          ? 0.12
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
            : 0.15);
    const envelope = line
      ? createLakeLineEnvelope(line)
      : createLakeEnvelope(note);
    for (let i = 0; i < envelope.length; i++) envelope[i] *= peak;
    gain.gain.setValueCurveAtTime(envelope, time, note.duration);
    // Near-unison fundamentals carry the bed and lead. Wood gets only faint,
    // damped modal color in a lower register; the old bright bell is absent.
    const partials =
      note.voice === "pulse"
        ? [[1, 0.18, 0]]
        : note.voice === "wood"
          ? [
              [1, 0.84, 0],
              [2.46, 0.075, 0],
              [3.74, 0.012, 0],
            ]
          : [
              [1, 0.48, -1.7],
              [1, 0.48, 1.7],
              [2, note.voice === "glass" ? 0.04 : 0.02, 0],
            ];
    const voice: Voice = { sources: [], nodes: [gain, filter, pan, send] };
    const drift = context.createOscillator();
    drift.frequency.value = 0.14 + (note.midi % 5) * 0.017;
    const pitchDepth = context.createGain();
    pitchDepth.gain.value =
      note.voice === "bed"
        ? 1.0
        : note.voice === "wood"
          ? 0.6
          : note.voice === "pulse"
            ? 0
            : 2.2;
    const colorDepth = context.createGain();
    colorDepth.gain.value =
      note.voice === "bed"
        ? 65
        : note.voice === "wood"
          ? 30
          : note.voice === "pulse"
            ? 0
            : 110;
    const widthDepth = context.createGain();
    widthDepth.gain.value =
      note.voice === "wood" ? 0.02 : note.voice === "pulse" ? 0 : 0.055;
    drift.connect(pitchDepth);
    drift.connect(colorDepth);
    colorDepth.connect(filter.frequency);
    drift.connect(widthDepth);
    widthDepth.connect(pan.pan);
    voice.nodes.push(drift, pitchDepth, colorDepth, widthDepth);
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
    voice.sources[0].onended = () => releaseVoice(voice);
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

  function stop(): void {
    generation++;
    pendingStart = null;
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
