import { describe, expect, it } from "vitest";
import { EMPTY_COMBAT_LOADOUT } from "../../../src/modules/combat/domain/combat-loadout.ts";
import type { CombatSpell } from "../../../src/modules/combat/domain/combat-loadout.ts";
import { FightEffectIds } from "../../../src/modules/combat/domain/fight-effect-ids.ts";
import { HumanFighter } from "../../../src/modules/combat/domain/human-fighter.ts";
import {
  castTimedSelfSpell,
  isTimedSelfSpell,
} from "../../../src/modules/combat/domain/timed-self-spell.ts";
import { UNIT_HUNT_APPEARANCE, unitHuntHumanStats } from "../../support/hunt-start-input.ts";

/** Покров Тьмы I, artikul 182, as the catalog has it. */
const DARK_VEIL: CombatSpell = {
  animData: "magic_baf_dark",
  groupId: 852,
  effects: [
    {
      kind: 3,
      dmgType: 1,
      order: -1,
      hidden: 0,
      duration: 400,
      skills: [
        { skillId: "DEX", value: 19 },
        { skillId: "pcDEX", value: 23 },
      ],
    },
  ],
};

/** Малый эликсир богатыря, artikul 169: the max hp buff first, then the heal of the new maximum. */
const HERO_ELIXIR: CombatSpell = {
  animData: "botles_giant_grey",
  groupId: 843,
  effects: [
    { kind: 2, amount: "26%", dmgType: 1, order: 1 },
    { kind: 3, dmgType: 1, order: -1, skills: [{ skillId: "pcHPMAX", value: 35 }] },
  ],
};

function hero(overrides: Partial<ConstructorParameters<typeof HumanFighter>[0]> = {}) {
  const human = new HumanFighter({
    accountId: 1,
    heroId: 1,
    nick: "H1",
    level: 7,
    kind: 1,
    hp: 93,
    maxHp: 111,
    mp: 21,
    maxMp: 21,
    team: 1,
    waiting: false,
    ...unitHuntHumanStats(53),
    dexterity: 36,
    startedAtMs: 0,
    loadout: EMPTY_COMBAT_LOADOUT,
    appearance: UNIT_HUNT_APPEARANCE,
    effectIds: new FightEffectIds(),
    ...overrides,
  });
  human.authed = true;
  return human;
}

const source = (artikulId: number, title: string, spell: CombatSpell) => ({
  artikulId,
  title,
  picture: "p.png",
  spell,
  flags: "262144",
});

describe("timed self spells", () => {
  it("recognizes timed buffs and heals but not charged orbs or strikes", () => {
    expect(isTimedSelfSpell(DARK_VEIL)).toBe(true);
    expect(isTimedSelfSpell(HERO_ELIXIR)).toBe(true);
    expect(isTimedSelfSpell({ effects: [{ kind: 3, charging: 1 }] })).toBe(false);
    expect(isTimedSelfSpell({ effects: [{ kind: 3 }, { kind: 1 }] })).toBe(false);
    expect(isTimedSelfSpell({ effects: [{ kind: 2, amount: 15 }] })).toBe(false);
  });

  it("raises dexterity by the baked amount for 400 fight seconds (live 182)", () => {
    const human = hero();
    const events = castTimedSelfSpell(human, source(182, "Покров Тьмы I", DARK_VEIL), 0);
    expect(events).toEqual([
      expect.objectContaining({
        type: "effect-use",
        artikulId: 182,
        kind: 3,
        groupId: 852,
        remainTime: 400,
        skills: { DEX: 32, pcDEX: 1.23 },
      }),
    ]);
    expect(human.dexterity).toBe(68);
    for (let action = 1; action <= 9; action += 1) {
      expect(human.effects.advanceOnAction(0, 40)).toEqual([]);
    }
    expect(human.dexterity).toBe(68);
    expect(human.effects.advanceOnAction(0, 40)).toEqual([
      expect.objectContaining({ kind: "expire" }),
    ]);
    expect(human.dexterity).toBe(36);
  });

  it("replaces an earlier buff of the same group", () => {
    const human = hero();
    castTimedSelfSpell(human, source(182, "Покров Тьмы I", DARK_VEIL), 0);
    const again = castTimedSelfSpell(human, source(182, "Покров Тьмы I", DARK_VEIL), 0);
    expect(again[0]).toEqual({ type: "effect-purge", effectId: 1 });
    expect(human.dexterity).toBe(68);
    expect(human.effects.snapshot()).toHaveLength(1);
  });

  it("raises the maximum first and heals the new maximum (live 169: 93/111 -> 132/150)", () => {
    const human = hero();
    const events = castTimedSelfSpell(human, source(169, "Малый эликсир богатыря", HERO_ELIXIR), 0);
    expect(events).toEqual([
      expect.objectContaining({
        type: "effect-use",
        artikulId: 169,
        skills: { HPMAX: 39, pcHPMAX: 1.35 },
      }),
      expect.objectContaining({ type: "damage", hpChange: 39, targetMaxHp: 150, react: 32 }),
    ]);
    expect(events[0]).not.toHaveProperty("remainTime");
    expect(human.maxHp).toBe(150);
    expect(human.hp).toBe(132);
  });

  it("pulls hp back under the old maximum when a max hp buff is replaced or ends", () => {
    const human = hero({ hp: 111 });
    castTimedSelfSpell(human, source(169, "Малый эликсир богатыря", HERO_ELIXIR), 0);
    expect(human.hp).toBe(150);
    human.effects.dispelGroups([843]);
    human.clampToMaxHp();
    expect(human.maxHp).toBe(111);
    expect(human.hp).toBe(111);
  });

  it("shows one icon for a spell with several timed buff effects and merges their skills", () => {
    const titan: CombatSpell = {
      animData: "botles_titan",
      groupId: 844,
      effects: [
        { kind: 3, order: -1, skills: [{ skillId: "pcSTR", value: 24 }] },
        { kind: 3, order: -1, skills: [{ skillId: "pcHPMAX", value: 24 }] },
        { kind: 2, amount: "19%", order: 1 },
      ],
    };
    const human = hero();
    const events = castTimedSelfSpell(human, source(1014, "Малый эликсир Титана", titan), 0);
    expect(events.filter((event) => event.type === "effect-use")).toHaveLength(1);
    expect(human.effects.snapshot()).toHaveLength(1);
    expect(human.meleeStrength()).toBeGreaterThan(53);
    expect(human.maxHp).toBe(111 + 27);
  });
});
