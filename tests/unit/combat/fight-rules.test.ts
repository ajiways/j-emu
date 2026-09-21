import { describe, expect, it } from "vitest";
import { Battle } from "../../../src/modules/combat/domain/battle.ts";
import { FightRules } from "../../../src/modules/combat/domain/fight-rules.ts";
import { UNIT_BATTLE_RULES } from "../../support/battle-rules.ts";
import { unitHuntFightSetup } from "../../support/fight-setup.ts";
import { SequenceRandom } from "../../support/fakes/sequence-random.ts";

describe("FightRules", () => {
  it("assigns teams from the named constructors, not from purpose branching", () => {
    expect(FightRules.forHunt(null).teamAssignment).toEqual({ openerTeam: 1, enemyTeam: 2 });
    expect(FightRules.forQuest(1).teamAssignment).toEqual({ openerTeam: 2, enemyTeam: 1 });
    expect(FightRules.forFriendlyDuel().teamAssignment).toEqual({ openerTeam: 1, enemyTeam: 2 });
    expect(FightRules.forPvp().teamAssignment).toEqual({ openerTeam: 1, enemyTeam: 2 });
  });

  it("credits quest kills for a single bot and skips them on a multi-bot roster", () => {
    expect(FightRules.forQuest(1).skipQuestKills).toBe(false);
    expect(FightRules.forQuest(2).skipQuestKills).toBe(true);
    expect(FightRules.forHunt(null).skipQuestKills).toBe(false);
  });

  it("fails fast on a missing rule, unknown kind, and unknown version", () => {
    expect(
      () => new Battle(unitHuntFightSetup(), UNIT_BATTLE_RULES, undefined as never, random()),
    ).toThrow(/FightRules is required/);
    expect(() => FightRules.for({ kind: "arena" } as never)).toThrow(/Unknown fight kind: arena/);
    expect(() => FightRules.create({ ...FightRules.forHunt(null), version: 2 } as never)).toThrow(
      /Unknown FightRules version: 2/,
    );
  });

  it("fails fast on an invalid quest bot count and a non-null hunt copy id of zero", () => {
    expect(() => FightRules.forQuest(0)).toThrow(/positive integer/);
    expect(() => FightRules.forHunt(0)).toThrow(/positive integer or null/);
  });

  it("treats enemy bots as one fact and derives hunt-bot history from it", () => {
    expect(FightRules.forHunt(null).hasEnemyBots).toBe(true);
    expect(FightRules.forQuest(1).hasEnemyBots).toBe(true);
    expect(FightRules.forFriendlyDuel().hasEnemyBots).toBe(false);
    expect(FightRules.forPvp().hasEnemyBots).toBe(false);
    expect(FightRules.forHunt(null).historyRow).toBe("hunt-bot");
    expect(FightRules.forQuest(2).historyRow).toBe("hunt-bot");
    expect(FightRules.forFriendlyDuel().historyRow).toBe("practice-humans");
    expect(FightRules.forPvp().historyRow).toBe("none");
    expect(() =>
      FightRules.create({ ...FightRules.forHunt(null), hasEnemyBots: false } as never),
    ).toThrow(/historyRow hunt-bot must match hasEnemyBots/);
  });

  it("bakes leave and aggro from the hunt copy, not from a later purpose read", () => {
    const world = FightRules.forHunt(null);
    expect(world.canLeave).toBe(true);
    expect(world.canAggro).toBe(true);
    const copy = FightRules.forHunt(12);
    expect(copy.canLeave).toBe(false);
    expect(copy.canAggro).toBe(false);
    expect(FightRules.forQuest(1).canLeave).toBe(false);
    expect(FightRules.forPvp().canLeave).toBe(true);
  });
});

function random(): SequenceRandom {
  return new SequenceRandom([8]);
}
