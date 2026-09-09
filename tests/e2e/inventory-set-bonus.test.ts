import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import type { AmfValue } from "../../src/modules/jugger-wire/amf/amf3.ts";
import { AuthenticatedClient } from "../support/harness/authenticated-client.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";
import { bagItemByArtikulId, heroIdFrom } from "../support/harness/wire-payload.ts";
import { insertBagArtifacts } from "../support/postgres/insert-bag-artifacts.ts";

const RECRUIT_5 = [30, 35, 33, 27, 28] as const;
const L12_GRANT = 122_872;

describe("inventory set bonuses", () => {
  let harness: ApplicationHarness;
  let application: Application;

  beforeEach(async () => {
    harness = new ApplicationHarness();
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("overlays the recruit portrait at 4 and hangs TEMPEFFECT 106 at 5", async () => {
    const client = await AuthenticatedClient.login(application);
    const init = await client.objectAction({ object: "common", action: "init", sq: 1 });
    const characterId = heroIdFrom(init);
    await application.characterProgression.grantExperience({
      characterId,
      operationId: `test:${characterId}:set-l12`,
      amount: L12_GRANT,
    });
    await insertBagArtifacts(
      characterId,
      RECRUIT_5.map((artifactId) => ({ artifactId, durability: 30, durabilityMax: 30 })),
    );

    let sq = 2;
    let last = await client.objectAction({ object: "common", action: "init", sq });
    sq += 1;
    for (const artikulId of RECRUIT_5.slice(0, 4)) {
      const itemId = requireNumber(bagItemByArtikulId(last, artikulId).id);
      last = await client.objectAction({
        object: "common",
        action: "action",
        form: { code: "PUT_ON", artifact_id: itemId },
        sq,
      });
      sq += 1;
      expect(last["common|action"]).toEqual({ status: 100 });
    }
    expect(objectBlock(last["user|view"]).avatar_big).toBe("avatar_m_set_1_gray.png");
    expect(objectBlock(last["user|unitframe"]).avatar_small).toBe("avatar_m_set_1_gray_sm.png");
    expect(viewArtifactByArtikul(last["user|view"], 106)).toBeUndefined();
    expect(skillValue(last["user|skills"], "VIT")).toBe(75);

    const helmId = requireNumber(bagItemByArtikulId(last, 28).id);
    const five = await client.objectAction({
      object: "common",
      action: "action",
      form: { code: "PUT_ON", artifact_id: helmId },
      sq,
    });
    sq += 1;
    expect(five["common|action"]).toEqual({ status: 100 });
    const bonus = viewArtifactByArtikul(five["user|view"], 106);
    if (!bonus) throw new Error("set bonus 106 is missing");
    expect(bonus).toMatchObject({
      artikul_id: 106,
      kind_id: 139,
      slot: 134_217_728,
      cnt: 0,
      expire: 0,
      picture: "",
      actions: 16,
    });
    expect(objectBlock(bonus.artifact_skills).STR).toMatchObject({ skill_id: "STR", value: 7 });
    expect(skillValue(five["user|skills"], "VIT")).toBe(95);
    expect(skillValue(five["user|skills"], "STR")).toBe(113);

    const bonusId = requireNumber(bonus.id);
    const putOffBonus = await client.objectAction({
      object: "common",
      action: "object",
      form: { code: "PUT_OFF", artifact_id: bonusId },
      sq,
    });
    sq += 1;
    expect(putOffBonus["common|action"]).toEqual({ status: 100 });
    expect(viewArtifactByArtikul(putOffBonus["user|view"], 106)).toMatchObject({
      artikul_id: 106,
      slot: 134_217_728,
    });

    application = await harness.restart();
    const again = new AuthenticatedClient(application, client.cookie);
    const restored = await again.objectAction({ object: "user", action: "view", sq: 40 });
    expect(objectBlock(restored["user|view"]).avatar_big).toBe("avatar_m_set_1_gray.png");
    expect(viewArtifactByArtikul(restored["user|view"], 106)).toMatchObject({
      artikul_id: 106,
      slot: 134_217_728,
      expire: 0,
    });
  });

  it("returns 204 when mixing assassin and guardian trends", async () => {
    const client = await AuthenticatedClient.login(application);
    const init = await client.objectAction({ object: "common", action: "init", sq: 1 });
    const characterId = heroIdFrom(init);
    await application.characterProgression.grantExperience({
      characterId,
      operationId: `test:${characterId}:set-mix`,
      amount: L12_GRANT,
    });
    await insertBagArtifacts(characterId, [
      { artifactId: 43, durability: 30, durabilityMax: 30 },
      { artifactId: 46, durability: 30, durabilityMax: 30 },
    ]);
    const bag = await client.objectAction({ object: "common", action: "init", sq: 2 });
    const gloveId = requireNumber(bagItemByArtikulId(bag, 43).id);
    const helmId = requireNumber(bagItemByArtikulId(bag, 46).id);
    const putOn = await client.objectAction({
      object: "common",
      action: "action",
      form: { code: "PUT_ON", artifact_id: gloveId },
      sq: 3,
    });
    expect(putOn["common|action"]).toEqual({ status: 100 });
    const mixed = await client.objectAction({
      object: "common",
      action: "action",
      form: { code: "PUT_ON", artifact_id: helmId },
      sq: 4,
    });
    expect(mixed["common|action"]).toEqual({
      status: 204,
      error: "Эту вещь нельзя надеть!",
    });
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

function requireNumber(value: AmfValue | undefined): number {
  if (typeof value !== "number") throw new Error("expected a number");
  return value;
}
