import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

type SpellEffect = { kind: number; duration?: number; period?: number };
type Spell = { effects: SpellEffect[] };

function readGenerated(file: string): unknown {
  return JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "content", file), "utf8"));
}

function periodicEffects(spell: Spell): SpellEffect[] {
  return spell.effects.filter((effect) => effect.kind === 4 || effect.kind === 5);
}

describe("generated spell period", () => {
  const items = readGenerated("pub1-items.generated.json") as {
    id: number;
    extra?: { spell?: Spell };
  }[];
  const books = readGenerated("bot-spell-books.generated.json") as {
    spells: { artikulId: number; spell: Spell }[];
  }[];

  it("keeps the live catalog period of the traced DoT/HoT artifacts", () => {
    const expected = new Map([
      [283, { kind: 5, duration: 80, period: 20 }],
      [308, { kind: 5, duration: 60, period: 15 }],
      [447, { kind: 4, duration: 120, period: 20 }],
      [18420, { kind: 5, duration: 80, period: 20 }],
      [396, { kind: 4, duration: 81, period: 40 }],
    ]);
    for (const [id, effect] of expected) {
      const spell = items.find((item) => item.id === id)?.extra?.spell;
      if (!spell) throw new Error(`artifact ${id} has no spell`);
      expect(periodicEffects(spell), `artifact ${id}`).toMatchObject([effect]);
    }
  });

  it("gives every bot-book kind-4/5 effect a period", () => {
    for (const book of books) {
      for (const card of book.spells) {
        for (const effect of periodicEffects(card.spell)) {
          expect(effect.period, `bot spell ${card.artikulId}`).toBeGreaterThan(0);
        }
      }
    }
  });
});
