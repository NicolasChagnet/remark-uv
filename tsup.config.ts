import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  // Force explicit extensions to match package.json exports
  outExtension({ format }) {
    return {
      js: format === "esm" ? ".mjs" : ".cjs",
    };
  },
  dts: {
    compilerOptions: {
      moduleResolution: "NodeNext",
      module: "NodeNext",
      ignoreDeprecations: "6.0",
      types: ["node"],
    },
  },
  splitting: false,
  sourcemap: true,
  clean: true,
});
