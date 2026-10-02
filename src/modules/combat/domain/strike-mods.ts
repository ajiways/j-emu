import { drainFromSkills, NO_DRAIN, type Drain } from "./drain.ts";
import type { CombatSpell } from "./combat-loadout.ts";
import type { SchoolOverlay } from "./school-overlay.ts";
import type { SkillValue } from "./skill-bake.ts";

/**
 * What a charged effect does to the strikes it is spent on (ADR-0021): the skills of a
 * kind-3 charging spell, or the school hit of a kind-1 one. Timed effects have none of this.
 */
export type StrikeMods = Readonly<{
  /** Percent added to the next swing's damage (orbs, rage). */
  pcStr: number;
  /** Flat strength on the next swing. */
  strFlat: number;
  /** `CR`: 1 and above forces a crit, between 0 and 1 is an absolute crit chance (ignores RAG). */
  critChance: number;
  /** A school float on the same target (kind-1 charging). */
  overlay: SchoolOverlay | null;
  /** `VAMP`/`ANTIVAMP` of the charged effect. */
  drain: Drain;
}>;

export const NO_STRIKE_MODS: StrikeMods = {
  pcStr: 0,
  strFlat: 0,
  critChance: 0,
  overlay: null,
  drain: NO_DRAIN,
};

/** The skills of the charging kind-3 effects of a spell. */
export function chargedSkills(spell: CombatSpell): readonly SkillValue[] {
  return spell.effects.flatMap((effect) => (effect.kind === 3 ? (effect.skills ?? []) : []));
}

/** A kind-3 charging effect: what its skills do to the swing. */
export function strikeModsFromSkills(skills: readonly SkillValue[]): StrikeMods {
  const value = (id: string): number => skills.find((skill) => skill.skillId === id)?.value ?? 0;
  return {
    ...NO_STRIKE_MODS,
    pcStr: value("pcSTR"),
    strFlat: value("STR"),
    critChance: Math.max(value("CR"), 0),
    drain: drainFromSkills(value),
  };
}

/** A kind-1 charging effect: only the school hit, its skills feed that hit. */
export function strikeModsOfOverlay(overlay: SchoolOverlay): StrikeMods {
  return { ...NO_STRIKE_MODS, overlay };
}

/** Everything the strike spends, folded for the swing. */
export type SpentStrike = Readonly<{
  /** `pcSTR` of every spent effect, applied to the damage one after another, each rounded. */
  pcStrs: readonly number[];
  strFlat: number;
  critChance: number;
  drain: Drain;
  /** Icons of the effects whose last charge this strike was. */
  purged: readonly number[];
  /** The rage fill (0–100) the «Ярость» button of this swing carried; `null` without the button. */
  furyFill: number | null;
}>;
