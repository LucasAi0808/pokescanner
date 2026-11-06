import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" gör att bygget fungerar både lokalt och under en GitHub Pages-undersökväg.
export default defineConfig({
  base: "./",
  plugins: [react()],
  server: { port: 5173 },
  test: {
    environment: "jsdom",
    include: ["tests/unit/**/*.test.ts"],
  },
});
