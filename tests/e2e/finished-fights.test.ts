import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import { toArenaFinishedFightRow } from "../../src/modules/combat/application/finished-fight-wire-mapper.ts";
import { AuthenticatedClient } from "../support/harness/authenticated-client.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";
import { completeMeleeHunt } from "../support/harness/complete-melee-hunt.ts";
import { loadFinishedFightByWireId } from "../support/postgres/finished-fight-rows.ts";
import { heroIdFrom } from "../support/harness/wire-payload.ts";

describe("finished fights", () => {
  let harness: ApplicationHarness;
  let application: Application;

  beforeEach(async () => {
    harness = new ApplicationHarness();
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("records one old-shaped history row after a hunt finishes", async () => {
    const client = await AuthenticatedClient.login(application);
    const init = await client.objectAction({ object: "common", action: "init", sq: 1 });
    const heroId = heroIdFrom(init);
    const nick = (init["user|conf"] as { nick: string }).nick;
    const fightId = await completeMeleeHunt(client);
    const row = await loadFinishedFightByWireId(fightId);
    if (!row) throw new Error("Finished hunt did not write history");
    expect(toArenaFinishedFightRow(row)).toMatchObject({
      id: Number(fightId),
      title: `Нападение ${nick} на Грызль`,
      type: 1,
      timeout: 20,
      level_min: 1,
      level_max: 1,
      level: 0,
      winner: "1",
      ml_title: `1|${heroId}|2`,
    });
    expect(row.teams["1"][0]?.id).toBe(heroId);
    expect(row.teams["2"][0]).toMatchObject({ bot: 1, artikul_id: "2", id: "2" });
    expect(await loadFinishedFightByWireId(fightId)).toEqual(row);
  });
});
