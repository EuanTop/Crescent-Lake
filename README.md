# Crescent Lake

An illustrated living landscape: a curved grassy shore, a white swan, passing clouds, small flying birds, and ripples that remember where the swan has been.

This is an independent local project and Git repository. It explores composition, color and movement rather than reproducing a surveyed location.

## Run

Requires Node.js 22.12 or newer.

```sh
npm ci
npm run dev
```

For a fixed preview address:

```sh
npm run dev -- --port 5187 --strictPort
```

Validate and build:

```sh
npm test
npm run build
npm run preview
```

The static build is written to `dist/`, which is ignored by Git. WebGL 2 is required. All runtime models, geometry and typography are local; no external assets, fonts or services are requested.

## Scene settings

Open the **=** button at the right edge. Close with the × button, Escape, or a click outside. Hidden controls are removed from keyboard navigation. The panel fits narrow screens and scrolls independently when needed.

- **Color story**: Soft Sage retains the original painted palette; Blue Reverie adds cobalt water and cool vegetation; Wild River adds olive water and a verdant shore. Water, reflections, grass, trees, rocks and shoreline change together.
- **Light**: Morning or Golden hour, with a smooth change of light and shadow direction.
- **Wind strength**: controls traveling gusts, grass-tip flutter and water ripples. Still removes all grass displacement; Windy makes the gusts clearly visible.
- **Swan movement**: adjusts gentle breathing, wing settling and occasional stretches.
- **Passing overhead**: independently show or hide drifting clouds and flying birds.
- **Pause / Resume**: freezes the swan, grass, clouds, birds, water and wakes together. Settings remain adjustable. Repeated drawing stops once the scene is stable.
- **Save image**: exports a PNG of the current three-dimensional scene, without page text or controls.

The system's reduced-motion preference starts the scene paused. Playback can still be started manually.

## Implementation

| File                      | Responsibility                                                     |
| ------------------------- | ------------------------------------------------------------------ |
| `src/scene/world.ts`      | Camera, lighting, model loading, swimming route and lifecycle      |
| `src/scene/palettes.ts`   | Three named color stories and lake colors                          |
| `src/scene/materials.ts`  | Four-band painted lighting and shadows                             |
| `src/scene/water.ts`      | Planar reflection, procedural ripples and world-space wakes        |
| `src/scene/landscape.ts`  | Irregular shore, trees, curved instanced grass and traveling gusts |
| `src/scene/swan.ts`       | Wing articulation, breathing and stretching                        |
| `src/scene/atmosphere.ts` | Procedural clouds and flapping bird silhouettes                    |
| `src/scene/motion.ts`     | Frame-rate-independent travel and bounded wake history             |
| `scripts/create_bird.py`  | Reproducible Blender model generator                               |
| `public/models/swan.glb`  | Self-contained swan asset; Blender is not needed to run the page   |

Built with Three.js, TypeScript, Vite and custom GLSL; exact versions are locked. No runtime React dependency.

### Regenerate the swan

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b --python scripts/create_bird.py
```

The original generator uses swept curves, ellipsoids, feather surfaces and a continuous body/neck union. The exported GLB is about 263 KiB, with no textures or decoders. Three.js coordinates use +Y up and +Z forward, with the waterline at Y=0; the scene scales the swan by 1.12.

## Scope

Ripples and wind are visual approximations rather than fluid simulation. The swan follows a designed closed path. Animation articulates model parts without a skeletal neck rig. Styling comes from authored shapes, color bands and lighting; no full-screen painterly filter is enabled. Desktop and emulated mobile checks do not establish physical-phone performance or battery usage.

The project is committed locally; no remote repository has been created or pushed. See [design notes](docs/DESIGN.md) and [validation](docs/VALIDATION.md).
