import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import type { AmfValue } from "../../src/modules/jugger-wire/amf/amf3.ts";
import { AuthenticatedClient } from "../support/harness/authenticated-client.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";
import { bagItemIdFrom, firstBagItemFrom } from "../support/harness/wire-payload.ts";

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

  it("throws away glove 9095, leaves money unchanged, and reconnects empty", async () => {
    const client = await AuthenticatedClient.login(application);
    const init = await client.objectAction({ object: "common", action: "init", sq: 1 });
    expect(objectBlock(init["user|bag"])).toMatchObject({
      status: 100,
      amount: 0,
      total: 1,
      amount_max: 20,
    });
    const glove = firstBagItemFrom(init);
    expect(glove).toMatchObject({
      artikul_id: 9095,
      flags: 40,
      noweight: 1,
      price: 0,
      sell_price: 0,
      actions: 11,
    });
    const itemId = bagItemIdFrom(init);
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
      amount: 0,
      total: 0,
      bag: {},
    });
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
      amount: 0,
      total: 0,
      bag: {},
    });
    expect(objectBlock(afterRestart.state).money).toBe("25.00");
  });

  it("denies equipped DROP and SELL of unsellable 9095", async () => {
    const client = await AuthenticatedClient.login(application);
    const init = await client.objectAction({ object: "common", action: "init", sq: 1 });
    const itemId = bagItemIdFrom(init);

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

  it("allows DROP while a hunt fight is active", async () => {
    const client = await AuthenticatedClient.login(application);
    const init = await client.objectAction({ object: "common", action: "init", sq: 1 });
    const itemId = bagItemIdFrom(init);
    const start = await client.objectAction({
      object: "common",
      action: "object",
      form: { code: "ATTACK_BOT", bot_id: 2 },
      sq: 2,
    });
    expect(start["common|action"]).toEqual({ status: 100 });
    const dropped = await client.objectAction({
      object: "common",
      action: "object",
      form: { code: "DROP", artifact_id: itemId },
      sq: 3,
    });
    expect(dropped["common|action"]).toEqual({ status: 100, action: "DROP" });
    expect(objectBlock(dropped["user|bag"])).toMatchObject({ amount: 0, total: 0, bag: {} });
    expect(objectBlock(dropped.state).money).toBe("25.00");
  });
});

function objectBlock(value: AmfValue | undefined): Record<string, AmfValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("expected object block");
  }
  return value;
}
