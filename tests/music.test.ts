import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createLakeEnvelope,
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
        (note.voice === "wood" || note.voice === "pulse" ? 0.4 : 0.09),
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
      assert.ok(["bed", "glass", "wood", "pulse"].includes(note.voice));
      previous = note.time;
    }
  }
});

test("four instrumental roles enter within four seconds with wood behind a distinct sustained lead", () => {
  const score = generateLakePhrase(74291, 0);
  const first = (voice: string) =>
    score.notes.find((note) => note.voice === voice)!;
  assert.deepEqual([...new Set(score.notes.map((note) => note.voice))].sort(), [
    "bed",
    "pulse",
    "wood",
  ]);
  assert.equal(first("bed").time, 0);
  assert.ok(score.melody[0].time > 0.6 && score.melody[0].time < 0.9);
  assert.ok(first("wood").time > 2 && first("wood").time < 2.5);
  assert.ok(first("pulse").time > 3.3 && first("pulse").time < 4);
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
});
