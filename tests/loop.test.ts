import { test } from "node:test";
import assert from "node:assert/strict";
import { LOOP_SECONDS, loopPhase, loopWarmth } from "../src/scene/loop.ts";
test("film duration is within26seconds and light returns Morning through Golden", () => {
  assert.equal(LOOP_SECONDS, 24);
  assert.ok(LOOP_SECONDS <= 26);
  assert.equal(loopWarmth(0), 0);
  assert.equal(loopWarmth(12), 1);
  assert.equal(loopWarmth(24), 0);
  for (let t = 0; t <= 24; t += 0.1)
    assert.ok(Math.abs(loopWarmth(t) - loopWarmth(24 - t)) < 1e-12);
});
test("loop motion closes across cycles without changing the non-loop rate", () => {
  for (const rate of [0.019, 0.058, 0.11, 0.3, 0.43, 1.18, 1.5, 4.9])
    for (const t of [0, 0.2, 2.5, 7, 23.9]) {
      assert.ok(
        Math.abs(
          Math.sin(loopPhase(t, rate, 24)) -
            Math.sin(loopPhase(t + 24, rate, 24)),
        ) < 1e-12,
      );
      assert.equal(loopPhase(t, rate), t * rate);
    }
});
