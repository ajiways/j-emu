import { describe, expect, it } from "vitest";
import { FightDuel } from "../../../src/modules/combat/domain/fight-duel.ts";
import type { Participant } from "../../../src/modules/combat/domain/participant.ts";
import { rollDuelOpener } from "../../../src/modules/combat/domain/roll-duel-opener.ts";
import { SequenceRandom } from "../../support/fakes/sequence-random.ts";

const side = (id: number, currentInitiative: number): Participant =>
  ({ id, currentInitiative }) as unknown as Participant;

describe("rollDuelOpener", () => {
  it("leaves the turn with the holder unless the roll falls to the other side", () => {
    const holder = side(1, 0);
    const other = side(2, 0);
    const duel = new FightDuel(1, 2, 1);
    rollDuelOpener(duel, { holder, other, random: new SequenceRandom([0.99]) });
    expect(duel.nextActorId).toBe(1);
    rollDuelOpener(duel, { holder, other, random: new SequenceRandom([0.01]) });
    expect(duel.nextActorId).toBe(2);
  });

  it("follows the initiative: a much stronger side wins most rolls but not all of them", () => {
    const strong = side(1, 400);
    const weak = side(2, 0);
    const duel = new FightDuel(1, 2, 1);
    // (400 + 80) / (400 + 160) is about 86 % for the strong side.
    rollDuelOpener(duel, { holder: weak, other: strong, random: new SequenceRandom([0.85]) });
    expect(duel.nextActorId).toBe(1);
    rollDuelOpener(duel, { holder: weak, other: strong, random: new SequenceRandom([0.9]) });
    expect(duel.nextActorId).toBe(2);
  });
});
