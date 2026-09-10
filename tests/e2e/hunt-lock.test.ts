import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import type { AmfValue } from "../../src/modules/jugger-wire/amf/amf3.ts";
import { IDLE_HUNT_FIGHT_ID } from "../../src/modules/jugger-wire/application/hunt-block.ts";
import {
  AuthenticatedClient,
  createIsolatedHero,
} from "../support/harness/authenticated-client.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";
import { MAP_HUNT_SPAWN_ID } from "../support/harness/map-hunt-spawn.ts";
import {
  putOnStarterGloveIfInBag,
  strikeUntilHuntFinish,
} from "../support/harness/complete-melee-hunt.ts";
import {
  fightEventTypes,
  fightPersListIds,
  heroIdFrom,
  huntFightConfFrom,
} from "../support/harness/wire-payload.ts";

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

  it("lets a second hero join the occupied 50310 fight", async () => {
    const a = await createIsolatedHero(application);
    const b = await createIsolatedHero(application);
    const initA = await a.objectAction({ object: "common", action: "init", sq: 1 });
    const initB = await b.objectAction({ object: "common", action: "init", sq: 1 });
    const heroA = heroIdFrom(initA);
    const heroB = heroIdFrom(initB);
    await putOnStarterGloveIfInBag(a, 2);
    const start = await a.objectAction({
      object: "common",
      action: "object",
      form: { code: "ATTACK_BOT", bot_id: MAP_HUNT_SPAWN_ID },
      sq: 4,
    });
    expect(start["common|action"]).toEqual({ status: 100 });
    const opened = huntFightConfFrom(start);
    expect(opened.userId).toBe(String(heroA));
    expect(huntBot(start, MAP_HUNT_SPAWN_ID).fight_id).toBe(Number(opened.fightId));

    const authA = await a.fight({ rc: "auth", eid: opened.fightId, sq: 5 });
    if (authA.length !== 0) throw new Error("fproxy auth must return an empty body");
    const bootstrapA = await a.pollFight();
    expect(fightEventTypes(bootstrapA)).toEqual(
      expect.arrayContaining(["fightState", "persList", "oppnew", "attacknow"]),
    );

    const join = await b.objectAction({
      object: "common",
      action: "object",
      form: { code: "ATTACK_BOT", bot_id: MAP_HUNT_SPAWN_ID },
      sq: 4,
    });
    expect(join["common|action"]).toEqual({ status: 100 });
    const joined = huntFightConfFrom(join);
    expect(joined.fightId).toBe(opened.fightId);
    expect(joined.fightAkey).toBe(opened.fightAkey);
    expect(joined.userId).toBe(String(heroB));
    expect(joined.userId).not.toBe(opened.userId);
    expect(huntBot(join, MAP_HUNT_SPAWN_ID).fight_id).toBe(Number(opened.fightId));
    expect(huntBotFromEsrv(await b.pollEsrv(), "503").fight_id).toBe(Number(opened.fightId));

    const rosterA = await a.pollFight();
    expect(fightEventTypes(rosterA)).toEqual(
      expect.arrayContaining(["persList", "persChangeInfo"]),
    );
    expect(fightPersListIds(rosterA)).toEqual(expect.arrayContaining([heroA, heroB]));

    const authB = await b.fight({ rc: "auth", eid: joined.fightId, sq: 5 });
    if (authB.length !== 0) throw new Error("fproxy auth must return an empty body");
    const bootstrapB = await b.pollFight();
    const joinerTypes = fightEventTypes(bootstrapB);
    expect(joinerTypes).toEqual(expect.arrayContaining(["fightState", "persList", "oppwait"]));
    expect(joinerTypes).not.toContain("attacknow");
    expect(joinerTypes).not.toContain("oppnew");
    expect(fightPersListIds(bootstrapB)).toEqual(expect.arrayContaining([heroA, heroB]));

    const castBody = await a.fight({
      rc: "castSpell",
      srcType: 1,
      srcId: 2,
      sq: 6,
    });
    if (castBody.length !== 0) throw new Error("castSpell must return an empty body");
    const meleeA = await a.pollFight();
    expect(fightEventTypes(meleeA)).toEqual(expect.arrayContaining(["attackwait", "cast"]));
    expect(fightEventTypes(meleeA)).not.toContain("attacknow");
    const waitingB = await b.pollFight();
    expect(fightEventTypes(waitingB)).not.toContain("attacknow");
    expect(fightEventTypes(waitingB)).not.toContain("oppnew");
    await harness.elapseCombat(1400);
    await a.pollFight();
    await harness.elapseCombat(1100);
    await a.pollFight();
    await strikeUntilHuntFinish(a, (ms) => harness.elapseCombat(ms), 7, b);
    await a.pollEsrv();
    expect(huntBotFromEsrv(await b.pollEsrv(), "503").fight_id).toBe(IDLE_HUNT_FIGHT_ID);
  });

  it("returns 203 when the joiner is already in the fight or in another area", async () => {
    const a = await createIsolatedHero(application);
    const b = await createIsolatedHero(application);
    const start = await a.objectAction({
      object: "common",
      action: "object",
      form: { code: "ATTACK_BOT", bot_id: MAP_HUNT_SPAWN_ID },
      sq: 4,
    });
    expect(start["common|action"]).toEqual({ status: 100 });
    const join = await b.objectAction({
      object: "common",
      action: "object",
      form: { code: "ATTACK_BOT", bot_id: MAP_HUNT_SPAWN_ID },
      sq: 4,
    });
    expect(join["common|action"]).toEqual({ status: 100 });
    const again = await b.objectAction({
      object: "common",
      action: "object",
      form: { code: "ATTACK_BOT", bot_id: MAP_HUNT_SPAWN_ID },
      sq: 5,
    });
    expect(again["common|action"]).toEqual({ status: 203, error: "уже в бою" });

    const c = await createIsolatedHero(application);
    const away = await c.objectAction({
      object: "common",
      action: "object",
      form: { code: "COME_IN", area_id: 504 },
      sq: 2,
    });
    expect(away["common|action"]).toEqual({ status: 100, action: "COME_IN" });
    const otherArea = await c.objectAction({
      object: "common",
      action: "object",
      form: { code: "ATTACK_BOT", bot_id: MAP_HUNT_SPAWN_ID },
      sq: 3,
    });
    expect(otherArea["common|action"]).toMatchObject({ status: 203 });
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
