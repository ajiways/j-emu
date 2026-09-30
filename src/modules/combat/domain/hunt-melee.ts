import type { BattleEvent } from "./battle-event.ts";
import type { BotSideHit } from "./bot-side-hit.ts";
import type { BattleRules } from "./battle-rules.ts";
import type { HumanFighter } from "./human-fighter.ts";
import type { BotFighter } from "./bot-fighter.ts";
import { strikeFighter } from "./melee-strike.ts";
import { strikeStatsFromHuman, strikeStatsFromBot } from "./melee-outcome.ts";
import type { RandomSource } from "./random-source.ts";

export type BotMeleeResult = Readonly<{
  events: readonly BattleEvent[];
  killedPlayer: boolean;
  /** Hits of an AOE spell on fighters other than the aimed foe. */
  sideHits: readonly BotSideHit[];
}>;

export function resolveBotMelee(
  human: HumanFighter,
  input: Readonly<{
    rules: BattleRules;
    random: RandomSource;
    bot: BotFighter;
    fightId: string;
    keepFightOnKill: boolean;
    winnerTeam: 1 | 2;
  }>,
): BotMeleeResult {
  if (human.waiting || human.hp === 0) {
    throw new Error("Paired hunter is not a bot melee target");
  }
  const strike = strikeFighter({
    attacker: input.bot,
    attackerStrength: input.bot.meleeStrength(),
    attackerStats: strikeStatsFromBot(input.bot),
    target: human,
    targetStats: strikeStatsFromHuman(human),
    random: input.random,
    rules: input.rules,
  });
  const { outcome, extra, drained, dRage } = strike;
  const dead = strike.killed;
  const events: BattleEvent[] = [
    {
      type: "damage",
      sourceId: input.bot.fightId,
      targetId: human.heroId,
      animation: "attack_center",
      hpChange: -outcome.applied,
      targetMaxHp: human.maxHp,
      killed: dead,
      react: outcome.react,
      dRage,
      ...(drained.healed > 0 ? { drain: drained.healed, selfReact: drained.selfReact } : {}),
      ...(extra ? { extraHits: [extra] } : {}),
    },
    ...(drained.hurtEvent ? [drained.hurtEvent] : []),
    ...strike.purges,
  ];
  if (dead && !input.keepFightOnKill) {
    events.push({ type: "finished", winnerTeam: input.winnerTeam, fightId: input.fightId });
  }
  return { events, killedPlayer: dead, sideHits: [] };
}

export function grantTurn(
  human: HumanFighter,
  timeoutSeconds: number,
  nowMs: number,
): BattleEvent | null {
  if (human.waiting || human.hp === 0 || human.turnActive) return null;
  human.beginTurn(nowMs, timeoutSeconds);
  return { type: "turn-granted", timeoutSeconds };
}
