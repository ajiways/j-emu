import { describe, expect, it } from "vitest";
import type { Battle } from "../../../src/modules/combat/domain/battle.ts";
import { createUnitBattle } from "../../support/fight-rules.ts";
import { unitFightJoin, unitHuntFightSetup } from "../../support/fight-setup.ts";
import { unitHuntSpellCard } from "../../support/hunt-start-input.ts";

const NOW = Date.parse("2026-09-07T12:00:00.000Z");

/** «Волна света»: an AOE spell that reaches two of the bot's enemies. */
const WAVE = unitHuntSpellCard({
  artikulId: 9099,
  title: "Волна света",
  spell: {
    animData: "magic_aoe_light",
    endTurn: true,
    effects: [{ kind: 1, targetCount: 2 }],
  },
});

function pairedHunt(): Battle {
  const battle = createUnitBattle(
    unitHuntFightSetup({
      botMaxHp: 200,
      botSpellBook: { nothingWeight: 0, spells: [WAVE] },
    }),
    {
      integer: (minInclusive) => minInclusive,
      unit: () => 0.4,
    },
  );
  battle.authenticate(1, NOW);
  battle.addHuman(unitFightJoin());
  battle.authenticate(2, NOW);
  expect(battle.tryAggro(1, 1_000_000, () => 1_000_001).kind).toBe("resolved");
  return battle;
}

describe("a bot's AOE spell", () => {
  it("hits the ally of the aimed hero too and sends that hunter his own hit", () => {
    const battle = pairedHunt();
    const before = battle.livingHumans().map((human) => human.hp);
    const turn = battle.resolveBotMelee(1, NOW + 1000);
    const [aimed, ally] = battle.livingHumans();
    expect(turn.sideHits).toHaveLength(1);
    expect(turn.sideHits[0]).toMatchObject({ targetId: ally?.heroId, killed: false });
    expect(aimed?.hp).toBeLessThan(before[0] ?? 0);
    expect(ally?.hp).toBeLessThan(before[1] ?? 0);
    expect(turn.events.some((event) => event.type === "pers-change")).toBe(true);
    expect(turn.sideFallout.deliveries).toHaveLength(1);
    expect(turn.sideFallout.deliveries[0]).toMatchObject({ accountId: 2 });
    expect(turn.sideFallout.deliveries[0]?.events[0]).toMatchObject({
      type: "damage",
      sourceId: 1_000_000,
      targetId: ally?.heroId,
      animation: "magic_aoe_light",
    });
    expect(turn.sideFallout.fallenAccountIds).toEqual([]);
  });

  it("hands the place of an ally it killed to a waiter and keeps the fight going", () => {
    const battle = pairedHunt();
    const ally = battle.livingHumans()[1];
    if (!ally) throw new Error("ally is missing");
    ally.applyDamage(ally.hp - 1);
    const turn = battle.resolveBotMelee(1, NOW + 1000);
    expect(turn.sideHits[0]).toMatchObject({ killed: true });
    expect(turn.sideFallout.fallenAccountIds).toEqual([2]);
    expect(turn.finished).toBe(false);
  });

  it("ends the fight when the same spell downs the whole side", () => {
    const battle = pairedHunt();
    for (const human of battle.livingHumans()) human.applyDamage(human.hp - 1);
    const turn = battle.resolveBotMelee(1, NOW + 1000);
    expect(turn.finished).toBe(true);
    expect(turn.events.filter((event) => event.type === "finished")).toHaveLength(1);
  });
});
