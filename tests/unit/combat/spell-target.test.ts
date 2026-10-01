import { describe, expect, it } from "vitest";
import type { BotFighter } from "../../../src/modules/combat/domain/bot-fighter.ts";
import type { CombatSpell } from "../../../src/modules/combat/domain/combat-loadout.ts";
import { FightCastDenied } from "../../../src/modules/combat/domain/fight-cast-denied.ts";
import type { HumanFighter } from "../../../src/modules/combat/domain/human-fighter.ts";
import { Roster } from "../../../src/modules/combat/domain/roster.ts";
import { allyTargetsOf } from "../../../src/modules/combat/domain/spell-target.ts";
import { FixedRandom } from "../../support/fakes/fixed-random.ts";

/** «Дар неистовства» as the catalog has it: up to five living players of one's party, not oneself. */
const RALLY: CombatSpell = {
  targetRestr: {
    self: false,
    opp: false,
    oppTeam: false,
    dead: false,
    noBot: true,
    inParty: true,
  },
  effects: [{ kind: 3, duration: 40, targetCount: 3 }],
};

function human(id: number, team: 1 | 2, partyId: number | null, alive = true): HumanFighter {
  return {
    id,
    team,
    alive,
    fighterKind: "human",
    casts: { loadout: { partyId } },
  } as unknown as HumanFighter;
}

function bot(id: number, team: 1 | 2): BotFighter {
  return {
    id,
    team,
    alive: true,
    fighterKind: "bot",
    casts: { loadout: { partyId: null } },
  } as unknown as BotFighter;
}

describe("the allies an ally spell lands on", () => {
  const caster = human(1, 1, 7);
  const mate = human(2, 1, 7);
  const roster = new Roster();
  for (const member of [
    caster,
    mate,
    human(3, 1, 7),
    human(4, 1, 7),
    human(5, 1, 7),
    human(6, 1, 8),
    human(7, 1, null),
    human(8, 2, 7),
    bot(1_000_001, 1),
    human(9, 1, 7, false),
  ]) {
    roster.add(member);
  }
  const aim = (targetId: number | null, spell: CombatSpell = RALLY) =>
    allyTargetsOf({ spell, caster, roster, targetId, sequence: 9, random: new FixedRandom() });

  it("is the clicked party member plus random other members up to targetCount", () => {
    const hit = aim(2);
    expect(hit[0]).toBe(mate);
    expect(hit).toHaveLength(3);
    // Only the living players of the caster's party, never the caster, an outsider or a mob.
    expect(hit.map((member) => member.id).every((id) => [2, 3, 4, 5].includes(id))).toBe(true);
    expect(new Set(hit.map((member) => member.id)).size).toBe(3);
  });

  it("is just the clicked one for a spell of one target", () => {
    const single: CombatSpell = { ...RALLY, effects: [{ kind: 3, duration: 40 }] };
    expect(aim(2, single)).toEqual([mate]);
  });

  it("takes fewer when the party has fewer living members", () => {
    const lonely = new Roster();
    for (const member of [caster, mate]) lonely.add(member);
    const hit = allyTargetsOf({
      spell: RALLY,
      caster,
      roster: lonely,
      targetId: 2,
      sequence: 9,
      random: new FixedRandom(),
    });
    expect(hit).toEqual([mate]);
  });

  it.each([
    ["no target at all", null],
    ["a target that is not in the fight", 77],
    ["an enemy", 8],
    ["the caster, when the spell forbids it", 1],
    ["a mob, when the spell is for players", 1_000_001],
    ["a fallen ally, when the spell is for the living", 9],
    ["a player of another party", 6],
    ["a player without a party", 7],
  ])("denies %s", (_label, targetId) => {
    expect(() => aim(targetId)).toThrow(FightCastDenied);
  });

  it("denies a party spell to a caster who has no party", () => {
    const partyless = human(1, 1, null);
    const alone = new Roster();
    alone.add(partyless);
    alone.add(human(2, 1, null));
    expect(() =>
      allyTargetsOf({
        spell: RALLY,
        caster: partyless,
        roster: alone,
        targetId: 2,
        sequence: 9,
        random: new FixedRandom(),
      }),
    ).toThrow(FightCastDenied);
  });

  it("lets a spell for mobs land on a mob and not on a player", () => {
    const forBots: CombatSpell = {
      targetRestr: { opp: false, oppTeam: false, noBot: false },
      effects: [{ kind: 3, duration: 40 }],
    };
    expect(aim(1_000_001, forBots)).toMatchObject([{ id: 1_000_001 }]);
    expect(() => aim(2, forBots)).toThrow(FightCastDenied);
  });

  it("has no allies for a spell that is not aimed at allies only", () => {
    expect(aim(2, { targetRestr: { opp: true }, effects: [{ kind: 3 }] })).toEqual([]);
    expect(aim(2, { targetRestr: { self: true }, effects: [{ kind: 3 }] })).toEqual([]);
  });
});
