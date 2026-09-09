import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import type { AmfValue } from "../../src/modules/jugger-wire/amf/amf3.ts";
import { AuthenticatedClient } from "../support/harness/authenticated-client.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";
import { completeMeleeHunt } from "../support/harness/complete-melee-hunt.ts";
import { SequenceRandom } from "../support/fakes/sequence-random.ts";
import { bagItemByArtikulId } from "../support/harness/wire-payload.ts";

describe("inventory durability death and repair", () => {
  let harness: ApplicationHarness;
  let application: Application;

  beforeEach(async () => {
    harness = new ApplicationHarness(undefined, undefined, {
      lootRandom: new SequenceRandom(Array.from({ length: 64 }, () => 0)),
      combatRules: {
        playerDamageMin: 8,
        playerDamageMax: 8,
        botDamageMin: 50,
        botDamageMax: 50,
      },
    });
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("breaks four equipped L1 items on death, rejects PUT_ON of 0/N, and repairs", async () => {
    const client = await AuthenticatedClient.login(application);
    const init = await client.objectAction({ object: "common", action: "init", sq: 1 });
    expect(bagItemByArtikulId(init, 9095)).toMatchObject({
      durability: 3,
      durability_max: 3,
    });
    await putOn(client, requireNumber(bagItemByArtikulId(init, 20).id), 2);
    await putOn(client, requireNumber(bagItemByArtikulId(init, 21).id), 3);
    await putOn(client, requireNumber(bagItemByArtikulId(init, 26).id), 4);
    await putOn(client, requireNumber(bagItemByArtikulId(init, 9095).id), 5);

    let sq = 10;
    for (let death = 0; death < 3; death += 1) {
      await completeMeleeHunt(client, (ms) => harness.elapseCombat(ms), sq);
      sq += 20;
      await client.pollEsrv();
      if (death < 2) {
        const living = await client.objectAction({
          object: "common",
          action: "object",
          form: { code: "RESURRECT" },
          sq,
        });
        sq += 1;
        expect(living["common|action"]).toEqual({ status: 100 });
      }
    }

    const afterDeaths = await client.objectAction({ object: "user", action: "bag", sq });
    sq += 1;
    const glove = bagItemByArtikulId(afterDeaths, 9095);
    expect(glove).toMatchObject({ durability: 0, durability_max: 3, actions: 3 });
    const denied = await client.objectAction({
      object: "common",
      action: "object",
      form: { code: "PUT_ON", artifact_id: requireNumber(glove.id) },
      sq,
    });
    sq += 1;
    expect(denied["common|action"]).toEqual({
      status: 204,
      error: "Эту вещь нельзя надеть!",
    });

    const repairedGlove = await client.objectAction({
      object: "store",
      action: "repair",
      form: { id: requireNumber(glove.id) },
      sq,
    });
    sq += 1;
    expect(repairedGlove["store|repair"]).toEqual({ status: 100 });
    expect(bagItemByArtikulId(repairedGlove, 9095)).toMatchObject({
      durability: 2,
      durability_max: 2,
    });
    expect(stateMoney(repairedGlove)).toBe("25.00");
    expect(repairedGlove["user|view"]).toBeTypeOf("object");
    expect(repairedGlove["user|magic"]).toEqual({ status: 100, gloves: [] });

    const chest = equippedByArtikul(repairedGlove["user|view"], 20);
    expect(chest).toMatchObject({ durability: 27, durability_max: 30 });
    const repairedChest = await client.objectAction({
      object: "store",
      action: "repair",
      form: { id: requireNumber(chest.id) },
      sq,
    });
    sq += 1;
    expect(repairedChest["store|repair"]).toEqual({ status: 100 });
    expect(equippedByArtikul(repairedChest["user|view"], 20)).toMatchObject({
      durability: 29,
      durability_max: 29,
    });
    expect(stateMoney(repairedChest)).toBe("24.98");

    const already = await client.objectAction({
      object: "store",
      action: "repair",
      form: { id: requireNumber(bagItemByArtikulId(repairedGlove, 9095).id) },
      sq,
    });
    expect(already["store|repair"]).toEqual({ status: 203, error: "нельзя починить" });

    application = await harness.restart();
    const restarted = new AuthenticatedClient(application, client.cookie);
    const again = await restarted.objectAction({ object: "common", action: "init", sq: 90 });
    expect(bagItemByArtikulId(again, 9095)).toMatchObject({
      durability: 2,
      durability_max: 2,
    });
    expect(stateMoney(again)).toBe("24.98");
    const view = await restarted.objectAction({ object: "user", action: "view", sq: 91 });
    expect(equippedByArtikul(view["user|view"], 20)).toMatchObject({
      durability: 29,
      durability_max: 29,
    });
  });
});

async function putOn(client: AuthenticatedClient, itemId: number, sq: number) {
  const putOn = await client.objectAction({
    object: "common",
    action: "object",
    form: { code: "PUT_ON", artifact_id: itemId },
    sq,
  });
  expect(putOn["common|action"]).toEqual({ status: 100 });
}

function equippedByArtikul(
  view: AmfValue | undefined,
  artikulId: number,
): Record<string, AmfValue> {
  if (!view || typeof view !== "object" || Array.isArray(view)) {
    throw new Error("user|view is missing");
  }
  const artifacts = view.artifacts;
  if (!Array.isArray(artifacts)) throw new Error("user|view.artifacts is missing");
  for (const row of artifacts) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    if (row.artikul_id === artikulId) return row;
  }
  throw new Error(`equipped artikul ${artikulId} is missing`);
}

function requireNumber(value: AmfValue | undefined): number {
  if (typeof value !== "number") throw new Error("expected a number");
  return value;
}

function stateMoney(payload: Record<string, AmfValue>): string {
  const state = payload.state;
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("state is missing");
  }
  if (typeof state.money !== "string") throw new Error("state.money is missing");
  return state.money;
}
