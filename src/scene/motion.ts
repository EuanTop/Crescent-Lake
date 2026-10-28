/** Pure motion helpers, independent of render speed and the graphics library. */
export const WAKE_LIFETIME = 22;
export const WAKE_INTERVAL = 0.4;
export const WAKE_CAPACITY = 64;
export const WAKE_FADE_IN = 0.55;
export const WAKE_FADE_OUT_START = 14;
export const WAKE_DECAY = 0.025;

/** Preserve the accepted wake's spatial density and expansion at a new lap speed.
 * Whole emissions per lap also make the prewarmed trail repeat at the film seam.
 */
export function wakeTimingForLap(length: number, seconds: number) {
  if (!Number.isFinite(length) || !Number.isFinite(seconds) || length <= 0 || seconds <= 0)
    throw new RangeError("Wake timing requires a positive route length and duration.");
  const emissions = Math.max(1, Math.round(length / (0.24 * WAKE_INTERVAL)));
  const interval = seconds / emissions;
  const timeScale = WAKE_INTERVAL / interval;
  return { emissions, interval, timeScale, lifetime: WAKE_LIFETIME / timeScale };
}

export function advanceDistance(
  distance: number,
  dt: number,
  speed: number,
  length: number,
): number {
  if (length <= 0) return 0;
  return (
    (((distance + Math.max(0, dt) * Math.max(0, speed)) % length) + length) %
    length
  );
}

export function wakeStrength(age: number): number {
  if (!Number.isFinite(age) || age < 0 || age >= WAKE_LIFETIME) return 0;
  const smooth = (value: number): number => {
    const t = Math.min(1, Math.max(0, value));
    return t * t * (3 - 2 * t);
  };
  return (
    Math.exp(-age * WAKE_DECAY) *
    smooth(age / WAKE_FADE_IN) *
    (1 -
      smooth(
        (age - WAKE_FADE_OUT_START) / (WAKE_LIFETIME - WAKE_FADE_OUT_START),
      ))
  );
}

/** UI strengths retain their original 0–1 scale and extend safely to 200%. */
export function clampMotionStrength(value: number): number {
  return Number.isFinite(value) ? Math.min(2, Math.max(0, value)) : 0;
}

/** Extra strength adds energy without squaring the whole extended range. */
export function windResponse(wind: number): {
  strength: number;
  amplitude: number;
  detail: number;
  grassBend: number;
  gustSpeed: number;
} {
  const strength = clampMotionStrength(wind);
  const extra = Math.max(0, strength - 1);
  return {
    strength,
    amplitude: strength <= 1 ? strength : 1 + extra * 0.5,
    detail: strength <= 1 ? strength * strength : 1 + extra * 0.65,
    grassBend: strength <= 1
      ? strength * (0.38 + 0.45 * strength)
      : 0.83 * (1 + extra * 0.35),
    gustSpeed: 1 + extra * 0.55,
  };
}

/** Integrate traveling wind phase: a slider change changes velocity, not phase. */
export function advanceWindPhase(
  phase: number,
  dt: number,
  wind: number,
): number {
  const current = Number.isFinite(phase) ? phase : 0;
  if (!Number.isFinite(dt) || dt <= 0) return current;
  const strength = clampMotionStrength(wind);
  const velocity = strength <= 1
    ? 0.16 * strength + 0.88 * strength * strength
    : 1.04 + (strength - 1) * 0.86;
  const next = current + dt * velocity;
  return Number.isFinite(next) ? next : current;
}

export interface WakePoint {
  x: number;
  z: number;
  born: number;
}

/** Fixed capacity history. Samples remain in world space when the bird turns. */
export class WakeHistory {
  readonly points: WakePoint[] = [];
  private lastEmission = -Infinity;
  private lastObservedTime = -Infinity;
  private readonly directions = new WeakMap<
    WakePoint,
    Readonly<{ x: number; z: number }>
  >();
  private direction: Readonly<{ x: number; z: number }> = { x: 0, z: 1 };

  sample(time: number, x: number, z: number): boolean {
    if (
      !Number.isFinite(time) ||
      !Number.isFinite(x) ||
      !Number.isFinite(z) ||
      time < 0
    )
      return false;
    // Rewinding a scene must not leave future-born ripples or an emission lock.
    if (time < this.lastObservedTime) this.reset();
    this.lastObservedTime = time;
    while (this.points.length && time - this.points[0].born >= WAKE_LIFETIME)
      this.points.shift();
    if (time - this.lastEmission + 1e-9 < WAKE_INTERVAL) return false;
    const previous = this.points.at(-1);
    if (previous) {
      const dx = x - previous.x,
        dz = z - previous.z;
      const distance = Math.hypot(dx, dz);
      if (distance > 0.0001)
        this.direction = { x: dx / distance, z: dz / distance };
    }
    const point = { x, z, born: time };
    this.points.push(point);
    this.directions.set(point, this.direction);
    if (this.points.length > WAKE_CAPACITY) this.points.shift();
    this.lastEmission = time;
    return true;
  }

  /** Heading at emission stays attached to that world-space wake after turns. */
  directionFor(point: WakePoint): Readonly<{ x: number; z: number }> {
    return this.directions.get(point) ?? this.direction;
  }

  reset(): void {
    this.points.length = 0;
    this.lastEmission = -Infinity;
    this.lastObservedTime = -Infinity;
    this.direction = { x: 0, z: 1 };
  }
}
