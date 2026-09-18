import { appliedHpLoss } from "./applied-hp-loss.ts";
import { applyCarrierTicks } from "./apply-carrier-ticks.ts";
import type { BattleEvent } from "./battle-event.ts";
import type { BattleRules } from "./battle-rules.ts";
import type { HuntHuman } from "./hunt-human.ts";
import type { HuntRosterBot } from "./hunt-roster-bot.ts";
import { rollMeleeDamage } from "./melee-damage.ts";
import { rollMeleeOutcome, strikeStatsFromHuman } from "./melee-outcome.ts";
import { rollOverlayExtra } from "./melee-school-overlay.ts";
import { enemySideCleared, fightCombatants, targetHp, type MeleeTarget } from "./melee-target.ts";
import type { RandomSource } from "./random-source.ts";

export type PlayerMeleeResult =
  Readonly<{ kind: "ignored" }> | Readonly<{ kind: "resolved"; events: readonly BattleEvent[] }>;

export function tryPairedMelee(
  attacker: HuntHuman,
  target: MeleeTarget,
  side: "left" | "center" | "right",
  input: Readonly<{
    finished: boolean;
    rules: BattleRules;
    random: RandomSource;
    fightId: string;
    humans: readonly HuntHuman[];
    bots: readonly HuntRosterBot[];
    nowMs: number;
  }>,
): Readonly<{
  result: PlayerMeleeResult;
  finished: boolean;
}> {
  if (attacker.waiting || !attacker.turnActive || input.finished) {
    return { result: { kind: "ignored" }, finished: input.finished };
  }
  requireLivingMeleeTarget(target);
  attacker.endTurn();
  let baseDamage = rollMeleeDamage(attacker.meleeStrength(), input.random, input.rules);
  const orb = attacker.casts.takeOrbPcStr();
  const rage = attacker.casts.takeRagePcStr();
  if (orb > 0) baseDamage = Math.max(1, Math.round(baseDamage * (1 + orb / 100)));
  if (rage > 0) baseDamage = Math.max(1, Math.round(baseDamage * (1 + rage / 100)));
  const outcome = rollMeleeOutcome({
    baseDamage,
    attacker: strikeStatsFromHuman(attacker),
    defender: target.strikeStats,
    targetHp: targetHp(target),
    forceCrit: attacker.casts.takeGloveCrit(),
    random: input.random,
    rules: input.rules,
  });
  const comboCp = attacker.casts.hits.length > 0 ? attacker.casts.advanceCombo(side) : undefined;
  const context = { humans: input.humans, bots: input.bots };
  const hit =
    outcome.applied < 1
      ? {
          killed: false,
          finished: input.finished,
          targetId: target.id,
          targetMaxHp: target.maxHp,
        }
      : applyDamageToMeleeTarget(attacker, target, outcome.applied, context);
  const extra = rollOverlayExtra(
    attacker.casts,
    attacker.mag,
    target.mag,
    targetHp(target),
    input.random,
    input.rules,
  );
  let finished = hit.finished;
  let killed = hit.killed;
  if (extra) {
    const extraHit = applyDamageToMeleeTarget(attacker, target, -extra.hpChange, context);
    finished = extraHit.finished;
    killed = extraHit.killed || hit.killed;
  }
  const events: BattleEvent[] = [
    { type: "turn-wait", timeoutSeconds: input.rules.turnTimeoutSeconds },
    {
      type: "damage",
      sourceId: attacker.heroId,
      targetId: hit.targetId,
      animation: `attack_${side}`,
      hpChange: -outcome.applied,
      targetMaxHp: hit.targetMaxHp,
      killed,
      react: outcome.react,
      ...(comboCp !== undefined ? { comboCp } : {}),
      ...(extra ? { extraHits: [extra] } : {}),
    },
  ];
  for (const effectId of attacker.effects.onActorEndingTurn(input.nowMs)) {
    events.push({ type: "effect-purge", effectId });
  }
  if (orb > 0 || rage > 0) {
    for (const effectId of attacker.effects.consumeChargingHit()) {
      events.push({ type: "effect-purge", effectId });
    }
  }
  events.push(...applyCarrierTicks(attacker, input.random, input.rules));
  if (finished) {
    events.push({ type: "finished", winnerTeam: attacker.team, fightId: input.fightId });
  }
  return { result: { kind: "resolved", events }, finished };
}

export function applyDamageToMeleeTarget(
  attacker: HuntHuman,
  target: MeleeTarget,
  damage: number,
  context: Readonly<{
    humans: readonly HuntHuman[];
    bots: readonly HuntRosterBot[];
  }>,
): Readonly<{
  killed: boolean;
  finished: boolean;
  targetId: number;
  targetMaxHp: number;
}> {
  if (!Number.isInteger(damage) || damage < 1) {
    throw new Error("Melee damage must be a positive integer");
  }
  requireLivingMeleeTarget(target);
  if (target.kind === "human") {
    const applied = appliedHpLoss(damage, target.human.hp);
    attacker.creditDamageToHumans(applied);
    const killed = target.human.applyDamage(applied);
    return {
      killed,
      finished:
        killed && enemySideCleared(target.team, fightCombatants(context.humans, context.bots)),
      targetId: target.id,
      targetMaxHp: target.maxHp,
    };
  }
  if (!context.bots.some((bot) => bot.fightId === target.id)) {
    throw new Error(`Melee bot ${target.id} is missing from the roster`);
  }
  const applied = appliedHpLoss(damage, target.bot.hp);
  attacker.creditDamageToBot(applied);
  const killed = target.bot.applyDamage(applied);
  return {
    killed,
    finished:
      killed && enemySideCleared(target.team, fightCombatants(context.humans, context.bots)),
    targetId: target.id,
    targetMaxHp: target.maxHp,
  };
}

function requireLivingMeleeTarget(target: MeleeTarget): void {
  if (target.kind === "human" && target.human.waiting) {
    throw new Error("Melee target is not a living paired opponent");
  }
  if (targetHp(target) === 0) {
    throw new Error("Melee target is not a living paired opponent");
  }
}
