import { advanceWindPhase, clampMotionStrength, windResponse } from "./motion.ts";

export const WIND_TAU = Math.PI * 2;

/** Absolute scene time stays available for wakes; only wind is wrapped. */
export function loopWind(time: number, wind: number, duration?: number) {
  const period = Number.isFinite(duration) && duration! > 0 ? duration! : 0;
  const now = Number.isFinite(time) ? time : 0;
  const seconds = period ? ((now % period) + period) % period : 0;
  const angle = period ? (seconds / period) * WIND_TAU : 0;
  const waterRate = advanceWindPhase(0, 1, wind);
  return {
    duration: period,
    angle,
    orbitX: Math.cos(angle) - 1,
    orbitY: Math.sin(angle),
    grassSpeed: windResponse(wind).gustSpeed,
    waterRate,
    waveCycles: period && waterRate > 0 ? Math.max(1, Math.round(waterRate * 0.72 * period / WIND_TAU)) : 0,
    swayCycles: period && waterRate > 0 ? Math.max(1, Math.round(waterRate * 0.09 * period / WIND_TAU)) : 0,
  };
}

/** Small root-anchored tilts and a separate crown response, never translations. */
export function treeWind(time: number, wind: number, offset: number, duration?: number) {
  const strength = clampMotionStrength(wind);
  if (strength === 0) return { x: 0, z: 0, crownX: 0, crownZ: 0 };
  const loop = loopWind(time, wind, duration);
  const now = Number.isFinite(time) ? Math.max(0, time) : 0;
  const oscillate = (rate: number, phase: number) => {
    const clock = loop.duration
      ? loop.angle * Math.max(1, Math.round(rate * loop.grassSpeed * loop.duration / WIND_TAU))
      : now * rate * loop.grassSpeed;
    return Math.sin(clock + phase);
  };
  const field = oscillate(0.72 + Math.sin(offset) * 0.08, offset) * 0.65
    + oscillate(1.13, offset * 0.71) * 0.35;
  const amplitude = strength <= 1 ? strength * 0.045 : 0.045 + (strength - 1) * 0.037;
  const lean = amplitude * (0.3 + field * 0.7);
  const crown = (oscillate(1.37 + Math.sin(offset * 0.4) * 0.16, offset * 1.31) * 0.65
    + oscillate(2.11, offset + 1.7) * 0.35) * strength * 0.009;
  return { x: lean * 0.36, z: -lean * 0.93, crownX: crown * 0.56, crownZ: -crown * 0.83 };
}
