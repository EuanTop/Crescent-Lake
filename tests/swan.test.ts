import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Group, MathUtils, Object3D } from "three";
import { createSwanMotion } from "../src/scene/swan.ts";

// Use the shipped asset's actual hierarchy and transforms to detect naming or
// coordinate changes that would detach the animated wing pieces.
function loadHierarchy() {
  const bytes = readFileSync(
    new URL("../public/models/swan.glb", import.meta.url),
  );
  const gltf = JSON.parse(
    bytes.toString("utf8", 20, 20 + bytes.readUInt32LE(12)),
  );
  const nodes: Object3D[] = gltf.nodes.map(
    (node: {
      name: string;
      translation?: number[];
      rotation?: number[];
      scale?: number[];
    }) => {
      const object = new Object3D();
      object.name = node.name;
      if (node.translation) object.position.fromArray(node.translation);
      if (node.rotation) object.quaternion.fromArray(node.rotation);
      if (node.scale) object.scale.fromArray(node.scale);
      return object;
    },
  );
  gltf.nodes.forEach((node: { children?: number[] }, i: number) =>
    node.children?.forEach((child) => nodes[i].add(nodes[child])),
  );
  const root = new Group();
  gltf.scenes[gltf.scene ?? 0].nodes.forEach((i: number) => root.add(nodes[i]));
  root.updateMatrixWorld(true);
  return { root, nodes };
}

test("wing rig preserves every shipped model part at rest and stays bounded through gestures", () => {
  const { root, nodes } = loadHierarchy();
  const resting = nodes.map((node) => node.matrixWorld.clone());
  const motion = createSwanMotion(root);
  assert.equal(
    createSwanMotion(root),
    motion,
    "initializing twice must not duplicate hinges",
  );
  assert.equal(
    root.children.filter((node) => /shoulder hinge/.test(node.name)).length,
    2,
  );
  motion.update(12, 0);
  root.updateMatrixWorld(true);
  nodes.forEach((node, i) =>
    node.matrixWorld.elements.forEach((v, j) =>
      assert.ok(Math.abs(v - resting[i].elements[j]) < 1e-6),
    ),
  );
  const hinges = root.children.filter((node) =>
    /shoulder hinge/.test(node.name),
  );
  let maxOpening = 0;
  for (let i = 0; i < 2400; i++) {
    motion.update(i / 20, 1);
    root.updateMatrixWorld(true);
    nodes.forEach((node) =>
      assert.ok(node.matrixWorld.elements.every(Number.isFinite)),
    );
    hinges.forEach((hinge) => {
      maxOpening = Math.max(maxOpening, Math.abs(hinge.rotation.z));
      assert.ok(Math.abs(hinge.rotation.z) <= MathUtils.degToRad(50) + 1e-12);
    });
  }
  assert.ok(maxOpening > 0.09, "the long stretch must actually lift the wings");
  motion.update(19.4, 1);
  root.updateMatrixWorld(true);
  const pose = nodes.map((node) => node.matrixWorld.clone());
  motion.update(19.4, 1);
  root.updateMatrixWorld(true);
  nodes.forEach((node, i) =>
    assert.deepEqual(
      node.matrixWorld.elements,
      pose[i].elements,
      "paused time must not accumulate drift",
    ),
  );
  motion.update(120, 0);
  root.updateMatrixWorld(true);
  nodes.forEach((node, i) =>
    node.matrixWorld.elements.forEach((v, j) =>
      assert.ok(Math.abs(v - resting[i].elements[j]) < 1e-6),
    ),
  );
});

test("24-second loop closes every swan part and includes visible irregular wing bursts", () => {
  const { root, nodes } = loadHierarchy();
  const motion = createSwanMotion(root);
  const hinges = root.children.filter((node) =>
    /shoulder hinge/.test(node.name),
  );
  motion.update(24, 1, 24);
  root.updateMatrixWorld(true);
  const initial = nodes.map((node) => node.matrixWorld.clone());
  let movingFrames = 0;
  let stillFrames = 0;
  let maximum = 0;
  for (let i = 0; i <= 720; i++) {
    motion.update(24 + i / 30, 1, 24);
    root.updateMatrixWorld(true);
    const opening = Math.max(
      ...hinges.map((node) => Math.abs(node.rotation.z)),
    );
    maximum = Math.max(maximum, opening);
    if (opening > 0.12) movingFrames++;
    else stillFrames++;
    nodes.forEach((node) =>
      assert.ok(node.matrixWorld.elements.every(Number.isFinite)),
    );
  }
  assert.ok(
    maximum > MathUtils.degToRad(34),
    "default activity must produce a clearly readable wing lift",
  );
  assert.ok(
    movingFrames > 45 && stillFrames > 500,
    "bursts are intermittent, not constant flying",
  );
  nodes.forEach((node, i) =>
    node.matrixWorld.elements.forEach((value, j) =>
      assert.ok(Math.abs(value - initial[i].elements[j]) < 1e-10),
    ),
  );
});

test("200% swan activity increases gesture frequency and lift without detaching pieces or exceeding fifty degrees", () => {
  const observe = (activity: number) => {
    const { root, nodes } = loadHierarchy();
    const motion = createSwanMotion(root);
    const wingParts = nodes.filter((node) =>
      /^wing_(left|right)_/.test(node.name),
    );
    const partRest = wingParts.map((node) => ({
      position: node.position.clone(),
      quaternion: node.quaternion.clone(),
      scale: node.scale.clone(),
    }));
    const hinges = root.children.filter((node) =>
      /shoulder hinge/.test(node.name),
    );
    let maximum = 0;
    let episodes = 0;
    let inStretch = false;
    const wingAmplitude = activity <= 1 ? activity : 1 + (activity - 1) * 1.6;
    for (let frame = 0; frame <= 2480; frame++) {
      motion.update(frame / 20, activity);
      root.updateMatrixWorld(true);
      const opening = Math.max(
        ...hinges.map((hinge) => Math.abs(hinge.rotation.z)),
      );
      maximum = Math.max(maximum, opening);
      assert.ok(opening <= MathUtils.degToRad(50) + 1e-12);
      const stretch = opening > 0.065 * wingAmplitude;
      if (stretch && !inStretch) episodes++;
      inStretch = stretch;
      assert.ok(root.scale.y > 0.99 && root.scale.y < 1.02);
      for (const hinge of hinges) {
        assert.ok(hinge.position.y >= 0.607 && hinge.position.y <= 0.623);
      }
      wingParts.forEach((node, i) => {
        assert.deepEqual(node.position, partRest[i].position);
        assert.deepEqual(
          node.quaternion.toArray(),
          partRest[i].quaternion.toArray(),
        );
        assert.deepEqual(node.scale, partRest[i].scale);
        assert.ok(node.matrixWorld.elements.every(Number.isFinite));
      });
    }
    motion.update(125, 0);
    hinges.forEach((hinge) => {
      assert.equal(Math.abs(hinge.rotation.z), 0);
      assert.equal(hinge.position.y, 0.61);
    });
    return { maximum, episodes };
  };
  const original = observe(1);
  const strong = observe(2);
  assert.ok(strong.maximum > original.maximum * 1.15);
  assert.ok(strong.maximum > MathUtils.degToRad(15));
  assert.ok(strong.episodes > original.episodes);
});

test("activity changes keep the gesture phase continuous, clamp at 200%, and tolerate invalid inputs", () => {
  const pose = (activity: number) => {
    const { root } = loadHierarchy();
    const motion = createSwanMotion(root);
    motion.update(0, 1);
    motion.update(19.65, 1);
    motion.update(19.65, activity);
    const hinges = root.children.filter((node) =>
      /shoulder hinge/.test(node.name),
    );
    return hinges.map((hinge) => hinge.rotation.z);
  };
  const original = pose(1);
  const strong = pose(2);
  assert.ok(Math.abs(strong[0]) > Math.abs(original[0]) * 1.1);
  assert.deepEqual(pose(20), strong);
  for (const invalid of [NaN, Infinity, -Infinity, -1]) {
    pose(invalid).forEach((opening) => assert.equal(Math.abs(opening), 0));
  }
});


test("each default wing-shaking bout has three or four fast peaks and a long rest", () => {
  const { root } = loadHierarchy();
  const motion = createSwanMotion(root);
  const hinge = root.children.find(node => /left shoulder hinge/.test(node.name))!;
  const dt = 1 / 240;
  for (let slot = 0; slot < 4; slot++) {
    const samples: number[] = [];
    for (let frame = 0; frame <= 6 / dt; frame++) {
      motion.update(slot * 6 + frame * dt, 1, 24);
      samples.push(Math.abs(hinge.rotation.z));
    }
    const peaks: number[] = [];
    for (let i = 1; i < samples.length - 1; i++)
      if (samples[i] > MathUtils.degToRad(25) && samples[i] > samples[i-1] && samples[i] >= samples[i+1])
        peaks.push(i * dt);
    assert.ok(peaks.length === 3 || peaks.length === 4, `slot${slot}: ${peaks.length} peaks`);
    for (let i = 1; i < peaks.length; i++)
      assert.ok(peaks[i] - peaks[i-1] >= .2 && peaks[i] - peaks[i-1] <= .27);
    assert.ok(peaks.at(-1)! - peaks[0] < .8);
    // A clear tuck between two lifts, rather than a held-open flying gesture.
    for (let i = 1; i < peaks.length; i++) {
      const between = samples.slice(Math.ceil(peaks[i-1] / dt), Math.floor(peaks[i] / dt));
      assert.ok(Math.min(...between) < MathUtils.degToRad(5));
    }
    const active = samples.filter(angle => angle > MathUtils.degToRad(15)).length * dt;
    assert.ok(active < .7, "short sudden bursts must leave quiet swimming time");
  }
});
