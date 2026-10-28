export const LOOP_SECONDS = 24;
export function loopPhase(time: number, rate: number, duration = 0): number {
  if (!Number.isFinite(time) || !Number.isFinite(rate)) return 0;
  if (!(duration > 0)) return time * rate;
  if (rate === 0) return 0;
  const t = ((time % duration) + duration) % duration;
  return (
    ((t * Math.PI * 2) / duration) *
    Math.max(1, Math.round((Math.abs(rate) * duration) / (Math.PI * 2))) *
    Math.sign(rate)
  );
}
export function loopWarmth(time: number, duration = LOOP_SECONDS): number {
  return (
    0.5 - 0.5 * Math.cos(loopPhase(time, (Math.PI * 2) / duration, duration))
  );
}
