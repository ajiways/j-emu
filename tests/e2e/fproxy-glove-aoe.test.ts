import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import type { RandomSource } from "../../src/modules/combat/domain/random-source.ts";
import type { AmfValue } from "../../src/modules/jugger-wire/amf/amf3.ts";
import { createIsolatedHero } from "../support/harness/authenticated-client.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";
import { MAP_HUNT_SPAWN_ID } from "../support/harness/map-hunt-spawn.ts";
import {
  bagItemByArtikulId,
  fightEventTypes,
  framesIncludeFightFinish,
  huntFightConfFrom,
  huntOppNewFrom,
} from "../support/harness/wire-payload.ts";

const lowDamageRandom: RandomSource = {
  integer(minInclusive) {
    return minInclusive;
  },
  unit() {
    return 0.99;
  },
};

describe("fproxy glove AOE 9099", () => {
  let harness: ApplicationHarness;
  let application: Application;

  beforeEach(async () => {
    harness = new ApplicationHarness(undefined, undefined, {
      combatRandom: lowDamageRandom,
      combatRules: { strPerDamagePoint: 1000 },
    });
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("hits the ally clone as well as the caster's Gryzl", async () => {
    const a = await createIsolatedHero(application);
    const b = await createIsolatedHero(application);
    await putOnGlove(a);
    await b.objectAction({ object: "common", action: "init", sq: 1 });
    const start = await a.objectAction({
      object: "common",
      action: "object",
      form: { code: "ATTACK_BOT", bot_id: MAP_HUNT_SPAWN_ID },
      sq: 3,
    });
    const opened = huntFightConfFrom(start);
    expect(await a.fight({ rc: "auth", eid: opened.fightId, sq: 4 })).toHaveLength(0);
    const aBoot = await a.pollFight();
    const spawnId = huntOppNewFrom(aBoot).id;
    if (typeof spawnId !== "number") throw new Error("spawn oppnew id is missing");
    const hits = cpHitsFrom(aBoot);
    const join = await b.objectAction({
      object: "common",
      action: "object",
      form: { code: "ATTACK_BOT", bot_id: MAP_HUNT_SPAWN_ID },
      sq: 4,
    });
    expect(huntFightConfFrom(join).fightId).toBe(opened.fightId);
    expect(await b.fight({ rc: "auth", eid: opened.fightId, sq: 5 })).toHaveLength(0);
    await b.pollFight();
    expect(
      await a.fight({ rc: "castSpell", srcType: 1, srcId: 7, targetId: spawnId, sq: 6 }),
    ).toHaveLength(0);
    await a.pollFight();
    const joined = await b.pollFight();
    const cloneId = huntOppNewFrom(joined).id;
    if (typeof cloneId !== "number") throw new Error("clone oppnew id is missing");
    expect(cloneId).not.toBe(spawnId);
    let sq = 20;
    for (const hit of hits.slice(0, 4)) {
      expect(await a.fight({ rc: "castSpell", srcType: 1, srcId: hit, sq })).toHaveLength(0);
      sq += 1;
      const melee = await a.pollFight();
      expect(framesIncludeFightFinish(melee)).toBe(false);
      await b.pollFight();
      await harness.elapseCombat(1400);
      expect(framesIncludeFightFinish(await a.pollFight())).toBe(false);
      await b.pollFight();
      await harness.elapseCombat(1100);
      await a.pollFight();
      await b.pollFight();
    }
    expect(await a.fight({ rc: "castSpell", srcType: 3, srcId: 9099, sq })).toHaveLength(0);
    const caster = await a.pollFight();
    expect(caster[0]).toEqual({ rs: true, sq });
    const casterTypes = fightEventTypes(caster);
    expect(casterTypes).toEqual(expect.arrayContaining(["attackwait", "cast", "persChangeInfo"]));
    expect(casterTypes.indexOf("cast")).toBeLessThan(casterTypes.indexOf("persChangeInfo"));
    const casterBots = persChangeBots(caster);
    expect(casterBots.map((bot) => bot.id).sort((left, right) => left - right)).toEqual(
      [spawnId, cloneId].sort((left, right) => left - right),
    );
    const cloneAfter = casterBots.find((bot) => bot.id === cloneId);
    if (!cloneAfter) throw new Error("AOE persChangeInfo is missing the clone");
    expect(cloneAfter.hp).toBeLessThan(cloneAfter.maxHp);
    const ally = await b.pollFight();
    const allyTypes = fightEventTypes(ally);
    expect(allyTypes.indexOf("persChangeInfo")).toBeGreaterThanOrEqual(0);
    expect(allyTypes.indexOf("cast")).toBeLessThan(allyTypes.indexOf("persChangeInfo"));
    const allyBots = persChangeBots(ally);
    const allyClone = allyBots.find((bot) => bot.id === cloneId);
    if (!allyClone) throw new Error("ally persChangeInfo is missing the clone");
    expect(allyClone.hp).toBeLessThan(allyClone.maxHp);
    const allyCast = castPacket(ally);
    expect(allyCast).toMatchObject({
      et: "cast",
      animData: "magic_aoe_light",
      persId: Number(opened.userId),
      targetId: cloneId,
    });
  });
});

async function putOnGlove(client: Awaited<ReturnType<typeof createIsolatedHero>>): Promise<void> {
  const init = await client.objectAction({ object: "common", action: "init", sq: 1 });
  const item = bagItemByArtikulId(init, 9095);
  if (typeof item.id !== "number") throw new Error("9095 item id is missing");
  const putOn = await client.objectAction({
    object: "common",
    action: "object",
    form: { code: "PUT_ON", artifact_id: item.id },
    sq: 2,
  });
  expect(putOn["common|action"]).toEqual({ status: 100 });
}

function cpHitsFrom(events: readonly AmfValue[]): number[] {
  for (const event of events) {
    if (!event || typeof event !== "object" || Array.isArray(event)) continue;
    const ev = event.ev;
    if (!ev || typeof ev !== "object" || Array.isArray(ev)) continue;
    for (const packet of Object.values(ev)) {
      if (!packet || typeof packet !== "object" || Array.isArray(packet)) continue;
      if (packet.et !== "persSelf") continue;
      if (!Array.isArray(packet.cpHits)) throw new Error("persSelf.cpHits is missing");
      const hits = packet.cpHits.filter((hit): hit is number => typeof hit === "number");
      if (hits.length < 4) throw new Error("glove cpHits must cover four combo hits");
      return hits;
    }
  }
  throw new Error("persSelf is missing from fight frames");
}

function persChangeBots(
  events: readonly AmfValue[],
): readonly Readonly<{ id: number; hp: number; maxHp: number }>[] {
  const bots: Array<{ id: number; hp: number; maxHp: number }> = [];
  for (const event of events) {
    if (!event || typeof event !== "object" || Array.isArray(event)) continue;
    const ev = event.ev;
    if (!ev || typeof ev !== "object" || Array.isArray(ev)) continue;
    for (const packet of Object.values(ev)) {
      if (!packet || typeof packet !== "object" || Array.isArray(packet)) continue;
      if (packet.et !== "persChangeInfo") continue;
      if (packet.bot !== true) continue;
      if (typeof packet.id !== "number" || typeof packet.hp !== "number") {
        throw new Error("persChangeInfo bot identity is missing");
      }
      if (typeof packet.maxHp !== "number") throw new Error("persChangeInfo maxHp is missing");
      bots.push({ id: packet.id, hp: packet.hp, maxHp: packet.maxHp });
    }
  }
  if (bots.length === 0) throw new Error("persChangeInfo bots are missing");
  return bots;
}

function castPacket(events: readonly AmfValue[]): Record<string, AmfValue> {
  for (const event of events) {
    if (!event || typeof event !== "object" || Array.isArray(event)) continue;
    const ev = event.ev;
    if (!ev || typeof ev !== "object" || Array.isArray(ev)) continue;
    for (const packet of Object.values(ev)) {
      if (!packet || typeof packet !== "object" || Array.isArray(packet)) continue;
      if (packet.et === "cast") return packet;
    }
  }
  throw new Error("cast packet is missing");
}
