import { describe, expect, it } from "vitest";
import { startHuntWithIssuedId } from "../../support/combat-start-hunt.ts";
import { createCombatService } from "../../support/create-combat-service.ts";
import { unitHuntJoin, unitHuntStart } from "../../support/hunt-start-input.ts";
import { SequenceRandom } from "../../support/fakes/sequence-random.ts";

describe("CombatService leaveFight", () => {
  it("acks leave on HTTP and queues a flee exit for the last human", async () => {
    const { combat } = createCombatService({ random: new SequenceRandom([8, 2]) });
    const start = await startHuntWithIssuedId(combat, unitHuntStart());
    await combat.execute(1, { kind: "authenticate", fightId: start.fightId, sequence: 1 });
    await combat.execute(1, { kind: "poll" });
    await expect(combat.execute(1, { kind: "leave", sequence: 9 })).resolves.toEqual([
      { type: "command-accepted", sequence: 9 },
    ]);
    expect(await combat.takeLoot(1)).toBeNull();
    expect(await combat.takeExit(1)).toEqual({
      fightId: start.fightId,
      winnerTeam: 1,
      flee: true,
    });
    expect(await combat.hasFight(start.fightId)).toBe(false);
  });

  it("keeps the fight alive when an ally remains", async () => {
    const { combat } = createCombatService({
      random: new SequenceRandom([20]),
    });
    const start = await startHuntWithIssuedId(combat, unitHuntStart({ heroStrength: 200 }));
    await combat.joinHunt(unitHuntJoin({ fightId: start.fightId }));
    await combat.execute(1, { kind: "authenticate", fightId: start.fightId, sequence: 1 });
    await combat.execute(1, { kind: "poll" });
    await combat.execute(1, { kind: "leave", sequence: 9 });
    expect(await combat.takeExit(1)).toEqual({
      fightId: start.fightId,
      winnerTeam: 2,
      flee: true,
    });
    expect(await combat.hasFight(start.fightId)).toBe(true);
    expect(await combat.activeFightId(2)).toBe(start.fightId);
  });
});
