import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import type { AmfValue } from "../../src/modules/jugger-wire/amf/amf3.ts";
import {
  createIsolatedHero,
  AuthenticatedClient,
} from "../support/harness/authenticated-client.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";
import { FakeClock } from "../support/fake-clock.ts";
import { ManualCombatDelay } from "../support/fakes/manual-combat-delay.ts";
import {
  putOnStarterGloveIfInBag,
  strikeUntilHuntFinish,
} from "../support/harness/complete-melee-hunt.ts";
import { fightEventTypes, heroIdFrom } from "../support/harness/wire-payload.ts";

const START_MS = 1_700_000_000_000;
const LEVEL6_EXP = 1822;
const LEVEL7_EXP = 3622;
const RASKOP_ID = 2;

describe("battleground raskop", () => {
  let harness: ApplicationHarness;
  let application: Application;
  let clock: FakeClock;

  beforeEach(async () => {
    clock = new FakeClock(START_MS);
    harness = new ApplicationHarness(clock, new ManualCombatDelay(), {
      combatRules: { strPerDamagePoint: 1 },
    });
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("denies level 1 and runs two heroes through PvP finish, history and kick 500", async () => {
    const low = await createIsolatedHero(application);
    await low.objectAction({ object: "common", action: "init", sq: 1 });
    const denied = await low.objectAction({
      object: "arena",
      action: "bg_request",
      form: { id: RASKOP_ID, status: "add" },
      sq: 2,
    });
    expect(denied["arena|bg_request"]).toEqual({
      status: 2,
      error: "Вы не попадаете в заданные уровневые группы!",
    });

    const a = await createIsolatedHero(application);
    const b = await createIsolatedHero(application);
    const initA = await a.objectAction({ object: "common", action: "init", sq: 1 });
    const initB = await b.objectAction({ object: "common", action: "init", sq: 1 });
    const nickB = nickFrom(initB);
    await grantLevel(application, heroIdFrom(initA), 6, LEVEL6_EXP);
    await grantLevel(application, heroIdFrom(initB), 7, LEVEL7_EXP);
    await putOnStarterGloveIfInBag(a, 2);
    await putOnStarterGloveIfInBag(b, 2);

    const listed = await a.objectAction({ object: "arena", action: "list", sq: 4 });
    const list = requireRecord(listed["arena|list"], "arena|list");
    expect(list.status).toBe(100);
    const rows = amfList(list.list, "arena|list.list");
    const raskop = rows.find((row) => requireRecord(row, "list row").id === RASKOP_ID);
    expect(requireRecord(raskop, "Раскоп")).toMatchObject({
      available: 1,
      queue_level: "[6 - 7]",
      request_count: 0,
    });
    const dump = rows.find((row) => requireRecord(row, "dump row").id === 1);
    expect(requireRecord(dump, "dump card").request_count).toBe(0);

    expect(await queueAdd(a, 5)).toMatchObject({
      "arena|bg_request": { status: 100, user_in_queue: 1, bg_id: "2" },
    });
    expect(await queueAdd(b, 5)).toMatchObject({
      "arena|bg_request": { status: 100, user_in_queue: 1, bg_id: "2" },
    });
    const inviteA = personalBlocks(await a.pollEsrv());
    const inviteB = personalBlocks(await b.pollEsrv());
    expect(requireRecord(inviteA["common|window"], "invite A").show_ttl).toBe("120");
    expect(requireRecord(inviteB["common|window"], "invite B").show_ttl).toBe("120");

    expect((await queueConfirm(a, 6))["arena|bg_request"]).toMatchObject({ status: 100 });
    expect((await queueConfirm(b, 6))["arena|bg_request"]).toMatchObject({ status: 100 });
    const enteredA = personalBlocks(await a.pollEsrv());
    const enteredB = personalBlocks(await b.pollEsrv());
    expect(requireRecord(enteredA.state, "state A").area_id).toBe("637");
    expect(requireRecord(enteredB.state, "state B").area_id).toBe("635");
    expect(requireRecord(enteredA["user|conf"], "conf A").kind).toBe(2);
    expect(requireRecord(enteredB["user|conf"], "conf B").kind).toBe(3);
    expect(enteredA["arena|bg_waiting"]).toBeDefined();
    expect(enteredB["arena|bg_waiting"]).toBeDefined();

    const movedA = await comeIn(a, 636, 7);
    expect(movedA["common|action"]).toEqual({ status: 100, action: "COME_IN" });
    const movedB = await comeIn(b, 636, 7);
    expect(movedB["common|action"]).toEqual({ status: 100, action: "COME_IN" });
    expect(requireRecord(movedB.state, "arena B").area_id).toBe("636");

    const attack = await a.objectAction({
      object: "common",
      action: "object",
      form: { code: "ATTACK", nick: nickB },
      sq: 9,
    });
    expect(attack["common|action"]).toEqual({ status: 100, action: "ATTACK" });
    const confA = pvpFightConf(attack);
    const confB = pvpFightConf(personalBlocks(await b.pollEsrv()));
    expect(confA.fightId).toBe(confB.fightId);
    expect(confA).toMatchObject({ is_pvp: 1, type: "1", flags: "128", bg: "5_1", can_leave: 1 });
    expect(confA.instanceId).not.toBe("0");

    expect(await a.fight({ rc: "auth", eid: confA.fightId, sq: 10 })).toHaveLength(0);
    expect(await b.fight({ rc: "auth", eid: confA.fightId, sq: 10 })).toHaveLength(0);
    const bootstrapA = await a.pollFight();
    expect(fightEventTypes(bootstrapA)).toEqual(
      expect.arrayContaining(["fightState", "persList", "oppnew", "attacknow"]),
    );
    await b.pollFight();
    await strikeUntilHuntFinish(a, (ms) => harness.elapseCombat(ms), 11, b);
    await harness.elapseCombat(2_000);

    const finishA = personalBlocks(await a.pollEsrv());
    const finishB = personalBlocks(await b.pollEsrv());
    expect(requireRecord(finishA["arena|bg_finish"], "bg_finish A").finished).toBe(1);
    expect(requireRecord(finishB["arena|bg_finish"], "bg_finish B").finished).toBe(1);
    expect(requireRecord(finishA.state, "kick A").area_id).toBe("500");
    expect(requireRecord(finishB.state, "kick B").area_id).toBe("500");
    expect(requireRecord(finishA["user|conf"], "kick conf A").kind).toBe(1);

    const history = await a.objectAction({
      object: "arena",
      action: "bg_finished",
      form: { bg_id: "2", page: 1 },
      sq: 30,
    });
    const finished = requireRecord(history["arena|bg_finished"], "arena|bg_finished");
    expect(finished.status).toBe(100);
    expect(Number(finished.pages)).toBeGreaterThanOrEqual(1);
    const historyRow = amfList(finished.bgs, "bgs").find(
      (row) => requireRecord(row, "history row").instance_id === confA.instanceId,
    );
    expect(requireRecord(historyRow, "history row")).toMatchObject({
      title: "Раскоп",
      bg_id: "2",
    });

    application = await harness.restart();
    const againA = new AuthenticatedClient(application, a.cookie);
    const restored = await againA.objectAction({ object: "common", action: "init", sq: 40 });
    expect(requireRecord(restored.state, "restart state").area_id).toBe("500");
    const historyAgain = await againA.objectAction({
      object: "arena",
      action: "bg_finished",
      form: { bg_id: "2", page: 1 },
      sq: 41,
    });
    expect(
      Number(requireRecord(historyAgain["arena|bg_finished"], "history after restart").pages),
    ).toBeGreaterThanOrEqual(1);
  });

  it("bans an unconfirmed invite after the 120s TTL", async () => {
    const a = await createIsolatedHero(application);
    const b = await createIsolatedHero(application);
    const initA = await a.objectAction({ object: "common", action: "init", sq: 1 });
    const initB = await b.objectAction({ object: "common", action: "init", sq: 1 });
    await grantLevel(application, heroIdFrom(initA), 6, LEVEL6_EXP);
    await grantLevel(application, heroIdFrom(initB), 7, LEVEL7_EXP);
    await queueAdd(a, 2);
    await queueAdd(b, 2);
    expect(personalBlocks(await a.pollEsrv())["common|window"]).toBeDefined();
    clock.advanceSeconds(120);
    await harness.elapseCombat(0);
    const banned = await queueAdd(a, 3);
    expect(banned["arena|bg_request"]).toEqual({
      status: 2,
      error: "Вы не сможете подать заявку еще 60 мин. 0 сек.",
    });
  });

  it("kicks orphans from 635/636/637 after process restart", async () => {
    const a = await createIsolatedHero(application);
    const b = await createIsolatedHero(application);
    const initA = await a.objectAction({ object: "common", action: "init", sq: 1 });
    const initB = await b.objectAction({ object: "common", action: "init", sq: 1 });
    await grantLevel(application, heroIdFrom(initA), 6, LEVEL6_EXP);
    await grantLevel(application, heroIdFrom(initB), 7, LEVEL7_EXP);
    await queueAdd(a, 2);
    await queueAdd(b, 2);
    await queueConfirm(a, 3);
    await queueConfirm(b, 3);
    expect(requireRecord(personalBlocks(await a.pollEsrv()).state, "live A").area_id).toBe("637");
    application = await harness.restart();
    const againA = new AuthenticatedClient(application, a.cookie);
    const againB = new AuthenticatedClient(application, b.cookie);
    const kickedA = await againA.objectAction({ object: "common", action: "init", sq: 10 });
    const kickedB = await againB.objectAction({ object: "common", action: "init", sq: 10 });
    expect(requireRecord(kickedA.state, "orphan A").area_id).toBe("500");
    expect(requireRecord(kickedB.state, "orphan B").area_id).toBe("500");
  });
});

async function grantLevel(
  application: Application,
  characterId: number,
  level: number,
  amount: number,
): Promise<void> {
  const granted = await application.characterProgression.grantExperience({
    characterId,
    operationId: `bg:${characterId}:l${level}`,
    amount,
  });
  if (granted.levelAfter !== level) {
    throw new Error(`Expected level ${level} after ${amount} EXP, got ${granted.levelAfter}`);
  }
}

function queueAdd(client: AuthenticatedClient, sq: number) {
  return client.objectAction({
    object: "arena",
    action: "bg_request",
    form: { id: RASKOP_ID, status: "add" },
    sq,
  });
}

function queueConfirm(client: AuthenticatedClient, sq: number) {
  return client.objectAction({
    object: "arena",
    action: "bg_request",
    form: { id: RASKOP_ID, status: "confirm" },
    sq,
  });
}

function comeIn(client: AuthenticatedClient, areaId: number, sq: number) {
  return client.objectAction({
    object: "common",
    action: "action",
    form: { code: "COME_IN", area_id: areaId },
    sq,
  });
}

function nickFrom(payload: Record<string, AmfValue>): string {
  const conf = requireRecord(payload["user|conf"], "user|conf");
  if (typeof conf.nick !== "string" || !conf.nick) throw new Error("user|conf.nick missing");
  return conf.nick;
}

function pvpFightConf(payload: Record<string, AmfValue>): {
  fightId: string;
  instanceId: string;
  is_pvp: number;
  type: string;
  flags: string;
  bg: string;
  can_leave: number;
} {
  const fight = requireRecord(payload["fight|conf"], "fight|conf");
  const conf = requireRecord(fight.conf, "fight|conf.conf");
  if (typeof conf.fightId !== "string" || !/^[1-9][0-9]*$/.test(conf.fightId)) {
    throw new Error("pvp fightId missing");
  }
  if (typeof conf.instance_id !== "string" || !/^[1-9][0-9]*$/.test(conf.instance_id)) {
    throw new Error("pvp instance_id must be a positive copy id");
  }
  if (conf.is_pvp !== 1) throw new Error("is_pvp must be 1");
  if (typeof conf.type !== "string") throw new Error("type missing");
  if (typeof conf.flags !== "string") throw new Error("flags missing");
  if (typeof conf.bg !== "string") throw new Error("bg missing");
  if (conf.can_leave !== 1 && conf.can_leave !== 0) throw new Error("can_leave missing");
  return {
    fightId: conf.fightId,
    instanceId: conf.instance_id,
    is_pvp: conf.is_pvp,
    type: conf.type,
    flags: conf.flags,
    bg: conf.bg,
    can_leave: conf.can_leave,
  };
}

function personalBlocks(packets: readonly AmfValue[]): Record<string, AmfValue> {
  const merged: Record<string, AmfValue> = {};
  for (const packet of packets) {
    if (!packet || typeof packet !== "object" || Array.isArray(packet)) continue;
    if (typeof packet.channel !== "string" || !packet.channel.startsWith("2:")) continue;
    if (!packet.object || typeof packet.object !== "object" || Array.isArray(packet.object)) {
      continue;
    }
    Object.assign(merged, packet.object as Record<string, AmfValue>);
  }
  return merged;
}

function amfList(value: AmfValue | undefined, label: string): AmfValue[] {
  if (Array.isArray(value)) return value;
  return Object.values(requireRecord(value, label));
}

function requireRecord(value: AmfValue | undefined, label: string): Record<string, AmfValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
}
