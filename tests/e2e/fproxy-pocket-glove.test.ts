import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import type { AmfValue } from "../../src/modules/jugger-wire/amf/amf3.ts";
import { AuthenticatedClient } from "../support/harness/authenticated-client.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";
import { MAP_HUNT_SPAWN_ID } from "../support/harness/map-hunt-spawn.ts";
import {
  bagItemByArtikulId,
  fightEventTypes,
  framesIncludeFightFinish,
  huntFightIdFrom,
} from "../support/harness/wire-payload.ts";

describe("fproxy pocket glove rage", () => {
  let harness: ApplicationHarness;
  let application: Application;

  beforeEach(async () => {
    harness = new ApplicationHarness();
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("casts 93 with rs-first poll, consumes once, and denies cooldown on HTTP", async () => {
    const client = await AuthenticatedClient.login(application);
    const elixirId = await putOnArtikul(client, 93, 2);
    await startHunt(client, 3);
    expect(
      await client.fight({ rc: "castSpell", srcType: 2, srcId: elixirId, sq: 6 }),
    ).toHaveLength(0);
    const poll = await client.pollFight();
    expect(poll[0]).toEqual({ rs: true, sq: 6 });
    expect(fightEventTypes(poll)).toEqual(["effUse", "cast"]);
    expect(poll.some((frame) => hasRestriction(frame))).toBe(false);

    const denied = await client.fight({ rc: "castSpell", srcType: 2, srcId: elixirId, sq: 7 });
    expect(denied).toEqual([{ rs: false }]);
    expect(denied[0]).not.toHaveProperty("restriction");

    const after = await client.objectAction({ object: "common", action: "init", sq: 8 });
    expect(pocketItems(after["user|pocket"]).filter((item) => item.artikul_id === 93)).toEqual([]);
  });

  it("casts 99 with empty cast ev and without persSpells FX", async () => {
    const client = await AuthenticatedClient.login(application);
    const orbId = await putOnArtikul(client, 99, 2);
    await startHunt(client, 3);
    expect(await client.fight({ rc: "castSpell", srcType: 2, srcId: orbId, sq: 6 })).toHaveLength(
      0,
    );
    const poll = await client.pollFight();
    expect(poll[0]).toEqual({ rs: true, sq: 6 });
    expect(fightEventTypes(poll)).toEqual(["effUse", "cast"]);
    expect(castEv(poll)).toEqual([]);
    expect(JSON.stringify(poll)).not.toContain("persSpells");
  });

  it("casts rage and aggro as rs then FX", async () => {
    const client = await AuthenticatedClient.login(application);
    await putOnArtikul(client, 9095, 2);
    await startHunt(client, 3);
    expect(await client.fight({ rc: "castSpell", srcType: 1, srcId: 1, sq: 6 })).toHaveLength(0);
    await client.pollFight();
    await harness.elapseCombat(1400);
    await client.pollFight();
    expect(await client.fight({ rc: "castSpell", srcType: 1, srcId: 6, sq: 7 })).toHaveLength(0);
    const rage = await client.pollFight();
    expect(rage[0]).toEqual({ rs: true, sq: 7 });
    expect(fightEventTypes(rage)).toEqual(["effUse", "cast"]);
    expect(await client.fight({ rc: "castSpell", srcType: 1, srcId: 7, sq: 8 })).toHaveLength(0);
    const aggro = await client.pollFight();
    expect(aggro[0]).toEqual({ rs: true, sq: 8 });
    expect(fightEventTypes(aggro)).toEqual(["persSpells", "persList", "persChangeInfo"]);
    expect(nativeCount(aggro, 7)).toBe(0);
    expect(persSpellSrcTypes(aggro)).toEqual(expect.arrayContaining([1, 3]));
  });

  it("builds 9095 combo, off-turn persCP, and rs-first finisher", async () => {
    const client = await AuthenticatedClient.login(application);
    await putOnArtikul(client, 9095, 2);
    await startHunt(client, 3);
    expect(await client.fight({ rc: "castSpell", srcType: 1, srcId: 2, sq: 6 })).toHaveLength(0);
    const first = await client.pollFight();
    const meleeFrame = first[0];
    if (meleeFrame === undefined) throw new Error("Melee poll did not return a frame");
    expect(fightEventTypes([meleeFrame])).toEqual(["attackwait", "cast", "persCP"]);
    expect(first.some((frame) => frame && typeof frame === "object" && "rs" in frame)).toBe(true);
    expect(await client.fight({ rc: "castSpell", srcType: 3, srcId: 9098, sq: 7 })).toHaveLength(0);
    const offTurn = await client.pollFight();
    expect(offTurn[0]).toEqual({ rs: true, sq: 7 });
    expect(fightEventTypes(offTurn)).toEqual(["persCP"]);
    if (framesIncludeFightFinish(first)) return;
    await harness.elapseCombat(1400);
    const bot = await client.pollFight();
    if (framesIncludeFightFinish(bot)) return;
    await harness.elapseCombat(1100);
    await client.pollFight();
    expect(await client.fight({ rc: "castSpell", srcType: 1, srcId: 3, sq: 8 })).toHaveLength(0);
    const second = await client.pollFight();
    if (framesIncludeFightFinish(second)) return;
    await harness.elapseCombat(1400);
    const bot2 = await client.pollFight();
    if (framesIncludeFightFinish(bot2)) return;
    await harness.elapseCombat(1100);
    await client.pollFight();
    expect(await client.fight({ rc: "castSpell", srcType: 3, srcId: 9098, sq: 9 })).toHaveLength(0);
    const ending = await client.pollFight();
    expect(ending[0]).toEqual({ rs: true, sq: 9 });
    const endingFx = ending[1];
    if (endingFx === undefined) throw new Error("Ending glove FX frame is missing");
    expect(fightEventTypes([endingFx])).toEqual(expect.arrayContaining(["attackwait", "cast"]));
  });
});

async function putOnArtikul(
  client: AuthenticatedClient,
  artikulId: number,
  sq: number,
): Promise<number> {
  const init = await client.objectAction({ object: "common", action: "init", sq: 1 });
  const itemId = requireId(bagItemByArtikulId(init, artikulId));
  const putOn = await client.objectAction({
    object: "common",
    action: "object",
    form: { code: "PUT_ON", artifact_id: itemId },
    sq,
  });
  expect(putOn["common|action"]).toEqual({ status: 100 });
  if (artikulId === 9095) return itemId;
  const pocket = pocketItems(putOn["user|pocket"]).find((item) => item.artikul_id === artikulId);
  return requireId(pocket);
}

async function startHunt(client: AuthenticatedClient, sq: number): Promise<void> {
  const start = await client.objectAction({
    object: "common",
    action: "object",
    form: { code: "ATTACK_BOT", bot_id: MAP_HUNT_SPAWN_ID },
    sq,
  });
  const fightId = huntFightIdFrom(start);
  expect(await client.fight({ rc: "auth", eid: fightId, sq: sq + 1 })).toHaveLength(0);
  const authenticated = await client.pollFight();
  expect(authenticated[0]).toMatchObject({ rs: true });
}

function objectBlock(value: AmfValue | undefined): Record<string, AmfValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("expected object block");
  }
  return value;
}

function pocketItems(value: AmfValue | undefined): Record<string, AmfValue>[] {
  const pocket = objectBlock(value).pocket;
  if (!Array.isArray(pocket)) throw new Error("user|pocket.pocket is missing");
  return pocket.map((row) => objectBlock(row));
}

function requireId(item: Record<string, AmfValue> | undefined): number {
  if (!item || typeof item.id !== "number") throw new Error("item id is missing");
  return item.id;
}

function hasRestriction(frame: AmfValue): boolean {
  return Boolean(
    frame && typeof frame === "object" && !Array.isArray(frame) && "restriction" in frame,
  );
}

function castEv(frames: readonly AmfValue[]): AmfValue {
  for (const frame of frames) {
    if (!frame || typeof frame !== "object" || Array.isArray(frame)) continue;
    const ev = frame.ev;
    if (!ev || typeof ev !== "object" || Array.isArray(ev)) continue;
    for (const packet of Object.values(ev)) {
      if (!packet || typeof packet !== "object" || Array.isArray(packet)) continue;
      if (packet.et === "cast") return packet.ev ?? null;
    }
  }
  throw new Error("cast packet is missing");
}

function nativeCount(frames: readonly AmfValue[], srcId: number): number {
  for (const frame of frames) {
    if (!frame || typeof frame !== "object" || Array.isArray(frame)) continue;
    const ev = frame.ev;
    if (!ev || typeof ev !== "object" || Array.isArray(ev)) continue;
    for (const packet of Object.values(ev)) {
      if (!packet || typeof packet !== "object" || Array.isArray(packet)) continue;
      if (packet.et !== "persSpells") continue;
      for (const [key, spell] of Object.entries(packet)) {
        if (key === "et") continue;
        if (!spell || typeof spell !== "object" || Array.isArray(spell)) continue;
        if (spell.srcId === srcId && typeof spell.count === "number") return spell.count;
      }
    }
  }
  throw new Error(`native srcId ${srcId} count is missing`);
}

function persSpellSrcTypes(frames: readonly AmfValue[]): number[] {
  for (const frame of frames) {
    if (!frame || typeof frame !== "object" || Array.isArray(frame)) continue;
    const ev = frame.ev;
    if (!ev || typeof ev !== "object" || Array.isArray(ev)) continue;
    for (const packet of Object.values(ev)) {
      if (!packet || typeof packet !== "object" || Array.isArray(packet)) continue;
      if (packet.et !== "persSpells") continue;
      const types: number[] = [];
      for (const [key, spell] of Object.entries(packet)) {
        if (key === "et") continue;
        if (!spell || typeof spell !== "object" || Array.isArray(spell)) continue;
        if (typeof spell.srcType === "number") types.push(spell.srcType);
      }
      if (types.length > 0) return types;
    }
  }
  throw new Error("persSpells srcType list is missing");
}
