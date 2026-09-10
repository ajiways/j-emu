import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import type { AmfValue } from "../../src/modules/jugger-wire/amf/amf3.ts";
import { AuthenticatedClient } from "../support/harness/authenticated-client.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";
import { uniqueDevelopmentSlot } from "../support/harness/unique-development-slot.ts";
import { bagItemByArtikulId } from "../support/harness/wire-payload.ts";

const SHOP_GLOVE = 23;
const STARTER_GLOVE = 9095;

describe("direct trade session", () => {
  let harness: ApplicationHarness;
  let application: Application;

  beforeEach(async () => {
    harness = new ApplicationHarness();
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("requests, puts, survives disconnect, rejects NOGIVE, and decline returns the item", async () => {
    const [a, b, nickB, initA] = await dualHeroes(application);
    const starterId = requireNumber(bagItemByArtikulId(initA, STARTER_GLOVE).id);
    const asked = await a.objectAction({
      object: "trade",
      action: "request",
      form: { nick: nickB },
      sq: 2,
    });
    expect(asked["trade|request"]).toEqual({ status: 100 });
    const session = requireRecord(asked["trade|session"], "trade|session");
    expect(session.opponent_tray).toEqual([]);
    const myTray = requireRecord(session.my_tray, "my_tray");
    const trayId = requireNumber(myTray.id);

    const window = personalObject(await b.pollEsrv())["common|window"];
    expect(window).toMatchObject({
      status: 100,
      title: "Предложение торговли",
    });

    const accepted = await b.objectAction({
      object: "trade",
      action: "confirm",
      form: { tray_id: trayId },
      sq: 3,
    });
    expect(accepted["trade|confirm"]).toEqual({ status: 100 });
    expect(requireRecord(accepted["trade|session"], "trade|session").opponent_tray).toMatchObject({
      id: trayId,
    });

    const peerPackets = await a.pollEsrv();
    const peer = personalObject(peerPackets)["trade|session"];
    expect(peer).toMatchObject({ status: 100 });
    const acceptedChat = chatMessageTexts(peerPackets);
    expect(acceptedChat.some((msg) => msg.includes("согласился торговать"))).toBe(true);

    const nogive = await a.objectAction({
      object: "trade",
      action: "put",
      form: { item: starterId, amount: 1 },
      sq: 4,
    });
    expect(nogive["trade|put"]).toEqual({
      status: 203,
      error: "непередаваемый предмет нельзя положить в обмен",
    });

    const bought = await buyShopGlove(a, 5);
    const itemId = requireNumber(bagItemByArtikulId(bought, SHOP_GLOVE).id);
    const put = await a.objectAction({
      object: "trade",
      action: "put",
      form: { item: itemId, amount: 1 },
      sq: 7,
    });
    expect(put["trade|put"]).toEqual({ status: 100 });
    const putSession = requireRecord(put["trade|session"], "trade|session");
    expect(
      requireRecord(
        requireRecord(requireRecord(putSession.my_tray, "my_tray").items, "tray items").artifacts,
        "artifacts",
      )[String(itemId)],
    ).toMatchObject({ artikul_id: SHOP_GLOVE, cnt: 1 });
    const keyBefore = requireString(putSession.confirm_key, "confirm_key");

    const reconnected = new AuthenticatedClient(application, a.cookie);
    const still = await reconnected.objectAction({
      object: "trade",
      action: "put_money",
      form: { amount: 0 },
      sq: 8,
    });
    const stillSession = requireRecord(still["trade|session"], "trade|session");
    expect(stillSession.confirm_key).not.toBe(keyBefore);
    const items = requireRecord(requireRecord(stillSession.my_tray, "my_tray").items, "tray items");
    expect(requireRecord(items.artifacts, "artifacts")[String(itemId)]).toMatchObject({
      artikul_id: SHOP_GLOVE,
      cnt: 1,
    });

    const declined = await reconnected.objectAction({
      object: "trade",
      action: "decline",
      sq: 9,
    });
    expect(declined["trade|decline"]).toEqual({ status: 100 });
    expect(declined["trade|session"]).toEqual({ status: 100 });
    expect(bagItemByArtikulId(declined, SHOP_GLOVE)).toMatchObject({
      artikul_id: SHOP_GLOVE,
      cnt: 1,
    });
  });

  it("settles a shop glove once both sides confirm", async () => {
    const [seller, buyer, nickBuyer] = await dualHeroes(application);
    const bought = await buyShopGlove(seller, 2);
    const itemId = requireNumber(bagItemByArtikulId(bought, SHOP_GLOVE).id);
    const asked = await seller.objectAction({
      object: "trade",
      action: "request",
      form: { nick: nickBuyer },
      sq: 4,
    });
    const trayId = requireNumber(
      requireRecord(requireRecord(asked["trade|session"], "trade|session").my_tray, "my_tray").id,
    );
    await buyer.pollEsrv();
    await buyer.objectAction({
      object: "trade",
      action: "confirm",
      form: { tray_id: trayId },
      sq: 3,
    });
    await seller.pollEsrv();
    const put = await seller.objectAction({
      object: "trade",
      action: "put",
      form: { item: itemId, amount: 1 },
      sq: 5,
    });
    const sellerKey = requireString(
      requireRecord(put["trade|session"], "trade|session").confirm_key,
      "confirm_key",
    );
    await buyer.pollEsrv();
    const sellerReady = await seller.objectAction({
      object: "trade",
      action: "session_ready",
      form: { confirm_key: sellerKey },
      sq: 6,
    });
    expect(sellerReady["trade|session_ready"]).toEqual({ status: 100 });
    const buyerSession = personalObject(await buyer.pollEsrv())["trade|session"];
    const buyerKey = requireString(
      requireRecord(buyerSession, "peer session").confirm_key,
      "confirm_key",
    );
    const buyerReady = await buyer.objectAction({
      object: "trade",
      action: "session_ready",
      form: { confirm_key: buyerKey },
      sq: 4,
    });
    expect(requireRecord(buyerReady["trade|session"], "trade|session").my_tray).toMatchObject({
      confirmed: 1,
    });
    await seller.pollEsrv();
    const first = await seller.objectAction({
      object: "trade",
      action: "session_confirm",
      form: { confirm_key: sellerKey },
      sq: 7,
    });
    expect(requireRecord(first["trade|session"], "trade|session").my_tray).toMatchObject({
      confirmed: 2,
    });
    await buyer.pollEsrv();
    const settled = await buyer.objectAction({
      object: "trade",
      action: "session_confirm",
      form: { confirm_key: buyerKey },
      sq: 5,
    });
    expect(settled["trade|session_confirm"]).toEqual({ status: 100 });
    expect(settled["trade|session"]).toEqual({ status: 100 });
    expect(bagItemByArtikulId(settled, SHOP_GLOVE).artikul_id).toBe(SHOP_GLOVE);
    const sellerDone = personalObject(await seller.pollEsrv());
    expect(sellerDone["trade|session"]).toEqual({ status: 100 });
    expect(() => bagItemByArtikulId(sellerDone, SHOP_GLOVE)).toThrow(/23 is missing/);
  });
});

async function dualHeroes(
  application: Application,
): Promise<readonly [AuthenticatedClient, AuthenticatedClient, string, Record<string, AmfValue>]> {
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
  return [clientA, clientB, nickFrom(initB), initA];
}

async function buyShopGlove(
  client: AuthenticatedClient,
  sq: number,
): Promise<Record<string, AmfValue>> {
  const shop = await client.objectAction({
    object: "common",
    action: "action",
    form: { code: "COME_IN", area_id: 504 },
    sq,
  });
  expect(shop["common|action"]).toEqual({ status: 100, action: "COME_IN" });
  const bought = await client.objectAction({
    object: "store",
    action: "buy",
    form: { basket: { "80": 1 } },
    sq: sq + 1,
  });
  expect(bought["store|buy"]).toEqual({ status: 100 });
  return bought;
}

function nickFrom(payload: Record<string, AmfValue>): string {
  const conf = requireRecord(payload["user|conf"], "user|conf");
  if (typeof conf.nick !== "string" || !conf.nick) throw new Error("user|conf.nick missing");
  return conf.nick;
}

function personalObject(packets: readonly AmfValue[]): Record<string, AmfValue> {
  let first: Record<string, AmfValue> | undefined;
  for (const packet of packets) {
    if (!packet || typeof packet !== "object" || Array.isArray(packet)) continue;
    if (typeof packet.channel !== "string" || !packet.channel.startsWith("2:")) continue;
    if (!packet.object || typeof packet.object !== "object" || Array.isArray(packet.object)) {
      continue;
    }
    const object = packet.object as Record<string, AmfValue>;
    if ("trade|session" in object || "common|window" in object) return object;
    if (!first) first = object;
  }
  if (first) return first;
  throw new Error("personal esrv object is missing");
}

function chatMessageTexts(packets: readonly AmfValue[]): string[] {
  const texts: string[] = [];
  for (const packet of packets) {
    if (!packet || typeof packet !== "object" || Array.isArray(packet)) continue;
    if (typeof packet.channel !== "string" || !packet.channel.startsWith("2:")) continue;
    if (!packet.object || typeof packet.object !== "object" || Array.isArray(packet.object)) {
      continue;
    }
    const block = (packet.object as Record<string, AmfValue>)["chat|message"];
    if (!block || typeof block !== "object" || Array.isArray(block)) continue;
    const message = (block as Record<string, AmfValue>).message;
    if (!message || typeof message !== "object" || Array.isArray(message)) continue;
    const msg = (message as Record<string, AmfValue>).msg;
    if (typeof msg === "string") texts.push(msg);
  }
  return texts;
}

function requireNumber(value: AmfValue | undefined): number {
  if (typeof value !== "number" || !Number.isInteger(value)) throw new Error("id must be integer");
  return value;
}

function requireString(value: AmfValue | undefined, label: string): string {
  if (typeof value !== "string" || !value) throw new Error(`${label} must be a string`);
  return value;
}

function isRecord(value: AmfValue | undefined): value is Record<string, AmfValue> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function requireRecord(value: AmfValue | undefined, label: string): Record<string, AmfValue> {
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  return value;
}
