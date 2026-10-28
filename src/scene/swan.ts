import { Euler, Group, MathUtils, Quaternion, Vector3 } from "three";
import type { Object3D } from "three";
import { clampMotionStrength } from "./motion.ts";

export interface SwanMotion {
  update(time: number, activity: number): void;
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
    update(time, activity) {
      const now = Number.isFinite(time) ? Math.max(0, time) : (lastTime ?? 0);
      const strength = clampMotionStrength(activity);
      if (lastTime !== undefined) {
        if (now < lastTime) extraGesturePhase = 0;
        else extraGesturePhase += (now - lastTime) * Math.max(0, strength - 1) * 0.55;
      }
      lastTime = now;
      // Integrate only the extra speed, preserving original 0–100% timings
      // while avoiding a phase jump when the activity slider changes.
      const t = now + extraGesturePhase;
      const a = strength <= 1 ? strength : 1 + (strength - 1) * 0.45;
      const wingAmplitude = strength <= 1 ? strength : 1 + (strength - 1) * 1.6;
      const breath = Math.sin(t * 1.18) * a;
      const stretchEnvelope = gesture(t, 31, 17, 4.8);
      const stretch = stretchEnvelope * a;
      const wingStretch = stretchEnvelope * wingAmplitude;
      const flutter = gesture(t, 13, 5.6, 1.35) * wingAmplitude;
      const beat = Math.sin((t - 5.6) * 13.4);

      for (const { pivot, sign } of wings) {
        // Both wings lift together, with a tiny asymmetry rather than a flying
        // stroke. The extra range is capped at seventeen degrees; body and
        // shoulder offsets remain much subtler than the added feather lift.
        const settle = Math.sin(t * 1.18 + sign * 0.18) * 0.004 * wingAmplitude;
        const opening = MathUtils.clamp(
          wingStretch * 0.105 + flutter * (0.02 + beat * 0.025) + settle,
          -MathUtils.degToRad(17),
          MathUtils.degToRad(17),
        );
        pivot.rotation.set(
          -stretch * 0.013,
          sign * stretch * 0.014,
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
