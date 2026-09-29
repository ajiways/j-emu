import { describe, expect, it } from "vitest";
import { FightDuel } from "../../../src/modules/combat/domain/fight-duel.ts";

describe("FightDuel hit counter", () => {
  it("counts alternating turns for both sides", () => {
    const duel = new FightDuel(1, 1_000_000, 1);
    duel.addHit(1);
    duel.addHit(1_000_000);
    duel.addHit(1);
    expect(duel.hitsFor(1)).toBe(2);
    expect(duel.hitsFor(1_000_000)).toBe(1);
  });

  it("counts consecutive turns of the same fighter once (the foe was stunned in between)", () => {
    const duel = new FightDuel(1, 1_000_000, 1);
    duel.addHit(1_000_000);
    duel.addHit(1_000_000);
    duel.addHit(1_000_000);
    expect(duel.hitsFor(1_000_000)).toBe(1);
    expect(duel.hitsFor(1)).toBe(0);
    duel.addHit(1);
    duel.addHit(1_000_000);
    expect(duel.hitsFor(1_000_000)).toBe(2);
  });

  it("counts an AFK skip of the stunned side as its own turn", () => {
    const duel = new FightDuel(1, 1_000_000, 1);
    duel.addHit(1_000_000);
    duel.addHit(1);
    duel.addHit(1_000_000);
    expect(duel.hitsFor(1)).toBe(1);
    expect(duel.hitsFor(1_000_000)).toBe(2);
  });

  it("starts the streak over after a reset or a replaced fighter", () => {
    const duel = new FightDuel(1, 1_000_000, 1);
    duel.addHit(1_000_000);
    duel.resetHits();
    duel.addHit(1_000_000);
    expect(duel.hitsFor(1_000_000)).toBe(1);
    duel.replace(1_000_000, 1_000_001);
    duel.addHit(1_000_001);
    expect(duel.hitsFor(1_000_001)).toBe(2);
  });
});
