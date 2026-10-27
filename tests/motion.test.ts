import { test } from "node:test";
import assert from "node:assert/strict";
import {
  advanceDistance,
  WAKE_CAPACITY,
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
