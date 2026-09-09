import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import type { AmfValue } from "../../src/modules/jugger-wire/amf/amf3.ts";
import { AuthenticatedClient } from "../support/harness/authenticated-client.ts";
import { MAP_HUNT_SPAWN_ID } from "../support/harness/map-hunt-spawn.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";
import { SequenceRandom } from "../support/fakes/sequence-random.ts";
import { bagItemByArtikulId } from "../support/harness/wire-payload.ts";

describe("inventory UPGRADE", () => {
  let harness: ApplicationHarness;
  let application: Application;

  beforeEach(async () => {
    harness = new ApplicationHarness(undefined, undefined, {
      upgradeRandom: new SequenceRandom(Array.from({ length: 32 }, () => 0)),
    });
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("sharpens chest 20 through six type-3 steps, resonates, and restarts", async () => {
    const client = await AuthenticatedClient.login(application);
    const init = await client.objectAction({ object: "common", action: "init", sq: 1 });
    const chestId = requireNumber(bagItemByArtikulId(init, 20).id);
    expect(bagItemByArtikulId(init, 20)).toMatchObject({
      actions: 523,
      upgrade_id: 0,
      upgrade_level: 0,
      upgrade_add: 0,
    });
    let sq = 2;
    let last: Record<string, AmfValue> | undefined;
    for (let level = 1; level <= 6; level += 1) {
      const crystalId = requireNumber(bagItemByArtikulId(last ?? init, 4603).id);
      last = await client.objectAction({
        object: "common",
        action: "object",
        form: { code: "UPGRADE", object_class: "ARTIFACT", object_id: crystalId },
        in: { artifact_id: chestId },
        sq,
      });
      sq += 1;
      expect(last["common|action"]).toEqual({ status: 100, action: "UPGRADE" });
      expect(bagItemByArtikulId(last, 20)).toMatchObject({
        id: chestId,
        upgrade_id: 3,
        upgrade_level: level,
      });
    }
    const sharpened = bagItemByArtikulId(last!, 20);
    expect(sharpened.upgrade_add).toBe(2);
    expect(sharpened.flags).toBe(32);
    expect(objectBlock(sharpened.artifact_skills).DEF).toMatchObject({
      value: 4,
      upgrade_value: 2,
      upgrade_id: 3,
    });
    expect(objectBlock(sharpened.artifact_skills).INJ_PROB).toMatchObject({
      value: 1,
      upgrade_value: 1,
    });
    expect(() => bagItemByArtikulId(last!, 4603)).toThrow(/4603 is missing/);

    const resonatorId = requireNumber(bagItemByArtikulId(last!, 11408).id);
    const resonated = await client.objectAction({
      object: "common",
      action: "object",
      form: { code: "UPGRADE", object_class: "ARTIFACT", object_id: resonatorId },
      in: { artifact_id: chestId },
      sq,
    });
    sq += 1;
    expect(resonated["common|action"]).toEqual({ status: 100, action: "UPGRADE" });
    expect(bagItemByArtikulId(resonated, 20)).toMatchObject({
      upgrade_id: 3,
      upgrade_level: 6,
    });
    const resonatedSkills = objectBlock(bagItemByArtikulId(resonated, 20).artifact_skills);
    expect(resonatedSkills.DEX).toMatchObject({
      upgrade_value: 2,
    });
    expect(objectBlock(resonatedSkills.DEF).upgrade_value).toBeUndefined();

    const denied = await client.objectAction({
      object: "common",
      action: "object",
      form: {
        code: "UPGRADE",
        object_class: "ARTIFACT",
        object_id: requireNumber(bagItemByArtikulId(resonated, 13224).id),
      },
      in: { artifact_id: chestId },
      sq,
    });
    expect(denied["common|action"]).toEqual({
      status: 203,
      error: "Это действие предмета пока не поддержано.",
    });
    expect(denied["user|bag"]).toBeUndefined();

    application = await harness.restart();
    const again = new AuthenticatedClient(application, client.cookie);
    const restarted = await again.objectAction({ object: "common", action: "init", sq: 90 });
    expect(bagItemByArtikulId(restarted, 20)).toMatchObject({
      id: chestId,
      upgrade_id: 3,
      upgrade_level: 6,
    });
  });

  it("returns flat 203 and consumes the crystal when the roll fails", async () => {
    await harness.stop();
    harness = new ApplicationHarness(undefined, undefined, {
      upgradeRandom: new SequenceRandom([0.95]),
    });
    application = await harness.start();
    const client = await AuthenticatedClient.login(application);
    const init = await client.objectAction({ object: "common", action: "init", sq: 1 });
    const failed = await client.objectAction({
      object: "common",
      action: "object",
      form: {
        code: "UPGRADE",
        object_class: "ARTIFACT",
        object_id: requireNumber(bagItemByArtikulId(init, 1310).id),
      },
      in: { artifact_id: requireNumber(bagItemByArtikulId(init, 20).id) },
      sq: 2,
    });
    expect(failed["common|action"]).toEqual({
      action: "UPGRADE",
      status: 203,
      error: "Заточка не удалась.",
    });
    expect(failed["user|bag"]).toBeTypeOf("object");
    expect(failed["user|skills"]).toBeTypeOf("object");
    expect(() => bagItemByArtikulId(failed, 1310)).toThrow(/1310 is missing/);
    expect(bagItemByArtikulId(failed, 20)).toMatchObject({ upgrade_level: 0 });
  });

  it("denies UPGRADE during an active hunt fight", async () => {
    const client = await AuthenticatedClient.login(application);
    const init = await client.objectAction({ object: "common", action: "init", sq: 1 });
    const start = await client.objectAction({
      object: "common",
      action: "object",
      form: { code: "ATTACK_BOT", bot_id: MAP_HUNT_SPAWN_ID },
      sq: 2,
    });
    expect(start["common|action"]).toEqual({ status: 100 });
    const denied = await client.objectAction({
      object: "common",
      action: "object",
      form: {
        code: "UPGRADE",
        object_class: "ARTIFACT",
        object_id: requireNumber(bagItemByArtikulId(init, 4603).id),
      },
      in: { artifact_id: requireNumber(bagItemByArtikulId(init, 20).id) },
      sq: 3,
    });
    expect(denied["common|action"]).toEqual({
      status: 203,
      error: "нельзя во время боя",
    });
    expect(denied["user|bag"]).toBeUndefined();
  });
});

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
