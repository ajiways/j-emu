import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import { moneyFromMinorUnits } from "../../src/modules/jugger-wire/application/money-from-minor-units.ts";
import { AuthenticatedClient } from "../support/harness/authenticated-client.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";
import { bagItemByArtikulId, esrvObjectWith, heroIdFrom } from "../support/harness/wire-payload.ts";

const TOKEN = "test-operator-token";
const MISSING_ARTIFACT = 2_147_483_647;
const MISSING_HERO = 2_147_483_646;

describe("operator hero HTTP", () => {
  let harness: ApplicationHarness;
  let application: Application;

  beforeEach(async () => {
    harness = new ApplicationHarness();
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("grants an item and adjusts silver through restart, and fail-fasts on 4xx", async () => {
    const unauthorized = await application.http.inject({
      method: "GET",
      url: "/operator/hero/1",
    });
    expect(unauthorized.statusCode).toBe(401);

    const wrongToken = await application.http.inject({
      method: "GET",
      url: "/operator/hero/1",
      headers: { authorization: "Bearer other-token" },
    });
    expect(wrongToken.statusCode).toBe(401);

    const client = await AuthenticatedClient.login(application);
    const init = await client.objectAction({ object: "common", action: "init", sq: 1 });
    const heroId = heroIdFrom(init);

    const invalidId = await operator(application, "GET", "/operator/hero/0");
    expect(invalidId.statusCode).toBe(400);

    const missingHero = await operator(application, "GET", `/operator/hero/${MISSING_HERO}`);
    expect(missingHero.statusCode).toBe(404);
    expect(jsonRecord(missingHero.json()).error).toMatch(/was not found/);

    const before = await operator(application, "GET", `/operator/hero/${heroId}`);
    expect(before.statusCode, JSON.stringify(before.json())).toBe(200);
    const beforeState = jsonRecord(before.json());
    expect(beforeState.id).toBe(heroId);
    expect(beforeState.exp).toBe(1);
    const moneyBefore = requireInt(beforeState.moneyMinor);
    expect(bagQuantity(beforeState, 77)).toBe(4);

    const missingArtifact = await operator(application, "POST", `/operator/hero/${heroId}/items`, {
      artifactId: MISSING_ARTIFACT,
      quantity: 1,
    });
    expect(missingArtifact.statusCode).toBe(404);

    const invalidQuantity = await operator(application, "POST", `/operator/hero/${heroId}/items`, {
      artifactId: 77,
      quantity: 0,
    });
    expect(invalidQuantity.statusCode).toBe(400);

    const unknownField = await operator(application, "POST", `/operator/hero/${heroId}/items`, {
      artifactId: 77,
      quantity: 1,
      extra: true,
    });
    expect(unknownField.statusCode).toBe(400);

    const granted = await operator(application, "POST", `/operator/hero/${heroId}/items`, {
      artifactId: 77,
      quantity: 1,
    });
    expect(granted.statusCode, JSON.stringify(granted.json())).toBe(200);
    expect(bagQuantity(jsonRecord(granted.json()), 77)).toBe(5);

    const zeroMoney = await operator(application, "POST", `/operator/hero/${heroId}/money`, {
      minorUnits: 0,
    });
    expect(zeroMoney.statusCode).toBe(400);

    const credited = await operator(application, "POST", `/operator/hero/${heroId}/money`, {
      minorUnits: 250,
    });
    expect(credited.statusCode, JSON.stringify(credited.json())).toBe(200);
    expect(jsonRecord(credited.json()).moneyMinor).toBe(moneyBefore + 250);

    const hud = esrvObjectWith(await client.pollEsrv(), "state");
    expect(hud.state).toMatchObject({ money: moneyFromMinorUnits(moneyBefore + 250) });
    expect(hud["user|conf"]).toMatchObject({ money: (moneyBefore + 250) / 100 });
    expect(hud["user|unitframe"]).toMatchObject({ status: 100 });
    expect(bagItemByArtikulId(hud, 77).cnt).toBe(5);

    const debited = await operator(application, "POST", `/operator/hero/${heroId}/money`, {
      minorUnits: -250,
    });
    expect(debited.statusCode, JSON.stringify(debited.json())).toBe(200);
    expect(jsonRecord(debited.json()).moneyMinor).toBe(moneyBefore);

    const tooPoor = await operator(application, "POST", `/operator/hero/${heroId}/money`, {
      minorUnits: -(moneyBefore + 1),
    });
    expect(tooPoor.statusCode).toBe(409);

    let bagFullStatus = 0;
    for (let n = 0; n < 20; n += 1) {
      const fill = await operator(application, "POST", `/operator/hero/${heroId}/items`, {
        artifactId: 1,
        quantity: 1,
      });
      bagFullStatus = fill.statusCode;
      if (fill.statusCode === 409) break;
      expect(fill.statusCode, JSON.stringify(fill.json())).toBe(200);
    }
    expect(bagFullStatus).toBe(409);

    application = await harness.restart();
    const restored = await operator(application, "GET", `/operator/hero/${heroId}`);
    expect(restored.statusCode, JSON.stringify(restored.json())).toBe(200);
    const afterRestart = jsonRecord(restored.json());
    expect(bagQuantity(afterRestart, 77)).toBe(5);
    expect(afterRestart.moneyMinor).toBe(moneyBefore);
  });
});

async function operator(
  application: Application,
  method: "GET" | "POST",
  url: string,
  body?: unknown,
) {
  return application.http.inject({
    method,
    url,
    headers: {
      authorization: `Bearer ${TOKEN}`,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { payload: Buffer.from(JSON.stringify(body)) }),
  });
}

function jsonRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("expected a JSON object");
  }
  return value as Record<string, unknown>;
}

function requireInt(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error("expected an integer");
  }
  return value;
}

function bagQuantity(state: Record<string, unknown>, artifactId: number): number {
  const bag = state.bag;
  if (!Array.isArray(bag)) throw new Error("bag is missing");
  let total = 0;
  for (const row of bag) {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      throw new Error("bag item is invalid");
    }
    const item = row as Record<string, unknown>;
    if (item.artifactId === artifactId) total += requireInt(item.quantity);
  }
  return total;
}
