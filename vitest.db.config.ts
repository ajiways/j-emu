import { requireTestDatabaseUrl } from "./tests/support/postgres/test-database-url.ts";
import { defineConfig } from "vitest/config";

requireTestDatabaseUrl();

export default defineConfig({
  test: {
    include: ["tests/integration/postgres/**/*.test.ts"],
    environment: "node",
    restoreMocks: true,
    clearMocks: true,
    testTimeout: 10_000,
    fileParallelism: false,
  },
});
