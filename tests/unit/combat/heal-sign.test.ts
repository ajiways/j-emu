import { describe, expect, it } from "vitest";
import type { Battle } from "../../../src/modules/combat/domain/battle.ts";
import {
  EMPTY_COMBAT_LOADOUT,
  type CombatLoadout,
} from "../../../src/modules/combat/domain/combat-loadout.ts";
import { FightCastDenied } from "../../../src/modules/combat/domain/fight-cast-denied.ts";
import { Battle as BattleClass } from "../../../src/modules/combat/domain/battle.ts";
import { FightRules } from "../../../src/modules/combat/domain/fight-rules.ts";
import { UNIT_BATTLE_RULES } from "../../support/battle-rules.ts";
import { unitFightJoin, unitHuntFightSetup } from "../../support/fight-setup.ts";
import { FixedRandom } from "../../support/fakes/fixed-random.ts";

const NOW = Date.parse("2026-09-07T12:00:00.000Z");

/** «Знак жизни пожирателей»: a healing effect of 7 % every 15 s for a minute, on a friendly target. */
const loadout: CombatLoadout = {
  ...EMPTY_COMBAT_LOADOUT,
  pocket: [
    {
      itemId: 100_001,
      artifactId: 4219,
      position: 1,
      count: 3,
      title: "Знак жизни пожирателей",
      picture: "znak_life1.png",
      spell: {
        animData: "botles_healfriend_red",
        groupId: 841,
        cooldown: 30,
        persRestr: { dead: false },
        targetRestr: { oppTeam: false, dead: false, noBot: true },
        effects: [{ kind: 5, amount: "7%", dmgType: 0, order: 1, duration: 60, period: 15 }],
      },
    },
  ],
};

function twoHeroes(): Battle {
  const battle = new BattleClass(
    unitHuntFightSetup({ botMaxHp: 200, loadout }),
    UNIT_BATTLE_RULES,
    FightRules.forHunt(null),
    new FixedRandom(),
    new FixedRandom(),
  );
  battle.authenticate(1, NOW);
  battle.addHuman(unitFightJoin({ loadout, hp: 100, maxHp: 100 }));
  battle.authenticate(2, NOW);
  return battle;
}

describe("a healing sign from the pocket", () => {
  it("puts the healing effect on the clicked teammate and books what it heals to the healer", () => {
    const battle = twoHeroes();
    const [healer, mate] = battle.boardParticipants().humans;
    if (!healer || !mate) throw new Error("two heroes expected");
    mate.applyDamage(30);
    const hurt = mate.hp;
    expect(battle.tryPocket(1, { itemId: 100_001, targetId: 2, sequence: 3 }, NOW)).toMatchObject({
      kind: "resolved",
    });
    expect(mate.effects.snapshot(NOW)).toHaveLength(1);
    expect(healer.effects.snapshot(NOW)).toHaveLength(0);
    // The teammate waits for a foe, and the sign still ticks on the battle timer at once.
    expect(battle.nextEffectDueMs()).toBe(NOW + 15_000);
    battle.tickDueEffects(NOW + 15_000);
    expect(mate.hp).toBeGreaterThan(hurt);
    expect(healer.healedOthers).toBe(mate.hp - hurt);
    expect(healer.healedHumansByTarget()).toEqual([{ targetId: 2, amount: mate.hp - hurt }]);
    expect(mate.healedOthers).toBe(0);
  });

  it("sends a tick's hit points change before the absolute hit points: the client adds the change to what it shows", () => {
    const battle = twoHeroes();
    const [, mate] = battle.boardParticipants().humans;
    if (!mate) throw new Error("two heroes expected");
    mate.applyDamage(30);
    battle.tryPocket(1, { itemId: 100_001, targetId: 2, sequence: 3 }, NOW);
    const { deliveries } = battle.tickDueEffects(NOW + 15_000);
    const types = deliveries.find((entry) => entry.accountId === 2)?.events.map((e) => e.type);
    expect(types).toEqual(["damage", "pers-change"]);
  });

  it("shows the end of a sign to every player of the fight, not only to the duel it was in", () => {
    const battle = twoHeroes();
    battle.tryPocket(1, { itemId: 100_001, targetId: 2, sequence: 3 }, NOW);
    for (const at of [15, 30, 45, 60, 61]) {
      const { deliveries } = battle.tickDueEffects(NOW + at * 1000);
      const types = deliveries.find((entry) => entry.accountId === 1)?.events.map((e) => e.type);
      if (types?.includes("effect-purge")) return;
    }
    throw new Error("the hero who is not across from the healed one never saw the sign end");
  });

  it("lets a hero who waits for a foe put the sign on a teammate", () => {
    const battle = twoHeroes();
    const [fighting, waiting] = battle.boardParticipants().humans;
    if (!fighting || !waiting) throw new Error("two heroes expected");
    expect(waiting.waiting).toBe(true);
    expect(battle.tryPocket(2, { itemId: 100_001, targetId: 1, sequence: 3 }, NOW)).toMatchObject({
      kind: "resolved",
    });
    expect(fighting.effects.snapshot(NOW)).toHaveLength(1);
  });

  it("uses up nothing when the cast is denied: the item and its cooldown stay", () => {
    const barred: CombatLoadout = {
      ...loadout,
      pocket: loadout.pocket.map((row) => ({
        ...row,
        spell: { ...row.spell, targetRestr: { ...row.spell.targetRestr, groupdeny: true } },
      })),
    };
    const battle = new BattleClass(
      unitHuntFightSetup({ botMaxHp: 200, loadout: barred }),
      UNIT_BATTLE_RULES,
      FightRules.forHunt(null),
      new FixedRandom(),
      new FixedRandom(),
    );
    battle.authenticate(1, NOW);
    battle.addHuman(unitFightJoin({ loadout: barred, hp: 100, maxHp: 100 }));
    battle.authenticate(2, NOW);
    battle.tryPocket(1, { itemId: 100_001, targetId: 2, sequence: 3 }, NOW);
    const [healer] = battle.boardParticipants().humans;
    if (!healer) throw new Error("a hero expected");
    const left = healer.casts.pocketRow(100_001)?.count;
    const later = NOW + 40_000;
    expect(() => battle.tryPocket(1, { itemId: 100_001, targetId: 2, sequence: 4 }, later)).toThrow(
      FightCastDenied,
    );
    expect(healer.casts.pocketRow(100_001)?.count).toBe(left);
    expect(healer.casts.cooldownLeftMs(100_001, later + 1_000)).toBe(0);
  });

  it("heals oneself without booking anything: own heals are not counted", () => {
    const battle = twoHeroes();
    const [healer] = battle.boardParticipants().humans;
    if (!healer) throw new Error("a hero expected");
    healer.applyDamage(10);
    const hurt = healer.hp;
    battle.tryPocket(1, { itemId: 100_001, targetId: 1, sequence: 3 }, NOW);
    battle.tickDueEffects(NOW + 15_000);
    expect(healer.hp).toBeGreaterThan(hurt);
    expect(healer.healedOthers).toBe(0);
  });

  it("is denied without a click on one's own side, and keeps the item", () => {
    const battle = twoHeroes();
    expect(() =>
      battle.tryPocket(1, { itemId: 100_001, targetId: null, sequence: 3 }, NOW),
    ).toThrow(FightCastDenied);
    expect(() =>
      battle.tryPocket(1, { itemId: 100_001, targetId: 1_000_000, sequence: 3 }, NOW),
    ).toThrow(FightCastDenied);
    expect(battle.boardParticipants().humans[0]?.casts.pocketRow(100_001)).not.toBeNull();
  });
});
