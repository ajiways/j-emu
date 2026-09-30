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
    foeStunned: false,
    ...overrides,
  };
}

describe("SpellBookBotBrain", () => {
  it("decides melee when the book offers nothing", () => {
    const brain = new SpellBookBotBrain({ nothingWeight: 100, spells: [] });
    expect(brain.decide(snapshot(), new SequenceRandom([0.5]))).toEqual({ kind: "melee" });
  });

  it("decides a cast and counts it in its own ledger", () => {
    const card = { ...unitHuntSpellCard(), slot: "prefer" as const, weight: 0, maxCasts: 1 };
    const brain = new SpellBookBotBrain({ nothingWeight: 100, spells: [card] });
    expect(brain.decide(snapshot(), new SequenceRandom([0.99]))).toEqual({ kind: "cast", card });
    expect(brain.decide(snapshot(), new SequenceRandom([0.99]))).toEqual({ kind: "melee" });
  });

  it("does not stun a foe that is already stunned", () => {
    const stun = unitHuntSpellCard({
      slot: "prefer",
      spell: {
        animData: "magic_baf_stun",
        effects: [{ kind: 18, duration: 2, durationInTurns: true }],
      },
    });
    const brain = new SpellBookBotBrain({ nothingWeight: 100, spells: [stun] });
    expect(brain.decide(snapshot({ foeStunned: true }), new SequenceRandom([0.5]))).toEqual({
      kind: "melee",
    });
    expect(brain.decide(snapshot(), new SequenceRandom([0.5]))).toMatchObject({ kind: "cast" });
  });
});
