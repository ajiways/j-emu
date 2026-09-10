import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import type { AmfValue } from "../../src/modules/jugger-wire/amf/amf3.ts";
import { AuthenticatedClient } from "../support/harness/authenticated-client.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";
import { uniqueDevelopmentSlot } from "../support/harness/unique-development-slot.ts";
import { bagItemByArtikulId } from "../support/harness/wire-payload.ts";

const SHOP_GLOVE = 23;
const STARTER_GLOVE = 9095;

describe("auction tenders", () => {
  let harness: ApplicationHarness;
  let application: Application;

  beforeEach(async () => {
    harness = new ApplicationHarness();
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("empty auction|tenders is {status,list:[],total,offs}", async () => {
    const client = await AuthenticatedClient.login(application, uniqueDevelopmentSlot());
    await client.objectAction({ object: "common", action: "init", sq: 1 });
    const listed = await client.objectAction({
      object: "auction",
      action: "tenders",
      form: { title: `__none_${Date.now()}__` },
      sq: 2,
    });
    expect(listed["auction|tenders"]).toEqual({ status: 100, list: [], total: 0, offs: 0 });
  });

  it("adds a tender, survives restart, and partial fill leaves remaining amount", async () => {
    const [buyer, seller] = await dualHeroes(application);
    const added = await buyer.objectAction({
      object: "auction",
      action: "tender_add",
      form: { artikul_id: SHOP_GLOVE, amount: 2, buyout: 10 },
      sq: 2,
    });
    expect(added["auction|tender_add"]).toEqual({ status: 100 });

    const mine = await buyer.objectAction({ object: "auction", action: "my_tenders", sq: 3 });
    const order = requireTender(mine["auction|my_tenders"], SHOP_GLOVE);
    expect(order.amount).toBe(2);
    expect(order.buyout).toBe(10);
    expect(order.flags).toBe(1);
    const artifact = requireRecord(order.artifact, "artifact");
    expect(artifact.id).toBe(SHOP_GLOVE);
    expect(artifact.cnt).toBe(1);

    application = await harness.restart();
    const restartedBuyer = new AuthenticatedClient(application, buyer.cookie);
    const restartedSeller = new AuthenticatedClient(application, seller.cookie);
    await restartedBuyer.objectAction({ object: "common", action: "init", sq: 20 });
    const still = await restartedBuyer.objectAction({
      object: "auction",
      action: "my_tenders",
      sq: 21,
    });
    expect(requireTender(still["auction|my_tenders"], SHOP_GLOVE).id).toBe(order.id);

    await buyShopGlove(restartedSeller, 3);
    const part = await restartedSeller.objectAction({
      object: "auction",
      action: "tender_sell",
      form: { lot_id: lotId(order), cnt: 1 },
      sq: 5,
    });
    expect(part["auction|tender_sell"]).toEqual({ status: 100 });
    expect(part["auction|tender_sell"]).not.toHaveProperty("lot_id");
    expect(part["auction|tender_sell"]).not.toHaveProperty("amount");
    const leftover = requireTender(part["auction|tenders"], SHOP_GLOVE);
    expect(leftover.amount).toBe(1);
    expect(leftover.id).toBe(order.id);

    const buyerInbox = await restartedBuyer.objectAction({
      object: "post",
      action: "list",
      sq: 22,
    });
    expect(letterBySubject(buyerInbox, "Аукцион: покупка")).toBeTruthy();
    const sold = await restartedSeller.objectAction({ object: "post", action: "list", sq: 6 });
    expect(letterBySubject(sold, "Заказ: лот выкуплен").money_come).toBe("5.00");
    const cancelRest = await restartedBuyer.objectAction({
      object: "auction",
      action: "tender_cancel",
      form: { lot_id: lotId(order) },
      sq: 23,
    });
    expect(cancelRest["auction|tender_cancel"]).toEqual({ status: 100 });
  });

  it("two tender_sell on the last count: one 100 and one 203", async () => {
    const [buyer, first, second] = await tripleHeroes(application);
    const add = await buyer.objectAction({
      object: "auction",
      action: "tender_add",
      form: { artikul_id: SHOP_GLOVE, amount: 1, buyout: 4 },
      sq: 2,
    });
    expect(add["auction|tender_add"]).toEqual({ status: 100 });
    const order = requireTender(
      (await buyer.objectAction({ object: "auction", action: "my_tenders", sq: 3 }))[
        "auction|my_tenders"
      ],
      SHOP_GLOVE,
    );
    await buyShopGlove(first, 3);
    await buyShopGlove(second, 3);
    const [s1, s2] = await Promise.all([
      first.objectAction({
        object: "auction",
        action: "tender_sell",
        form: { lot_id: lotId(order), cnt: 1 },
        sq: 5,
      }),
      second.objectAction({
        object: "auction",
        action: "tender_sell",
        form: { lot_id: lotId(order), cnt: 1 },
        sq: 5,
      }),
    ]);
    const ok = [s1, s2].filter((row) => {
      const block = row["auction|tender_sell"];
      return isRecord(block) && block.status === 100;
    });
    const bad = [s1, s2].filter((row) => {
      const block = row["auction|tender_sell"];
      return isRecord(block) && block.status === 203;
    });
    expect(ok).toHaveLength(1);
    expect(bad).toHaveLength(1);
    const filled = ok[0];
    if (!filled) throw new Error("winning tender_sell is missing");
    const board = requireRecord(filled["auction|tenders"], "tenders");
    const list = board.list;
    if (!Array.isArray(list)) throw new Error("tenders list must be an array");
    expect(list.some((row) => isRecord(row) && row.id === order.id)).toBe(false);
  });

  it("cancel refreshes own and public lists; available=1 hides then shows", async () => {
    const [owner, seller] = await dualHeroes(application);
    const add = await owner.objectAction({
      object: "auction",
      action: "tender_add",
      form: { artikul_id: SHOP_GLOVE, amount: 2, buyout: 10 },
      sq: 2,
    });
    expect(add["auction|tender_add"]).toEqual({ status: 100 });
    const mine = await owner.objectAction({ object: "auction", action: "my_tenders", sq: 3 });
    const lotIdValue = lotId(requireTender(mine["auction|my_tenders"], SHOP_GLOVE));

    const empty = await seller.objectAction({
      object: "auction",
      action: "tenders",
      form: { available: "1" },
      sq: 2,
    });
    expect(empty["auction|tenders"]).toEqual({ status: 100, list: [], total: 0, offs: 0 });
    await buyShopGlove(seller, 3);
    const shown = await seller.objectAction({
      object: "auction",
      action: "tenders",
      form: { available: "1" },
      sq: 6,
    });
    const shownList = requireRecord(shown["auction|tenders"], "tenders").list;
    if (!Array.isArray(shownList)) throw new Error("tenders list must be an array");
    expect(shownList.some((row) => isRecord(row) && row.id === lotIdValue)).toBe(true);

    const cancel = await owner.objectAction({
      object: "auction",
      action: "tender_cancel",
      form: { lot_id: lotIdValue },
      sq: 4,
    });
    expect(cancel["auction|tender_cancel"]).toEqual({ status: 100 });
    const own = requireRecord(cancel["auction|my_tenders"], "my_tenders");
    const ownList = own.list;
    if (!Array.isArray(ownList)) throw new Error("my_tenders list must be an array");
    expect(ownList.some((row) => isRecord(row) && row.id === lotIdValue)).toBe(false);
    const board = requireRecord(cancel["auction|tenders"], "tenders");
    const boardList = board.list;
    if (!Array.isArray(boardList)) throw new Error("tenders list must be an array");
    expect(boardList.some((row) => isRecord(row) && row.id === lotIdValue)).toBe(false);

    const inbox = await owner.objectAction({ object: "post", action: "list", sq: 5 });
    expect(letterBySubject(inbox, "Аукцион: возврат").money_come).toBe("10.00");
  });

  it("denies NOGIVE catalog tenders and expires remaining gold to mail", async () => {
    const [owner] = await dualHeroes(application);
    const nogive = await owner.objectAction({
      object: "auction",
      action: "tender_add",
      form: { artikul_id: STARTER_GLOVE, amount: 1, buyout: 4 },
      sq: 2,
    });
    expect(nogive["auction|tender_add"]).toEqual({
      status: 203,
      error: "непередаваемый предмет",
    });

    const add = await owner.objectAction({
      object: "auction",
      action: "tender_add",
      form: { artikul_id: SHOP_GLOVE, amount: 1, buyout: 4 },
      sq: 3,
    });
    expect(add["auction|tender_add"]).toEqual({ status: 100 });
    await harness.advanceClock(24 * 3600 * 1000 + 30_000);
    await owner.objectAction({ object: "auction", action: "tenders", sq: 4 });
    const inbox = await owner.objectAction({ object: "post", action: "list", sq: 5 });
    expect(letterBySubject(inbox, "Аукцион: возврат").money_come).toBe("4.00");
  });
});

async function dualHeroes(
  application: Application,
): Promise<readonly [AuthenticatedClient, AuthenticatedClient]> {
  const [a, b] = await tripleHeroes(application);
  return [a, b];
}

async function tripleHeroes(
  application: Application,
): Promise<readonly [AuthenticatedClient, AuthenticatedClient, AuthenticatedClient]> {
  const slotA = uniqueDevelopmentSlot();
  let slotB = uniqueDevelopmentSlot();
  while (slotB === slotA) slotB = uniqueDevelopmentSlot();
  let slotC = uniqueDevelopmentSlot();
  while (slotC === slotA || slotC === slotB) slotC = uniqueDevelopmentSlot();
  const [clientA, clientB, clientC] = await Promise.all([
    AuthenticatedClient.login(application, slotA),
    AuthenticatedClient.login(application, slotB),
    AuthenticatedClient.login(application, slotC),
  ]);
  await Promise.all([
    clientA.objectAction({ object: "common", action: "init", sq: 1 }),
    clientB.objectAction({ object: "common", action: "init", sq: 1 }),
    clientC.objectAction({ object: "common", action: "init", sq: 1 }),
  ]);
  return [clientA, clientB, clientC];
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
  expect(bagItemByArtikulId(bought, SHOP_GLOVE)).toBeTruthy();
  return bought;
}

function requireTender(block: AmfValue | undefined, artikulId: number): Record<string, AmfValue> {
  const listed = requireRecord(block, "auction tenders");
  const list = listed.list;
  if (!Array.isArray(list)) throw new Error("auction list must be an array");
  for (const value of list) {
    const row = requireRecord(value, "tender");
    const artifact = requireRecord(row.artifact, "artifact");
    if (artifact.id === artikulId) return row;
  }
  throw new Error(`tender for artikul ${artikulId} is missing`);
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

function lotId(row: Record<string, AmfValue>): number {
  return requireNumber(row.id);
}

function requireNumber(value: AmfValue | undefined): number {
  if (typeof value !== "number" || !Number.isInteger(value)) throw new Error("id must be integer");
  return value;
}

function isRecord(value: AmfValue | undefined): value is Record<string, AmfValue> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function requireRecord(value: AmfValue | undefined, label: string): Record<string, AmfValue> {
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  return value;
}
