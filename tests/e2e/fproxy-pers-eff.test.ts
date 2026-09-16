import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import type { AmfValue } from "../../src/modules/jugger-wire/amf/amf3.ts";
import {
  AuthenticatedClient,
  createIsolatedHero,
} from "../support/harness/authenticated-client.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";
import { MAP_HUNT_SPAWN_ID } from "../support/harness/map-hunt-spawn.ts";
import {
  bagItemByArtikulId,
  fightEventTypes,
  heroIdFrom,
  huntFightIdFrom,
  huntOppNewFrom,
} from "../support/harness/wire-payload.ts";

describe("fproxy persEff roster inspect", () => {
  let harness: ApplicationHarness;
  let application: Application;

  beforeEach(async () => {
    harness = new ApplicationHarness();
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("acks persInfo on HTTP and returns empty bot persEff on poll", async () => {
    const client = await AuthenticatedClient.login(application);
    const boot = await startHunt(client, 3);
    expect(await client.fight({ rc: "persInfo", sq: 6 })).toEqual([{ rs: true, sq: 6 }]);
    expect(await client.fight({ rc: "persEff", persId: boot.botId, sq: 7 })).toHaveLength(0);
    const poll = await client.pollFight();
    expect(poll[0]).toEqual({ rs: true, sq: 7 });
    expect(fightEventTypes(poll)).toEqual(["persEff"]);
    expect(persEffPacket(poll)).toEqual({ et: "persEff", persId: boot.botId });
  });

  it("shows opener orb 99 to the other hunter via fan-out and persEff", async () => {
    const a = await createIsolatedHero(application);
    const b = await createIsolatedHero(application);
    const initA = await a.objectAction({ object: "common", action: "init", sq: 1 });
    await b.objectAction({ object: "common", action: "init", sq: 1 });
    const heroA = heroIdFrom(initA);
    const orbId = requireId(bagItemByArtikulId(initA, 99));
    const putOn = await a.objectAction({
      object: "common",
      action: "object",
      form: { code: "PUT_ON", artifact_id: orbId },
      sq: 2,
    });
    expect(putOn["common|action"]).toEqual({ status: 100 });
    const pocketOrb = pocketItems(putOn["user|pocket"]).find((item) => item.artikul_id === 99);
    const start = await a.objectAction({
      object: "common",
      action: "object",
      form: { code: "ATTACK_BOT", bot_id: MAP_HUNT_SPAWN_ID },
      sq: 3,
    });
    const fightId = huntFightIdFrom(start);
    expect(await a.fight({ rc: "auth", eid: fightId, sq: 4 })).toHaveLength(0);
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
    expect(
      await a.fight({ rc: "castSpell", srcType: 2, srcId: requireId(pocketOrb), sq: 5 }),
    ).toHaveLength(0);
    await a.pollFight();
    const ally = await b.pollFight();
    expect(fightEventTypes(ally)).toContain("effUse");
    expect(await b.fight({ rc: "persEff", persId: heroA, sq: 4 })).toHaveLength(0);
    const inspect = await b.pollFight();
    expect(inspect[0]).toEqual({ rs: true, sq: 4 });
    expect(fightEventTypes(inspect)).toEqual(["persEff", "effUse"]);
    expect(persEffPacket(inspect)).toMatchObject({ et: "persEff", persId: heroA });
  });
});

async function startHunt(
  client: AuthenticatedClient,
  sq: number,
): Promise<Readonly<{ fightId: string; botId: number }>> {
  const start = await client.objectAction({
    object: "common",
    action: "object",
    form: { code: "ATTACK_BOT", bot_id: MAP_HUNT_SPAWN_ID },
    sq,
  });
  const fightId = huntFightIdFrom(start);
  expect(await client.fight({ rc: "auth", eid: fightId, sq: sq + 1 })).toHaveLength(0);
  const authenticated = await client.pollFight();
  const botId = huntOppNewFrom(authenticated).id;
  if (typeof botId !== "number") throw new Error("oppnew id is missing");
  return { fightId, botId };
}

function persEffPacket(frames: readonly AmfValue[]): Record<string, AmfValue> {
  for (const frame of frames) {
    if (!frame || typeof frame !== "object" || Array.isArray(frame)) continue;
    const ev = frame.ev;
    if (!ev || typeof ev !== "object" || Array.isArray(ev)) continue;
    for (const packet of Object.values(ev)) {
      if (!packet || typeof packet !== "object" || Array.isArray(packet)) continue;
      if (packet.et === "persEff") return packet;
    }
  }
  throw new Error("persEff packet is missing");
}

function pocketItems(value: AmfValue | undefined): Record<string, AmfValue>[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("expected object block");
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

function requireId(item: Record<string, AmfValue> | undefined): number {
  if (!item || typeof item.id !== "number") throw new Error("item id is missing");
  return item.id;
}
