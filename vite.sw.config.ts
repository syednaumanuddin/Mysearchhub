import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

/**
 * Separate single-file ES build for the MV3 service worker.
 *
 * MV3 service workers cannot be code-split: a worker whose entry imports a
 * shared chunk fails to register with "Could not load service worker". Building
 * separately with code splitting disabled guarantees one self-contained
 * `background.js`. `emptyOutDir: false` keeps the pages build intact.
 */
export default defineConfig({
  base: "./",
  build: {
    target: "chrome116",
    outDir: "dist",
    emptyOutDir: false,
    lib: {
      entry: fileURLToPath(new URL("./src/background/service-worker.ts", import.meta.url)),
      formats: ["es"],
      fileName: () => "background.js",
    },
    rollupOptions: {
      output: {
        codeSplitting: false,
      },
    },
  },
});
