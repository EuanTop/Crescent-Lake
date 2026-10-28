# Visual language studies — v0.3

## Direction and selection

The user rejected the first anisotropic Kuwahara experiment because it blurred the scene. It has been replaced with six distinct, sharper WebGL treatments plus an unfiltered baseline. All comparisons use a 9:16 portrait viewport, a portrait artwork, the same palette and a paused scene. The user selects the final visual language; Cel Illustration is the initial preview.

| Choice           | Implemented algorithm                                           | Visual intent                                                    |
| ---------------- | --------------------------------------------------------------- | ---------------------------------------------------------------- |
| Original         | Direct scene rendering                                          | Unfiltered baseline at full canvas resolution                    |
| Cel Illustration | RGB Sobel edges + perceptual color quantization                 | Fine outlines and cleaner illustrated color masses               |
| Watercolor       | Edge pooling + stable procedural pigment granulation            | Transparent paper and pigment character while retaining contours |
| Risograph        | Two rotated halftone screens + two-ink color separation         | Visible teal/coral print dots and slight ink offset              |
| Copperplate      | Luminance-dependent multi-direction crosshatching + color edges | Sepia line engraving on cream paper                              |
| Pixel Story      | Nearest block sampling + 4×4 Bayer ordered dithering            | Deliberate hard-edged pixels and limited color steps             |
| Cyanotype        | Gradient contours + inverted tonal mapping                      | Pale lines and tones on indigo                                   |

`src/scene/styles.ts` defines names and descriptions. `src/scene/painterly.ts` implements a linear-color scene target, one style pass and one final display conversion. No style averages neighborhood colors. Sobel neighbors are used only for edge detection. Original bypasses the composer completely. Both render targets and canvas retain the configured device-pixel resolution. Effect strength is adjustable; exports include the selected treatment.

These are original compact stylistic approximations, not full reproductions of the research below. In particular, Watercolor does not simulate fluid transport or Kubelka–Munk glazing; Copperplate uses screen-space procedural hatching rather than curvature-aligned tonal art maps. Pixel Story intentionally removes detail by discretization, not blur. Screen-space ink/dots can shimmer against moving small geometry; pause is useful for controlled comparison.

## Primary research and algorithm references

- [Three.js official examples](https://threejs.org/examples/): the `postprocessing / sobel`, `rgb / halftone` and `pixel` examples demonstrate distinct edge, print and discretization approaches. This project implements its own shader treatments and uses installed Three.js post-processing infrastructure.
- Praun, Hoppe, Webb and Finkelstein, [Real-Time Hatching](https://gfx.cs.princeton.edu/proj/hatching/), SIGGRAPH 2001. Tonal art maps and coherent surface-oriented strokes are a stronger future path if the line-engraving direction is selected.
- Curtis et al., [Computer-Generated Watercolor](https://grail.cs.washington.edu/wp-content/uploads/2015/08/curtis-1997-cgw.pdf), SIGGRAPH 1997. The physical model distinguishes pigment granulation, edge darkening and layered glazing; those phenomena motivate the simplified watercolor treatment.
- Kyprianidis et al., [Image and Video Abstraction by Anisotropic Kuwahara Filtering](https://www.kyprianidis.com/p/pg2009/), 2009, and [Polynomial Weighting Functions](https://www.kyprianidis.com/p/tpcg2010/), 2010. Researched and initially prototyped, then removed after the user judged the result too blurry. Restoring this method would require a specific new design decision.
- [Three.js post-processing manual](https://threejs.org/manual/pages/post-processing.html) documents RenderPass, ShaderPass and final OutputPass color conversion.

No third-party shader source or image assets are copied into these treatments. WebGL supplies the rendering mechanism; authored shape, composition, color and motion still determine whether the chosen style is convincing.

## Scene corrections carried forward

Wind now drives broad, low-frequency swells in surface light and reflection coordinates, without directional bands or fine crest textures. The integrated phase does not jump when the strength slider changes; zero wind stops wind-driven marks while swimming can still create wakes.

Wakes persist 22 seconds, sampled every 0.4 seconds into a 64-point history. After 14 seconds they fade smoothly. Historical points retain world positions and headings through turns. Recent points also form a short V-shaped wake. CPU fade calculation and distance-based fragment rejection bound the work.

Low grass covers the entire bank in frustum-culled tiles. Taller near-shore tufts taper into it, and grass roots follow ground height. This fixes the previous rectangular and diagonal coverage boundaries.

## Cel refinement — v0.4

Cel uses a separate antialiased swan silhouette target. All swan meshes render white on layer 1; the mask pass restores renderer, camera and scene state in `finally`. Inside this mask, RGB Sobel edges are suppressed, so overlapping feathers no longer acquire additional ink. A thinner, lighter mask boundary retains the outside shape. The swan casts shadows but does not receive its own shadow, avoiding fine overlapping feather shadow artifacts. Quiet color areas use less posterization so small water marks survive. There is no blur pass.

The final water language returns to lake-wide wavefronts after the user rejected both fine texture and isolated wake-like arc packets. Low-frequency domain warping bends long, sparse wavefronts and varies their spacing; a slowly moving coarse envelope softens their continuity. A narrow smooth crest and an offset, very faint shadow suggest ripples without the original bold stripe field. Maximum wind highlight blend is22.5%, using a color close to the water palette, not white. Broad low-frequency fields also bend reflections. There are no local ring centres, dense microtexture, foam or blur. Typography and paper framing are drawn by the final presentation canvas, identically for preview, PNG and video.

## Softer water, grass and golden light — v0.4.1

Each lake-wide crest now has its own hashed segment spacing and lengths. Segment ends taper over40% of their length; there are true gaps rather than a nonzero opacity floor. Adjacent crests have different break positions, avoiding shared clipping columns. Highlight blend is10% at100%wind and15% at200%, with reduced extra golden emphasis.

Grass retains the same geometry and wind deformation. Its roots are lifted toward middle pigments, random hue spread is narrowed to28%, blade brightness spans98–100%, and the root-to-tip gradient gains a small lift. This reduces the black stipple feeling without blurring the lake or swan.

Golden Hour lowers the sun and separately grades lit pigments, neutral feathers and cooler shadows. Native grass uses cached softened source colors, so switching palettes or returning to Morning cannot accumulate tint. The same golden response is shared between CPU grass colors and toon GLSL.


## Closing the24-second scene — v0.5

The swan completes its full closed route in24seconds, both in preview and film. Capture uses real recording time rather than integrated frame deltas. Morning warmth follows a cosine arch, reaching Golden at12seconds and returning to Morning at24seconds. Small animated details use integer numbers of cycles; moving noise samples follow a circular domain path. These constraints close positions, phases and first derivatives without a last-frame dissolve.

Tree trunks pivot gently at fixed roots and crowns have independently phased sway. Swan wing hinges make several irregular, bounded flutter bursts per circuit, with rest at the seam;200% activity is capped at31degrees. Cloud wrapping occurs outside the portrait composition. Fixed-grid wake samples are prewarmed from the previous cycle. The faster bird's wake uses a separate synchronized clock:215 emissions per circuit preserve the accepted spatial spacing, and expansion plus fade use the same3.5833× time scale. Its22-second authored lifetime occupies about6.14seconds of real time, preserving the original overlapping fan instead of drawing sparse small circles.

Wind waves remain lake-wide, with irregular curved fronts, independent fragment lengths, translucent crests and broad feathered ends. Their visibility has increased from the preceding too-subtle pass while the mirror reflection remains intact. All visual review and final frame extraction use9:16.
