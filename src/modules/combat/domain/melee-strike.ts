import type { BattleEvent, ExtraHit } from "./battle-event.ts";
import type { BattleRules } from "./battle-rules.ts";
import { settleDrain, type DrainOutcome } from "./drain.ts";
import type { Fighter } from "./fighter.ts";
import type { Participant } from "./participant.ts";
import { pickExecutionAnimation } from "./execution-animation.ts";
import { isExecution } from "./execution.ts";
import {
  MELEE_REACT,
  rollMeleeOutcome,
  type MeleeOutcome,
  type StrikeStats,
} from "./melee-outcome.ts";
import { rollOverlayExtra } from "./melee-school-overlay.ts";
import type { RandomSource } from "./random-source.ts";
import { resolveHpLoss } from "./resolve-hp-loss.ts";
import { shieldEvents } from "./shield-pool.ts";
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
  /** What the target's shields took of the hit and the float, and the shields it used up. */
  shields: readonly BattleEvent[];
  /** The wire animation of the execution («Казнь») the killing blow was; `null` for no execution. */
  execution: string | null;
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
  const hitShield = shieldEvents(attacker.id, target, target.effects.takeHitShield());
  const hpBefore = target.hp;
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
  const floatShield = shieldEvents(attacker.id, target, target.effects.takeHitShield());
  const dealt = outcome.applied + (extra ? -extra.hpChange : 0);
  const executes = isExecution({
    furyFill: swing.furyFill,
    killed: target.hp === 0,
    rawDamage: outcome.raw,
    hpBefore,
    attacker,
    target,
    chance: input.rules.executionChance,
    random: input.random,
  });
  let execution: string | null = null;
  if (executes) {
    execution = pickExecutionAnimation(attacker.creditExecution(target), input.random);
    target.markExecuted();
  }
  return {
    swing,
    outcome,
    extra,
    dealt,
    killed: target.hp === 0,
    drained: settleDrain(attacker, dealt, swing.drain),
    dRage: dealt < 1 ? 0 : target.awardIncomingRage(dealt),
    purges: [...swing.purges, ...overlayPurges],
    shields: [...hitShield, ...floatShield],
    execution,
  };
}

/**
 * What a strike shows: the hit itself (with the hit points it drained, the rage the target gained
 * and the school float), the self-damage of a drain, and the charges that ran out. The same for
 * every attacker; `comboCp` is the glove combo a player's strike advanced.
 */
export function strikeEvents(
  input: Readonly<{
    attacker: Participant;
    target: Participant;
    strike: FighterStrike;
    animation: string;
    comboCp?: number;
  }>,
): readonly BattleEvent[] {
  const { strike, attacker, target } = input;
  const { outcome, extra, drained } = strike;
  return [
    {
      type: "damage",
      sourceId: attacker.id,
      targetId: target.id,
      animation: input.animation,
      hpChange: -outcome.applied,
      targetMaxHp: target.maxHp,
      killed: strike.killed,
      // The execution replaces the kill react with its own animation of the blow.
      react: strike.execution !== null ? MELEE_REACT.kill : outcome.react,
      ...(strike.execution === null ? {} : { fatality: strike.execution }),
      ...(outcome.blocked > 0 ? { blocked: outcome.blocked } : {}),
      dRage: strike.dRage,
      ...(input.comboCp !== undefined ? { comboCp: input.comboCp } : {}),
      ...(drained.healed > 0 ? { drain: drained.healed, selfReact: drained.selfReact } : {}),
      ...(extra ? { extraHits: [extra] } : {}),
    },
    ...strike.shields,
    ...(drained.hurtEvent ? [drained.hurtEvent] : []),
    ...strike.purges,
  ];
}
