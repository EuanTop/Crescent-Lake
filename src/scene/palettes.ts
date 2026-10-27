export type PaletteId = "sage" | "blue" | "green";
export const palettes = {
  sage: {
    name: "Soft Sage",
    note: "A quiet, painted morning",
    deep: "#83ab9f",
    pale: "#a8c6b4",
    reflection: "#d3eddb",
    sky: "#d7e2cd",
  },
  blue: {
    name: "Blue Reverie",
    note: "Cobalt water & ivory feathers",
    deep: "#244a87",
    pale: "#6489bd",
    reflection: "#c2d8ff",
    sky: "#b4c4df",
  },
  green: {
    name: "Wild River",
    note: "Olive water & a verdant shore",
    deep: "#3c4827",
    pale: "#7a8843",
    reflection: "#d4dfb4",
    sky: "#b9c59e",
  },
} as const;
