import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"], // Support both for maximum compatibility
  dts: true, // Generate .d.ts files automatically
  splitting: false,
  sourcemap: true,
  clean: true, // Clean dist folder before each build
});
