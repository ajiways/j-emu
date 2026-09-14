import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import type { AmfValue } from "../../src/modules/jugger-wire/amf/amf3.ts";
import {
  AuthenticatedClient,
  createIsolatedHero,
} from "../support/harness/authenticated-client.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";
import { FakeClock } from "../support/fake-clock.ts";
import { ManualCombatDelay } from "../support/fakes/manual-combat-delay.ts";
import {
  putOnStarterGloveIfInBag,
  strikeUntilHuntFinish,
} from "../support/harness/complete-melee-hunt.ts";
import { MAP_HUNT_SPAWN_ID } from "../support/harness/map-hunt-spawn.ts";
import { uniqueDevelopmentSlot } from "../support/harness/unique-development-slot.ts";
import {
  fightEventTypes,
  framesIncludeFightFinish,
  heroIdFrom,
  huntFightIdFrom,
  personalEsrvObject,
} from "../support/harness/wire-payload.ts";

const START_MS = 1_700_000_000_000;
const LEVEL3_EXP = 202;

describe("hunt fight join team 2", () => {
  let harness: ApplicationHarness;
  let application: Application;

  beforeEach(async () => {
    harness = new ApplicationHarness(undefined, undefined, {
      combatBotStrength: 1,
      combatRules: { strPerDamagePoint: 1 },
    });
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("joins 50310 via JOIN team 2, HELP on team 2, and occupied ATTACK_BOT as team 1", async () => {
    const a = await createIsolatedHero(application);
    const b = await createIsolatedHero(application);
    const c = await createIsolatedHero(application);
    const d = await createIsolatedHero(application);
    const initA = await a.objectAction({ object: "common", action: "init", sq: 1 });
    const initB = await b.objectAction({ object: "common", action: "init", sq: 1 });
    const initC = await c.objectAction({ object: "common", action: "init", sq: 1 });
    const initD = await d.objectAction({ object: "common", action: "init", sq: 1 });
    const heroA = heroIdFrom(initA);
    const heroB = heroIdFrom(initB);
    const heroC = heroIdFrom(initC);
    const heroD = heroIdFrom(initD);
    const nickC = requireNick(initC);
    const start = await a.objectAction({
      object: "common",
      action: "object",
      form: { code: "ATTACK_BOT", bot_id: MAP_HUNT_SPAWN_ID },
      sq: 2,
    });
    expect(start["common|action"]).toEqual({ status: 100 });
    const fightId = huntFightIdFrom(start);
    expect(await a.fight({ rc: "auth", eid: fightId, sq: 3 })).toHaveLength(0);
    await a.pollFight();

    const occupied = await b.objectAction({
      object: "common",
      action: "object",
      form: { code: "ATTACK_BOT", bot_id: MAP_HUNT_SPAWN_ID },
      sq: 2,
    });
    expect(occupied["common|action"]).toEqual({ status: 100 });
    expect(huntFightIdFrom(occupied)).toBe(fightId);
    expect(await b.fight({ rc: "auth", eid: fightId, sq: 3 })).toHaveLength(0);
    expect(fightPersTeam(await b.pollFight(), heroB)).toBe(1);

    const joined = await c.objectAction({
      object: "common",
      action: "object",
      form: { code: "FIGHT_JOIN", fight: fightId, team: 2 },
      sq: 2,
    });
    expect(joined["common|action"]).toEqual({ status: 100 });
    expect(huntFightIdFrom(joined)).toBe(fightId);
    expect(await c.fight({ rc: "auth", eid: fightId, sq: 3 })).toHaveLength(0);
    const bootstrapC = await c.pollFight();
    expect(fightPersTeam(bootstrapC, heroC)).toBe(2);
    expect(fightEventTypes(bootstrapC)).toEqual(expect.arrayContaining(["oppwait", "oppnew"]));
    expect(fightEventTypes(bootstrapC)).not.toContain("attacknow");
    expect(framesIncludeHumanOppNew(bootstrapC)).toBe(true);

    const helped = await d.objectAction({
      object: "common",
      action: "object",
      form: { code: "FIGHT_HELP", nick: nickC },
      sq: 2,
    });
    expect(helped["common|action"]).toEqual({ status: 100 });
    expect(huntFightIdFrom(helped)).toBe(fightId);
    expect(await d.fight({ rc: "auth", eid: fightId, sq: 3 })).toHaveLength(0);
    const bootstrapD = await d.pollFight();
    expect(fightPersTeam(bootstrapD, heroD)).toBe(2);
    expect(fightPersTeam(bootstrapD, heroA)).toBe(1);
    expect(fightPersTeam(bootstrapD, heroB)).toBe(1);
    expect(fightPersTeam(bootstrapD, heroC)).toBe(2);
  });

  it("denies JOIN into a quest fight with the current quest text", async () => {
    const hunter = await createIsolatedHero(application);
    const joiner = await createIsolatedHero(application);
    await hunter.objectAction({ object: "common", action: "init", sq: 1 });
    await joiner.objectAction({ object: "common", action: "init", sq: 1 });
    const sq = await putOnStarterGloveIfInBag(hunter, 2);
    const started = await acceptQuest(hunter, 2, sq);
    const fightId = huntFightIdFrom(started);
    const denied = await joiner.objectAction({
      object: "common",
      action: "object",
      form: { code: "FIGHT_JOIN", fight: fightId, team: 2 },
      sq: 2,
    });
    expect(denied["common|action"]).toEqual({
      status: 204,
      error: "нельзя вмешаться в квестовый бой",
    });
  });

  it("lets team 2 continue vs team 1 after Gryzl dies and skips hunt EXP", async () => {
    const a = await createIsolatedHero(application);
    const b = await createIsolatedHero(application);
    await a.objectAction({ object: "common", action: "init", sq: 1 });
    await b.objectAction({ object: "common", action: "init", sq: 1 });
    const sqA = await putOnStarterGloveIfInBag(a, 2);
    const sqB = await putOnStarterGloveIfInBag(b, 2);
    const start = await a.objectAction({
      object: "common",
      action: "object",
      form: { code: "ATTACK_BOT", bot_id: MAP_HUNT_SPAWN_ID },
      sq: sqA,
    });
    const fightId = huntFightIdFrom(start);
    expect(await a.fight({ rc: "auth", eid: fightId, sq: sqA + 1 })).toHaveLength(0);
    await a.pollFight();
    const joined = await b.objectAction({
      object: "common",
      action: "object",
      form: { code: "FIGHT_JOIN", fight: fightId, team: 2 },
      sq: sqB,
    });
    expect(joined["common|action"]).toEqual({ status: 100 });
    expect(await b.fight({ rc: "auth", eid: fightId, sq: sqB + 1 })).toHaveLength(0);
    await b.pollFight();
    await a.pollFight();
    let retargeted = false;
    for (let strike = 0; strike < 40 && !retargeted; strike += 1) {
      const castBody = await a.fight({
        rc: "castSpell",
        srcType: 1,
        srcId: 2,
        sq: sqA + 2 + strike,
      });
      if (castBody.length !== 0) throw new Error("castSpell must return an empty body");
      const melee = await a.pollFight();
      expect(framesIncludeFightFinish(melee)).toBe(false);
      if (framesIncludeHumanOppNew(melee)) {
        const waiting = await b.pollFight();
        expect(framesIncludeFightFinish(waiting)).toBe(false);
        expect(framesIncludeHumanOppNew(waiting)).toBe(true);
        retargeted = true;
        break;
      }
      await harness.elapseCombat(1400);
      const bot = await a.pollFight();
      expect(framesIncludeFightFinish(bot)).toBe(false);
      await harness.elapseCombat(1100);
      await a.pollFight();
    }
    expect(retargeted).toBe(true);
    await harness.elapseCombat(2500);
    const granted = await b.pollFight();
    expect(fightEventTypes(granted)).toEqual(expect.arrayContaining(["attacknow"]));
    await strikeUntilHuntFinish(b, (ms) => harness.elapseCombat(ms), sqB + 2, a);
    const lootB = personalEsrvObject(await b.pollEsrv())["fight|loot"];
    expect(lootB).toMatchObject({ experience: 0 });
  });

  it("returns stale 204 JOIN after process restart", async () => {
    const a = await createIsolatedHero(application);
    const b = await createIsolatedHero(application);
    await a.objectAction({ object: "common", action: "init", sq: 1 });
    await b.objectAction({ object: "common", action: "init", sq: 1 });
    const start = await a.objectAction({
      object: "common",
      action: "object",
      form: { code: "ATTACK_BOT", bot_id: MAP_HUNT_SPAWN_ID },
      sq: 2,
    });
    const fightId = huntFightIdFrom(start);
    const joined = await b.objectAction({
      object: "common",
      action: "object",
      form: { code: "FIGHT_JOIN", fight: fightId, team: 2 },
      sq: 2,
    });
    expect(joined["common|action"]).toEqual({ status: 100 });
    application = await harness.restart();
    const again = new AuthenticatedClient(application, b.cookie);
    const stale = await again.objectAction({
      object: "common",
      action: "object",
      form: { code: "FIGHT_JOIN", fight: fightId, team: 2 },
      sq: 20,
    });
    expect(stale["common|action"]).toEqual({
      status: 204,
      error: "Нельзя вмешаться в неактивный бой!",
    });
  });
});

describe("hunt fight join parallel duels", () => {
  let harness: ApplicationHarness;
  let application: Application;

  beforeEach(async () => {
    harness = new ApplicationHarness(undefined, undefined, {
      combatBotStrength: 1,
    });
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("keeps opener vs Gryzl live after JOIN team 2 pairs with the team-1 waiter", async () => {
    const a = await createIsolatedHero(application);
    const b = await createIsolatedHero(application);
    const c = await createIsolatedHero(application);
    await a.objectAction({ object: "common", action: "init", sq: 1 });
    await b.objectAction({ object: "common", action: "init", sq: 1 });
    await c.objectAction({ object: "common", action: "init", sq: 1 });
    const start = await a.objectAction({
      object: "common",
      action: "object",
      form: { code: "ATTACK_BOT", bot_id: MAP_HUNT_SPAWN_ID },
      sq: 2,
    });
    const fightId = huntFightIdFrom(start);
    expect(await a.fight({ rc: "auth", eid: fightId, sq: 3 })).toHaveLength(0);
    await a.pollFight();
    const occupied = await b.objectAction({
      object: "common",
      action: "object",
      form: { code: "ATTACK_BOT", bot_id: MAP_HUNT_SPAWN_ID },
      sq: 2,
    });
    expect(huntFightIdFrom(occupied)).toBe(fightId);
    expect(await b.fight({ rc: "auth", eid: fightId, sq: 3 })).toHaveLength(0);
    await b.pollFight();
    const joined = await c.objectAction({
      object: "common",
      action: "object",
      form: { code: "FIGHT_JOIN", fight: fightId, team: 2 },
      sq: 2,
    });
    expect(joined["common|action"]).toEqual({ status: 100 });
    expect(await c.fight({ rc: "auth", eid: fightId, sq: 3 })).toHaveLength(0);
    const bootstrapC = await c.pollFight();
    expect(framesIncludeHumanOppNew(bootstrapC)).toBe(true);
    expect(fightEventTypes(bootstrapC)).not.toContain("attacknow");
    expect(framesIncludeFightFinish(bootstrapC)).toBe(false);
    await a.pollFight();
    await b.pollFight();
    expect(await a.fight({ rc: "castSpell", srcType: 1, srcId: 2, sq: 4 })).toHaveLength(0);
    const melee = await a.pollFight();
    expect(framesIncludeFightFinish(melee)).toBe(false);
    expect(fightEventTypes(melee)).toEqual(expect.arrayContaining(["attackwait", "cast"]));
    await harness.elapseCombat(1400);
    const bot = await a.pollFight();
    expect(framesIncludeFightFinish(bot)).toBe(false);
    expect(fightEventTypes(bot)).toContain("cast");
    await harness.elapseCombat(1100);
    const grantedB = await b.pollFight();
    expect(fightEventTypes(grantedB)).toEqual(expect.arrayContaining(["attacknow"]));
    expect(framesIncludeFightFinish(grantedB)).toBe(false);
    const grantedA = await a.pollFight();
    expect(fightEventTypes(grantedA)).toEqual(expect.arrayContaining(["attacknow"]));
    expect(framesIncludeFightFinish(grantedA)).toBe(false);
  });
});

describe("hunt fight join copy isolation", () => {
  let harness: ApplicationHarness;
  let application: Application;
  let clock: FakeClock;

  beforeEach(async () => {
    clock = new FakeClock(START_MS);
    harness = new ApplicationHarness(clock, new ManualCombatDelay(), {
      combatBotStrength: 1,
    });
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("isolates FIGHT_JOIN across two copies of 542", async () => {
    const a = await enterOgre(application, clock);
    const huntId = huntBotId(a.entered);
    const start = await a.session.objectAction({
      object: "common",
      action: "object",
      form: { code: "ATTACK_BOT", bot_id: huntId },
      sq: 5,
    });
    expect(start["common|action"]).toEqual({ status: 100 });
    const fightId = dungeonFightIdFrom(start);
    const b = await enterOgre(application, clock);
    expect(copyIdFrom(b.entered)).not.toBe(copyIdFrom(a.entered));
    const denied = await b.session.objectAction({
      object: "common",
      action: "object",
      form: { code: "FIGHT_JOIN", fight: fightId, team: 2 },
      sq: 5,
    });
    expect(denied["common|action"]).toEqual({
      status: 204,
      error: "Нельзя вмешаться в бой, находящийся в другой локации!",
    });
  });
});

async function acceptQuest(
  client: AuthenticatedClient,
  pointId: number,
  sq: number,
): Promise<Record<string, AmfValue>> {
  const opened = await client.objectAction({
    object: "npc",
    action: "answer",
    ref: 271,
    form: { point_id: pointId, answer_id: 0 },
    sq,
  });
  expect(objectBlock(opened["npc|answer"]).status).toBe(100);
  const accepted = await client.objectAction({
    object: "npc",
    action: "answer",
    ref: 271,
    form: { point_id: pointId, answer_id: 1 },
    sq: sq + 1,
  });
  expect(objectBlock(accepted["npc|answer"]).status).toBe(100);
  return accepted;
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
  const granted = await application.characterProgression.grantExperience({
    characterId,
    operationId: `join:${characterId}:l3`,
    amount: LEVEL3_EXP,
  });
  if (granted.levelAfter !== 3) {
    throw new Error(`Expected level 3 after ${LEVEL3_EXP} EXP, got ${granted.levelAfter}`);
  }
  const gorge = await client.objectAction({
    object: "common",
    action: "action",
    form: { code: "COME_IN", area_id: 501 },
    sq: 2,
  });
  expect(objectBlock(gorge.state).area_id).toBe("501");
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

function fightPersTeam(events: readonly AmfValue[], heroId: number): number {
  for (const event of events) {
    if (!event || typeof event !== "object" || Array.isArray(event)) continue;
    const ev = event["ev"];
    if (!ev || typeof ev !== "object" || Array.isArray(ev)) continue;
    for (const item of Object.values(ev)) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      if (item["et"] !== "persList") continue;
      const row = item[String(heroId)];
      if (!row || typeof row !== "object" || Array.isArray(row)) {
        throw new Error(`persList is missing hero ${heroId}`);
      }
      if (row.team !== 1 && row.team !== 2) {
        throw new Error(`persList team for ${heroId} is missing`);
      }
      return row.team;
    }
  }
  throw new Error("persList is missing");
}

function framesIncludeHumanOppNew(events: readonly AmfValue[]): boolean {
  for (const event of events) {
    if (!event || typeof event !== "object" || Array.isArray(event)) continue;
    const ev = event["ev"];
    if (!ev || typeof ev !== "object" || Array.isArray(ev)) continue;
    for (const item of Object.values(ev)) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      if (item["et"] === "oppnew" && item.bot !== true) return true;
    }
  }
  return false;
}

function requireNick(payload: Record<string, AmfValue>): string {
  const conf = objectBlock(payload["user|conf"]);
  if (typeof conf.nick !== "string" || !conf.nick) throw new Error("user|conf.nick missing");
  return conf.nick;
}

function objectBlock(value: AmfValue | undefined): Record<string, AmfValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("expected object block");
  }
  return value;
}
