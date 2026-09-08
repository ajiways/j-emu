import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import dbConfig from "../../../vitest.db.config.ts";
import e2eConfig from "../../../vitest.e2e.config.ts";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

describe("vitest database configs", () => {
  it("load without TEST_DATABASE_URL so Knip can analyze them", () => {
    expect(dbConfig.test?.include).toEqual(["tests/integration/postgres/**/*.test.ts"]);
    expect(e2eConfig.test?.include).toEqual(["tests/e2e/**/*.test.ts"]);
    expect(dbConfig.test?.setupFiles).toEqual([
      "./tests/support/postgres/require-test-database-url.setup.ts",
    ]);
    expect(e2eConfig.test?.setupFiles).toEqual([
      "./tests/support/postgres/require-test-database-url.setup.ts",
    ]);
  });

  it("can be evaluated when TEST_DATABASE_URL is unset", () => {
    for (const config of ["vitest.db.config.ts", "vitest.e2e.config.ts"]) {
      const result = spawnWithoutTestDatabaseUrl(config);
      expect(result.status, `${config}: ${result.stderr}`).toBe(0);
    }
  });

  it("still fail-fasts from setupFiles when TEST_DATABASE_URL is missing", () => {
    const result = spawnWithoutTestDatabaseUrl(
      "tests/support/postgres/require-test-database-url.setup.ts",
    );
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toMatch(/TEST_DATABASE_URL is required/);
  });
});

function spawnWithoutTestDatabaseUrl(modulePath: string) {
  const env = { ...process.env };
  delete env.TEST_DATABASE_URL;
  return spawnSync(process.execPath, ["--import", "tsx", modulePath], {
    cwd: packageRoot,
    env,
    encoding: "utf8",
  });
}
