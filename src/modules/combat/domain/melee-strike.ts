import type { BattleEvent, ExtraHit } from "./battle-event.ts";
import type { BattleRules } from "./battle-rules.ts";
import { settleDrain, type DrainOutcome } from "./drain.ts";
import type { Fighter } from "./fighter.ts";
import { rollMeleeOutcome, type MeleeOutcome, type StrikeStats } from "./melee-outcome.ts";
import { rollOverlayExtra } from "./melee-school-overlay.ts";
import type { RandomSource } from "./random-source.ts";
import { resolveHpLoss } from "./resolve-hp-loss.ts";
import { rollSwing, type Swing } from "./swing.ts";

export type FighterStrike = Readonly<{
  swing: Swing;
  outcome: MeleeOutcome;
  /** The school float of a charged overlay; `null` when none landed. */
  extra: ExtraHit | null;
  /** Hit and float together, what the target really lost. */
  dealt: number;
  /** The target is down after the whole strike. */
  killed: boolean;
  drained: DrainOutcome;
  /** Rage the target gained from the hit and the float. */
  dRage: number;
  /** `effPurge` of every charge the strike spent the last of. */
  purges: readonly BattleEvent[];
}>;

/**
 * One melee strike of any fighter on any fighter: swing, hit roll, hp loss with the dealer's
 * credit, the school float, and the drain. Who acts (a player's click or a bot's brain) and what
 * the wire shows of it stay with the caller.
 */
export function strikeFighter(
  input: Readonly<{
    attacker: Fighter;
    attackerStrength: number;
    attackerStats: StrikeStats;
    target: Fighter;
    targetStats: StrikeStats;
    random: RandomSource;
    rules: BattleRules;
  }>,
): FighterStrike {
  const { attacker, target } = input;
  const swing = rollSwing(attacker.effects, input.attackerStrength, input.random, input.rules);
  const outcome = rollMeleeOutcome({
    baseDamage: swing.baseDamage,
    attacker: input.attackerStats,
    defender: input.targetStats,
    targetHp: target.hp,
    forceCrit: swing.forceCrit,
    critChance: swing.critChance,
    random: input.random,
    rules: input.rules,
  });
  resolveHpLoss(target, outcome.applied, attacker);
  const { extra, purges: overlayPurges } = rollOverlayExtra(
    attacker.effects,
    attacker.mag,
    target,
    target.hp,
    input.random,
    input.rules,
  );
  if (extra) resolveHpLoss(target, -extra.hpChange, attacker);
  const dealt = outcome.applied + (extra ? -extra.hpChange : 0);
  return {
    swing,
    outcome,
    extra,
    dealt,
    killed: target.hp === 0,
    drained: settleDrain(attacker, dealt, swing.drain),
    dRage: dealt < 1 ? 0 : target.awardIncomingRage(dealt),
    purges: [...swing.purges, ...overlayPurges],
  };
}
