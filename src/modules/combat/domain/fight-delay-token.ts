import type { FightDuel } from "./fight-duel.ts";

export function fightDuelDelayToken(fightId: string, duel: FightDuel): string {
  const lo = Math.min(duel.aId, duel.bId);
  const hi = Math.max(duel.aId, duel.bId);
  return `${fightId}:${lo}:${hi}`;
}

export function fightDelayTokens(fightId: string, duels: readonly FightDuel[]): readonly string[] {
  return duels.map((duel) => fightDuelDelayToken(fightId, duel));
}
