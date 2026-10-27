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
import { WAKE_CAPACITY, WakeHistory } from "./motion";

export function createWater() {
  const wakeUniform = Array.from(
    { length: WAKE_CAPACITY },
    () => new Vector4(0, 0, -100, 0),
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
        uWind: { value: 0.4 },
        uWarmth: { value: 0 },
        uBird: { value: new Vector2() },
        uWakes: { value: wakeUniform },
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
        uniform float uTime, uWind, uWarmth, uReflection;
        uniform vec2 uBird;
        uniform vec4 uWakes[${WAKE_CAPACITY}];
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
          float t = uTime * (0.11 + uWind * 0.13);
          float n = noise(p * 0.31 + vec2(t * 0.35, -t * 0.23));
          float small = noise(p * vec2(1.8, 3.0) + vec2(t * 0.8, t));
          float wave = sin(p.x*2.1 + p.y*3.5 + t*3.0 + n*6.0);
          float wave2 = sin(p.x*4.0 - p.y*2.0 - t*2.1 + small*2.0);
          vec2 distortion = vec2(wave, wave2) * (0.0015 + uWind*0.0017);
          float wakeLight = 0.0;
          float wakeDark = 0.0;
          for (int i = 0; i < ${WAKE_CAPACITY}; i++) {
            if (i >= uWakeCount) break;
            float age = uTime - uWakes[i].z;
            if (age < 0.0 || age > 7.0) continue;
            vec2 d = p - uWakes[i].xy;
            float r = length(d);
            float front = r - (0.2 + age * 0.38);
            float envelope = exp(-front*front * 100.0) * exp(-age * 0.44) * min(1.0, age*6.0);
            // Separate expanding ridges rather than a uniformly bright solid circle.
            float ridge = envelope * (0.55 + 0.45*sin(atan(d.y,d.x)*3.0 + age));
            wakeLight = max(wakeLight, ridge);
            wakeDark = max(wakeDark, exp(-pow(front+0.06,2.0)*140.0) * exp(-age*0.5));
            distortion += normalize(d + vec2(0.0001)) * envelope * 0.0018;
          }
          // Broad transparent washes, kept intentionally quieter than the bird.
          vec3 deep = uDeep;
          vec3 pale = uPale;
          vec3 col = mix(deep, pale, smoothstep(0.1, 0.9, n) * 0.73);
          col += sin(p.y*0.19 + p.x*0.13) * 0.018;
          vec4 reflectedUv = vReflection;
          reflectedUv.xy += distortion * reflectedUv.w;
          vec3 reflection = texture2DProj(tDiffuse, reflectedUv).rgb;
          // Reflection is mixed into the water wash, never a polished mirror.
          col = mix(col, reflection * uReflectionTint, uReflection);
          float spark = smoothstep(0.93, 1.0, wave*0.5+0.5) * smoothstep(0.61,0.78,small);
          col += vec3(0.19,0.18,0.12) * spark * (0.13+uWind*0.12);
          col -= wakeDark * vec3(0.025, 0.032, 0.025);
          col += wakeLight * vec3(0.14, 0.16, 0.12);
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
      history.sample(time, tailX, tailZ);
      material.uniforms.uTime.value = time;
      material.uniforms.uWind.value = wind;
      material.uniforms.uWarmth.value = warmth;
      material.uniforms.uBird.value.set(x, z);
      material.uniforms.uWakeCount.value = history.points.length;
      const points = material.uniforms.uWakes.value as Vector4[];
      history.points.forEach((point, i) =>
        points[i].set(point.x, point.z, point.born, 1),
      );
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
