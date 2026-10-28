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
import { GOLDEN_WATER_LIGHT, lightingAmount } from "./lighting";
import { loopWind } from "./wind-loop";
import {
  advanceWindPhase,
  WAKE_CAPACITY,
  WAKE_LIFETIME,
  WakeHistory,
  wakeStrength,
  windResponse,
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
        uGoldenWaterLight: { value: new Color(GOLDEN_WATER_LIGHT) },
        uTime: { value: 0 },
        uWindPhase: { value: 0 },
        uLoopDuration: { value: 0 },
        uLoopAngle: { value: 0 },
        uLoopOrbit: { value: new Vector2() },
        uLoopWaterRate: { value: 0 },
        uWaveCycles: { value: 0 },
        uSwayCycles: { value: 0 },
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
        uniform vec3 uDeep, uPale, uReflectionTint, uGoldenWaterLight;
        uniform float uTime, uWindPhase, uWind, uWarmth, uReflection;
        uniform float uLoopDuration,uLoopAngle,uLoopWaterRate,uWaveCycles,uSwayCycles;
        uniform vec2 uLoopOrbit;
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
        // Value noise with its analytic gradient: two moving scales can light
        // local water slopes without imposing any periodic, lake-wide stripes.
        vec3 noiseGradient(vec2 p) {
          vec2 i = floor(p),f = fract(p);
          vec2 u = f*f*(3.0-2.0*f),du = 6.0*f*(1.0-f);
          float a = hash(i),b = hash(i+vec2(1,0));
          float c = hash(i+vec2(0,1)),d = hash(i+vec2(1,1));
          float value = mix(mix(a,b,u.x),mix(c,d,u.x),u.y);
          vec2 gradient = du*vec2(mix(b-a,d-c,u.y),mix(c-a,d-b,u.x));
          return vec3(value,gradient);
        }
        void main() {
          vec2 p = vWorld.xz;
          vec2 flow = normalize(vec2(0.84,0.54));
          float phase = uWindPhase;
          float n = noise(p*0.31);
          // A mirror lake moves in broad swells, not a layer of small ink marks.
          // Two slow, low-frequency fields bend reflected shapes continuously.
          vec2 circulation=flow*phase;
          vec2 crossDrift=vec2(.09,-.12)*phase;
          vec2 waveNoiseDrift=vec2(phase*.018);
          float waveAdvance=phase*.72;
          float swayPhase=phase*.09;
          float segmentDrift=phase*.035;
          if (uLoopDuration>0.) {
            float radius=uLoopWaterRate*uLoopDuration/6.28318530718;
            circulation=(vec2(-flow.y,flow.x)*uLoopOrbit.x+flow*uLoopOrbit.y)*radius;
            crossDrift=uLoopOrbit*vec2(.09,-.12)*radius;
            waveNoiseDrift=uLoopOrbit*radius*.018;
            waveAdvance=uLoopAngle*uWaveCycles;
            swayPhase=uLoopAngle*uSwayCycles;
            segmentDrift=uLoopOrbit.y*radius*.035;
          }
          vec2 drift = p-circulation*0.43;
          vec2 warp = vec2(noise(p*.12+vec2(9.3,2.8)),noise(p*.14+vec2(1.2,7.6)))-.5;
          vec3 swell = noiseGradient(drift*vec2(.23,.32)+warp*.35);
          vec3 crossSwell = noiseGradient(p*vec2(.17,.21)+vec2(17.3,9.1)+crossDrift);
          vec2 slope = swell.yz*.72+crossSwell.yz*.28;
          float localLight = clamp(dot(slope,normalize(vec2(-.57,.82))),-1.,1.);
          float windShade = localLight*uWind*.045;
          // No ridge thresholds, fine noise, foam or repeating stripe pattern.
          vec2 distortion = slope*uWind*.0055;
          // Preserve the lake-wide curved wavefield, but break each crest into
          // its own translucent brush lengths instead of continuous hard bands.
          float across=dot(p,vec2(-flow.y,flow.x));
          float wavePhase=dot(p,flow)*2.45-waveAdvance
            +noise(p*.19+vec2(3.8,7.2)+waveNoiseDrift)*2.3
            +sin(across*.42+swayPhase)*.48;
          float crest=pow(.5+.5*sin(wavePhase),18.);
          float crestShadow=pow(.5+.5*sin(wavePhase-.36),14.);
          float band=floor(wavePhase/6.28318530718);
          if (uLoopDuration>0.) band=mod(band,max(1.,uWaveCycles));
          float bandSeed=hash(vec2(band,17.3));
          float spacing=6.5+hash(vec2(band,41.7))*2.;
          float segmentAxis=across+bandSeed*spacing*2.7+segmentDrift*(bandSeed-.5);
          float slot=floor(segmentAxis/spacing);
          float segments=0.;
          for (int neighbor=-1;neighbor<=1;neighbor++) {
            float id=slot+float(neighbor);
            float segmentLength=mix(1.5,5.,hash(vec2(band+7.3,id+11.2)));
            float jitter=(hash(vec2(band,id+31.7))-.5)*.20;
            float center=(id+.5+jitter)*spacing;
            float distanceToCenter=abs(segmentAxis-center);
            // Each end fades over thirty percent of its own length. Neighbor
            // bands use unrelated phases/lengths, so no shared cut columns.
            float endFade=segmentLength*.30;
            float gate=1.-smoothstep(segmentLength*.5-endFade,segmentLength*.5,distanceToCenter);
            segments=max(segments,gate);
          }
          float opening=smoothstep(.14,.58,noise(p*.28-circulation*.035+vec2(9.2,2.4)));
          float waveVisibility=segments*opening;
          float waterRidge=crest*waveVisibility*uWind;
          float waterTrough=crestShadow*waveVisibility*uWind;
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
          vec3 col = mix(deep, pale, smoothstep(0.1, 0.9, n) * 0.25);
          col += sin(p.y*0.19 + p.x*0.13) * 0.006;
          float reflectionGuard = exp(-dot((p-uBird)/vec2(1.1,1.6),(p-uBird)/vec2(1.1,1.6)));
          vec4 reflectedUv = vReflection;
          reflectedUv.xy += distortion * mix(1.0, 0.24, reflectionGuard) * reflectedUv.w;
          vec3 reflection = texture2DProj(tDiffuse, reflectedUv).rgb;
          // Reflection is mixed into the water wash, never a polished mirror.
          col = mix(col, reflection * uReflectionTint, uReflection);
          // Restrained wide light shifts retain large uninterrupted reflections.
          float rippleVisibility = mix(1.0,0.5,reflectionGuard);
          col *= 1.0+windShade*rippleVisibility;
          col*=1.-waterTrough*.022*rippleVisibility;
          vec3 waterLight=mix(uPale,vec3(.95,.97,.92),.12);
          col=mix(col,waterLight,waterRidge*.18*rippleVisibility);
          col *= 1.0 - wakeDark * 0.23;
          vec3 wakeColor = mix(uPale, vec3(0.98, 0.99, 0.94), 0.58);
          col = mix(col, wakeColor, wakeLight * 0.57);
          float contact = exp(-dot((p-uBird)/vec2(0.48,0.78),(p-uBird)/vec2(0.48,0.78))*2.0);
          col *= 1.0 - contact * 0.13;
          // Warm only the existing illumination: the accepted wavefield,
          // reflections and wake positions/timing remain exactly as authored.
          float reflectedLight = smoothstep(0.42,0.95,dot(reflection,vec3(.2126,.7152,.0722)));
          float goldenHighlight = clamp(reflectedLight*.60+waterRidge*.20+wakeLight*.65,0.,1.);
          vec3 goldenWater = col*vec3(1.16,1.02,.79)+vec3(.025,.014,.001);
          goldenWater = mix(goldenWater,uGoldenWaterLight,.04+goldenHighlight*.22);
          col = mix(col,clamp(goldenWater,0.,1.),uWarmth);
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
      loopDuration?: number,
      manualWake = false,
    ) {
      const now = Number.isFinite(time) ? Math.max(0, time) : (lastTime ?? 0);
      const response = windResponse(wind);
      if (lastTime !== undefined && now < lastTime) windPhase = 0;
      windPhase = advanceWindPhase(
        windPhase,
        lastTime === undefined ? 0 : now - lastTime,
        response.strength,
      );
      lastTime = now;
      if (!manualWake) history.sample(now, tailX, tailZ);
      const loop = loopWind(now,wind,loopDuration);
      material.uniforms.uLoopDuration.value = loop.duration;
      material.uniforms.uLoopAngle.value = loop.angle;
      material.uniforms.uLoopOrbit.value.set(loop.orbitX,loop.orbitY);
      material.uniforms.uLoopWaterRate.value = loop.waterRate;
      material.uniforms.uWaveCycles.value = loop.waveCycles;
      material.uniforms.uSwayCycles.value = loop.swayCycles;
      material.uniforms.uTime.value = now;
      material.uniforms.uWindPhase.value = windPhase;
      material.uniforms.uWind.value = response.amplitude;
      material.uniforms.uWarmth.value = lightingAmount(warmth);
      if (Number.isFinite(x) && Number.isFinite(z))
        material.uniforms.uBird.value.set(x, z);
      material.uniforms.uWakeCount.value = history.points.length;
      const points = material.uniforms.uWakes.value as Vector4[];
      history.points.forEach((point, i) => {
        points[i].set(
          point.x,
          point.z,
          point.born,
          // The faster one-lap film should retain a trailing ribbon, rather
          // than drawing almost the complete route with the preview's 22s tail.
          wakeStrength((now - point.born) * (loopDuration
            ? WAKE_LIFETIME / Math.min(WAKE_LIFETIME, loopDuration * .28)
            : 1)),
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
