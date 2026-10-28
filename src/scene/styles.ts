/** Deliberately different visual languages; no spatial smoothing is used. */
export const visualStyles = {
  original: {
    name: "Original",
    description: "The unfiltered scene",
    algorithm: "Direct scene rendering",
    mode: 0,
  },
  cel: {
    name: "Cel Illustration",
    description: "Crisp color steps & fine outlines",
    algorithm: "Sobel color edges + perceptual posterization",
    mode: 1,
  },
  watercolor: {
    name: "Watercolor",
    description: "Pigment, paper & pooled edges",
    algorithm: "Edge pigment pooling + procedural granulation",
    mode: 2,
  },
  risograph: {
    name: "Risograph",
    description: "Two inks & printed halftone dots",
    algorithm: "Rotated halftone screens + two-ink separation",
    mode: 3,
  },
  etching: {
    name: "Copperplate",
    description: "Crosshatched ink on warm paper",
    algorithm: "Tone-dependent crosshatching + edge extraction",
    mode: 4,
  },
  pixel: {
    name: "Pixel Story",
    description: "Hard pixels & ordered color dithering",
    algorithm: "Nearest block sampling + Bayer ordered dithering",
    mode: 5,
  },
  blueprint: {
    name: "Cyanotype",
    description: "Pale contours on deep indigo",
    algorithm: "Gradient contours + inverted tonal mapping",
    mode: 6,
  },
} as const;
export type VisualStyleId = keyof typeof visualStyles;
