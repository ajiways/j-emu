import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import type { AmfValue } from "../../src/modules/jugger-wire/amf/amf3.ts";
import { AuthenticatedClient } from "../support/harness/authenticated-client.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";
import { MAP_HUNT_SPAWN_ID } from "../support/harness/map-hunt-spawn.ts";
import { bagItemByArtikulId, heroIdFrom } from "../support/harness/wire-payload.ts";
import { insertBagArtifacts } from "../support/postgres/insert-bag-artifacts.ts";
import { insertWeightedBagRows } from "../support/postgres/insert-weighted-bag-rows.ts";

const STORE_POINT = 9;
const MULTI_POINT = 6;
const OVERLOAD_ERROR = "Вы не можете перемещаться, т.к. рюкзак перегружен!";

describe("QST-ENG-05 OPEN_STORE", () => {
  let harness: ApplicationHarness;
  let application: Application;

  beforeEach(async () => {
    harness = new ApplicationHarness();
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("opens 504 from q_engine_store, lists lots 23/24, and reconnects there", async () => {
    const client = await AuthenticatedClient.login(application);
    const init = await client.objectAction({ object: "common", action: "init", sq: 1 });
    const heroId = heroIdFrom(init);
    await insertBagArtifacts(heroId, [{ artifactId: 584, durability: 0, durabilityMax: 0 }]);
    const bag = await client.objectAction({ object: "common", action: "init", sq: 2 });
    const opened = await client.objectAction({
      object: "common",
      action: "action",
      form: { object_class: "ARTIFACT", object_id: requireNumber(bagItemByArtikulId(bag, 584).id) },
      sq: 3,
    });
    expect(opened["common|action"]).toEqual({ status: 100, action: "USE" });
    const keys = questKeys(record(opened["npc|quests"], "board").quests);
    expect(keys).toEqual(expect.arrayContaining(["q_engine_store"]));
    expect(keys).toContain("q_engine_store");

    await answer(client, 271, STORE_POINT, 0, 4);
    const jumped = await answer(client, 271, STORE_POINT, 1, 5);
    expect(jumped["npc|answer"]).toEqual({
      status: 100,
      jump: "area",
      macros_list: [],
    });
    expect(record(jumped.state, "jump state").area_id).toBe("504");
    expect(record(jumped["user|view"], "user|view").status).toBe(100);
    expect(jumped["user|bag"]).toBeTypeOf("object");
    expect(jumped["user|unitframe"]).toBeTypeOf("object");
    expect(jumped["book|quest_list"]).toBeTypeOf("object");
    expect(jumped["book|quest_targets"]).toBeTypeOf("object");
    expect(jumped["book|quest_counters"]).toBeTypeOf("object");
    expect(jumped["store|list"]).toBeUndefined();
    expect(jumped["common|action"]).toBeUndefined();

    const listed = await client.objectAction({ object: "store", action: "list", sq: 6 });
    const block = record(listed["store|list"], "store|list");
    expect(block.status).toBe(100);
    expect(typeIds(block.types)).toEqual(expect.arrayContaining([-131]));
    expect(lotArtikuls(block.artikuls)).toEqual(expect.arrayContaining([23, 24]));

    application = await harness.restart();
    const restarted = new AuthenticatedClient(application, client.cookie);
    const init2 = await restarted.objectAction({ object: "common", action: "init2", sq: 21 });
    expect(record(init2.state, "reconnect").area_id).toBe("504");
  });

  it("keeps area 503 on q_engine_multi JUMP_AREA", async () => {
    const client = await AuthenticatedClient.login(application);
    await client.objectAction({ object: "common", action: "init", sq: 1 });
    await answer(client, 271, MULTI_POINT, 0, 2);
    const accepted = await answer(client, 271, MULTI_POINT, 1, 3);
    expect(accepted["npc|answer"]).toEqual({
      status: 100,
      jump: "area",
      macros_list: [],
    });
    expect(record(accepted.state, "multi jump").area_id).toBe("503");
  });

  it("denies OPEN_STORE with the same ComeIn fight, overload, and missing-link errors", async () => {
    const fighter = await AuthenticatedClient.login(application);
    await fighter.objectAction({ object: "common", action: "init", sq: 1 });
    await answer(fighter, 271, STORE_POINT, 0, 2);
    const start = await fighter.objectAction({
      object: "common",
      action: "object",
      form: { code: "ATTACK_BOT", bot_id: MAP_HUNT_SPAWN_ID },
      sq: 3,
    });
    expect(start["common|action"]).toEqual({ status: 100 });
    const inFight = await answer(fighter, 271, STORE_POINT, 1, 4);
    expect(inFight["npc|answer"]).toEqual({ status: 203, error: "нельзя во время боя" });
    const stillFighting = await fighter.objectAction({ object: "common", action: "init", sq: 5 });
    expect(record(stillFighting.state, "after fight deny").area_id).toBe("503");

    const overloaded = await AuthenticatedClient.login(application);
    const overloadInit = await overloaded.objectAction({ object: "common", action: "init", sq: 1 });
    await insertWeightedBagRows(heroIdFrom(overloadInit), 15);
    await answer(overloaded, 271, STORE_POINT, 0, 2);
    const bagDenied = await answer(overloaded, 271, STORE_POINT, 1, 3);
    expect(bagDenied["npc|answer"]).toEqual({ status: 204, error: OVERLOAD_ERROR });
    const stillOverload = await overloaded.objectAction({
      object: "common",
      action: "init",
      sq: 4,
    });
    expect(record(stillOverload.state, "after overload").area_id).toBe("503");

    const unlinked = await AuthenticatedClient.login(application);
    const unlinkedInit = await unlinked.objectAction({ object: "common", action: "init", sq: 1 });
    await answer(unlinked, 271, STORE_POINT, 0, 2);
    await application.characterLocation.setArea({
      characterId: heroIdFrom(unlinkedInit),
      areaId: "552",
      moveReadyAt: null,
      instanceCopyId: null,
    });
    const missing = await answer(unlinked, 271, STORE_POINT, 1, 3);
    expect(missing["npc|answer"]).toEqual({ status: 203, error: "некуда идти" });
    const stillUnlinked = await unlinked.objectAction({ object: "common", action: "init", sq: 4 });
    expect(record(stillUnlinked.state, "after unlink").area_id).toBe("552");
  });
});

async function answer(
  client: AuthenticatedClient,
  ref: number,
  pointId: number,
  answerId: number,
  sq: number,
): Promise<Record<string, AmfValue>> {
  return client.objectAction({
    object: "npc",
    action: "answer",
    ref,
    form: { point_id: pointId, answer_id: answerId },
    sq,
  });
}

function questKeys(value: AmfValue | undefined): string[] {
  if (!Array.isArray(value)) throw new Error("npc|quests.quests must be an array");
  return value.map((row, index) => {
    const quest = record(row, `quest ${index}`);
    if (typeof quest.key !== "string") throw new Error(`quest ${index} key is missing`);
    return quest.key;
  });
}

function typeIds(value: AmfValue | undefined): number[] {
  if (value === undefined) return [];
  if (Array.isArray(value)) {
    return value.map((entry, index) => {
      const row = record(entry, `store|list.types.${index}`);
      if (typeof row.id !== "number") throw new Error(`type ${index} id is missing`);
      return row.id;
    });
  }
  const types = record(value, "store|list.types");
  return Object.keys(types)
    .sort((left, right) => Number(left) - Number(right))
    .map((key) => {
      const row = record(types[key], `store|list.types.${key}`);
      if (typeof row.id !== "number") throw new Error(`type ${key} id is missing`);
      return row.id;
    });
}

function lotArtikuls(value: AmfValue | undefined): number[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error("store|list.artikuls must be an array");
  return value.map((entry, index) => {
    const lot = record(entry, `store|list.artikuls.${index}`);
    if (typeof lot.id !== "number") throw new Error(`lot ${index} id is missing`);
    return lot.id;
  });
}

function record(value: AmfValue | undefined, label: string): Record<string, AmfValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
}

function requireNumber(value: AmfValue | undefined): number {
  if (typeof value !== "number") throw new Error("expected a number");
  return value;
}
