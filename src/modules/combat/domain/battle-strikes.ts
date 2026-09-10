import type { BattleRules } from "./battle-rules.ts";
import type { FightDuel } from "./fight-duel.ts";
import type { HuntBattleInit } from "./hunt-battle-init.ts";
import type { HuntHuman } from "./hunt-human.ts";
import { resolveBotTurn } from "./hunt-bot-turn.ts";
import { tryPlayerMelee, type BotMeleeResult, type PlayerMeleeResult } from "./hunt-melee.ts";
import { tryPvpMelee } from "./pvp-melee.ts";
import { resolveGloveFinisher, type EndingGloveResult, type KeepTurnResult } from "./hunt-cast.ts";
import type { RandomSource } from "./random-source.ts";

export function applyPvpMelee(
  input: Readonly<{
    attacker: HuntHuman;
    defender: HuntHuman;
    side: "left" | "center" | "right";
    finished: boolean;
    rules: BattleRules;
    random: RandomSource;
    fightId: string;
    duel: FightDuel;
  }>,
): Readonly<{ result: PlayerMeleeResult; finished: boolean }> {
  const resolved = tryPvpMelee(input.attacker, input.defender, input.side, {
    finished: input.finished,
    rules: input.rules,
    random: input.random,
    fightId: input.fightId,
  });
  if (resolved.result.kind === "resolved") input.duel.addHit(input.attacker.heroId);
  return resolved;
}

export function applyHuntMelee(
  input: Readonly<{
    human: HuntHuman;
    side: "left" | "center" | "right";
    finished: boolean;
    rules: BattleRules;
    random: RandomSource;
    botHp: number;
    hunt: HuntBattleInit;
    fightId: string;
    duel: FightDuel;
  }>,
): Readonly<{ result: PlayerMeleeResult; botHp: number; finished: boolean }> {
  const resolved = tryPlayerMelee(input.human, input.side, {
    finished: input.finished,
    rules: input.rules,
    random: input.random,
    botHp: input.botHp,
    botFightId: input.hunt.botFightId,
    botMaxHp: input.hunt.botMaxHp,
    fightId: input.fightId,
  });
  if (resolved.result.kind === "resolved") input.duel.addHit(input.human.heroId);
  return { result: resolved.result, botHp: resolved.botHp, finished: resolved.finished };
}

export function applyHuntGloveEnding(
  input: Readonly<{
    human: HuntHuman;
    spellId: number;
    sequence: string | number;
    finished: boolean;
    rules: BattleRules;
    random: RandomSource;
    botHp: number;
    hunt: HuntBattleInit;
    fightId: string;
    duel: FightDuel;
  }>,
): KeepTurnResult | EndingGloveResult {
  const ending = resolveGloveFinisher(input.human, input.spellId, input.sequence, {
    finished: input.finished,
    rules: input.rules,
    random: input.random,
    botHp: input.botHp,
    botFightId: input.hunt.botFightId,
    botMaxHp: input.hunt.botMaxHp,
    fightId: input.fightId,
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
