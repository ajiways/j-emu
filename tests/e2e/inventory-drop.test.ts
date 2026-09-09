import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import type { AmfValue } from "../../src/modules/jugger-wire/amf/amf3.ts";
import { AuthenticatedClient } from "../support/harness/authenticated-client.ts";
import { MAP_HUNT_SPAWN_ID } from "../support/harness/map-hunt-spawn.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";
import { bagItemByArtikulId } from "../support/harness/wire-payload.ts";

describe("inventory DROP", () => {
  let harness: ApplicationHarness;
  let application: Application;

  beforeEach(async () => {
    harness = new ApplicationHarness();
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("throws away glove 9095, leaves money unchanged, and reconnects with remaining bag", async () => {
    const client = await AuthenticatedClient.login(application);
    const init = await client.objectAction({ object: "common", action: "init", sq: 1 });
    expect(objectBlock(init["user|bag"])).toMatchObject({
      status: 100,
      amount: 5,
      total: 7,
      amount_max: 20,
    });
    const glove = bagItemByArtikulId(init, 9095);
    expect(glove).toMatchObject({
      artikul_id: 9095,
      flags: 40,
      noweight: 1,
      price: 0,
      sell_price: 0,
      actions: 11,
      durability: 3,
      durability_max: 3,
    });
    const itemId = requireNumber(glove.id);
    expect(objectBlock(init.state).money).toBe("25.00");

    const dropped = await client.objectAction({
      object: "common",
      action: "object",
      form: { code: "DROP", artifact_id: itemId },
      sq: 2,
    });
    expect(dropped["common|action"]).toEqual({ status: 100, action: "DROP" });
    expect(objectBlock(dropped["user|bag"])).toMatchObject({
      status: 100,
      amount: 5,
      total: 6,
    });
    expect(() => bagItemByArtikulId(dropped, 9095)).toThrow(/9095 is missing/);
    expect(dropped["user|skills"]).toBeTypeOf("object");
    expect(dropped["user|mount_list"]).toMatchObject({ status: 100, mounts: [] });
    expect(objectBlock(dropped.state).money).toBe("25.00");
    expect(dropped["user|view"]).toBeUndefined();
    expect(dropped["user|pocket"]).toBeUndefined();
    expect(dropped["user|unitframe"]).toBeUndefined();
    expect(dropped["user|conf"]).toBeUndefined();

    application = await harness.restart();
    const again = new AuthenticatedClient(application, client.cookie);
    const afterRestart = await again.objectAction({ object: "common", action: "init", sq: 20 });
    expect(objectBlock(afterRestart["user|bag"])).toMatchObject({
      amount: 5,
      total: 6,
    });
    expect(() => bagItemByArtikulId(afterRestart, 9095)).toThrow(/9095 is missing/);
    expect(objectBlock(afterRestart.state).money).toBe("25.00");
  });

  it("denies equipped DROP and SELL of unsellable 9095", async () => {
    const client = await AuthenticatedClient.login(application);
    const init = await client.objectAction({ object: "common", action: "init", sq: 1 });
    const itemId = requireNumber(bagItemByArtikulId(init, 9095).id);

    const sell = await client.objectAction({
      object: "common",
      action: "object",
      form: { code: "SELL", artifact_id: itemId },
      sq: 2,
    });
    expect(sell["common|action"]).toEqual({
      status: 204,
      error: 'Не удалось выполнить действие "Продать"!',
    });
    expect(sell["user|bag"]).toBeUndefined();

    const putOn = await client.objectAction({
      object: "common",
      action: "object",
      form: { code: "PUT_ON", artifact_id: itemId },
      sq: 3,
    });
    expect(putOn["common|action"]).toEqual({ status: 100 });

    const equipped = await client.objectAction({
      object: "common",
      action: "object",
      form: { code: "DROP", artifact_id: itemId },
      sq: 4,
    });
    expect(equipped["common|action"]).toEqual({
      status: 204,
      error: 'Не удалось выполнить действие "Выбросить"!',
    });
  });

  it("denies DROP and SELL while a hunt fight is active", async () => {
    const client = await AuthenticatedClient.login(application);
    const init = await client.objectAction({ object: "common", action: "init", sq: 1 });
    const itemId = requireNumber(bagItemByArtikulId(init, 9095).id);
    const start = await client.objectAction({
      object: "common",
      action: "object",
      form: { code: "ATTACK_BOT", bot_id: MAP_HUNT_SPAWN_ID },
      sq: 2,
    });
    expect(start["common|action"]).toEqual({ status: 100 });
    const dropped = await client.objectAction({
      object: "common",
      action: "object",
      form: { code: "DROP", artifact_id: itemId },
      sq: 3,
    });
    expect(dropped["common|action"]).toEqual({
      status: 203,
      error: "нельзя во время боя",
    });
    expect(dropped["user|bag"]).toBeUndefined();
    const sold = await client.objectAction({
      object: "common",
      action: "object",
      form: { code: "SELL", artifact_id: itemId },
      sq: 4,
    });
    expect(sold["common|action"]).toEqual({
      status: 203,
      error: "нельзя во время боя",
    });
    const bag = await client.objectAction({ object: "user", action: "bag", sq: 5 });
    expect(objectBlock(bag["user|bag"])).toMatchObject({
      status: 100,
      amount: 5,
      total: 7,
    });
    expect(bagItemByArtikulId(bag, 9095).id).toBe(itemId);
  });
});

function objectBlock(value: AmfValue | undefined): Record<string, AmfValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("expected object block");
  }
  return value;
}

function requireNumber(value: AmfValue | undefined): number {
  if (typeof value !== "number") throw new Error("expected a number");
  return value;
}
