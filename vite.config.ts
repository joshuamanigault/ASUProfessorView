import { defineConfig } from "vite";
import { copyFileSync, cpSync } from "fs";

const buildTarget = process.env.BUILD_TARGET || "chrome";
const outDir = buildTarget === "firefox" ? "dist-firefox" : "dist-chrome";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        content: "src/Content/content.js",
        background: "src/Background/background.ts",
        options: "src/Options/options.ts",
      },
      output: {
        entryFileNames: "[name].js",
      },
    },
    outDir: outDir,
    emptyOutDir: true,
  },
  plugins: [
    {
      name: "copy-assets",
      writeBundle() {
        const manifestSource = `src/manifest.${buildTarget}.json`;
        copyFileSync(manifestSource, `${outDir}/manifest.json`);
        cpSync("src/icons", `${outDir}/icons`, { recursive: true });
        copyFileSync("src/Popup/popup.html", `${outDir}/popup.html`);
        copyFileSync("src/Options/options.html", `${outDir}/options.html`);
        copyFileSync("src/Options/options.css", `${outDir}/options.css`);
        copyFileSync("src/Content/content.styles.css", `${outDir}/content.styles.css`);
        copyFileSync("src/Content/templates.js", `${outDir}/templates.js`);
        copyFileSync("src/Popup/popup.js", `${outDir}/popup.js`);
      },
    },
  ],
});
