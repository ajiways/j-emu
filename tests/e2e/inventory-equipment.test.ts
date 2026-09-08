import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import type { AmfValue } from "../../src/modules/jugger-wire/amf/amf3.ts";
import { AuthenticatedClient } from "../support/harness/authenticated-client.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";
import { bagItemIdFrom, firstBagItemFrom } from "../support/harness/wire-payload.ts";

describe("inventory equipment", () => {
  let harness: ApplicationHarness;
  let application: Application;

  beforeEach(async () => {
    harness = new ApplicationHarness();
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("equips glove 9095, updates stats, and returns the same instance on PUT_OFF", async () => {
    const client = await AuthenticatedClient.login(application);
    const init = await client.objectAction({ object: "common", action: "init", sq: 1 });
    const itemId = bagItemIdFrom(init);
    expect(firstBagItemFrom(init).artikul_id).toBe(9095);
    expect(skillValue(init["user|skills"], "VIT")).toBe(10);

    const putOn = await client.objectAction({
      object: "common",
      action: "object",
      form: { code: "PUT_ON", artifact_id: itemId },
      sq: 2,
    });
    expect(putOn["common|action"]).toEqual({ status: 100 });
    expect(objectBlock(putOn["user|bag"])).toMatchObject({ status: 100, amount: 0 });
    const equipped = firstArtifact(putOn["user|view"]);
    expect(equipped).toMatchObject({
      id: itemId,
      artikul_id: 9095,
      slot: 32,
      cnt: 0,
      actions: 16,
    });
    expect(skillValue(putOn["user|skills"], "VIT")).toBe(15);
    expect(skillValue(putOn["user|skills"], "STR")).toBe(18);
    expect(objectBlock(putOn["user|unitframe"])).toMatchObject({
      hp: 15,
      hpMax: 15,
      mp: 12,
      mpMax: 12,
    });
    expect(objectBlock(putOn.state)).toMatchObject({ hp: 15, hp_max: 15 });
    expect(objectBlock(putOn["user|conf"]).status).toBe(100);
    expect(putOn["user|pocket"]).toMatchObject({ status: 100 });

    const view = await client.objectAction({ object: "user", action: "view", sq: 3 });
    expect(firstArtifact(view["user|view"]).id).toBe(itemId);

    application = await harness.restart();
    const again = new AuthenticatedClient(application, client.cookie);
    const afterRestart = await again.objectAction({ object: "common", action: "init", sq: 20 });
    expect(objectBlock(afterRestart["user|bag"]).amount).toBe(0);
    expect(skillValue(afterRestart["user|skills"], "VIT")).toBe(15);
    const viewAfter = await again.objectAction({ object: "user", action: "view", sq: 21 });
    expect(firstArtifact(viewAfter["user|view"])).toMatchObject({
      id: itemId,
      artikul_id: 9095,
      slot: 32,
    });
    const frame = await again.objectAction({ object: "user", action: "unitframe", sq: 22 });
    expect(objectBlock(frame["user|unitframe"])).toMatchObject({ hp: 15, hpMax: 15 });

    const putOff = await again.objectAction({
      object: "common",
      action: "object",
      form: { code: "PUT_OFF", object_id: itemId },
      sq: 23,
    });
    expect(putOff["common|action"]).toEqual({ status: 100 });
    expect(bagItemIdFrom(putOff)).toBe(itemId);
    expect(objectBlock(putOff["user|view"]).artifacts).toEqual([]);
    expect(skillValue(putOff["user|skills"], "VIT")).toBe(10);
    expect(objectBlock(putOff["user|unitframe"])).toMatchObject({ hp: 10, hpMax: 10 });
  });

  it("returns status 203 for a forbidden wear and 204 when the item is missing", async () => {
    const client = await AuthenticatedClient.login(application);
    const init = await client.objectAction({ object: "common", action: "init", sq: 1 });
    const itemId = bagItemIdFrom(init);

    const missingId = await client.objectAction({
      object: "common",
      action: "object",
      form: { code: "PUT_ON" },
      sq: 2,
    });
    expect(missingId["common|action"]).toEqual({
      status: 203,
      error: "PUT_ON/PUT_OFF requires artifact_id",
    });

    const putOffBag = await client.objectAction({
      object: "common",
      action: "object",
      form: { code: "PUT_OFF", artifact_id: itemId },
      sq: 3,
    });
    expect(putOffBag["common|action"]).toEqual({
      status: 203,
      error: "Этот предмет нельзя снять",
    });

    const missingItem = await client.objectAction({
      object: "common",
      action: "object",
      form: { code: "PUT_ON", artifact_id: 100_001 },
      sq: 4,
    });
    const error = objectBlock(missingItem["common|action"]);
    expect(error.status).toBe(204);
    expect(String(error.error)).toMatch(/Item 100001 .* is missing/);
    expect(missingItem["user|bag"]).toBeUndefined();
  });
});

function objectBlock(value: AmfValue | undefined): Record<string, AmfValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("expected object block");
  }
  return value;
}

function skillValue(block: AmfValue | undefined, id: string): number {
  const skills = objectBlock(block).skills;
  if (!Array.isArray(skills)) throw new Error("user|skills.skills is missing");
  for (const row of skills) {
    const item = objectBlock(row);
    if (item.id === id) {
      if (typeof item.value !== "number") throw new Error(`skill ${id} value is not a number`);
      return item.value;
    }
  }
  throw new Error(`skill ${id} is missing`);
}

function firstArtifact(block: AmfValue | undefined): Record<string, AmfValue> {
  const artifacts = objectBlock(block).artifacts;
  if (!Array.isArray(artifacts) || artifacts.length < 1) {
    throw new Error("user|view.artifacts is empty");
  }
  return objectBlock(artifacts[0]);
}
