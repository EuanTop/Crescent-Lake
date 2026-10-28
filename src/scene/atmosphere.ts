import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  MathUtils,
  Mesh,
  SphereGeometry,
} from "three";
import type { Material } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { loopPhase } from "./loop";
import { createToonMaterial } from "./materials";

export interface Atmosphere {
  group: Group;
  update(time: number, wind: number, loopDuration?: number): void;
  setClouds(visible: boolean): void;
  setBirds(visible: boolean): void;
  dispose(): void;
}

/** Original geometry only: a little sky movement at the composition's top edge. */
export function createAtmosphere(): Atmosphere {
  const group = new Group();
  group.name = "Clouds and passing birds";
  const cloudGroup = new Group();
  cloudGroup.name = "Pale drifting clouds";
  const birdGroup = new Group();
  birdGroup.name = "Small overhead flock";
  group.add(cloudGroup, birdGroup);
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const ownGeometry = <T extends BufferGeometry>(value: T): T => {
    geometries.add(value);
    return value;
  };
  const cloudMaterial = createToonMaterial([
    "#c7d0c3",
    "#dfe4d4",
    "#f0f0df",
    "#fff9ea",
  ]);
  const birdMaterial = createToonMaterial([
    "#34483f",
    "#42564a",
    "#52624e",
    "#6e775c",
  ]);
  birdMaterial.side = DoubleSide;
  materials.add(cloudMaterial);
  materials.add(birdMaterial);

  // Merge the intersecting puffs so each cloud needs just one draw call.
  const puff = new SphereGeometry(1, 14, 10);
  const puffLayout = [
    [-0.88, 0.01, 0.02, 0.56, 0.29, 0.43],
    [-0.36, 0.16, -0.05, 0.66, 0.41, 0.49],
    [0.27, 0.21, -0.02, 0.67, 0.45, 0.51],
    [0.88, 0.04, 0.03, 0.52, 0.32, 0.4],
    [-0.04, -0.06, 0.21, 0.89, 0.25, 0.43],
  ];
  const pieces = puffLayout.map(([x, y, z, sx, sy, sz]) =>
    puff.clone().scale(sx, sy, sz).translate(x, y, z),
  );
  const merged = mergeGeometries(pieces);
  pieces.forEach((piece) => piece.dispose());
  puff.dispose();
  if (!merged) throw new Error("Could not build procedural cloud geometry");
  const cloudGeometry = ownGeometry(merged);
  const cloudSpecs = [
    { x: -4.8, y: 3.8, z: -6.2, size: 0.91, phase: 0.3, speed: 0.17 },
    { x: 2.2, y: 4.4, z: -5.8, size: 0.8, phase: 2.7, speed: 0.2 },
    { x: -17.0, y: 4.1, z: -7.1, size: 0.73, phase: 4.5, speed: 0.18 },
  ];
  const clouds = cloudSpecs.map((spec, i) => {
    const mesh = new Mesh(cloudGeometry, cloudMaterial);
    mesh.name = `Drifting cloud ${i + 1}`;
    mesh.scale.setScalar(spec.size);
    mesh.rotation.y = i === 0 ? 0.16 : -0.22;
    // No large opaque cloud shadows over the swan or the planted bank.
    mesh.castShadow = false;
    cloudGroup.add(mesh);
    return { mesh, ...spec };
  });

  // A tapering curved ribbon, broad enough to read from the angled top view.
  const wingPositions: number[] = [];
  const wingIndices: number[] = [];
  const steps = 9;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = t * 0.36;
    const sweep = t * 0.035 - t * t * 0.145;
    const chord = 0.075 * Math.sin(Math.PI * t) ** 0.7 + 0.026 * (1 - t);
    const arch = Math.sin(Math.PI * t) * 0.028;
    wingPositions.push(
      x,
      arch,
      sweep + chord * 0.5,
      x,
      arch,
      sweep - chord * 0.5,
    );
    if (i < steps) {
      const a = i * 2;
      wingIndices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const wingGeometry = ownGeometry(new BufferGeometry());
  wingGeometry.setAttribute(
    "position",
    new Float32BufferAttribute(wingPositions, 3),
  );
  wingGeometry.setIndex(wingIndices);
  wingGeometry.computeVertexNormals();
  const bodyGeometry = ownGeometry(new SphereGeometry(1, 10, 6));
  const tailGeometry = ownGeometry(new BufferGeometry());
  tailGeometry.setAttribute(
    "position",
    new Float32BufferAttribute(
      [0, 0, -0.075, -0.034, 0, -0.175, 0.034, 0, -0.175],
      3,
    ),
  );
  tailGeometry.computeVertexNormals();

  const formation = [
    { x: 0, z: 0.3, size: 0.94, phase: 0.0 },
    { x: -0.59, z: -0.18, size: 0.82, phase: 0.8 },
    { x: 0.64, z: -0.24, size: 0.91, phase: 2.1 },
    { x: -1.15, z: -0.67, size: 0.75, phase: 3.0 },
    { x: 1.2, z: -0.76, size: 0.81, phase: 4.4 },
  ];
  const flyingBirds = formation.map((spec, i) => {
    const bird = new Group();
    bird.name = `Passing bird ${i + 1}`;
    bird.scale.setScalar(spec.size);
    const body = new Mesh(bodyGeometry, birdMaterial);
    body.scale.set(0.03, 0.025, 0.125);
    body.castShadow = true;
    const head = new Mesh(bodyGeometry, birdMaterial);
    head.position.set(0, 0.01, 0.115);
    head.scale.set(0.027, 0.027, 0.036);
    head.castShadow = true;
    const tail = new Mesh(tailGeometry, birdMaterial);
    tail.castShadow = true;
    const right = new Mesh(wingGeometry, birdMaterial);
    right.position.set(0.018, 0, 0.015);
    right.castShadow = true;
    const left = new Mesh(wingGeometry, birdMaterial);
    left.position.set(-0.018, 0, 0.015);
    left.scale.x = -1;
    left.castShadow = true;
    bird.add(body, head, tail, left, right);
    birdGroup.add(bird);
    return { bird, left, right, ...spec };
  });

  let disposed = false;
  const atmosphere: Atmosphere = {
    group,
    update(time, wind, loopDuration = 0) {
      if (disposed) return;
      const t = Number.isFinite(time) ? Math.max(0, time) : 0;
      const breeze = Number.isFinite(wind) ? MathUtils.clamp(wind, 0, 1) : 0;
      for (const cloud of clouds) {
        // Cross the frame rather than merely oscillating. The wrap occurs far
        // outside this scene's frustum. Fixed travel speed keeps a wind-slider
        // change from jumping the cloud to a different point in its journey.
        const travel =
          loopDuration > 0
            ? ((t % loopDuration) * 48) / loopDuration
            : t * cloud.speed;
        const x = ((cloud.x + travel + 24) % 48) - 24;
        cloud.mesh.position.set(
          x,
          cloud.y +
            Math.sin(loopPhase(t, 0.11, loopDuration) + cloud.phase) *
              (0.035 + breeze * 0.025),
          cloud.z +
            Math.cos(loopPhase(t, 0.019, loopDuration) + cloud.phase) * 0.3,
        );
      }

      // Bounded overhead loop across the upper water; never descends into the
      // swan's route. No modulo teleport or per-frame random positions.
      const phase = loopPhase(t, 0.058, loopDuration) - 0.85;
      birdGroup.position.set(
        2.2 + Math.sin(phase) * 3.1,
        3.1,
        -5.9 + Math.cos(phase) * 1.25,
      );
      birdGroup.rotation.y = Math.atan2(
        Math.cos(phase) * 3.1,
        -Math.sin(phase) * 1.25,
      );
      for (const bird of flyingBirds) {
        const beat = loopPhase(t, 4.9, loopDuration) + bird.phase;
        const flap = 0.14 + Math.sin(beat) * 0.34;
        bird.left.rotation.z = -flap;
        bird.right.rotation.z = flap;
        bird.bird.position.set(
          bird.x +
            Math.sin(loopPhase(t, 0.43, loopDuration) + bird.phase) * 0.035,
          Math.sin(beat - 0.4) * 0.035 +
            Math.sin(loopPhase(t, 0.3, loopDuration) + bird.phase) * 0.055,
          bird.z,
        );
        bird.bird.rotation.z =
          Math.sin(loopPhase(t, 0.29, loopDuration) + bird.phase) * 0.045;
      }
    },
    setClouds(visible) {
      cloudGroup.visible = visible;
    },
    setBirds(visible) {
      birdGroup.visible = visible;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      group.removeFromParent();
      group.clear();
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      geometries.clear();
      materials.clear();
    },
  };
  atmosphere.update(0, 0.55);
  return atmosphere;
}
