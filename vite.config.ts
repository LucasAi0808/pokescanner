import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" makes the build work both locally and under a GitHub Pages sub-path.
export default defineConfig({
  base: "./",
  plugins: [react()],
  server: { port: 5173 },
  test: {
    environment: "jsdom",
    include: ["tests/unit/**/*.test.ts"],
  },
});
