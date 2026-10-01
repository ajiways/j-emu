import { unitStatBase } from "../../support/stat-base.ts";
import { describe, expect, it } from "vitest";
import { FightEffectIds } from "../../../src/modules/combat/domain/fight-effect-ids.ts";
import { FighterEffects } from "../../../src/modules/combat/domain/fighter-effects.ts";
import type { Fighter, FighterKind } from "../../../src/modules/combat/domain/fighter.ts";
import { resolveHpLoss } from "../../../src/modules/combat/domain/resolve-hp-loss.ts";

class FakeFighter implements Fighter {
  readonly team = 1 as const;
  readonly maxHp: number;
  readonly mag = { power: 0, resist: 0 };
  stunnedTurns = 0;
  readonly effects = new FighterEffects({
    heroId: 1,
    base: unitStatBase(1),
    startedAtMs: 0,
    gearSpells: [],
    effectIds: new FightEffectIds(),
  });
  readonly credits: { amount: number; targetKind: FighterKind }[] = [];
  applyCalls = 0;
  killedBy: number | null = null;

  constructor(
    readonly id: number,
    readonly fighterKind: FighterKind,
    public hp: number,
  ) {
    this.maxHp = hp;
  }

  applyDamage(amount: number): boolean {
    this.applyCalls += 1;
    this.hp = Math.max(0, this.hp - amount);
    return this.hp === 0;
  }

  clampToMaxMp(): void {
    // A fake has no mana.
  }

  clampToMaxHp(): void {
    this.hp = Math.min(this.hp, this.maxHp);
  }

  applyHeal(amount: number): number {
    const healed = Math.min(this.maxHp - this.hp, amount);
    this.hp += healed;
    return healed;
  }

  awardIncomingRage(): number {
    return 0;
  }

  markKilledBy(killerId: number): void {
    this.killedBy = killerId;
  }

  creditDealt(amount: number, target: { fighterKind: FighterKind }): void {
    this.credits.push({ amount, targetKind: target.fighterKind });
  }
}

describe("resolveHpLoss", () => {
  it("applies a non-lethal hit and credits the dealer by target kind", () => {
    const dealer = new FakeFighter(1, "human", 30);
    const target = new FakeFighter(1_000_000, "bot", 20);
    expect(resolveHpLoss(target, 7, dealer)).toEqual({ applied: 7, killed: false });
    expect(target.hp).toBe(13);
    expect(dealer.credits).toEqual([{ amount: 7, targetKind: "bot" }]);
  });

  it("caps overkill at the target's hp and reports the kill", () => {
    const dealer = new FakeFighter(1, "human", 30);
    const target = new FakeFighter(2, "human", 5);
    expect(resolveHpLoss(target, 50, dealer)).toEqual({ applied: 5, killed: true });
    expect(dealer.credits).toEqual([{ amount: 5, targetKind: "human" }]);
    expect(target.killedBy).toBe(1);
  });

  it("names no killer for a hit that leaves the target standing", () => {
    const dealer = new FakeFighter(1, "human", 30);
    const target = new FakeFighter(2, "human", 9);
    resolveHpLoss(target, 3, dealer);
    expect(target.killedBy).toBeNull();
  });

  it("changes nothing for a fighter already at 0 hp", () => {
    const dealer = new FakeFighter(1, "human", 30);
    const target = new FakeFighter(2, "human", 1);
    target.hp = 0;
    expect(resolveHpLoss(target, 4, dealer)).toEqual({ applied: 0, killed: true });
    expect(target.applyCalls).toBe(0);
    expect(dealer.credits).toEqual([]);
  });

  it("does not credit when no dealer is given", () => {
    const target = new FakeFighter(2, "human", 10);
    expect(resolveHpLoss(target, 3)).toEqual({ applied: 3, killed: false });
  });

  it("rejects a negative or fractional hit", () => {
    const target = new FakeFighter(2, "human", 10);
    expect(() => resolveHpLoss(target, -1)).toThrow(/non-negative integer/);
    expect(() => resolveHpLoss(target, 1.5)).toThrow(/non-negative integer/);
  });
});
