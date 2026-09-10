import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import type { AmfValue } from "../../src/modules/jugger-wire/amf/amf3.ts";
import { TTL_COD_SEC } from "../../src/modules/mail/domain/mail-ttl.ts";
import { AuthenticatedClient } from "../support/harness/authenticated-client.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";
import { uniqueDevelopmentSlot } from "../support/harness/unique-development-slot.ts";
import { bagItemByArtikulId } from "../support/harness/wire-payload.ts";

const SHOP_GLOVE = 23;

describe("mail attachments, COD, and expiry", () => {
  let harness: ApplicationHarness;
  let application: Application;

  beforeEach(async () => {
    harness = new ApplicationHarness();
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("sends a shop glove with gold, pick survives restart, and new item id", async () => {
    const [clientA, clientB, nickB] = await dualHeroes(application);
    const bought = await buyShopGlove(clientA, 3);
    const itemId = requireNumber(bagItemByArtikulId(bought, SHOP_GLOVE).id);
    const sent = await clientA.objectAction({
      object: "post",
      action: "send",
      form: {
        nick: nickB,
        subject: "kit",
        text: "glove",
        money: 1,
        attachment: { [String(itemId)]: 1 },
      },
      sq: 5,
    });
    expect(sent["post|send"]).toEqual({ status: 100 });
    expect(() => bagItemByArtikulId(sent, SHOP_GLOVE)).toThrow(/23 is missing/);

    const inbox = await clientB.objectAction({ object: "post", action: "list", sq: 3 });
    const player = letterBySubject(inbox, "kit");
    const arts = requireRecord(player.artifact_list, "artifact_list");
    expect(arts[String(itemId)]).toMatchObject({ artikul_id: SHOP_GLOVE, cnt: 1 });

    const picked = await clientB.objectAction({
      object: "post",
      action: "pick",
      form: { id: requireNumber(player.id), delete: 1 },
      sq: 4,
    });
    expect(picked["post|pick"]).toEqual({ status: 100 });
    expect(picked["post|delete"]).toEqual({ status: 100 });
    const granted = bagItemByArtikulId(picked, SHOP_GLOVE);
    expect(granted.id).not.toBe(itemId);

    application = await harness.restart();
    const restartedB = new AuthenticatedClient(application, clientB.cookie);
    const again = await restartedB.objectAction({ object: "common", action: "init", sq: 20 });
    expect(bagItemByArtikulId(again, SHOP_GLOVE).id).toBe(granted.id);
  });

  it("batch-picks two gold letters and denies COD in the pack", async () => {
    const [clientA, clientB, nickB] = await dualHeroes(application);
    await clientA.objectAction({
      object: "post",
      action: "send",
      form: { nick: nickB, subject: "g1", text: "one", money: 1 },
      sq: 3,
    });
    await clientA.objectAction({
      object: "post",
      action: "send",
      form: { nick: nickB, subject: "g2", text: "two", money: 1 },
      sq: 4,
    });
    const inbox = await clientB.objectAction({ object: "post", action: "list", sq: 3 });
    const first = requireNumber(letterBySubject(inbox, "g1").id);
    const second = requireNumber(letterBySubject(inbox, "g2").id);
    const picked = await clientB.objectAction({
      object: "post",
      action: "batch_pick",
      form: { ids: [first, second] },
      sq: 4,
    });
    expect(picked["post|batch_pick"]).toEqual({ status: 100 });
    const glove = await buyShopGlove(clientA, 5);
    const itemId = requireNumber(bagItemByArtikulId(glove, SHOP_GLOVE).id);
    await clientA.objectAction({
      object: "post",
      action: "send_cod",
      form: {
        nick: nickB,
        subject: "cod-batch",
        text: "no",
        money: 2,
        attachment: { [String(itemId)]: 1 },
      },
      sq: 7,
    });
    const codInbox = await clientB.objectAction({ object: "post", action: "list", sq: 5 });
    const codId = requireNumber(letterBySubject(codInbox, "cod-batch").id);
    const denied = await clientB.objectAction({
      object: "post",
      action: "batch_pick",
      form: { ids: [codId] },
      sq: 6,
    });
    expect(denied["post|batch_pick"]).toEqual({
      status: 203,
      error: "наложенный платёж нельзя забрать пачкой",
    });
  });

  it("pays COD, retracts, and returns attachments on expiry sweep", async () => {
    const [clientA, clientB, nickB] = await dualHeroes(application);
    const first = await buyShopGlove(clientA, 3);
    const firstId = requireNumber(bagItemByArtikulId(first, SHOP_GLOVE).id);
    const cod = await clientA.objectAction({
      object: "post",
      action: "send_cod",
      form: {
        nick: nickB,
        subject: "cod-pay",
        text: "pay me",
        money: 3,
        attachment: { [String(firstId)]: 1 },
      },
      sq: 5,
    });
    expect(cod["post|send_cod"]).toEqual({ status: 100 });

    const inbox = await clientB.objectAction({ object: "post", action: "list", sq: 3 });
    const letter = letterBySubject(inbox, "cod-pay");
    expect(letter.flags).toBe(1);
    const paid = await clientB.objectAction({
      object: "post",
      action: "pick",
      form: { id: requireNumber(letter.id), delete: 1 },
      sq: 4,
    });
    expect(paid["post|pick"]).toEqual({ status: 100 });
    expect(bagItemByArtikulId(paid, SHOP_GLOVE).artikul_id).toBe(SHOP_GLOVE);

    const payInbox = await clientA.objectAction({ object: "post", action: "list", sq: 6 });
    const payLetter = letterBySubject(payInbox, "Оплата наложенного платежа");
    const collected = await clientA.objectAction({
      object: "post",
      action: "pick",
      form: { id: requireNumber(payLetter.id), delete: 1 },
      sq: 7,
    });
    expect(collected["post|pick"]).toEqual({ status: 100 });

    const second = await buyShopGlove(clientA, 8, false);
    const secondId = requireNumber(bagItemByArtikulId(second, SHOP_GLOVE).id);
    await clientA.objectAction({
      object: "post",
      action: "send_cod",
      form: {
        nick: nickB,
        subject: "cod-retract",
        text: "back",
        money: 2,
        attachment: { [String(secondId)]: 1 },
      },
      sq: 10,
    });
    const retractInbox = await clientB.objectAction({ object: "post", action: "list", sq: 5 });
    const retractLetter = letterBySubject(retractInbox, "cod-retract");
    const retracted = await clientB.objectAction({
      object: "post",
      action: "retract",
      form: { id: requireNumber(retractLetter.id) },
      sq: 6,
    });
    expect(retracted["post|retract"]).toEqual({ status: 100 });
    const returned = await clientA.objectAction({ object: "post", action: "list", sq: 11 });
    const returnLetter = letterBySubject(returned, "Возврат наложенного платежа");
    expect(returnLetter.flags).toBe(4);
    const tookBack = await clientA.objectAction({
      object: "post",
      action: "pick",
      form: { id: requireNumber(returnLetter.id), delete: 1 },
      sq: 12,
    });
    expect(tookBack["post|pick"]).toEqual({ status: 100 });
    const expireId = requireNumber(bagItemByArtikulId(tookBack, SHOP_GLOVE).id);
    await clientA.objectAction({
      object: "post",
      action: "send_cod",
      form: {
        nick: nickB,
        subject: "cod-expire",
        text: "wait",
        money: 2,
        attachment: { [String(expireId)]: 1 },
      },
      sq: 14,
    });
    await harness.elapseCombat(TTL_COD_SEC * 1000);
    const afterSweep = await clientA.objectAction({ object: "post", action: "list", sq: 15 });
    const expiredReturn = letterBySubject(afterSweep, "Возврат наложенного платежа");
    expect(expiredReturn.flags).toBe(4);
  });
});

async function dualHeroes(
  application: Application,
): Promise<readonly [AuthenticatedClient, AuthenticatedClient, string]> {
  const slotA = uniqueDevelopmentSlot();
  let slotB = uniqueDevelopmentSlot();
  while (slotB === slotA) slotB = uniqueDevelopmentSlot();
  const [clientA, clientB] = await Promise.all([
    AuthenticatedClient.login(application, slotA),
    AuthenticatedClient.login(application, slotB),
  ]);
  const initB = await clientB.objectAction({ object: "common", action: "init", sq: 1 });
  await clientA.objectAction({ object: "common", action: "init", sq: 1 });
  return [clientA, clientB, nickFrom(initB)];
}

async function buyShopGlove(
  client: AuthenticatedClient,
  sq: number,
  enter = true,
): Promise<Record<string, AmfValue>> {
  if (enter) {
    const shop = await client.objectAction({
      object: "common",
      action: "action",
      form: { code: "COME_IN", area_id: 504 },
      sq,
    });
    expect(shop["common|action"]).toEqual({ status: 100, action: "COME_IN" });
  }
  const bought = await client.objectAction({
    object: "store",
    action: "buy",
    form: { basket: { "80": 1 } },
    sq: enter ? sq + 1 : sq,
  });
  expect(bought["store|buy"]).toEqual({ status: 100 });
  return bought;
}

function nickFrom(payload: Record<string, AmfValue>): string {
  const conf = requireRecord(payload["user|conf"], "user|conf");
  if (typeof conf.nick !== "string" || !conf.nick) throw new Error("user|conf.nick missing");
  return conf.nick;
}

function letterBySubject(
  payload: Record<string, AmfValue>,
  subject: string,
): Record<string, AmfValue> {
  const block = requireRecord(payload["post|list"], "post|list");
  const list = requireRecord(block.list, "list");
  for (const value of Object.values(list)) {
    const row = requireRecord(value, "letter");
    if (row.subject === subject) return row;
  }
  throw new Error(`letter subject ${subject} is missing`);
}

function requireNumber(value: AmfValue | undefined): number {
  if (typeof value !== "number" || !Number.isInteger(value)) throw new Error("id must be integer");
  return value;
}

function requireRecord(value: AmfValue | undefined, label: string): Record<string, AmfValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
}
