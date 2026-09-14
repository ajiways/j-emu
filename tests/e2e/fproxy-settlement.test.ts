import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import type { AmfValue } from "../../src/modules/jugger-wire/amf/amf3.ts";
import {
  AuthenticatedClient,
  createIsolatedHero,
} from "../support/harness/authenticated-client.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";
import {
  completeMeleeHunt,
  putOnStarterGloveIfInBag,
  strikeUntilHuntFinish,
} from "../support/harness/complete-melee-hunt.ts";
import { MAP_HUNT_SPAWN_ID } from "../support/harness/map-hunt-spawn.ts";
import { SequenceRandom } from "../support/fakes/sequence-random.ts";
import { playableHuntMeatSettlementDraw } from "../support/playable-bot.ts";
import {
  bagItemByArtikulId,
  heroIdFrom,
  huntFightIdFrom,
  personalEsrvObject,
} from "../support/harness/wire-payload.ts";

describe("fproxy settlement", () => {
  let harness: ApplicationHarness;
  let application: Application;

  beforeEach(async () => {
    harness = new ApplicationHarness(undefined, undefined, {
      lootRandom: new SequenceRandom([0, 0, 0, 0, 0, 0, 0, 0]),
    });
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("rejects RESURRECT when the hero is not ghosted", async () => {
    const client = await AuthenticatedClient.login(application);
    const denied = await client.objectAction({
      object: "common",
      action: "object",
      form: { code: "RESURRECT" },
      sq: 2,
    });
    expect(denied["common|action"]).toEqual({ status: 203, error: "воскрешение недоступно" });
  });

  it("persists a 50310 win across esrv loot-then-exit, reconnect and restart", async () => {
    const client = await AuthenticatedClient.login(application);
    const before = await client.objectAction({ object: "common", action: "init", sq: 1 });
    await completeMeleeHunt(client, (ms) => harness.elapseCombat(ms));
    const esrv = personalEsrvObject(await client.pollEsrv());
    expect(Object.keys(esrv).filter((key) => key.startsWith("fight|"))).toEqual([
      "fight|loot",
      "fight|exit",
    ]);
    expect(esrv["fight|loot"]).toMatchObject({
      status: 100,
      experience: 15,
      money: "0.2",
      honor: 0,
      revenge: 0,
      loot: [],
      artikul_list: [],
    });
    expect(esrv["fight|exit"]).toMatchObject({ status: 100, type: 0, winner: 1 });

    const after = await client.objectAction({ object: "common", action: "init2", sq: 20 });
    expect(stateMoney(after)).toBe("25.20");
    expect(unitframe(after).exp).toBe(16);
    expect(unitframe(after).hp).toBeGreaterThan(0);

    application = await harness.restart();
    const restarted = new AuthenticatedClient(application, client.cookie);
    const again = await restarted.objectAction({ object: "common", action: "init2", sq: 21 });
    expect(stateMoney(again)).toBe("25.20");
    expect(unitframe(again).exp).toBe(16);
    const againInit = await restarted.objectAction({ object: "common", action: "init", sq: 22 });
    expect(heroIdFrom(againInit)).toBe(heroIdFrom(before));
  });

  it("acks leaveFight and sends flee exit without loot", async () => {
    const client = await AuthenticatedClient.login(application);
    const before = await client.objectAction({ object: "common", action: "init", sq: 1 });
    const start = await client.objectAction({
      object: "common",
      action: "object",
      form: { code: "ATTACK_BOT", bot_id: MAP_HUNT_SPAWN_ID },
      sq: 4,
    });
    const fightId = huntFightIdFrom(start);
    expect(await client.fight({ rc: "auth", eid: fightId, sq: 5 })).toHaveLength(0);
    await client.pollFight();
    expect(await client.fight({ rc: "leaveFight", sq: 6 })).toEqual([{ rs: true, sq: 6 }]);
    const esrv = personalEsrvObject(await client.pollEsrv());
    expect(esrv["fight|loot"]).toBeUndefined();
    expect(esrv["fight|exit"]).toEqual({ flee: true, status: 100, type: 2 });
    const after = await client.objectAction({ object: "common", action: "init2", sq: 20 });
    expect(unitframe(after).exp).toBe(1);
    expect(stateMoney(after)).toBe(stateMoney(before));
  });
});

describe("fproxy settlement weighted loot", () => {
  let harness: ApplicationHarness;
  let application: Application;

  beforeEach(async () => {
    harness = new ApplicationHarness(undefined, undefined, {
      lootRandom: new SequenceRandom(playableHuntMeatSettlementDraw()),
    });
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("grants meat 77 when the Gryzl roll lands past NOTHING", async () => {
    const client = await AuthenticatedClient.login(application);
    const before = await client.objectAction({ object: "common", action: "init", sq: 1 });
    expect(bagItemByArtikulId(before, 77).cnt).toBe(4);
    await completeMeleeHunt(client, (ms) => harness.elapseCombat(ms));
    const esrv = personalEsrvObject(await client.pollEsrv());
    expect(esrv["fight|loot"]).toMatchObject({
      status: 100,
      loot: { "77": { artikul_id: 77, amount: 1 } },
    });
    const after = await client.objectAction({ object: "common", action: "init", sq: 20 });
    expect(bagItemByArtikulId(after, 77).cnt).toBe(5);
  });
});

describe("fproxy settlement loss", () => {
  let harness: ApplicationHarness;
  let application: Application;

  beforeEach(async () => {
    harness = new ApplicationHarness(undefined, undefined, {
      lootRandom: new SequenceRandom([0, 0, 0, 0]),
      combatBotStrength: 400,
    });
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("notes HP 0 as ghost, blocks regen, then RESURRECT restores HP", async () => {
    const client = await AuthenticatedClient.login(application);
    const before = await client.objectAction({ object: "common", action: "init", sq: 1 });
    await completeMeleeHunt(client, (ms) => harness.elapseCombat(ms), 4, { equipGlove: false });
    const esrv = personalEsrvObject(await client.pollEsrv());
    expect(esrv["fight|loot"]).toMatchObject({
      experience: 0,
      money: "0",
      loot: [],
      artikul_list: [],
    });
    expect(esrv["fight|exit"]).toMatchObject({ status: 100, type: 0, winner: 2 });
    const after = await client.objectAction({ object: "common", action: "init2", sq: 20 });
    expect(unitframe(after).hp).toBe(0);
    expect(unitframe(after).exp).toBe(1);
    expect(unitframe(after).injury_artikul_id).toBe(875);
    expect(unitframe(after).injury_time).toBeGreaterThan(0);
    expect(stateGhost(after)).toBe(1);
    expect(populationDead(after, client.accountId)).toBe(4);
    expect(stateMoney(after)).toBe(stateMoney(before));

    await harness.elapseCombat(3_600_000);
    const later = await client.objectAction({ object: "common", action: "init2", sq: 21 });
    expect(unitframe(later).hp).toBe(0);
    expect(unitframe(later).injury_time).toBe(unitframe(after).injury_time);

    const living = await client.objectAction({
      object: "common",
      action: "object",
      form: { code: "RESURRECT" },
      sq: 22,
    });
    expect(living["common|action"]).toEqual({ status: 100 });
    expect(unitframe(living).hp).toBe(2);
    expect(unitframe(living).injury_time).toBe(0);
    expect(unitframe(living).injury_artikul_id).toBe(0);
    expect(stateGhost(living)).toBeUndefined();
    expect(populationDead(living, client.accountId)).toBe(0);
    expect(living["common|area_conf"]).toBeTypeOf("object");
    expect(living["common|hunt"]).toBeTypeOf("object");
    expect(living["chat|area_population"]).toBeTypeOf("object");

    const hunt = await client.objectAction({
      object: "common",
      action: "object",
      form: { code: "ATTACK_BOT", bot_id: MAP_HUNT_SPAWN_ID },
      sq: 23,
    });
    expect(hunt["common|action"]).toEqual({ status: 100 });
  });
});

describe("fproxy settlement two hunters and refill", () => {
  let harness: ApplicationHarness;
  let application: Application;

  beforeEach(async () => {
    harness = new ApplicationHarness(undefined, undefined, {
      lootRandom: new SequenceRandom([0, 0, 0, 0, 0, 0, 0, 0]),
    });
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("splits EXP after 3↔3 handoffs and gives loot to the top damager", async () => {
    const a = await createIsolatedHero(application);
    const b = await createIsolatedHero(application);
    await putOnStarterGloveIfInBag(a, 2);
    const start = await a.objectAction({
      object: "common",
      action: "object",
      form: { code: "ATTACK_BOT", bot_id: MAP_HUNT_SPAWN_ID },
      sq: 4,
    });
    const fightId = huntFightIdFrom(start);
    await b.objectAction({
      object: "common",
      action: "object",
      form: { code: "ATTACK_BOT", bot_id: MAP_HUNT_SPAWN_ID },
      sq: 4,
    });
    expect(await a.fight({ rc: "auth", eid: fightId, sq: 5 })).toHaveLength(0);
    await a.pollFight();
    expect(await b.fight({ rc: "auth", eid: fightId, sq: 5 })).toHaveLength(0);
    await b.pollFight();
    await a.pollFight();
    await strikeUntilHuntFinish(a, (ms) => harness.elapseCombat(ms), 6, b);
    const lootA = personalEsrvObject(await a.pollEsrv())["fight|loot"];
    const lootB = personalEsrvObject(await b.pollEsrv())["fight|loot"];
    expect(lootA).toMatchObject({ experience: 11, money: "0.2" });
    expect(lootB).toMatchObject({ experience: 4, money: "0" });
    const afterA = await a.objectAction({ object: "common", action: "init2", sq: 20 });
    const afterB = await b.objectAction({ object: "common", action: "init2", sq: 20 });
    expect(unitframe(afterA).exp).toBe(12);
    expect(unitframe(afterB).exp).toBe(5);
  });

  it("refills a spent 93 pocket cell from bag after a win", async () => {
    const client = await AuthenticatedClient.login(application);
    const init = await client.objectAction({ object: "common", action: "init", sq: 1 });
    const elixirId = requireId(bagItemByArtikulId(init, 93));
    const putOn = await client.objectAction({
      object: "common",
      action: "object",
      form: { code: "PUT_ON", artifact_id: elixirId },
      sq: 2,
    });
    expect(putOn["common|action"]).toEqual({ status: 100 });
    const start = await client.objectAction({
      object: "common",
      action: "object",
      form: { code: "ATTACK_BOT", bot_id: MAP_HUNT_SPAWN_ID },
      sq: 3,
    });
    const fightId = huntFightIdFrom(start);
    expect(await client.fight({ rc: "auth", eid: fightId, sq: 4 })).toHaveLength(0);
    await client.pollFight();
    expect(
      await client.fight({ rc: "castSpell", srcType: 2, srcId: elixirId, sq: 5 }),
    ).toHaveLength(0);
    await client.pollFight();
    await strikeUntilHuntFinish(client, (ms) => harness.elapseCombat(ms), 6);
    const after = await client.objectAction({ object: "common", action: "init", sq: 40 });
    expect(pocketItems(after["user|pocket"]).some((item) => item.artikul_id === 93)).toBe(true);
  });
});

function stateMoney(payload: Record<string, AmfValue>): string {
  const state = payload.state;
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("state is missing");
  }
  if (typeof state.money !== "string") throw new Error("state.money is missing");
  return state.money;
}

function unitframe(payload: Record<string, AmfValue>): {
  hp: number;
  exp: number;
  injury_time: number;
  injury_artikul_id: number;
} {
  const frame = payload["user|unitframe"];
  if (!frame || typeof frame !== "object" || Array.isArray(frame)) {
    throw new Error("user|unitframe is missing");
  }
  if (typeof frame.hp !== "number" || typeof frame.exp !== "number") {
    throw new Error("user|unitframe hp/exp is missing");
  }
  return {
    hp: frame.hp,
    exp: frame.exp,
    injury_time: typeof frame.injury_time === "number" ? frame.injury_time : 0,
    injury_artikul_id: typeof frame.injury_artikul_id === "number" ? frame.injury_artikul_id : 0,
  };
}

function stateGhost(payload: Record<string, AmfValue>): number | undefined {
  const state = payload.state;
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("state is missing");
  }
  return typeof state.ghost === "number" ? state.ghost : undefined;
}

function populationDead(payload: Record<string, AmfValue>, accountId: number): number {
  const block = payload["chat|area_population"];
  if (!block || typeof block !== "object" || Array.isArray(block)) {
    throw new Error("chat|area_population is missing");
  }
  if (!Array.isArray(block.population)) throw new Error("population is missing");
  const row = block.population.find((entry) => {
    return Boolean(
      entry && typeof entry === "object" && !Array.isArray(entry) && entry.id === accountId,
    );
  });
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    throw new Error(`population is missing account ${accountId}`);
  }
  if (typeof row.dead !== "number") throw new Error("population dead is missing");
  return row.dead;
}

function pocketItems(value: AmfValue | undefined): Record<string, AmfValue>[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("user|pocket is missing");
  }
  const pocket = value.pocket;
  if (!Array.isArray(pocket)) throw new Error("user|pocket.pocket is missing");
  return pocket.map((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      throw new Error("pocket row is missing");
    }
    return row;
  });
}

function requireId(item: Record<string, AmfValue>): number {
  if (typeof item.id !== "number") throw new Error("item id is missing");
  return item.id;
}
