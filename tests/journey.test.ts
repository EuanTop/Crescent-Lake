import { test } from "node:test";
import assert from "node:assert/strict";
import { videoWarmth } from "../src/scene/journey.ts";

test("17-second journey holds Morning, smoothly reveals Golden Hour, then settles", () => {
  assert.equal(videoWarmth(0, 17), 0);
  assert.equal(videoWarmth(3, 17), 0);
  assert.equal(videoWarmth(8, 17), 0.5);
  assert.equal(videoWarmth(13, 17), 1);
  assert.equal(videoWarmth(17, 17), 1);
  let previous = 0;
  for (let t = 0; t <= 17; t += 1 / 30) {
    const value = videoWarmth(t, 17);
    assert.ok(value >= previous && value <= 1);
    previous = value;
  }
  const epsilon = 0.001;
  assert.ok(
    videoWarmth(3 + epsilon, 17) / epsilon < 0.001,
    "ease out of Morning without a visible jump",
  );
  assert.ok(
    (1 - videoWarmth(13 - epsilon, 17)) / epsilon < 0.001,
    "arrive softly in Golden Hour",
  );
});
test("journey follows real recording time at any frame rate and scales with duration", () => {
  for (const seconds of [5, 10, 17, 30, 60])
    for (const fraction of [0, 0.1, 0.3, 0.5, 0.7, 0.9, 1])
      assert.ok(
        Math.abs(
          videoWarmth(fraction * seconds, seconds) -
            videoWarmth(fraction * 17, 17),
        ) < 1e-12,
      );
  for (const bad of [NaN, Infinity, -Infinity])
    assert.equal(videoWarmth(bad, 17), 0);
  assert.equal(videoWarmth(-5, 17), 0);
  assert.equal(videoWarmth(20, 17), 1);
  assert.equal(videoWarmth(5, 0), 0);
});
