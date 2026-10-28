import { Color, MeshBasicMaterial, WebGLRenderTarget } from "three";
import type { Camera, Scene, WebGLRenderer } from "three";
import { Pass } from "three/addons/postprocessing/Pass.js";

/** One white silhouette for all swan meshes: feather overlaps produce no ink. */
export class SwanMaskPass extends Pass {
  readonly target = new WebGLRenderTarget(1, 1, { samples: 4 });
  private readonly material = new MeshBasicMaterial({ color: 0xffffff });
  private scene: Scene;
  private camera: Camera;
  constructor(scene: Scene, camera: Camera) {
    super();
    this.scene = scene;
    this.camera = camera;
    this.needsSwap = false;
  }
  setSize(width: number, height: number) {
    this.target.setSize(width, height);
  }
  render(renderer: WebGLRenderer) {
    const layers = this.camera.layers.mask;
    const background = this.scene.background;
    const override = this.scene.overrideMaterial;
    const target = renderer.getRenderTarget();
    const clear = renderer.getClearColor(new Color());
    const alpha = renderer.getClearAlpha();
    const autoClear = renderer.autoClear;
    const shadows = renderer.shadowMap.autoUpdate;
    try {
      this.camera.layers.set(1);
      this.scene.background = new Color(0);
      this.scene.overrideMaterial = this.material;
      renderer.shadowMap.autoUpdate = false;
      renderer.autoClear = true;
      renderer.setRenderTarget(this.target);
      renderer.setClearColor(0, 1);
      renderer.clear();
      renderer.render(this.scene, this.camera);
    } finally {
      this.camera.layers.mask = layers;
      this.scene.background = background;
      this.scene.overrideMaterial = override;
      renderer.shadowMap.autoUpdate = shadows;
      renderer.autoClear = autoClear;
      renderer.setRenderTarget(target);
      renderer.setClearColor(clear, alpha);
    }
  }
  dispose() {
    this.target.dispose();
    this.material.dispose();
  }
}
