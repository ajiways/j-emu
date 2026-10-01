import type { CombatSpell } from "./combat-loadout.ts";
import { FightCastDenied } from "./fight-cast-denied.ts";
import type { Participant } from "./participant.ts";
import type { RandomSource } from "./random-source.ts";
import type { Roster } from "./roster.ts";
import { shuffleInPlace } from "./shuffle-in-place.ts";

/**
 * A spell the catalog forbids aiming at the opposing side («Дар неистовства», «Прикрытие»)
 * is an ally spell: its carrier is the ally the player clicks.
 */
export function aimsOnlyAtAllies(spell: CombatSpell): boolean {
  const restriction = spell.targetRestr;
  return restriction?.opp === false && restriction.oppTeam === false;
}

type AllyAim = Readonly<{
  spell: CombatSpell;
  caster: Participant;
  roster: Roster;
  targetId: number | null;
  sequence: string | number;
  random: RandomSource;
}>;

/** Whether `member` is a legal carrier of the spell for `caster`: the catalog's target rules. */
function mayCarry(spell: CombatSpell, caster: Participant, member: Participant): boolean {
  const restriction = spell.targetRestr;
  if (member.team !== caster.team) return false;
  if (restriction?.dead === false && !member.alive) return false;
  if (restriction?.self === false && member.id === caster.id) return false;
  if (restriction?.noBot === true && member.fighterKind === "bot") return false;
  if (restriction?.noBot === false && member.fighterKind === "human") return false;
  if (restriction?.inParty === true) {
    const party = caster.casts.loadout.partyId;
    return party !== null && member.casts.loadout.partyId === party;
  }
  return true;
}

/**
 * The allies an ally spell lands on: the one the client clicked (`targetId`) and, for a spell of
 * `targetCount` N, up to N - 1 more picked at random among the others who may carry it. The
 * client checks the restrictions before it asks (its toasts), so a wrong click here is a forged
 * or stale request: it is denied, never redirected to someone else. Empty for a spell that is
 * not an ally spell.
 */
export function allyTargetsOf(input: AllyAim): readonly Participant[] {
  const { spell, caster, sequence } = input;
  if (!aimsOnlyAtAllies(spell) || spell.targetRestr?.self === true) return [];
  const clicked = input.targetId === null ? undefined : input.roster.find(input.targetId);
  if (!clicked || !mayCarry(spell, caster, clicked)) throw new FightCastDenied("target", sequence);
  const count = Math.max(1, ...spell.effects.map((effect) => effect.targetCount ?? 1));
  const others = input.roster.all().filter((member) => {
    return member.id !== clicked.id && mayCarry(spell, caster, member);
  });
  shuffleInPlace(others, input.random);
  return [clicked, ...others.slice(0, count - 1)];
}
