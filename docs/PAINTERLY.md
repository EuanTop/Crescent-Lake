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

Wind drives directional moving wave bands, broad gust patches and finer crests. The integrated phase does not jump when the strength slider changes; zero wind stops wind-driven marks while swimming can still create wakes.

Wakes persist 22 seconds, sampled every 0.4 seconds into a 64-point history. After 14 seconds they fade smoothly. Historical points retain world positions and headings through turns. Recent points also form a short V-shaped wake. CPU fade calculation and distance-based fragment rejection bound the work.

Low grass covers the entire bank in frustum-culled tiles. Taller near-shore tufts taper into it, and grass roots follow ground height. This fixes the previous rectangular and diagonal coverage boundaries.
