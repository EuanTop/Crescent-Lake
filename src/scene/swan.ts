import { Euler, Group, MathUtils, Quaternion, Vector3 } from "three";
import type { Object3D } from "three";
import { loopPhase } from "./loop.ts";
import { clampMotionStrength } from "./motion.ts";

export interface SwanMotion {
  update(time: number, activity: number, loopDuration?: number): void;
}

const motions = new WeakMap<Object3D, SwanMotion>();

/** A smooth, bounded gesture with an exact resting interval between repeats. */
function gesture(
  time: number,
  period: number,
  start: number,
  duration: number,
): number {
  const phase = ((time % period) + period) % period;
  if (phase < start || phase > start + duration) return 0;
  return Math.sin(((phase - start) / duration) * Math.PI) ** 2;
}

/** Animate the authored GLB without changing or owning its mesh resources.
 * The surrounding route group should continue to own heading and water bob.
 */
export function createSwanMotion(model: Object3D): SwanMotion {
  const existing = motions.get(model);
  if (existing) return existing;

  // Gather first: attach() changes the hierarchy and must not run in traverse().
  const left: Object3D[] = [];
  const right: Object3D[] = [];
  model.traverse((node) => {
    if (/^wing_left_/.test(node.name)) left.push(node);
    if (/^wing_right_/.test(node.name)) right.push(node);
  });
  model.updateWorldMatrix(true, true);
  const wings = [
    { nodes: left, sign: -1, name: "left" },
    { nodes: right, sign: 1, name: "right" },
  ]
    .filter(({ nodes }) => nodes.length > 0)
    .map(({ nodes, sign, name }) => {
      const pivot = new Group();
      pivot.name = `Swan ${name} shoulder hinge`;
      // GLB axes: +Z forward. Keep the hinge inside the breast, not at world zero.
      pivot.position.set(sign * 0.23, 0.61, 0.3);
      model.add(pivot);
      pivot.updateWorldMatrix(true, false);
      for (const node of nodes) pivot.attach(node);
      return { pivot, sign };
    });

  const restScale = model.scale.clone();
  const restQuaternion = model.quaternion.clone();
  const restY = model.position.y;
  const offset = new Quaternion();
  const angles = new Euler();
  const scaled = new Vector3();

  let lastTime: number | undefined;
  let extraGesturePhase = 0;
  const motion: SwanMotion = {
    update(time, activity, loopDuration = 0) {
      const now = Number.isFinite(time) ? Math.max(0, time) : (lastTime ?? 0);
      const strength = clampMotionStrength(activity);
      if (lastTime !== undefined) {
        if (now < lastTime) extraGesturePhase = 0;
        else
          extraGesturePhase +=
            (now - lastTime) * Math.max(0, strength - 1) * 0.55;
      }
      lastTime = now;
      // Extra activity accelerates the gesture clock; default activity stays
      // tied to scene time without a phase jump when the slider changes.
      const t = loopDuration > 0 ? now % loopDuration : now + extraGesturePhase;
      const a = strength <= 1 ? strength : 1 + (strength - 1) * 0.45;
      const wingAmplitude = a;
      const breathPhase = loopPhase(t, 1.18, loopDuration);
      const breath = Math.sin(breathPhase) * a;
      const stretchEnvelope =
        loopDuration > 0
          ? gesture(
              t,
              loopDuration,
              loopDuration * 0.45,
              Math.min(4.8, loopDuration * 0.15),
            )
          : gesture(t, 31, 17, 4.8);
      const stretch = stretchEnvelope * a;
      const wingStretch = stretchEnvelope * wingAmplitude;
      const slotLength =
        loopDuration > 0
          ? loopDuration / Math.max(2, Math.round(loopDuration / 6))
          : 6;
      const slot = Math.floor(t / slotLength);
      const random = Math.sin((slot + 1) * 127.1) * 43758.5453;
      const jitter = random - Math.floor(random);
      const start = slot * slotLength + 0.75 + jitter * 0.85;
      // Short feather-shaking bouts: three or four quick lifts, followed by
      // several seconds at rest. The previous broad envelope read as slow sway.
      const strokes = jitter > 0.45 ? 4 : 3;
      const frequency = 3.8 + jitter * 0.8;
      const duration = strokes / frequency;
      const local = t - start;
      const flutter =
        local > 0 && local < duration
          ? MathUtils.smoothstep(local, 0, 0.06) *
            (1 - MathUtils.smoothstep(local, duration - 0.12, duration)) * wingAmplitude
          : 0;
      const beat = Math.sin(Math.max(0, local) * frequency * Math.PI) ** 2;

      for (const { pivot, sign } of wings) {
        // Shoulder-attached wings snap up and tuck back between strokes. Keep
        // the lift bounded, with only a small fore/aft feather shake.
        const settle =
          Math.sin(breathPhase + sign * 0.18) * 0.004 * wingAmplitude;
        const opening = MathUtils.clamp(
          wingStretch * 0.15 * (1 - Math.min(1, flutter)) +
            flutter * (0.035 + beat * 0.60) +
            settle,
          -MathUtils.degToRad(38 + Math.max(0, strength - 1) * 12),
          MathUtils.degToRad(38 + Math.max(0, strength - 1) * 12),
        );
        pivot.rotation.set(
          -stretch * 0.013 + flutter * beat * 0.055,
          sign * (stretch * 0.014 + flutter * beat * 0.025),
          sign * opening,
        );
        pivot.position.y = 0.61 + stretch * 0.007 + breath * 0.0015;
      }

      scaled.set(1 + breath * 0.0017, 1 + breath * 0.0037 + stretch * 0.003, 1);
      model.scale.copy(restScale).multiply(scaled);
      model.position.y = restY + breath * 0.0015;
      angles.set(-stretch * 0.004, 0, breath * 0.001);
      offset.setFromEuler(angles);
      model.quaternion.copy(restQuaternion).multiply(offset);
    },
  };
  motions.set(model, motion);
  return motion;
}
