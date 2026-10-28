import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createLakeEnvelope,
  createLakeLoopWav,
  generateLakeLoopPhrase,
  extractLakeLoopChannel,
  LAKE_LOOP_SECONDS,
  createLakePanCurve,
  getLakePan,
  getLakePartials,
  LAKE_ORBIT_SECONDS,
  createLakeLineEnvelope,
  createLakeSchedule,
  generateLakeMelodyLines,
  createLakeMusic,
  generateLakePhrase,
  LAKE_MUSIC_SEED,
  LAKE_PHRASE_SECONDS,
  LAKE_EIGHTH_SECONDS,
  LAKE_PULSE_BPM,
} from "../src/scene/music.ts";

test("the 48-second arrangement preserves a composed motif while varying expression", () => {
  const first = generateLakePhrase(LAKE_MUSIC_SEED, 0);
  assert.equal(LAKE_PHRASE_SECONDS, 48);
  assert.deepEqual(first, generateLakePhrase(LAKE_MUSIC_SEED, 0));
  assert.notDeepEqual(first, generateLakePhrase(LAKE_MUSIC_SEED + 1, 0));
  assert.deepEqual(first, generateLakePhrase(NaN, Infinity));
  const performances = new Set<string>();
  for (let i = 0; i < 16; i++) {
    const score = generateLakePhrase(LAKE_MUSIC_SEED, i);
    const lead = score.melody.flatMap((line) => line.points);
    assert.deepEqual(
      lead.slice(0, 3).map((note) => note.midi),
      [72, 76, 74],
    );
    assert.deepEqual(
      lead.slice(-4).map((note) => note.midi),
      [72, 76, 74, 72],
    );
    performances.add(JSON.stringify(lead));
  }
  assert.equal(
    performances.size,
    16,
    "expression varies while motif identity survives",
  );
});

test("extended harmonies have audible sevenths/ninths and smooth upper voice-leading, including the loop seam", () => {
  const { harmony, notes } = generateLakePhrase(74291, 0);
  assert.deepEqual(
    harmony.map((chord) => chord.name),
    ["Fmaj9", "Am9", "G6/9", "Cmaj9"],
  );
  harmony.forEach((chord, i) => {
    const intervals = new Set(
      chord.upper.map((midi) => (midi - chord.bass + 120) % 12),
    );
    assert.ok(intervals.has(2), "each voiced harmony includes its ninth");
    assert.ok(
      intervals.has(i === 1 ? 10 : i === 2 ? 9 : 11),
      "retain the seventh or sixth color",
    );
    const next = harmony[(i + 1) % harmony.length];
    chord.upper.forEach((midi, voice) =>
      assert.ok(Math.abs(midi - next.upper[voice]) <= 3),
    );
    const nextTime = harmony[i + 1]?.time ?? 48;
    const bed = notes.filter(
      (note) =>
        note.voice === "bed" && note.time >= chord.time && note.time < nextTime,
    );
    assert.equal(bed.length, 6, "five upper voices plus one quiet bass");
    assert.ok(bed.every((note) => note.time + note.duration > nextTime + 3));
  });
});

test("a short clip contains a connected question, breathing space, answer and early harmony", () => {
  const score = generateLakePhrase(74291, 0);
  const [question, answer] = score.melody;
  assert.deepEqual(
    question.points.map((point) => point.midi),
    [72, 76, 74],
  );
  assert.deepEqual(
    answer.points.map((point) => point.midi),
    [69, 72, 71],
  );
  assert.ok(question.time > 0.6 && question.time < 0.9);
  assert.ok(question.time + question.duration < 7);
  assert.ok(answer.time - question.time - question.duration > 1.4);
  assert.ok(answer.time > 8 && answer.time < 8.5);
  assert.ok(answer.time + answer.points[1].offset < 11);
  assert.equal(score.harmony[1].time, 7);
  assert.equal(
    score.notes.filter((note) => note.voice === "wood" && note.time < 15)
      .length,
    3,
  );
  assert.ok(
    score.notes
      .filter((note) => note.voice === "wood")
      .every((note) => note.velocity < 0.15),
  );
});

test("the monophonic lead uses one sustained envelope per sentence and stays open across every pitch glide", () => {
  for (let index = 0; index < 16; index++) {
    const score = generateLakePhrase(74291, index);
    assert.deepEqual(score.melody, generateLakeMelodyLines(74291, index));
    assert.equal(
      score.notes.some((note) => note.voice === "glass"),
      false,
      "the score must not retain per-note lead triggers",
    );
    score.melody.forEach((line, i) => {
      assert.equal(line.points[0].offset, 0);
      assert.equal(line.points[0].glide, 0);
      assert.ok(line.attack >= 0.3 && line.release >= 1);
      const curve = createLakeLineEnvelope(line);
      assert.equal(curve[0], 0);
      assert.equal(curve.at(-1), 0);
      assert.ok(
        Array.from(curve).every(
          (value) => Number.isFinite(value) && value >= 0 && value <= 1,
        ),
      );
      if (i > 0)
        assert.ok(
          line.time > score.melody[i - 1].time + score.melody[i - 1].duration,
          "separate sentences, without simultaneous duplicated lead banks",
        );
      line.points.slice(1).forEach((point, j) => {
        assert.ok(point.offset > line.points[j].offset);
        assert.ok(point.glide >= 0.12 && point.glide <= 0.25);
        assert.ok(point.offset + point.glide < line.duration - line.release);
        for (const t of [
          point.offset - 0.1,
          point.offset,
          point.offset + point.glide,
          point.offset + point.glide + 0.1,
        ]) {
          assert.ok(
            curve[Math.round((t / line.duration) * (curve.length - 1))] >= 0.89,
            "pitch transitions must not contain a re-attack or an amplitude dip",
          );
        }
      });
    });
  }
});

test("the runtime schedule emits a whole melody line once, including across a lookahead window", () => {
  const score = generateLakePhrase(74291, 0);
  const events = createLakeSchedule(score);
  const leadEvents = events.filter((event) => event.kind === "line");
  assert.equal(leadEvents.length, 4);
  assert.equal(events.length, score.notes.length + score.melody.length);
  assert.ok(
    events.every((event, i) => i === 0 || event.time >= events[i - 1].time),
  );
  assert.deepEqual(
    leadEvents.map((event) => event.line),
    score.melody,
  );
  const scheduled = [];
  let cursor = 0;
  for (let now = 0; now < 49; now += 0.05) {
    while (cursor < events.length && events[cursor].time <= now + 0.45)
      scheduled.push(events[cursor++]);
  }
  assert.deepEqual(
    scheduled,
    events,
    "lookahead visits every sentence exactly once, not once per pitch",
  );
  const first = leadEvents[0];
  assert.equal(first.kind, "line");
  assert.ok(first.line.points.length > 1);
});

test("each instrument has a rounded onset, with sustained lead and softer modal answers", () => {
  const notes = generateLakePhrase(74291, 0).notes;
  for (const note of notes) {
    const curve = createLakeEnvelope(note);
    assert.equal(curve[0], 0);
    assert.equal(curve.at(-1), 0);
    assert.ok(
      Array.from(curve).every(
        (value) => Number.isFinite(value) && value >= 0 && value <= 1,
      ),
    );
    const at35ms = Math.ceil((0.035 / note.duration) * (curve.length - 1));
    assert.ok(
      curve[at35ms] <
        (note.voice === "bass"
          ? 0.8
          : ["wood", "pulse"].includes(note.voice)
            ? 0.4
            : 0.09),
      "35ms must not contain a struck-note peak",
    );
    assert.ok(
      curve[1] < curve[4] / 8,
      "raised-cosine onset has a near-zero initial slope",
    );
    if (note.voice === "glass") {
      assert.ok(note.release >= 1.3);
      assert.ok(note.attack >= 0.2 && note.attack <= 0.4);
      const afterAttack = Math.ceil(
        ((note.attack + 0.25) / note.duration) * (curve.length - 1),
      );
      assert.ok(
        curve[afterAttack] > 0.8,
        "the bowed tone should sustain rather than immediately decay",
      );
    } else if (note.voice === "wood") {
      assert.ok(note.attack >= 0.08 && note.attack <= 0.16);
      assert.ok(note.release >= 0.8);
    } else if (note.voice === "pulse") {
      assert.ok(note.attack >= 0.1 && note.release >= 0.3);
    }
  }
});

test("long generative playback stays in a warm register with bounded duration, width and dynamics", () => {
  for (const index of [
    ...Array.from({ length: 128 }, (_, i) => i),
    1_000_000,
  ]) {
    const score = generateLakePhrase(91027, index);
    let previous = -Infinity;
    for (const note of score.notes) {
      assert.ok(
        [
          note.time,
          note.duration,
          note.midi,
          note.velocity,
          note.pan,
          note.attack,
          note.release,
        ].every(Number.isFinite),
      );
      assert.ok(
        note.time >= previous && note.time >= 0 && note.time < score.duration,
      );
      assert.ok(
        Number.isInteger(note.midi) && note.midi >= 41 && note.midi <= 76,
      );
      assert.ok(note.velocity > 0 && note.velocity < 0.52);
      assert.ok(Math.abs(note.pan) <= 0.35);
      assert.ok(note.attack + note.release < note.duration);
      assert.ok(note.duration <= 18);
      assert.ok(["bed", "glass", "wood", "pulse", "bass"].includes(note.voice));
      previous = note.time;
    }
  }
});

test("five instrumental roles enter within four seconds with wood behind a distinct sustained lead", () => {
  const score = generateLakePhrase(74291, 0);
  const first = (voice: string) =>
    score.notes.find((note) => note.voice === voice)!;
  assert.deepEqual([...new Set(score.notes.map((note) => note.voice))].sort(), [
    "bass",
    "bed",
    "pulse",
    "wood",
  ]);
  assert.equal(first("bed").time, 0);
  assert.ok(score.melody[0].time > 0.6 && score.melody[0].time < 0.9);
  assert.ok(first("wood").time > 2 && first("wood").time < 2.5);
  assert.ok(first("pulse").time > 3.3 && first("pulse").time < 4);
  assert.ok(first("bass").time > 1.7 && first("bass").time < 2);
  const wood = score.notes.filter((note) => note.voice === "wood");
  const pitches = score.melody.flatMap((line) =>
    line.points.map((point) => point.midi),
  );
  assert.ok(Math.max(...wood.map((note) => note.midi)) < Math.min(...pitches));
  assert.equal(
    wood.length,
    6,
    "fewer wood interruptions leave the sustained harmony in front",
  );
});

test("the quiet 6/8 pulse includes syncopation and complete rests instead of metronome ticks", () => {
  assert.ok(LAKE_PULSE_BPM >= 66 && LAKE_PULSE_BPM <= 74);
  for (let index = 0; index < 16; index++) {
    const pulse = generateLakePhrase(74291, index).notes.filter(
      (note) => note.voice === "pulse",
    );
    const bars = new Set<number>();
    const positions = new Set<number>();
    for (const note of pulse) {
      const step = Math.round(note.time / LAKE_EIGHTH_SECONDS);
      assert.ok(Math.abs(note.time - step * LAKE_EIGHTH_SECONDS) < 0.012);
      bars.add(Math.floor(step / 6));
      positions.add(step % 6);
      assert.ok(note.velocity < 0.14 && note.midi <= 48 && note.duration < 0.7);
    }
    assert.ok(
      positions.has(0) && positions.has(3),
      "retain a lilting two-beat frame",
    );
    assert.ok(
      positions.has(4) || positions.has(5),
      "include soft off-beat pickups",
    );
    assert.ok(
      !bars.has(4) && !bars.has(10) && !bars.has(11),
      "leave entire bars empty",
    );
    assert.ok(pulse.length > 12 && pulse.length < 36);
  }
});

test("the lead completes a bounded left–right–left orbit while wood answers from the opposite side", () => {
  assert.ok(LAKE_ORBIT_SECONDS >= 8 && LAKE_ORBIT_SECONDS <= 10);
  assert.equal(getLakePan("glass", 0.75), -0.66);
  assert.ok(
    Math.abs(getLakePan("glass", 0.75 + LAKE_ORBIT_SECONDS / 2) - 0.66) < 1e-12,
  );
  assert.ok(
    Math.abs(getLakePan("glass", 0.75 + LAKE_ORBIT_SECONDS) + 0.66) < 1e-12,
  );
  for (let time = 0; time <= 96; time += 0.031) {
    const lead = getLakePan("glass", time);
    const wood = getLakePan("wood", time);
    assert.ok(Math.abs(lead) <= 0.66 && Math.abs(wood) <= 0.56);
    assert.ok(
      lead * wood <= 1e-12,
      "the answering voice occupies the other side",
    );
    assert.ok(
      Math.abs(lead - getLakePan("glass", time + LAKE_ORBIT_SECONDS)) < 1e-12,
    );
    const angle = ((lead + 1) * Math.PI) / 4;
    const left = Math.cos(angle);
    const right = Math.sin(angle);
    assert.ok(left > 0 && right > 0, "no phase inversion or muted ear");
    assert.ok(Math.abs(left * left + right * right - 1) < 1e-12);
    assert.ok((left + right) / 2 >= 0.6, "mono summation retains the melody");
  }
});

test("pan automation follows the shared playback clock across sentences and keeps bass stable", () => {
  const { melody, notes } = generateLakePhrase(74291, 0);
  for (const line of melody) {
    const curve = createLakePanCurve(
      "glass",
      line.time,
      line.duration,
      line.pan,
    );
    assert.ok(Math.abs(curve[0] - getLakePan("glass", line.time)) < 1e-6);
    assert.ok(
      Math.abs(curve.at(-1)! - getLakePan("glass", line.time + line.duration)) <
        1e-6,
    );
    assert.ok(
      new Set(curve).size > 100,
      "the continuous line must actually move between ears",
    );
    assert.ok(Array.from(curve).every((value) => Math.abs(value) <= 0.660001));
    assert.ok(
      Array.from(curve.slice(1)).every(
        (value, i) => Math.abs(value - curve[i]) < 0.017,
      ),
    );
  }
  for (const note of notes.filter((note) => note.voice === "bed")) {
    const curve = createLakePanCurve(
      "bed",
      note.time,
      note.duration,
      note.pan,
      note.midi,
    );
    assert.ok(
      Array.from(curve).every(
        (value) => Math.abs(value - (note.midi < 50 ? 0 : note.pan)) < 1e-6,
      ),
    );
  }
  assert.equal(getLakePan("pulse", 4, 0.3, 41), 0);
  assert.ok(
    Array.from(createLakePanCurve("glass", NaN, Infinity)).every(
      Number.isFinite,
    ),
  );
});

test("rhythmic bass follows the 6/8 grid, harmonic roots/fifths and complete-bar rests", () => {
  for (let index = 0; index < 16; index++) {
    const score = generateLakePhrase(74291, index);
    const bass = score.notes.filter((note) => note.voice === "bass");
    assert.ok(bass[0].time >= 1.7 && bass[0].time <= 2);
    assert.equal(bass.filter((note) => note.time < 15).length, 8);
    assert.ok(bass.length < 32, "leave room around the long melody");
    const bars = new Set<number>();
    const positions = new Set<number>();
    bass.forEach((note) => {
      const step = Math.round(note.time / LAKE_EIGHTH_SECONDS);
      assert.ok(
        Math.abs(note.time - step * LAKE_EIGHTH_SECONDS) < 1e-10,
        "bass timing must lock to the score rather than free-running ornaments",
      );
      bars.add(Math.floor(step / 6));
      positions.add(step % 6);
      assert.ok(step % 6 === 0 || step % 6 === 3);
      assert.ok(note.midi >= 41 && note.midi <= 55);
      const harmony = [...score.harmony]
        .reverse()
        .find((chord) => chord.time <= note.time)!;
      assert.equal(note.midi, harmony.bass + (step % 6 === 3 ? 7 : 0));
      assert.ok(note.velocity >= 0.29 && note.velocity < 0.36);
      if (step % 6 === 0) assert.ok(note.velocity >= 0.34);
      else
        assert.ok(
          note.velocity < 0.31,
          "the secondary group stays lighter than the downbeat",
        );
      assert.equal(note.pan, 0);
      assert.ok(note.duration >= 0.7 && note.duration <= 1.2);
      assert.ok(note.attack >= 0.04 && note.attack <= 0.07);
      assert.ok(note.release >= 0.35 && note.release < 0.4);
      assert.ok(
        note.velocity < Math.min(...score.melody.map((line) => line.velocity)),
      );
    });
    assert.deepEqual([...positions].sort(), [0, 3]);
    assert.ok(
      !bars.has(4) && !bars.has(8) && !bars.has(12),
      "held roots alternate with real rests",
    );
    assert.ok(
      bass.some((note) => note.duration > 1),
      "retain longer root gestures",
    );
  }
});

test("bass has a soft centered low body with phone-audible harmonics instead of high sparkle or noise", () => {
  const partials = getLakePartials("bass");
  assert.deepEqual(
    partials.map(([ratio]) => ratio),
    [1, 2, 3],
  );
  assert.ok(partials[0][1] > partials[1][1] && partials[1][1] > partials[2][1]);
  assert.ok(
    partials[1][1] + partials[2][1] > 0.35,
    "middle harmonics give small speakers audible bass body",
  );
  assert.ok(partials.every(([, weight, detune]) => weight > 0 && detune === 0));
  assert.ok(partials.reduce((sum, [, weight]) => sum + weight, 0) < 1);
  const bass = generateLakePhrase(74291, 0).notes.filter(
    (note) => note.voice === "bass",
  );
  for (const note of bass) {
    const curve = createLakeEnvelope(note);
    assert.equal(curve[0], 0);
    assert.equal(curve.at(-1), 0);
    assert.ok(
      Array.from(curve).every(
        (value) => Number.isFinite(value) && value >= 0 && value <= 1,
      ),
    );
    assert.ok(curve[1] < 0.02, "rounded attack starts without a hard click");
    assert.ok(
      Math.max(...curve) > 0.95,
      "retain a solid body after the rounded onset",
    );
    assert.ok(
      Array.from(
        createLakePanCurve("bass", note.time, note.duration, 0.7, note.midi),
      ).every((pan) => pan === 0),
      "rhythmic bass must remain centered even when its fifth enters the upper register",
    );
  }
  assert.deepEqual(getLakePartials("glass"), [
    [1, 0.48, -1.7],
    [1, 0.48, 1.7],
    [2, 0.04, 0],
  ]);
});

test("the short loop is fourteen unhurried 6/8 bars with the complete harmonic arc and a legato resolution", () => {
  const score = generateLakeLoopPhrase(24);
  const original = generateLakePhrase(74291, 0);
  assert.equal(LAKE_LOOP_SECONDS, 24);
  assert.equal(score.duration, 24);
  assert.deepEqual(score.melody.slice(0, 2), original.melody.slice(0, 2));
  assert.deepEqual(score.harmony.map((chord) => chord.name), ["Fmaj9", "Am9", "G6/9", "Cmaj9"]);
  score.harmony.forEach((chord, i) => {
    assert.equal(chord.time, [0, 4, 8, 12][i] * 6 * LAKE_EIGHTH_SECONDS);
    const next = score.harmony[(i + 1) % 4];
    chord.upper.forEach((pitch, voice) => assert.ok(Math.abs(pitch - next.upper[voice]) <= 3));
  });
  assert.deepEqual(score.melody.at(-1)!.points.map((point) => point.midi), [71, 74, 72]);
  assert.ok(score.melody.at(-1)!.time >= 18 && score.melody.at(-1)!.time + score.melody.at(-1)!.duration < 24);
  assert.ok(score.notes.some((note) => note.voice === "bed" && note.time + note.duration > 27),
    "the final harmony continues into the following cycle instead of being cut off");
  score.notes.forEach((note) => {
    assert.ok(note.time >= 0 && note.time < 24);
    if (note.voice === "bass") {
      const step = Math.round(note.time / LAKE_EIGHTH_SECONDS);
      assert.ok(Math.abs(note.time - step * LAKE_EIGHTH_SECONDS) < 1e-10);
      const chord = [...score.harmony].reverse().find((chord) => chord.time <= note.time)!;
      assert.equal(note.midi, chord.bass + (step % 6 === 3 ? 7 : 0));
      assert.equal(getLakePan("bass", note.time, 0.5, note.midi, 8), 0);
    }
  });
  for (const voice of ["glass", "wood"] as const) {
    for (let time = 0; time <= 24; time += 0.15) {
      assert.ok(Math.abs(getLakePan(voice, time, 0, 60, 8) - getLakePan(voice, time + 24, 0, 60, 8)) < 1e-12);
    }
  }
  assert.throws(() => generateLakeLoopPhrase(17), /24 seconds/);
  assert.throws(() => generateLakeLoopPhrase(NaN), /24 seconds/);
});

test("settled-cycle extraction preserves incoming sound and stereo differences without an endpoint fade", () => {
  const frames = 12000;
  const left = new Float32Array(frames * 3);
  const right = new Float32Array(frames * 3);
  for (let i = 0; i < left.length; i++) {
    left[i] = 0.2 + 0.03 * Math.sin(2 * Math.PI * i * 61 / frames);
    right[i] = 0.15 + 0.025 * Math.cos(2 * Math.PI * i * 61 / frames + 0.3);
  }
  const result = extractLakeLoopChannel(left, frames, frames);
  const second = extractLakeLoopChannel(right, frames, frames);
  assert.equal(result.length, frames);
  assert.equal(result[0], result.at(-1));
  assert.equal(second[0], second.at(-1));
  assert.ok(result[0] > 0.19 && second[0] > 0.16, "head and tail retain actual signal, not zero-gain ends");
  assert.notDeepEqual(result, second);
  assert.deepEqual(result.slice(128, -128), left.slice(frames + 128, frames * 2 - 128));
  const correctionBound = Math.abs(left[frames] - left[frames * 2 - 1]) / 2 + 1e-7;
  assert.ok(result.every((value, i) => Number.isFinite(value) && Math.abs(value - left[frames + i]) <= correctionBound));
  const headSlope = result[1] - result[0];
  const tailSlope = result.at(-1)! - result.at(-2)!;
  assert.ok(Math.abs(headSlope - tailSlope) < 0.00001, "a periodic source retains its adjacent slopes");
  assert.throws(() => extractLakeLoopChannel(left, frames * 3, frames), /full loop/);
  assert.throws(() => extractLakeLoopChannel(new Float32Array([0, NaN, 0, 0]), 0, 4), /invalid audio/);
});

test("WAV export preserves every float32 stereo sample and exact frame count without encoder priming", async () => {
  const channels = [new Float32Array([0.125, -0.25, 0.125]), new Float32Array([-0.375, 0.5, -0.375])];
  const wav = createLakeLoopWav(channels, 48000);
  assert.equal(wav.type, "audio/wav");
  const bytes = await wav.arrayBuffer();
  const view = new DataView(bytes);
  const text = (offset: number, length: number) => String.fromCharCode(...new Uint8Array(bytes, offset, length));
  assert.equal(text(0, 4), "RIFF");
  assert.equal(text(8, 4), "WAVE");
  assert.equal(view.getUint32(4, true), bytes.byteLength - 8);
  assert.equal(view.getUint16(20, true), 3);
  assert.equal(view.getUint16(22, true), 2);
  assert.equal(view.getUint32(24, true), 48000);
  assert.equal(view.getUint32(28, true), 48000 * 8);
  assert.equal(view.getUint16(32, true), 8);
  assert.equal(view.getUint16(34, true), 32);
  assert.equal(text(38, 4), "fact");
  assert.equal(view.getUint32(46, true), 3);
  assert.equal(text(50, 4), "data");
  assert.equal(view.getUint32(54, true), 24);
  assert.equal(bytes.byteLength, 58 + 3 * 2 * 4);
  channels.forEach((channel, index) => {
    channel.forEach((sample, frame) => assert.equal(view.getFloat32(58 + (frame * 2 + index) * 4, true), sample));
    assert.equal(view.getFloat32(58 + index * 4, true), view.getFloat32(58 + ((channel.length - 1) * 2 + index) * 4, true));
  });
  const quieter = new DataView(await createLakeLoopWav(channels, 48000, 0.5).arrayBuffer());
  assert.equal(quieter.getFloat32(58, true), channels[0][0] * 0.5);
  assert.equal(quieter.getFloat32(58, true), quieter.getFloat32(74, true));
  assert.throws(() => createLakeLoopWav(channels, 48000, NaN), /gain/);
  assert.throws(() => createLakeLoopWav(channels, 48000, -1), /gain/);
  assert.throws(() => createLakeLoopWav([channels[0]], 48000), /two channels/);
  assert.throws(() => createLakeLoopWav(channels, NaN), /sample rate/);
  assert.throws(() => createLakeLoopWav([channels[0], new Float32Array(1)], 48000), /equally sized/);
  assert.throws(() => createLakeLoopWav([new Float32Array([NaN]), new Float32Array([0])], 48000), /invalid samples/);
});

test("creating, configuring and disposing remains lazy, including export fade parameters", async () => {
  const music = createLakeMusic();
  assert.equal(music.stream, null);
  music.setVolume(0.3);
  music.setVolume(0, 2.5);
  music.setVolume(NaN, Infinity);
  music.stop();
  assert.equal(music.stream, null);
  music.dispose();
  music.dispose();
  await assert.rejects(music.start(), /synthesizer is closed/);
  await assert.rejects(music.prepareLoop(24), /synthesizer is closed/);
  assert.throws(() => music.playPreparedLoop(), /synthesizer is closed/);
  assert.throws(() => music.getLoopWav(), /synthesizer is closed/);
});

test("loop preparation is silent, unlocks on the gesture, and starts a reusable stereo buffer synchronously", async (t) => {
  class Parameter {
    value = 0;
    setValueAtTime(value: number) { this.value = value; }
    linearRampToValueAtTime(value: number) { this.value = value; }
    exponentialRampToValueAtTime(value: number) { this.value = value; }
    setValueCurveAtTime() {}
    cancelAndHoldAtTime() {}
    cancelScheduledValues() {}
  }
  class Node {
    gain = new Parameter(); frequency = new Parameter(); detune = new Parameter();
    Q = new Parameter(); threshold = new Parameter(); knee = new Parameter();
    ratio = new Parameter(); attack = new Parameter(); release = new Parameter();
    pan = new Parameter(); delayTime = new Parameter();
    started = false; stopped = false; disconnected = false;
    loop = false; loopStart = 0; loopEnd = 0;
    buffer: Buffer | null = null;
    onended: (() => void) | null = null;
    connect() {}
    disconnect() { this.disconnected = true; }
    start() { this.started = true; }
    stop() { this.stopped = true; }
  }
  class Buffer {
    channels: Float32Array[];
    duration: number;
    sampleRate: number;
    constructor(count: number, length: number, sampleRate: number) {
      this.sampleRate = sampleRate;
      this.duration = length / sampleRate;
      this.channels = Array.from({ length: count }, () => new Float32Array(length));
    }
    getChannelData(channel: number) { return this.channels[channel]; }
  }
  class Base {
    sampleRate = 1000;
    currentTime = 3;
    state = "running";
    destination = new Node();
    sources: Node[] = [];
    nodes: Node[] = [];
    createGain() { const node = new Node(); this.nodes.push(node); return node; }
    createBiquadFilter() { return this.createGain(); }
    createDynamicsCompressor() { return this.createGain(); }
    createDelay() { return this.createGain(); }
    createStereoPanner() { return this.createGain(); }
    createConvolver() { return this.createGain(); }
    createOscillator() { const node = this.createGain(); this.sources.push(node); return node; }
    createBufferSource() { return this.createOscillator(); }
    createBuffer(count: number, length: number, sampleRate: number) { return new Buffer(count, length, sampleRate); }
  }
  class Live extends Base {
    static last: Live;
    resumeCalls = 0;
    track = { stopped: false, stop() { this.stopped = true; } };
    capture = Object.assign(new Node(), { stream: { getTracks: () => [this.track] } });
    constructor() { super(); Live.last = this; }
    createMediaStreamDestination() { return this.capture; }
    resume() { this.resumeCalls++; this.state = "running"; return Promise.resolve(); }
    suspend() { this.state = "suspended"; return Promise.resolve(); }
    close() { this.state = "closed"; return Promise.resolve(); }
  }
  class Offline extends Base {
    static instances: Offline[] = [];
    static release: (() => void) | undefined;
    static gated = false;
    channels: number;
    length: number;
    constructor(channels: number, length: number, sampleRate: number) {
      super(); this.channels = channels; this.length = length; this.sampleRate = sampleRate; Offline.instances.push(this);
    }
    startRendering(): Promise<Buffer> {
      const result = new Buffer(this.channels, this.length, this.sampleRate);
      result.channels.forEach((channel, index) => {
        for (let i = 0; i < channel.length; i++) channel[i] = 0.12 + 0.03 * Math.sin(2 * Math.PI * i * 5 / (this.sampleRate * 24) + index * 0.5);
      });
      return Offline.gated ? new Promise((resolve) => { Offline.release = () => resolve(result); }) : Promise.resolve(result);
    }
  }
  for (const [name, constructor] of [["AudioContext", Live], ["OfflineAudioContext", Offline]] as const) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value: constructor });
    t.after(() => { if (previous) Object.defineProperty(globalThis, name, previous); else Reflect.deleteProperty(globalThis, name); });
  }
  const music = createLakeMusic();
  t.after(() => music.dispose());
  assert.throws(() => music.playPreparedLoop(), /Prepare the music loop/);
  assert.throws(() => music.getLoopWav(), /Prepare the music loop/);
  const preparing = music.prepareLoop(24);
  const live = Live.last;
  assert.equal(live.resumeCalls, 1, "resume happens before prepareLoop yields to asynchronous rendering");
  assert.equal(music.stream, live.capture.stream);
  await preparing;
  assert.equal(live.sources.length, 0, "offline preparation never starts a speaker source");
  assert.equal(Offline.instances.length, 1);
  const preparedWav = new DataView(await music.getLoopWav().arrayBuffer());
  assert.equal(preparedWav.getUint32(24, true), live.sampleRate);
  assert.equal(preparedWav.getUint32(46, true), 24 * live.sampleRate);
  assert.equal(preparedWav.getUint32(54, true) / (live.sampleRate * 8), 24);
  assert.equal(live.sources.length, 0, "WAV export has no playback side effects");
  assert.ok(Offline.instances[0].nodes.every((node) => node.disconnected));
  assert.equal(music.playPreparedLoop(), undefined, "recording callback starts synchronously");
  const first = live.sources[0];
  assert.ok(first.started && first.loop);
  assert.equal(first.loopEnd, 24);
  assert.equal(first.buffer!.duration, 24);
  assert.equal(first.buffer!.channels.length, 2);
  assert.equal(preparedWav.getFloat32(58, true), Math.fround(first.buffer!.channels[0][0] * (0.65 * 0.85)),
    "WAV default gain matches the current live master output");
  const unityWav = new DataView(await music.getLoopWav(1).arrayBuffer());
  assert.equal(unityWav.getFloat32(58, true), first.buffer!.channels[0][0]);
  music.setVolume(0.4);
  const adjustedWav = new DataView(await music.getLoopWav().arrayBuffer());
  assert.equal(adjustedWav.getFloat32(58, true), Math.fround(first.buffer!.channels[0][0] * (0.4 * 0.85)));
  assert.equal(first.buffer!.channels[0][0], first.buffer!.channels[0].at(-1));
  assert.notDeepEqual(first.buffer!.channels[0], first.buffer!.channels[1]);
  assert.equal(live.track.stopped, false);
  music.stop();
  assert.equal(first.stopped, true);
  await music.prepareLoop(24);
  assert.equal(Offline.instances.length, 1, "cached preparation keeps identical PCM and avoids a second render");
  music.playPreparedLoop();
  assert.equal(live.sources.length, 2);
  assert.equal(live.sources[1].buffer, first.buffer);
  music.dispose();
  assert.ok(live.sources.every((source) => source.stopped && source.disconnected));
  assert.equal(live.track.stopped, true);

  Offline.gated = true;
  const cancelled = createLakeMusic();
  const pending = cancelled.prepareLoop(24);
  await Promise.resolve();
  cancelled.dispose();
  Offline.release!();
  await assert.rejects(pending, /preparation was cancelled/);
  assert.equal(Live.last.track.stopped, true);
  assert.ok(Offline.instances.at(-1)!.nodes.every((node) => node.disconnected));
});
