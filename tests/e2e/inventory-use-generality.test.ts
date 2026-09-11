import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import type { AmfValue } from "../../src/modules/jugger-wire/amf/amf3.ts";
import { AuthenticatedClient } from "../support/harness/authenticated-client.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";
import { bagItemByArtikulId, heroIdFrom } from "../support/harness/wire-payload.ts";
import { insertBagArtifacts } from "../support/postgres/insert-bag-artifacts.ts";
import { FakeClock } from "../support/fake-clock.ts";

const L6_GRANT = 1822;
const START_MS = Date.parse("2026-09-07T12:00:00.000Z");

describe("inventory USE generality", () => {
  let harness: ApplicationHarness;
  let application: Application;
  let clock: FakeClock;

  beforeEach(async () => {
    clock = new FakeClock(START_MS);
    harness = new ApplicationHarness(clock);
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("drinks bread 640 into TEMPEFFECT, overlays VIT, and PUT_OFF deletes it", async () => {
    const client = await AuthenticatedClient.login(application);
    const init = await client.objectAction({ object: "common", action: "init", sq: 1 });
    const characterId = heroIdFrom(init);
    expect(skillNumber(init["user|skills"], "VIT")).toBe(10);
    await insertBagArtifacts(characterId, [{ artifactId: 640, durability: 0, durabilityMax: 0 }]);
    const bag = await client.objectAction({ object: "common", action: "init", sq: 2 });
    const bread = bagItemByArtikulId(bag, 640);
    expect(bread).toMatchObject({
      artikul_id: 640,
      cnt: 1,
      actions: 7,
      type_id: "10",
      kind_id: 48,
    });
    const used = await client.objectAction({
      object: "common",
      action: "action",
      form: { object_class: "ARTIFACT", object_id: requireNumber(bread.id) },
      sq: 3,
    });
    expect(used["common|action"]).toEqual({
      status: 100,
      action: "USE",
      msg_text: "Вы использовали Съесть.",
    });
    expect(skillNumber(used["user|skills"], "VIT")).toBe(14);
    const effect = viewArtifactByArtikul(used["user|view"], 640);
    if (!effect) throw new Error("bread TEMPEFFECT is missing");
    expect(effect).toMatchObject({
      artikul_id: 640,
      slot: 134_217_728,
      cnt: 0,
      kind_id: 48,
    });
    const expire = requireNumber(effect.expire);
    expect(expire).toBe(clock.unixSeconds() + 1800);

    application = await harness.restart();
    const again = new AuthenticatedClient(application, client.cookie);
    const restored = await again.objectAction({ object: "user", action: "view", sq: 20 });
    expect(viewArtifactByArtikul(restored["user|view"], 640)).toMatchObject({
      artikul_id: 640,
      expire,
    });
    const off = await again.objectAction({
      object: "common",
      action: "object",
      form: { code: "PUT_OFF", artifact_id: requireNumber(effect.id) },
      sq: 21,
    });
    expect(off["common|action"]).toEqual({ status: 100 });
    expect(viewArtifactByArtikul(off["user|view"], 640)).toBeUndefined();
    expect(skillNumber(off["user|skills"], "VIT")).toBe(10);
  });

  it("teaches AGRILKA_MOBOV from book 623 and denies a second read", async () => {
    const client = await AuthenticatedClient.login(application);
    const init = await client.objectAction({ object: "common", action: "init", sq: 1 });
    const characterId = heroIdFrom(init);
    await insertBagArtifacts(characterId, [{ artifactId: 623, durability: 0, durabilityMax: 0 }]);
    const bag = await client.objectAction({ object: "common", action: "init", sq: 2 });
    const bookId = requireNumber(bagItemByArtikulId(bag, 623).id);
    const used = await client.objectAction({
      object: "common",
      action: "action",
      form: { object_class: "ARTIFACT", object_id: bookId },
      sq: 3,
    });
    expect(used["common|action"]).toEqual({ status: 100, action: "USE" });
    expect(used["common|action"]).not.toHaveProperty("msg_text");
    expect(skillString(used["user|skills"], "AGRILKA_MOBOV")).toBe("1");
    expect(() => bagItemByArtikulId(used, 623)).toThrow(/623 is missing/);

    await insertBagArtifacts(characterId, [{ artifactId: 623, durability: 0, durabilityMax: 0 }]);
    const againBag = await client.objectAction({ object: "common", action: "init", sq: 4 });
    const denied = await client.objectAction({
      object: "common",
      action: "action",
      form: {
        object_class: "ARTIFACT",
        object_id: requireNumber(bagItemByArtikulId(againBag, 623).id),
      },
      sq: 5,
    });
    expect(denied["common|action"]).toEqual({
      status: 203,
      error: "Вы уже слишком опытны, и этот материал не несёт для вас ценности.",
    });
  });

  it("assembles ogre amulet 55 from two halves at L6", async () => {
    const client = await AuthenticatedClient.login(application);
    const init = await client.objectAction({ object: "common", action: "init", sq: 1 });
    const characterId = heroIdFrom(init);
    await application.characterProgression.grantExperience({
      characterId,
      operationId: `test:${characterId}:ogre-l6`,
      amount: L6_GRANT,
    });
    await insertBagArtifacts(characterId, [
      { artifactId: 2371, durability: 0, durabilityMax: 0, quantity: 2 },
    ]);
    const bag = await client.objectAction({ object: "common", action: "init", sq: 2 });
    const part = bagItemByArtikulId(bag, 2371);
    expect(part.cnt).toBe(2);
    const used = await client.objectAction({
      object: "common",
      action: "action",
      form: { object_class: "ARTIFACT", object_id: requireNumber(part.id) },
      sq: 3,
    });
    expect(used["common|action"]).toEqual({ status: 100, action: "USE" });
    expect(() => bagItemByArtikulId(used, 2371)).toThrow(/2371 is missing/);
    expect(bagItemByArtikulId(used, 55)).toMatchObject({ artikul_id: 55, cnt: 1 });
  });

  it("opens NPC 271 from head 584 without consuming it", async () => {
    const client = await AuthenticatedClient.login(application);
    const init = await client.objectAction({ object: "common", action: "init", sq: 1 });
    await insertBagArtifacts(heroIdFrom(init), [
      { artifactId: 584, durability: 0, durabilityMax: 0 },
    ]);
    const bag = await client.objectAction({ object: "common", action: "init", sq: 2 });
    const opened = await client.objectAction({
      object: "common",
      action: "action",
      form: { object_class: "ARTIFACT", object_id: requireNumber(bagItemByArtikulId(bag, 584).id) },
      sq: 3,
    });
    expect(opened["common|action"]).toEqual({ status: 100, action: "USE" });
    const info = objectBlock(opened["npc|info"]);
    const npc = objectBlock(info.npc);
    expect(npc.id).toBe(271);
    expect(npc.title).toBe("Голова мертвеца");
    const board = objectBlock(opened["npc|quests"]);
    expect(board.status).toBe(100);
    expect(Array.isArray(board.quests) ? board.quests : []).toHaveLength(3);
    const again = await client.objectAction({ object: "common", action: "init", sq: 4 });
    expect(bagItemByArtikulId(again, 584).artikul_id).toBe(584);
  });
});

function objectBlock(value: AmfValue | undefined): Record<string, AmfValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("expected object block");
  }
  return value;
}

function skillNumber(block: AmfValue | undefined, id: string): number {
  const value = skillRow(block, id).value;
  if (typeof value !== "number") throw new Error(`skill ${id} value is not a number`);
  return value;
}

function skillString(block: AmfValue | undefined, id: string): string {
  const value = skillRow(block, id).value;
  if (typeof value !== "string") throw new Error(`skill ${id} value is not a string`);
  return value;
}

function skillRow(block: AmfValue | undefined, id: string): Record<string, AmfValue> {
  const skills = objectBlock(block).skills;
  if (!Array.isArray(skills)) throw new Error("user|skills.skills is missing");
  for (const row of skills) {
    const item = objectBlock(row);
    if (item.id === id) return item;
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
