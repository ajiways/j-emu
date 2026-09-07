import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import { AuthenticatedClient } from "../support/harness/authenticated-client.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";
import { framesIncludeFightFinish, huntFightIdFrom } from "../support/harness/wire-payload.ts";

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
      form: { code: "ATTACK_BOT", bot_id: 2 },
      sq: 4,
    });
    const fightId = huntFightIdFrom(start);
    expect(await client.fight({ rc: "auth", eid: fightId, sq: 5 })).toHaveLength(0);
    const authenticated = await client.pollFight();
    expect(authenticated[0]).toMatchObject({ rs: true });
    expect(authenticated[1]).toHaveProperty("oppnew");

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
