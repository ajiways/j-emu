import { describe, expect, it } from "vitest";
import { requireDevelopmentDatabaseUrl } from "../../../src/infrastructure/postgres/development-database-url.ts";
import { postgresDatabaseName } from "../../../src/infrastructure/postgres/postgres-database-name.ts";
import { resetDevelopmentDatabase } from "../../../src/infrastructure/postgres/reset-development-database.ts";

describe("postgresDatabaseName", () => {
  it("parses a simple database name", () => {
    expect(postgresDatabaseName("postgres://jemu@127.0.0.1:5432/jemu")).toBe("jemu");
  });

  it("refuses the postgres maintenance database", () => {
    expect(() => postgresDatabaseName("postgres://jemu@127.0.0.1:5432/postgres")).toThrow(
      /maintenance database/,
    );
  });

  it("refuses an empty database name", () => {
    expect(() => postgresDatabaseName("postgres://jemu@127.0.0.1:5432/")).toThrow(
      /has no database name/,
    );
  });
});

describe("requireDevelopmentDatabaseUrl", () => {
  it("fails when the URL is missing", () => {
    expect(() =>
      requireDevelopmentDatabaseUrl("", "postgres://jemu@127.0.0.1:5432/jemu_test"),
    ).toThrow(/DATABASE_URL is required/);
  });

  it("refuses a _test database", () => {
    expect(() =>
      requireDevelopmentDatabaseUrl(
        "postgres://jemu@127.0.0.1:5432/jemu_test",
        "postgres://jemu@127.0.0.1:5432/other_test",
      ),
    ).toThrow(/_test database/);
  });

  it("refuses a URL equal to TEST_DATABASE_URL", () => {
    const url = "postgres://jemu@127.0.0.1:5432/jemu";
    expect(() => requireDevelopmentDatabaseUrl(url, url)).toThrow(
      /must not equal TEST_DATABASE_URL/,
    );
  });
});

describe("resetDevelopmentDatabase", () => {
  it("refuses a _test database before connecting", async () => {
    await expect(
      resetDevelopmentDatabase({
        databaseUrl: "postgres://jemu@127.0.0.1:5432/jemu_test",
        bundleFile: "content/playable-slice.json",
        testDatabaseUrl: "postgres://jemu@127.0.0.1:5432/other_test",
      }),
    ).rejects.toThrow(/_test database/);
  });
});
