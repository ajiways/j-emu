import type { FightDuel } from "./fight-duel.ts";
import type { HuntBattleInit } from "./hunt-battle-init.ts";
import type { HuntHuman } from "./hunt-human.ts";
import { resolveBotTurn } from "./hunt-bot-turn.ts";
import { type BotMeleeResult } from "./hunt-melee.ts";
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
    bot: BotMeleePresence | null;
    duel: FightDuel;
    nowMs: number;
  }>,
): Readonly<{ result: PlayerMeleeResult; botHp: number | null; finished: boolean }> {
  const botHp = input.bot === null ? null : input.bot.hp;
  if (input.attacker.waiting || !input.attacker.turnActive || input.finished) {
    return { result: { kind: "ignored" }, botHp, finished: input.finished };
  }
  const resolved = tryPairedMelee(
    input.attacker,
    resolveMeleeTarget({
      attackerHeroId: input.attacker.heroId,
      duel: input.duel,
      humans: input.humans,
      bot: input.bot,
    }),
    input.side,
    {
      finished: input.finished,
      rules: input.rules,
      random: input.random,
      fightId: input.fightId,
      humans: input.humans,
      bot: input.bot,
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
    bot: BotMeleePresence | null;
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
    bot: input.bot,
    duel: input.duel,
    nowMs: input.nowMs,
  });
  if (ending.kind === "ending") input.duel.addHit(input.human.heroId);
  return ending;
}

export function applyBotTurn(
  input: Readonly<{
    target: HuntHuman;
    rules: BattleRules;
    random: RandomSource;
    hunt: HuntBattleInit;
    botHp: number;
    fightId: string;
    hasWaiter: boolean;
    casts: Map<number, number>;
    living: readonly HuntHuman[];
    duel: FightDuel;
  }>,
): BotMeleeResult & Readonly<{ botHp: number }> {
  const result = resolveBotTurn(input.target, {
    rules: input.rules,
    random: input.random,
    botFightId: input.hunt.botFightId,
    botStrength: input.hunt.botStrength,
    botHp: input.botHp,
    botMaxHp: input.hunt.botMaxHp,
    fightId: input.fightId,
    hasWaiter: input.hasWaiter,
    book: input.hunt.botSpellBook,
    casts: input.casts,
    living: input.living,
  });
  input.duel.addHit(input.hunt.botFightId);
  return result;
}
