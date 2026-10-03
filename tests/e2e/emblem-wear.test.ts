import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import { AuthenticatedClient } from "../support/harness/authenticated-client.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";
import { bagItemByArtikulId, heroIdFrom } from "../support/harness/wire-payload.ts";
import { insertBagArtifacts } from "../support/postgres/insert-bag-artifacts.ts";

/** «Эмблема задиры»: the insignia slot, from level 6 and the first rank. */
const EMBLEM = 9833;
const LEVEL_7_GRANT = 3622;
/** The honor of the first rank (the second rank opens at 100 honor in the catalog's scale). */
const FIRST_RANK_HONOR = 100;

describe("an emblem in the insignia slot", () => {
  let harness: ApplicationHarness;
  let application: Application;

  beforeEach(async () => {
    harness = new ApplicationHarness();
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("is refused below its rank, then worn in slot2 once the rank is held", async () => {
    const client = await AuthenticatedClient.login(application);
    const init = await client.objectAction({ object: "common", action: "init", sq: 1 });
    const heroId = heroIdFrom(init);
    await application.characterProgression.grantExperience({
      characterId: heroId,
      operationId: `test:${heroId}:emblem-l7`,
      amount: LEVEL_7_GRANT,
    });
    await insertBagArtifacts(heroId, [{ artifactId: EMBLEM, durability: 0, durabilityMax: 0 }]);
    const bag = await client.objectAction({ object: "common", action: "init", sq: 2 });
    const item = bagItemByArtikulId(bag, EMBLEM);
    expect(item.slot2_mask).toBe(1);
    expect(Number(item.actions) & 8).toBe(8);
    if (item.id === undefined) throw new Error("The emblem has no item id");
    const putOn = { code: "PUT_ON", artifact_id: item.id };

    const refused = await client.objectAction({
      object: "common",
      action: "action",
      form: putOn,
      sq: 3,
    });
    expect(refused["common|action"]).toMatchObject({ status: 203 });
    expect(JSON.stringify(refused)).toMatch(/Нужно звание/);

    await application.characterProgression.grantHonor({
      characterId: heroId,
      operationId: `test:${heroId}:emblem-honor`,
      amount: FIRST_RANK_HONOR,
    });
    const worn = await client.objectAction({
      object: "common",
      action: "action",
      form: putOn,
      sq: 4,
    });
    expect(worn["common|action"]).toEqual({ status: 100 });
    const equipped = JSON.stringify(worn["user|view"]);
    expect(equipped).toContain(`"artikul_id":${EMBLEM}`);
    expect(equipped).toContain('"slot":0');
    expect(equipped).toContain('"slot2":1');
  });
});
