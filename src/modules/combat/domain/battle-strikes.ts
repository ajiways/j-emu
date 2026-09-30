import type { FightDuel } from "./fight-duel.ts";
import type { HumanFighter } from "./human-fighter.ts";
import type { BotFighter } from "./bot-fighter.ts";
import { tryPairedMelee, type PlayerMeleeResult } from "./paired-melee.ts";
import { resolveGloveFinisher, type EndingGloveResult } from "./glove-ending-cast.ts";
import type { KeepTurnResult } from "./player-casts.ts";
import type { RandomSource } from "./random-source.ts";
import type { BattleRules } from "./battle-rules.ts";
import { duelFoe } from "./melee-target.ts";

export function applyPairedMelee(
  input: Readonly<{
    attacker: HumanFighter;
    side: "left" | "center" | "right";
    finished: boolean;
    rules: BattleRules;
    random: RandomSource;
    fightId: string;
    humans: readonly HumanFighter[];
    bots: readonly BotFighter[];
    duel: FightDuel;
    nowMs: number;
  }>,
): Readonly<{
  result: PlayerMeleeResult;
  finished: boolean;
}> {
  if (input.attacker.waiting || !input.attacker.turnActive || input.finished) {
    return { result: { kind: "ignored" }, finished: input.finished };
  }
  const resolved = tryPairedMelee(
    input.attacker,
    duelFoe(input.duel, [...input.humans, ...input.bots], input.attacker.id),
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
    human: HumanFighter;
    spellId: number;
    sequence: string | number;
    finished: boolean;
    rules: BattleRules;
    random: RandomSource;
    fightId: string;
    humans: readonly HumanFighter[];
    bots: readonly BotFighter[];
    duel: FightDuel;
    duels: readonly FightDuel[];
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
    duels: input.duels,
    nowMs: input.nowMs,
  });
  if (ending.kind === "ending") input.duel.addHit(input.human.heroId);
  return ending;
}
