import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Loads .env.test and aborts the run if it could touch a non-test database.
    setupFiles: ["src/tests/setup.ts"],
    // All test files share one database, so they must run one after another.
    fileParallelism: false,
    // The test database is remote (Neon), so allow slow round trips.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
