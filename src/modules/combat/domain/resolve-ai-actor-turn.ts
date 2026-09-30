import type { BattleEvent } from "./battle-event.ts";
import type { BattleRules } from "./battle-rules.ts";
import { advanceDuelClock, botActionJumpSeconds } from "./duel-clock.ts";
import type { FightDuel } from "./fight-duel.ts";
import type { HumanFighter } from "./human-fighter.ts";
import { resolveBotTurn } from "./hunt-bot-turn.ts";
import { resolveRosterBotTurn } from "./hunt-bot-vs-bot.ts";
import type { BotMeleeResult } from "./hunt-melee.ts";
import type { Fighter } from "./fighter.ts";
import type { BotFighter } from "./bot-fighter.ts";
import type { RandomSource } from "./random-source.ts";

/**
 * One AI-turn scheduler. Hit formulas stay split: bot→human is `resolveBotTurn`,
 * bot→bot is `resolveRosterBotTurn` (`keepFightOnKill: true` there so a bot kill
 * does not emit fight-finished). Either way the bot's action moves the duel clock.
 */
export function resolveAiActorTurn(
  input: Readonly<{
    bot: BotFighter;
    duel: FightDuel;
    humans: readonly HumanFighter[];
    bots: readonly BotFighter[];
    rules: BattleRules;
    random: RandomSource;
    fightId: string;
    keepFightOnKill: boolean;
    living: readonly HumanFighter[];
    winnerTeam: 1 | 2;
    nowMs: number;
  }>,
): BotMeleeResult {
  const otherId = input.duel.otherId(input.bot.fightId);
  const skipsTurn = input.bot.stunnedTurns > 0;
  const human = input.humans.find((entry) => entry.heroId === otherId);
  const enemies: readonly Fighter[] = [
    ...input.humans.filter(
      (entry) => entry.team !== input.bot.team && !entry.leftLive && entry.hp > 0,
    ),
    ...input.bots.filter((entry) => entry.team !== input.bot.team && entry.hp > 0),
  ];
  if (human) {
    const result = resolveBotTurn(human, input.bot, {
      rules: input.rules,
      random: input.random,
      fightId: input.fightId,
      keepFightOnKill: input.keepFightOnKill,
      living: input.living,
      winnerTeam: input.winnerTeam,
      nowMs: input.nowMs,
      enemies,
    });
    if (!skipsTurn) input.duel.addHit(input.bot.fightId);
    if (result.killedPlayer || input.bot.hp < 1) return result;
    const ticks = botClockTicks(input, human);
    const fell = human.hp < 1;
    return {
      events: [
        ...result.events,
        ...ticks,
        ...(fell && !input.keepFightOnKill
          ? [{ type: "finished" as const, winnerTeam: input.winnerTeam, fightId: input.fightId }]
          : []),
      ],
      killedPlayer: fell,
      sideHits: result.sideHits,
    };
  }
  const target = input.bots.find((entry) => entry.fightId === otherId);
  if (!target) {
    throw new Error(`Duel opponent ${otherId} is neither a human nor a fight bot`);
  }
  const roster = resolveRosterBotTurn(input.bot, target, {
    rules: input.rules,
    random: input.random,
    nowMs: input.nowMs,
    enemies,
  });
  const events = [...roster.events];
  if (!skipsTurn) input.duel.addHit(input.bot.fightId);
  if (input.bot.hp > 0 && target.hp > 0) events.push(...botClockTicks(input, target));
  if (target.hp > 0) input.duel.setNextActor(target.fightId);
  return { events, killedPlayer: false, sideHits: roster.sideHits };
}

function botClockTicks(
  input: Readonly<{
    bot: BotFighter;
    humans: readonly HumanFighter[];
    bots: readonly BotFighter[];
    rules: BattleRules;
    random: RandomSource;
    nowMs: number;
  }>,
  other: HumanFighter | BotFighter,
): readonly BattleEvent[] {
  return advanceDuelClock({
    fighters: [input.bot, other],
    nowMs: input.nowMs,
    jumpSeconds: botActionJumpSeconds(input.rules),
    random: input.random,
    rules: input.rules,
    sources: [...input.humans, ...input.bots],
  });
}
