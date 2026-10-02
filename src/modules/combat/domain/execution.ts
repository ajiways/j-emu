import type { Fighter } from "./fighter.ts";
import type { RandomSource } from "./random-source.ts";

/** The killing blow must deal at least this many times the hit points the victim had before it. */
const EXECUTION_DAMAGE_RATIO = 4;

/** How much higher than the striker a victim may stand: a mob one level up, a player ten. */
const MOB_LEVEL_LIMIT = -1;
const PLAYER_LEVEL_LIMIT = -10;

/**
 * An execution («Казнь»): a killing swing that carried the «Ярость» button, dealt at least
 * four times the victim's hit points, and met the level gate — a mob must not stand more than one
 * level under the striker, a player more than ten. When the conditions hold it still happens only
 * with `chance` (`BattleRules.executionChance`); the roll is drawn only then.
 */
export function isExecution(
  input: Readonly<{
    furySpent: boolean;
    killed: boolean;
    rawDamage: number;
    hpBefore: number;
    attacker: Pick<Fighter, "level">;
    target: Pick<Fighter, "level" | "fighterKind">;
    chance: number;
    random: RandomSource;
  }>,
): boolean {
  if (!input.furySpent || !input.killed) return false;
  if (input.rawDamage < EXECUTION_DAMAGE_RATIO * input.hpBefore) return false;
  const limit = input.target.fighterKind === "bot" ? MOB_LEVEL_LIMIT : PLAYER_LEVEL_LIMIT;
  if (input.target.level - input.attacker.level < limit) return false;
  return input.random.unit() < input.chance;
}
