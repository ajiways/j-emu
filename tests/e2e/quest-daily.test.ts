import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import type { AmfValue } from "../../src/modules/jugger-wire/amf/amf3.ts";
import {
  DAILY_CYCLE_RULES,
  nextMoscow6am,
} from "../../src/modules/quests/domain/daily-cycle-rules.ts";
import { AuthenticatedClient } from "../support/harness/authenticated-client.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";
import { bagItemByArtikulId, heroIdFrom } from "../support/harness/wire-payload.ts";
import { FakeClock } from "../support/fake-clock.ts";

const START_MS = Date.parse("2026-09-07T12:00:00.000Z");
const NEXT_6AM_MS = Date.parse("2026-09-08T03:00:00.000Z");
const DAILY_POINT = 4;
const DAILY_BOOK = 4;
const BOARD_POINT = 1;

describe("daily quest cycle", () => {
  let harness: ApplicationHarness;
  let application: Application;
  let clock: FakeClock;

  beforeEach(async () => {
    clock = new FakeClock(START_MS);
    harness = new ApplicationHarness(clock);
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("takes and turns in q_engine_daily once per cycle, then again after 06:00 MSK", async () => {
    const client = await AuthenticatedClient.login(application);
    await client.objectAction({ object: "common", action: "init", sq: 1 });
    const opened = await openBoard(client, 2);
    expect(questKeys(record(opened["npc|quests"], "offer").quests)).toContain("q_engine_daily");
    expect(boardRowByKey(opened, "q_engine_daily")).toMatchObject({ flags: 1, point_flags: 8 });

    await acceptQuest(client, DAILY_POINT, 4);
    const started = await bookList(client, 6);
    expect(journalRow(started, DAILY_BOOK)).toMatchObject({
      status: "started",
      multitime: 1,
      ftime: 0,
      cooldown: 0,
    });
    expect(finishedIds(started)).not.toContain(DAILY_BOOK);

    await turnIn(client, DAILY_POINT, 7);
    expect(await expOf(client, 9)).toBe(5);
    const done = await bookList(client, 10);
    const row = journalRow(done, DAILY_BOOK);
    const ftime = clock.unixSeconds();
    expect(row).toMatchObject({ status: "finished", multitime: 1, ftime });
    expect(row.cooldown).toBe(nextMoscow6am(ftime, DAILY_CYCLE_RULES) - ftime);
    expect(row.ftime === 0 && row.cooldown === 86400).toBe(false);
    expect(finishedIds(done)).not.toContain(DAILY_BOOK);

    const afterBoard = await openBoard(client, 11);
    expect(questKeys(record(afterBoard["npc|quests"], "after daily").quests)).not.toContain(
      "q_engine_daily",
    );

    const retry = await client.objectAction({
      object: "npc",
      action: "answer",
      ref: 271,
      form: { point_id: DAILY_POINT, answer_id: 1 },
      sq: 12,
    });
    expect(retry["npc|answer"]).toEqual({ status: 203, error: "Задание уже выполнено" });
    expect(await expOf(client, 13)).toBe(5);

    await harness.advanceClock(NEXT_6AM_MS - START_MS + 1000);
    const wiped = await openBoard(client, 20);
    expect(questKeys(record(wiped["npc|quests"], "next cycle").quests)).toContain("q_engine_daily");
    await acceptQuest(client, DAILY_POINT, 21);
    await turnIn(client, DAILY_POINT, 23);
    expect(await expOf(client, 25)).toBe(9);
  });

  it("hides a finished daily with book|quest_delete", async () => {
    const client = await AuthenticatedClient.login(application);
    await client.objectAction({ object: "common", action: "init", sq: 1 });
    await acceptQuest(client, DAILY_POINT, 2);
    await turnIn(client, DAILY_POINT, 4);
    const hidden = await client.objectAction({
      object: "book",
      action: "quest_delete",
      form: { quest_id: DAILY_BOOK },
      sq: 6,
    });
    expect(hidden["book|quest_delete"]).toEqual({ status: 100 });
    expect(hidden.state).toBeUndefined();
    expect(bookQuests(hidden)[String(DAILY_BOOK)]).toBeUndefined();

    const again = await client.objectAction({
      object: "book",
      action: "quest_delete",
      form: { quest_id: DAILY_BOOK },
      sq: 7,
    });
    expect(again["book|quest_delete"]).toEqual({ status: 100 });

    const zero = await client.objectAction({
      object: "book",
      action: "quest_delete",
      form: { quest_id: 0 },
      sq: 8,
    });
    expect(zero["book|quest_delete"]).toEqual({ status: 203, error: "нет квеста" });

    const missing = await client.objectAction({
      object: "book",
      action: "quest_delete",
      form: { quest_id: 99 },
      sq: 9,
    });
    expect(missing["book|quest_delete"]).toEqual({ status: 203, error: "квест не найден" });
  });

  it("keeps active and done daily across reconnect and harness restart until 06:00", async () => {
    const client = await AuthenticatedClient.login(application);
    await client.objectAction({ object: "common", action: "init", sq: 1 });
    await acceptQuest(client, DAILY_POINT, 2);

    const reconnected = new AuthenticatedClient(application, client.cookie);
    const live = await reconnected.objectAction({ object: "common", action: "init", sq: 10 });
    expect(journalRow(live, DAILY_BOOK)).toMatchObject({ status: "started", multitime: 1 });

    application = await harness.restart();
    const restarted = new AuthenticatedClient(application, client.cookie);
    const active = await restarted.objectAction({ object: "common", action: "init", sq: 11 });
    expect(journalRow(active, DAILY_BOOK)).toMatchObject({ status: "started" });
    expect(boardRowByKey(await openBoard(restarted, 12), "q_engine_daily").point_flags).toBe(0);

    await turnIn(restarted, DAILY_POINT, 13);
    application = await harness.restart();
    const again = new AuthenticatedClient(application, client.cookie);
    const done = await again.objectAction({ object: "common", action: "init", sq: 20 });
    expect(journalRow(done, DAILY_BOOK)).toMatchObject({ status: "finished", multitime: 1 });
    expect(finishedIds(done)).not.toContain(DAILY_BOOK);

    await harness.advanceClock(NEXT_6AM_MS - START_MS + 1000);
    const wiped = await bookList(again, 21);
    expect(bookQuests(wiped)[String(DAILY_BOOK)]).toBeUndefined();
    expect(questKeys(record((await openBoard(again, 22))["npc|quests"], "wipe").quests)).toContain(
      "q_engine_daily",
    );
  });

  it("keeps q_engine_board one-shot after the daily wipe", async () => {
    const client = await AuthenticatedClient.login(application);
    const init = await client.objectAction({ object: "common", action: "init", sq: 1 });
    const heroId = heroIdFrom(init);
    await acceptQuest(client, BOARD_POINT, 2);
    await enterShop(client, 4);
    const bought = await client.objectAction({
      object: "store",
      action: "buy",
      form: { basket: { "80": 1 } },
      sq: 5,
    });
    expect(bought["store|buy"]).toEqual({ status: 100 });
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
      sq: 6,
    });
    expect(equipped["common|action"]).toEqual({ status: 100 });
    await client.objectAction({ object: "common", action: "exit", sq: 7 });
    await turnIn(client, BOARD_POINT, 8);
    expect(await expOf(client, 10)).toBe(73);

    const retry = await client.objectAction({
      object: "npc",
      action: "answer",
      ref: 271,
      form: { point_id: BOARD_POINT, answer_id: 1 },
      sq: 11,
    });
    expect(retry["npc|answer"]).toMatchObject({ status: 203 });
    expect(await expOf(client, 12)).toBe(73);

    await harness.advanceClock(NEXT_6AM_MS - START_MS + 1000);
    const board = await openBoard(client, 20);
    const keys = questKeys(record(board["npc|quests"], "after wipe").quests);
    expect(keys).not.toContain("q_engine_board");
    expect(keys).toContain("q_engine_daily");
    expect(await expOf(client, 21)).toBe(73);
  });
});

async function openBoard(
  client: AuthenticatedClient,
  sq: number,
): Promise<Record<string, AmfValue>> {
  return client.objectAction({ object: "npc", action: "quests", ref: 271, sq });
}

async function bookList(
  client: AuthenticatedClient,
  sq: number,
): Promise<Record<string, AmfValue>> {
  return client.objectAction({
    object: "book",
    action: "quest_list",
    form: { filter_type: "started" },
    sq,
  });
}

async function acceptQuest(
  client: AuthenticatedClient,
  pointId: number,
  sq: number,
): Promise<void> {
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

async function expOf(client: AuthenticatedClient, sq: number): Promise<number> {
  const frame = await client.objectAction({ object: "user", action: "unitframe", sq });
  const exp = record(frame["user|unitframe"], "unitframe").exp;
  if (typeof exp !== "number") throw new Error("user|unitframe.exp is missing");
  return exp;
}

function journalRow(payload: Record<string, AmfValue>, bookId: number): Record<string, AmfValue> {
  const value = bookQuests(payload)[String(bookId)];
  return record(value, `journal ${bookId}`);
}

function bookQuests(payload: Record<string, AmfValue>): Record<string, AmfValue> {
  const quests = record(payload["book|quest_list"], "book|quest_list").quests;
  if (!quests || (Array.isArray(quests) && quests.length === 0)) return {};
  return record(quests, "quests");
}

function finishedIds(payload: Record<string, AmfValue>): number[] {
  const ids = record(payload["book|quest_list"], "book|quest_list").finished_quests_id;
  if (!Array.isArray(ids)) throw new Error("finished_quests_id must be an array");
  return ids.map((id, index) => {
    if (typeof id !== "number") throw new Error(`finished_quests_id[${index}] is not a number`);
    return id;
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

function boardRowByKey(payload: Record<string, AmfValue>, key: string): Record<string, AmfValue> {
  const rows = record(payload["npc|quests"], "npc|quests").quests;
  if (!Array.isArray(rows)) throw new Error("npc|quests.quests must be an array");
  for (const row of rows) {
    const quest = record(row, "board row");
    if (quest.key === key) return quest;
  }
  throw new Error(`board quest ${key} is missing`);
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
