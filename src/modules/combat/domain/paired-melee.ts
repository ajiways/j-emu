import { advanceActionClock } from "./duel-clock.ts";
import type { BattleEvent } from "./battle-event.ts";
import type { BattleRules } from "./battle-rules.ts";
import type { HumanFighter } from "./human-fighter.ts";
import type { BotFighter } from "./bot-fighter.ts";
import { strikeFighter } from "./melee-strike.ts";
import { strikeStatsFromHuman } from "./melee-outcome.ts";
import { enemySideCleared, fightCombatants, targetHp, type MeleeTarget } from "./melee-target.ts";
import type { RandomSource } from "./random-source.ts";
import { resolveHpLoss } from "./resolve-hp-loss.ts";

export type PlayerMeleeResult =
  | Readonly<{ kind: "ignored" }>
  | Readonly<{ kind: "resolved"; events: readonly BattleEvent[]; selfKilled?: true }>;

export function tryPairedMelee(
  attacker: HumanFighter,
  target: MeleeTarget,
  side: "left" | "center" | "right",
  input: Readonly<{
    finished: boolean;
    rules: BattleRules;
    random: RandomSource;
    fightId: string;
    humans: readonly HumanFighter[];
    bots: readonly BotFighter[];
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
  const turnElapsedMs = attacker.turnElapsedMs(input.nowMs, input.rules.turnTimeoutSeconds);
  attacker.endTurn();
  attacker.noteAction();
  const victim = target.kind === "human" ? target.human : target.bot;
  const context = { humans: input.humans, bots: input.bots };
  requireRosterBot(target, context.bots);
  const strike = strikeFighter({
    attacker,
    attackerStrength: attacker.meleeStrength(),
    attackerStats: strikeStatsFromHuman(attacker),
    target: victim,
    targetStats: target.strikeStats,
    random: input.random,
    rules: input.rules,
  });
  const comboCp = attacker.casts.hits.length > 0 ? attacker.casts.advanceCombo(side) : undefined;
  const { extra, outcome, killed, drained, dRage } = strike;
  const finished =
    input.finished ||
    (killed && enemySideCleared(target.team, fightCombatants(context.humans, context.bots)));
  const events: BattleEvent[] = [
    { type: "turn-wait", timeoutSeconds: input.rules.turnTimeoutSeconds },
    {
      type: "damage",
      sourceId: attacker.heroId,
      targetId: target.id,
      animation: `attack_${side}`,
      hpChange: -outcome.applied,
      targetMaxHp: target.maxHp,
      killed,
      react: outcome.react,
      dRage,
      ...(comboCp !== undefined ? { comboCp } : {}),
      ...(drained.healed > 0 ? { drain: drained.healed, selfReact: drained.selfReact } : {}),
      ...(extra ? { extraHits: [extra] } : {}),
    },
  ];
  if (drained.hurtEvent) events.push(drained.hurtEvent);
  events.push(...strike.purges);
  if (finished) {
    events.push({ type: "finished", winnerTeam: attacker.team, fightId: input.fightId });
    return { result: { kind: "resolved", events }, finished };
  }
  const clock = advanceActionClock({
    attacker,
    victim: target.kind === "human" ? target.human : target.bot,
    victimKilledByHit: killed,
    turnElapsedMs,
    nowMs: input.nowMs,
    rules: input.rules,
    random: input.random,
    humans: input.humans,
    bots: input.bots,
    fightId: input.fightId,
  });
  events.push(...clock.events);
  return {
    result: {
      kind: "resolved",
      events,
      ...(clock.selfKilled ? { selfKilled: true as const } : {}),
    },
    finished: clock.finished,
  };
}

export function applyDamageToMeleeTarget(
  attacker: HumanFighter,
  target: MeleeTarget,
  damage: number,
  context: Readonly<{
    humans: readonly HumanFighter[];
    bots: readonly BotFighter[];
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
  requireRosterBot(target, context.bots);
  const victim = target.kind === "human" ? target.human : target.bot;
  const { killed } = resolveHpLoss(victim, damage, attacker);
  return {
    killed,
    finished:
      killed && enemySideCleared(target.team, fightCombatants(context.humans, context.bots)),
    targetId: target.id,
    targetMaxHp: target.maxHp,
  };
}

function requireRosterBot(target: MeleeTarget, bots: readonly BotFighter[]): void {
  if (target.kind === "bot" && !bots.some((bot) => bot.fightId === target.id)) {
    throw new Error(`Melee bot ${target.id} is missing from the roster`);
  }
}

function requireLivingMeleeTarget(target: MeleeTarget): void {
  if (target.kind === "human" && target.human.waiting) {
    throw new Error("Melee target is not a living paired opponent");
  }
  if (targetHp(target) === 0) {
    throw new Error("Melee target is not a living paired opponent");
  }
}
