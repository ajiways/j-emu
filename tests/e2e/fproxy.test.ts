import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import { AuthenticatedClient } from "../support/harness/authenticated-client.ts";
import { MAP_HUNT_SPAWN_ID } from "../support/harness/map-hunt-spawn.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";
import {
  framesIncludeFightFinish,
  fightEventTypes,
  huntFightIdFrom,
  huntOppNewFrom,
} from "../support/harness/wire-payload.ts";

describe("fproxy", () => {
  let harness: ApplicationHarness;
  let application: Application;

  beforeEach(async () => {
    harness = new ApplicationHarness();
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("authenticates, polls, and finishes a hunt fight", async () => {
    const client = await AuthenticatedClient.login(application);
    const start = await client.objectAction({
      object: "common",
      action: "object",
      form: { code: "ATTACK_BOT", bot_id: MAP_HUNT_SPAWN_ID },
      sq: 4,
    });
    const fightId = huntFightIdFrom(start);
    expect(await client.fight({ rc: "auth", eid: fightId, sq: 5 })).toHaveLength(0);
    const authenticated = await client.pollFight();
    expect(authenticated[0]).toMatchObject({ rs: true });
    expect(fightEventTypes(authenticated)).toEqual(
      expect.arrayContaining(["fightState", "persList", "oppnew", "attacknow"]),
    );
    const opponent = huntOppNewFrom(authenticated);
    expect(opponent).toMatchObject({ et: "oppnew", nick: "Грызль", bot: true, sk: "11", team: 2 });
    expect(opponent.id).toBeGreaterThanOrEqual(1_000_000);

    let finished = false;
    for (let strike = 0; strike < 4 && !finished; strike += 1) {
      expect(
        await client.fight({ rc: "castSpell", srcType: 1, srcId: 2, sq: 6 + strike }),
      ).toHaveLength(0);
      finished = framesIncludeFightFinish(await client.pollFight());
    }
    expect(finished).toBe(true);
  });
});
