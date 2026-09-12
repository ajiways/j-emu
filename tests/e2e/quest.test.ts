import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import type { AmfValue } from "../../src/modules/jugger-wire/amf/amf3.ts";
import { AuthenticatedClient } from "../support/harness/authenticated-client.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";
import {
  finishStartedMeleeHunt,
  putOnStarterGloveIfInBag,
} from "../support/harness/complete-melee-hunt.ts";
import {
  bagItemByArtikulId,
  heroIdFrom,
  huntFightIdFrom,
} from "../support/harness/wire-payload.ts";
import { insertBagArtifacts } from "../support/postgres/insert-bag-artifacts.ts";

describe("quest engine", () => {
  let harness: ApplicationHarness;
  let application: Application;

  beforeEach(async () => {
    harness = new ApplicationHarness(undefined, undefined, { combatBotStrength: 1 });
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("opens NPC 271 from USE 584, buys/equips 23, and keeps progress after restart", async () => {
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
    expect(record(opened["npc|info"], "npc|info").npc).toMatchObject({
      id: 271,
      title: "Голова мертвеца",
    });
    const board = record(opened["npc|quests"], "npc|quests");
    expect(board.status).toBe(100);
    expect(questKeys(board.quests)).toEqual(
      expect.arrayContaining([
        "q_engine_board",
        "q_engine_fight",
        "q_engine_area",
        "q_engine_daily",
        "q_engine_roster",
        "q_engine_ambush",
      ]),
    );

    const unknown = await client.objectAction({
      object: "npc",
      action: "quests",
      ref: 999,
      sq: 4,
    });
    expect(unknown["npc|quests"]).toEqual({ status: 203, error: "Нет такого NPC" });

    await acceptQuest(client, 1, 5);
    await enterShop(client, 7);
    const bought = await client.objectAction({
      object: "store",
      action: "buy",
      form: { basket: { "80": 1 } },
      sq: 8,
    });
    expect(bought["store|buy"]).toEqual({ status: 100 });
    expect(bagItemByArtikulId(bought, 23).artikul_id).toBe(23);
    await application.characterProgression.grantExperience({
      characterId: heroId,
      operationId: `test:${heroId}:quest-glove-l2`,
      amount: 67,
    });
    const gloveId = requireNumber(bagItemByArtikulId(bought, 23).id);
    const equipped = await client.objectAction({
      object: "common",
      action: "action",
      form: { code: "PUT_ON", artifact_id: gloveId },
      sq: 9,
    });
    expect(equipped["common|action"]).toEqual({ status: 100 });
    const back = await client.objectAction({ object: "common", action: "exit", sq: 10 });
    expect(back["common|exit"]).toEqual({ status: 100 });
    await turnIn(client, 1, 11);

    application = await harness.restart();
    const restarted = new AuthenticatedClient(application, client.cookie);
    const restored = await restarted.objectAction({ object: "common", action: "init", sq: 20 });
    expect(bagItemByArtikulId(restored, 584).artikul_id).toBe(584);
    const again = await restarted.objectAction({
      object: "npc",
      action: "quests",
      ref: 271,
      sq: 21,
    });
    const keys = questKeys(record(again["npc|quests"], "restart board").quests);
    expect(keys).toEqual(
      expect.arrayContaining([
        "q_engine_fight",
        "q_engine_area",
        "q_engine_daily",
        "q_engine_roster",
        "q_engine_ambush",
      ]),
    );
    expect(keys).not.toContain("q_engine_board");
  });

  it("starts a quest fight vs Gryzl, grants meat 77, and turns in", async () => {
    const client = await AuthenticatedClient.login(application);
    await client.objectAction({ object: "common", action: "init", sq: 1 });
    const sq = await putOnStarterGloveIfInBag(client, 2);
    const started = await acceptQuest(client, 2, sq);
    const fightId = huntFightIdFrom(started);
    await finishStartedMeleeHunt(client, fightId, (ms) => harness.elapseCombat(ms), sq + 2);
    const after = await client.objectAction({ object: "common", action: "init", sq: 50 });
    expect(record(after.state, "state").ghost).toBeUndefined();
    expect(bagItemByArtikulId(after, 77).cnt).toBeGreaterThanOrEqual(4);
    await turnIn(client, 2, 51);
    const board = await client.objectAction({
      object: "npc",
      action: "quests",
      ref: 271,
      sq: 53,
    });
    expect(questKeys(record(board["npc|quests"], "after fight").quests)).not.toContain(
      "q_engine_fight",
    );
  });

  it("waits on AREA 3/8, starts a quest fight vs Gryzl, then sets engine_area", async () => {
    const client = await AuthenticatedClient.login(application);
    await client.objectAction({ object: "common", action: "init", sq: 1 });
    const sq = await putOnStarterGloveIfInBag(client, 2);
    await acceptQuest(client, 3, sq);
    const init = await client.objectAction({ object: "common", action: "init2", sq: sq + 2 });
    const items = areaItems(init);
    expect(
      items.some((item) => {
        const href = record(record(item, "item").href, "href");
        return href.object === "common" && Number(record(item, "item").id) === 3;
      }),
    ).toBe(true);
    expect(
      items.some((item) => {
        const href = record(record(item, "item").href, "href");
        return href.object === "npc" && href.ref === 2;
      }),
    ).toBe(false);
    const waiting = await client.objectAction({
      object: "common",
      action: "action",
      form: { object_class: "AREA", object_id: 3, action_id: 8 },
      sq: sq + 3,
    });
    expect(waiting["common|action"]).toEqual({ status: 100, action: "8" });
    const wait = record(waiting["common|waiting"], "waiting");
    expect(wait.status).toBe(100);
    expect(wait.title).toBe("Осмотр");
    const early = await client.objectAction({
      object: "common",
      action: "action_finish",
      sq: sq + 4,
    });
    expect(early["common|action_finish"]).toEqual({ status: 203, error: "Ещё рано" });
    await harness.advanceClock(1000);
    const finished = await client.objectAction({
      object: "common",
      action: "action_finish",
      sq: sq + 5,
    });
    expect(record(finished["common|action_finish"], "finish").status).toBe(100);
    const fightId = huntFightIdFrom(finished);
    await finishStartedMeleeHunt(client, fightId, (ms) => harness.elapseCombat(ms), sq + 6);
    const after = await client.objectAction({ object: "common", action: "init", sq: 80 });
    expect(record(after.state, "state").ghost).toBeUndefined();
    await turnIn(client, 3, 81);
  });
});

async function acceptQuest(
  client: AuthenticatedClient,
  pointId: number,
  sq: number,
): Promise<Record<string, AmfValue>> {
  const opened = await client.objectAction({
    object: "npc",
    action: "answer",
    ref: 271,
    form: { point_id: pointId, answer_id: 0 },
    sq,
  });
  expect(record(opened["npc|answer"], "open").status).toBe(100);
  const accepted = await client.objectAction({
    object: "npc",
    action: "answer",
    ref: 271,
    form: { point_id: pointId, answer_id: 1 },
    sq: sq + 1,
  });
  expect(record(accepted["npc|answer"], "accept").status).toBe(100);
  return accepted;
}

async function turnIn(client: AuthenticatedClient, pointId: number, sq: number): Promise<void> {
  const opened = await client.objectAction({
    object: "npc",
    action: "answer",
    ref: 271,
    form: { point_id: pointId, answer_id: 0 },
    sq,
  });
  expect(record(opened["npc|answer"], "turn-in open").status).toBe(100);
  const done = await client.objectAction({
    object: "npc",
    action: "answer",
    ref: 271,
    form: { point_id: pointId, answer_id: 1 },
    sq: sq + 1,
  });
  expect(done["npc|answer"]).toMatchObject({ status: 100 });
}

async function enterShop(client: AuthenticatedClient, sq: number): Promise<void> {
  const shop = await client.objectAction({
    object: "common",
    action: "action",
    form: { code: "COME_IN", area_id: 504 },
    sq,
  });
  expect(shop["common|action"]).toEqual({ status: 100, action: "COME_IN" });
}

function questKeys(value: AmfValue | undefined): string[] {
  if (!Array.isArray(value)) throw new Error("npc|quests.quests must be an array");
  return value.map((row, index) => {
    const quest = record(row, `quest ${index}`);
    if (typeof quest.key !== "string") throw new Error(`quest ${index} key is missing`);
    return quest.key;
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

function areaItems(payload: Record<string, AmfValue>): AmfValue[] {
  const wrapper = record(payload["common|area_conf"], "common|area_conf");
  const nested = record(wrapper["area_conf"], "area_conf");
  const items = nested.items;
  if (!Array.isArray(items)) throw new Error("area_conf.items must be an array");
  return items;
}
