import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import type { AmfValue } from "../../src/modules/jugger-wire/amf/amf3.ts";
import { AuthenticatedClient } from "../support/harness/authenticated-client.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";

describe("character experience progression", () => {
  let harness: ApplicationHarness;
  let application: Application;

  beforeEach(async () => {
    harness = new ApplicationHarness();
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("shows the granted boundary on init after reconnect and process restart", async () => {
    const client = await AuthenticatedClient.login(application);
    const init = await client.objectAction({ object: "common", action: "init", sq: 1 });
    const conf = objectBlock(init["user|conf"]);
    if (typeof conf.id !== "number") throw new Error("user|conf.id is missing");
    const granted = await application.characterProgression.grantExperience({
      characterId: conf.id,
      operationId: `test:${conf.id}:e2e-multi`,
      amount: 472,
    });
    expect(granted).toMatchObject({ expAfter: 473, levelAfter: 4, levelsGained: 3 });

    const afterGrant = await client.objectAction({ object: "common", action: "init", sq: 2 });
    expect(objectBlock(afterGrant["user|conf"])).toMatchObject({ id: conf.id, level: 4 });
    expect(objectBlock(afterGrant.state)).toMatchObject({ level: 4 });
    expect(skillValue(objectBlock(afterGrant["user|skills"]), "VIT")).toBe(13);
    expect(skillValue(objectBlock(afterGrant["user|skills"]), "STR")).toBe(16);
    expect(skillValue(objectBlock(afterGrant["user|skills"]), "HPREG")).toBe("700");
    const init2 = await client.objectAction({ object: "common", action: "init2", sq: 3 });
    expect(objectBlock(init2.state)).toMatchObject({ level: 4 });
    expect(objectBlock(init2["user|unitframe"])).toMatchObject({
      hp: 13,
      hpMax: 13,
      mp: 16,
      mpMax: 16,
      exp: 473,
      expMin: 473,
      expMax: 1013,
    });

    application = await harness.restart();
    const again = new AuthenticatedClient(application, client.cookie);
    const restored = await again.objectAction({ object: "common", action: "init", sq: 20 });
    expect(objectBlock(restored["user|conf"])).toMatchObject({ id: conf.id, level: 4 });
    expect(objectBlock(restored.state)).toMatchObject({ level: 4 });
    expect(skillValue(objectBlock(restored["user|skills"]), "VIT")).toBe(13);
    const restoredFrame = await again.objectAction({ object: "common", action: "init2", sq: 21 });
    expect(objectBlock(restoredFrame["user|unitframe"])).toMatchObject({
      hp: 13,
      mp: 16,
      exp: 473,
      expMin: 473,
      expMax: 1013,
    });
  });
});

function objectBlock(value: AmfValue | undefined): Record<string, AmfValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("expected object block");
  }
  return value;
}

function skillValue(block: Record<string, AmfValue>, id: string): AmfValue {
  const skills = block.skills;
  if (!Array.isArray(skills)) throw new Error("user|skills.skills is missing");
  for (const row of skills) {
    const item = objectBlock(row);
    if (item.id === id) {
      if (item.value === undefined) throw new Error(`skill ${id} value is missing`);
      return item.value;
    }
  }
  throw new Error(`skill ${id} is missing`);
}
