import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  Box3,
  CatmullRomCurve3,
  OrthographicCamera,
  Plane,
  Raycaster,
  Vector2,
  Vector3,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { frameLake } from "../src/scene/framing.ts";

// The authored swimming loop and model scale from world.ts. Use the shipped
// model's actual bounds so a later bird-size change cannot silently crop it.
const route = new CatmullRomCurve3(
  [
    new Vector3(1.9, 0, 2.3),
    new Vector3(4, 0, -0.7),
    new Vector3(2, 0, -4.2),
    new Vector3(-1.2, 0, -3.2),
    new Vector3(-1.8, 0, 0.4),
    new Vector3(-0.2, 0, 3),
  ],
  true,
  "centripetal",
);
const newCamera = () => new OrthographicCamera(-12, 12, 8.5, -8.5, 0.1, 100);
const shoreX = (z: number) =>
  -8.05 + 2.9 * Math.cos((z / 23) * Math.PI) +
  0.19 * Math.sin(z * 0.66) +
  0.09 * Math.sin(z * 1.7 + 0.4 * Math.sin(z * 0.7)) +
  0.035 * Math.sin(z * 4.7);

function visibleBank(camera: OrthographicCamera) {
  const raycaster = new Raycaster();
  const plane = new Plane(new Vector3(0, 1, 0), -0.18);
  const point = new Vector3();
  const screen = new Vector2();
  let total = 0;
  let upperLeft = 0;
  // Equal screen-area samples compare the visible bank's proportion rather
  // than its world area, which would grow merely by zooming further out.
  for (let row = 0; row < 100; row++) {
    for (let col = 0; col < 100; col++) {
      screen.set(((col + 0.5) / 100) * 2 - 1, ((row + 0.5) / 100) * 2 - 1);
      raycaster.setFromCamera(screen, camera);
      if (!raycaster.ray.intersectPlane(plane, point)) continue;
      if (point.x > -48 && point.x < shoreX(point.z) && Math.abs(point.z) < 42) {
        total++;
        if (screen.x < 0 && screen.y > 0) upperLeft++;
      }
    }
  }
  return { total, upperLeft };
}

test("9:16 framing retains the full swan with body padding throughout the swimming loop", async () => {
  const bytes = readFileSync(new URL("../public/models/swan.glb", import.meta.url));
  const gltf = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    "",
  );
  const bounds = new Box3().setFromObject(gltf.scene).expandByScalar(0.1);
  const axis = new Vector3(0, 1, 0);
  const camera = newCamera();
  try {
    // Switching aspect for recording and then returning to portrait must use
    // the same safe composition, including fresh projection/view matrices.
    for (const aspect of [9 / 16, 16 / 9, 9 / 16]) {
      frameLake(camera, aspect);
      for (let step = 0; step <= 360; step++) {
        const u = step / 360;
        const position = route.getPointAt(u);
        position.y = -0.045;
        const tangent = route.getTangentAt(u);
        const heading = Math.atan2(tangent.x, tangent.z);
        for (const x of [bounds.min.x, bounds.max.x]) {
          for (const y of [bounds.min.y, bounds.max.y]) {
            for (const z of [bounds.min.z, bounds.max.z]) {
              const projected = new Vector3(x, y, z)
                .multiplyScalar(1.12)
                .applyAxisAngle(axis, heading)
                .add(position)
                .project(camera);
              assert.ok(
                Math.abs(projected.x) <= 1 && Math.abs(projected.y) <= 1 && Math.abs(projected.z) <= 1,
                `padded swan cropped at aspect=${aspect}, route=${u.toFixed(3)}: ${projected.toArray()}`,
              );
            }
          }
        }
      }
    }
  } finally {
    gltf.scene.traverse((node) => {
      if (!("isMesh" in node) || !node.isMesh) return;
      const mesh = node as import("three").Mesh;
      mesh.geometry.dispose();
      (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((material) => material.dispose());
    });
  }
});

test("portrait shows substantially more planted upper-left bank while retaining nearby shoreline", () => {
  const aspect = 9 / 16;
  const old = new OrthographicCamera(-9.6 * aspect, 9.6 * aspect, 9.6, -9.6, 0.1, 100);
  old.position.set(12, 17, 22);
  old.lookAt(-0.5, 0, -0.3);
  old.updateProjectionMatrix();
  old.updateMatrixWorld();
  const current = newCamera();
  frameLake(current, aspect);
  const before = visibleBank(old);
  const after = visibleBank(current);
  assert.ok(after.total > before.total * 1.2, "the bank should gain meaningful screen area");
  assert.ok(after.upperLeft > before.upperLeft * 1.2, "the requested upper-left meadow should visibly grow");
  for (const z of [-12, -8, -4, 0, 4]) {
    const projected = new Vector3(shoreX(z) - 0.2, 0.18, z).project(current);
    assert.ok(Math.abs(projected.x) < 1 && Math.abs(projected.y) < 1, `near-shore grass is cropped at z=${z}`);
  }
});
