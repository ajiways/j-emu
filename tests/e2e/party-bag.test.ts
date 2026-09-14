import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import type { AmfValue } from "../../src/modules/jugger-wire/amf/amf3.ts";
import { AuthenticatedClient } from "../support/harness/authenticated-client.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";
import {
  completeMeleeHunt,
  putOnStarterGloveIfInBag,
} from "../support/harness/complete-melee-hunt.ts";
import { MAP_HUNT_SPAWN_ID } from "../support/harness/map-hunt-spawn.ts";
import { uniqueDevelopmentSlot } from "../support/harness/unique-development-slot.ts";
import { SequenceRandom } from "../support/fakes/sequence-random.ts";
import { playableHuntMeatSettlementDraw } from "../support/playable-bot.ts";
import {
  bagItemByArtikulId,
  huntFightIdFrom,
  personalEsrvObject,
} from "../support/harness/wire-payload.ts";

describe("party bag, grouploot and HELP", () => {
  let harness: ApplicationHarness;
  let application: Application;

  beforeEach(async () => {
    harness = new ApplicationHarness(undefined, undefined, {
      lootRandom: new SequenceRandom([
        ...playableHuntMeatSettlementDraw(),
        ...playableHuntMeatSettlementDraw(),
        ...playableHuntMeatSettlementDraw(),
      ]),
      partyRandom: new SequenceRandom([90, 10]),
    });
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("defers hunt meat into the party bag, then give survives restart", async () => {
    const formed = await formParty(application, "2");
    const before = await formed.member.objectAction({ object: "common", action: "init", sq: 8 });
    expect(bagItemByArtikulId(before, 77).cnt).toBe(4);
    await completeMeleeHunt(formed.leader, (ms) => harness.elapseCombat(ms), 9);
    const loot = personalEsrvObject(await formed.leader.pollEsrv());
    expect(loot["fight|loot"]).toMatchObject({ status: 100, loot: [] });
    const partyFrames = await formed.member.pollEsrv();
    const grouploot = requireRecord(
      frameBlock(partyFrames, `4:${formed.partyId}`, "fight|grouploot"),
      "fight|grouploot",
    );
    expect(grouploot.status).toBe(100);
    expect(grouploot.loot).toMatchObject({ "77": { artikul_id: 77, amount: 1 } });
    const bag = requireRecord(
      frameBlock(partyFrames, `4:${formed.partyId}`, "party|bag"),
      "party|bag",
    );
    expect(bag.newloot).toBe(1);
    const itemId = partyBagItemId(bag, "Кусок мяса");

    const given = await formed.leader.objectAction({
      object: "party",
      action: "give",
      form: { items: { [itemId]: 1 }, nick: formed.memberNick },
      sq: 20,
    });
    expect(given["party|give"]).toEqual({ status: 100 });
    expect(requireRecord(given["party|bag"], "give bag").artikuls).toEqual([]);
    const after = await formed.member.objectAction({ object: "common", action: "init", sq: 21 });
    expect(bagItemByArtikulId(after, 77).cnt).toBe(5);

    application = await harness.restart();
    const restarted = new AuthenticatedClient(application, formed.leader.cookie);
    const init2 = await restarted.objectAction({ object: "common", action: "init2", sq: 1 });
    expect(init2["party|bag"]).toEqual({ status: 100, artikuls: [], types: [] });
  });

  it("drops a party bag item and rejects loot_rules changes while the bag is full", async () => {
    const formed = await formParty(application, "2");
    await completeMeleeHunt(formed.leader, (ms) => harness.elapseCombat(ms), 9);
    await formed.leader.pollEsrv();
    await formed.member.pollEsrv();
    const polled = await formed.leader.objectAction({ object: "party", action: "bag", sq: 20 });
    const bag = requireRecord(polled["party|bag"], "party|bag");
    const locked = await formed.leader.objectAction({
      object: "party",
      action: "save_settings",
      form: { loot_rules: "3" },
      sq: 21,
    });
    expect(locked["party|save_settings"]).toEqual({
      status: 2,
      error: "нельзя сменить правила при непустом групповом рюкзаке",
    });
    const itemId = partyBagItemId(bag, "Кусок мяса");
    const dropped = await formed.leader.objectAction({
      object: "party",
      action: "drop",
      form: { items: { [itemId]: 1 } },
      sq: 22,
    });
    expect(dropped["party|drop"]).toEqual({ status: 100 });
    expect(requireRecord(dropped["party|bag"], "drop bag").artikuls).toEqual([]);
  });

  it("grants leftover bag items to the leader on disband", async () => {
    const formed = await formParty(application, "2");
    await completeMeleeHunt(formed.leader, (ms) => harness.elapseCombat(ms), 9);
    await formed.leader.pollEsrv();
    await formed.member.pollEsrv();
    const before = await formed.leader.objectAction({ object: "common", action: "init", sq: 20 });
    expect(bagItemByArtikulId(before, 77).cnt).toBe(4);
    const disbanded = await formed.leader.objectAction({
      object: "party",
      action: "disband",
      sq: 21,
    });
    expect(disbanded["party|disband"]).toEqual({ status: 100 });
    expect(bagItemByArtikulId(disbanded, 77).cnt).toBe(5);
    expect(stateParty(disbanded)).toBe(0);
  });

  it("joins the same-area hunt through FIGHT_HELP and rejects a second join", async () => {
    const formed = await formParty(application, "1");
    await putOnStarterGloveIfInBag(formed.leader, 8);
    const start = await formed.leader.objectAction({
      object: "common",
      action: "object",
      form: { code: "ATTACK_BOT", bot_id: MAP_HUNT_SPAWN_ID },
      sq: 10,
    });
    const fightId = huntFightIdFrom(start);
    expect(await formed.leader.fight({ rc: "auth", eid: fightId, sq: 11 })).toHaveLength(0);
    await formed.leader.pollFight();
    const helpChat = chatOnChannel(await formed.member.pollEsrv(), `4:${formed.partyId}`);
    expect(helpChat.some((row) => String(row.msg).includes("начал бой"))).toBe(true);

    const helped = await formed.member.objectAction({
      object: "common",
      action: "object",
      form: { code: "FIGHT_HELP", nick: formed.leaderNick },
      sq: 8,
    });
    expect(helped["common|action"]).toEqual({ status: 100 });
    expect(huntFightIdFrom(helped)).toBe(fightId);
    const busy = await formed.member.objectAction({
      object: "common",
      action: "object",
      form: { code: "FIGHT_HELP", nick: formed.leaderNick },
      sq: 9,
    });
    expect(busy["common|action"]).toEqual({ status: 203, error: "нельзя во время боя" });
  });
});

async function formParty(
  application: Application,
  lootRules: "1" | "2" | "3",
): Promise<{
  leader: AuthenticatedClient;
  member: AuthenticatedClient;
  leaderNick: string;
  memberNick: string;
  partyId: string;
}> {
  const slotA = uniqueDevelopmentSlot();
  let slotB = uniqueDevelopmentSlot();
  while (slotB === slotA) slotB = uniqueDevelopmentSlot();
  const [leader, member] = await Promise.all([
    AuthenticatedClient.login(application, slotA),
    AuthenticatedClient.login(application, slotB),
  ]);
  const [initA, initB] = await Promise.all([
    leader.objectAction({ object: "common", action: "init", sq: 1 }),
    member.objectAction({ object: "common", action: "init", sq: 1 }),
  ]);
  const leaderNick = requireNick(initA);
  const memberNick = requireNick(initB);
  await leader.objectAction({ object: "party", action: "create", sq: 2 });
  await leader.objectAction({
    object: "party",
    action: "invite",
    form: { nick: memberNick },
    sq: 3,
  });
  await leader.pollEsrv();
  const win = requireRecord(personalObject(await member.pollEsrv())["common|window"], "invite");
  const partyId = invitePartyId(win);
  await member.objectAction({
    object: "party",
    action: "confirm_invite",
    form: { party: partyId },
    sq: 4,
  });
  await leader.pollEsrv();
  await member.pollEsrv();
  if (lootRules !== "1") {
    const saved = await leader.objectAction({
      object: "party",
      action: "save_settings",
      form: { loot_rules: lootRules },
      sq: 5,
    });
    expect(saved["party|save_settings"]).toEqual({ status: 100 });
    await leader.pollEsrv();
    await member.pollEsrv();
  }
  return { leader, member, leaderNick, memberNick, partyId };
}

function partyBagItemId(bag: Record<string, AmfValue>, title: string): number {
  const artikuls = bag.artikuls;
  if (!Array.isArray(artikuls)) throw new Error("party|bag.artikuls is missing");
  for (const row of artikuls) {
    const item = requireRecord(row, "party bag item");
    if (item.title === title) {
      const id = Number(item.id);
      if (!Number.isInteger(id) || id < 1) throw new Error("party bag item id is invalid");
      return id;
    }
  }
  throw new Error(`party bag item ${title} is missing`);
}

function requireNick(payload: Record<string, AmfValue>): string {
  const conf = requireRecord(payload["user|conf"], "user|conf");
  if (typeof conf.nick !== "string" || !conf.nick) throw new Error("user|conf.nick missing");
  return conf.nick;
}

function stateParty(payload: Record<string, AmfValue>): number {
  const state = requireRecord(payload.state, "state");
  if (typeof state.party !== "number") throw new Error("state.party is missing");
  return state.party;
}

function invitePartyId(window: Record<string, AmfValue>): string {
  const buttons = window.buttons;
  if (!Array.isArray(buttons) || buttons.length < 1) throw new Error("invite buttons missing");
  const first = requireRecord(buttons[0], "invite button");
  const action = requireRecord(first.action, "invite action");
  const form = requireRecord(action.form, "invite form");
  if (typeof form.party !== "string" || !form.party) throw new Error("invite party id missing");
  return form.party;
}

function personalObject(packets: readonly AmfValue[]): Record<string, AmfValue> {
  for (const packet of packets) {
    if (!packet || typeof packet !== "object" || Array.isArray(packet)) continue;
    if (typeof packet.channel !== "string" || !packet.channel.startsWith("2:")) continue;
    if (!packet.object || typeof packet.object !== "object" || Array.isArray(packet.object)) {
      continue;
    }
    return packet.object as Record<string, AmfValue>;
  }
  throw new Error("personal esrv object is missing");
}

function chatOnChannel(
  packets: readonly AmfValue[],
  channel: string,
): Array<Record<string, AmfValue>> {
  const rows: Array<Record<string, AmfValue>> = [];
  for (const packet of packets) {
    if (!packet || typeof packet !== "object" || Array.isArray(packet)) continue;
    if (packet.channel !== channel) continue;
    if (!packet.object || typeof packet.object !== "object" || Array.isArray(packet.object)) {
      continue;
    }
    const object = packet.object as Record<string, AmfValue>;
    const block = object["chat|message"];
    if (!block || typeof block !== "object" || Array.isArray(block)) continue;
    const message = (block as Record<string, AmfValue>).message;
    if (!message || typeof message !== "object" || Array.isArray(message)) {
      throw new Error("chat|message.message is missing");
    }
    rows.push(message as Record<string, AmfValue>);
  }
  return rows;
}

function frameBlock(packets: readonly AmfValue[], channel: string, key: string): AmfValue {
  for (const packet of packets) {
    if (!packet || typeof packet !== "object" || Array.isArray(packet)) continue;
    if (packet.channel !== channel) continue;
    if (!packet.object || typeof packet.object !== "object" || Array.isArray(packet.object)) {
      continue;
    }
    const object = packet.object as Record<string, AmfValue>;
    if (!(key in object)) continue;
    const block = object[key];
    if (block === undefined) throw new Error(`${key} on ${channel} is undefined`);
    return block;
  }
  throw new Error(`${key} on ${channel} is missing`);
}

function requireRecord(value: AmfValue | undefined, label: string): Record<string, AmfValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
}
