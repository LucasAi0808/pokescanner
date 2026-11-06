import { defineConfig } from "vitest/config";

// Smoke test against the real API. Only runs with `npm run smoke:real`.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/smoke/**/*.smoke.ts"],
    testTimeout: 5 * 60_000,
  },
});
