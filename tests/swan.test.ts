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


test("the original 0–100% swan pose and schedule remain unchanged", () => {
  const { root } = loadHierarchy();
  const motion = createSwanMotion(root);
  const hinges = root.children.filter((node) => /shoulder hinge/.test(node.name));
  const oldGesture = (time: number, period: number, start: number, duration: number): number => {
    const phase = ((time % period) + period) % period;
    return phase < start || phase > start + duration ? 0 : Math.sin(((phase-start)/duration)*Math.PI) ** 2;
  };
  for (const activity of [0, 0.25, 0.7, 1]) {
    for (const time of [0, 6.1, 19.4, 50.4, 99]) {
      motion.update(time, activity);
      const stretch = oldGesture(time,31,17,4.8)*activity;
      const flutter = oldGesture(time,13,5.6,1.35)*activity;
      const beat = Math.sin((time-5.6)*13.4);
      const breath = Math.sin(time*1.18)*activity;
      for (const hinge of hinges) {
        const sign = hinge.name.includes("left") ? -1 : 1;
        const settle = Math.sin(time*1.18+sign*0.18)*0.004*activity;
        const opening = stretch*0.105+flutter*(0.02+beat*0.025)+settle;
        assert.ok(Math.abs(hinge.rotation.z-sign*opening)<1e-12);
        assert.ok(Math.abs(hinge.position.y-(0.61+stretch*0.007+breath*0.0015))<1e-12);
      }
      assert.ok(Math.abs(root.scale.y-(1+breath*0.0037+stretch*0.003))<1e-12);
    }
  }
});

test("200% swan activity increases gesture frequency and lift without detaching pieces or exceeding seventeen degrees", () => {
  const observe = (activity: number) => {
    const { root, nodes } = loadHierarchy();
    const motion = createSwanMotion(root);
    const wingParts = nodes.filter((node) => /^wing_(left|right)_/.test(node.name));
    const partRest = wingParts.map((node) => ({position:node.position.clone(),quaternion:node.quaternion.clone(),scale:node.scale.clone()}));
    const hinges = root.children.filter((node) => /shoulder hinge/.test(node.name));
    let maximum = 0;
    let episodes = 0;
    let inStretch = false;
    const wingAmplitude = activity <= 1 ? activity : 1+(activity-1)*1.6;
    for (let frame=0;frame<=2480;frame++) {
      motion.update(frame/20,activity);
      root.updateMatrixWorld(true);
      const opening = Math.max(...hinges.map((hinge)=>Math.abs(hinge.rotation.z)));
      maximum = Math.max(maximum,opening);
      assert.ok(opening <= MathUtils.degToRad(17)+1e-12);
      const stretch = opening > 0.065*wingAmplitude;
      if (stretch && !inStretch) episodes++;
      inStretch = stretch;
      assert.ok(root.scale.y>0.99 && root.scale.y<1.02);
      for (const hinge of hinges) {
        assert.ok(hinge.position.y>=0.607 && hinge.position.y<=0.623);
      }
      wingParts.forEach((node,i)=>{
        assert.deepEqual(node.position,partRest[i].position);
        assert.deepEqual(node.quaternion.toArray(),partRest[i].quaternion.toArray());
        assert.deepEqual(node.scale,partRest[i].scale);
        assert.ok(node.matrixWorld.elements.every(Number.isFinite));
      });
    }
    motion.update(125,0);
    hinges.forEach((hinge)=>{
      assert.equal(Math.abs(hinge.rotation.z),0);
      assert.equal(hinge.position.y,0.61);
    });
    return {maximum,episodes};
  };
  const original=observe(1);
  const strong=observe(2);
  assert.ok(strong.maximum>original.maximum*1.8);
  assert.ok(strong.maximum>MathUtils.degToRad(15));
  assert.ok(strong.episodes>original.episodes);
});

test("activity changes keep the gesture phase continuous, clamp at 200%, and tolerate invalid inputs", () => {
  const pose = (activity:number) => {
    const {root}=loadHierarchy();
    const motion=createSwanMotion(root);
    motion.update(0,1);
    motion.update(19.4,1);
    motion.update(19.4,activity);
    const hinges=root.children.filter((node)=>/shoulder hinge/.test(node.name));
    return hinges.map((hinge)=>hinge.rotation.z);
  };
  const original=pose(1);
  const strong=pose(2);
  assert.ok(Math.abs(strong[0])>Math.abs(original[0])*2);
  assert.deepEqual(pose(20),strong);
  for (const invalid of [NaN,Infinity,-Infinity,-1]) {
    pose(invalid).forEach((opening)=>assert.equal(Math.abs(opening),0));
  }
});
