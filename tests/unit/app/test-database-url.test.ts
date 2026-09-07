import { describe, expect, it } from "vitest";
import { requireTestDatabaseUrl } from "../../support/postgres/test-database-url.ts";

describe("requireTestDatabaseUrl", () => {
  it("fails when the URL is missing", () => {
    expect(() => requireTestDatabaseUrl("", "postgres://jemu@127.0.0.1:5432/jemu")).toThrow(
      /TEST_DATABASE_URL is required/,
    );
  });

  it("refuses a database name without the _test suffix", () => {
    expect(() =>
      requireTestDatabaseUrl(
        "postgres://jemu@127.0.0.1:5432/jemu",
        "postgres://jemu@127.0.0.1:5432/other",
      ),
    ).toThrow(/_test suffix/);
  });

  it("refuses a URL equal to DATABASE_URL", () => {
    const url = "postgres://jemu@127.0.0.1:5432/jemu_test";
    expect(() => requireTestDatabaseUrl(url, url)).toThrow(/must not equal DATABASE_URL/);
  });
});
