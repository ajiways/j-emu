import { advanceActionClock } from "./duel-clock.ts";
import type { BattleEvent } from "./battle-event.ts";
import type { BattleRules } from "./battle-rules.ts";
import type { HumanFighter } from "./human-fighter.ts";
import type { BotFighter } from "./bot-fighter.ts";
import { strikeFighter } from "./melee-strike.ts";
import { enemySideCleared } from "./melee-target.ts";
import type { Participant } from "./participant.ts";
import type { RandomSource } from "./random-source.ts";
import { resolveHpLoss } from "./resolve-hp-loss.ts";

export type PlayerMeleeResult =
  | Readonly<{ kind: "ignored" }>
  | Readonly<{ kind: "resolved"; events: readonly BattleEvent[]; selfKilled?: true }>;

export function tryPairedMelee(
  attacker: HumanFighter,
  target: Participant,
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
  const everyone = [...input.humans, ...input.bots];
  requireRosterMember(target, everyone);
  const strike = strikeFighter({
    attacker,
    attackerStrength: attacker.meleeStrength(),
    attackerStats: attacker.strikeStats(),
    target,
    targetStats: target.strikeStats(),
    random: input.random,
    rules: input.rules,
  });
  const comboCp = attacker.casts.hits.length > 0 ? attacker.casts.advanceCombo(side) : undefined;
  const { extra, outcome, killed, drained, dRage } = strike;
  const finished = input.finished || (killed && enemySideCleared(target.team, everyone));
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
    victim: target,
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
  attacker: Participant,
  target: Participant,
  damage: number,
  participants: readonly Participant[],
): Readonly<{
  killed: boolean;
  finished: boolean;
  targetId: number;
  targetMaxHp: number;
}> {
  if (!Number.isInteger(damage) || damage < 1) {
    throw new Error("Melee damage must be a positive integer");
  }
  if (target.hp === 0) throw new Error("Melee target is not a living opponent");
  requireRosterMember(target, participants);
  const { killed } = resolveHpLoss(target, damage, attacker);
  return {
    killed,
    finished: killed && enemySideCleared(target.team, participants),
    targetId: target.id,
    targetMaxHp: target.maxHp,
  };
}

function requireRosterMember(target: Participant, participants: readonly Participant[]): void {
  if (!participants.some((entry) => entry.id === target.id)) {
    throw new Error(`Melee target ${target.id} is missing from the roster`);
  }
}

function requireLivingMeleeTarget(target: Participant): void {
  if (target.waiting || target.hp === 0) {
    throw new Error("Melee target is not a living paired opponent");
  }
}
