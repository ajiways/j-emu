import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { loadPackageEnv } from "../../../src/infrastructure/load-package-env.ts";

describe("loadPackageEnv", () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  let root: string | undefined;

  afterEach(() => {
    if (root) fs.rmSync(root, { recursive: true, force: true });
    root = undefined;
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
  });

  it("loads .env from the package root when the entry is nested under dist/src", () => {
    const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "j-emu-env-"));
    root = fixture;
    fs.writeFileSync(path.join(fixture, "package.json"), '{"name":"env-fixture"}\n');
    fs.writeFileSync(path.join(fixture, ".env"), "DATABASE_URL=from-package-root\n");
    const nested = path.join(fixture, "dist", "src");
    fs.mkdirSync(nested, { recursive: true });
    delete process.env.DATABASE_URL;

    const resolved = loadPackageEnv(pathToFileURL(path.join(nested, "main.js")).href);

    expect(fs.realpathSync(resolved)).toBe(fs.realpathSync(fixture));
    expect(process.env.DATABASE_URL).toBe("from-package-root");
  });

  it("does not overwrite an environment variable that is already set", () => {
    const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "j-emu-env-"));
    root = fixture;
    fs.writeFileSync(path.join(fixture, "package.json"), '{"name":"env-fixture"}\n');
    fs.writeFileSync(path.join(fixture, ".env"), "DATABASE_URL=from-file\n");
    process.env.DATABASE_URL = "from-process";

    loadPackageEnv(pathToFileURL(path.join(fixture, "main.js")).href);

    expect(process.env.DATABASE_URL).toBe("from-process");
  });

  it("fails when .env is missing at the package root", () => {
    const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "j-emu-env-"));
    root = fixture;
    fs.writeFileSync(path.join(fixture, "package.json"), '{"name":"env-fixture"}\n');

    expect(() => loadPackageEnv(pathToFileURL(path.join(fixture, "main.js")).href)).toThrow(
      /\.env is missing/,
    );
  });
});
