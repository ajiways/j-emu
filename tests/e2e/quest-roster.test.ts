import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import type { AmfValue } from "../../src/modules/jugger-wire/amf/amf3.ts";
import { AuthenticatedClient } from "../support/harness/authenticated-client.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";
import {
  putOnStarterGloveIfInBag,
  strikeUntilHuntFinish,
} from "../support/harness/complete-melee-hunt.ts";
import { MAP_HUNT_SPAWN_ID } from "../support/harness/map-hunt-spawn.ts";
import {
  fightPersListIds,
  framesIncludeFightFinish,
  huntFightIdFrom,
} from "../support/harness/wire-payload.ts";
import { loadFinishedFightByWireId } from "../support/postgres/finished-fight-rows.ts";

const ROSTER_POINT = 5;
const ROSTER_BOOK = 5;
const FIGHT_POINT = 2;

describe("quest fight roster", () => {
  describe("win", () => {
    let harness: ApplicationHarness;
    let application: Application;

    beforeEach(async () => {
      harness = new ApplicationHarness(undefined, undefined, {
        combatBotStrength: 1,
        // L1 VIT (~15) cannot outlast Gryzl 20 + spirit 29 at default STR/10 melee.
        combatRules: { strPerDamagePoint: 1 },
      });
      application = await harness.start();
    });

    afterEach(async () => {
      await harness.stop();
    });

    it("starts q_engine_roster with flags 8, skips Gryzl kill, and turns in", async () => {
      const client = await AuthenticatedClient.login(application);
      await client.objectAction({ object: "common", action: "init", sq: 1 });
      const sq = await putOnStarterGloveIfInBag(client, 2);
      const board = await openBoard(client, sq);
      expect(questKeys(record(board["npc|quests"], "board").quests)).toEqual(
        expect.arrayContaining(["q_engine_fight", "q_engine_roster"]),
      );

      const fightStarted = await acceptQuest(client, FIGHT_POINT, sq + 1);
      const droppedFightId = huntFightIdFrom(fightStarted);
      expect(await client.fight({ rc: "auth", eid: droppedFightId, sq: sq + 3 })).toHaveLength(0);
      application = await harness.restart();
      const restarted = new AuthenticatedClient(application, client.cookie);
      await restarted.objectAction({ object: "common", action: "init", sq: 20 });

      const started = await acceptQuest(restarted, ROSTER_POINT, 21);
      expect(record(record(started["fight|conf"], "fight|conf").conf, "conf").flags).toBe("8");
      const fightId = huntFightIdFrom(started);
      const chats = chatMessages(await restarted.pollEsrv());
      expect(chats.map((row) => String(row.msg))).toContain("Ритуал ростера начался.");
      expect(await restarted.fight({ rc: "auth", eid: fightId, sq: 23 })).toHaveLength(0);
      const frames = await restarted.pollFight();
      expect(fightPersListIds(frames)).toHaveLength(4);
      await strikeUntilHuntFinish(restarted, (ms) => harness.elapseCombat(ms), 24);
      expect(chatMessages(await restarted.pollEsrv()).map((row) => String(row.msg))).toContain(
        "Ритуал ростера выигран.",
      );
      await turnIn(restarted, ROSTER_POINT, 80);
      const after = await openBoard(restarted, 82);
      const keys = questKeys(record(after["npc|quests"], "after roster").quests);
      expect(keys).toContain("q_engine_fight");
      expect(keys).not.toContain("q_engine_roster");
    });
  });

  describe("loss", () => {
    let harness: ApplicationHarness;
    let application: Application;

    beforeEach(async () => {
      harness = new ApplicationHarness(undefined, undefined, { combatBotStrength: 270 });
      application = await harness.start();
    });

    afterEach(async () => {
      await harness.stop();
    });

    it("keeps book 5 started after a roster loss", async () => {
      const client = await AuthenticatedClient.login(application);
      await client.objectAction({ object: "common", action: "init", sq: 1 });
      const sq = await putOnStarterGloveIfInBag(client, 2);
      const started = await acceptQuest(client, ROSTER_POINT, sq);
      const fightId = huntFightIdFrom(started);
      expect(await client.fight({ rc: "auth", eid: fightId, sq: sq + 2 })).toHaveLength(0);
      await client.pollFight();
      expect(
        await client.fight({ rc: "castSpell", srcType: 1, srcId: 2, sq: sq + 3 }),
      ).toHaveLength(0);
      await client.pollFight();
      await harness.elapseCombat(1400);
      const bot = await client.pollFight();
      expect(framesIncludeFightFinish(bot)).toBe(true);
      expect(chatMessages(await client.pollEsrv()).map((row) => String(row.msg))).toContain(
        "Ритуал ростера проигран.",
      );
      const journal = await client.objectAction({
        object: "book",
        action: "quest_list",
        form: { filter_type: "started" },
        sq: 40,
      });
      expect(journalRow(journal, ROSTER_BOOK)).toMatchObject({ status: "started" });
    });
  });

  describe("restart", () => {
    let harness: ApplicationHarness;
    let application: Application;

    beforeEach(async () => {
      harness = new ApplicationHarness();
      application = await harness.start();
    });

    afterEach(async () => {
      await harness.stop();
    });

    it("drops a mid-roster fight without history", async () => {
      const client = await AuthenticatedClient.login(application);
      await client.objectAction({ object: "common", action: "init", sq: 1 });
      const started = await acceptQuest(client, ROSTER_POINT, 2);
      const fightId = huntFightIdFrom(started);
      expect(await client.fight({ rc: "auth", eid: fightId, sq: 4 })).toHaveLength(0);
      await client.pollFight();
      expect(await loadFinishedFightByWireId(fightId)).toBeNull();

      application = await harness.restart();
      const afterRestart = new AuthenticatedClient(application, client.cookie);
      await afterRestart.objectAction({ object: "common", action: "init", sq: 20 });
      expect(await loadFinishedFightByWireId(fightId)).toBeNull();
      const hunt = await afterRestart.objectAction({
        object: "common",
        action: "object",
        form: { code: "ATTACK_BOT", bot_id: MAP_HUNT_SPAWN_ID },
        sq: 22,
      });
      expect(hunt["common|action"]).toEqual({ status: 100 });
      expect(huntFightIdFrom(hunt)).not.toBe(fightId);
    });
  });
});

async function openBoard(
  client: AuthenticatedClient,
  sq: number,
): Promise<Record<string, AmfValue>> {
  return client.objectAction({ object: "npc", action: "quests", ref: 271, sq });
}

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

function chatMessages(packets: readonly AmfValue[]): Array<Record<string, AmfValue>> {
  const rows: Array<Record<string, AmfValue>> = [];
  for (const packet of packets) {
    if (!packet || typeof packet !== "object" || Array.isArray(packet)) continue;
    if (typeof packet.channel !== "string" || !packet.channel.startsWith("2:")) continue;
    if (!packet.object || typeof packet.object !== "object" || Array.isArray(packet.object)) {
      continue;
    }
    const object = packet.object as Record<string, AmfValue>;
    const block = object["chat|message"];
    if (!block || typeof block !== "object" || Array.isArray(block)) continue;
    const message = (block as Record<string, AmfValue>).message;
    if (!message || typeof message !== "object" || Array.isArray(message)) {
      throw new Error("chat|message.message is missing");
    }
    rows.push(message as Record<string, AmfValue>);
  }
  return rows;
}

function journalRow(payload: Record<string, AmfValue>, bookId: number): Record<string, AmfValue> {
  const quests = record(payload["book|quest_list"], "book|quest_list").quests;
  const rows = record(quests, "quests");
  return record(rows[String(bookId)], `journal ${bookId}`);
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
