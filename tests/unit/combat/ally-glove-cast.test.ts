import { describe, expect, it } from "vitest";
import type { Battle } from "../../../src/modules/combat/domain/battle.ts";
import type { CombatLoadout } from "../../../src/modules/combat/domain/combat-loadout.ts";
import { FightCastDenied } from "../../../src/modules/combat/domain/fight-cast-denied.ts";
import { createUnitBattle } from "../../support/fight-rules.ts";
import { unitFightJoin, unitHuntFightSetup } from "../../support/fight-setup.ts";
import { SequenceRandom } from "../../support/fakes/sequence-random.ts";

const AUTH_NOW = Date.parse("2026-09-07T12:00:00.000Z");

/** «Дар неистовства» as the catalog has it. */
const loadout: CombatLoadout = {
  pocket: [],
  idols: [],
  concentration: null,
  glove: {
    hits: [2, 3, 2, 3, 1, 2, 3, 1],
    spells: [
      {
        artikulId: 6193,
        cost: 1,
        row: 1,
        title: "Дар неистовства",
        picture: "magic_aoe_light.png",
        spell: {
          animData: "magic_baf_electro",
          cooldown: 120,
          persRestr: { dead: false },
          targetRestr: {
            self: false,
            oppTeam: false,
            opp: false,
            dead: false,
            noBot: true,
            inParty: true,
          },
          effects: [
            {
              kind: 3,
              dmgType: 1,
              targetCount: 5,
              duration: 40,
              skills: [{ skillId: "CRBonus", value: 27 }],
            },
          ],
        },
      },
    ],
  },
  gearSpells: [],
  partyId: null,
  lifetimeExecutions: 0,
};

function twoHeroes(matePartyId = 7): Battle {
  const battle = createUnitBattle(
    unitHuntFightSetup({ botMaxHp: 200, loadout: { ...loadout, partyId: 7 } }),
    new SequenceRandom([0.4, 8, 8, 8]),
  );
  battle.authenticate(1, AUTH_NOW);
  battle.addHuman(unitFightJoin({ loadout: { ...loadout, partyId: matePartyId } }));
  battle.authenticate(2, AUTH_NOW);
  const [caster] = battle.boardParticipants().humans;
  if (caster) caster.casts.cp = 1;
  return battle;
}

describe("an ally buff of the glove", () => {
  it("lands on the clicked ally and nowhere else", () => {
    const battle = twoHeroes();
    const result = battle.tryGlove(1, { spellId: 6193, targetId: 2, sequence: 3 }, AUTH_NOW + 10);
    expect(result.kind).toBe("resolved");
    const [caster, ally] = battle.boardParticipants().humans;
    expect(ally?.effects.standingSkill("CRBonus")).toBe(27);
    expect(caster?.effects.standingSkill("CRBonus")).toBe(0);
  });

  it("is denied for a player of another party", () => {
    const battle = twoHeroes(8);
    expect(() =>
      battle.tryGlove(1, { spellId: 6193, targetId: 2, sequence: 3 }, AUTH_NOW + 10),
    ).toThrow(FightCastDenied);
  });

  it.each([
    ["no click", null],
    ["the caster", 1],
    ["a mob", 1_000_000],
    ["someone who is not in the fight", 4242],
  ])("is denied for %s and puts nothing on anyone", (_label, targetId) => {
    const battle = twoHeroes();
    expect(() =>
      battle.tryGlove(1, { spellId: 6193, targetId, sequence: 3 }, AUTH_NOW + 10),
    ).toThrow(FightCastDenied);
    for (const human of battle.boardParticipants().humans) {
      expect(human.effects.standingSkill("CRBonus")).toBe(0);
    }
  });
});
