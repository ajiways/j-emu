import { describe, expect, it } from "vitest";
import type { CombatIdolRow } from "../../../src/modules/combat/domain/combat-loadout.ts";
import { EMPTY_COMBAT_LOADOUT } from "../../../src/modules/combat/domain/combat-loadout.ts";
import { FightCastDenied } from "../../../src/modules/combat/domain/fight-cast-denied.ts";
import { FightEffectIds } from "../../../src/modules/combat/domain/fight-effect-ids.ts";
import { HumanFighter } from "../../../src/modules/combat/domain/human-fighter.ts";
import { tryIdolCast } from "../../../src/modules/combat/domain/idol-summon.ts";
import { UNIT_HUNT_APPEARANCE, unitHuntHumanStats } from "../../support/hunt-start-input.ts";
import { rosterOf } from "../../support/roster-of.ts";

const PHANTOM = {
  artikulId: 550,
  nick: "Стойкий фантом Гарпины",
  level: 15,
  strength: 200,
  maxHp: 300,
  avatar: "avatar_garpina1_sm.jpg",
  sk: "52",
  body: "ghost(0,1,0)",
};

function idol(spell: CombatIdolRow["spell"], phantom: CombatIdolRow["phantom"]): CombatIdolRow {
  return {
    itemId: 100_001,
    artifactId: 299,
    count: 1,
    title: "Идол",
    picture: "statuetka.png",
    spell,
    phantom,
  };
}

const FIXED = { mpCost: 20, effects: [{ kind: 10, botArtikulId: 550 }] };
const RANGE = { mpCost: 1, effects: [{ kind: 10, botArtikulId: 550, manaCost: 39 }] };

function hero(row: CombatIdolRow, mp: number): HumanFighter {
  const human = new HumanFighter({
    accountId: 1,
    heroId: 1,
    nick: "H1",
    level: 7,
    kind: 1,
    hp: 50,
    maxHp: 50,
    mp,
    maxMp: 40,
    team: 1,
    waiting: false,
    ...unitHuntHumanStats(20),
    startedAtMs: 0,
    loadout: { ...EMPTY_COMBAT_LOADOUT, idols: [row] },
    appearance: UNIT_HUNT_APPEARANCE,
    effectIds: new FightEffectIds(),
  });
  human.authed = true;
  return human;
}

function cast(human: HumanFighter) {
  const roster = rosterOf([human], []);
  const result = tryIdolCast({
    human,
    itemId: 100_001,
    sequence: 1,
    roster,
    finished: false,
    allocateBotId: () => 1_000_007,
  });
  return { roster, result };
}

describe("idol summon", () => {
  it("calls the phantom at full strength for a fixed idol and spends its price", () => {
    const human = hero(idol(FIXED, PHANTOM), 30);
    const { roster, result } = cast(human);
    expect(human.mp).toBe(10);
    expect(result).toMatchObject({ kind: "resolved", consumeBagItemId: 100_001 });
    expect(roster.bots).toHaveLength(1);
    expect(roster.bots[0]).toMatchObject({ team: 1, fightId: 1_000_007, hp: 300, strength: 200 });
    expect(human.casts.idolRow(100_001)).toBeNull();
  });

  it("scales a spend-range idol by the mana it took", () => {
    const human = hero(idol(RANGE, PHANTOM), 20);
    const { roster } = cast(human);
    expect(human.mp).toBe(0);
    expect(roster.bots[0]).toMatchObject({ hp: 150, strength: 100 });
  });

  it("refuses an idol the hero cannot pay for, keeping the item", () => {
    const human = hero(idol(FIXED, PHANTOM), 5);
    expect(() => cast(human)).toThrow(FightCastDenied);
    expect(human.casts.idolRow(100_001)).not.toBeNull();
  });

  it("fails loudly when the catalog has no mob for the idol", () => {
    const human = hero(idol(FIXED, null), 30);
    expect(() => cast(human)).toThrow(/absent from the catalog/);
    expect(human.mp).toBe(30);
  });
});
