import type { FightDuel } from "./fight-duel.ts";
import type { HuntBattleInit } from "./hunt-battle-init.ts";
import { huntFightEnemyTeam } from "./hunt-fight-teams.ts";
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
    rules: BattleRules;
    random: RandomSource;
    hunt: HuntBattleInit;
    botHp: number;
    fightId: string;
    keepFightOnKill: boolean;
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
    keepFightOnKill: input.keepFightOnKill,
    book: input.hunt.botSpellBook,
    casts: input.casts,
    living: input.living,
    winnerTeam: huntFightEnemyTeam(input.hunt.purpose),
  });
  input.duel.addHit(input.hunt.botFightId);
  return result;
}
