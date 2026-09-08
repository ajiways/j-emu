import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import { encodeAmf3, type AmfValue } from "../../src/modules/jugger-wire/amf/amf3.ts";
import {
  AuthenticatedClient,
  createIsolatedHero,
} from "../support/harness/authenticated-client.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";

describe("presence esrv roster", () => {
  let harness: ApplicationHarness;
  let application: Application;

  beforeEach(async () => {
    harness = new ApplicationHarness();
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("puts both isolated heroes on 503 into init2 population by accountId", async () => {
    const a = await createIsolatedHero(application);
    const b = await createIsolatedHero(application);
    const initA = await a.objectAction({ object: "common", action: "init2", sq: 1 });
    const initB = await b.objectAction({ object: "common", action: "init2", sq: 1 });
    const populationA = populationOf(initA);
    const populationB = populationOf(initB);
    expect(idsOf(populationA)).toEqual(expect.arrayContaining([a.accountId, b.accountId]));
    expect(idsOf(populationB)).toEqual(expect.arrayContaining([a.accountId, b.accountId]));
    expectCharacterInfo(infoById(populationA, a.accountId), a.accountId);
    expectCharacterInfo(infoById(populationA, b.accountId), b.accountId);
  });

  it("fans COME_IN/exit diffs on 2: and keeps dest roster without the other hero", async () => {
    const a = await createIsolatedHero(application);
    const b = await createIsolatedHero(application);
    await a.objectAction({ object: "common", action: "init", sq: 1 });
    const before = await b.objectAction({ object: "common", action: "init2", sq: 1 });
    const nickA = infoById(populationOf(before), a.accountId).nick;

    const shop = await a.objectAction({
      object: "common",
      action: "action",
      form: { code: "COME_IN", area_id: 504 },
      sq: 2,
    });
    expect(idsOf(populationOf(shop))).toContain(a.accountId);
    expect(idsOf(populationOf(shop))).not.toContain(b.accountId);

    const left = await b.pollEsrv();
    expectHuntFrame(left, "503");
    expect(personalDiff(left, b.accountId)).toEqual({ status: 100, remove: [nickA] });
    expectNoPartyOrChatAdd(left);

    const exit = await a.objectAction({ object: "common", action: "exit", sq: 3 });
    const backIds = idsOf(populationOf(exit));
    expect(backIds).toContain(a.accountId);
    expect(backIds).toContain(b.accountId);

    const entered = await b.pollEsrv();
    expectHuntFrame(entered, "503");
    const add = personalDiff(entered, b.accountId).add;
    if (!Array.isArray(add) || add.length < 1) throw new Error("diff add is missing");
    const added = add.map((row, index) => objectBlock(row, `add[${index}]`));
    const first = added[0];
    if (!first) throw new Error("diff add[0] is missing");
    expect(idsOf(added)).toEqual([a.accountId]);
    expectCharacterInfo(first, a.accountId);
    expectNoPartyOrChatAdd(entered);
  });

  it("removes a logged-out neighbor on 2:", async () => {
    const a = await createIsolatedHero(application);
    const b = await createIsolatedHero(application);
    const before = await b.objectAction({ object: "common", action: "init2", sq: 1 });
    const nickA = infoById(populationOf(before), a.accountId).nick;
    await a.logout();
    const packets = await b.pollEsrv();
    expect(personalDiff(packets, b.accountId)).toEqual({ status: 100, remove: [nickA] });
    const after = await b.objectAction({ object: "common", action: "init2", sq: 2 });
    expect(idsOf(populationOf(after))).toContain(b.accountId);
    expect(idsOf(populationOf(after))).not.toContain(a.accountId);
  });

  it("always carries 131 hunt on poll and answers chat auth with an empty body", async () => {
    const client = await createIsolatedHero(application);
    const packets = await client.pollEsrv();
    expectHuntFrame(packets, "503");
    expectNoPartyOrChatAdd(packets);
    const authed = await client.esrvAuth();
    expect(authed.statusCode).toBe(200);
    expect(authed.payload.length).toBe(0);
    const anonymous = await application.http.inject({
      method: "POST",
      url: "/esrv/auth",
      headers: { "content-type": "application/octet-stream" },
      payload: encodeAmf3({ rc: "auth", eid: 1 }),
    });
    expect(anonymous.statusCode).toBe(200);
    expect(anonymous.rawPayload.length).toBe(0);
  });

  it("drops the process-local queue on restart and rebuilds roster from sessions", async () => {
    const a = await createIsolatedHero(application);
    const b = await createIsolatedHero(application);
    await a.objectAction({
      object: "common",
      action: "action",
      form: { code: "COME_IN", area_id: 504 },
      sq: 2,
    });
    application = await harness.restart();
    const againB = new AuthenticatedClient(application, b.cookie);
    const packets = await againB.pollEsrv();
    expectHuntFrame(packets, "503");
    expect(personalObject(packets, b.accountId)).toBeUndefined();
    const init2 = await againB.objectAction({ object: "common", action: "init2", sq: 21 });
    expect(idsOf(populationOf(init2))).toContain(b.accountId);
    expect(idsOf(populationOf(init2))).not.toContain(a.accountId);
    const againA = new AuthenticatedClient(application, a.cookie);
    const shop = await againA.objectAction({ object: "common", action: "init2", sq: 21 });
    expect(idsOf(populationOf(shop))).toContain(a.accountId);
    expect(idsOf(populationOf(shop))).not.toContain(b.accountId);
  });
});

function populationOf(payload: Record<string, AmfValue>): Record<string, AmfValue>[] {
  const block = objectBlock(payload["chat|area_population"], "chat|area_population");
  expect(block.status).toBe(100);
  const population = block.population;
  if (!Array.isArray(population)) throw new Error("population must be an array");
  return population.map((row, index) => objectBlock(row, `population[${index}]`));
}

function idsOf(rows: readonly Record<string, AmfValue>[]): number[] {
  return rows.map((row) => {
    if (typeof row.id !== "number") throw new Error("CharacterInfo.id must be a number");
    return row.id;
  });
}

function infoById(rows: readonly Record<string, AmfValue>[], accountId: number) {
  const row = rows.find((entry) => entry.id === accountId);
  if (!row) throw new Error(`population is missing account ${accountId}`);
  return row;
}

function expectCharacterInfo(row: Record<string, AmfValue>, accountId: number): void {
  expect(row.id).toBe(accountId);
  expect(row.instance_id).toBe(0);
  expect(row.dead).toBe(0);
  expect(row.injury_time).toBe(0);
  expect(row.injury_artikul_id).toBe(0);
  expect(typeof row.nick).toBe("string");
  expect(typeof row.body).toBe("string");
  expect(typeof row.avatar_small).toBe("string");
  expect(row.avatar_small).not.toBe("");
  expect(row).not.toHaveProperty("change");
}

function expectHuntFrame(packets: readonly AmfValue[], areaId: string): void {
  const hunt = packets.find((packet) => frameChannel(packet) === `131:${areaId}`);
  expect(hunt).toMatchObject({
    channel: `131:${areaId}`,
    object: { "common|hunt": { status: 100 } },
  });
  if (!hunt || typeof hunt !== "object" || Array.isArray(hunt) || typeof hunt.ctime !== "number") {
    throw new Error("hunt frame ctime is missing");
  }
  expect(Number.isInteger(hunt.ctime)).toBe(true);
}

function personalDiff(packets: readonly AmfValue[], accountId: number): Record<string, AmfValue> {
  const personal = personalObject(packets, accountId);
  if (!personal) throw new Error(`personal 2:${accountId} frame is missing`);
  expect(personal["chat|add"]).toBeUndefined();
  return objectBlock(personal["chat|area_population_diff"], "chat|area_population_diff");
}

function personalObject(
  packets: readonly AmfValue[],
  accountId: number,
): Record<string, AmfValue> | undefined {
  const frame = packets.find((packet) => frameChannel(packet) === `2:${accountId}`);
  if (!frame || typeof frame !== "object" || Array.isArray(frame)) return undefined;
  if (!frame.object || typeof frame.object !== "object" || Array.isArray(frame.object)) {
    throw new Error("personal frame object is missing");
  }
  return frame.object;
}

function expectNoPartyOrChatAdd(packets: readonly AmfValue[]): void {
  for (const packet of packets) {
    const channel = frameChannel(packet);
    expect(channel.startsWith("4:")).toBe(false);
    if (typeof packet !== "object" || packet === null || Array.isArray(packet)) continue;
    if (!packet.object || typeof packet.object !== "object" || Array.isArray(packet.object)) {
      continue;
    }
    expect(packet.object["chat|add"]).toBeUndefined();
  }
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
