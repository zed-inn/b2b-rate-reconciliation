import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.{test,spec}.ts", "../../packages/shared/**/*.{test,spec}.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@auditsys/shared": path.resolve(__dirname, "../../packages/shared"),
    },
  },
});
