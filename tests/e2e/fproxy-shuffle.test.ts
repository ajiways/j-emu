import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import { createIsolatedHero } from "../support/harness/authenticated-client.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";
import { MAP_HUNT_SPAWN_ID } from "../support/harness/map-hunt-spawn.ts";
import { fightEventTypes, huntFightConfFrom } from "../support/harness/wire-payload.ts";
import { SequenceRandom } from "../support/fakes/sequence-random.ts";

describe("fproxy hunt 3↔3 shuffle", () => {
  let harness: ApplicationHarness;
  let application: Application;

  beforeEach(async () => {
    harness = new ApplicationHarness(undefined, undefined, {
      combatRandom: new SequenceRandom([
        1, 0.99, 1, 0.99, 1, 0.99, 1, 0.99, 1, 0.99, 1, 0.99, 1, 0.99, 1, 0.99,
      ]),
    });
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("hands Gryzl to the waiter after three exchanges without resetting HP", async () => {
    const a = await createIsolatedHero(application);
    const b = await createIsolatedHero(application);
    await a.objectAction({ object: "common", action: "init", sq: 1 });
    await b.objectAction({ object: "common", action: "init", sq: 1 });
    const start = await a.objectAction({
      object: "common",
      action: "object",
      form: { code: "ATTACK_BOT", bot_id: MAP_HUNT_SPAWN_ID },
      sq: 4,
    });
    const opened = huntFightConfFrom(start);
    expect(await a.fight({ rc: "auth", eid: opened.fightId, sq: 5 })).toHaveLength(0);
    await a.pollFight();
    const join = await b.objectAction({
      object: "common",
      action: "object",
      form: { code: "ATTACK_BOT", bot_id: MAP_HUNT_SPAWN_ID },
      sq: 4,
    });
    expect(huntFightConfFrom(join).fightId).toBe(opened.fightId);
    expect(await b.fight({ rc: "auth", eid: opened.fightId, sq: 5 })).toHaveLength(0);
    await b.pollFight();
    await a.pollFight();
    for (let round = 0; round < 3; round += 1) {
      expect(await a.fight({ rc: "castSpell", srcType: 1, srcId: 2, sq: 20 + round })).toHaveLength(
        0,
      );
      await a.pollFight();
      await harness.elapseCombat(1400);
      const afterBot = await a.pollFight();
      if (round === 2) {
        expect(fightEventTypes(afterBot)).toContain("oppwait");
        break;
      }
      await harness.elapseCombat(1100);
      await a.pollFight();
    }
    const waiter = await b.pollFight();
    expect(fightEventTypes(waiter)).toContain("oppnew");
  });
});
