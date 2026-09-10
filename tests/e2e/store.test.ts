import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import type { AmfValue } from "../../src/modules/jugger-wire/amf/amf3.ts";
import { AuthenticatedClient } from "../support/harness/authenticated-client.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";
import { completeMeleeHunt } from "../support/harness/complete-melee-hunt.ts";
import { bagItemByArtikulId, heroIdFrom } from "../support/harness/wire-payload.ts";

describe("store list and buy", () => {
  let harness: ApplicationHarness;
  let application: Application;

  beforeEach(async () => {
    harness = new ApplicationHarness();
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("lists 504 types and lots 23/24 after COME_IN", async () => {
    const client = await AuthenticatedClient.login(application);
    await client.objectAction({ object: "common", action: "init", sq: 1 });
    await enterShop(client, 2);
    const listed = await client.objectAction({ object: "store", action: "list", sq: 3 });
    const block = requireRecord(listed["store|list"], "store|list");
    expect(block.status).toBe(100);
    expect(typeIds(block.types)).toEqual([-131]);
    expect(lotArtikuls(block.artikuls)).toEqual([24, 23]);
    const lots = Array.isArray(block.artikuls) ? block.artikuls : [];
    for (const row of lots) {
      const lot = requireRecord(row, "store lot");
      expect(lot.durability).toBe(30);
      expect(lot.durability_max).toBe(30);
    }
  });

  it("buys both lots, persists 23.00 and bag across reconnect/restart", async () => {
    const client = await AuthenticatedClient.login(application);
    await client.objectAction({ object: "common", action: "init", sq: 1 });
    await enterShop(client, 2);
    const bought = await client.objectAction({
      object: "store",
      action: "buy",
      form: { basket: { "80": 1, "82": 1 } },
      sq: 3,
    });
    expect(bought["store|buy"]).toEqual({ status: 100 });
    expect(stateMoney(bought)).toBe("23.00");
    expect(bagItemByArtikulId(bought, 23).title).toBe("Простая магическая перчатка");
    expect(bagItemByArtikulId(bought, 24).title).toBe("Простой наруч");
    expect(bought["book|quest_list"]).toBeUndefined();

    application = await harness.restart();
    const restarted = new AuthenticatedClient(application, client.cookie);
    const again = await restarted.objectAction({ object: "common", action: "init", sq: 20 });
    expect(stateMoney(again)).toBe("23.00");
    expect(bagItemByArtikulId(again, 23).artikul_id).toBe(23);
    expect(bagItemByArtikulId(again, 24).artikul_id).toBe(24);
  });

  it("returns status 2 outside the shop, for an empty basket, unknown lot, and missing gold", async () => {
    const client = await AuthenticatedClient.login(application);
    await client.objectAction({ object: "common", action: "init", sq: 1 });
    const outside = await client.objectAction({
      object: "store",
      action: "buy",
      form: { basket: { "80": 1 } },
      sq: 2,
    });
    expect(outside["store|buy"]).toEqual({ status: 2, error: "Здесь нельзя торговать" });
    const emptyList = await client.objectAction({ object: "store", action: "list", sq: 3 });
    const listed = requireRecord(emptyList["store|list"], "store|list");
    expect(listed.status).toBe(100);
    expect(typeIds(listed.types)).toEqual([]);
    expect(lotArtikuls(listed.artikuls)).toEqual([]);

    await enterShop(client, 4);
    const empty = await client.objectAction({ object: "store", action: "buy", sq: 5 });
    expect(empty["store|buy"]).toEqual({ status: 2, error: "пустая корзина" });
    const unknown = await client.objectAction({
      object: "store",
      action: "buy",
      form: { basket: { "999": 1 } },
      sq: 6,
    });
    expect(unknown["store|buy"]).toEqual({ status: 2, error: "неизвестный товар 999" });
    const poor = await client.objectAction({
      object: "store",
      action: "buy",
      form: { basket: { "80": 26 } },
      sq: 7,
    });
    expect(poor["store|buy"]).toEqual({ status: 2, error: "Недостаточно денег" });
  });
});

describe("store RANK gate", () => {
  let harness: ApplicationHarness;
  let application: Application;

  beforeEach(async () => {
    harness = new ApplicationHarness();
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("lists arsenal lot 621 and denies buy with 203 before charging gold", async () => {
    const client = await AuthenticatedClient.login(application);
    const init = await client.objectAction({ object: "common", action: "init", sq: 1 });
    await application.characterLocation.setArea({
      characterId: heroIdFrom(init),
      areaId: "552",
      moveReadyAt: null,
    });
    const listed = await client.objectAction({ object: "store", action: "list", sq: 2 });
    const block = requireRecord(listed["store|list"], "store|list");
    expect(block.status).toBe(100);
    expect(typeIds(block.types)).toEqual([11]);
    expect(lotArtikuls(block.artikuls)).toEqual([621]);
    const denied = await client.objectAction({
      object: "store",
      action: "buy",
      form: { basket: { "438": 1 } },
      sq: 3,
    });
    expect(denied["store|buy"]).toEqual({
      status: 203,
      error: "Нужно звание «Громила».",
    });
    const again = await client.objectAction({ object: "store", action: "list", sq: 4 });
    const stillListed = requireRecord(again["store|list"], "store|list");
    expect(lotArtikuls(stillListed.artikuls)).toEqual([621]);
  });
});

describe("store buy while ghosted", () => {
  let harness: ApplicationHarness;
  let application: Application;

  beforeEach(async () => {
    harness = new ApplicationHarness(undefined, undefined, {
      combatBotStrength: 400,
    });
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("returns 203 for a ghost buy in the shop", async () => {
    const client = await AuthenticatedClient.login(application);
    await client.objectAction({ object: "common", action: "init", sq: 1 });
    await completeMeleeHunt(client, (ms) => harness.elapseCombat(ms), 4, { equipGlove: false });
    await client.pollEsrv();
    await enterShop(client, 20);
    const denied = await client.objectAction({
      object: "store",
      action: "buy",
      form: { basket: { "80": 1 } },
      sq: 21,
    });
    expect(denied["store|buy"]).toEqual({
      status: 203,
      error: expect.stringMatching(/cannot storeBuy while ghosted/),
    });
  });
});

async function enterShop(client: AuthenticatedClient, sq: number): Promise<void> {
  const shop = await client.objectAction({
    object: "common",
    action: "action",
    form: { code: "COME_IN", area_id: 504 },
    sq,
  });
  expect(shop["common|action"]).toEqual({ status: 100, action: "COME_IN" });
}

function typeIds(value: AmfValue | undefined): number[] {
  if (value === undefined) return [];
  if (Array.isArray(value)) {
    return value.map((entry, index) => {
      const row = requireRecord(entry, `store|list.types.${index}`);
      if (typeof row.id !== "number") throw new Error(`type ${index} id is missing`);
      return row.id;
    });
  }
  const types = requireRecord(value, "store|list.types");
  return Object.keys(types)
    .sort((left, right) => Number(left) - Number(right))
    .map((key) => {
      const row = requireRecord(types[key], `store|list.types.${key}`);
      if (typeof row.id !== "number") throw new Error(`type ${key} id is missing`);
      return row.id;
    });
}

function lotArtikuls(value: AmfValue | undefined): number[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error("store|list.artikuls must be an array");
  return value.map((entry, index) => {
    const lot = requireRecord(entry, `store|list.artikuls.${index}`);
    if (typeof lot.id !== "number") throw new Error(`lot ${index} id is missing`);
    return lot.id;
  });
}

function stateMoney(payload: Record<string, AmfValue>): string {
  const state = payload.state;
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("state is missing");
  }
  if (typeof state.money !== "string") throw new Error("state.money is missing");
  return state.money;
}

function requireRecord(value: AmfValue | undefined, label: string): Record<string, AmfValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
}
