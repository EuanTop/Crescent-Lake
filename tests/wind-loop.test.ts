import { test } from "node:test";
import assert from "node:assert/strict";
import { WIND_TAU, loopWind, treeWind } from "../src/scene/wind-loop.ts";

const duration = 24;
const offsets = [-3.516, -1.978, -0.124];

test("wind loops close exactly at 0, 24 and 48 seconds without wrapping the absolute wake clock", () => {
  for (const wind of [0, 0.35, 1, 2]) {
    const opening = loopWind(0, wind, duration);
    assert.deepEqual(loopWind(duration, wind, duration), opening);
    assert.deepEqual(loopWind(duration * 2, wind, duration), opening);
    assert.equal(opening.orbitX, 0);
    assert.equal(opening.orbitY, 0);
    assert.equal(opening.angle, 0);
    assert.ok(Number.isInteger(opening.waveCycles));
    assert.ok(Number.isInteger(opening.swayCycles));
    for (const offset of offsets) {
      assert.deepEqual(treeWind(duration, wind, offset, duration), treeWind(0, wind, offset, duration));
      assert.deepEqual(treeWind(duration * 2, wind, offset, duration), treeWind(0, wind, offset, duration));
    }
    for (const time of [0.125, 3, 7.5, 12, 23.5]) {
      assert.deepEqual(loopWind(time + duration, wind, duration), loopWind(time, wind, duration));
    }
  }
});

test("torus noise coordinates and tree sway have continuous velocity across the export seam", () => {
  const epsilon = 0.00001;
  const before = loopWind(duration - epsilon, 1, duration);
  const at = loopWind(duration, 1, duration);
  const after = loopWind(duration + epsilon, 1, duration);
  for (const field of ["orbitX", "orbitY"] as const) {
    const incoming = (at[field] - before[field]) / epsilon;
    const outgoing = (after[field] - at[field]) / epsilon;
    assert.ok(Math.abs(incoming - outgoing) < 0.0001);
  }
  for (const offset of offsets) {
    const previous = treeWind(duration - epsilon, 2, offset, duration);
    const center = treeWind(duration, 2, offset, duration);
    const next = treeWind(duration + epsilon, 2, offset, duration);
    for (const field of ["x", "z", "crownX", "crownZ"] as const) {
      const incoming = (center[field] - previous[field]) / epsilon;
      const outgoing = (next[field] - center[field]) / epsilon;
      assert.ok(Math.abs(incoming - outgoing) < 0.0001, `${field} must not snap at the join`);
    }
  }
});

test("tree roots tilt within five degrees, crowns have independent motion, and zero wind restores exact rest", () => {
  let normalMaximum = 0;
  let strongMaximum = 0;
  let treeDifference = 0;
  let crownDifference = 0;
  for (let frame = 0; frame <= 1440; frame++) {
    const time = frame / 60;
    for (const offset of offsets) {
      const normal = treeWind(time, 1, offset, duration);
      const strong = treeWind(time, 2, offset, duration);
      const neighborCrown = treeWind(time, 2, offset + 1.73, duration);
      assert.ok(Object.values(strong).every(Number.isFinite));
      normalMaximum = Math.max(normalMaximum, Math.hypot(normal.x, normal.z));
      strongMaximum = Math.max(strongMaximum, Math.hypot(strong.x, strong.z));
      assert.ok(Math.hypot(strong.x, strong.z) < (5 * Math.PI) / 180);
      assert.ok(Math.hypot(strong.crownX, strong.crownZ) < 0.019);
      crownDifference = Math.max(crownDifference, Math.abs(strong.crownZ - neighborCrown.crownZ));
      assert.deepEqual(treeWind(time, 0, offset, duration), { x: 0, z: 0, crownX: 0, crownZ: 0 });
    }
    treeDifference = Math.max(treeDifference, Math.abs(treeWind(time, 1, offsets[0], duration).z - treeWind(time, 1, offsets[1], duration).z));
  }
  assert.ok(normalMaximum > (2 * Math.PI) / 180, "ordinary wind should visibly move the trees");
  assert.ok(strongMaximum > (4 * Math.PI) / 180);
  assert.ok(treeDifference > 0.01, "trees must not move as one rigid unit");
  assert.ok(crownDifference > 0.005, "neighboring crowns need their own phase");
});

test("per-wave band identities repeat when the crest advances by an integer loop cycle count", () => {
  const mod = (value: number, period: number) => ((value % period) + period) % period;
  for (const wind of [0.35, 1, 2]) {
    const cycles = loopWind(0, wind, duration).waveCycles;
    assert.ok(cycles > 0);
    for (const spatialPhase of [-19.1, -0.2, 1.7, 7.2, 37.4]) {
      const first = Math.floor(spatialPhase / WIND_TAU);
      const last = Math.floor((spatialPhase - WIND_TAU * cycles) / WIND_TAU);
      assert.equal(mod(first, cycles), mod(last, cycles), "each crest must retain its hashed gaps at the join");
    }
  }
});

test("loop duration stays generic and invalid inputs remain finite", () => {
  for (const period of [12, 20, 24, 25.5]) {
    assert.deepEqual(loopWind(period, 1, period), loopWind(0, 1, period));
  }
  for (const invalid of [0, -1, NaN, Infinity]) {
    assert.equal(loopWind(3, 1, invalid).duration, 0);
  }
  for (const wind of [NaN, Infinity, -1, 20]) {
    assert.ok(Object.values(loopWind(NaN, wind, duration)).every(Number.isFinite));
    assert.ok(Object.values(treeWind(NaN, wind, 0.5, duration)).every(Number.isFinite));
  }
});
