import {
  AmbientLight,
  CatmullRomCurve3,
  Color,
  DirectionalLight,
  Group,
  Mesh,
  OrthographicCamera,
  PCFShadowMap,
  Scene,
  ShaderMaterial,
  Vector3,
  WebGLRenderer,
  SRGBColorSpace,
  NoToneMapping,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { createLandscape } from "./landscape";
import { createToonMaterial, updatePaletteLighting } from "./materials";
import { advanceDistance } from "./motion";
import { createWater } from "./water";
import { palettes, type PaletteId } from "./palettes";
import { createSwanMotion } from "./swan";
import { createAtmosphere } from "./atmosphere";

export interface WorldOptions {
  onReady(): void;
  onError(message: string): void;
  onFrame?(time: number): void;
}

export async function createWorld(
  container: HTMLElement,
  options: WorldOptions,
) {
  const renderer = new WebGLRenderer({
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NoToneMapping;
  renderer.setClearColor("#f4f3e9", 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  renderer.domElement.setAttribute("role", "img");
  renderer.domElement.setAttribute(
    "aria-label",
    "An illustrated lake with a white swan, a wind-swept grassy shore, passing clouds and flying birds.",
  );
  container.append(renderer.domElement);

  const scene = new Scene();
  scene.background = new Color("#d7e2cd");
  const camera = new OrthographicCamera(-12, 12, 8.5, -8.5, 0.1, 100);
  const cameraTarget = new Vector3(-0.5, 0, -0.3);
  const basePosition = new Vector3(12, 17, 22);
  camera.position.copy(basePosition);
  camera.lookAt(cameraTarget);

  const sun = new DirectionalLight("#fff1d3", 2);
  sun.position.set(-5, 9, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -18,
    right: 18,
    top: 18,
    bottom: -18,
    near: 0.5,
    far: 48,
  });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.04;
  sun.shadow.radius = 3;
  sun.shadow.intensity = 0.55;
  scene.add(sun, new AmbientLight("#e8ecd8", 1.2));

  const landscape = createLandscape();
  scene.add(landscape.group);
  const water = createWater();
  scene.add(water.mesh);

  const bird = new Group();
  bird.name = "White swan";
  bird.scale.setScalar(1.12);
  scene.add(bird);
  const birdMaterials = {
    body: createToonMaterial(["#8b9e9b", "#c1cfca", "#e8e9d9", "#fff9e8"]),
    wing: createToonMaterial(["#829797", "#b5c9c1", "#e0e5d3", "#f7f2df"]),
    beak: createToonMaterial(["#824b35", "#b56c3b", "#d89b4c", "#eab86b"]),
    dark: createToonMaterial(["#182f2b", "#223c33", "#344938", "#536347"]),
  };
  const loader = new GLTFLoader();
  let swanMotion: ReturnType<typeof createSwanMotion>;
  try {
    const gltf = await loader.loadAsync(
      `${import.meta.env.BASE_URL}models/swan.glb`,
    );
    gltf.scene.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const source = Array.isArray(object.material)
        ? object.material[0]
        : object.material;
      const name = source.name.toLowerCase();
      object.material = name.includes("beak")
        ? birdMaterials.beak
        : name.includes("dark")
          ? birdMaterials.dark
          : name.includes("wing")
            ? birdMaterials.wing
            : birdMaterials.body;
      source.dispose();
      object.castShadow = true;
      object.receiveShadow = true;
    });
    bird.add(gltf.scene);
    swanMotion = createSwanMotion(gltf.scene);
  } catch {
    options.onError(
      "The swan could not be loaded. Please refresh to try again.",
    );
    landscape.dispose();
    water.dispose();
    Object.values(birdMaterials).forEach((m) => m.dispose());
    renderer.dispose();
    throw new Error("Unable to load the swan model");
  }

  const atmosphere = createAtmosphere();
  scene.add(atmosphere.group);

  // Gentle closed route, entirely inside the open part of the lake.
  const route = new CatmullRomCurve3(
    [
      new Vector3(1.9, 0, 2.3),
      new Vector3(4, 0, -0.7),
      new Vector3(2.0, 0, -4.2),
      new Vector3(-1.2, 0, -3.2),
      new Vector3(-1.8, 0, 0.4),
      new Vector3(-0.2, 0, 3.0),
    ],
    true,
    "centripetal",
  );
  const routeLength = route.getLength();
  let distance = routeLength * 0.76;
  let elapsed = 0;
  let lastStamp = 0;
  let paused = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let wind = 0.55;
  let activity = 0.65;
  let warmth = 0;
  let targetWarmth = 0;
  let lastReadout = -1;
  let disposed = false;
  let needsRender = true;
  const morningBackground = new Color("#d7e2cd");
  const eveningBackground = new Color("#dbe0c6");
  const morningSun = new Vector3(-5, 9, 5);
  const eveningSun = new Vector3(-10, 4.7, 4.1);
  const position = new Vector3();
  const tangent = new Vector3();
  const tail = new Vector3();

  function resize() {
    needsRender = true;
    const { width, height } = container.getBoundingClientRect();
    if (width < 1 || height < 1) return;
    renderer.setSize(width, height, false);
    const aspect = width / height;
    const halfHeight = aspect < 0.9 ? 9.6 : 8.7;
    camera.left = -halfHeight * aspect;
    camera.right = halfHeight * aspect;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();

  function frame(stamp: number) {
    if (disposed) return;
    const dt = lastStamp ? Math.min((stamp - lastStamp) / 1000, 0.08) : 0;
    lastStamp = stamp;
    if (document.hidden) return;
    if (paused && !needsRender && Math.abs(targetWarmth - warmth) < 0.001)
      return;
    warmth += (targetWarmth - warmth) * (1 - Math.exp(-dt * 3));
    if (!paused) {
      elapsed += dt;
      distance = advanceDistance(distance, dt, 0.24, routeLength);
    }
    route.getPointAt(distance / routeLength, position);
    route.getTangentAt(distance / routeLength, tangent);
    bird.position.copy(position);
    bird.position.y = Math.sin(elapsed * 1.5) * 0.012 - 0.045;
    bird.rotation.y = Math.atan2(tangent.x, tangent.z);
    bird.rotation.z = Math.sin(elapsed * 1.15) * 0.012;
    tail.copy(position).addScaledVector(tangent, -1.1);
    swanMotion.update(elapsed, activity);
    atmosphere.update(elapsed, wind);
    landscape.update(elapsed, wind);
    updatePaletteLighting(elapsed, warmth);
    water.update(elapsed, wind, warmth, position.x, position.z, tail.x, tail.z);
    (scene.background as Color)
      .copy(morningBackground)
      .lerp(eveningBackground, warmth);
    sun.position.copy(morningSun).lerp(eveningSun, warmth);
    renderer.render(scene, camera);
    needsRender = false;
    if (Math.floor(elapsed) !== lastReadout) {
      lastReadout = Math.floor(elapsed);
      options.onFrame?.(elapsed);
    }
  }
  // Compile once so loading ends only after the first real frame is ready.
  frame(performance.now());
  options.onReady();
  renderer.setAnimationLoop(frame);

  const onContextLost = (event: Event) => {
    event.preventDefault();
    options.onError(
      "The landscape has paused unexpectedly. Please refresh to restore it.",
    );
  };
  renderer.domElement.addEventListener("webglcontextlost", onContextLost);

  return {
    get paused() {
      return paused;
    },
    togglePause() {
      paused = !paused;
      needsRender = true;
      return paused;
    },
    setPalette(id: PaletteId) {
      if (!(id in palettes)) return;
      water.setPalette(id);
      landscape.setPalette(id);
      morningBackground.set(palettes[id].sky);
      eveningBackground.set(palettes[id].sky).lerp(new Color("#eed9b3"), 0.12);
      needsRender = true;
    },
    setActivity(value: number) {
      activity = Math.min(1, Math.max(0, value));
      needsRender = true;
    },
    setClouds(visible: boolean) {
      atmosphere.setClouds(visible);
      needsRender = true;
    },
    setBirds(visible: boolean) {
      atmosphere.setBirds(visible);
      needsRender = true;
    },
    setWind(value: number) {
      wind = Math.min(1, Math.max(0, value));
      needsRender = true;
    },
    setWarmth(value: number) {
      targetWarmth = value;
      needsRender = true;
    },
    async saveImage() {
      renderer.render(scene, camera);
      const blob = await new Promise<Blob | null>((resolve) =>
        renderer.domElement.toBlob(resolve, "image/png"),
      );
      if (!blob) throw new Error("Could not export the lake image");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "crescent-lake.png";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      renderer.setAnimationLoop(null);
      observer.disconnect();
      renderer.domElement.removeEventListener(
        "webglcontextlost",
        onContextLost,
      );
      landscape.dispose();
      water.dispose();
      atmosphere.dispose();
      sun.shadow.dispose();
      bird.traverse((object) => {
        if (object instanceof Mesh) object.geometry.dispose();
      });
      Object.values(birdMaterials).forEach((material: ShaderMaterial) =>
        material.dispose(),
      );
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
