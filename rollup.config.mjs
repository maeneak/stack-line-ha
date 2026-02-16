import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";
import json from "@rollup/plugin-json";
import terser from "@rollup/plugin-terser";

export default {
  input: "src/stack-line-card.ts",
  output: {
    file: "dist/stack-line-card.js",
    format: "iife",
    name: "StackLineCard",
    sourcemap: false,
  },
  plugins: [
    resolve({ browser: true }),
    commonjs(),
    typescript(),
    json(),
    terser(),
  ],
};
