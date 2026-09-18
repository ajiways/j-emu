import { describe, expect, it } from "vitest";
import { Battle } from "../../../src/modules/combat/domain/battle.ts";
import { EMPTY_COMBAT_LOADOUT } from "../../../src/modules/combat/domain/combat-loadout.ts";
import { FightRules } from "../../../src/modules/combat/domain/fight-rules.ts";
import type { HuntBattleInit } from "../../../src/modules/combat/domain/hunt-battle-init.ts";
import { UNIT_BATTLE_RULES } from "../../support/battle-rules.ts";
import {
  EMPTY_HUNT_BOT_SPELL_BOOK,
  GRYZL_FIGHT_LOOK,
  UNIT_HUNT_APPEARANCE,
  UNIT_HUNT_BATTLE_STATS,
} from "../../support/hunt-start-input.ts";
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
    expect(() => new Battle(huntInit(), UNIT_BATTLE_RULES, undefined as never, random())).toThrow(
      /FightRules is required/,
    );
    expect(() => FightRules.for({ kind: "arena" } as never)).toThrow(/Unknown fight kind: arena/);
    expect(() => FightRules.create({ ...FightRules.forHunt(null), version: 2 } as never)).toThrow(
      /Unknown FightRules version: 2/,
    );
  });

  it("fails fast on an invalid quest bot count and a non-null hunt copy id of zero", () => {
    expect(() => FightRules.forQuest(0)).toThrow(/positive integer/);
    expect(() => FightRules.forHunt(0)).toThrow(/positive integer or null/);
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

function huntInit(): HuntBattleInit {
  return {
    fightId: "1",
    accessKey: "access-key",
    accountId: 1,
    heroId: 1,
    heroNick: "Hero",
    heroLevel: 1,
    heroKind: 1,
    heroMp: 10,
    heroMaxMp: 10,
    heroStrength: 80,
    botStrength: 20,
    ...UNIT_HUNT_BATTLE_STATS,
    botArtikulId: 2,
    botFightId: 1_000_000,
    botNick: "Грызль",
    botLevel: 1,
    ...GRYZL_FIGHT_LOOK,
    playerHp: 27,
    playerMaxHp: 27,
    botMaxHp: 20,
    arena: "1_1",
    areaId: "503",
    instanceCopyId: null,
    startedAt: new Date("2026-09-07T12:00:00.000Z"),
    loadout: EMPTY_COMBAT_LOADOUT,
    appearance: UNIT_HUNT_APPEARANCE,
    botSpellBook: EMPTY_HUNT_BOT_SPELL_BOOK,
    purpose: "hunt",
    extraEnemies: [],
    allies: [],
    chatWin: "",
    chatLose: "",
  };
}
