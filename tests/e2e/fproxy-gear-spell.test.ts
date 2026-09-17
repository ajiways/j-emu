import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import type { AmfValue } from "../../src/modules/jugger-wire/amf/amf3.ts";
import { AuthenticatedClient } from "../support/harness/authenticated-client.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";
import { MAP_HUNT_SPAWN_ID } from "../support/harness/map-hunt-spawn.ts";
import {
  bagItemByArtikulId,
  fightEventTypes,
  heroIdFrom,
  huntFightIdFrom,
} from "../support/harness/wire-payload.ts";
import { insertBagArtifacts } from "../support/postgres/insert-bag-artifacts.ts";

const TYRANT_GLOVE = 20546;
const L7_GRANT = 3622;
const PICTURE = "dosp_tir_mif_mag.png";

describe("fproxy gear spell 20546", () => {
  describe("default combat rules", () => {
    let harness: ApplicationHarness;
    let application: Application;

    beforeEach(async () => {
      harness = new ApplicationHarness();
      application = await harness.start();
    });

    afterEach(async () => {
      await harness.stop();
    });

    it("PUT_ON outside a fight only mutates paperdoll", async () => {
      const client = await AuthenticatedClient.login(application);
      const equipped = await equipTyrantGlove(application, client);
      expect(equipped.putOn["common|action"]).toEqual({ status: 100 });
      expect(equipped.putOn["fight|conf"]).toBeUndefined();
      expect(viewArtifactByArtikul(equipped.putOn["user|view"], TYRANT_GLOVE)).toMatchObject({
        artikul_id: TYRANT_GLOVE,
        slot: 32,
        picture: PICTURE,
      });
    });

    it("bootstraps persEff then effUse, and does not proc on hits", async () => {
      const client = await AuthenticatedClient.login(application);
      const equipped = await equipTyrantGlove(application, client);
      const start = await client.objectAction({
        object: "common",
        action: "object",
        form: { code: "ATTACK_BOT", bot_id: MAP_HUNT_SPAWN_ID },
        sq: equipped.sq,
      });
      const fightId = huntFightIdFrom(start);
      expect(await client.fight({ rc: "auth", eid: fightId, sq: equipped.sq + 1 })).toHaveLength(0);
      const authenticated = await client.pollFight();
      const types = fightEventTypes(authenticated);
      const persSpellsAt = types.indexOf("persSpells");
      const persEffAt = types.indexOf("persEff");
      const effUseAt = types.indexOf("effUse");
      expect(persSpellsAt).toBeGreaterThanOrEqual(0);
      expect(persEffAt).toBeGreaterThan(persSpellsAt);
      expect(effUseAt).toBe(persEffAt + 1);
      expect(nestedPersEff(authenticated, equipped.heroId)).toMatchObject({
        id: 1,
        kind: 3,
        persId: equipped.heroId,
        sourceId: equipped.heroId,
        artikulId: TYRANT_GLOVE,
        title: "Изначальная мифическая перчатка тирана VI",
        img: PICTURE,
        dmgType: 0,
        remainTime: 320,
        groupId: 936,
      });
      expect(standingEffUse(authenticated, equipped.heroId)).toMatchObject({
        et: "effUse",
        id: 1,
        persId: equipped.heroId,
        sourceId: equipped.heroId,
        artikulId: TYRANT_GLOVE,
        img: PICTURE,
        kind: 3,
        flags: 0,
        dmgType: 0,
        remainTime: 320,
        groupId: 936,
        skills: { STR: 5 },
      });

      expect(
        await client.fight({ rc: "castSpell", srcType: 1, srcId: 1, sq: equipped.sq + 2 }),
      ).toHaveLength(0);
      const melee = await client.pollFight();
      const meleeFrame = melee[0];
      if (meleeFrame === undefined) throw new Error("Melee poll did not return a frame");
      expect(fightEventTypes([meleeFrame])).toEqual(["attackwait", "cast"]);
      expect(fightEventTypes(melee)).not.toContain("effUse");
      expect(fightEventTypes(melee)).not.toContain("persEff");
      expect(melee.some((frame) => frame && typeof frame === "object" && "rs" in frame)).toBe(true);
    });

    it("keeps remaining remainTime across same-process reconnect", async () => {
      const client = await AuthenticatedClient.login(application);
      const equipped = await equipTyrantGlove(application, client);
      const start = await client.objectAction({
        object: "common",
        action: "object",
        form: { code: "ATTACK_BOT", bot_id: MAP_HUNT_SPAWN_ID },
        sq: equipped.sq,
      });
      const fightId = huntFightIdFrom(start);
      expect(await client.fight({ rc: "auth", eid: fightId, sq: equipped.sq + 1 })).toHaveLength(0);
      await client.pollFight();
      expect(
        await client.fight({ rc: "castSpell", srcType: 1, srcId: 1, sq: equipped.sq + 2 }),
      ).toHaveLength(0);
      await client.pollFight();

      await client.objectAction({ object: "common", action: "init", sq: 20 });
      const init2 = await client.objectAction({ object: "common", action: "init2", sq: 21 });
      expect(huntFightIdFrom(init2)).toBe(fightId);
      expect(await client.fight({ rc: "auth", eid: fightId, sq: 22 })).toHaveLength(0);
      const again = await client.pollFight();
      expect(nestedPersEff(again, equipped.heroId)).toMatchObject({
        remainTime: 280,
        artikulId: TYRANT_GLOVE,
        img: PICTURE,
      });
      expect(standingEffUse(again, equipped.heroId)).toMatchObject({
        remainTime: 280,
        skills: { STR: 5 },
        img: PICTURE,
      });
    });

    it("drops the fight on process restart and keeps 20546 in paperdoll", async () => {
      const client = await AuthenticatedClient.login(application);
      const equipped = await equipTyrantGlove(application, client);
      const start = await client.objectAction({
        object: "common",
        action: "object",
        form: { code: "ATTACK_BOT", bot_id: MAP_HUNT_SPAWN_ID },
        sq: equipped.sq,
      });
      const fightId = huntFightIdFrom(start);
      application = await harness.restart();
      const restarted = new AuthenticatedClient(application, client.cookie);
      const again = await restarted.objectAction({ object: "common", action: "init", sq: 20 });
      expect(heroIdFrom(again)).toBe(equipped.heroId);
      const view = await restarted.objectAction({ object: "user", action: "view", sq: 21 });
      expect(viewArtifactByArtikul(view["user|view"], TYRANT_GLOVE)).toMatchObject({
        artikul_id: TYRANT_GLOVE,
        slot: 32,
        picture: PICTURE,
      });
      const hunt = await restarted.objectAction({
        object: "common",
        action: "object",
        form: { code: "ATTACK_BOT", bot_id: MAP_HUNT_SPAWN_ID },
        sq: 22,
      });
      expect(hunt["common|action"]).toEqual({ status: 100 });
      expect(huntFightIdFrom(hunt)).not.toBe(fightId);
    });
  });

  describe("low melee damage", () => {
    let harness: ApplicationHarness;
    let application: Application;

    beforeEach(async () => {
      harness = new ApplicationHarness(undefined, undefined, {
        combatRules: { strPerDamagePoint: 10_000 },
      });
      application = await harness.start();
    });

    afterEach(async () => {
      await harness.stop();
    });

    it("emits effPurge in the 8th melee poll after cast", async () => {
      const client = await AuthenticatedClient.login(application);
      const equipped = await equipTyrantGlove(application, client);
      const start = await client.objectAction({
        object: "common",
        action: "object",
        form: { code: "ATTACK_BOT", bot_id: MAP_HUNT_SPAWN_ID },
        sq: equipped.sq,
      });
      const fightId = huntFightIdFrom(start);
      expect(await client.fight({ rc: "auth", eid: fightId, sq: equipped.sq + 1 })).toHaveLength(0);
      await client.pollFight();
      const sides = [1, 2, 3] as const;
      for (let strike = 0; strike < 8; strike += 1) {
        const srcId = sides[strike % sides.length];
        if (srcId === undefined) throw new Error("melee side is missing");
        expect(
          await client.fight({
            rc: "castSpell",
            srcType: 1,
            srcId,
            sq: equipped.sq + 2 + strike,
          }),
        ).toHaveLength(0);
        const melee = await client.pollFight();
        const meleeFrame = melee[0];
        if (meleeFrame === undefined) throw new Error("Melee poll did not return a frame");
        const types = fightEventTypes([meleeFrame]);
        expect(types[0]).toBe("attackwait");
        expect(types).toContain("cast");
        expect(types).not.toContain("timeAdvance");
        if (strike < 7) {
          expect(types).toEqual(["attackwait", "cast"]);
        } else {
          expect(types).toEqual(["attackwait", "cast", "effPurge"]);
          expect(purgeEffectId(meleeFrame)).toBe(1);
        }
        expect(melee.some((frame) => frame && typeof frame === "object" && "rs" in frame)).toBe(
          true,
        );
        await harness.elapseCombat(1400);
        await client.pollFight();
        await harness.elapseCombat(1100);
        await client.pollFight();
      }
    });
  });
});

async function equipTyrantGlove(
  application: Application,
  client: AuthenticatedClient,
): Promise<Readonly<{ heroId: number; sq: number; putOn: Record<string, AmfValue> }>> {
  const init = await client.objectAction({ object: "common", action: "init", sq: 1 });
  const heroId = heroIdFrom(init);
  await application.characterProgression.grantExperience({
    characterId: heroId,
    operationId: `test:${heroId}:gear-l7`,
    amount: L7_GRANT,
  });
  await insertBagArtifacts(heroId, [
    { artifactId: TYRANT_GLOVE, durability: 40, durabilityMax: 40 },
  ]);
  const bag = await client.objectAction({ object: "common", action: "init", sq: 2 });
  const itemId = requireNumber(bagItemByArtikulId(bag, TYRANT_GLOVE).id);
  const putOn = await client.objectAction({
    object: "common",
    action: "action",
    form: { code: "PUT_ON", artifact_id: itemId },
    sq: 3,
  });
  expect(putOn["common|action"]).toEqual({ status: 100 });
  return { heroId, sq: 4, putOn };
}

function nestedPersEff(events: readonly AmfValue[], persId: number): Record<string, AmfValue> {
  const packet = fightPacket(
    events,
    "persEff",
    (item) => item.persId === persId && item["1"] !== undefined,
  );
  const nested = packet["1"];
  if (!nested || typeof nested !== "object" || Array.isArray(nested)) {
    throw new Error("persEff nested 1 is missing");
  }
  return nested;
}

function standingEffUse(events: readonly AmfValue[], persId: number): Record<string, AmfValue> {
  return fightPacket(
    events,
    "effUse",
    (item) => item.persId === persId && item.artikulId === TYRANT_GLOVE,
  );
}

function purgeEffectId(frame: AmfValue): number {
  const packet = fightPacket([frame], "effPurge", () => true);
  if (typeof packet.effectId !== "number") throw new Error("effPurge effectId is missing");
  return packet.effectId;
}

function fightPacket(
  events: readonly AmfValue[],
  et: string,
  match: (item: Record<string, AmfValue>) => boolean,
): Record<string, AmfValue> {
  for (const event of events) {
    if (!event || typeof event !== "object" || Array.isArray(event)) continue;
    const ev = event["ev"];
    if (!ev || typeof ev !== "object" || Array.isArray(ev)) continue;
    for (const item of Object.values(ev)) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      if (item.et !== et) continue;
      if (match(item)) return item;
    }
  }
  throw new Error(`${et} packet is missing`);
}

function viewArtifactByArtikul(
  block: AmfValue | undefined,
  artikulId: number,
): Record<string, AmfValue> | undefined {
  const artifacts = objectBlock(block).artifacts;
  if (!Array.isArray(artifacts)) throw new Error("user|view.artifacts is missing");
  for (const row of artifacts) {
    const item = objectBlock(row);
    if (item.artikul_id === artikulId) return item;
  }
  return undefined;
}

function objectBlock(value: AmfValue | undefined): Record<string, AmfValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("expected object block");
  }
  return value;
}

function requireNumber(value: AmfValue | undefined): number {
  if (typeof value !== "number") throw new Error("expected a number");
  return value;
}
