import * as THREE from "three";
import { createToonMaterial } from "./materials";
import { windResponse } from "./motion";

/** A quiet, planted bank. All scenery is geometry; no image assets are used. */
export function createLandscape(): {
  group: THREE.Group;
  update(time: number, wind: number): void;
  setPalette(id: "sage" | "blue" | "green"): void;
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
  const wetSandMaterial = material(
    createToonMaterial(["#7d9278", "#a6b194", "#c2c9a7", "#d7d9bb"]),
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
    0.09 * Math.sin(z * 1.7 + 0.4 * Math.sin(z * 0.7)) +
    0.035 * Math.sin(z * 4.7);
  const shoreWidth = (z: number): number =>
    0.23 + 0.07 * Math.sin(z * 1.2) + 0.04 * Math.sin(z * 3.7);
  const shoreOuter = (z: number): number => boundary(z) + shoreWidth(z);

  const bankHeight = (x: number, z: number): number => {
    const u = THREE.MathUtils.clamp((x + 48) / (boundary(z) + 48), 0, 1);
    return (
      0.18 + 0.09 * (1 - u) * Math.sin(z * 0.38) + 0.09 * Math.sin(u * Math.PI)
    );
  };

  // Parallel strips make a soft bank and a narrow, pale waterline.
  const strip = (
    left: (z: number) => number,
    right: (z: number) => number,
    height: (u: number, z: number) => number,
  ): THREE.BufferGeometry => {
    const vertices: number[] = [];
    const indices: number[] = [];
    const steps = 480;
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
      (u, z) => bankHeight(THREE.MathUtils.lerp(-48, boundary(z), u), z),
    ),
    bankMaterial,
  );
  bank.receiveShadow = true;
  group.add(bank);
  const sand = new THREE.Mesh(
    strip(
      boundary,
      shoreOuter,
      (u, z) =>
        0.179 -
        Math.pow(u, 0.72) * 0.15 +
        Math.sin(z * 3.1) * Math.sin(u * Math.PI) * 0.008,
    ),
    sandMaterial,
  );
  sand.receiveShadow = true;
  group.add(sand);

  const dampEdge = new THREE.Mesh(
    strip(
      shoreOuter,
      (z) => shoreOuter(z) + 0.07 + 0.035 * Math.sin(z * 3.1),
      (u) => 0.028 - u * 0.022,
    ),
    wetSandMaterial,
  );
  dampEdge.receiveShadow = true;
  group.add(dampEdge);

  // Five distinct, arcing ribbons form each tuft. The tips close to real points,
  // and lengths/widths vary before instancing rather than repeating rigid fans.
  const bladeVertices: number[] = [];
  const bladeGrowth: number[] = [];
  const bladePhases: number[] = [];
  const bladeIndices: number[] = [];
  const bladeLengths = [0.29, 0.43, 0.36, 0.51, 0.32];
  const bladeWidths = [0.024, 0.032, 0.022, 0.029, 0.037];
  const segments = 7;
  for (let blade = 0; blade < bladeLengths.length; blade++) {
    const angle = blade * 2.39996 + 0.2 * Math.sin(blade * 4.7);
    const height = bladeLengths[blade];
    const width = bladeWidths[blade];
    const start = bladeVertices.length / 3;
    for (let level = 0; level <= segments; level++) {
      const t = level / segments;
      const arc = height * (0.19 + blade * 0.045) * t * t;
      const curl = Math.sin(t * Math.PI * 0.8) * t * 0.035;
      const halfWidth =
        width * Math.pow(1 - t, 0.76) * (0.68 + 0.65 * Math.sin(t * Math.PI));
      for (const side of [-1, 1]) {
        bladeVertices.push(
          Math.cos(angle) * arc + Math.sin(angle) * (halfWidth * side + curl),
          height * (t - 0.1 * t * t * t),
          Math.sin(angle) * arc - Math.cos(angle) * (halfWidth * side + curl),
        );
        bladeGrowth.push(t);
        bladePhases.push(blade * 1.719);
      }
    }
    for (let level = 0; level < segments; level++) {
      const a = start + level * 2;
      bladeIndices.push(a, a + 2, a + 1, a + 2, a + 3, a + 1);
    }
  }
  const bladeGeometry = geometry(new THREE.BufferGeometry());
  bladeGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(bladeVertices, 3),
  );
  bladeGeometry.setAttribute(
    "aGrowth",
    new THREE.Float32BufferAttribute(bladeGrowth, 1),
  );
  bladeGeometry.setAttribute(
    "aBladePhase",
    new THREE.Float32BufferAttribute(bladePhases, 1),
  );
  bladeGeometry.setIndex(bladeIndices);
  bladeGeometry.computeVertexNormals();
  const grassMaterial = material(
    new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uWind: { value: 0.35 },
        uBendAmplitude: { value: 0.188125 },
        uGrassLowA: { value: new THREE.Color().setRGB(0.12, 0.23, 0.09) },
        uGrassLowB: { value: new THREE.Color().setRGB(0.19, 0.3, 0.12) },
        uGrassHighA: { value: new THREE.Color().setRGB(0.35, 0.46, 0.17) },
        uGrassHighB: { value: new THREE.Color().setRGB(0.47, 0.56, 0.24) },
      },
      vertexShader: /* glsl */ `
        uniform float uTime;
        uniform float uWind;
        uniform float uBendAmplitude;
        attribute float aGrowth;
        attribute float aBladePhase;
        varying float vHeight;
        varying float vVariation;
        varying float vBladeLight;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
        float noise(vec2 p) {
          vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
        }
        void main() {
          vec4 root = modelMatrix * instanceMatrix * vec4(0.,0.,0.,1.);
          vec4 world = modelMatrix * instanceMatrix * vec4(position,1.);
          float phase = hash(root.xz);
          // Low-frequency weather travels across the bank. Every blade shares
          // the world-space wind direction, regardless of its random tuft yaw.
          float gust = noise(root.xz * .24 - vec2(uTime*.28,uTime*.11));
          float swell = sin(dot(root.xz,vec2(.55,.24)) - uTime*1.6 + gust*2.4);
          float breeze = .32 + .88*gust + .40*swell;
          float flutter = sin(uTime*(2.5+phase*1.7) + phase*31. + aBladePhase + root.x*.3);
          float tip = aGrowth*aGrowth;
          float stiffness = mix(.82,1.18,phase);
          // Short meadow blades bend with the same gust, at their own scale.
          float stemHeight = length(instanceMatrix[1].xyz) * position.y / max(aGrowth,.001);
          float bladeScale = clamp(stemHeight/.36,.2,1.35);
          float amplitude = uBendAmplitude*stiffness*bladeScale;
          vec2 bend = vec2(.93,.36)*breeze + vec2(-.36,.93)*flutter*.16*aGrowth;
          float restHeight = world.y-root.y;
          world.xz += bend * tip * amplitude;
          world.y -= length(bend) * tip * amplitude * .13;
          // Extra energy keeps the tips upright. Blend the safeguard in above
          // 100% so the original range has exactly its previous deformation.
          float supportedY = max(world.y,root.y+restHeight*.55);
          world.y = mix(world.y,supportedY,clamp(uWind-1.,0.,1.));
          vHeight = aGrowth;
          vVariation = phase;
          vBladeLight = .94 + .06*cos(aBladePhase + phase*3.);
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uGrassLowA, uGrassLowB, uGrassHighA, uGrassHighB;
        varying float vHeight;
        varying float vVariation;
        varying float vBladeLight;
        void main() {
          vec3 low = mix(uGrassLowA,uGrassLowB,vVariation);
          vec3 high = mix(uGrassHighA,uGrassHighB,vVariation);
          vec3 col = mix(low,high,smoothstep(.02,.97,vHeight))*vBladeLight;
          gl_FragColor = vec4(col,1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    }),
  );
  const count = 3800;
  const grass = new THREE.InstancedMesh(bladeGeometry, grassMaterial, count);
  grass.name = "Living grass — curved blades and traveling gusts";
  const transform = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    // Bell-shaped coverage has no straight end line at the old z=±12 edge.
    // Fine detail gradually gives way to the continuous low meadow.
    const z = (random() + random() + random() - 1.5) * 21.5;
    let depth =
      random() < 0.69
        ? 0.04 + Math.pow(random(), 1.7) * 2.2
        : 0.25 + random() * 7;
    // Patches share a softly clustered density; occasional tall blades emerge
    // from the fine, low fringe rather than forming a uniformly cut lawn.
    const patch = 0.5 + 0.5 * Math.sin(z * 1.17 + Math.sin(z * 0.43) * 2.1);
    depth += patch * 0.22;
    const x = boundary(z) - depth;
    const fringe = depth < 0.38;
    const inlandBlend = 1 - THREE.MathUtils.smoothstep(depth, 4.0, 7.5);
    const size =
      ((fringe ? 0.52 : 0.64) + random() * (fringe ? 0.67 : 0.9)) * inlandBlend;
    transform.position.set(x, bankHeight(x, z) - 0.008, z);
    transform.rotation.set(
      (random() - 0.5) * 0.12,
      random() * Math.PI * 2,
      (random() - 0.5) * 0.16,
    );
    transform.scale.set(
      size * (0.8 + random() * 0.4),
      size * (0.78 + random() * 0.57),
      size,
    );
    transform.updateMatrix();
    grass.setMatrixAt(i, transform.matrix);
  }
  grass.instanceMatrix.needsUpdate = true;
  grass.computeBoundingSphere();
  // The shader displaces vertices beyond the static geometry bound.
  if (grass.boundingSphere) grass.boundingSphere.radius += 3.1;
  group.add(grass);

  // A continuous low meadow fills the whole bank, not only the detailed ribbon
  // near the water. Jittered cells guarantee coverage without lawn-like rows;
  // gradual height patches never remove a large piece of vegetation.
  const meadowVertices: number[] = [];
  const meadowGrowth: number[] = [];
  const meadowPhases: number[] = [];
  const meadowIndices: number[] = [];
  for (let blade = 0; blade < 2; blade++) {
    const angle = blade * 1.89 + 0.27;
    const height = blade === 0 ? 0.24 : 0.3;
    const start = meadowVertices.length / 3;
    for (let level = 0; level <= 3; level++) {
      const t = level / 3;
      const arc = t * t * 0.1;
      const width = 0.052 * (1 - t) * (0.82 + Math.sin(t * Math.PI) * 0.4);
      for (const side of [-1, 1]) {
        meadowVertices.push(
          Math.cos(angle) * arc + Math.sin(angle) * width * side,
          height * t,
          Math.sin(angle) * arc - Math.cos(angle) * width * side,
        );
        meadowGrowth.push(t);
        meadowPhases.push(blade * 2.37);
      }
    }
    for (let level = 0; level < 3; level++) {
      const a = start + level * 2;
      meadowIndices.push(a, a + 2, a + 1, a + 2, a + 3, a + 1);
    }
  }
  const meadowGeometry = geometry(new THREE.BufferGeometry());
  meadowGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(meadowVertices, 3),
  );
  meadowGeometry.setAttribute(
    "aGrowth",
    new THREE.Float32BufferAttribute(meadowGrowth, 1),
  );
  meadowGeometry.setAttribute(
    "aBladePhase",
    new THREE.Float32BufferAttribute(meadowPhases, 1),
  );
  meadowGeometry.setIndex(meadowIndices);
  const meadowTiles: THREE.InstancedMesh[] = [];
  const savedSeed = seed;
  seed = 184371;
  const tileSize = 7;
  const cellSize = 0.32;
  const cells = Math.ceil(tileSize / cellSize);
  for (let tileZ = -42; tileZ < 42; tileZ += tileSize) {
    for (let tileX = -48; tileX < -4; tileX += tileSize) {
      const placements: { x: number; z: number; size: number; yaw: number }[] =
        [];
      for (let row = 0; row < cells; row++) {
        for (let col = 0; col < cells; col++) {
          const x = tileX + ((col + 0.12 + random() * 0.76) / cells) * tileSize;
          const z = tileZ + ((row + 0.12 + random() * 0.76) / cells) * tileSize;
          if (x > boundary(z) - 0.1) continue;
          const patch =
            0.5 +
            0.5 *
              Math.sin(x * 0.71 + Math.sin(z * 0.47)) *
              Math.sin(z * 0.81 - x * 0.23);
          // A few small pinholes break up the field without broad bald slabs.
          if (random() < 0.035 + patch * 0.045) continue;
          placements.push({
            x,
            z,
            size: 0.62 + patch * 0.3 + random() * 0.42,
            yaw: random() * Math.PI * 2,
          });
        }
      }
      if (!placements.length) continue;
      const tile = new THREE.InstancedMesh(
        meadowGeometry,
        grassMaterial,
        placements.length,
      );
      tile.name = `Meadow ${tileX},${tileZ}`;
      // Put each batch at its own centre so Three.js can cull distant tiles.
      tile.position.set(tileX + tileSize * 0.5, 0, tileZ + tileSize * 0.5);
      placements.forEach(({ x, z, size, yaw }, i) => {
        transform.position.set(
          x - tile.position.x,
          bankHeight(x, z) - 0.008,
          z - tile.position.z,
        );
        transform.rotation.set(
          (random() - 0.5) * 0.09,
          yaw,
          (random() - 0.5) * 0.09,
        );
        transform.scale.set(size, size * (0.79 + random() * 0.38), size);
        transform.updateMatrix();
        tile.setMatrixAt(i, transform.matrix);
      });
      tile.instanceMatrix.needsUpdate = true;
      tile.computeBoundingSphere();
      if (tile.boundingSphere) tile.boundingSphere.radius += 3.1;
      meadowTiles.push(tile);
      group.add(tile);
    }
  }
  // Preserve the authored stones/flowers/tree variation when meadow density changes.
  seed = savedSeed;

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

  const palettes = {
    sage: {
      bank: ["#456647", "#6e9355", "#97b468", "#b0c67c"],
      sand: ["#a69f75", "#c6bd8c", "#dbd5ab", "#e9e4c6"],
      wet: ["#7d9278", "#a6b194", "#c2c9a7", "#d7d9bb"],
      leaf: ["#355c48", "#547d4e", "#85aa5a", "#a9c478"],
      leafLight: ["#456947", "#719050", "#97b762", "#bbce8b"],
      rock: ["#7f8980", "#a8aea0", "#c4c8b5", "#dcddc9"],
      grass: ["#617f55", "#799563", "#a0b472", "#b6c58a"],
    },
    blue: {
      bank: ["#426360", "#6c8b7a", "#93ab8e", "#b4c2a0"],
      sand: ["#8d9a8b", "#b1bbac", "#cdd3bd", "#e1e3ce"],
      wet: ["#688b83", "#91aaa1", "#aec2b3", "#c7d2bd"],
      leaf: ["#345c56", "#547e6c", "#84a68a", "#adc2a0"],
      leafLight: ["#466e5e", "#719480", "#9ab79a", "#c0d0b0"],
      rock: ["#748b89", "#9aafaa", "#bbcac0", "#d6dfd1"],
      grass: ["#547969", "#73917b", "#9eb39a", "#b4c6a6"],
    },
    green: {
      bank: ["#3b653d", "#608d45", "#8bb15b", "#acc576"],
      sand: ["#a49e69", "#c1bd83", "#d6d3a0", "#e5e2bb"],
      wet: ["#729567", "#9eb180", "#bbca9b", "#d3dab4"],
      leaf: ["#285c3f", "#4b8249", "#7eac55", "#a8c672"],
      leafLight: ["#3e6e3e", "#68964b", "#96bb60", "#bed388"],
      rock: ["#7c8a77", "#a6b096", "#c0c9aa", "#d9dfc3"],
      grass: ["#587b43", "#789350", "#a3b66a", "#bac681"],
    },
  };
  function setPalette(id: "sage" | "blue" | "green"): void {
    const palette = palettes[id];
    const recolor = (target: THREE.ShaderMaterial, colors: string[]): void => {
      (target.uniforms.uPalette.value as THREE.Color[]).forEach((color, i) =>
        color.set(colors[i]),
      );
    };
    recolor(bankMaterial, palette.bank);
    recolor(sandMaterial, palette.sand);
    recolor(wetSandMaterial, palette.wet);
    recolor(leafMaterial, palette.leaf);
    recolor(leafLightMaterial, palette.leafLight);
    recolor(rockMaterial, palette.rock);
    ["uGrassLowA", "uGrassLowB", "uGrassHighA", "uGrassHighB"].forEach(
      (name, i) => {
        grassMaterial.uniforms[name].value.set(palette.grass[i]);
      },
    );
  }

  let lastGrassTime: number | undefined;
  let extraGustPhase = 0;
  return {
    group,
    setPalette,
    update(time, wind) {
      const now = Number.isFinite(time) ? Math.max(0, time) : (lastGrassTime ?? 0);
      const response = windResponse(wind);
      if (lastGrassTime !== undefined) {
        if (now < lastGrassTime) extraGustPhase = 0;
        else extraGustPhase += (now - lastGrassTime) * (response.gustSpeed - 1);
      }
      lastGrassTime = now;
      grassMaterial.uniforms.uTime.value = now + extraGustPhase;
      grassMaterial.uniforms.uWind.value = response.strength;
      grassMaterial.uniforms.uBendAmplitude.value = response.grassBend;
    },
    dispose() {
      geometries.forEach((value) => value.dispose());
      materials.forEach((value) => value.dispose());
      grass.dispose();
      meadowTiles.forEach((tile) => tile.dispose());
      flowers.dispose();
      centers.dispose();
      group.clear();
    },
  };
}
