import * as THREE from "three";
import { createToonMaterial } from "./materials";

/** A quiet, planted bank. All scenery is geometry; no image assets are used. */
export function createLandscape(): {
  group: THREE.Group;
  update(time: number, wind: number): void;
  dispose(): void;
} {
  const group = new THREE.Group();
  group.name = "Crescent shore";
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const geometry = <T extends THREE.BufferGeometry>(value: T): T => {
    geometries.add(value);
    return value;
  };
  const material = <T extends THREE.Material>(value: T): T => {
    materials.add(value);
    return value;
  };
  const bankMaterial = material(
    createToonMaterial(["#456647", "#6e9355", "#97b468", "#b0c67c"]),
  );
  bankMaterial.uniforms.uSurfaceVariation.value = 0.2;
  const sandMaterial = material(
    createToonMaterial(["#a69f75", "#c6bd8c", "#dbd5ab", "#e9e4c6"]),
  );
  const trunkMaterial = material(
    createToonMaterial(["#635e4e", "#817b5b", "#a39a72", "#b9ad7f"]),
  );
  const rockMaterial = material(
    createToonMaterial(["#7f8980", "#a8aea0", "#c4c8b5", "#dcddc9"]),
  );
  const leafMaterial = material(
    createToonMaterial(["#355c48", "#547d4e", "#85aa5a", "#a9c478"]),
  );
  const leafLightMaterial = material(
    createToonMaterial(["#456947", "#719050", "#97b762", "#bbce8b"]),
  );
  let seed = 73021;
  const random = (): number => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const boundary = (z: number): number =>
    -8.05 +
    2.9 * Math.cos((z / 23) * Math.PI) +
    0.19 * Math.sin(z * 0.66) +
    0.07 * Math.sin(z * 1.7);

  // Parallel strips make a soft bank and a narrow, pale waterline.
  const strip = (
    left: (z: number) => number,
    right: (z: number) => number,
    height: (u: number, z: number) => number,
  ): THREE.BufferGeometry => {
    const vertices: number[] = [];
    const indices: number[] = [];
    const steps = 104;
    const columns = 8;
    for (let row = 0; row <= steps; row++) {
      const z = -42 + (row / steps) * 84;
      for (let col = 0; col <= columns; col++) {
        const u = col / columns;
        vertices.push(
          THREE.MathUtils.lerp(left(z), right(z), u),
          height(u, z),
          z,
        );
      }
    }
    for (let row = 0; row < steps; row++) {
      for (let col = 0; col < columns; col++) {
        const a = row * (columns + 1) + col;
        const b = a + columns + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    const result = geometry(new THREE.BufferGeometry());
    result.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(vertices, 3),
    );
    result.setIndex(indices);
    result.computeVertexNormals();
    return result;
  };
  const bank = new THREE.Mesh(
    strip(
      () => -48,
      boundary,
      (u, z) =>
        0.18 +
        0.09 * (1 - u) * Math.sin(z * 0.38) +
        0.09 * Math.sin(u * Math.PI),
    ),
    bankMaterial,
  );
  bank.receiveShadow = true;
  group.add(bank);
  const sand = new THREE.Mesh(
    strip(
      boundary,
      (z) => boundary(z) + 0.27 + 0.04 * Math.sin(z * 1.4),
      (u) => 0.179 - u * 0.13,
    ),
    sandMaterial,
  );
  sand.receiveShadow = true;
  group.add(sand);

  // One small tuft contains three curved blades. Instancing keeps the bank cheap.
  const bladeVertices: number[] = [];
  const bladeIndices: number[] = [];
  for (let blade = 0; blade < 3; blade++) {
    const angle = (blade / 3) * Math.PI * 2;
    const height = 0.31 + blade * 0.035;
    const width = 0.036;
    const start = bladeVertices.length / 3;
    for (let level = 0; level < 4; level++) {
      const t = level / 3;
      const bend = t * t * 0.1;
      const halfWidth = width * (1 - t * 0.92);
      for (const side of [-1, 1]) {
        bladeVertices.push(
          Math.cos(angle) * bend + Math.sin(angle) * halfWidth * side,
          t * height,
          Math.sin(angle) * bend - Math.cos(angle) * halfWidth * side,
        );
      }
    }
    for (let level = 0; level < 3; level++) {
      const a = start + level * 2;
      bladeIndices.push(a, a + 2, a + 1, a + 2, a + 3, a + 1);
    }
  }
  const bladeGeometry = geometry(new THREE.BufferGeometry());
  bladeGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(bladeVertices, 3),
  );
  bladeGeometry.setIndex(bladeIndices);
  bladeGeometry.computeVertexNormals();
  const grassMaterial = material(
    new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 }, uWind: { value: 1 } },
      vertexShader: `
      uniform float uTime;
      uniform float uWind;
      varying float vHeight;
      varying float vVariation;
      void main() {
        vec4 root = modelMatrix * instanceMatrix * vec4(0., 0., 0., 1.);
        vec3 p = position;
        float sway = sin(root.x * .8 + root.z * .55 + uTime * .75)
          + .35 * sin(root.z * 1.9 - uTime * 1.1);
        p.x += sway * p.y * p.y * .38 * uWind;
        p.z += sway * p.y * p.y * .15 * uWind;
        vHeight = clamp(position.y / .38, 0., 1.);
        vVariation = fract(sin(dot(root.xz, vec2(12.9898, 78.233))) * 43758.5453);
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(p, 1.);
      }
    `,
      fragmentShader: `
      varying float vHeight;
      varying float vVariation;
      void main() {
        vec3 low = mix(vec3(.12,.23,.09), vec3(.19,.30,.12), vVariation);
        vec3 high = mix(vec3(.35,.46,.17), vec3(.47,.56,.24), vVariation);
        gl_FragColor = vec4(mix(low, high, smoothstep(.05, 1., vHeight)), 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    }),
  );
  const count = 3800;
  const grass = new THREE.InstancedMesh(bladeGeometry, grassMaterial, count);
  grass.name = "Wind in the bank grasses";
  const transform = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const z = -11.8 + random() * 23.6;
    // Extra density at the water's edge, interrupted by small open patches.
    const depth =
      random() < 0.66
        ? 0.15 + Math.pow(random(), 1.8) * 2.0
        : 0.2 + random() * 7;
    const x = boundary(z) - depth;
    const clump = 0.72 + 0.28 * Math.sin(x * 3.1 + z * 2.5);
    transform.position.set(x, 0.19, z);
    transform.rotation.set(0, random() * Math.PI * 2, (random() - 0.5) * 0.16);
    const scale = (0.65 + random() * 0.8) * clump;
    transform.scale.set(scale, scale * (0.75 + random() * 0.5), scale);
    transform.updateMatrix();
    grass.setMatrixAt(i, transform.matrix);
  }
  grass.instanceMatrix.needsUpdate = true;
  grass.computeBoundingSphere();
  group.add(grass);

  const pebbleGeometry = geometry(new THREE.SphereGeometry(1, 9, 6));
  for (let i = 0; i < 24; i++) {
    const z = -11 + random() * 22;
    const stone = new THREE.Mesh(pebbleGeometry, rockMaterial);
    const radius = 0.06 + Math.pow(random(), 2) * 0.18;
    stone.position.set(boundary(z) - 0.1 - random() * 0.68, 0.16, z);
    stone.scale.set(radius * 1.4, radius * 0.6, radius);
    stone.rotation.set(random() * 0.3, random() * 6.28, random() * 0.25);
    stone.castShadow = true;
    stone.receiveShadow = true;
    group.add(stone);
  }

  const branchGeometry = geometry(
    new THREE.CylinderGeometry(0.065, 0.105, 1, 8),
  );
  const canopyGeometry = geometry(new THREE.SphereGeometry(1, 16, 12));
  const canopyPositions = canopyGeometry.getAttribute("position");
  for (let i = 0; i < canopyPositions.count; i++) {
    const x = canopyPositions.getX(i),
      y = canopyPositions.getY(i),
      z = canopyPositions.getZ(i);
    const variation =
      1 + Math.sin(x * 7.3 + y * 3.1) * Math.sin(z * 6.2 - y * 4.0) * 0.065;
    canopyPositions.setXYZ(i, x * variation, y * variation, z * variation);
  }
  canopyGeometry.computeVertexNormals();
  const branch = (
    parent: THREE.Group,
    from: THREE.Vector3,
    to: THREE.Vector3,
    thickness: number,
  ): void => {
    const mesh = new THREE.Mesh(branchGeometry, trunkMaterial);
    const delta = to.clone().sub(from);
    mesh.position.copy(from).add(to).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      delta.clone().normalize(),
    );
    mesh.scale.set(thickness, delta.length(), thickness);
    mesh.castShadow = true;
    parent.add(mesh);
  };
  const makeTree = (x: number, z: number, scale: number): void => {
    const tree = new THREE.Group();
    tree.position.set(x, 0.18, z);
    tree.scale.setScalar(scale);
    branch(
      tree,
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.06, 1.65, 0),
      1.55,
    );
    const clusters = [
      [-0.48, 1.9, 0.1, 0.73],
      [0.45, 2.03, 0.11, 0.77],
      [0.06, 2.53, -0.08, 0.83],
      [-0.16, 2.15, -0.53, 0.72],
      [0.14, 2.09, 0.59, 0.65],
    ];
    clusters.forEach(([cx, cy, cz, radius], i) => {
      branch(
        tree,
        new THREE.Vector3(0, 1.0, 0),
        new THREE.Vector3(cx, cy, cz),
        0.65,
      );
      const crown = new THREE.Mesh(
        canopyGeometry,
        i % 3 === 0 ? leafLightMaterial : leafMaterial,
      );
      crown.position.set(cx, cy, cz);
      crown.scale.set(
        radius * (1.04 + random() * 0.13),
        radius * (0.76 + random() * 0.15),
        radius,
      );
      crown.rotation.set(random() * 0.5, random() * 3, random() * 0.5);
      crown.castShadow = true;
      crown.receiveShadow = true;
      tree.add(crown);
    });
    group.add(tree);
  };
  makeTree(-8.4, -4.8, 1.07);
  makeTree(-10.4, -3.6, 0.83);
  makeTree(-8.5, -7.1, 0.7);

  // Sparse, tiny ivory flowers, visible as notes of light in the grass.
  const flowerMaterial = material(
    createToonMaterial(["#b6b899", "#e0ddba", "#f3edcc", "#fff8de"]),
  );
  const pollenMaterial = material(
    createToonMaterial(["#9e9652", "#bbb46a", "#d8cc7a", "#e8d995"]),
  );
  const flowerGeometry = geometry(new THREE.SphereGeometry(1, 6, 4));
  const flowers = new THREE.InstancedMesh(flowerGeometry, flowerMaterial, 150);
  const centers = new THREE.InstancedMesh(flowerGeometry, pollenMaterial, 30);
  for (let i = 0; i < 30; i++) {
    const z = -10.5 + random() * 21;
    const x = boundary(z) - 0.45 - random() * 2.6;
    const y = 0.32 + random() * 0.12;
    for (let petal = 0; petal < 5; petal++) {
      const angle = (petal / 5) * Math.PI * 2;
      transform.position.set(
        x + Math.cos(angle) * 0.035,
        y,
        z + Math.sin(angle) * 0.035,
      );
      transform.rotation.set(0, angle, 0);
      transform.scale.set(0.034, 0.012, 0.025);
      transform.updateMatrix();
      flowers.setMatrixAt(i * 5 + petal, transform.matrix);
    }
    transform.position.set(x, y + 0.008, z);
    transform.scale.set(0.018, 0.012, 0.018);
    transform.updateMatrix();
    centers.setMatrixAt(i, transform.matrix);
  }
  flowers.instanceMatrix.needsUpdate = true;
  centers.instanceMatrix.needsUpdate = true;
  group.add(flowers, centers);

  return {
    group,
    update(time, wind) {
      grassMaterial.uniforms.uTime.value = time;
      grassMaterial.uniforms.uWind.value = wind;
    },
    dispose() {
      geometries.forEach((value) => value.dispose());
      materials.forEach((value) => value.dispose());
      grass.dispose();
      flowers.dispose();
      centers.dispose();
      group.clear();
    },
  };
}
