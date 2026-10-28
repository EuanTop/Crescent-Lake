import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Color,
  MeshBasicMaterial,
  OrthographicCamera,
  Scene,
  WebGLRenderTarget,
} from "three";
import type { Camera, WebGLRenderer } from "three";
import { SwanMaskPass } from "../src/scene/swan-mask.ts";

for (const throws of [false, true]) {
  test(`swan silhouette restores scene, camera, and renderer state ${throws ? "when rendering throws" : "after a successful render"}`, () => {
    const scene = new Scene();
    const camera = new OrthographicCamera();
    camera.layers.set(0);
    camera.layers.enable(3);
    camera.layers.enable(5);
    const originalLayers = camera.layers.mask;
    const background = new Color("#345678");
    const originalMaterial = new MeshBasicMaterial({ color: "#856348" });
    scene.background = background;
    scene.overrideMaterial = originalMaterial;
    const originalTarget = throws ? null : new WebGLRenderTarget(640, 360);
    const pass = new SwanMaskPass(scene, camera);
    const initialColor = new Color("#789abc");
    const clearColor = initialColor.clone();
    let clearAlpha = 0.37;
    let target = originalTarget;
    let cleared = false;
    let renderCalls = 0;
    const error = new Error("intentional mask draw failure");
    const renderer = {
      autoClear: false,
      shadowMap: { autoUpdate: true },
      getRenderTarget() { return target; },
      setRenderTarget(value: WebGLRenderTarget | null) { target = value; },
      getClearColor(output: Color) { return output.copy(clearColor); },
      getClearAlpha() { return clearAlpha; },
      setClearColor(color: Color | number, alpha: number) {
        clearColor.set(color);
        clearAlpha = alpha;
      },
      clear() {
        assert.equal(target, pass.target);
        assert.equal(clearColor.getHex(), 0);
        assert.equal(clearAlpha, 1);
        cleared = true;
      },
      render(renderScene: Scene, renderCamera: Camera) {
        renderCalls++;
        assert.equal(renderScene, scene);
        assert.equal(renderCamera, camera);
        assert.equal(camera.layers.mask, 1 << 1, "only the dedicated swan layer belongs in the mask");
        assert.ok(scene.background instanceof Color);
        assert.equal((scene.background as Color).getHex(), 0);
        assert.ok(scene.overrideMaterial instanceof MeshBasicMaterial);
        assert.equal((scene.overrideMaterial as MeshBasicMaterial).color.getHex(), 0xffffff);
        assert.notEqual(scene.overrideMaterial, originalMaterial);
        assert.equal(renderer.autoClear, true);
        assert.equal(renderer.shadowMap.autoUpdate, false);
        assert.equal(target, pass.target);
        assert.equal(cleared, true);
        if (throws) throw error;
      },
    };
    try {
      if (throws) assert.throws(() => pass.render(renderer as unknown as WebGLRenderer), (caught) => caught === error);
      else pass.render(renderer as unknown as WebGLRenderer);
      assert.equal(renderCalls, 1);
      assert.equal(camera.layers.mask, originalLayers);
      assert.equal(scene.background, background, "restore the original background object");
      assert.equal(scene.overrideMaterial, originalMaterial);
      assert.equal(target, originalTarget);
      assert.deepEqual(clearColor.toArray(), initialColor.toArray());
      assert.equal(clearAlpha, 0.37);
      assert.equal(renderer.autoClear, false);
      assert.equal(renderer.shadowMap.autoUpdate, true);
      assert.equal(pass.needsSwap, false, "a side mask must not swap the main color buffers");
    } finally {
      pass.dispose();
      originalMaterial.dispose();
      originalTarget?.dispose();
    }
  });
}

test("mask resizing retains its texture identity and disposal releases its owned target and material", () => {
  const scene = new Scene();
  const camera = new OrthographicCamera();
  const pass = new SwanMaskPass(scene, camera);
  const texture = pass.target.texture;
  pass.setSize(1080, 1920);
  assert.equal(pass.target.width, 1080);
  assert.equal(pass.target.height, 1920);
  assert.equal(pass.target.texture, texture, "the style shader keeps its original texture reference");
  assert.equal(pass.target.samples, 4);
  let targetDisposed = 0;
  let materialDisposed = 0;
  pass.target.addEventListener("dispose", () => targetDisposed++);
  const renderer = {
    autoClear: true,
    shadowMap: { autoUpdate: false },
    getRenderTarget: () => null,
    setRenderTarget() {},
    getClearColor: (color: Color) => color.set(0),
    getClearAlpha: () => 1,
    setClearColor() {},
    clear() {},
    render() {
      scene.overrideMaterial!.addEventListener("dispose", () => materialDisposed++);
    },
  };
  pass.render(renderer as unknown as WebGLRenderer);
  assert.equal(renderer.autoClear, true);
  assert.equal(renderer.shadowMap.autoUpdate, false);
  assert.equal(scene.overrideMaterial, null);
  pass.dispose();
  assert.equal(targetDisposed, 1);
  assert.equal(materialDisposed, 1);
});
