import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/integration/postgres/**/*.test.ts"],
    setupFiles: ["./tests/support/postgres/require-test-database-url.setup.ts"],
    environment: "node",
    restoreMocks: true,
    clearMocks: true,
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
