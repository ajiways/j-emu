import type { BattleRules } from "./battle-rules.ts";
import type { FightDuel } from "./fight-duel.ts";
import type { HuntHuman } from "./hunt-human.ts";
import { resolveBotTurn } from "./hunt-bot-turn.ts";
import { resolveRosterBotTurn } from "./hunt-bot-vs-bot.ts";
import type { BotMeleeResult } from "./hunt-melee.ts";
import type { HuntRoster } from "./hunt-roster.ts";
import type { HuntRosterBot } from "./hunt-roster-bot.ts";
import type { RandomSource } from "./random-source.ts";

/**
 * One AI-turn scheduler. Hit formulas stay split: bot→human is `resolveBotTurn`,
 * bot→bot is `resolveRosterBotTurn` (`keepFightOnKill: true` there so a bot kill
 * does not emit fight-finished).
 */
export function resolveAiActorTurn(
  input: Readonly<{
    bot: HuntRosterBot;
    duel: FightDuel;
    humans: readonly HuntHuman[];
    roster: HuntRoster;
    rules: BattleRules;
    random: RandomSource;
    fightId: string;
    keepFightOnKill: boolean;
    living: readonly HuntHuman[];
    winnerTeam: 1 | 2;
  }>,
): BotMeleeResult & Readonly<{ botHp: number }> {
  const otherId = input.duel.otherId(input.bot.fightId);
  const human = input.humans.find((entry) => entry.heroId === otherId);
  if (human) {
    const result = resolveBotTurn(human, input.bot, {
      rules: input.rules,
      random: input.random,
      fightId: input.fightId,
      keepFightOnKill: input.keepFightOnKill,
      living: input.living,
      winnerTeam: input.winnerTeam,
    });
    input.duel.addHit(input.bot.fightId);
    return result;
  }
  const target = input.roster.findBot(otherId);
  if (!target) {
    throw new Error(`Duel opponent ${otherId} is neither a human nor a fight bot`);
  }
  const events = [
    ...resolveRosterBotTurn(input.bot, target, { rules: input.rules, random: input.random }),
  ];
  input.duel.addHit(input.bot.fightId);
  if (target.hp > 0) input.duel.setNextActor(target.fightId);
  return { events, killedPlayer: false, botHp: input.bot.hp };
}
