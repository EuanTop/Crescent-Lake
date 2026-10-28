import type { OrthographicCamera } from "three";

/** Portrait admits more of the planted bank while keeping the swimming loop. */
export function frameLake(camera: OrthographicCamera, aspect: number) {
  const portrait = aspect < 0.9;
  const halfHeight = portrait ? 11.6 : 8.7;
  const shoreShift = portrait ? 0.6 : 0;
  camera.position.set(12 - shoreShift, 17, 22 + shoreShift * 0.56);
  camera.lookAt(-0.5 - shoreShift, 0, -0.3 + shoreShift * 0.56);
  camera.left = -halfHeight * aspect;
  camera.right = halfHeight * aspect;
  camera.top = halfHeight;
  camera.bottom = -halfHeight;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
}
