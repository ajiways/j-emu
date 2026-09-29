/** One human stepping into a fight against a team that already has humans in it. */
export type PlayerAttackAttempt = Readonly<{
  areaId: string;
  instanceCopyId: number | null;
  attackerHeroId: number;
  joinTeam: 1 | 2;
}>;

/**
 * Who may attack whom, and where (factions, location). Throws `HuntJoinDenied` when the
 * attack is not allowed; joining a fight without making it PvP never asks.
 */
export interface PlayerAttackPolicy {
  requireAllowed(attempt: PlayerAttackAttempt): void;
}
