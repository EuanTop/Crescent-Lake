import {
  Color,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
  Vector3,
} from "three";

const materials = new Set<ShaderMaterial>();
const sunDirection = new Vector3(-5, 9, 5).normalize();
const eveningDirection = new Vector3(-10, 4.7, 4.1).normalize();

/** Original implementation of palette-based lighting. Palettes run dark → light. */
export function createToonMaterial(palette: string[]): ShaderMaterial {
  const colors = Array.from(
    { length: 4 },
    (_, i) => new Color(palette[Math.min(i, palette.length - 1)]),
  );
  const material = new ShaderMaterial({
    name: "Painted palette",
    lights: true,
    uniforms: UniformsUtils.merge([
      UniformsLib.lights,
      {
        uPalette: { value: colors },
        uLightDirection: { value: sunDirection.clone() },
        uWarmth: { value: 0 },
        uTime: { value: 0 },
        uSurfaceVariation: { value: 0 },
      },
    ]),
    vertexShader: /* glsl */ `
      #include <common>
      #include <shadowmap_pars_vertex>
      varying vec3 vPaintNormal;
      varying vec3 vPaintPosition;
      void main() {
        vec3 n = normal;
        vec4 localPosition = vec4(position, 1.0);
        #ifdef USE_INSTANCING
          mat3 instanceNormal = mat3(instanceMatrix);
          n /= vec3(dot(instanceNormal[0], instanceNormal[0]), dot(instanceNormal[1], instanceNormal[1]), dot(instanceNormal[2], instanceNormal[2]));
          n = instanceNormal * n;
          localPosition = instanceMatrix * localPosition;
        #endif
        vec3 transformedNormal = normalize(normalMatrix * n);
        vPaintNormal = transformNormalByInverseViewMatrix(transformedNormal, viewMatrix);
        vec4 worldPosition = modelMatrix * localPosition;
        vPaintPosition = worldPosition.xyz;
        vec4 mvPosition = viewMatrix * worldPosition;
        gl_Position = projectionMatrix * mvPosition;
        #include <shadowmap_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <packing>
      #include <bsdfs>
      #include <lights_pars_begin>
      #include <shadowmap_pars_fragment>
      #include <shadowmask_pars_fragment>
      uniform vec3 uPalette[4];
      uniform vec3 uLightDirection;
      uniform float uWarmth;
      uniform float uSurfaceVariation;
      varying vec3 vPaintNormal;
      varying vec3 vPaintPosition;
      void main() {
        vec3 n = normalize(vPaintNormal);
        float brightness = dot(n, uLightDirection) * 0.5 + 0.5;
        float pigment = sin(vPaintPosition.x * 9.0 + sin(vPaintPosition.z * 7.0)) * sin(vPaintPosition.y * 12.0 + vPaintPosition.z * 8.0);
        brightness += pigment * 0.012;
        float wash = sin(vPaintPosition.x * 1.3 + sin(vPaintPosition.z * 0.8) * 1.7)
          * sin(vPaintPosition.z * 1.9 + sin(vPaintPosition.x * 0.6));
        vec3 col = mix(uPalette[0], uPalette[1], smoothstep(0.24, 0.32, brightness));
        col = mix(col, uPalette[2], smoothstep(0.51, 0.59, brightness));
        col = mix(col, uPalette[3], smoothstep(0.79, 0.87, brightness));
        col *= 1.0 - (wash * 0.5 + 0.5) * uSurfaceVariation;
        float shadow = getShadowMask();
        col = mix(col * 0.71 + uPalette[0] * 0.08, col, shadow);
        col *= mix(vec3(1.0), vec3(1.12, 0.95, 0.79), uWarmth);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  materials.add(material);
  material.addEventListener("dispose", () => materials.delete(material));
  return material;
}

export function updatePaletteLighting(time: number, warmth: number): void {
  for (const material of materials) {
    material.uniforms.uTime.value = time;
    material.uniforms.uWarmth.value = warmth;
    material.uniforms.uLightDirection.value
      .copy(sunDirection)
      .lerp(eveningDirection, warmth)
      .normalize();
  }
}
