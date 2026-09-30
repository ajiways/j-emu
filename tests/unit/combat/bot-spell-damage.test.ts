import { describe, expect, it } from "vitest";
import { rollBotSpellDamage } from "../../../src/modules/combat/domain/bot-spell-damage.ts";
import { UNPUBLISHED_MAG_STATS } from "../../../src/modules/combat/domain/mag-stats.ts";
import { plainCaster, plainTarget } from "../../support/plain-damage-target.ts";
import { UNIT_BATTLE_RULES } from "../../support/battle-rules.ts";
import { SequenceRandom } from "../../support/fakes/sequence-random.ts";

describe("rollBotSpellDamage", () => {
  it("scales STR/10 by dump-proven Hissa pcSTR -50", () => {
    const spell = {
      animData: "magic_direct",
      endTurn: true,
      effects: [{ kind: 1, skills: [{ skillId: "pcSTR", value: -50 }] }],
    };
    expect(
      rollBotSpellDamage(
        15,
        spell,
        new SequenceRandom([1]),
        UNIT_BATTLE_RULES,
        plainCaster(UNPUBLISHED_MAG_STATS),
        plainTarget(UNPUBLISHED_MAG_STATS),
      ),
    ).toBe(1);
  });

  it("uses STR/10 when the card has no pcSTR", () => {
    const spell = { animData: "magic_darkball", endTurn: true, effects: [{ kind: 1 }] };
    expect(
      rollBotSpellDamage(
        80,
        spell,
        new SequenceRandom([8]),
        UNIT_BATTLE_RULES,
        plainCaster(UNPUBLISHED_MAG_STATS),
        plainTarget(UNPUBLISHED_MAG_STATS),
      ),
    ).toBe(8);
  });
});

describe("school power skills", () => {
  const spell = { animData: "magic_darkball", endTurn: true, effects: [{ kind: 1, dmgType: 4 }] };
  const roll = (skills: Record<string, number>, rolled: number) =>
    rollBotSpellDamage(
      80,
      spell,
      new SequenceRandom([rolled]),
      UNIT_BATTLE_RULES,
      plainCaster(UNPUBLISHED_MAG_STATS, skills),
      plainTarget(UNPUBLISHED_MAG_STATS),
    );

  it("adds the flat power of the spell's school only", () => {
    expect(roll({}, 8)).toBe(8);
    expect(roll({ MAGSTR_DRK: 5 }, 13)).toBe(13);
    expect(() => roll({ MAGSTR_FR: 5 }, 13)).toThrow(/outside 7..9/);
  });
});
