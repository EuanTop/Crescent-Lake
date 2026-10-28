# Rendering

The scene uses authored geometry, four-band palette lighting and a full-resolution style pass. Cel Illustration is the default. There is no spatial blur pass.

| Style | Algorithm |
| --- | --- |
| Original | Direct scene render |
| Cel Illustration | Color quantization, Sobel edges and a separate swan silhouette mask |
| Watercolor | Edge pooling and stable pigment granulation |
| Risograph | Two ink separations and rotated halftone screens |
| Copperplate | Luminance-dependent crosshatching |
| Pixel Story | Block sampling and 4×4 Bayer dithering |
| Cyanotype | Indigo tonal mapping and pale contours |

These are compact stylistic approximations. Watercolor does not simulate pigment transport; Copperplate uses screen-space hatching. Pixel Story deliberately reduces spatial detail.

## Swan and shore

A separate mask suppresses internal Sobel edges on the swan while retaining a thin outer contour. Feather overlaps do not receive extra ink. The swan casts shadows without receiving its own feather shadows.

Low grass covers the whole visible bank, with taller tufts near the shore. Curved ribbons vary in length and direction. Softened roots and limited brightness variation reduce dark stippling. Moving noise supplies coherent gusts; local phases add tip movement. Tree trunks pivot at their roots, with independently phased crowns.

## Water and light

Reflector supplies the mirror image. Broad, low-frequency fields move reflections; irregular wavefront segments add translucent wind marks with soft ends and true gaps. Wind changes their movement and visibility while preserving readable reflections.

Wakes retain emission positions and headings in world space. At the 24-second swim speed, 215 emissions per lap preserve the original spatial density. Their expansion and fade share a 3.5833× clock: approximately 55 overlapping arcs remain visible for 6.14 real seconds. History is prewarmed for a seamless export.

Golden Hour lowers the sun, lengthens shadows and adds honey-colored highlights while preserving cooler shadows. Palette changes always derive from cached source colors, preventing accumulated tint.

## Resolution

The composer and silhouette targets retain the actual render resolution. Native 4K export also resizes the reflection target and presentation canvas. A 2× render ratio preserves the intended outline proportions; typography is drawn at the final resolution.

## References

[Three.js post-processing](https://threejs.org/manual/pages/post-processing.html) · [Real-Time Hatching](https://gfx.cs.princeton.edu/proj/hatching/) · [Computer-Generated Watercolor](https://grail.cs.washington.edu/wp-content/uploads/2015/08/curtis-1997-cgw.pdf)
