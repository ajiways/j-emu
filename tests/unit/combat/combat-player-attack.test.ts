import { describe, expect, it } from "vitest";
import { RadwayPlayerAttackPolicy } from "../../../src/app/radway-player-attack-policy.ts";
import { JoinDenied } from "../../../src/modules/combat/domain/join-denied.ts";
import { startHuntWithIssuedId } from "../../support/combat-start-hunt.ts";
import { createCombatService } from "../../support/create-combat-service.ts";
import { AllowPlayerAttackPolicy } from "../../support/fakes/allow-player-attack-policy.ts";
import { SequenceRandom } from "../../support/fakes/sequence-random.ts";
import { unitHuntJoin, unitHuntStart } from "../../support/hunt-start-input.ts";

describe("CombatService player attack policy", () => {
  it("asks the policy when a join puts a human against a team that has humans", async () => {
    const policy = new AllowPlayerAttackPolicy();
    const { combat } = createCombatService({
      attackPolicy: policy,
      random: new SequenceRandom([0.4, 0.4, 0.4, 0.4]),
    });
    const start = await startHuntWithIssuedId(combat, unitHuntStart());
    await combat.joinHunt(unitHuntJoin({ fightId: start.fightId, team: 1 }));
    expect(policy.attempts).toEqual([]);
    await combat.joinHunt(
      unitHuntJoin({ fightId: start.fightId, team: 2, accountId: 3, heroId: 3, heroNick: "Foe" }),
    );
    expect(policy.attempts).toEqual([
      { areaId: "503", instanceCopyId: null, attackerHeroId: 3, joinTeam: 2 },
    ]);
  });

  it("refuses the join on Radway and leaves the fight as it was", async () => {
    const { combat } = createCombatService({ attackPolicy: new RadwayPlayerAttackPolicy() });
    const start = await startHuntWithIssuedId(combat, unitHuntStart());
    await expect(
      combat.joinHunt(unitHuntJoin({ fightId: start.fightId, team: 2 })),
    ).rejects.toBeInstanceOf(JoinDenied);
    expect(await combat.activeFightId(2)).toBeNull();
    await combat.joinHunt(unitHuntJoin({ fightId: start.fightId, team: 1 }));
    expect(await combat.participantTeam(2)).toBe(1);
  });
});
