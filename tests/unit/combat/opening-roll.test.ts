import { describe, expect, it } from "vitest";
import { Battle } from "../../../src/modules/combat/domain/battle.ts";
import { FightRules } from "../../../src/modules/combat/domain/fight-rules.ts";
import { UNIT_BATTLE_RULES } from "../../support/battle-rules.ts";
import { unitHuntFightSetup } from "../../support/fight-setup.ts";
import { FixedRandom } from "../../support/fakes/fixed-random.ts";
import { SequenceRandom } from "../../support/fakes/sequence-random.ts";

const AUTH_NOW = Date.parse("2026-09-07T12:00:00.000Z");

function huntOpenedBy(opening: number): Battle {
  return new Battle(
    unitHuntFightSetup({ botMaxHp: 200 }),
    UNIT_BATTLE_RULES,
    FightRules.forHunt(null),
    new FixedRandom(),
    new SequenceRandom([opening]),
  );
}

describe("the first strike of the opening duel", () => {
  it("goes to the hunter when the roll falls to him", () => {
    const battle = huntOpenedBy(0.99);
    expect(battle.nextActorIdOf(1)).toBe(1);
    battle.authenticate(1, AUTH_NOW);
    expect(battle.startIdleWork().turns).toEqual([]);
  });

  it("goes to the mob when the roll falls to it, and the mob's turn is started for the hunter who waits", () => {
    const battle = huntOpenedBy(0.01);
    expect(battle.nextActorIdOf(1)).toBe(1_000_000);
    battle.authenticate(1, AUTH_NOW);
    expect(battle.boardParticipants().humans[0]?.turnActive).toBe(false);
    expect(battle.startIdleWork().turns).toMatchObject([{ botId: 1_000_000 }]);
  });
});
