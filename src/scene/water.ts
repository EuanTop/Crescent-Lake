import {
  Color,
  Matrix4,
  PlaneGeometry,
  ShaderMaterial,
  Vector2,
  Vector4,
} from "three";
import { Reflector } from "three/addons/objects/Reflector.js";
import { palettes, type PaletteId } from "./palettes";
import {
  advanceWindPhase,
  WAKE_CAPACITY,
  WAKE_LIFETIME,
  WakeHistory,
  wakeStrength,
} from "./motion";

export function createWater() {
  const wakeUniform = Array.from(
    { length: WAKE_CAPACITY },
    () => new Vector4(0, 0, -100, 0),
  );
  const wakeDirections = Array.from(
    { length: WAKE_CAPACITY },
    () => new Vector2(0, 1),
  );
  const geometry = new PlaneGeometry(70, 70);
  const water = new Reflector(geometry, {
    textureWidth: 1024,
    textureHeight: 1024,
    multisample: 0,
    clipBias: 0.002,
    shader: {
      name: "Painted lake and world-space wakes",
      uniforms: {
        color: { value: new Color("#85aa9f") },
        tDiffuse: { value: null },
        textureMatrix: { value: new Matrix4() },
        uDeep: { value: new Color(palettes.sage.deep) },
        uPale: { value: new Color(palettes.sage.pale) },
        uReflectionTint: { value: new Color(palettes.sage.reflection) },
        uTime: { value: 0 },
        uWindPhase: { value: 0 },
        uWind: { value: 0.4 },
        uWarmth: { value: 0 },
        uBird: { value: new Vector2() },
        uWakes: { value: wakeUniform },
        uWakeDirections: { value: wakeDirections },
        uWakeCount: { value: 0 },
        uReflection: { value: 0.32 },
      },
      vertexShader: /* glsl */ `
        uniform mat4 textureMatrix;
        varying vec4 vReflection;
        varying vec3 vWorld;
        void main() {
          vReflection = textureMatrix * vec4(position, 1.0);
          vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse;
        uniform vec3 uDeep, uPale, uReflectionTint;
        uniform float uTime, uWindPhase, uWind, uWarmth, uReflection;
        uniform vec2 uBird;
        uniform vec4 uWakes[${WAKE_CAPACITY}];
        uniform vec2 uWakeDirections[${WAKE_CAPACITY}];
        uniform int uWakeCount;
        varying vec4 vReflection;
        varying vec3 vWorld;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p) {
          vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)),f.x),f.y);
        }
        void main() {
          vec2 p = vWorld.xz;
          // Coherent wind from the upper-left bank toward open water. All
          // traveling fields use an integrated clock, independent of amplitude.
          vec2 flow = normalize(vec2(0.84, 0.54));
          vec2 acrossFlow = vec2(-flow.y, flow.x);
          float along = dot(p, flow);
          float across = dot(p, acrossFlow);
          float phase = uWindPhase;
          float n = noise(p * 0.31);
          float gust = smoothstep(0.20, 0.78,
            noise(vec2(along * 0.22 - phase * 0.12, across * 0.19)));
          float gustEnvelope = 0.33 + gust * 0.67;
          float bend = sin(across * 0.71) * 0.46 + (n - 0.5) * 0.7;
          float wave = sin(along * 5.4 - phase * 5.4 + bend);
          float fineWave = sin(along * 10.7 - phase * 9.5 + sin(across * 1.4) * 0.55);
          float crests = smoothstep(0.67, 0.99, wave) * gustEnvelope;
          // A finer, elongated noise field follows the same moving flow rather
          // than scattering stationary glitter dots over the surface.
          float streaks = smoothstep(0.68, 0.89,
            noise(vec2(along * 0.64 - phase * 0.47, across * 6.3)));
          float detail = smoothstep(0.80, 0.995, fineWave) * (0.25 + gust * 0.75);
          // Fine scales emerge more strongly in fresh wind without changing
          // their spatial frequency (which would jump the texture's phase).
          float fineStrength = uWind * uWind;
          float windLight = crests * 0.56 * uWind
            + (streaks * 0.28 + detail * 0.24) * fineStrength;
          float windDark = smoothstep(0.30, 0.94, -wave) * gustEnvelope * uWind;
          vec2 distortion = (flow * wave + acrossFlow * fineWave * 0.38)
            * (0.0007 + uWind * 0.0031) * uWind * gustEnvelope;
          float wakeLight = 0.0;
          float wakeDark = 0.0;
          for (int i = 0; i < ${WAKE_CAPACITY}; i++) {
            if (i >= uWakeCount) break;
            float age = uTime - uWakes[i].z;
            if (age <= 0.0 || age >= ${WAKE_LIFETIME.toFixed(4)}) continue;
            vec2 d = p - uWakes[i].xy;
            // Skip most fragments before doing the exponential ridge work.
            float radius = 0.19 + age * 0.105;
            float width = 0.060 + age * 0.0045;
            float distanceSquared = dot(d, d);
            float reach = radius + width * 3.0;
            if (distanceSquared > reach * reach && (age > 3.5 || distanceSquared > 1.96)) continue;
            float r = sqrt(distanceSquared);
            vec2 heading = uWakeDirections[i];
            float forward = dot(d, heading);
            float rearArc = 1.0 - smoothstep(0.04, 0.62, forward / max(r, 0.001));
            float front = (r - radius) / width;
            // Fade is computed once per point on the CPU from wakeStrength(),
            // avoiding dozens of redundant exponential evaluations per pixel.
            float strength = uWakes[i].w;
            float ridge = exp(-front * front) * strength * rearArc;
            float shadowFront = (r - radius + width * 1.1) / (width * 0.75);
            float darkRidge = exp(-shadowFront * shadowFront) * strength * rearArc;
            // The freshest marks also form a small oriented V. Its heading is
            // captured at emission, so previous bends remain in the trail.
            if (age < 3.5) {
              float behind = -forward;
              float lateral = abs(dot(d, vec2(-heading.y, heading.x)));
              float arm = (lateral - (0.15 + max(behind, 0.0) * 0.42)) / (0.050 + age * 0.008);
              float vMask = smoothstep(0.0, 0.20, behind)
                * (1.0 - smoothstep(0.75, 1.20, behind))
                * (1.0 - smoothstep(2.0, 3.5, age));
              ridge = max(ridge, exp(-arm * arm) * strength * vMask * 0.85);
            }
            wakeLight = max(wakeLight, ridge);
            wakeDark = max(wakeDark, darkRidge);
            distortion += d / max(r, 0.001) * ridge * 0.00055;
          }
          // Broad transparent washes, kept intentionally quieter than the bird.
          vec3 deep = uDeep;
          vec3 pale = uPale;
          vec3 col = mix(deep, pale, smoothstep(0.1, 0.9, n) * 0.73);
          col += sin(p.y*0.19 + p.x*0.13) * 0.018;
          float reflectionGuard = exp(-dot((p-uBird)/vec2(1.1,1.6),(p-uBird)/vec2(1.1,1.6)));
          vec4 reflectedUv = vReflection;
          reflectedUv.xy += distortion * mix(1.0, 0.24, reflectionGuard) * reflectedUv.w;
          vec3 reflection = texture2DProj(tDiffuse, reflectedUv).rgb;
          // Reflection is mixed into the water wash, never a polished mirror.
          col = mix(col, reflection * uReflectionTint, uReflection);
          // Wind creates a clear light/dark rhythm and moving gust patches in
          // every palette, with no wind-driven animation at strength zero.
          float rippleVisibility = mix(1.0, 0.38, reflectionGuard);
          col *= 1.0 - windDark * 0.20 * rippleVisibility;
          vec3 rippleColor = mix(uPale, vec3(0.94, 0.96, 0.90), 0.28);
          col = mix(col, rippleColor, windLight * 0.45 * rippleVisibility);
          col *= 1.0 - wakeDark * 0.23;
          vec3 wakeColor = mix(uPale, vec3(0.98, 0.99, 0.94), 0.58);
          col = mix(col, wakeColor, wakeLight * 0.57);
          float contact = exp(-dot((p-uBird)/vec2(0.48,0.78),(p-uBird)/vec2(0.48,0.78))*2.0);
          col *= 1.0 - contact * 0.13;
          col = mix(col, col * vec3(1.06,0.99,0.92) + vec3(0.025,0.012,0.004), uWarmth);
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    },
  });
  water.rotation.x = -Math.PI / 2;
  water.name = "Crescent lake — planar reflection";
  const material = water.material as ShaderMaterial;
  const history = new WakeHistory();
  let lastTime: number | undefined;
  let windPhase = 0;
  return {
    mesh: water,
    history,
    update(
      time: number,
      wind: number,
      warmth: number,
      x: number,
      z: number,
      tailX: number,
      tailZ: number,
    ) {
      const now = Number.isFinite(time) ? Math.max(0, time) : (lastTime ?? 0);
      const strength = Number.isFinite(wind)
        ? Math.min(1, Math.max(0, wind))
        : 0;
      if (lastTime !== undefined && now < lastTime) windPhase = 0;
      windPhase = advanceWindPhase(
        windPhase,
        lastTime === undefined ? 0 : now - lastTime,
        strength,
      );
      lastTime = now;
      history.sample(now, tailX, tailZ);
      material.uniforms.uTime.value = now;
      material.uniforms.uWindPhase.value = windPhase;
      material.uniforms.uWind.value = strength;
      material.uniforms.uWarmth.value = warmth;
      if (Number.isFinite(x) && Number.isFinite(z))
        material.uniforms.uBird.value.set(x, z);
      material.uniforms.uWakeCount.value = history.points.length;
      const points = material.uniforms.uWakes.value as Vector4[];
      history.points.forEach((point, i) => {
        points[i].set(
          point.x,
          point.z,
          point.born,
          wakeStrength(now - point.born),
        );
        const direction = history.directionFor(point);
        wakeDirections[i].set(direction.x, direction.z);
      });
    },
    setPalette(id: PaletteId) {
      const palette = palettes[id];
      material.uniforms.uDeep.value.set(palette.deep);
      material.uniforms.uPale.value.set(palette.pale);
      material.uniforms.uReflectionTint.value.set(palette.reflection);
    },
    setReflection(value: number) {
      material.uniforms.uReflection.value = value;
    },
    dispose() {
      geometry.dispose();
      water.dispose();
    },
  };
}
