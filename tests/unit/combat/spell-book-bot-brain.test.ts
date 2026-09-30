import { describe, expect, it } from "vitest";
import { SpellBookBotBrain } from "../../../src/modules/combat/domain/spell-book-bot-brain.ts";
import type { CombatSnapshot } from "../../../src/modules/combat/domain/combat-snapshot.ts";
import { unitHuntSpellCard } from "../../support/hunt-start-input.ts";
import { SequenceRandom } from "../../support/fakes/sequence-random.ts";

function snapshot(overrides: Partial<CombatSnapshot> = {}): CombatSnapshot {
  return {
    selfHp: 20,
    selfMaxHp: 20,
    foeStandingGroups: [],
    casts: new Map(),
    ...overrides,
  };
}

describe("SpellBookBotBrain", () => {
  it("decides melee when the book offers nothing", () => {
    const brain = new SpellBookBotBrain({ nothingWeight: 100, spells: [] });
    expect(brain.decide(snapshot(), new SequenceRandom([0.5]))).toEqual({ kind: "melee" });
  });

  it("decides a cast and counts it in the actor's ledger", () => {
    const card = { ...unitHuntSpellCard(), slot: "prefer" as const, weight: 0 };
    const brain = new SpellBookBotBrain({ nothingWeight: 100, spells: [card] });
    const casts = new Map<number, number>();
    const decision = brain.decide(snapshot({ casts }), new SequenceRandom([0.99]));
    expect(decision).toEqual({ kind: "cast", card });
    expect(casts.get(card.artikulId)).toBe(1);
  });
});
