import { applyStunSpell } from "./apply-stun.ts";
import type { BattleEvent } from "./battle-event.ts";
import { castChargingBuff } from "./charging-buff-cast.ts";
import type { CombatSpell } from "./combat-loadout.ts";
import { dispelTargetGroups } from "./dispel-target-groups.ts";
import type { Fighter } from "./fighter.ts";
import type { Participant } from "./participant.ts";
import { attachSpellTicks } from "./fight-effect-ticks.ts";
import { pocketHealAmount, spellCharging, spellKind } from "./cast-state.ts";
import { kind1OverlayCharges } from "./magic-hit.ts";
import { pocketEffectUse } from "./pocket-effect-use.ts";
import { manaToSpend, payMana } from "./spell-mana.ts";
import { aimsOnlyAtAllies } from "./spell-target.ts";
import { schoolOverlayFromKind1 } from "./school-overlay.ts";
import { chargedSkills, strikeModsFromSkills, strikeModsOfOverlay } from "./strike-mods.ts";
import { castTimedSpell, isTimedSpell, type TimedSpellSource } from "./timed-spell.ts";

/** What casts: a fighter with the strength its spells are baked from. */
type SpellCaster = Participant & Fighter & Readonly<{ strength: number }>;

/**
 * How a spell shows on the wire where the catalog is silent (`null` — the spell must carry it).
 * The kinds of a spell are the same for every caster; only what the client is told differs by
 * where the spell came from.
 */
export type SpellPresentation = Readonly<{
  /** Animation of a heal without `animData`. */
  healAnimation: string | null;
  /** Animation of the `effUse` of a charged buff without `animData`. */
  effectAnimation: string | null;
  /** Animation of the trailing `cast` of a buff or stun without `animData`. */
  castAnimation: string | null;
  /** A heal is announced with its own `effUse` before the hpChange (a pocket elixir). */
  announceHeal: boolean;
  /** A timed buff is followed by the caster's own `cast` (a bot's spell is; a pocket item is not). */
  timedTrailingCast: boolean;
  /** The spell is always used on oneself (a pocket item), whatever its target restriction says. */
  selfOnly: boolean;
}>;

export type SpellCast = Readonly<{
  caster: SpellCaster;
  /** The foe the spell is aimed at, looked up only by a spell that needs one. */
  foe: () => Fighter;
  /** The allies an ally spell lands on; a bot's own spell lands on the bot, a pocket item on its user. */
  allies: readonly Fighter[];
  source: TimedSpellSource;
  nowMs: number;
  presentation: SpellPresentation;
  /** Whether the cast ends the caster's turn, for the tick effects it leaves. */
  endsTurn: boolean;
}>;

function castsOnSelf(spell: CombatSpell): boolean {
  return spell.targetRestr?.self === true || spell.effects.some((e) => e.forceSelfTargeting);
}

/**
 * The effects of a spell that are not an instant hit: buffs and debuffs (timed and charged),
 * heals, dispels, stuns, ticking poisons. One path for a player's pocket and glove and a bot's
 * card alike. Returns `null` for a spell whose effect is an instant kind-1 hit — the caller
 * picks the targets and settles the damage.
 */
export function castSpell(cast: SpellCast): readonly BattleEvent[] | null {
  const { spell } = cast.source;
  manaToSpend(spell, cast.caster.mp);
  const events = castEffects(cast);
  if (events === null) return null;
  const mana = payMana(cast.caster, spell);
  return mana ? [mana, ...events] : events;
}

function castEffects(cast: SpellCast): readonly BattleEvent[] | null {
  const { spell } = cast.source;
  if (kind1OverlayCharges(spell) > 0) return castOverlay(cast);
  if (spellKind(spell, 1)) return null;
  if (isTimedSpell(spell)) return castTimed(cast);
  if (spellKind(spell, 2)) return castHeal(cast);
  if (spellKind(spell, 10)) return [];
  if (spellKind(spell, 8)) return castDispel(cast);
  if (spellKind(spell, 18)) return castStun(cast);
  if (spellKind(spell, 4) || spellKind(spell, 5)) return castTicks(cast);
  if (spellKind(spell, 3)) return castCharged(cast);
  if (spellKind(spell, 11)) return [];
  throw new Error(`Spell ${cast.source.artikulId} has no supported fight effect`);
}

function carriersOf(cast: SpellCast): readonly Fighter[] {
  if (cast.presentation.selfOnly || castsOnSelf(cast.source.spell)) return [cast.caster];
  if (!aimsOnlyAtAllies(cast.source.spell)) return [cast.foe()];
  if (cast.allies.length === 0) {
    throw new Error(`Spell ${cast.source.artikulId} needs an ally to land on`);
  }
  return cast.allies;
}

function animationOf(cast: SpellCast, fallback: string | null): string {
  const animation = cast.source.spell.animData ?? fallback;
  if (animation === null) {
    throw new Error(`Spell ${cast.source.artikulId} animData is required`);
  }
  return animation;
}

function castTimed(cast: SpellCast): readonly BattleEvent[] {
  return carriersOf(cast).flatMap((carrier) => {
    const events = castTimedSpell(cast.caster, carrier, cast.source, cast.nowMs);
    if (!cast.presentation.timedTrailingCast) return events;
    return [
      ...events,
      {
        type: "buff-cast" as const,
        animation: animationOf(cast, cast.presentation.castAnimation),
        sourceId: cast.caster.id,
        targetId: carrier.id,
        maxHp: carrier.maxHp,
      },
    ];
  });
}

function castHeal(cast: SpellCast): readonly BattleEvent[] {
  const { caster, source, presentation } = cast;
  const healed = caster.applyHeal(pocketHealAmount(source.spell, caster.maxHp));
  const animation = animationOf(cast, presentation.healAnimation);
  return [
    ...(presentation.announceHeal
      ? [
          pocketEffectUse(
            {
              artifactId: source.artikulId,
              title: source.title,
              picture: source.picture,
              spell: source.spell,
            },
            caster.id,
            2,
          ),
        ]
      : []),
    {
      type: "damage",
      sourceId: caster.id,
      targetId: caster.id,
      animation,
      hpChange: healed,
      targetMaxHp: caster.maxHp,
      killed: false,
    },
  ];
}

function castDispel(cast: SpellCast): readonly BattleEvent[] {
  return cast
    .foe()
    .effects.dispelGroups(dispelTargetGroups(cast.source.spell))
    .map((effectId) => ({ type: "effect-purge" as const, effectId }));
}

function castStun(cast: SpellCast): readonly BattleEvent[] {
  const { caster, source } = cast;
  const foe = cast.foe();
  return [
    ...applyStunSpell(caster, foe, source, cast.nowMs),
    {
      type: "buff-cast",
      animation: animationOf(cast, cast.presentation.castAnimation),
      sourceId: caster.id,
      targetId: foe.id,
      maxHp: foe.maxHp,
    },
  ];
}

function castTicks(cast: SpellCast): readonly BattleEvent[] {
  const { caster, source } = cast;
  const foe = cast.foe();
  return [
    ...attachSpellTicks(foe, caster, source, cast.nowMs, cast.endsTurn),
    {
      type: "buff-cast",
      animation: animationOf(cast, null),
      sourceId: caster.id,
      targetId: foe.id,
      maxHp: foe.maxHp,
    },
  ];
}

function castOverlay(cast: SpellCast): readonly BattleEvent[] {
  const { caster, source } = cast;
  const overlay = schoolOverlayFromKind1(source.spell, caster.strength);
  if (!overlay) throw new Error(`Spell ${source.artikulId} overlay charges are required`);
  const animation = animationOf(cast, cast.presentation.castAnimation);
  return castChargingBuff(caster, {
    artikulId: source.artikulId,
    title: source.title,
    img: source.picture,
    dmgType: overlay.dmgType,
    remainTurns: overlay.charges,
    strike: strikeModsOfOverlay(overlay),
    ...(source.spell.groupId !== undefined ? { groupId: source.spell.groupId } : {}),
    animation,
    flags: source.flags,
    castAnimation: animation,
  });
}

/** A charged kind-3 spell (an orb, a rage, a glove buff): spent by the caster's next swings. */
function castCharged(cast: SpellCast): readonly BattleEvent[] {
  const { caster, source } = cast;
  const { spell } = source;
  const purges: BattleEvent[] = [];
  if (spell.groupId !== undefined) {
    for (const effectId of caster.effects.dispelGroups([spell.groupId])) {
      purges.push({ type: "effect-purge", effectId });
    }
  }
  return castChargingBuff(caster, {
    artikulId: source.artikulId,
    title: source.title,
    img: source.picture,
    dmgType: spell.effects.find((effect) => effect.kind === 3)?.dmgType ?? 1,
    remainTurns: spellCharging(spell) || 1,
    strike: strikeModsFromSkills(chargedSkills(spell)),
    ...(spell.groupId !== undefined ? { groupId: spell.groupId } : {}),
    animation: animationOf(cast, cast.presentation.effectAnimation),
    flags: source.flags,
    castAnimation: animationOf(cast, cast.presentation.castAnimation),
    before: purges,
  });
}
