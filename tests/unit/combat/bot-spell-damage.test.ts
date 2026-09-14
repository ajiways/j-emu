import { describe, expect, it } from "vitest";
import { rollBotSpellDamage } from "../../../src/modules/combat/domain/bot-spell-damage.ts";
import { UNPUBLISHED_MAG_STATS } from "../../../src/modules/combat/domain/mag-stats.ts";
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
        UNPUBLISHED_MAG_STATS,
        UNPUBLISHED_MAG_STATS,
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
        UNPUBLISHED_MAG_STATS,
        UNPUBLISHED_MAG_STATS,
      ),
    ).toBe(8);
  });
});
