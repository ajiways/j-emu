import { describe, expect, it } from "vitest";
import type { CombatSpell } from "../../../src/modules/combat/domain/combat-loadout.ts";
import { FightCastDenied } from "../../../src/modules/combat/domain/fight-cast-denied.ts";
import { Roster } from "../../../src/modules/combat/domain/roster.ts";
import { allyTargetOf } from "../../../src/modules/combat/domain/spell-target.ts";
import type { HumanFighter } from "../../../src/modules/combat/domain/human-fighter.ts";
import type { BotFighter } from "../../../src/modules/combat/domain/bot-fighter.ts";

/** «Дар неистовства» as the catalog has it: a living player of one's team, not oneself, no mob. */
const RALLY: CombatSpell = {
  targetRestr: { self: false, opp: false, oppTeam: false, dead: false, noBot: true },
  effects: [{ kind: 3, duration: 40 }],
};

function human(id: number, team: 1 | 2, alive = true): HumanFighter {
  return { id, team, alive, fighterKind: "human" } as unknown as HumanFighter;
}

function bot(id: number, team: 1 | 2): BotFighter {
  return { id, team, alive: true, fighterKind: "bot" } as unknown as BotFighter;
}

describe("the ally an ally spell lands on", () => {
  const caster = human(1, 1);
  const mate = human(2, 1);
  const roster = new Roster();
  for (const member of [caster, mate, human(3, 2), bot(1_000_001, 1), human(4, 1, false)]) {
    roster.add(member);
  }
  const aim = (targetId: number | null, spell: CombatSpell = RALLY) =>
    allyTargetOf({ spell, caster, roster, targetId, sequence: 9 });

  it("is the clicked player of the caster's team", () => {
    expect(aim(2)).toBe(mate);
  });

  it.each([
    ["no target at all", null],
    ["a target that is not in the fight", 77],
    ["an enemy", 3],
    ["the caster, when the spell forbids it", 1],
    ["a mob, when the spell is for players", 1_000_001],
    ["a fallen ally, when the spell is for the living", 4],
  ])("denies %s", (_label, targetId) => {
    expect(() => aim(targetId)).toThrow(FightCastDenied);
  });

  it("lets a spell for mobs land on a mob and not on a player", () => {
    const forBots: CombatSpell = {
      targetRestr: { opp: false, oppTeam: false, noBot: false },
      effects: [{ kind: 3, duration: 40 }],
    };
    expect(aim(1_000_001, forBots)).toMatchObject({ id: 1_000_001 });
    expect(() => aim(2, forBots)).toThrow(FightCastDenied);
  });

  it("has no ally for a spell that is not aimed at allies only", () => {
    expect(aim(2, { targetRestr: { opp: true }, effects: [{ kind: 3 }] })).toBeNull();
    expect(aim(2, { targetRestr: { self: true }, effects: [{ kind: 3 }] })).toBeNull();
  });
});
