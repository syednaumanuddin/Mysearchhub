import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

const PAGES = ["popup", "results", "settings", "onboarding"] as const;

const outDir = () => fileURLToPath(new URL("./dist", import.meta.url));

/**
 * Move each page to the `dist/` root and re-point its asset URLs.
 *
 * `manifest.json` refers to `popup.html`, `settings.html` and so on by bare
 * name, and Vite emits HTML at its path relative to `root`, which would leave
 * them in `dist/popup/popup.html`. Because `base` is `"./"`, the only rewrite
 * needed is one directory level up -> level.
 */
function flattenPages(): Plugin {
  return {
    name: "mysearchhub-flatten-pages",
    apply: "build",
    enforce: "post",
    async closeBundle() {
      const dist = outDir();

      for (const page of PAGES) {
        const source = join(dist, page, `${page}.html`);
        const target = join(dist, `${page}.html`);

        const html = (await readFile(source, "utf8")).replaceAll("../assets/", "./assets/");
        await writeFile(target, html);
        await rm(join(dist, page), { recursive: true, force: true });
      }
    },
  };
}

/**
 * Pages build: popup / results / settings / onboarding.
 *
 * `base: "./"` is mandatory. Extension pages are served from
 * `chrome-extension://<id>/...` where root-absolute asset URLs resolve against
 * the extension origin and 404.
 */
export default defineConfig({
  base: "./",
  root: "src",
  publicDir: "../public",
  plugins: [react(), flattenPages()],
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    target: "chrome116",
    rollupOptions: {
      input: {
        popup: fileURLToPath(new URL("./src/popup/popup.html", import.meta.url)),
        results: fileURLToPath(new URL("./src/results/results.html", import.meta.url)),
        settings: fileURLToPath(new URL("./src/settings/settings.html", import.meta.url)),
        onboarding: fileURLToPath(new URL("./src/onboarding/onboarding.html", import.meta.url)),
      },
    },
  },
});
