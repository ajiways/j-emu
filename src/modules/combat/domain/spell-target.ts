import type { CombatSpell } from "./combat-loadout.ts";
import { FightCastDenied } from "./fight-cast-denied.ts";
import type { Participant } from "./participant.ts";
import type { Roster } from "./roster.ts";

/**
 * A spell the catalog forbids aiming at the opposing side («Дар неистовства», «Прикрытие»)
 * is an ally spell: its carrier is the ally the player clicks.
 */
export function aimsOnlyAtAllies(spell: CombatSpell): boolean {
  const restriction = spell.targetRestr;
  return restriction?.opp === false && restriction.oppTeam === false;
}

/**
 * The ally an ally spell is cast on, from the `targetId` the client sends. The client checks the
 * restrictions before it asks (its toasts), so a wrong target here is a forged or stale request:
 * it is denied, never redirected to someone else. `null` for a spell that is not an ally spell.
 * `inParty` and `targetCount` are not enforced: the buff lands on the one clicked ally, and the
 * fight does not know the parties.
 */
export function allyTargetOf(
  input: Readonly<{
    spell: CombatSpell;
    caster: Participant;
    roster: Roster;
    targetId: number | null;
    sequence: string | number;
  }>,
): Participant | null {
  const { spell, caster, sequence } = input;
  if (!aimsOnlyAtAllies(spell) || spell.targetRestr?.self === true) return null;
  const restriction = spell.targetRestr;
  const target = input.targetId === null ? undefined : input.roster.find(input.targetId);
  if (!target || target.team !== caster.team) throw new FightCastDenied("target", sequence);
  if (restriction?.dead === false && !target.alive) throw new FightCastDenied("target", sequence);
  if (restriction?.self === false && target.id === caster.id) {
    throw new FightCastDenied("target", sequence);
  }
  if (restriction?.noBot === true && target.fighterKind === "bot") {
    throw new FightCastDenied("target", sequence);
  }
  if (restriction?.noBot === false && target.fighterKind === "human") {
    throw new FightCastDenied("target", sequence);
  }
  return target;
}
