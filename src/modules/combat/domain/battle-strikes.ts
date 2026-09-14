import type { FightDuel } from "./fight-duel.ts";
import type { HuntHuman } from "./hunt-human.ts";
import { resolveBotTurn } from "./hunt-bot-turn.ts";
import { type BotMeleeResult } from "./hunt-melee.ts";
import type { HuntRosterBot } from "./hunt-roster-bot.ts";
import { tryPairedMelee, type PlayerMeleeResult } from "./paired-melee.ts";
import { resolveGloveFinisher, type EndingGloveResult, type KeepTurnResult } from "./hunt-cast.ts";
import type { RandomSource } from "./random-source.ts";
import type { BattleRules } from "./battle-rules.ts";
import { resolveMeleeTarget, type BotMeleePresence } from "./melee-target.ts";

export function applyPairedMelee(
  input: Readonly<{
    attacker: HuntHuman;
    side: "left" | "center" | "right";
    finished: boolean;
    rules: BattleRules;
    random: RandomSource;
    fightId: string;
    humans: readonly HuntHuman[];
    bots: readonly BotMeleePresence[];
    duel: FightDuel;
    nowMs: number;
  }>,
): Readonly<{
  result: PlayerMeleeResult;
  hitBot: BotMeleePresence | null;
  finished: boolean;
}> {
  if (input.attacker.waiting || !input.attacker.turnActive || input.finished) {
    return { result: { kind: "ignored" }, hitBot: null, finished: input.finished };
  }
  const resolved = tryPairedMelee(
    input.attacker,
    resolveMeleeTarget({
      attackerHeroId: input.attacker.heroId,
      duel: input.duel,
      humans: input.humans,
      bots: input.bots,
    }),
    input.side,
    {
      finished: input.finished,
      rules: input.rules,
      random: input.random,
      fightId: input.fightId,
      humans: input.humans,
      bots: input.bots,
      nowMs: input.nowMs,
    },
  );
  if (resolved.result.kind === "resolved") input.duel.addHit(input.attacker.heroId);
  return resolved;
}

export function applyPairedGloveEnding(
  input: Readonly<{
    human: HuntHuman;
    spellId: number;
    sequence: string | number;
    finished: boolean;
    rules: BattleRules;
    random: RandomSource;
    fightId: string;
    humans: readonly HuntHuman[];
    bots: readonly BotMeleePresence[];
    duel: FightDuel;
    nowMs: number;
  }>,
): KeepTurnResult | EndingGloveResult {
  const ending = resolveGloveFinisher(input.human, input.spellId, input.sequence, {
    finished: input.finished,
    rules: input.rules,
    random: input.random,
    fightId: input.fightId,
    humans: input.humans,
    bots: input.bots,
    duel: input.duel,
    nowMs: input.nowMs,
  });
  if (ending.kind === "ending") input.duel.addHit(input.human.heroId);
  return ending;
}

export function applyBotTurn(
  input: Readonly<{
    target: HuntHuman;
    bot: HuntRosterBot;
    rules: BattleRules;
    random: RandomSource;
    fightId: string;
    keepFightOnKill: boolean;
    living: readonly HuntHuman[];
    duel: FightDuel;
    winnerTeam: 1 | 2;
  }>,
): BotMeleeResult & Readonly<{ botHp: number }> {
  const result = resolveBotTurn(input.target, input.bot, {
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
