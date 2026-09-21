import type { FightDuel } from "./fight-duel.ts";
import type { HuntHuman } from "./hunt-human.ts";
import type { HuntRosterBot } from "./hunt-roster-bot.ts";
import { tryPairedMelee, type PlayerMeleeResult } from "./paired-melee.ts";
import { resolveGloveFinisher, type EndingGloveResult } from "./glove-ending-cast.ts";
import type { KeepTurnResult } from "./hunt-cast.ts";
import type { RandomSource } from "./random-source.ts";
import type { BattleRules } from "./battle-rules.ts";
import { resolveMeleeTarget } from "./melee-target.ts";

export function applyPairedMelee(
  input: Readonly<{
    attacker: HuntHuman;
    side: "left" | "center" | "right";
    finished: boolean;
    rules: BattleRules;
    random: RandomSource;
    fightId: string;
    humans: readonly HuntHuman[];
    bots: readonly HuntRosterBot[];
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
    bots: readonly HuntRosterBot[];
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
