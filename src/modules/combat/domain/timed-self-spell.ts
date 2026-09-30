import type { BattleEvent } from "./battle-event.ts";
import type { CombatSpell } from "./combat-loadout.ts";
import type { HumanFighter } from "./human-fighter.ts";
import { pocketHealAmount } from "./human-cast-state.ts";

/** Wire `hpChange.react` of a heal (live 169: the elixir heal, like a HoT tick). */
const HEAL_REACT = 32;

type CombatEffect = CombatSpell["effects"][number];

export type SelfSpellSource = Readonly<{
  artikulId: number;
  title: string;
  picture: string;
  spell: CombatSpell;
  /** Wire `effUse.flags` of the source: pocket and glove spells differ. */
  flags: string | number;
}>;

/** A kind-3 effect that is not spent by strikes: it ages on the fight clock instead. */
function isTimedBuff(effect: CombatEffect): boolean {
  return effect.kind === 3 && !(effect.charging && effect.charging > 0) && !effect.capacity;
}

/**
 * A spell cast on oneself that only buffs and heals: at least one timed kind-3 effect, the rest
 * kind 2. Charged orbs and strike buffs stay on their own paths.
 */
export function isTimedSelfSpell(spell: CombatSpell): boolean {
  return (
    spell.effects.some(isTimedBuff) &&
    spell.effects.every((effect) => isTimedBuff(effect) || effect.kind === 2)
  );
}

/**
 * Applies the effects in their `order` (live 169: the max hp buff first, then the 26% heal of the
 * new maximum). Timed buffs are baked against the caster's stats and stand on the fight clock.
 */
export function castTimedSelfSpell(
  human: HumanFighter,
  source: SelfSpellSource,
  nowMs: number,
): readonly BattleEvent[] {
  const events: BattleEvent[] = [];
  const { spell } = source;
  if (spell.groupId !== undefined) {
    for (const effectId of human.effects.dispelGroups([spell.groupId])) {
      events.push({ type: "effect-purge", effectId });
    }
    human.clampToMaxHp();
  }
  const ordered = [...spell.effects].sort((left, right) => (left.order ?? 0) - (right.order ?? 0));
  // One spell shows one icon, however many kind-3 effects carry its skills.
  const buffs = ordered.filter(isTimedBuff);
  let buffed = false;
  for (const effect of ordered) {
    if (effect.kind === 3 && buffed) continue;
    if (effect.kind === 2) {
      const healed = human.applyHeal(pocketHealAmount({ effects: [effect] }, human.maxHp));
      events.push({
        type: "damage",
        sourceId: human.heroId,
        targetId: human.heroId,
        animation: spell.animData ?? "",
        hpChange: healed,
        targetMaxHp: human.maxHp,
        killed: false,
        react: HEAL_REACT,
      });
      continue;
    }
    buffed = true;
    const standing = human.effects.attachTimedBuff({
      sourceId: human.heroId,
      artikulId: source.artikulId,
      title: source.title,
      img: source.picture,
      dmgType: effect.dmgType ?? 0,
      ...(spell.groupId !== undefined ? { groupId: spell.groupId } : {}),
      skills: buffs.flatMap((buff) => buff.skills ?? []),
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
      persId: human.heroId,
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
