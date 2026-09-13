import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import type { AmfValue } from "../../src/modules/jugger-wire/amf/amf3.ts";
import { AuthenticatedClient } from "../support/harness/authenticated-client.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";
import { FakeClock } from "../support/fake-clock.ts";
import { ManualCombatDelay } from "../support/fakes/manual-combat-delay.ts";
import { finishStartedMeleeHunt } from "../support/harness/complete-melee-hunt.ts";
import {
  bagItemByArtikulId,
  heroIdFrom,
  personalEsrvObject,
} from "../support/harness/wire-payload.ts";
import { uniqueDevelopmentSlot } from "../support/harness/unique-development-slot.ts";
import { dungeonHuntId } from "../../src/modules/instance/domain/dungeon-hunt-id.ts";

const START_MS = 1_700_000_000_000;
const LEVEL11_EXP = 78_323;
const PIT_STRIKES = 150;
const PIT_DURATION_MS = 43_200_000;

describe("dungeon clear bar coins and personal loot", () => {
  let harness: ApplicationHarness;
  let application: Application;
  let clock: FakeClock;

  beforeEach(async () => {
    clock = new FakeClock(START_MS);
    harness = new ApplicationHarness(clock, new ManualCombatDelay(), {
      combatBotStrength: 1,
      combatRules: { strPerDamagePoint: 1 },
    });
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("denies level 1 and lets level 11 enter the pit with progress 0", async () => {
    const low = await AuthenticatedClient.login(application);
    const lowInit = await low.objectAction({ object: "common", action: "init", sq: 1 });
    await application.characterLocation.setArea({
      characterId: heroIdFrom(lowInit),
      areaId: "510",
      moveReadyAt: null,
      instanceCopyId: null,
    });
    const denied = await low.objectAction({
      object: "common",
      action: "action",
      form: { code: "COME_IN", area_id: 544 },
      sq: 3,
    });
    expect(denied["common|action"]).toEqual({
      status: 204,
      error: "Вход в данный инстанс доступен персонажам с 11 уровня!",
    });

    const entered = await enterPit(application, clock);
    expect(entered.payload["common|instance_conf"]).toEqual({
      artikul_id: "2",
      progress_finish_value: "7",
      progress_value: 0,
      status: 100,
    });
    expect(objectBlock(entered.payload.state).area_id).toBe("544");
  });

  it("keeps ogre instance_conf without progress fields", async () => {
    const client = await AuthenticatedClient.login(application, uniqueDevelopmentSlot());
    const init = await client.objectAction({ object: "common", action: "init", sq: 1 });
    await grantLevel(application, heroIdFrom(init), 202, 3);
    await walkToGorge(client, 2);
    clock.advanceSeconds(15);
    const entered = await client.objectAction({
      object: "common",
      action: "action",
      form: { code: "COME_IN", area_id: 542 },
      sq: 4,
    });
    expect(entered["common|instance_conf"]).toEqual({ artikul_id: "1", status: 100 });
    expect(entered["common|instance_conf"]).not.toHaveProperty("progress_finish_value");
    expect(entered["common|instance_conf"]).not.toHaveProperty("progress_value");
  });

  it("ticks the pit bar after a trash win and keeps killed_spawns across reconnect", async () => {
    const entered = await enterPit(application, clock);
    const huntId = dungeonHuntId(copyIdFrom(entered.payload), "544_1");
    const start = await entered.session.objectAction({
      object: "common",
      action: "object",
      form: { code: "ATTACK_BOT", bot_id: huntId },
      sq: 5,
    });
    await finishStartedMeleeHunt(
      entered.session,
      dungeonFightIdFrom(start),
      (ms) => harness.elapseCombat(ms),
      6,
      PIT_STRIKES,
    );
    const esrv = personalEsrvObject(await entered.session.pollEsrv());
    expect(esrv["common|instance_conf"]).toEqual({
      artikul_id: "2",
      progress_finish_value: "7",
      progress_value: 1,
      status: 100,
    });
    expect(esrv["fight|loot"]).toMatchObject({ loot: [] });

    application = await harness.restart();
    const again = new AuthenticatedClient(application, entered.session.cookie);
    const init2 = await again.objectAction({ object: "common", action: "init2", sq: 21 });
    expect(objectBlock(init2.state).area_id).toBe("544");
    const bots = objectBlock(init2["common|hunt"]).bots;
    if (!Array.isArray(bots)) throw new Error("pit hunt list is missing");
    expect(bots.map((bot) => objectBlock(bot).id)).not.toContain(huntId);
    expect(bots).toHaveLength(6);
    clock.advanceSeconds(30);
    const exited = await again.objectAction({
      object: "common",
      action: "action",
      form: { code: "COME_IN", area_id: 510 },
      sq: 22,
    });
    expect(objectBlock(exited.state).area_id).toBe("510");
    clock.advanceSeconds(30);
    const rejoined = await again.objectAction({
      object: "common",
      action: "action",
      form: { code: "COME_IN", area_id: 544 },
      sq: 23,
    });
    expect(rejoined["common|instance_conf"]).toEqual({
      artikul_id: "2",
      progress_finish_value: "7",
      progress_value: 1,
      status: 100,
    });
  });

  it("grants pit coins on boss win from the current progress total", async () => {
    const entered = await enterPit(application, clock);
    const sq = await equipStarterGear(entered.session, 5);
    const huntId = dungeonHuntId(copyIdFrom(entered.payload), "boss");
    const start = await entered.session.objectAction({
      object: "common",
      action: "object",
      form: { code: "ATTACK_BOT", bot_id: huntId },
      sq,
    });
    await finishStartedMeleeHunt(
      entered.session,
      dungeonFightIdFrom(start),
      (ms) => harness.elapseCombat(ms),
      sq + 1,
      PIT_STRIKES,
    );
    const esrv = personalEsrvObject(await entered.session.pollEsrv());
    expect(esrv["common|instance_conf"]).toEqual({
      artikul_id: "2",
      progress_finish_value: "7",
      progress_value: 1,
      status: 100,
    });
    expect(esrv["fight|loot"]).toMatchObject({
      experience: 200,
      loot: { "5986": { artikul_id: 5986, amount: 4 } },
    });
    const bag = await entered.session.objectAction({ object: "user", action: "bag", sq: 40 });
    expect(bagItemByArtikulId(bag, 5986).cnt).toBe(4);
  });

  it("grants ogre personal 2371 to team-1 on boss win", async () => {
    const client = await AuthenticatedClient.login(application, uniqueDevelopmentSlot());
    const init = await client.objectAction({ object: "common", action: "init", sq: 1 });
    const characterId = heroIdFrom(init);
    await grantLevel(application, characterId, 202, 3);
    const powered = await application.characterProgression.grantExperience({
      characterId,
      operationId: `dng3:${characterId}:ogre-kill`,
      amount: 12_000,
    });
    if (powered.levelAfter < 8) {
      throw new Error(`Expected level 8+ to finish the ogre, got ${powered.levelAfter}`);
    }
    await walkToGorge(client, 2);
    clock.advanceSeconds(15);
    const entered = await client.objectAction({
      object: "common",
      action: "action",
      form: { code: "COME_IN", area_id: 542 },
      sq: 4,
    });
    const start = await client.objectAction({
      object: "common",
      action: "object",
      form: { code: "ATTACK_BOT", bot_id: huntBotId(entered) },
      sq: 5,
    });
    await finishStartedMeleeHunt(
      client,
      dungeonFightIdFrom(start),
      (ms) => harness.elapseCombat(ms),
      6,
    );
    const esrv = personalEsrvObject(await client.pollEsrv());
    expect(esrv["fight|loot"]).toMatchObject({
      loot: { "2371": { artikul_id: 2371, amount: 1 } },
    });
    const bag = await client.objectAction({ object: "user", action: "bag", sq: 20 });
    expect(bagItemByArtikulId(bag, 2371).cnt).toBe(1);
  });

  it("keeps a live pit fight through TTL and kicks after finish", async () => {
    const entered = await enterPit(application, clock);
    const huntId = dungeonHuntId(copyIdFrom(entered.payload), "544_1");
    const start = await entered.session.objectAction({
      object: "common",
      action: "object",
      form: { code: "ATTACK_BOT", bot_id: huntId },
      sq: 5,
    });
    expect(objectBlock(objectBlock(start["fight|conf"]).conf).fightId).toMatch(/^[1-9][0-9]*$/);
    await harness.elapseCombat(PIT_DURATION_MS + 15_000);
    const still = await entered.session.objectAction({ object: "common", action: "init2", sq: 8 });
    expect(objectBlock(still.state).area_id).toBe("544");
    expect(objectBlock(still.state).instance).toBe(1);
    await finishStartedMeleeHunt(
      entered.session,
      dungeonFightIdFrom(start),
      (ms) => harness.elapseCombat(ms),
      9,
      PIT_STRIKES,
    );
    await entered.session.pollEsrv();
    const kicked = await entered.session.objectAction({
      object: "common",
      action: "init2",
      sq: 21,
    });
    expect(objectBlock(kicked.state).area_id).toBe("510");
    expect(objectBlock(kicked.state).instance).toBe(0);
  });
});

async function enterPit(
  application: Application,
  clock: FakeClock,
): Promise<
  Readonly<{
    session: AuthenticatedClient;
    payload: Record<string, AmfValue>;
    characterId: number;
  }>
> {
  const client = await AuthenticatedClient.login(application, uniqueDevelopmentSlot());
  const init = await client.objectAction({ object: "common", action: "init", sq: 1 });
  const characterId = heroIdFrom(init);
  await grantLevel(application, characterId, LEVEL11_EXP, 11);
  await application.characterLocation.setArea({
    characterId,
    areaId: "510",
    moveReadyAt: null,
    instanceCopyId: null,
  });
  clock.advanceSeconds(15);
  const payload = await client.objectAction({
    object: "common",
    action: "action",
    form: { code: "COME_IN", area_id: 544 },
    sq: 4,
  });
  expect(objectBlock(payload.state).area_id).toBe("544");
  return { session: client, payload, characterId };
}

const STARTER_GEAR = [9095, 20, 21, 26] as const;

async function equipStarterGear(
  client: AuthenticatedClient,
  sequenceStart: number,
): Promise<number> {
  const bag = await client.objectAction({ object: "user", action: "bag", sq: sequenceStart });
  let sq = sequenceStart + 1;
  for (const artikulId of STARTER_GEAR) {
    const itemId = bagItemByArtikulId(bag, artikulId).id;
    if (typeof itemId !== "number" || !Number.isInteger(itemId) || itemId < 1) {
      throw new Error(`starter gear ${artikulId} item id is missing`);
    }
    await client.objectAction({
      object: "common",
      action: "object",
      form: { code: "PUT_ON", artifact_id: itemId },
      sq,
    });
    sq += 1;
  }
  return sq;
}

async function grantLevel(
  application: Application,
  characterId: number,
  amount: number,
  expected: number,
): Promise<void> {
  const granted = await application.characterProgression.grantExperience({
    characterId,
    operationId: `dng3:${characterId}:${amount}`,
    amount,
  });
  if (granted.levelAfter !== expected) {
    throw new Error(`Expected level ${expected} after ${amount} EXP, got ${granted.levelAfter}`);
  }
}

async function walkToGorge(client: AuthenticatedClient, sq: number): Promise<void> {
  const gorge = await client.objectAction({
    object: "common",
    action: "action",
    form: { code: "COME_IN", area_id: 501 },
    sq,
  });
  expect(objectBlock(gorge.state).area_id).toBe("501");
}

function copyIdFrom(payload: Record<string, AmfValue>): number {
  const pop = objectBlock(payload["chat|area_population"]).population;
  if (!Array.isArray(pop) || !pop[0]) throw new Error("area population is missing");
  const id = objectBlock(pop[0]).instance_id;
  if (typeof id !== "number" || id < 1) throw new Error("instance copy id is missing");
  return id;
}

function huntBotId(payload: Record<string, AmfValue>): number {
  const bots = objectBlock(payload["common|hunt"]).bots;
  if (!Array.isArray(bots) || !bots[0]) throw new Error("dungeon hunt list is empty");
  const id = objectBlock(bots[0]).id;
  if (typeof id !== "number" || id < 1) throw new Error("dungeon hunt id is missing");
  return id;
}

function dungeonFightIdFrom(payload: Record<string, AmfValue>): string {
  const fightId = objectBlock(objectBlock(payload["fight|conf"]).conf).fightId;
  if (typeof fightId !== "string" || !/^[1-9][0-9]*$/.test(fightId)) {
    throw new Error("dungeon fightId is missing");
  }
  return fightId;
}

function objectBlock(value: AmfValue | undefined): Record<string, AmfValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("expected object block");
  }
  return value;
}
