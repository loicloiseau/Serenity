import resolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";

export default {
  input: "src/main.js",
  output: {
    file: "dist/serenity-cards.js",
    format: "es",
    banner: "/*! Serenity Cards for Home Assistant — MIT licensed */",
  },
  plugins: [resolve(), terser()],
};
