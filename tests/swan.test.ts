import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Group, Object3D } from "three";
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
      assert.ok(Math.abs(hinge.rotation.z) < 0.16);
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
