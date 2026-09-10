import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import type { AmfValue } from "../../src/modules/jugger-wire/amf/amf3.ts";
import { AuthenticatedClient } from "../support/harness/authenticated-client.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";
import { uniqueDevelopmentSlot } from "../support/harness/unique-development-slot.ts";
import { bagItemByArtikulId } from "../support/harness/wire-payload.ts";

const SHOP_GLOVE = 23;
const STARTER_GLOVE = 9095;

describe("auction listings and bids", () => {
  let harness: ApplicationHarness;
  let application: Application;

  beforeEach(async () => {
    harness = new ApplicationHarness();
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("empty auction|lot is {status,list:[],total,offs}", async () => {
    const client = await AuthenticatedClient.login(application, uniqueDevelopmentSlot());
    await client.objectAction({ object: "common", action: "init", sq: 1 });
    const listed = await client.objectAction({
      object: "auction",
      action: "lot",
      form: { title: `__none_${Date.now()}__` },
      sq: 2,
    });
    expect(listed["auction|lot"]).toEqual({ status: 100, list: [], total: 0, offs: 0 });
  });

  it("lists a shop glove, survives restart, and buyout mails item and gold", async () => {
    const [seller, buyer] = await dualHeroes(application);
    const bought = await buyShopGlove(seller, 3);
    const itemId = requireNumber(bagItemByArtikulId(bought, SHOP_GLOVE).id);
    const added = await seller.objectAction({
      object: "auction",
      action: "lot_add",
      form: { artifact_id: itemId, amount: 1, start_price: 1, buyout: 2, duration: 2 },
      sq: 5,
    });
    expect(added["auction|lot_add"]).toEqual({ status: 100 });
    expect(() => bagItemByArtikulId(added, SHOP_GLOVE)).toThrow(/23 is missing/);

    const mine = await seller.objectAction({ object: "auction", action: "my_lot", sq: 6 });
    const lot = requireLot(mine["auction|my_lot"], itemId);
    expect(lot.buyout).toBe(2);
    expect(lot.flags).toBe(1);

    application = await harness.restart();
    const restartedSeller = new AuthenticatedClient(application, seller.cookie);
    const restartedBuyer = new AuthenticatedClient(application, buyer.cookie);
    await restartedSeller.objectAction({ object: "common", action: "init", sq: 20 });
    const still = await restartedSeller.objectAction({
      object: "auction",
      action: "my_lot",
      sq: 21,
    });
    expect(requireLot(still["auction|my_lot"], itemId).id).toBe(lot.id);

    const buy = await restartedBuyer.objectAction({
      object: "auction",
      action: "buyout",
      form: { lot_id: lotId(lot) },
      sq: 3,
    });
    expect(buy["auction|buyout"]).toEqual({ status: 100 });
    expect(buy["common|dummy"]).toEqual({ status: 100 });

    const buyerInbox = await restartedBuyer.objectAction({ object: "post", action: "list", sq: 4 });
    expect(letterBySubject(buyerInbox, "Аукцион: покупка").artifact_list).toMatchObject({
      [String(itemId)]: { artikul_id: SHOP_GLOVE, cnt: 1 },
    });
    const sellerInbox = await restartedSeller.objectAction({
      object: "post",
      action: "list",
      sq: 22,
    });
    expect(letterBySubject(sellerInbox, "Аукцион: продажа").money_come).toBe("2.00");
  });

  it("second buyout is 203, overbid refunds mail, cancel needs no bid", async () => {
    const [seller, first, second] = await tripleHeroes(application);
    const firstGlove = await buyShopGlove(seller, 3);
    const raceId = requireNumber(bagItemByArtikulId(firstGlove, SHOP_GLOVE).id);
    const raceAdd = await seller.objectAction({
      object: "auction",
      action: "lot_add",
      form: { artifact_id: raceId, amount: 1, start_price: 1, buyout: 2, duration: 2 },
      sq: 5,
    });
    expect(raceAdd["auction|lot_add"]).toEqual({ status: 100 });
    const raceLot = requireLot(
      (await seller.objectAction({ object: "auction", action: "my_lot", sq: 6 }))["auction|my_lot"],
      raceId,
    );
    const [r1, r2] = await Promise.all([
      first.objectAction({
        object: "auction",
        action: "buyout",
        form: { lot_id: lotId(raceLot) },
        sq: 3,
      }),
      second.objectAction({
        object: "auction",
        action: "buyout",
        form: { lot_id: lotId(raceLot) },
        sq: 3,
      }),
    ]);
    const ok = [r1, r2].filter((row) => {
      const block = row["auction|buyout"];
      return isRecord(block) && block.status === 100;
    });
    const bad = [r1, r2].filter((row) => {
      const block = row["auction|buyout"];
      return isRecord(block) && block.status === 203;
    });
    expect(ok).toHaveLength(1);
    expect(bad).toHaveLength(1);

    const bidGlove = await buyShopGlove(seller, 8, false);
    const bidItem = requireNumber(bagItemByArtikulId(bidGlove, SHOP_GLOVE).id);
    await seller.objectAction({
      object: "auction",
      action: "lot_add",
      form: { artifact_id: bidItem, amount: 1, start_price: 1, buyout: 3, duration: 2 },
      sq: 9,
    });
    const bidLot = requireLot(
      (await seller.objectAction({ object: "auction", action: "my_lot", sq: 10 }))[
        "auction|my_lot"
      ],
      bidItem,
    );
    const bid = await first.objectAction({
      object: "auction",
      action: "bid",
      form: { lot_id: lotId(bidLot), bid: 1.2 },
      sq: 4,
    });
    expect(bid["auction|bid"]).toEqual({ status: 100, lot_id: lotId(bidLot), bid: 1.2 });
    const buy = await second.objectAction({
      object: "auction",
      action: "buyout",
      form: { lot_id: lotId(bidLot) },
      sq: 4,
    });
    expect(buy["auction|buyout"]).toEqual({ status: 100 });
    const lost = await first.objectAction({ object: "post", action: "list", sq: 5 });
    expect(letterBySubject(lost, "Аукцион: ставка не выиграла").money_come).toBe("1.20");

    const cancelGlove = await buyShopGlove(seller, 11, false);
    const cancelItem = requireNumber(bagItemByArtikulId(cancelGlove, SHOP_GLOVE).id);
    await seller.objectAction({
      object: "auction",
      action: "lot_add",
      form: { artifact_id: cancelItem, amount: 1, start_price: 1, buyout: 2, duration: 2 },
      sq: 12,
    });
    const freeLot = requireLot(
      (await seller.objectAction({ object: "auction", action: "my_lot", sq: 13 }))[
        "auction|my_lot"
      ],
      cancelItem,
    );
    const cancelled = await seller.objectAction({
      object: "auction",
      action: "cancel",
      form: { lot_id: lotId(freeLot) },
      sq: 14,
    });
    expect(cancelled["auction|cancel"]).toEqual({ status: 100 });
    const returned = await seller.objectAction({ object: "post", action: "list", sq: 15 });
    expect(letterBySubject(returned, "Аукцион: возврат")).toMatchObject({
      subject: "Аукцион: возврат",
    });

    const heldGlove = await buyShopGlove(seller, 16, false);
    const heldItem = requireNumber(bagItemByArtikulId(heldGlove, SHOP_GLOVE).id);
    await seller.objectAction({
      object: "auction",
      action: "lot_add",
      form: { artifact_id: heldItem, amount: 1, start_price: 1, buyout: 2, duration: 2 },
      sq: 17,
    });
    const heldLot = requireLot(
      (await seller.objectAction({ object: "auction", action: "my_lot", sq: 18 }))[
        "auction|my_lot"
      ],
      heldItem,
    );
    await first.objectAction({
      object: "auction",
      action: "bid",
      form: { lot_id: lotId(heldLot), bid: 1.2 },
      sq: 6,
    });
    const denied = await seller.objectAction({
      object: "auction",
      action: "cancel",
      form: { lot_id: lotId(heldLot) },
      sq: 19,
    });
    expect(denied["auction|cancel"]).toEqual({
      status: 203,
      error: "нельзя отменить лот со ставкой",
    });
  });

  it("expires without a bid, sells with a bid, and denies NOGIVE", async () => {
    const [seller, bidder] = await dualHeroes(application);
    const init = await seller.objectAction({ object: "common", action: "init", sq: 2 });
    const starterId = requireNumber(bagItemByArtikulId(init, STARTER_GLOVE).id);
    const nogive = await seller.objectAction({
      object: "auction",
      action: "lot_add",
      form: { artifact_id: starterId, amount: 1, start_price: 1, buyout: 2, duration: 2 },
      sq: 3,
    });
    expect(nogive["auction|lot_add"]).toEqual({
      status: 203,
      error: "непередаваемый предмет",
    });

    const freeGlove = await buyShopGlove(seller, 4);
    const freeId = requireNumber(bagItemByArtikulId(freeGlove, SHOP_GLOVE).id);
    await seller.objectAction({
      object: "auction",
      action: "lot_add",
      form: { artifact_id: freeId, amount: 1, start_price: 1, buyout: 2, duration: 2 },
      sq: 6,
    });
    await harness.elapseCombat(2 * 3600 * 1000 + 30_000);
    const expiredInbox = await seller.objectAction({ object: "post", action: "list", sq: 7 });
    expect(letterBySubject(expiredInbox, "Аукцион: возврат")).toBeTruthy();

    const bidGlove = await buyShopGlove(seller, 8, false);
    const bidId = requireNumber(bagItemByArtikulId(bidGlove, SHOP_GLOVE).id);
    await seller.objectAction({
      object: "auction",
      action: "lot_add",
      form: { artifact_id: bidId, amount: 1, start_price: 1, buyout: 2, duration: 2 },
      sq: 9,
    });
    const live = requireLot(
      (await seller.objectAction({ object: "auction", action: "my_lot", sq: 10 }))[
        "auction|my_lot"
      ],
      bidId,
    );
    await bidder.objectAction({
      object: "auction",
      action: "bid",
      form: { lot_id: lotId(live), bid: 1.5 },
      sq: 3,
    });
    await harness.elapseCombat(2 * 3600 * 1000 + 30_000);
    const won = await bidder.objectAction({ object: "post", action: "list", sq: 4 });
    expect(letterBySubject(won, "Аукцион: покупка")).toBeTruthy();
    const paid = await seller.objectAction({ object: "post", action: "list", sq: 11 });
    expect(letterBySubject(paid, "Аукцион: продажа").money_come).toBe("1.50");
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
  return bought;
}

function requireLot(block: AmfValue | undefined, originalItemId: number): Record<string, AmfValue> {
  const listed = requireRecord(block, "auction list");
  const list = listed.list;
  if (!Array.isArray(list)) throw new Error("auction list must be an array");
  for (const value of list) {
    const row = requireRecord(value, "lot");
    const artifact = requireRecord(row.artifact, "artifact");
    if (artifact.id === originalItemId) return row;
  }
  throw new Error(`lot for item ${originalItemId} is missing`);
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
