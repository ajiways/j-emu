import type { BattleRules } from "./battle-rules.ts";
import type { CombatSpell } from "./combat-loadout.ts";
import type { DamageTarget } from "./damage-target.ts";
import type { MagStats } from "./mag-stats.ts";
import { kind1Effect, magicHitFromKind1 } from "./magic-hit.ts";
import type { RandomSource } from "./random-source.ts";
import { shuffleInPlace } from "./shuffle-in-place.ts";

/** jgr `gloveCast.ts`: AOE with `randTarget` and no `targetCount` picks up to 8. */
const AOE_DEFAULT_TARGET_COUNT = 8;

export function spellKind1IsAoe(spell: CombatSpell): boolean {
  const kind1 = kind1Effect(spell);
  if (!kind1) return false;
  const count = kind1.targetCount;
  if (count !== undefined && count > 1) return true;
  return spell.targetRestr?.randTarget === true;
}

export function spellAoeTargetCount(spell: CombatSpell): number {
  if (!spellKind1IsAoe(spell)) {
    throw new Error("AOE target count is only defined for AOE kind-1");
  }
  const count = kind1Effect(spell)?.targetCount;
  if (count !== undefined) {
    if (!Number.isInteger(count) || count < 1) {
      throw new Error("AOE targetCount must be a positive integer");
    }
    return count;
  }
  return AOE_DEFAULT_TARGET_COUNT;
}

/**
 * What an instant kind-1 spell of `caster` asks of `target`, before the target's hp caps it: the
 * magic roll, rolled anew for every target of an AOE spell. The same for a player's glove and a bot.
 */
export function rollSpellDamage(
  input: Readonly<{
    spell: CombatSpell;
    casterStrength: number;
    caster: MagStats;
    target: DamageTarget;
    random: RandomSource;
    rules: BattleRules;
  }>,
): number {
  return magicHitFromKind1(
    input.spell,
    input.casterStrength,
    input.caster,
    input.target,
    input.random,
    input.rules,
  );
}

/**
 * The targets of an AOE spell: the one it is aimed at first, then random others of the living
 * enemies, up to `count`. `enemies` lists every living enemy, the primary among them.
 */
export function pickSpellTargets<T extends Readonly<{ id: number }>>(
  input: Readonly<{
    primaryId: number;
    enemies: readonly T[];
    count: number;
    random: RandomSource;
  }>,
): readonly T[] {
  if (!Number.isInteger(input.count) || input.count < 1) {
    throw new Error("AOE target count must be a positive integer");
  }
  const preferred = input.enemies.filter((target) => target.id === input.primaryId);
  if (preferred.length !== 1) {
    throw new Error(`AOE primary ${input.primaryId} is not a living enemy`);
  }
  const rest = input.enemies.filter((target) => target.id !== input.primaryId);
  shuffleInPlace(rest, input.random);
  return [...preferred, ...rest].slice(0, input.count);
}
