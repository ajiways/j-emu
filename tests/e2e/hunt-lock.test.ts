import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import type { AmfValue } from "../../src/modules/jugger-wire/amf/amf3.ts";
import { IDLE_HUNT_FIGHT_ID } from "../../src/modules/jugger-wire/application/hunt-block.ts";
import {
  AuthenticatedClient,
  createIsolatedHero,
} from "../support/harness/authenticated-client.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";
import { finishStartedMeleeHunt } from "../support/harness/complete-melee-hunt.ts";
import { MAP_HUNT_SPAWN_ID } from "../support/harness/map-hunt-spawn.ts";
import { huntFightIdFrom } from "../support/harness/wire-payload.ts";

describe("hunt spawn lock", () => {
  let harness: ApplicationHarness;
  let application: Application;

  beforeEach(async () => {
    harness = new ApplicationHarness();
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("occupies 50310 for one hero and idles after finish", async () => {
    const a = await createIsolatedHero(application);
    const b = await createIsolatedHero(application);
    const start = await a.objectAction({
      object: "common",
      action: "object",
      form: { code: "ATTACK_BOT", bot_id: MAP_HUNT_SPAWN_ID },
      sq: 4,
    });
    expect(start["common|action"]).toEqual({ status: 100 });
    const fightId = huntFightIdFrom(start);
    expect(huntBot(start, MAP_HUNT_SPAWN_ID).fight_id).toBe(Number(fightId));

    const denied = await b.objectAction({
      object: "common",
      action: "object",
      form: { code: "ATTACK_BOT", bot_id: MAP_HUNT_SPAWN_ID },
      sq: 4,
    });
    expect(denied["common|action"]).toEqual({ status: 203, error: "моб уже занят" });
    expect(huntBotFromEsrv(await b.pollEsrv(), "503").fight_id).toBe(Number(fightId));

    await finishStartedMeleeHunt(a, fightId, 5);
    await a.pollEsrv();
    expect(huntBotFromEsrv(await b.pollEsrv(), "503").fight_id).toBe(IDLE_HUNT_FIGHT_ID);
  });

  it("clears the overlay on restart without moving the hero", async () => {
    const a = await createIsolatedHero(application);
    const start = await a.objectAction({
      object: "common",
      action: "object",
      form: { code: "ATTACK_BOT", bot_id: MAP_HUNT_SPAWN_ID },
      sq: 4,
    });
    expect(start["common|action"]).toEqual({ status: 100 });
    expect((start.state as { area_id: string }).area_id).toBe("503");
    application = await harness.restart();
    const again = new AuthenticatedClient(application, a.cookie);
    const init2 = await again.objectAction({ object: "common", action: "init2", sq: 21 });
    expect((init2.state as { area_id: string }).area_id).toBe("503");
    expect(huntBot(init2, MAP_HUNT_SPAWN_ID).fight_id).toBe(IDLE_HUNT_FIGHT_ID);
  });
});

function huntBot(payload: Record<string, AmfValue>, spawnId: number): Record<string, AmfValue> {
  const hunt = objectBlock(payload["common|hunt"], "common|hunt");
  const bots = hunt.bots;
  if (!Array.isArray(bots)) throw new Error("common|hunt.bots must be an array");
  const bot = bots.find((row) => objectBlock(row, "hunt bot").id === spawnId);
  if (!bot) throw new Error(`common|hunt is missing spawn ${spawnId}`);
  return objectBlock(bot, `hunt bot ${spawnId}`);
}

function huntBotFromEsrv(packets: readonly AmfValue[], areaId: string): Record<string, AmfValue> {
  const hunt = packets.find((packet) => frameChannel(packet) === `131:${areaId}`);
  if (!hunt || typeof hunt !== "object" || Array.isArray(hunt)) {
    throw new Error(`esrv 131:${areaId} is missing`);
  }
  const object = objectBlock(hunt.object, "hunt frame object");
  const huntBlock = object["common|hunt"];
  if (huntBlock === undefined) throw new Error("common|hunt is missing");
  return huntBot({ "common|hunt": huntBlock }, MAP_HUNT_SPAWN_ID);
}

function frameChannel(packet: AmfValue): string {
  if (!packet || typeof packet !== "object" || Array.isArray(packet)) {
    throw new Error("esrv packet is not an object");
  }
  if (typeof packet.channel !== "string") throw new Error("esrv packet channel is missing");
  return packet.channel;
}

function objectBlock(value: AmfValue | undefined, label: string): Record<string, AmfValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} is missing`);
  }
  return value;
}
