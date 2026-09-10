import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import type { AmfValue } from "../../src/modules/jugger-wire/amf/amf3.ts";
import { createIsolatedHero } from "../support/harness/authenticated-client.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";

describe("hunt wander", () => {
  let harness: ApplicationHarness;
  let application: Application;

  beforeEach(async () => {
    harness = new ApplicationHarness();
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("walks dump-proven 50309 while 50310 stays on home", async () => {
    const client = await createIsolatedHero(application);
    const init2 = await client.objectAction({ object: "common", action: "init2", sq: 2 });
    expect(huntBot(init2, 50309)).toMatchObject({
      artikul_id: 4,
      fight_id: 0,
      prev_x: 922,
      prev_y: 1401,
      position_x: 935,
      position_y: 1260,
    });
    expect(huntBot(init2, 50310)).toMatchObject({
      artikul_id: 2,
      fight_id: 0,
      position_x: 883,
      position_y: 1499,
      prev_x: 883,
      prev_y: 1499,
    });

    await harness.elapseCombat(8_000);
    const frames = await client.pollEsrv();
    expect(huntBotFromEsrv(frames, 50309)).toMatchObject({
      fight_id: 0,
      position_x: 935,
      position_y: 1260,
      prev_x: 935,
      prev_y: 1260,
    });
    expect(huntBotFromEsrv(frames, 50310)).toMatchObject({
      position_x: 883,
      position_y: 1499,
      prev_x: 883,
      prev_y: 1499,
    });
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

function huntBotFromEsrv(packets: readonly AmfValue[], spawnId: number): Record<string, AmfValue> {
  const hunt = packets.find((packet) => frameChannel(packet) === "131:503");
  if (!hunt || typeof hunt !== "object" || Array.isArray(hunt)) {
    throw new Error("esrv 131:503 is missing");
  }
  const object = objectBlock(hunt.object, "hunt frame object");
  const huntBlock = object["common|hunt"];
  if (huntBlock === undefined) throw new Error("common|hunt is missing");
  return huntBot({ "common|hunt": huntBlock }, spawnId);
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
