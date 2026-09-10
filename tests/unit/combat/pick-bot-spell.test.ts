import { describe, expect, it } from "vitest";
import type { HuntBotSpellBook } from "../../../src/modules/combat/domain/hunt-bot-spell-book.ts";
import { pickBotSpell } from "../../../src/modules/combat/domain/pick-bot-spell.ts";
import { SequenceRandom } from "../../support/fakes/sequence-random.ts";

const spit: HuntBotSpellBook["spells"][number] = {
  artikulId: 396,
  slot: "turn_roulette",
  weight: 10,
  maxCasts: null,
  gate: null,
  hpPct: null,
  spell: { animData: "magic_direct", endTurn: true, effects: [{ kind: 1 }] },
};

describe("pickBotSpell", () => {
  it("returns null when the book has no spells", () => {
    expect(
      pickBotSpell(
        { nothingWeight: 100, spells: [] },
        { botHp: 20, botMaxHp: 20, casts: new Map() },
        new SequenceRandom([0.5]),
      ),
    ).toBeNull();
  });

  it("picks a prefer card before roulette", () => {
    const prefer: HuntBotSpellBook["spells"][number] = {
      ...spit,
      artikulId: 1,
      slot: "prefer",
      weight: 0,
    };
    const picked = pickBotSpell(
      { nothingWeight: 100, spells: [spit, prefer] },
      { botHp: 20, botMaxHp: 20, casts: new Map() },
      new SequenceRandom([0.99]),
    );
    expect(picked?.artikulId).toBe(1);
  });

  it("rolls NOTHING when the unit draw lands in the melee weight", () => {
    expect(
      pickBotSpell(
        { nothingWeight: 100, spells: [spit] },
        { botHp: 20, botMaxHp: 20, casts: new Map() },
        new SequenceRandom([0]),
      ),
    ).toBeNull();
  });

  it("picks the roulette card when the unit draw is past NOTHING", () => {
    const picked = pickBotSpell(
      { nothingWeight: 100, spells: [spit] },
      { botHp: 20, botMaxHp: 20, casts: new Map() },
      new SequenceRandom([0.95]),
    );
    expect(picked?.artikulId).toBe(396);
  });

  it("burns an uncastable fight_start opener", () => {
    const opener: HuntBotSpellBook["spells"][number] = {
      ...spit,
      artikulId: 10,
      slot: "fight_start",
      gate: "self_hp_le",
      hpPct: 40,
    };
    const casts = new Map<number, number>();
    expect(
      pickBotSpell(
        { nothingWeight: 100, spells: [opener] },
        { botHp: 20, botMaxHp: 20, casts },
        new SequenceRandom([0.5]),
      ),
    ).toBeNull();
    expect(casts.get(10)).toBe(1);
  });
});
