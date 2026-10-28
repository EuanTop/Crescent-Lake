/** Hold morning for the opening, reveal golden light, then let it settle. */
export function videoWarmth(elapsed: number, duration: number): number {
  if (!Number.isFinite(elapsed) || !Number.isFinite(duration) || duration <= 0)
    return 0;
  const start = (duration * 3) / 17;
  const end = (duration * 13) / 17;
  const t = Math.max(0, Math.min(1, (elapsed - start) / (end - start)));
  return t * t * (3 - 2 * t);
}
