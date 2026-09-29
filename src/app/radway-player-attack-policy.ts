import { HuntJoinDenied } from "../modules/combat/domain/hunt-join-denied.ts";
import type { PlayerAttackPolicy } from "../modules/combat/ports/player-attack-policy.ts";

/**
 * Radway (the only continent so far) allows no attack on a player, in any location.
 * The denial text is invented: no dump of the real message exists yet.
 */
export class RadwayPlayerAttackPolicy implements PlayerAttackPolicy {
  requireAllowed(): void {
    throw new HuntJoinDenied("на этой территории нельзя нападать на игроков");
  }
}
