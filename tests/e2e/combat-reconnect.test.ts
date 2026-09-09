import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import type { AmfValue } from "../../src/modules/jugger-wire/amf/amf3.ts";
import { AuthenticatedClient } from "../support/harness/authenticated-client.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";
import { MAP_HUNT_SPAWN_ID } from "../support/harness/map-hunt-spawn.ts";
import {
  attacknowRestTimeFrom,
  fightEventTypes,
  huntFightConfFrom,
} from "../support/harness/wire-payload.ts";

describe("combat reconnect", () => {
  let harness: ApplicationHarness;
  let application: Application;

  beforeEach(async () => {
    harness = new ApplicationHarness();
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("piggybacks fight|conf on init2 and resumes without oppwait", async () => {
    const client = await AuthenticatedClient.login(application);
    const start = await client.objectAction({
      object: "common",
      action: "object",
      form: { code: "ATTACK_BOT", bot_id: MAP_HUNT_SPAWN_ID },
      sq: 4,
    });
    const opened = huntFightConfFrom(start);
    expect(await client.fight({ rc: "auth", eid: opened.fightId, sq: 5 })).toHaveLength(0);
    const first = await client.pollFight();
    expect(fightEventTypes(first)).toEqual(
      expect.arrayContaining(["fightState", "oppwait", "oppnew", "attacknow"]),
    );
    expect(attacknowRestTimeFrom(first)).toBe(20);

    await harness.elapseCombat(3_000);
    const init = await client.objectAction({ object: "common", action: "init", sq: 20 });
    expect(stateFightId(init)).toBe(Number(opened.fightId));
    const init2 = await client.objectAction({ object: "common", action: "init2", sq: 21 });
    const resumed = huntFightConfFrom(init2);
    expect(resumed).toEqual(opened);
    expect(stateFightId(init2)).toBe(Number(opened.fightId));
    expect(unitframeFightId(init2)).toBe(Number(opened.fightId));
    expect(huntBot(init2, MAP_HUNT_SPAWN_ID).fight_id).toBe(Number(opened.fightId));

    expect(await client.fight({ rc: "auth", eid: opened.fightId, sq: 22 })).toHaveLength(0);
    const again = await client.pollFight();
    const types = fightEventTypes(again);
    expect(types).toEqual(expect.arrayContaining(["fightState", "oppnew", "attacknow"]));
    expect(types).not.toContain("oppwait");
    expect(attacknowRestTimeFrom(again)).toBe(17);
  });

  it("rejects RESURRECT while a hunt is active", async () => {
    const client = await AuthenticatedClient.login(application);
    await client.objectAction({
      object: "common",
      action: "object",
      form: { code: "ATTACK_BOT", bot_id: MAP_HUNT_SPAWN_ID },
      sq: 4,
    });
    const denied = await client.objectAction({
      object: "common",
      action: "object",
      form: { code: "RESURRECT" },
      sq: 5,
    });
    expect(denied["common|action"]).toEqual({ status: 203, error: "нельзя во время боя" });
  });
});

function stateFightId(payload: Record<string, AmfValue>): number {
  const state = payload.state;
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("state is missing");
  }
  if (typeof state.fight_id !== "number") throw new Error("state.fight_id is missing");
  return state.fight_id;
}

function unitframeFightId(payload: Record<string, AmfValue>): number {
  const frame = payload["user|unitframe"];
  if (!frame || typeof frame !== "object" || Array.isArray(frame)) {
    throw new Error("user|unitframe is missing");
  }
  if (typeof frame.fight_id !== "number") throw new Error("user|unitframe.fight_id is missing");
  return frame.fight_id;
}

function huntBot(payload: Record<string, AmfValue>, spawnId: number): Record<string, AmfValue> {
  const hunt = payload["common|hunt"];
  if (!hunt || typeof hunt !== "object" || Array.isArray(hunt)) {
    throw new Error("common|hunt is missing");
  }
  const bots = hunt.bots;
  if (!Array.isArray(bots)) throw new Error("common|hunt.bots must be an array");
  const bot = bots.find((row) => {
    return Boolean(row && typeof row === "object" && !Array.isArray(row) && row.id === spawnId);
  });
  if (!bot || typeof bot !== "object" || Array.isArray(bot)) {
    throw new Error(`common|hunt is missing spawn ${spawnId}`);
  }
  return bot;
}
