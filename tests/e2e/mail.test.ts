import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import type { AmfValue } from "../../src/modules/jugger-wire/amf/amf3.ts";
import { WELCOME_LETTER } from "../../src/modules/mail/domain/welcome-letter.ts";
import { AuthenticatedClient } from "../support/harness/authenticated-client.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";
import { uniqueDevelopmentSlot } from "../support/harness/unique-development-slot.ts";

describe("mail inbox and plain send", () => {
  let harness: ApplicationHarness;
  let application: Application;

  beforeEach(async () => {
    harness = new ApplicationHarness();
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("delivers a restart-safe welcome letter and dual-hero send/delete", async () => {
    const slotA = uniqueDevelopmentSlot();
    let slotB = uniqueDevelopmentSlot();
    while (slotB === slotA) slotB = uniqueDevelopmentSlot();
    const [clientA, clientB] = await Promise.all([
      AuthenticatedClient.login(application, slotA),
      AuthenticatedClient.login(application, slotB),
    ]);
    const [initA, initB] = await Promise.all([
      clientA.objectAction({ object: "common", action: "init", sq: 1 }),
      clientB.objectAction({ object: "common", action: "init", sq: 1 }),
    ]);
    expect(stateNewMessage(initA)).toBe(0);
    const nickB = nickFrom(initB);
    await clientB.objectAction({ object: "post", action: "list", sq: 2 });

    const listed = await clientA.objectAction({ object: "post", action: "list", sq: 2 });
    const welcome = requireRecord(listed["post|list"], "post|list");
    expect(welcome.status).toBe(100);
    const welcomeId = singleLetterId(welcome.list);
    const welcomeRow = letterAt(welcome.list, welcomeId);
    expect(welcomeRow.subject).toBe(WELCOME_LETTER.subject);
    expect(welcomeRow.text).toBe(WELCOME_LETTER.text);
    expect(typeof welcomeRow.from_nick).toBe("string");
    expect(String(welcomeRow.from_nick)).toMatch(/^\[\[USER [0-9a-f]{32}\]\]$/);
    expect(welcome.macros_list).not.toEqual([]);
    expect(welcomeRow.artifact_list).toEqual([]);

    const ordered = await clientA.objectAction({ object: "user", action: "bag_order", sq: 3 });
    expect(ordered["user|bag_order"]).toEqual({ status: 100 });
    expect(stateNewMessage(ordered)).toBe(1);
    expect(stateMoney(ordered)).toBe("25.00");

    application = await harness.restart();
    const restartedA = new AuthenticatedClient(application, clientA.cookie);
    const again = await restartedA.objectAction({ object: "post", action: "list", sq: 20 });
    const againList = requireRecord(again["post|list"], "post|list");
    expect(singleLetterId(againList.list)).toBe(welcomeId);

    const sent = await restartedA.objectAction({
      object: "post",
      action: "send",
      form: { nick: nickB, subject: "Hello", text: "Are you there?" },
      sq: 21,
    });
    expect(sent["post|send"]).toEqual({ status: 100 });
    expect(stateMoney(sent)).toBe("24.00");

    const restartedB = new AuthenticatedClient(application, clientB.cookie);
    await restartedB.objectAction({ object: "common", action: "init", sq: 1 });
    const inboxB = await restartedB.objectAction({ object: "post", action: "list", sq: 2 });
    const bList = requireRecord(inboxB["post|list"], "post|list");
    const bIds = letterIds(bList.list);
    expect(bIds.length).toBe(2);
    const playerLetter = Object.values(requireRecord(bList.list, "B list")).find((row) => {
      const letter = requireRecord(row, "B letter");
      return letter.subject === "Hello";
    });
    expect(playerLetter).toBeDefined();
    expect(requireRecord(playerLetter, "player letter").text).toBe("Are you there?");

    const outbox = await restartedA.objectAction({ object: "post", action: "list_sent", sq: 22 });
    const sentList = requireRecord(outbox["post|list_sent"], "post|list_sent");
    const sentId = singleLetterId(sentList.list);
    const sentRow = letterAt(sentList.list, sentId);
    expect(sentRow.subject).toBe("Hello");
    expect(typeof sentRow.to_nick).toBe("string");

    const deleted = await restartedA.objectAction({
      object: "post",
      action: "delete",
      form: { id: sentId },
      sq: 23,
    });
    expect(deleted["post|delete"]).toEqual({ status: 100 });
    const afterDelete = requireRecord(deleted["post|list_sent"], "post|list_sent after delete");
    expect(afterDelete.list).toEqual([]);
  });

  it("returns 203 for clan send, missing nick, attachments, gold, and pick", async () => {
    const client = await AuthenticatedClient.login(application);
    await client.objectAction({ object: "common", action: "init", sq: 1 });
    const clan = await client.objectAction({
      object: "post",
      action: "send",
      form: { nick: "x", send_clan_members: 1 },
      sq: 2,
    });
    expect(clan["post|send"]).toEqual({ status: 203, error: "кланы не поддерживаются" });
    const missing = await client.objectAction({
      object: "post",
      action: "send",
      form: { nick: "NobodyHere" },
      sq: 3,
    });
    expect(missing["post|send"]).toEqual({ status: 203, error: "персонаж не найден" });
    const attached = await client.objectAction({
      object: "post",
      action: "send",
      form: { nick: "x", attachment: { "100001": 1 } },
      sq: 4,
    });
    expect(attached["post|send"]).toEqual({
      status: 203,
      error: "вложения в этом срезе недоступны",
    });
    const gold = await client.objectAction({
      object: "post",
      action: "send",
      form: { nick: "x", money: 5 },
      sq: 5,
    });
    expect(gold["post|send"]).toEqual({
      status: 203,
      error: "вложенное золото в этом срезе недоступно",
    });
    const pick = await client.objectAction({
      object: "post",
      action: "pick",
      form: { id: 1 },
      sq: 6,
    });
    expect(pick["post|pick"]).toEqual({ status: 203, error: "post|pick is not implemented" });
    const read = await client.objectAction({ object: "post", action: "read", sq: 7 });
    expect(read["post|read"]).toEqual({ status: 100 });
  });
});

function nickFrom(payload: Record<string, AmfValue>): string {
  const conf = requireRecord(payload["user|conf"], "user|conf");
  if (typeof conf.nick !== "string" || !conf.nick) throw new Error("user|conf.nick missing");
  return conf.nick;
}

function stateNewMessage(payload: Record<string, AmfValue>): number {
  const state = requireRecord(payload.state, "state");
  if (typeof state.new_message !== "number") throw new Error("state.new_message missing");
  return state.new_message;
}

function stateMoney(payload: Record<string, AmfValue>): string {
  const state = requireRecord(payload.state, "state");
  if (typeof state.money !== "string") throw new Error("state.money missing");
  return state.money;
}

function singleLetterId(list: AmfValue | undefined): number {
  const ids = letterIds(list);
  if (ids.length !== 1) throw new Error(`expected one letter, got ${ids.length}`);
  return ids[0]!;
}

function letterIds(list: AmfValue | undefined): number[] {
  if (list === undefined) throw new Error("list missing");
  if (Array.isArray(list)) {
    if (list.length === 0) return [];
    throw new Error("non-empty list must be an id map");
  }
  const rows = requireRecord(list, "list");
  return Object.keys(rows).map((key) => Number(key));
}

function letterAt(list: AmfValue | undefined, id: number): Record<string, AmfValue> {
  const rows = requireRecord(list, "list");
  return requireRecord(rows[String(id)], `letter ${id}`);
}

function requireRecord(value: AmfValue | undefined, label: string): Record<string, AmfValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
}
