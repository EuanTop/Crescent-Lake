import { Color, MathUtils, Vector3 } from "three";

export const MORNING_SUN = [-5, 9, 5] as const;
export const GOLDEN_SUN = [-11, 3.4, 5.6] as const;
export const GOLDEN_WATER_LIGHT = "#f3d296";

export function lightingAmount(value: number): number {
  return Number.isFinite(value) ? MathUtils.clamp(value, 0, 1) : 0;
}

/** The geometric sun and the palette shader use the same interpolated position. */
export function sunPosition(warmth: number, target = new Vector3()): Vector3 {
  const amount = lightingAmount(warmth);
  return target.set(
    MathUtils.lerp(MORNING_SUN[0], GOLDEN_SUN[0], amount),
    MathUtils.lerp(MORNING_SUN[1], GOLDEN_SUN[1], amount),
    MathUtils.lerp(MORNING_SUN[2], GOLDEN_SUN[2], amount),
  );
}

/** A narrow, green pigment range keeps dense grass from reading as black
 * stippling. Mix in linear color so the lifted roots retain their palette hue.
 * Always work from source colors, never from the current Golden Hour result.
 */
export function softenGrassPalette(colors: readonly Color[]): Color[] {
  const middleLight = colors[2].clone().lerp(colors[3], 0.3);
  return [
    colors[0].clone().lerp(middleLight, 0.46),
    colors[1].clone().lerp(middleLight, 0.38),
    colors[2].clone().lerp(colors[3], 0.14),
    colors[3].clone().lerp(colors[2], 0.1),
  ];
}

/** Native grass colors need the same light treatment as the custom toon shader.
 * Light-facing pigments turn honey gold; neutral feathers/clouds remain ivory.
 * Shadows retain cooler blue-violet undertones instead of an orange blanket.
 */
export function goldenSurface(
  base: Color,
  warmth: number,
  illumination: number,
  target = new Color(),
): Color {
  const amount = lightingAmount(warmth);
  if (amount === 0) return target.copy(base);
  const { r, g, b } = base;
  const luminance = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const chroma = Math.max(r, g, b) - Math.min(r, g, b);
  const neutral =
    (1 - MathUtils.smoothstep(chroma, 0.16, 0.38)) *
    MathUtils.smoothstep(luminance, 0.2, 0.8);
  const albedo = MathUtils.clamp(luminance * 2, 0.08, 1);
  const pigment =
    0.14 * (1 - neutral) * MathUtils.smoothstep(luminance, 0.04, 0.25);
  const lit = lightingAmount(illumination);
  const neutralStrength = MathUtils.lerp(1, 0.28, neutral);
  const baseChannels = [r, g, b];
  const lightScale = [1.25, 1.015, 0.62];
  const lightLift = [0.1, 0.045, 0.008];
  const honey = [0.92, 0.64, 0.24];
  const shadowScale = [0.94, 0.9, 1.03];
  const shadowLift = [0.009, 0.003, 0.007];
  const channels = baseChannels.map((channel, i) => {
    const light = MathUtils.lerp(
      channel * lightScale[i] + lightLift[i] * albedo,
      honey[i],
      pigment,
    );
    const shadow = channel * shadowScale[i] + shadowLift[i] * albedo;
    const golden = MathUtils.clamp(
      MathUtils.lerp(
        channel,
        MathUtils.lerp(shadow, light, lit),
        neutralStrength,
      ),
      0,
      1,
    );
    return MathUtils.lerp(channel, golden, amount);
  });
  return target.setRGB(channels[0], channels[1], channels[2]);
}

// Kept beside its CPU counterpart so instanced grass and palette-lit objects
// receive the same lighting design, while all morning albedos remain untouched.
export const goldenSurfaceGLSL = /* glsl */ `
  vec3 goldenSurface(vec3 base,float illumination,float warmth) {
    float luminance=dot(base,vec3(.2126,.7152,.0722));
    float chroma=max(max(base.r,base.g),base.b)-min(min(base.r,base.g),base.b);
    float neutral=(1.-smoothstep(.16,.38,chroma))*smoothstep(.20,.80,luminance);
    float albedo=clamp(luminance*2.,.08,1.);
    float pigment=.14*(1.-neutral)*smoothstep(.04,.25,luminance);
    vec3 honey=mix(base*vec3(1.25,1.015,.62)+vec3(.10,.045,.008)*albedo,vec3(.92,.64,.24),pigment);
    vec3 cool=base*vec3(.94,.90,1.03)+vec3(.009,.003,.007)*albedo;
    vec3 golden=mix(base,mix(cool,honey,clamp(illumination,0.,1.)),mix(1.,.28,neutral));
    return mix(base,clamp(golden,0.,1.),clamp(warmth,0.,1.));
  }
`;
