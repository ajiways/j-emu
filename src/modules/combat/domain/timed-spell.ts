import type { BattleEvent } from "./battle-event.ts";
import type { CombatSpell } from "./combat-loadout.ts";
import type { Fighter } from "./fighter.ts";
import { pocketHealAmount } from "./human-cast-state.ts";

/** Wire `hpChange.react` of a heal (live 169: the elixir heal, like a HoT tick). */
const HEAL_REACT = 32;

type CombatEffect = CombatSpell["effects"][number];

export type TimedSpellSource = Readonly<{
  artikulId: number;
  title: string;
  picture: string;
  spell: CombatSpell;
  /** Wire `effUse.flags` of the source: pocket and glove spells differ. */
  flags: string | number;
}>;

/** A kind-3 effect that is not spent by strikes: it ages on the fight clock instead. */
export function isTimedBuff(effect: CombatEffect): boolean {
  return effect.kind === 3 && !(effect.charging && effect.charging > 0) && !effect.capacity;
}

/**
 * A spell that only buffs (or debuffs) and heals: at least one timed kind-3 effect, the rest
 * kind 2. Charged orbs and strike buffs stay on their own paths.
 */
export function isTimedSpell(spell: CombatSpell): boolean {
  return (
    spell.effects.some(isTimedBuff) &&
    spell.effects.every((effect) => isTimedBuff(effect) || effect.kind === 2)
  );
}

/**
 * Applies the effects in their `order` (live 169: the max hp buff first, then the 26% heal of the
 * new maximum). Timed buffs are baked against the caster's stats and stand on the fight clock.
 */
export function castTimedSpell(
  caster: Fighter,
  target: Fighter,
  source: TimedSpellSource,
  nowMs: number,
): readonly BattleEvent[] {
  const events: BattleEvent[] = [];
  const { spell } = source;
  if (spell.groupId !== undefined) {
    for (const effectId of target.effects.dispelGroups([spell.groupId])) {
      events.push({ type: "effect-purge", effectId });
    }
    target.clampToMaxHp();
  }
  const ordered = [...spell.effects].sort((left, right) => (left.order ?? 0) - (right.order ?? 0));
  // One spell shows one icon, however many kind-3 effects carry its skills.
  const buffs = ordered.filter(isTimedBuff);
  let buffed = false;
  const mask = intakeMask(buffs);
  for (const effect of ordered) {
    if (effect.kind === 3 && buffed) continue;
    if (effect.kind === 2) {
      const healTarget = effect.forceSelfTargeting ? caster : target;
      const healed = healTarget.applyHeal(
        pocketHealAmount({ effects: [effect] }, healTarget.maxHp),
      );
      events.push({
        type: "damage",
        sourceId: caster.id,
        targetId: healTarget.id,
        animation: spell.animData ?? "",
        hpChange: healed,
        targetMaxHp: healTarget.maxHp,
        killed: false,
        react: HEAL_REACT,
      });
      continue;
    }
    buffed = true;
    const standing = target.effects.attachTimedBuff({
      sourceId: caster.id,
      artikulId: source.artikulId,
      title: source.title,
      img: source.picture,
      dmgType: effect.dmgType ?? 0,
      ...(spell.groupId !== undefined ? { groupId: spell.groupId } : {}),
      skills: buffs.flatMap((buff) => buff.skills ?? []),
      ...(mask !== undefined ? { dmgMask: mask } : {}),
      durationSeconds: effect.duration ?? null,
      nowMs,
      castEndsTurn: false,
    });
    if (effect.hidden === 1) continue;
    events.push({
      type: "effect-use",
      artikulId: source.artikulId,
      animation: spell.animData ?? "",
      kind: 3,
      flags: source.flags,
      img: standing.img,
      title: standing.title,
      persId: target.id,
      dmgType: standing.dmgType,
      id: standing.id,
      sourceId: standing.sourceId,
      ...(standing.remainTime !== undefined ? { remainTime: standing.remainTime } : {}),
      ...(standing.groupId !== undefined ? { groupId: standing.groupId } : {}),
      skills: standing.skills,
    });
  }
  return events;
}

const INTAKE_SKILLS: ReadonlySet<string> = new Set([
  "DFR",
  "MAG_DFR",
  "ADFR",
  "DMG_AMP",
  "pcDMG_AMP",
]);

/** The damage-type mask of the first merged effect that carries an intake skill. */
function intakeMask(buffs: readonly CombatEffect[]): number | undefined {
  return buffs.find((buff) => buff.skills?.some((skill) => INTAKE_SKILLS.has(skill.skillId)))
    ?.dmgMask;
}
