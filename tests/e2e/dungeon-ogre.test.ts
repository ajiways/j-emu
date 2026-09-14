import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import type { AmfValue } from "../../src/modules/jugger-wire/amf/amf3.ts";
import { AuthenticatedClient } from "../support/harness/authenticated-client.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";
import { FakeClock } from "../support/fake-clock.ts";
import { ManualCombatDelay } from "../support/fakes/manual-combat-delay.ts";
import { finishStartedMeleeHunt } from "../support/harness/complete-melee-hunt.ts";
import { heroIdFrom } from "../support/harness/wire-payload.ts";
import { uniqueDevelopmentSlot } from "../support/harness/unique-development-slot.ts";
import { dungeonHuntId } from "../../src/modules/instance/domain/dungeon-hunt-id.ts";
import type { RandomSource } from "../../src/modules/combat/domain/random-source.ts";

const START_MS = 1_700_000_000_000;
const LEVEL3_EXP = 202;

const meleeOnlyBotRandom: RandomSource = {
  integer(minInclusive, maxInclusive) {
    if (minInclusive > maxInclusive) {
      throw new Error(`Random range ${minInclusive}..${maxInclusive} is invalid`);
    }
    return minInclusive;
  },
  unit() {
    return 0;
  },
};

describe("dungeon ogre cave", () => {
  let harness: ApplicationHarness;
  let application: Application;
  let clock: FakeClock;

  beforeEach(async () => {
    clock = new FakeClock(START_MS);
    harness = new ApplicationHarness(clock, new ManualCombatDelay(), {
      combatBotStrength: 1,
      combatRules: { strPerDamagePoint: 1 },
      combatRandom: meleeOnlyBotRandom,
    });
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("denies level 1 and lets level 3 create a copy with party chrome", async () => {
    const low = await AuthenticatedClient.login(application);
    await low.objectAction({ object: "common", action: "init", sq: 1 });
    await walkToGorge(low, 2);
    clock.advanceSeconds(15);
    const denied = await low.objectAction({
      object: "common",
      action: "action",
      form: { code: "COME_IN", area_id: 542 },
      sq: 4,
    });
    expect(denied["common|action"]).toEqual({
      status: 204,
      error: "Вход в данный инстанс доступен персонажам с 3 уровня!",
    });

    const client = await AuthenticatedClient.login(application, uniqueDevelopmentSlot());
    const init = await client.objectAction({ object: "common", action: "init", sq: 1 });
    await grantLevel3(application, heroIdFrom(init));
    await walkToGorge(client, 2);
    clock.advanceSeconds(15);
    const entered = await client.objectAction({
      object: "common",
      action: "action",
      form: { code: "COME_IN", area_id: 542 },
      sq: 4,
    });
    expect(entered["common|action"]).toEqual({ status: 100, action: "COME_IN" });
    expect(objectBlock(entered.state).area_id).toBe("542");
    expect(objectBlock(entered.state).instance).toBe(1);
    expect(entered["common|instance_conf"]).toEqual({ artikul_id: "1", status: 100 });
    expect(entered["party|create"]).toEqual({ status: 100 });
    expect(objectBlock(entered["party|members"]).status).toBe(100);
    const hunt = objectBlock(entered["common|hunt"]);
    const bots = hunt.bots;
    if (!Array.isArray(bots) || bots.length !== 1) throw new Error("ogre hunt list is missing");
    const ogre = objectBlock(bots[0]);
    expect(ogre.artikul_id).toBe(99);
    expect(ogre.id).toBe(dungeonHuntId(copyIdFrom(entered), "ogre"));
    const pop = objectBlock(entered["chat|area_population"]).population;
    if (!Array.isArray(pop) || pop.length !== 1) throw new Error("copy population must be solo");
    expect(objectBlock(pop[0]).instance_id).toBe(copyIdFrom(entered));
  });

  it("keeps the bind on exit and rejoins the same live copy", async () => {
    const client = await enterOgre(application, clock);
    const firstCopy = copyIdFrom(client.entered);
    clock.advanceSeconds(30);
    const left = await client.session.objectAction({
      object: "common",
      action: "action",
      form: { code: "COME_IN", area_id: 501 },
      sq: 5,
    });
    expect(objectBlock(left.state).area_id).toBe("501");
    expect(objectBlock(left.state).instance).toBe(0);
    expect(left["common|instance_conf"]).toBeUndefined();
    clock.advanceSeconds(15);
    const again = await client.session.objectAction({
      object: "common",
      action: "action",
      form: { code: "COME_IN", area_id: 542 },
      sq: 6,
    });
    expect(objectBlock(again.state).area_id).toBe("542");
    expect(objectBlock(again.state).instance).toBe(1);
    expect(copyIdFrom(again)).toBe(firstCopy);
    expect(again["party|create"]).toBeUndefined();
  });

  it("kills the ogre without outdoor respawn and isolates two copies", async () => {
    const a = await enterOgre(application, clock);
    await grantOgreKillPower(application, a.characterId);
    const slotB = uniqueDevelopmentSlot();
    const clientB = await AuthenticatedClient.login(application, slotB);
    const initB = await clientB.objectAction({ object: "common", action: "init", sq: 1 });
    await grantLevel3(application, heroIdFrom(initB));
    await walkToGorge(clientB, 2);
    clock.advanceSeconds(15);
    const enteredB = await clientB.objectAction({
      object: "common",
      action: "action",
      form: { code: "COME_IN", area_id: 542 },
      sq: 4,
    });
    expect(copyIdFrom(enteredB)).not.toBe(copyIdFrom(a.entered));
    expect(populationCount(enteredB)).toBe(1);

    const huntId = huntBotId(a.entered);
    const start = await a.session.objectAction({
      object: "common",
      action: "object",
      form: { code: "ATTACK_BOT", bot_id: huntId },
      sq: 5,
    });
    expect(objectBlock(objectBlock(start["fight|conf"]).conf).can_leave).toBe(0);
    expect(objectBlock(objectBlock(start["fight|conf"]).conf).instance_id).toBe(
      String(copyIdFrom(a.entered)),
    );
    await finishStartedMeleeHunt(
      a.session,
      dungeonFightIdFrom(start),
      (ms) => harness.elapseCombat(ms),
      6,
    );
    await a.session.pollEsrv();
    application = await harness.restart();
    const again = new AuthenticatedClient(application, a.session.cookie);
    const init2 = await again.objectAction({ object: "common", action: "init2", sq: 21 });
    expect(objectBlock(init2.state).area_id).toBe("542");
    const hunt = objectBlock(init2["common|hunt"]);
    expect(hunt.bots).toEqual([]);
  });

  it("kicks expired occupants back to 501 and fail-fasts the bind", async () => {
    const client = await enterOgre(application, clock);
    await harness.elapseCombat(3_600_000 + 15_000);
    const init2 = await client.session.objectAction({ object: "common", action: "init2", sq: 21 });
    expect(objectBlock(init2.state).area_id).toBe("501");
    expect(objectBlock(init2.state).instance).toBe(0);
    clock.advanceSeconds(15);
    const denied = await client.session.objectAction({
      object: "common",
      action: "action",
      form: { code: "COME_IN", area_id: 542 },
      sq: 22,
    });
    expect(denied["common|action"]).toEqual({
      status: 2,
      error: "Время жизни инстанса истекло. Дождитесь сброса сервера.",
    });
  });
});

async function grantLevel3(application: Application, characterId: number): Promise<void> {
  const granted = await application.characterProgression.grantExperience({
    characterId,
    operationId: `dng:${characterId}:l3`,
    amount: LEVEL3_EXP,
  });
  if (granted.levelAfter !== 3) {
    throw new Error(`Expected level 3 after ${LEVEL3_EXP} EXP, got ${granted.levelAfter}`);
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

async function grantOgreKillPower(application: Application, characterId: number): Promise<void> {
  const granted = await application.characterProgression.grantExperience({
    characterId,
    operationId: `dng:${characterId}:ogre-kill`,
    amount: 12_000,
  });
  if (granted.levelAfter < 8) {
    throw new Error(`Expected level 8+ to finish the 270 HP ogre, got ${granted.levelAfter}`);
  }
}

async function enterOgre(
  application: Application,
  clock: FakeClock,
): Promise<
  Readonly<{ session: AuthenticatedClient; entered: Record<string, AmfValue>; characterId: number }>
> {
  const client = await AuthenticatedClient.login(application, uniqueDevelopmentSlot());
  const init = await client.objectAction({ object: "common", action: "init", sq: 1 });
  const characterId = heroIdFrom(init);
  await grantLevel3(application, characterId);
  await walkToGorge(client, 2);
  clock.advanceSeconds(15);
  const entered = await client.objectAction({
    object: "common",
    action: "action",
    form: { code: "COME_IN", area_id: 542 },
    sq: 4,
  });
  expect(objectBlock(entered.state).area_id).toBe("542");
  return { session: client, entered, characterId };
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

function populationCount(payload: Record<string, AmfValue>): number {
  const pop = objectBlock(payload["chat|area_population"]).population;
  if (!Array.isArray(pop)) throw new Error("area population is missing");
  return pop.length;
}

function objectBlock(value: AmfValue | undefined): Record<string, AmfValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("expected object block");
  }
  return value;
}
