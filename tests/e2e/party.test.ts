import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import type { AmfValue } from "../../src/modules/jugger-wire/amf/amf3.ts";
import { AuthenticatedClient } from "../support/harness/authenticated-client.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";
import { uniqueDevelopmentSlot } from "../support/harness/unique-development-slot.ts";

describe("party membership and 4: channel", () => {
  let harness: ApplicationHarness;
  let application: Application;

  beforeEach(async () => {
    harness = new ApplicationHarness();
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("creates, invites, confirms, chats on 4:, reconnects, then kicks", async () => {
    const [leader, member, nickB] = await dualHeroes(application);
    const created = await leader.objectAction({ object: "party", action: "create", sq: 2 });
    expect(created["party|create"]).toEqual({ status: 100 });
    expect(stateParty(created)).toBe(1);
    expect(created["party|bag"]).toEqual({ status: 100, artikuls: [], types: [] });
    const members = requireRecord(created["party|members"], "party|members");
    expect(members.status).toBe(100);
    expect(Array.isArray(members.members)).toBe(true);
    expect((members.members as AmfValue[]).length).toBe(1);

    const twice = await leader.objectAction({ object: "party", action: "create", sq: 3 });
    expect(twice["party|create"]).toEqual({
      status: 2,
      error: "Вы уже находитесь в группе!",
    });

    const invited = await leader.objectAction({
      object: "party",
      action: "invite",
      form: { nick: nickB },
      sq: 4,
    });
    expect(invited["party|invite"]).toEqual({ status: 100 });
    const window = personalObject(await member.pollEsrv())["common|window"];
    const win = requireRecord(window, "common|window");
    expect(win.title).toBe("Приглашение в группу");
    const partyId = invitePartyId(win);

    const confirmed = await member.objectAction({
      object: "party",
      action: "confirm_invite",
      form: { party: String(partyId) },
      sq: 5,
    });
    expect(confirmed["party|confirm_invite"]).toEqual({ status: 100 });
    expect(stateParty(confirmed)).toBe(1);
    const confirmedMembers = requireRecord(confirmed["party|members"], "confirm members");
    expect((confirmedMembers.members as AmfValue[]).length).toBe(2);

    const chat = await leader.objectAction({
      object: "chat",
      action: "add",
      form: { message: "party hi", type: "party" },
      sq: 6,
    });
    expect(chat["chat|add"]).toEqual({ status: 100 });
    const partyFrames = await member.pollEsrv();
    const partyChat = chatOnChannel(partyFrames, `4:${partyId}`);
    expect(partyChat.some((row) => row.msg === "party hi")).toBe(true);

    application = await harness.restart();
    const restarted = new AuthenticatedClient(application, member.cookie);
    const init2 = await restarted.objectAction({ object: "common", action: "init2", sq: 1 });
    expect(stateParty(init2)).toBe(1);
    expect(requireRecord(init2["party|members"], "restore members").status).toBe(100);
    expect(init2["party|bag"]).toEqual({ status: 100, artikuls: [], types: [] });

    const kicked = await new AuthenticatedClient(application, leader.cookie).objectAction({
      object: "party",
      action: "kick",
      form: { nick: nickB },
      sq: 7,
    });
    expect(kicked["party|kick"]).toEqual({ status: 100 });
    expect(frameBlock(await restarted.pollEsrv(), "2:", "party|members")).toEqual({
      status: 100,
      members: [],
    });
  });

  it("disbands when the leader leaves and gates lower-level leadership", async () => {
    const [leader, member, nickB] = await dualHeroes(application);
    await leader.objectAction({ object: "party", action: "create", sq: 2 });
    await leader.objectAction({
      object: "party",
      action: "invite",
      form: { nick: nickB },
      sq: 3,
    });
    await leader.pollEsrv();
    const win = requireRecord(personalObject(await member.pollEsrv())["common|window"], "invite");
    await member.objectAction({
      object: "party",
      action: "confirm_invite",
      form: { party: String(invitePartyId(win)) },
      sq: 4,
    });
    await leader.pollEsrv();
    await member.pollEsrv();
    const equal = await leader.objectAction({
      object: "party",
      action: "change_leader",
      form: { nick: nickB },
      sq: 5,
    });
    expect(equal["party|change_leader"]).toEqual({ status: 100 });

    const left = await member.objectAction({ object: "party", action: "leave", sq: 6 });
    expect(left["party|leave"]).toEqual({ status: 100 });
    expect(left["party|members"]).toEqual({ status: 100, members: [] });
    const leaderEmpty = personalObject(await leader.pollEsrv())["party|members"];
    expect(leaderEmpty).toEqual({ status: 100, members: [] });
  });
});

async function dualHeroes(
  application: Application,
): Promise<readonly [AuthenticatedClient, AuthenticatedClient, string]> {
  const slotA = uniqueDevelopmentSlot();
  let slotB = uniqueDevelopmentSlot();
  while (slotB === slotA) slotB = uniqueDevelopmentSlot();
  const [clientA, clientB] = await Promise.all([
    AuthenticatedClient.login(application, slotA),
    AuthenticatedClient.login(application, slotB),
  ]);
  const [, initB] = await Promise.all([
    clientA.objectAction({ object: "common", action: "init", sq: 1 }),
    clientB.objectAction({ object: "common", action: "init", sq: 1 }),
  ]);
  const conf = requireRecord(initB["user|conf"], "user|conf");
  if (typeof conf.nick !== "string" || !conf.nick) throw new Error("user|conf.nick missing");
  return [clientA, clientB, conf.nick];
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

function frameBlock(packets: readonly AmfValue[], channelPrefix: string, key: string): AmfValue {
  for (const packet of packets) {
    if (!packet || typeof packet !== "object" || Array.isArray(packet)) continue;
    if (typeof packet.channel !== "string" || !packet.channel.startsWith(channelPrefix)) continue;
    if (!packet.object || typeof packet.object !== "object" || Array.isArray(packet.object)) {
      continue;
    }
    const object = packet.object as Record<string, AmfValue>;
    if (!(key in object)) continue;
    const block = object[key];
    if (block === undefined) {
      throw new Error(`${key} on ${channelPrefix} is undefined`);
    }
    return block;
  }
  throw new Error(`${key} on ${channelPrefix} is missing`);
}

function requireRecord(value: AmfValue | undefined, label: string): Record<string, AmfValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
}
