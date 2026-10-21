import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    ignores: [
      "dist/**",
      "dist-chrome/**",
      "dist-firefox/**",
      "artifacts/**",
      "node_modules/**",
    ],
  },
  {
    files: ["src/**/*.{js,ts}", "tests/**/*.js", "scripts/**/*.mjs", "vite.config.ts"],
    plugins: { js },
    extends: ["js/recommended"],
  },
  {
    files: ["src/**/*.{js,ts}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        chrome: "readonly",
      },
    },
  },
  {
    files: ["scripts/**/*.mjs", "tests/**/*.js", "vite.config.ts"],
    languageOptions: {
      globals: globals.node,
    },
  },
  tseslint.configs.recommended,
]);