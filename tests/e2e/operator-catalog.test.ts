import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";

const TOKEN = "test-operator-token";
const MISSING_ARTIFACT = 2_147_483_647;

describe("operator catalog HTTP", () => {
  let harness: ApplicationHarness;
  let application: Application;

  beforeEach(async () => {
    harness = new ApplicationHarness();
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("searches artifacts by title and id, looks up batches, and fail-fasts on 4xx", async () => {
    const unauthorized = await application.http.inject({
      method: "GET",
      url: "/operator/catalog/artifacts?q=мясо",
    });
    expect(unauthorized.statusCode).toBe(401);

    const meat = await operator("/operator/catalog/artifacts?q=Кусок");
    expect(meat.statusCode, JSON.stringify(meat.json())).toBe(200);
    const meatHits = artifactsOf(meat.json());
    expect(meatHits.some((row) => row.id === 77 && row.title === "Кусок мяса")).toBe(true);
    expect(meatHits.every((row) => typeof row.picture === "string")).toBe(true);

    const byIdSearch = await operator("/operator/catalog/artifacts?q=77");
    expect(byIdSearch.statusCode).toBe(200);
    expect(artifactsOf(byIdSearch.json()).some((row) => row.id === 77)).toBe(true);

    const batch = await operator("/operator/catalog/artifacts?ids=77,20");
    expect(batch.statusCode).toBe(200);
    expect(artifactsOf(batch.json()).map((row) => row.id)).toEqual([77, 20]);

    const one = await operator("/operator/catalog/artifacts/77");
    expect(one.statusCode, JSON.stringify(one.json())).toBe(200);
    expect(jsonRecord(one.json()).id).toBe(77);
    expect(jsonRecord(one.json()).title).toEqual(expect.any(String));

    const missing = await operator(`/operator/catalog/artifacts/${MISSING_ARTIFACT}`);
    expect(missing.statusCode).toBe(404);

    const combined = await operator("/operator/catalog/artifacts?q=мясо&ids=77");
    expect(combined.statusCode).toBe(400);

    const unknownField = await operator("/operator/catalog/artifacts?foo=1");
    expect(unknownField.statusCode).toBe(400);
  });

  async function operator(url: string) {
    return application.http.inject({
      method: "GET",
      url,
      headers: { authorization: `Bearer ${TOKEN}` },
    });
  }
});

function artifactsOf(value: unknown): Array<Record<string, unknown>> {
  const record = jsonRecord(value);
  const artifacts = record.artifacts;
  if (!Array.isArray(artifacts)) throw new Error("artifacts is missing");
  return artifacts.map((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      throw new Error("artifact brief is invalid");
    }
    return row as Record<string, unknown>;
  });
}

function jsonRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("expected a JSON object");
  }
  return value as Record<string, unknown>;
}
