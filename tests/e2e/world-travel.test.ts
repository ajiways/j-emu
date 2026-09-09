import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import type { AmfValue } from "../../src/modules/jugger-wire/amf/amf3.ts";
import { AuthenticatedClient } from "../support/harness/authenticated-client.ts";
import { MAP_HUNT_SPAWN_ID } from "../support/harness/map-hunt-spawn.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";
import { heroIdFrom } from "../support/harness/wire-payload.ts";
import { FakeClock } from "../support/fake-clock.ts";
import { insertWeightedBagRows } from "../support/postgres/insert-weighted-bag-rows.ts";

const START_MS = 1_700_000_000_000;

describe("world travel", () => {
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

  it("enters the shop and exits back to 503 without a travel lock", async () => {
    const client = await AuthenticatedClient.login(application);
    await client.objectAction({ object: "common", action: "init", sq: 1 });
    const shop = await client.objectAction({
      object: "common",
      action: "action",
      form: { code: "COME_IN", area_id: 504 },
      sq: 2,
    });
    expect(shop["common|action"]).toEqual({ status: 100, action: "COME_IN" });
    expect(shop["common|action"]).not.toHaveProperty("msg_text");
    expect(objectBlock(shop.state).area_id).toBe("504");
    expect(areaConf(shop).area_ftime).toBe(0);
    expect(areaConfNested(shop).code).toBe("store");
    expect(shop["user|view"]).toBeUndefined();
    expect(shop["common|instance_conf"]).toBeUndefined();

    const exit = await client.objectAction({ object: "common", action: "exit", sq: 3 });
    expect(exit["common|exit"]).toEqual({ status: 100 });
    expect(exit["common|action"]).toBeUndefined();
    expect(objectBlock(exit.state).area_id).toBe("503");
    expect(areaConf(exit).area_ftime).toBe(0);
    expect(sidebarTitles(exit)).toEqual(["Деревенская лавка", "Ущелье разлуки"]);
  });

  it("locks 15s on 501, waits, then returns to 503", async () => {
    const client = await AuthenticatedClient.login(application);
    await client.objectAction({ object: "common", action: "init", sq: 1 });
    const gorge = await client.objectAction({
      object: "common",
      action: "action",
      form: { code: "COME_IN", area_id: 501 },
      sq: 2,
    });
    expect(objectBlock(gorge.state).area_id).toBe("501");
    expect(areaConf(gorge).area_ftime).toBe(15);
    expect(areaConfNested(gorge).ftime_max).toBe(15);
    expect(areaConfNested(gorge).swf).toBe("uschelierazluki.swf");
    expect(sidebarTitles(gorge)).toEqual(["В Горное поселение"]);

    const early = await client.objectAction({
      object: "common",
      action: "action",
      form: { code: "COME_IN", area_id: 503 },
      sq: 3,
    });
    expect(early["common|action"]).toEqual({
      status: 204,
      error: "Подождите! Дальнейшее перемещение станет возможным по истечении 15&nbsp;с..",
    });
    expect(early["common|area_conf"]).toBeUndefined();

    clock.advanceSeconds(15);
    const back = await client.objectAction({
      object: "common",
      action: "action",
      form: { code: "COME_IN", area_id: 503 },
      sq: 4,
    });
    expect(back["common|action"]).toEqual({ status: 100, action: "COME_IN" });
    expect(objectBlock(back.state).area_id).toBe("503");
    expect(areaConf(back).area_ftime).toBe(0);
  });

  it("denies overload at 21 weighted slots and allows 20/20", async () => {
    const walker = await AuthenticatedClient.login(application);
    const walkInit = await walker.objectAction({ object: "common", action: "init", sq: 1 });
    await insertWeightedBagRows(heroIdFrom(walkInit), 18);
    const walked = await walker.objectAction({
      object: "common",
      action: "action",
      form: { code: "COME_IN", area_id: 504 },
      sq: 2,
    });
    expect(walked["common|action"]).toEqual({ status: 100, action: "COME_IN" });

    const blocked = await AuthenticatedClient.login(application);
    const blockedInit = await blocked.objectAction({ object: "common", action: "init", sq: 1 });
    await insertWeightedBagRows(heroIdFrom(blockedInit), 19);
    const denied = await blocked.objectAction({
      object: "common",
      action: "action",
      form: { code: "COME_IN", area_id: 504 },
      sq: 2,
    });
    expect(denied["common|action"]).toEqual({
      status: 204,
      error: "Вы не можете перемещаться, т.к. рюкзак перегружен!",
    });
    expect(denied["common|area_conf"]).toBeUndefined();
  });

  it("denies COME_IN in a fight, missing links, and outdoor exit", async () => {
    const client = await AuthenticatedClient.login(application);
    await client.objectAction({ object: "common", action: "init", sq: 1 });
    const start = await client.objectAction({
      object: "common",
      action: "object",
      form: { code: "ATTACK_BOT", bot_id: MAP_HUNT_SPAWN_ID },
      sq: 2,
    });
    expect(start["common|action"]).toEqual({ status: 100 });
    const inFight = await client.objectAction({
      object: "common",
      action: "action",
      form: { code: "COME_IN", area_id: 504 },
      sq: 3,
    });
    expect(inFight["common|action"]).toEqual({ status: 203, error: "нельзя во время боя" });

    application = await harness.restart();
    const again = new AuthenticatedClient(application, client.cookie);
    await again.objectAction({ object: "common", action: "init", sq: 20 });
    const missing = await again.objectAction({
      object: "common",
      action: "action",
      form: { code: "COME_IN", area_id: 502 },
      sq: 21,
    });
    expect(missing["common|action"]).toEqual({ status: 203, error: "некуда идти" });
    const outdoor = await again.objectAction({ object: "common", action: "exit", sq: 22 });
    expect(outdoor["common|exit"]).toEqual({ status: 204, error: "Перемещение невозможно!" });
  });

  it("reconnects on the destination with sidebar items", async () => {
    const client = await AuthenticatedClient.login(application);
    await client.objectAction({ object: "common", action: "init", sq: 1 });
    await client.objectAction({
      object: "common",
      action: "action",
      form: { code: "COME_IN", area_id: 501 },
      sq: 2,
    });
    application = await harness.restart();
    const again = new AuthenticatedClient(application, client.cookie);
    const init2 = await again.objectAction({ object: "common", action: "init2", sq: 21 });
    expect(objectBlock(init2.state).area_id).toBe("501");
    expect(areaConf(init2).area_ftime).toBe(15);
    expect(sidebarTitles(init2)).toEqual(["В Горное поселение"]);
    expect(init2["chat|area_population"]).toBeTypeOf("object");
  });
});

function areaConf(payload: Record<string, AmfValue>): Record<string, AmfValue> {
  return objectBlock(payload["common|area_conf"]);
}

function areaConfNested(payload: Record<string, AmfValue>): Record<string, AmfValue> {
  return objectBlock(areaConf(payload)["area_conf"]);
}

function sidebarTitles(payload: Record<string, AmfValue>): string[] {
  const items = areaConfNested(payload)["items"];
  if (!Array.isArray(items)) throw new Error("area_conf.items must be an array");
  return items.map((item) => {
    const row = objectBlock(item);
    if (typeof row.title !== "string") throw new Error("area item title must be a string");
    return row.title;
  });
}

function objectBlock(value: AmfValue | undefined): Record<string, AmfValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("expected object block");
  }
  return value;
}
