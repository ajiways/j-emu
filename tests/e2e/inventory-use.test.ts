import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import type { AmfValue } from "../../src/modules/jugger-wire/amf/amf3.ts";
import { AuthenticatedClient } from "../support/harness/authenticated-client.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";
import { bagItemByArtikulId, heroIdFrom } from "../support/harness/wire-payload.ts";

describe("inventory USE", () => {
  let harness: ApplicationHarness;
  let application: Application;

  beforeEach(async () => {
    harness = new ApplicationHarness();
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("heals a wounded hero with meat 77, consumes one, and reconnects", async () => {
    const client = await AuthenticatedClient.login(application);
    const init = await client.objectAction({ object: "common", action: "init", sq: 1 });
    const meat = bagItemByArtikulId(init, 77);
    expect(meat).toMatchObject({
      artikul_id: 77,
      cnt: 4,
      actions: 7,
      noweight: 1,
      type_id: "10",
      kind_id: 48,
      picture: "rawmeat_grey.png",
      action: "bag",
    });
    expect(objectBlock(meat.artifact_actions)["20"]).toMatchObject({
      code: "ADD_HP",
      param1: "30",
      param2: "0",
      dispose: "1",
      title: "Съесть мясо",
    });
    expect(bagItemByArtikulId(init, 9095).actions).toBe(11);
    expect(bagItemByArtikulId(init, 9095).artifact_actions).toEqual([]);
    const itemId = requireNumber(meat.id);
    const characterId = heroIdFrom(init);
    await application.characterResources.noteHp({ characterId, hp: 1 });

    const used = await client.objectAction({
      object: "common",
      action: "action",
      form: { object_class: "ARTIFACT", object_id: itemId },
      sq: 2,
    });
    expect(used["common|action"]).toEqual({ status: 100, action: "USE" });
    expect(used["common|action"]).not.toHaveProperty("msg_text");
    expect(bagItemByArtikulId(used, 77)).toMatchObject({ id: itemId, cnt: 3, actions: 7 });
    expect(objectBlock(used["user|unitframe"]).hp).toBe(4);
    expect(objectBlock(used.state).hp).toBe(4);
    expect(used["user|bag"]).toBeTypeOf("object");
    expect(used["user|pocket"]).toBeTypeOf("object");
    expect(used["user|skills"]).toBeTypeOf("object");
    expect(used["user|view"]).toBeUndefined();
    expect(used["user|conf"]).toBeUndefined();

    application = await harness.restart();
    const again = new AuthenticatedClient(application, client.cookie);
    const afterRestart = await again.objectAction({ object: "common", action: "init", sq: 20 });
    expect(bagItemByArtikulId(afterRestart, 77)).toMatchObject({ id: itemId, cnt: 3 });
    expect(objectBlock(afterRestart.state).hp).toBe(4);
  });

  it("consumes meat at full HP without changing HP", async () => {
    const client = await AuthenticatedClient.login(application);
    const init = await client.objectAction({ object: "common", action: "init", sq: 1 });
    const itemId = requireNumber(bagItemByArtikulId(init, 77).id);
    const full = objectBlock(init.state).hp;
    const used = await client.objectAction({
      object: "common",
      action: "object",
      form: { object_class: "ARTIFACT", object_id: itemId },
      sq: 2,
    });
    expect(used["common|action"]).toEqual({ status: 100, action: "USE" });
    expect(bagItemByArtikulId(used, 77)).toMatchObject({ cnt: 3 });
    expect(objectBlock(used.state).hp).toBe(full);
  });

  it("denies USE in a hunt fight and for items without actions", async () => {
    const client = await AuthenticatedClient.login(application);
    const init = await client.objectAction({ object: "common", action: "init", sq: 1 });
    const meatId = requireNumber(bagItemByArtikulId(init, 77).id);
    const gloveId = requireNumber(bagItemByArtikulId(init, 9095).id);
    const elixirId = requireNumber(bagItemByArtikulId(init, 93).id);
    const orbId = requireNumber(bagItemByArtikulId(init, 99).id);

    const start = await client.objectAction({
      object: "common",
      action: "object",
      form: { code: "ATTACK_BOT", bot_id: 2 },
      sq: 2,
    });
    expect(start["common|action"]).toEqual({ status: 100 });
    const inFight = await client.objectAction({
      object: "common",
      action: "action",
      form: { object_class: "ARTIFACT", object_id: meatId },
      sq: 3,
    });
    expect(inFight["common|action"]).toEqual({
      status: 203,
      error: "нельзя во время боя",
    });
    expect(inFight["user|bag"]).toBeUndefined();

    application = await harness.restart();
    const again = new AuthenticatedClient(application, client.cookie);
    const afterFight = await again.objectAction({ object: "common", action: "init", sq: 20 });
    expect(bagItemByArtikulId(afterFight, 77).cnt).toBe(4);

    for (const [itemId, sq] of [
      [gloveId, 21],
      [elixirId, 22],
      [orbId, 23],
    ] as const) {
      const denied = await again.objectAction({
        object: "common",
        action: "action",
        form: { object_class: "ARTIFACT", object_id: itemId },
        sq,
      });
      expect(denied["common|action"]).toEqual({
        status: 203,
        error: "у предмета нет действия использования",
      });
    }
  });

  it("denies USE from the pocket", async () => {
    const client = await AuthenticatedClient.login(application);
    const init = await client.objectAction({ object: "common", action: "init", sq: 1 });
    const elixirId = requireNumber(bagItemByArtikulId(init, 93).id);
    const putOn = await client.objectAction({
      object: "common",
      action: "object",
      form: { code: "PUT_ON", artifact_id: elixirId },
      sq: 2,
    });
    const pocket = objectBlock(putOn["user|pocket"]).pocket;
    if (!Array.isArray(pocket) || !pocket[0]) throw new Error("pocket item is missing");
    const pocketId = requireNumber(objectBlock(pocket[0]).id);
    const denied = await client.objectAction({
      object: "common",
      action: "action",
      form: { object_class: "ARTIFACT", object_id: pocketId },
      sq: 3,
    });
    expect(denied["common|action"]).toEqual({
      status: 203,
      error: "снимите предмет чтобы использовать",
    });
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
