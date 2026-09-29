import type {
  PlayerAttackAttempt,
  PlayerAttackPolicy,
} from "../../../src/modules/combat/ports/player-attack-policy.ts";

/** Tests that build PvP through a join are not about the attack rules. */
export class AllowPlayerAttackPolicy implements PlayerAttackPolicy {
  readonly attempts: PlayerAttackAttempt[] = [];

  requireAllowed(attempt: PlayerAttackAttempt): void {
    this.attempts.push(attempt);
  }
}
