import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import type { AmfValue } from "../../src/modules/jugger-wire/amf/amf3.ts";
import { AuthenticatedClient } from "../support/harness/authenticated-client.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";
import { FakeClock } from "../support/fake-clock.ts";
import { ManualCombatDelay } from "../support/fakes/manual-combat-delay.ts";
import {
  finishStartedMeleeHunt,
  putOnStarterGloveIfInBag,
} from "../support/harness/complete-melee-hunt.ts";
import { MAP_HUNT_SPAWN_ID } from "../support/harness/map-hunt-spawn.ts";
import { uniqueDevelopmentSlot } from "../support/harness/unique-development-slot.ts";
import {
  bagItemByArtikulId,
  heroIdFrom,
  huntFightConfFrom,
  huntFightIdFrom,
} from "../support/harness/wire-payload.ts";
import { dungeonHuntId } from "../../src/modules/instance/domain/dungeon-hunt-id.ts";

const START_MS = 1_700_000_000_000;
const LEVEL3_EXP = 202;
const FIGHT_LEAVE_DENIED = { rs: false, err: "нельзя выйти из боя", sq: 9 };

describe("QST-ENG-04 leftovers", () => {
  let harness: ApplicationHarness;
  let application: Application;

  beforeEach(async () => {
    harness = new ApplicationHarness(undefined, undefined, { combatBotStrength: 1 });
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("denies leaveFight in q_engine_fight and keeps the fight", async () => {
    const client = await AuthenticatedClient.login(application);
    await client.objectAction({ object: "common", action: "init", sq: 1 });
    const sq = await putOnStarterGloveIfInBag(client, 2);
    const started = await acceptQuest(client, 2, sq);
    const conf = huntFightConfFrom(started);
    expect(fightConf(started).can_leave).toBe(0);
    expect(fightConf(started).flags).toBe("8");
    expect(await client.fight({ rc: "auth", eid: conf.fightId, sq: sq + 2 })).toHaveLength(0);
    await client.pollFight();
    expect(await client.fight({ rc: "leaveFight", sq: 9 })).toEqual([
      { rs: false, err: "нельзя выйти из боя", sq: 9 },
    ]);
    const still = await client.objectAction({ object: "common", action: "init2", sq: 10 });
    expect(huntFightIdFrom(still)).toBe(conf.fightId);
  });

  it("denies quest fight JOIN with the current quest text", async () => {
    const hunter = await AuthenticatedClient.login(application);
    const joiner = await AuthenticatedClient.login(application, uniqueDevelopmentSlot());
    await hunter.objectAction({ object: "common", action: "init", sq: 1 });
    await joiner.objectAction({ object: "common", action: "init", sq: 1 });
    const sq = await putOnStarterGloveIfInBag(hunter, 2);
    const started = await acceptQuest(hunter, 2, sq);
    const fightId = huntFightIdFrom(started);
    const denied = await joiner.objectAction({
      object: "common",
      action: "object",
      form: { code: "FIGHT_JOIN", fight: fightId, team: 2 },
      sq: 2,
    });
    expect(denied["common|action"]).toEqual({
      status: 204,
      error: "нельзя вмешаться в квестовый бой",
    });
  });

  it("starts an AREA ambush hunt, bumps the click, and leaves as outdoor hunt", async () => {
    const client = await AuthenticatedClient.login(application);
    await client.objectAction({ object: "common", action: "init", sq: 1 });
    const sq = await putOnStarterGloveIfInBag(client, 2);
    await acceptQuest(client, 8, sq);
    const waiting = await client.objectAction({
      object: "common",
      action: "action",
      form: { object_class: "AREA", object_id: 1, action_id: 9 },
      sq: sq + 2,
    });
    expect(waiting["common|action"]).toEqual({ status: 100, action: "9" });
    await harness.advanceClock(1000);
    const finished = await client.objectAction({
      object: "common",
      action: "action_finish",
      sq: sq + 3,
    });
    expect(record(finished["common|action_finish"], "finish").status).toBe(100);
    const conf = fightConf(finished);
    expect(conf.flags).not.toBe("8");
    expect(conf.can_leave).toBe(1);
    const fightId = huntFightIdFrom(finished);
    const book = await client.objectAction({
      object: "book",
      action: "quest_list",
      form: { filter_type: "started" },
      sq: sq + 4,
    });
    expect(counter(book, 7)).toBeUndefined();
    expect(await client.fight({ rc: "auth", eid: fightId, sq: sq + 5 })).toHaveLength(0);
    await client.pollFight();
    expect(await client.fight({ rc: "leaveFight", sq: sq + 6 })).toEqual([
      { rs: true, sq: sq + 6 },
    ]);
  });

  it("rolls loot_meat back when DROP empties 77", async () => {
    const client = await AuthenticatedClient.login(application);
    await client.objectAction({ object: "common", action: "init", sq: 1 });
    const sq = await putOnStarterGloveIfInBag(client, 2);
    const started = await acceptQuest(client, 2, sq);
    const fightId = huntFightIdFrom(started);
    await finishStartedMeleeHunt(client, fightId, (ms) => harness.elapseCombat(ms), sq + 2);
    const afterFight = await client.objectAction({ object: "common", action: "init", sq: 40 });
    const meat = bagItemByArtikulId(afterFight, 77);
    const dropped = await client.objectAction({
      object: "common",
      action: "action",
      form: { code: "DROP", artifact_id: requireNumber(meat.id) },
      sq: 41,
    });
    expect(dropped["common|action"]).toEqual({ status: 100, action: "DROP" });
    const book = await client.objectAction({
      object: "book",
      action: "quest_list",
      form: { filter_type: "started" },
      sq: 42,
    });
    expect(counter(book, 2)).toMatchObject({ value: 0, limit: 1, title: "Получить мясо" });
  });
});

describe("QST-ENG-04 copy leave and chance miss", () => {
  it("denies leaveFight in dungeon copy 542", async () => {
    const clock = new FakeClock(START_MS);
    const harness = new ApplicationHarness(clock, new ManualCombatDelay(), {
      combatBotStrength: 1,
      combatRules: { strPerDamagePoint: 1 },
    });
    const application = await harness.start();
    try {
      const client = await AuthenticatedClient.login(application, uniqueDevelopmentSlot());
      const init = await client.objectAction({ object: "common", action: "init", sq: 1 });
      const granted = await application.characterProgression.grantExperience({
        characterId: heroIdFrom(init),
        operationId: `qst04:${heroIdFrom(init)}:l3`,
        amount: LEVEL3_EXP,
      });
      if (granted.levelAfter !== 3) throw new Error("level 3 is required for 542");
      await client.objectAction({
        object: "common",
        action: "action",
        form: { code: "COME_IN", area_id: 501 },
        sq: 2,
      });
      clock.advanceSeconds(15);
      const entered = await client.objectAction({
        object: "common",
        action: "action",
        form: { code: "COME_IN", area_id: 542 },
        sq: 4,
      });
      const copyId = copyIdFrom(entered);
      const start = await client.objectAction({
        object: "common",
        action: "object",
        form: { code: "ATTACK_BOT", bot_id: dungeonHuntId(copyId, "ogre") },
        sq: 5,
      });
      const fightId = dungeonFightIdFrom(start);
      expect(await client.fight({ rc: "auth", eid: fightId, sq: 6 })).toHaveLength(0);
      await client.pollFight();
      expect(await client.fight({ rc: "leaveFight", sq: 9 })).toEqual([FIGHT_LEAVE_DENIED]);
      const still = await client.objectAction({ object: "common", action: "init2", sq: 10 });
      expect(dungeonFightIdFrom(still)).toBe(fightId);
    } finally {
      await harness.stop();
    }
  });

  it("skips fight|conf when ambush chance misses", async () => {
    const harness = new ApplicationHarness(undefined, undefined, {
      combatBotStrength: 1,
      ambushRandom: { unit: () => 1, integer: () => 0 },
    });
    const application = await harness.start();
    try {
      const client = await AuthenticatedClient.login(application);
      await client.objectAction({ object: "common", action: "init", sq: 1 });
      const sq = await putOnStarterGloveIfInBag(client, 2);
      await acceptQuest(client, 8, sq);
      await client.objectAction({
        object: "common",
        action: "action",
        form: { object_class: "AREA", object_id: 1, action_id: 9 },
        sq: sq + 2,
      });
      await harness.advanceClock(1000);
      const finished = await client.objectAction({
        object: "common",
        action: "action_finish",
        sq: sq + 3,
      });
      expect(record(finished["common|action_finish"], "finish").status).toBe(100);
      expect(finished["fight|conf"]).toBeUndefined();
    } finally {
      await harness.stop();
    }
  });

  it("acks hunt 50310 leaveFight as flee", async () => {
    const harness = new ApplicationHarness(undefined, undefined, { combatBotStrength: 1 });
    const application = await harness.start();
    try {
      const client = await AuthenticatedClient.login(application);
      await client.objectAction({ object: "common", action: "init", sq: 1 });
      const sq = await putOnStarterGloveIfInBag(client, 2);
      const start = await client.objectAction({
        object: "common",
        action: "object",
        form: { code: "ATTACK_BOT", bot_id: MAP_HUNT_SPAWN_ID },
        sq,
      });
      const fightId = huntFightIdFrom(start);
      expect(await client.fight({ rc: "auth", eid: fightId, sq: sq + 1 })).toHaveLength(0);
      await client.pollFight();
      expect(await client.fight({ rc: "leaveFight", sq: 9 })).toEqual([{ rs: true, sq: 9 }]);
    } finally {
      await harness.stop();
    }
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

function fightConf(payload: Record<string, AmfValue>): Record<string, AmfValue> {
  return record(record(payload["fight|conf"], "fight|conf").conf, "conf");
}

function counter(
  payload: Record<string, AmfValue>,
  bookId: number,
): Record<string, AmfValue> | undefined {
  const block = record(payload["book|quest_counters"], "book|quest_counters");
  if (!Array.isArray(block.counter_list)) throw new Error("counter_list is missing");
  for (const row of block.counter_list) {
    const item = record(row, "counter");
    if (item.quest_id === bookId) return item;
  }
  return undefined;
}

function copyIdFrom(payload: Record<string, AmfValue>): number {
  const pop = record(payload["chat|area_population"], "pop").population;
  if (!Array.isArray(pop) || !pop[0]) throw new Error("area population is missing");
  const id = record(pop[0], "occupant").instance_id;
  if (typeof id !== "number" || id < 1) throw new Error("instance copy id is missing");
  return id;
}

function dungeonFightIdFrom(payload: Record<string, AmfValue>): string {
  const fightId = fightConf(payload).fightId;
  if (typeof fightId !== "string" || !/^[1-9][0-9]*$/.test(fightId)) {
    throw new Error("dungeon fightId is missing");
  }
  return fightId;
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
