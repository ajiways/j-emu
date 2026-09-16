import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import type { AmfValue } from "../../src/modules/jugger-wire/amf/amf3.ts";
import { AuthenticatedClient } from "../support/harness/authenticated-client.ts";
import { MAP_HUNT_SPAWN_ID } from "../support/harness/map-hunt-spawn.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";
import {
  bagItemByArtikulId,
  fightEventTypes,
  heroIdFrom,
  huntFightIdFrom,
} from "../support/harness/wire-payload.ts";
import { NAKED_HERO_BODY, wornHeroBodyFromGenerated } from "../support/worn-hero-body.ts";

const GLOVE_BODY = wornHeroBodyFromGenerated(9095);
const SHOP_GLOVE_POOL = [497, 179, 499, 177, 175, 498];

describe("inventory equipment", () => {
  let harness: ApplicationHarness;
  let application: Application;

  beforeEach(async () => {
    harness = new ApplicationHarness();
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("equips glove 9095, updates stats, and returns the same instance on PUT_OFF", async () => {
    const client = await AuthenticatedClient.login(application);
    const init = await client.objectAction({ object: "common", action: "init", sq: 1 });
    const glove = bagItemByArtikulId(init, 9095);
    const itemId = requireNumber(glove.id);
    expect(glove.artikul_id).toBe(9095);
    expect(glove.picture).toBe("greyset5_lhand.png");
    expect(glove.slot).toBe(0);
    expect(glove.hits).toEqual([2, 3, 2, 3, 1, 2, 3, 1]);
    expect(glove.spells).toEqual([
      gloveSpellCard(9098, "Разряд молнии", "electro_ball1.png", 2),
      gloveSpellCard(9100, "Жажда крови", "kaban_magic_mosch.png", 3),
      gloveSpellCard(9099, "Волна света", "ludoed_magic_light.png", 4),
    ]);
    expect(glove.extra).toEqual({ hits: glove.hits, spells: glove.spells });
    expect(objectBlock(glove.artifact_skills).VIT).toMatchObject({
      title: "Здоровье",
      skill_id: "VIT",
      value: 5,
    });
    expect(skillValue(init["user|skills"], "VIT")).toBe(10);

    const putOn = await client.objectAction({
      object: "common",
      action: "action",
      form: { code: "PUT_ON", artifact_id: itemId },
      sq: 2,
    });
    expect(putOn["common|action"]).toEqual({ status: 100 });
    expect(objectBlock(putOn["user|bag"])).toMatchObject({ status: 100, amount: 6, total: 11 });
    const equipped = firstArtifact(putOn["user|view"]);
    expect(equipped).toMatchObject({
      id: itemId,
      artikul_id: 9095,
      picture: "greyset5_lhand.png",
      slot: 32,
      cnt: 0,
      actions: 16,
      hits: [2, 3, 2, 3, 1, 2, 3, 1],
    });
    expect(equipped.spells).toEqual(glove.spells);
    expect(equipped.extra).toEqual({ hits: glove.hits, spells: glove.spells });
    expect(putOn["user|magic"]).toMatchObject({
      status: 100,
      gloves: [{ id: itemId, artikul_id: 9095, spells: glove.spells }],
    });
    expect(objectBlock(equipped.artifact_skills).STR).toMatchObject({
      title: "Сила",
      skill_id: "STR",
      value: 6,
    });
    expect(skillValue(putOn["user|skills"], "VIT")).toBe(15);
    expect(skillValue(putOn["user|skills"], "STR")).toBe(18);
    expect(objectBlock(putOn["user|view"]).body).toBe(GLOVE_BODY);
    expect(objectBlock(putOn["user|unitframe"])).toMatchObject({
      hp: 15,
      hpMax: 15,
      mp: 12,
      mpMax: 12,
    });
    expect(objectBlock(putOn.state)).toMatchObject({ hp: 15, hp_max: 15 });
    expect(objectBlock(putOn["user|conf"]).status).toBe(100);
    expect(putOn["user|pocket"]).toMatchObject({ status: 100 });

    const view = await client.objectAction({ object: "user", action: "view", sq: 3 });
    expect(firstArtifact(view["user|view"]).id).toBe(itemId);

    application = await harness.restart();
    const again = new AuthenticatedClient(application, client.cookie);
    const afterRestart = await again.objectAction({ object: "common", action: "init", sq: 20 });
    expect(objectBlock(afterRestart["user|bag"]).amount).toBe(6);
    expect(skillValue(afterRestart["user|skills"], "VIT")).toBe(15);
    expect(afterRestart["user|magic"]).toMatchObject({
      status: 100,
      gloves: [{ id: itemId, artikul_id: 9095 }],
    });
    const viewAfter = await again.objectAction({ object: "user", action: "view", sq: 21 });
    expect(firstArtifact(viewAfter["user|view"])).toMatchObject({
      id: itemId,
      artikul_id: 9095,
      slot: 32,
    });
    expect(objectBlock(viewAfter["user|view"]).body).toBe(GLOVE_BODY);
    const frame = await again.objectAction({ object: "user", action: "unitframe", sq: 22 });
    expect(objectBlock(frame["user|unitframe"])).toMatchObject({ hp: 15, hpMax: 15 });

    const putOff = await again.objectAction({
      object: "common",
      action: "object",
      form: { code: "PUT_OFF", object_id: itemId },
      sq: 23,
    });
    expect(putOff["common|action"]).toEqual({ status: 100 });
    expect(bagItemByArtikulId(putOff, 9095).id).toBe(itemId);
    expect(putOff["user|magic"]).toEqual({ status: 100, gloves: [] });
    expect(objectBlock(putOff["user|view"]).artifacts).toEqual([]);
    expect(objectBlock(putOff["user|view"]).body).toBe(NAKED_HERO_BODY);
    expect(skillValue(putOff["user|skills"], "VIT")).toBe(10);
    expect(objectBlock(putOff["user|unitframe"])).toMatchObject({ hp: 10, hpMax: 10 });
  });

  it("returns status 203 for a forbidden wear and 204 when the item is missing", async () => {
    const client = await AuthenticatedClient.login(application);
    const init = await client.objectAction({ object: "common", action: "init", sq: 1 });
    const itemId = requireNumber(bagItemByArtikulId(init, 9095).id);

    const missingId = await client.objectAction({
      object: "common",
      action: "object",
      form: { code: "PUT_ON" },
      sq: 2,
    });
    expect(missingId["common|action"]).toEqual({
      status: 203,
      error: "PUT_ON/PUT_OFF requires artifact_id",
    });

    const putOffBag = await client.objectAction({
      object: "common",
      action: "object",
      form: { code: "PUT_OFF", artifact_id: itemId },
      sq: 3,
    });
    expect(putOffBag["common|action"]).toEqual({
      status: 203,
      error: "Этот предмет нельзя снять",
    });

    const missingItem = await client.objectAction({
      object: "common",
      action: "object",
      form: { code: "PUT_ON", artifact_id: 100_001 },
      sq: 4,
    });
    const error = objectBlock(missingItem["common|action"]);
    expect(error.status).toBe(204);
    expect(String(error.error)).toMatch(/Item 100001 .* is missing/);
    expect(missingItem["user|bag"]).toBeUndefined();
  });

  it("denies paperdoll PUT_ON and PUT_OFF while a hunt fight is active", async () => {
    const client = await AuthenticatedClient.login(application);
    const init = await client.objectAction({ object: "common", action: "init", sq: 1 });
    const itemId = requireNumber(bagItemByArtikulId(init, 9095).id);
    const equipped = await client.objectAction({
      object: "common",
      action: "action",
      form: { code: "PUT_ON", artifact_id: itemId },
      sq: 2,
    });
    expect(equipped["common|action"]).toEqual({ status: 100 });
    const start = await client.objectAction({
      object: "common",
      action: "object",
      form: { code: "ATTACK_BOT", bot_id: MAP_HUNT_SPAWN_ID },
      sq: 3,
    });
    expect(start["common|action"]).toEqual({ status: 100 });
    const putOff = await client.objectAction({
      object: "common",
      action: "object",
      form: { code: "PUT_OFF", artifact_id: itemId },
      sq: 4,
    });
    expect(putOff["common|action"]).toEqual({
      status: 203,
      error: "нельзя во время боя",
    });
    const putOn = await client.objectAction({
      object: "common",
      action: "object",
      form: { code: "PUT_ON", artifact_id: itemId },
      sq: 5,
    });
    expect(putOn["common|action"]).toEqual({
      status: 203,
      error: "нельзя во время боя",
    });
    const view = await client.objectAction({ object: "user", action: "view", sq: 6 });
    expect(firstArtifact(view["user|view"])).toMatchObject({ id: itemId, slot: 32 });
  });

  it("rolls shop glove 23 spells into bag, user|magic, and hunt persSpells", async () => {
    const client = await AuthenticatedClient.login(application);
    const init = await client.objectAction({ object: "common", action: "init", sq: 1 });
    await application.characterProgression.grantExperience({
      characterId: heroIdFrom(init),
      operationId: `test:${heroIdFrom(init)}:glove-23-l2`,
      amount: 472,
    });
    const shop = await client.objectAction({
      object: "common",
      action: "action",
      form: { code: "COME_IN", area_id: 504 },
      sq: 2,
    });
    expect(shop["common|action"]).toEqual({ status: 100, action: "COME_IN" });
    const bought = await client.objectAction({
      object: "store",
      action: "buy",
      form: { basket: { "80": 1 } },
      sq: 3,
    });
    expect(bought["store|buy"]).toEqual({ status: 100 });
    const glove = bagItemByArtikulId(bought, 23);
    const itemId = requireNumber(glove.id);
    expect(glove.spells).toEqual([
      expect.objectContaining({
        artikul_id0: expect.any(Number),
        cost: 6,
        row: 1,
      }),
    ]);
    const spellId = requireNumber(objectBlock(asFirst(glove.spells)).artikul_id0);
    expect(SHOP_GLOVE_POOL).toContain(spellId);
    const putOn = await client.objectAction({
      object: "common",
      action: "action",
      form: { code: "PUT_ON", artifact_id: itemId },
      sq: 4,
    });
    expect(putOn["common|action"]).toEqual({ status: 100 });
    expect(putOn["user|magic"]).toMatchObject({
      status: 100,
      gloves: [{ id: itemId, artikul_id: 23, spells: glove.spells }],
    });
    const back = await client.objectAction({ object: "common", action: "exit", sq: 5 });
    expect(back["common|exit"]).toEqual({ status: 100 });
    const start = await client.objectAction({
      object: "common",
      action: "object",
      form: { code: "ATTACK_BOT", bot_id: MAP_HUNT_SPAWN_ID },
      sq: 6,
    });
    expect(start["common|action"]).toEqual({ status: 100 });
    const fightId = huntFightIdFrom(start);
    expect(await client.fight({ rc: "auth", eid: fightId, sq: 7 })).toHaveLength(0);
    const authenticated = await client.pollFight();
    expect(fightEventTypes(authenticated)).toEqual(expect.arrayContaining(["persSpells"]));
    expect(JSON.stringify(authenticated)).toContain(`"srcId":${spellId}`);
  });
});

function objectBlock(value: AmfValue | undefined): Record<string, AmfValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("expected object block");
  }
  return value;
}

function skillValue(block: AmfValue | undefined, id: string): number {
  const skills = objectBlock(block).skills;
  if (!Array.isArray(skills)) throw new Error("user|skills.skills is missing");
  for (const row of skills) {
    const item = objectBlock(row);
    if (item.id === id) {
      if (typeof item.value !== "number") throw new Error(`skill ${id} value is not a number`);
      return item.value;
    }
  }
  throw new Error(`skill ${id} is missing`);
}

function firstArtifact(block: AmfValue | undefined): Record<string, AmfValue> {
  const artifacts = objectBlock(block).artifacts;
  if (!Array.isArray(artifacts) || artifacts.length < 1) {
    throw new Error("user|view.artifacts is empty");
  }
  return objectBlock(artifacts[0]);
}

function requireNumber(value: AmfValue | undefined): number {
  if (typeof value !== "number") throw new Error("expected a number");
  return value;
}

function asFirst(value: AmfValue | undefined): AmfValue {
  if (!Array.isArray(value) || value[0] === undefined) throw new Error("expected a nonempty array");
  return value[0];
}

function gloveSpellCard(
  artikulId: number,
  title: string,
  picture: string,
  cost: number,
): Record<string, unknown> {
  return {
    id: artikulId,
    artikul_id: artikulId,
    artikul_id0: artikulId,
    title,
    picture,
    description: "",
    quality: 0,
    row: 1,
    cost,
  };
}
