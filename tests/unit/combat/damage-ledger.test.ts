import { describe, expect, it } from "vitest";
import { EMPTY_COMBAT_LOADOUT } from "../../../src/modules/combat/domain/combat-loadout.ts";
import { FightEffectIds } from "../../../src/modules/combat/domain/fight-effect-ids.ts";
import { HumanFighter } from "../../../src/modules/combat/domain/human-fighter.ts";
import { UNIT_HUNT_APPEARANCE, unitHuntHumanStats } from "../../support/hunt-start-input.ts";

function hero(id: number, team: 1 | 2): HumanFighter {
  return new HumanFighter({
    accountId: id,
    heroId: id,
    nick: `H${id}`,
    level: 7,
    kind: 1,
    hp: 50,
    maxHp: 50,
    mp: 10,
    maxMp: 10,
    team,
    waiting: false,
    ...unitHuntHumanStats(20),
    startedAtMs: 0,
    loadout: EMPTY_COMBAT_LOADOUT,
    appearance: UNIT_HUNT_APPEARANCE,
    effectIds: new FightEffectIds(),
  });
}

describe("the damage ledger of a fighter", () => {
  it("keeps what he dealt to each human apart, and leaves mobs out of it", () => {
    const attacker = hero(1, 1);
    attacker.creditDealt(5, { id: 2, fighterKind: "human" });
    attacker.creditDealt(3, { id: 3, fighterKind: "human" });
    attacker.creditDealt(4, { id: 2, fighterKind: "human" });
    attacker.creditDealt(9, { id: 1_000_000, fighterKind: "bot" });
    expect(attacker.damageToHumansByVictim()).toEqual([
      { victimId: 2, damage: 9 },
      { victimId: 3, damage: 3 },
    ]);
    expect(attacker.damageToHumans).toBe(12);
    expect(attacker.damageToBot).toBe(9);
  });
});
