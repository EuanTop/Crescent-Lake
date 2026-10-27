import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("the shipped swan is a self-contained valid GLB without missing external resources", () => {
  const bytes = readFileSync(
    new URL("../public/models/swan.glb", import.meta.url),
  );
  assert.equal(bytes.toString("ascii", 0, 4), "glTF");
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  const jsonLength = bytes.readUInt32LE(12);
  assert.equal(bytes.readUInt32LE(16), 0x4e4f534a);
  const gltf = JSON.parse(bytes.toString("utf8", 20, 20 + jsonLength));
  assert.ok(gltf.meshes.length > 0);
  assert.ok(!gltf.buffers.some((buffer: { uri?: string }) => buffer.uri));
  assert.ok(!gltf.images?.length);
  assert.ok(!gltf.cameras?.length);
  assert.ok(!gltf.extensionsRequired?.length);
  assert.ok(
    gltf.materials.every((material: { name: string }) =>
      /body|wing|beak|dark/.test(material.name),
    ),
  );
});
