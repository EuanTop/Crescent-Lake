import { Euler, Group, MathUtils, Quaternion, Vector3 } from "three";
import type { Object3D } from "three";

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

  const motion: SwanMotion = {
    update(time, activity) {
      const t = Number.isFinite(time) ? Math.max(0, time) : 0;
      const a = Number.isFinite(activity) ? MathUtils.clamp(activity, 0, 1) : 0;
      const breath = Math.sin(t * 1.18) * a;
      const stretch = gesture(t, 31, 17, 4.8) * a;
      const flutter = gesture(t, 13, 5.6, 1.35) * a;
      const beat = Math.sin((t - 5.6) * 13.4);

      for (const { pivot, sign } of wings) {
        // Both wings lift together, with a tiny asymmetry rather than a flying
        // stroke. Maximum opening is under nine degrees at full activity.
        const settle = Math.sin(t * 1.18 + sign * 0.18) * 0.004 * a;
        const opening =
          stretch * 0.105 + flutter * (0.02 + beat * 0.025) + settle;
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
