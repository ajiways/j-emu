import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import type { AmfValue } from "../../src/modules/jugger-wire/amf/amf3.ts";
import { AuthenticatedClient } from "../support/harness/authenticated-client.ts";
import { MAP_HUNT_SPAWN_ID } from "../support/harness/map-hunt-spawn.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";
import { bagItemByArtikulId } from "../support/harness/wire-payload.ts";

describe("inventory pocket", () => {
  let harness: ApplicationHarness;
  let application: Application;

  beforeEach(async () => {
    harness = new ApplicationHarness();
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("puts elixir 93 on the belt, leaves leftover in bag, and reconnects", async () => {
    const client = await AuthenticatedClient.login(application);
    const init = await client.objectAction({ object: "common", action: "init", sq: 1 });
    expect(objectBlock(init["user|pocket"])).toMatchObject({
      status: 100,
      capacity: 4,
      pocket: [],
    });
    expect(objectBlock(init["user|bag"])).toMatchObject({ amount: 5, total: 7 });
    const elixirId = requireId(bagItemByArtikulId(init, 93));

    const putOn = await client.objectAction({
      object: "common",
      action: "object",
      form: { code: "PUT_ON", artifact_id: elixirId },
      sq: 2,
    });
    expect(putOn["common|action"]).toEqual({ status: 100 });
    const pocket = pocketItems(putOn["user|pocket"]);
    expect(pocket).toHaveLength(1);
    expect(pocket[0]).toMatchObject({
      artikul_id: 93,
      slot: 67_108_864,
      slot_num: 1,
      cnt: 1,
      actions: 16,
      picture: "bottles_live1_2712.png",
    });
    expect(pocket[0]).not.toHaveProperty("action");
    expect(bagItemByArtikulId(putOn, 93)).toMatchObject({ cnt: 1, action: "bag" });
    expect(objectBlock(putOn["user|bag"])).toMatchObject({ amount: 5, total: 7 });
    expect(putOn["user|view"]).toBeTypeOf("object");
    expect(putOn["user|skills"]).toBeTypeOf("object");
    expect(putOn["user|unitframe"]).toBeTypeOf("object");
    expect(putOn["user|conf"]).toBeTypeOf("object");
    expect(putOn.state).toBeTypeOf("object");

    application = await harness.restart();
    const again = new AuthenticatedClient(application, client.cookie);
    const afterRestart = await again.objectAction({ object: "common", action: "init", sq: 20 });
    expect(pocketItems(afterRestart["user|pocket"])).toMatchObject([
      { artikul_id: 93, slot_num: 1, cnt: 1, slot: 67_108_864 },
    ]);
    expect(bagItemByArtikulId(afterRestart, 93)).toMatchObject({ cnt: 1 });

    const putOff = await again.objectAction({
      object: "common",
      action: "object",
      form: {
        code: "PUT_OFF",
        artifact_id: requireId(pocketItems(afterRestart["user|pocket"])[0]),
      },
      sq: 21,
    });
    expect(putOff["common|action"]).toEqual({ status: 100 });
    expect(pocketItems(putOff["user|pocket"])).toEqual([]);
    expect(bagItemByArtikulId(putOff, 93)).toMatchObject({ cnt: 2, action: "bag" });
  });

  it("moves orb 99, swaps with elixir 93, and denies glove and DROP from pocket", async () => {
    const client = await AuthenticatedClient.login(application);
    const init = await client.objectAction({ object: "common", action: "init", sq: 1 });
    const elixirId = requireId(bagItemByArtikulId(init, 93));
    const orbId = requireId(bagItemByArtikulId(init, 99));
    const gloveId = requireId(bagItemByArtikulId(init, 9095));

    const elixirOn = await client.objectAction({
      object: "common",
      action: "object",
      form: { code: "PUT_ON", artifact_id: elixirId },
      sq: 2,
    });
    const orbOn = await client.objectAction({
      object: "common",
      action: "object",
      form: { code: "PUT_ON", artifact_id: orbId },
      sq: 3,
    });
    expect(pocketItems(orbOn["user|pocket"])).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ artikul_id: 93, slot_num: 1, cnt: 1 }),
        expect.objectContaining({ artikul_id: 99, slot_num: 2, cnt: 10, actions: 16 }),
      ]),
    );
    expect(() => bagItemByArtikulId(orbOn, 99)).toThrow(/99 is missing/);
    expect(bagItemByArtikulId(elixirOn, 93)).toMatchObject({ cnt: 1 });

    const elixirPocketId = requireId(
      pocketItems(orbOn["user|pocket"]).find((item) => item.artikul_id === 93),
    );
    const swapped = await client.objectAction({
      object: "common",
      action: "object",
      form: { code: "PUT_ON", artifact_id: elixirPocketId },
      in: { slot_num: 2 },
      sq: 4,
    });
    expect(pocketItems(swapped["user|pocket"])).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ artikul_id: 99, slot_num: 1, cnt: 10 }),
        expect.objectContaining({ artikul_id: 93, slot_num: 2, cnt: 1 }),
      ]),
    );

    const gloveDenied = await client.objectAction({
      object: "common",
      action: "object",
      form: { code: "PUT_ON", artifact_id: gloveId },
      in: { slot_num: 3 },
      sq: 5,
    });
    expect(gloveDenied["common|action"]).toEqual({
      status: 204,
      error: "Этот предмет нельзя надеть",
    });

    const dropDenied = await client.objectAction({
      object: "common",
      action: "object",
      form: { code: "DROP", artifact_id: elixirPocketId },
      sq: 6,
    });
    expect(dropDenied["common|action"]).toEqual({
      status: 204,
      error: 'Не удалось выполнить действие "Выбросить"!',
    });
  });

  it("denies pocket PUT_ON and PUT_OFF while a hunt fight is active", async () => {
    const client = await AuthenticatedClient.login(application);
    const init = await client.objectAction({ object: "common", action: "init", sq: 1 });
    const elixirId = requireId(bagItemByArtikulId(init, 93));
    const equipped = await client.objectAction({
      object: "common",
      action: "object",
      form: { code: "PUT_ON", artifact_id: elixirId },
      sq: 2,
    });
    expect(equipped["common|action"]).toEqual({ status: 100 });
    const pocketId = requireId(pocketItems(equipped["user|pocket"])[0]);
    const leftoverId = requireId(bagItemByArtikulId(equipped, 93));
    const start = await client.objectAction({
      object: "common",
      action: "object",
      form: { code: "ATTACK_BOT", bot_id: MAP_HUNT_SPAWN_ID },
      sq: 3,
    });
    expect(start["common|action"]).toEqual({ status: 100 });
    const putOn = await client.objectAction({
      object: "common",
      action: "object",
      form: { code: "PUT_ON", artifact_id: leftoverId },
      sq: 4,
    });
    expect(putOn["common|action"]).toEqual({
      status: 203,
      error: "нельзя во время боя",
    });
    expect(putOn["user|pocket"]).toBeUndefined();
    const putOff = await client.objectAction({
      object: "common",
      action: "object",
      form: { code: "PUT_OFF", artifact_id: pocketId },
      sq: 5,
    });
    expect(putOff["common|action"]).toEqual({
      status: 203,
      error: "нельзя во время боя",
    });
    const bag = await client.objectAction({ object: "user", action: "bag", sq: 6 });
    expect(objectBlock(bag["user|bag"])).toMatchObject({ status: 100, amount: 5, total: 7 });
    expect(bagItemByArtikulId(bag, 93)).toMatchObject({ id: leftoverId, cnt: 1 });
  });
});

function objectBlock(value: AmfValue | undefined): Record<string, AmfValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("expected object block");
  }
  return value;
}

function pocketItems(value: AmfValue | undefined): Record<string, AmfValue>[] {
  const pocket = objectBlock(value).pocket;
  if (!Array.isArray(pocket)) throw new Error("user|pocket.pocket is missing");
  return pocket.map((row) => objectBlock(row));
}

function requireId(item: Record<string, AmfValue> | undefined): number {
  if (!item || typeof item.id !== "number") throw new Error("item id is missing");
  return item.id;
}
