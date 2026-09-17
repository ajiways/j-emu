import type { CombatSpell } from "./combat-loadout.ts";
import { kind1Effect } from "./magic-hit.ts";
import type { HuntHuman } from "./hunt-human.ts";
import {
  botMeleeTarget,
  humanMeleeTarget,
  type BotMeleePresence,
  type MeleeTarget,
} from "./melee-target.ts";
import type { RandomSource } from "./random-source.ts";
import { shuffleInPlace } from "./shuffle-in-place.ts";

/** jgr `gloveCast.ts`: AOE with `randTarget` and no `targetCount` picks up to 8. */
const AOE_DEFAULT_TARGET_COUNT = 8;

export function gloveKind1IsAoe(spell: CombatSpell): boolean {
  const kind1 = kind1Effect(spell);
  if (!kind1) return false;
  const count = kind1.targetCount;
  if (count !== undefined && count > 1) return true;
  return spell.targetRestr?.randTarget === true;
}

export function gloveAoeTargetCount(spell: CombatSpell): number {
  if (!gloveKind1IsAoe(spell)) {
    throw new Error("Glove AOE target count is only defined for AOE kind-1");
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

export function aoeKind1Damage(full: number): number {
  if (!Number.isInteger(full) || full < 1) {
    throw new Error("AOE full roll must be a positive integer");
  }
  return Math.max(1, Math.round(full / 2));
}

export function pickGloveAoeTargets(
  input: Readonly<{
    caster: HuntHuman;
    primary: MeleeTarget;
    humans: readonly HuntHuman[];
    bots: readonly BotMeleePresence[];
    count: number;
    random: RandomSource;
  }>,
): readonly MeleeTarget[] {
  if (!Number.isInteger(input.count) || input.count < 1) {
    throw new Error("AOE target count must be a positive integer");
  }
  const enemyTeam = input.caster.team === 1 ? 2 : 1;
  const pool: MeleeTarget[] = [
    ...input.bots.filter((bot) => bot.team === enemyTeam && bot.hp > 0).map(botMeleeTarget),
    ...input.humans
      .filter((human) => human.team === enemyTeam && !human.leftLive && human.hp > 0)
      .map(humanMeleeTarget),
  ];
  const primaryId = input.primary.id;
  const preferred = pool.filter((target) => target.id === primaryId);
  if (preferred.length !== 1) {
    throw new Error(`AOE primary ${primaryId} is not a living enemy`);
  }
  const rest = pool.filter((target) => target.id !== primaryId);
  shuffleInPlace(rest, input.random);
  return [...preferred, ...rest].slice(0, input.count);
}
