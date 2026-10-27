/** Pure motion helpers, independent of render speed and the graphics library. */
export const WAKE_LIFETIME = 7;
export const WAKE_INTERVAL = 0.25;
export const WAKE_CAPACITY = 32;

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
  if (age < 0 || age >= WAKE_LIFETIME) return 0;
  return Math.exp(-age * 0.44) * Math.min(1, age * 6);
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

  sample(time: number, x: number, z: number): boolean {
    while (this.points.length && time - this.points[0].born >= WAKE_LIFETIME)
      this.points.shift();
    if (time - this.lastEmission < WAKE_INTERVAL) return false;
    this.points.push({ x, z, born: time });
    if (this.points.length > WAKE_CAPACITY) this.points.shift();
    this.lastEmission = time;
    return true;
  }

  reset(): void {
    this.points.length = 0;
    this.lastEmission = -Infinity;
  }
}
