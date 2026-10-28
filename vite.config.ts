import { defineConfig } from "vite";
import { losslessExportPlugin } from "./scripts/lossless-export.ts";

export default defineConfig({
  plugins: [losslessExportPlugin()],
  build: {
    rolldownOptions: {
      input: { main: "index.html", review: "review.html" },
    },
  },
});
