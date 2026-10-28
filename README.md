# Crescent Lake

An illustrated living landscape: a curved grassy shore, a white swan, passing clouds, small flying birds, and ripples that remember where the swan has been.

This is an independent local project and Git repository. It explores composition, color and movement rather than reproducing a surveyed location.

## Run

Requires Node.js 22.12 or newer.

```sh
npm ci
npm run dev
```

Open the existing local address, normally `http://127.0.0.1:5173/`. The page starts as a screen-fitting 9:16 artwork with no page scrolling. **Frame** in the settings panel switches the same canvas in place. `/review.html` is only a compatibility redirect to this page; it no longer contains an iframe or engineering labels.

Validate and build:

```sh
npm test
npm run build
npm run preview
```

The static build is written to `dist/`, which is ignored by Git. WebGL 2 is required. All runtime models, geometry and typography are local; no external assets, fonts or services are requested.

## Scene settings

Open the **=** button at the right edge. Close with the × button, Escape, or a click outside. Hidden controls are removed from keyboard navigation. The panel fits narrow screens and remains independently scrollable with its scrollbar concealed. The artwork never scrolls.

- **Color story**: Soft Sage retains the original painted palette; Blue Reverie adds cobalt water and cool vegetation; Wild River adds olive water and a verdant shore. Water, reflections, grass, trees, rocks and shoreline change together.
- **Light**: Morning or Golden hour, with a smooth change of light and shadow direction.
- **Visual language**: choose Original, Cel Illustration, Watercolor, Risograph, Copperplate, Pixel Story or Cyanotype. Six distinct shader approaches preserve sharp contours; Effect strength adjusts their intensity. See [algorithm and design notes](docs/PAINTERLY.md).
- **Wind strength**: controls traveling gusts, grass-tip flutter and water ripples. Defaults to the former maximum (100%), with an extended 0–200% range. Still removes grass displacement and wind wavelets; stronger settings add gusts and broad, slow changes in water light and reflected shapes. Broken, translucent wavefronts of varied lengths travel across the whole lake, with soft ends and gaps. Their spacing is organically warped; wind increases their movement and visibility while broad reflections remain readable.
- **Swan movement**: adjusts breathing, irregular short flapping bursts and occasional stretches. The swan completes one circuit in24seconds in preview and loop capture. Defaults to 100%; the extended 200% setting increases gesture frequency and lift without exceeding bounded articulation.
- **Passing overhead**: independently show or hide drifting clouds and flying birds.
- **Pause / Resume**: freezes the swan, grass, clouds, birds, water and wakes together. Settings remain adjustable. Repeated drawing stops once the scene is stable.
- **Save image**: exports the composed artwork as a PNG, including its title, seasonal note, paper framing and closing line. Controls are excluded.

- **Frame**: Portrait 9:16 or Landscape 16:9, applied directly without navigation or a different server.
- **Soundtrack**: an original48-second arrangement of breathing sustained tones, extended harmonies and quiet answering phrases. Play/Pause controls listening; Include music in video is enabled by default. The lead completes a left–right–left orbit in9seconds during normal listening and8seconds in the24-second film; filtered echoes alternate sides, while a rounded bass stays centered and follows the6/8 beat. No music files or third-party samples are used. See [sound design and reading](docs/SOUND-DESIGN.md).
- **Export video**: **Loop one lake circuit** is on by default and fixes the duration to24seconds. Turn it off to choose5,10,15,17,20,24,30or60seconds. Portrait exports at 1080 × 1920; landscape at 1920 × 1080. Capture requests30fps; actual frame rate depends on the GPU and browser. MP4/H.264 with AAC is preferred when available, otherwise WebM with the supported encoder. The filename follows the actual container.

During recording, the entire control interface hides and the scene plays even if previously paused. Press **Escape** to stop early and save the partial clip. After export, the previous playback state and display resolution return. Recording includes the complete artwork and optional music. Loop export uses a prepared24-second score with incoming reverberation tails and no ending fade; regular clips keep the two-second fade. Browser chrome and engineering text are never part of the captured canvas. Keep the page visible; switching away finalizes the clip early. **Morning → Golden → Morning** eases to Golden at12seconds and returns to Morning at24seconds. Tree crowns, grass, clouds, bird flight, swan pose and water all share the closing period. The prewarmed wake retains a6.72-second trailing ribbon at the faster swim speed. Disable the light journey to keep the selected light throughout. Non-loop clips retain a one-way Morning-to-Golden journey.

**Save loop audio** downloads the exact24-second stereo score as float WAV. The prepared PCM has matching endpoint samples and no silence or fade. Some browser AAC encoders add roughly40ms of leading padding to direct video exports. The delivered `artifacts/crescent-lake-loop-24s.mp4` was finalized from the browser video and this original WAV, with FFmpeg honoring AAC priming metadata:

```sh
ffmpeg -i browser-loop.mp4 -i crescent-lake-loop-24s.wav -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 192k -t 24 -movflags +faststart final-loop.mp4
```

The system's reduced-motion preference starts the scene paused. Playback can still be started manually.

## Implementation

| File                        | Responsibility                                                     |
| --------------------------- | ------------------------------------------------------------------ |
| `src/scene/world.ts`        | Camera, lighting, model loading, swimming route and lifecycle      |
| `src/scene/palettes.ts`     | Three named color stories and lake colors                          |
| `src/scene/materials.ts`    | Four-band painted lighting and shadows                             |
| `src/scene/painterly.ts`    | Six sharp post-processing treatments and output conversion         |
| `src/scene/recording.ts`    | Video/audio capture, encoder fallback, downloads and cleanup       |
| `src/scene/music.ts`        | Original generative Web Audio score and synthesizer                |
| `src/scene/presentation.ts` | Shared artwork typography and paper framing for display and export |
| `src/scene/framing.ts`      | Portrait composition and camera bounds                             |
| `src/scene/swan-mask.ts`    | Silhouette-only swan ink mask, excluding feather overlaps          |
| `src/scene/styles.ts`       | Filter names and algorithm metadata                                |
| `src/scene/water.ts`        | Planar reflection, procedural ripples and world-space wakes        |
| `src/scene/landscape.ts`    | Irregular shore, trees, curved instanced grass and traveling gusts |
| `src/scene/swan.ts`         | Wing articulation, breathing and stretching                        |
| `src/scene/atmosphere.ts`   | Procedural clouds and flapping bird silhouettes                    |
| `src/scene/motion.ts`       | Frame-rate-independent travel and bounded wake history             |
| `scripts/create_bird.py`    | Reproducible Blender model generator                               |
| `public/models/swan.glb`    | Self-contained swan asset; Blender is not needed to run the page   |

Artwork headings use locally bundled **Goudy Bookletter1911** by Barry Schwartz from [The League of Moveable Type](https://github.com/theleagueof/goudy-bookletter-1911). Original license and source notices are retained in `public/fonts/`. The page waits for the face before drawing or recording.

Built with Three.js, TypeScript, Vite and custom GLSL; exact versions are locked. No runtime React dependency.

### Regenerate the swan

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b --python scripts/create_bird.py
```

The original generator uses swept curves, ellipsoids, feather surfaces and a continuous body/neck union. The exported GLB is about 263 KiB, with no textures or decoders. Three.js coordinates use +Y up and +Z forward, with the waterline at Y=0; the scene scales the swan by 1.12.

## Scope

Ripples and wind are visual approximations rather than fluid simulation. The swan follows a designed closed path. Animation articulates model parts without a skeletal neck rig. Styling comes from authored shapes, color bands and lighting; six optional scene filters provide distinct visual treatments. Desktop and emulated mobile checks do not establish physical-phone performance or battery usage.

The project is committed locally; no remote repository has been created or pushed. See [design notes](docs/DESIGN.md) and [validation](docs/VALIDATION.md).
