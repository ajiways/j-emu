import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import type { AmfValue } from "../../src/modules/jugger-wire/amf/amf3.ts";
import { createIsolatedHero } from "../support/harness/authenticated-client.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";
import { MAP_HUNT_SPAWN_ID } from "../support/harness/map-hunt-spawn.ts";
import {
  fightEventTypes,
  huntFightConfFrom,
  huntOppNewFrom,
} from "../support/harness/wire-payload.ts";
import type { RandomSource } from "../../src/modules/combat/domain/random-source.ts";

const lowDamageRandom: RandomSource = {
  integer(minInclusive) {
    return minInclusive;
  },
  unit() {
    return 0.99;
  },
};

describe("fproxy hunt aggro clone pairing", () => {
  let harness: ApplicationHarness;
  let application: Application;

  beforeEach(async () => {
    harness = new ApplicationHarness();
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("clones Gryzl for a second team-1 hunter and cross-swaps after 3↔3", async () => {
    const a = await createIsolatedHero(application);
    const b = await createIsolatedHero(application);
    await a.objectAction({ object: "common", action: "init", sq: 1 });
    await b.objectAction({ object: "common", action: "init", sq: 1 });
    const start = await a.objectAction({
      object: "common",
      action: "object",
      form: { code: "ATTACK_BOT", bot_id: MAP_HUNT_SPAWN_ID },
      sq: 4,
    });
    const opened = huntFightConfFrom(start);
    expect(await a.fight({ rc: "auth", eid: opened.fightId, sq: 5 })).toHaveLength(0);
    await a.pollFight();
    const join = await b.objectAction({
      object: "common",
      action: "object",
      form: { code: "ATTACK_BOT", bot_id: MAP_HUNT_SPAWN_ID },
      sq: 4,
    });
    expect(huntFightConfFrom(join).fightId).toBe(opened.fightId);
    expect(await b.fight({ rc: "auth", eid: opened.fightId, sq: 5 })).toHaveLength(0);
    await b.pollFight();
    await a.pollFight();
    expect(await a.fight({ rc: "castSpell", srcType: 1, srcId: 7, sq: 6 })).toHaveLength(0);
    const aggro = await a.pollFight();
    expect(fightEventTypes(aggro)).toEqual(
      expect.arrayContaining(["persSpells", "persList", "persChangeInfo"]),
    );
    expect(persListBotIds(aggro)).toHaveLength(2);
    const joined = await b.pollFight();
    expect(fightEventTypes(joined)).toEqual(expect.arrayContaining(["persList", "oppnew"]));
    expect(persListBotIds(joined)).toHaveLength(2);
    await harness.elapseCombat(2500);
    const granted = [...(await a.pollFight()), ...(await b.pollFight())];
    expect(fightEventTypes(granted)).toContain("attacknow");
    let swapped = false;
    for (let round = 0; round < 3; round += 1) {
      expect(await a.fight({ rc: "castSpell", srcType: 1, srcId: 2, sq: 20 + round })).toHaveLength(
        0,
      );
      await a.pollFight();
      expect(await b.fight({ rc: "castSpell", srcType: 1, srcId: 2, sq: 20 + round })).toHaveLength(
        0,
      );
      await b.pollFight();
      await harness.elapseCombat(1400);
      const aBot = await a.pollFight();
      const bBot = await b.pollFight();
      if (round === 2) {
        expect(fightEventTypes(aBot)).not.toContain("oppwait");
        const swappedFrames = [...aBot, ...bBot];
        expect(fightEventTypes(swappedFrames)).toContain("oppnew");
        const switched = oppNewBots(swappedFrames);
        expect(switched.length).toBeGreaterThan(0);
        for (const bot of switched) {
          expect(bot.hp).toBeGreaterThan(0);
          expect(bot.hp).toBeLessThan(bot.maxHp);
        }
        swapped = true;
        break;
      }
      await harness.elapseCombat(1100);
      await a.pollFight();
      await b.pollFight();
    }
    expect(swapped).toBe(true);
  });

  it("switches to the aggro clone after the spawn dies", async () => {
    const hero = await createIsolatedHero(application);
    await hero.objectAction({ object: "common", action: "init", sq: 1 });
    const start = await hero.objectAction({
      object: "common",
      action: "object",
      form: { code: "ATTACK_BOT", bot_id: MAP_HUNT_SPAWN_ID },
      sq: 4,
    });
    const opened = huntFightConfFrom(start);
    expect(await hero.fight({ rc: "auth", eid: opened.fightId, sq: 5 })).toHaveLength(0);
    const boot = await hero.pollFight();
    const spawnId = huntOppNewFrom(boot).id;
    if (typeof spawnId !== "number") throw new Error("spawn oppnew id is missing");
    expect(await hero.fight({ rc: "castSpell", srcType: 1, srcId: 7, sq: 6 })).toHaveLength(0);
    const aggro = await hero.pollFight();
    expect(persListBotIds(aggro)).toHaveLength(2);
    let switched = false;
    for (let strike = 0; strike < 40; strike += 1) {
      expect(
        await hero.fight({ rc: "castSpell", srcType: 1, srcId: 2, sq: 20 + strike }),
      ).toHaveLength(0);
      const melee = await hero.pollFight();
      if (oppNewBots(melee).some((bot) => bot.id !== spawnId)) {
        switched = true;
        break;
      }
      await harness.elapseCombat(1400);
      const bot = await hero.pollFight();
      if (oppNewBots(bot).some((entry) => entry.id !== spawnId)) {
        switched = true;
        break;
      }
      await harness.elapseCombat(1100);
      const granted = await hero.pollFight();
      if (oppNewBots(granted).some((entry) => entry.id !== spawnId)) {
        switched = true;
        break;
      }
    }
    expect(switched).toBe(true);
  });
});

describe("fproxy hunt 3↔3 aggro reserve", () => {
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

  it("switches to the waiting clone after three exchanges", async () => {
    const hero = await createIsolatedHero(application);
    await hero.objectAction({ object: "common", action: "init", sq: 1 });
    const start = await hero.objectAction({
      object: "common",
      action: "object",
      form: { code: "ATTACK_BOT", bot_id: MAP_HUNT_SPAWN_ID },
      sq: 4,
    });
    const opened = huntFightConfFrom(start);
    expect(await hero.fight({ rc: "auth", eid: opened.fightId, sq: 5 })).toHaveLength(0);
    const boot = await hero.pollFight();
    const spawnId = huntOppNewFrom(boot).id;
    if (typeof spawnId !== "number") throw new Error("spawn oppnew id is missing");
    expect(await hero.fight({ rc: "castSpell", srcType: 1, srcId: 7, sq: 6 })).toHaveLength(0);
    await hero.pollFight();
    let switched: number | null = null;
    for (let round = 0; round < 3; round += 1) {
      expect(
        await hero.fight({ rc: "castSpell", srcType: 1, srcId: 2, sq: 20 + round }),
      ).toHaveLength(0);
      const melee = await hero.pollFight();
      expect(fightEventTypes(melee)).not.toContain("fightFinish");
      await harness.elapseCombat(1400);
      const bot = await hero.pollFight();
      const next = oppNewBots(bot).find((entry) => entry.id !== spawnId);
      if (round < 2) {
        expect(next).toBeUndefined();
      } else if (next) {
        switched = next.id;
        expect(next.hp).toBe(next.maxHp);
        break;
      }
      await harness.elapseCombat(1100);
      await hero.pollFight();
    }
    expect(switched).not.toBeNull();
  });
});

function persListBotIds(events: readonly AmfValue[]): number[] {
  for (const event of events) {
    if (!event || typeof event !== "object" || Array.isArray(event)) continue;
    const ev = event["ev"];
    if (!ev || typeof ev !== "object" || Array.isArray(ev)) continue;
    for (const packet of Object.values(ev)) {
      if (!packet || typeof packet !== "object" || Array.isArray(packet)) continue;
      if (packet.et !== "persList") continue;
      const ids: number[] = [];
      for (const [key, row] of Object.entries(packet)) {
        if (key === "et") continue;
        if (!row || typeof row !== "object" || Array.isArray(row)) continue;
        if (row.bot === true && typeof row.id === "number") ids.push(row.id);
      }
      return ids;
    }
  }
  throw new Error("persList bots are missing");
}

function oppNewBots(
  events: readonly AmfValue[],
): readonly Readonly<{ hp: number; maxHp: number; id: number }>[] {
  const bots: Array<{ hp: number; maxHp: number; id: number }> = [];
  for (const event of events) {
    if (!event || typeof event !== "object" || Array.isArray(event)) continue;
    const ev = event["ev"];
    if (!ev || typeof ev !== "object" || Array.isArray(ev)) continue;
    for (const packet of Object.values(ev)) {
      if (!packet || typeof packet !== "object" || Array.isArray(packet)) continue;
      if (packet.et !== "oppnew") continue;
      if (typeof packet.hp !== "number" || typeof packet.maxHp !== "number") {
        throw new Error("oppnew hp is missing");
      }
      if (typeof packet.id !== "number") throw new Error("oppnew id is missing");
      bots.push({ hp: packet.hp, maxHp: packet.maxHp, id: packet.id });
    }
  }
  return bots;
}
