import os from "node:os";
import { defineConfig } from "vitest/config";

const workers = Math.min(6, os.availableParallelism());
process.env.E2E_WORKERS = String(workers);

export default defineConfig({
  test: {
    include: ["tests/e2e/**/*.test.ts"],
    globalSetup: ["./tests/support/postgres/e2e-global-setup.ts"],
    setupFiles: ["./tests/support/postgres/e2e-worker-database.setup.ts"],
    environment: "node",
    restoreMocks: true,
    clearMocks: true,
    testTimeout: 60_000,
    hookTimeout: 60_000,
    pool: "forks",
    poolOptions: { forks: { maxForks: workers, minForks: workers } },
    fileParallelism: true,
  },
});
