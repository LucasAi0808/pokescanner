import { defineConfig } from "vitest/config";

// Röktest mot riktiga API:t. Körs bara med `npm run smoke:real`.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/smoke/**/*.smoke.ts"],
    testTimeout: 5 * 60_000,
  },
});
