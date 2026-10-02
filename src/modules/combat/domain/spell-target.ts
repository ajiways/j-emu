import type { CombatSpell } from "./combat-loadout.ts";
import { FightCastDenied } from "./fight-cast-denied.ts";
import type { Fighter } from "./fighter.ts";
import type { Participant } from "./participant.ts";
import type { RandomSource } from "./random-source.ts";
import type { Roster } from "./roster.ts";
import { shuffleInPlace } from "./shuffle-in-place.ts";

/**
 * A spell the catalog forbids aiming at the opposing side («Дар неистовства», «Прикрытие»,
 * «Знак жизни») is an ally spell: its carrier is the one of one's own side the player clicks.
 */
export function aimsAtOwnSide(spell: CombatSpell): boolean {
  const restriction = spell.targetRestr;
  return restriction?.oppTeam === false && restriction.opp !== true;
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
  if (!aimsAtOwnSide(spell) || spell.targetRestr?.self === true) return [];
  const clicked = input.targetId === null ? undefined : input.roster.find(input.targetId);
  if (!clicked || !mayCarry(spell, caster, clicked)) throw new FightCastDenied("target", sequence);
  const count = Math.max(1, ...spell.effects.map((effect) => effect.targetCount ?? 1));
  const others = input.roster.all().filter((member) => {
    return member.id !== clicked.id && mayCarry(spell, caster, member);
  });
  shuffleInPlace(others, input.random);
  return [clicked, ...others.slice(0, count - 1)];
}

/**
 * What the carrier already stands under can forbid the spell (the catalog's `artdeny`,
 * `groupdeny`, `selgroupdeny`): a second effect of the same kind or group is refused, anything
 * else stacks as often as it is cast. The client checks the same before it asks; a request that
 * got here is forged or stale, and is denied.
 */
export function requireOpenCarrier(
  spell: CombatSpell,
  artikulId: number,
  carrier: Fighter,
  sequence: string | number,
): void {
  const restriction = spell.targetRestr;
  if (!restriction) return;
  const standing = carrier.effects.snapshot();
  const sameArtikul = standing.some((effect) => effect.artikulId === artikulId);
  const groups = new Set(carrier.effects.standingGroups());
  const sameGroup = spell.groupId !== undefined && groups.has(spell.groupId);
  if (restriction.artdeny === true && sameArtikul) throw new FightCastDenied("target", sequence);
  if (restriction.artdeny === false && !sameArtikul) throw new FightCastDenied("target", sequence);
  if (restriction.groupdeny === true && sameGroup) throw new FightCastDenied("target", sequence);
  if (restriction.groupdeny === false && !sameGroup) throw new FightCastDenied("target", sequence);
  const barred = restriction.selgroupdeny;
  if (typeof barred === "object" && barred !== null && !Array.isArray(barred)) {
    const { cond, id } = barred as { cond?: unknown; id?: unknown };
    if (cond === true && typeof id === "number" && groups.has(id)) {
      throw new FightCastDenied("target", sequence);
    }
  }
}
