import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import type { AmfValue } from "../../src/modules/jugger-wire/amf/amf3.ts";
import { AuthenticatedClient } from "../support/harness/authenticated-client.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";
import { finishStartedMeleeHunt } from "../support/harness/complete-melee-hunt.ts";
import {
  bagItemByArtikulId,
  heroIdFrom,
  huntFightIdFrom,
} from "../support/harness/wire-payload.ts";

const MULTI_POINT = 6;
const MULTI_SECONDARY = 7;
const MULTI_BOOK = 6;

describe("quest multi-board", () => {
  let harness: ApplicationHarness;
  let application: Application;

  beforeEach(async () => {
    harness = new ApplicationHarness(undefined, undefined, { combatBotStrength: 1 });
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("hides 272, jumps without moving, grants rep, and removes worn 23", async () => {
    const client = await AuthenticatedClient.login(application);
    await client.objectAction({ object: "common", action: "init", sq: 1 });

    const before272 = await client.objectAction({
      object: "npc",
      action: "quests",
      ref: 272,
      sq: 2,
    });
    expect(questKeys(record(before272["npc|quests"], "272 before").quests)).toEqual([]);

    const board271 = await client.objectAction({
      object: "npc",
      action: "quests",
      ref: 271,
      sq: 3,
    });
    const offer = questRow(record(board271["npc|quests"], "271 offer").quests, "q_engine_multi");
    expect(offer).toMatchObject({ flags: 32, point_flags: 8, point_id: 6, award_rep: "" });

    const opened = await answer(client, 271, MULTI_POINT, 0, 4);
    expect(record(opened["npc|answer"], "open").status).toBe(100);
    const accepted = await answer(client, 271, MULTI_POINT, 1, 5);
    expect(accepted["npc|answer"]).toEqual({
      status: 100,
      jump: "area",
      macros_list: [],
    });
    expect(record(accepted.state, "accept state").area_id).toBe("503");
    const granted = await client.objectAction({ object: "user", action: "bag", sq: 6 });
    expect(bagItemByArtikulId(granted, 23).artikul_id).toBe(23);

    const mid271 = await client.objectAction({
      object: "npc",
      action: "quests",
      ref: 271,
      sq: 7,
    });
    expect(
      questRow(record(mid271["npc|quests"], "271 mid").quests, "q_engine_multi"),
    ).toMatchObject({
      flags: 32,
      point_flags: 0,
      award_rep: "",
    });

    const visible272 = await client.objectAction({
      object: "npc",
      action: "quests",
      ref: 272,
      sq: 8,
    });
    expect(questKeys(record(visible272["npc|quests"], "272 talk").quests)).toEqual([
      "q_engine_multi",
    ]);

    await answer(client, 271, MULTI_POINT, 0, 9);
    await answer(client, 271, MULTI_POINT, 1, 10);
    const stillTalk = await client.objectAction({
      object: "book",
      action: "quest_list",
      form: { filter_type: "started" },
      sq: 11,
    });
    expect(counter(stillTalk, MULTI_BOOK)).toMatchObject({ value: 0, limit: 1 });

    await answer(client, 272, MULTI_SECONDARY, 0, 12);
    await answer(client, 272, MULTI_SECONDARY, 1, 13);
    const talked = await client.objectAction({
      object: "book",
      action: "quest_list",
      form: { filter_type: "started" },
      sq: 14,
    });
    expect(counter(talked, MULTI_BOOK).title).toBe("Победить Грызля");

    const hidden272 = await client.objectAction({
      object: "npc",
      action: "quests",
      ref: 272,
      sq: 15,
    });
    expect(questKeys(record(hidden272["npc|quests"], "272 after talk").quests)).toEqual([]);

    const heroId = heroIdFrom(
      await client.objectAction({ object: "common", action: "init", sq: 16 }),
    );
    await application.characterProgression.grantExperience({
      characterId: heroId,
      operationId: `test:${heroId}:multi-glove-l2`,
      amount: 67,
    });
    const gloveId = requireNumber(
      bagItemByArtikulId(
        await client.objectAction({
          object: "user",
          action: "bag",
          sq: 17,
        }),
        23,
      ).id,
    );
    await client.objectAction({
      object: "common",
      action: "object",
      form: { code: "PUT_ON", artifact_id: gloveId },
      sq: 18,
    });

    application = await harness.restart();
    const restarted = new AuthenticatedClient(application, client.cookie);
    const restored = await restarted.objectAction({ object: "common", action: "init", sq: 20 });
    expect(record(restored.state, "restart state").area_id).toBe("503");
    const worn = await restarted.objectAction({ object: "user", action: "view", sq: 21 });
    expect(viewHasArtikul(worn["user|view"], 23)).toBe(true);
    const replay = await answer(restarted, 271, MULTI_POINT, 0, 22);
    expect(record(replay["npc|answer"], "no jump replay").jump).toBeUndefined();

    const started = await answer(restarted, 271, MULTI_POINT, 1, 23);
    const fightId = huntFightIdFrom(started);
    await finishStartedMeleeHunt(restarted, fightId, (ms) => harness.elapseCombat(ms), 24);
    const finished = await restarted.objectAction({
      object: "fight",
      action: "finish",
      sq: 70,
    });
    expect(finished["fight|finish"]).toEqual({ status: 100 });
    expect(finished["common|area_conf"]).toBeUndefined();
    expect(viewHasArtikul(finished["user|view"], 23)).toBe(false);

    await turnIn(restarted, MULTI_POINT, 71);
    const stats = await restarted.objectAction({ object: "user", action: "stats", sq: 73 });
    const radvey = stat(record(stats["user|stats"], "stats").stats, "5");
    expect(radvey).toMatchObject({ value: 10, object_id: "5" });

    application = await harness.restart();
    const again = new AuthenticatedClient(application, client.cookie);
    const persisted = await again.objectAction({ object: "user", action: "stats", sq: 80 });
    expect(stat(record(persisted["user|stats"], "restart stats").stats, "5").value).toBe(10);
    const paperdoll = await again.objectAction({ object: "user", action: "view", sq: 81 });
    expect(viewHasArtikul(paperdoll["user|view"], 23)).toBe(false);
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

async function turnIn(client: AuthenticatedClient, pointId: number, sq: number): Promise<void> {
  await answer(client, 271, pointId, 0, sq);
  const done = await answer(client, 271, pointId, 1, sq + 1);
  expect(done["npc|answer"]).toMatchObject({ status: 100 });
}

function questKeys(value: AmfValue | undefined): string[] {
  if (!Array.isArray(value)) throw new Error("npc|quests.quests must be an array");
  return value.map((row, index) => {
    const quest = record(row, `quest ${index}`);
    if (typeof quest.key !== "string") throw new Error(`quest ${index} key is missing`);
    return quest.key;
  });
}

function questRow(value: AmfValue | undefined, key: string): Record<string, AmfValue> {
  if (!Array.isArray(value)) throw new Error("npc|quests.quests must be an array");
  for (const row of value) {
    const quest = record(row, key);
    if (quest.key === key) return quest;
  }
  throw new Error(`quest ${key} is missing`);
}

function counter(payload: Record<string, AmfValue>, bookId: number): Record<string, AmfValue> {
  const block = record(payload["book|quest_counters"], "book|quest_counters");
  if (!Array.isArray(block.counter_list)) throw new Error("counter_list is missing");
  for (const row of block.counter_list) {
    const item = record(row, "counter");
    if (item.quest_id === bookId) return item;
  }
  throw new Error(`counter ${bookId} is missing`);
}

function viewHasArtikul(value: AmfValue | undefined, artikulId: number): boolean {
  const artifacts = record(value, "user|view").artifacts;
  if (!Array.isArray(artifacts)) throw new Error("user|view.artifacts is missing");
  return artifacts.some((row) => record(row, "artifact").artikul_id === artikulId);
}

function stat(value: AmfValue | undefined, objectId: string): Record<string, AmfValue> {
  if (!Array.isArray(value)) throw new Error("user|stats.stats must be an array");
  const row = value
    .map((entry, index) => record(entry, `stat ${index}`))
    .find((entry) => entry.object_id === objectId);
  if (!row) throw new Error(`stat ${objectId} is missing`);
  return row;
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
