import { test } from "node:test";
import assert from "node:assert/strict";
import {
  advanceDistance,
  advanceWindPhase,
  clampMotionStrength,
  windResponse,
  WAKE_CAPACITY,
  WAKE_INTERVAL,
  WAKE_LIFETIME,
  WakeHistory,
  wakeStrength,
} from "../src/scene/motion.ts";

test("equal real time gives equal travel at 30 and 120 frames per second, including a route wrap", () => {
  let slow = 9,
    fast = 9;
  for (let i = 0; i < 300; i++) slow = advanceDistance(slow, 1 / 30, 0.24, 10);
  for (let i = 0; i < 1200; i++)
    fast = advanceDistance(fast, 1 / 120, 0.24, 10);
  assert.ok(Math.abs(slow - fast) < 1e-10);
  assert.ok(Math.abs(slow - 1.4) < 1e-10);
});

test("pausing keeps distance fixed and a wake at its world position when the bird turns", () => {
  assert.equal(advanceDistance(3, 0, 0.24, 10), 3);
  const history = new WakeHistory();
  history.sample(0, 2, 4);
  history.sample(0.5, 4, 2);
  assert.deepEqual(history.points[0], { x: 2, z: 4, born: 0 });
  assert.equal(history.sample(0.5, 99, 99), false);
});

test("wake history is bounded, removes expired points, and never produces a premature ripple", () => {
  const history = new WakeHistory();
  for (let i = 0; i < 1000; i++) history.sample(i * 0.25, i, 0);
  assert.ok(history.points.length <= WAKE_CAPACITY);
  assert.ok(
    history.points.every((point) => 249.75 - point.born < WAKE_LIFETIME),
  );
  assert.equal(wakeStrength(-1), 0);
  assert.equal(wakeStrength(WAKE_LIFETIME), 0);
  assert.ok(wakeStrength(1) > wakeStrength(5));
});

test("the trail retains readable marks at 10–15 seconds, then fades smoothly to zero", () => {
  const history = new WakeHistory();
  for (let i = 0; i <= 50; i++)
    history.sample(i * WAKE_INTERVAL, i * 0.1, Math.sin(i * 0.04));
  const oldAges = history.points.map((point) => 20 - point.born);
  assert.ok(oldAges.some((age) => age >= 14 && age <= 16));
  assert.ok(oldAges.some((age) => age >= 10 && age <= 11));
  assert.ok(wakeStrength(10) > 0.65);
  assert.ok(wakeStrength(15) > 0.5);
  assert.ok(wakeStrength(20) > 0.05 && wakeStrength(20) < 0.15);

  let previous = wakeStrength(10);
  for (let age = 10.01; age < WAKE_LIFETIME; age += 0.01) {
    const current = wakeStrength(age);
    assert.ok(current >= 0 && current <= previous + 1e-12);
    previous = current;
  }
  // Both sides of the removal boundary agree, with a vanishing final slope.
  assert.ok(wakeStrength(WAKE_LIFETIME - 0.001) < 1e-6);
  assert.ok(
    wakeStrength(WAKE_LIFETIME - 0.002) - wakeStrength(WAKE_LIFETIME - 0.001) <
      1e-6,
  );
  assert.equal(wakeStrength(WAKE_LIFETIME), 0);
  history.sample(WAKE_LIFETIME, 9, 9);
  assert.ok(history.points.every((point) => point.born > 0));
});

test("capacity covers the whole lifetime instead of discarding a still-visible wake", () => {
  assert.ok(WAKE_CAPACITY * WAKE_INTERVAL >= WAKE_LIFETIME + WAKE_INTERVAL);
  const history = new WakeHistory();
  const sampleCount = Math.ceil(WAKE_LIFETIME / WAKE_INTERVAL);
  for (let i = 0; i < sampleCount; i++) history.sample(i * WAKE_INTERVAL, i, 0);
  assert.equal(history.points.length, sampleCount);
  assert.equal(history.points[0].born, 0);
  const time = (sampleCount - 1) * WAKE_INTERVAL;
  assert.ok(
    history.points.every(
      (point) => time - point.born >= 0 && time - point.born < WAKE_LIFETIME,
    ),
  );
});

test("invalid ages and samples are harmless, and rewinding removes future-born wakes", () => {
  for (const age of [NaN, Infinity, -Infinity, -0.1, WAKE_LIFETIME + 1])
    assert.equal(wakeStrength(age), 0);
  const history = new WakeHistory();
  assert.equal(history.sample(NaN, 0, 0), false);
  assert.equal(history.sample(0, Infinity, 0), false);
  assert.equal(history.sample(-1, 0, 0), false);
  assert.equal(history.points.length, 0);
  history.sample(12, 5, 8);
  history.sample(13, 6, 8);
  assert.equal(history.sample(1, 2, 3), true);
  assert.deepEqual(history.points, [{ x: 2, z: 3, born: 1 }]);
  assert.equal(history.sample(1, 99, 99), false);
});

test("a turn leaves old wake headings and positions in world space", () => {
  const history = new WakeHistory();
  history.sample(0, 0, 0);
  history.sample(0.4, 1, 0);
  const east = history.points[1];
  history.sample(0.8, 1, 1);
  assert.deepEqual(history.directionFor(east), { x: 1, z: 0 });
  assert.deepEqual(history.directionFor(history.points[2]), { x: 0, z: 1 });
  assert.deepEqual(east, { x: 1, z: 0, born: 0.4 });
});

test("wind travels visibly at full strength, freezes at zero, and never jumps when the slider changes", () => {
  const initial = 4.25;
  assert.equal(advanceWindPhase(initial, 0, 1), initial);
  assert.equal(advanceWindPhase(initial, 0, 0), initial);
  assert.equal(advanceWindPhase(initial, 10, 0), initial);
  assert.ok(advanceWindPhase(initial, 10, 1) - initial > 10);
  assert.equal(advanceWindPhase(initial, NaN, 1), initial);
  assert.equal(advanceWindPhase(initial, 1, NaN), initial);

  const integrate = (fps: number): number => {
    let phase = 0;
    for (let frame = 0; frame < fps * 6; frame++) {
      const t = frame / fps;
      phase = advanceWindPhase(phase, 1 / fps, t < 2 ? 0.25 : t < 5 ? 1 : 0);
    }
    return phase;
  };
  assert.ok(Math.abs(integrate(30) - integrate(120)) < 1e-10);
});


test("0–100% wind preserves its original equations, and 100–200% is stronger but bounded", () => {
  for (let step = 0; step <= 100; step++) {
    const strength = step / 100;
    const response = windResponse(strength);
    assert.equal(response.strength, strength);
    assert.equal(response.amplitude, strength);
    assert.equal(response.detail, strength * strength);
    assert.equal(response.grassBend, strength * (0.38 + 0.45 * strength));
    assert.equal(response.gustSpeed, 1);
    assert.equal(
      advanceWindPhase(3, 0.25, strength),
      3 + 0.25 * (0.16 * strength + 0.88 * strength * strength),
    );
  }
  const original = windResponse(1);
  const strong = windResponse(2);
  assert.equal(strong.strength, 2);
  assert.ok(strong.amplitude > original.amplitude);
  assert.ok(strong.detail > original.detail);
  assert.ok(strong.grassBend > original.grassBend);
  assert.ok(strong.gustSpeed > original.gustSpeed);
  assert.ok(strong.amplitude <= 1.5);
  assert.ok(strong.detail <= 1.65);
  assert.ok(strong.grassBend <= original.grassBend * 1.35);

  for (let step = 0; step <= 200; step++) {
    const strength = step / 100;
    const response = windResponse(strength);
    assert.ok(Object.values(response).every(Number.isFinite));
    // Maximum possible crest + fine-detail mixture remains interpolation,
    // never an extrapolation that clips into neon white or negative shadows.
    const peakHighlightMix = (0.56 * response.amplitude + 0.52 * response.detail) * 0.45;
    assert.ok(peakHighlightMix >= 0 && peakHighlightMix < 0.78);
    assert.ok(response.amplitude * 0.2 <= 0.3 + 1e-12);
    assert.equal(advanceWindPhase(9, 0, strength), 9);
  }
  assert.deepEqual(windResponse(20), strong);
  assert.deepEqual(windResponse(-1), windResponse(0));
  for (const invalid of [NaN, Infinity, -Infinity]) {
    assert.equal(clampMotionStrength(invalid), 0);
    assert.deepEqual(windResponse(invalid), windResponse(0));
  }
});

test("extended wind keeps integrated phase continuous and frame-rate independent across 0–200%", () => {
  let phase = 8;
  for (const strength of [0, 0.3, 1, 1.2, 2, 0, 1.8]) {
    assert.equal(advanceWindPhase(phase, 0, strength), phase);
    const next = advanceWindPhase(phase, 0.1, strength);
    assert.ok(Number.isFinite(next) && next >= phase);
    assert.ok(next - phase <= 0.19 + 1e-12);
    phase = next;
  }
  assert.ok(advanceWindPhase(0, 1, 2) > advanceWindPhase(0, 1, 1));
  const integrate = (fps: number): number => {
    let result = 0;
    for (let frame = 0; frame < fps * 8; frame++) {
      const t = frame / fps;
      result = advanceWindPhase(result, 1 / fps, t < 2 ? 0 : t < 4 ? 1 : t < 6 ? 2 : 0.4);
    }
    return result;
  };
  assert.ok(Math.abs(integrate(30) - integrate(120)) < 1e-10);
  assert.equal(advanceWindPhase(5, Infinity, 2), 5);
  assert.equal(advanceWindPhase(5, 1, Infinity), 5);
});
