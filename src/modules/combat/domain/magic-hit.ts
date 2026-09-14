import type { BattleRules } from "./battle-rules.ts";
import type { CombatSpell } from "./combat-loadout.ts";
import { magPowerForDmgType, magResistForDmgType, type MagStats } from "./mag-stats.ts";
import { MELEE_REACT } from "./melee-outcome.ts";
import type { RandomSource } from "./random-source.ts";

export type MagicHitInput = Readonly<{
  caster: MagStats;
  target: MagStats;
  casterStrength: number;
  dmgType: number;
  catalogAmount?: number;
  catalogStr?: number;
  catalogPcStr?: number;
  random: RandomSource;
  rules: BattleRules;
}>;

/** Invented MAGSTR/MAGRES hit. Never crits — `legacy behavior` from jgr `magicHit.ts`. */
export function rollMagicHit(input: MagicHitInput): number {
  requireMagicHitRules(input.rules);
  if (!Number.isInteger(input.casterStrength) || input.casterStrength < 1) {
    throw new Error("Magic caster strength must be a positive integer");
  }
  if (!Number.isInteger(input.dmgType) || input.dmgType < 0) {
    throw new Error("Magic dmgType must be a non-negative integer");
  }
  const base = resolveMagicBase(input);
  const mean = base + magPowerForDmgType(input.caster, input.dmgType);
  const min = Math.max(1, Math.round(mean * (1 - input.rules.damageSpread)));
  const max = Math.max(min, Math.round(mean * (1 + input.rules.damageSpread)));
  const rolled = input.random.integer(min, max);
  const leftover =
    1 - mitigationFromMagres(magResistForDmgType(input.target, input.dmgType), input.rules);
  return Math.max(1, Math.round(rolled * leftover));
}

export function magicReact(killed: boolean): number {
  return killed ? MELEE_REACT.kill : MELEE_REACT.hit;
}

export function spellSkillValue(effect: CombatSpell["effects"][number], skillId: string): number {
  return effect.skills?.find((skill) => skill.skillId === skillId)?.value ?? 0;
}

export function kind1Effect(spell: CombatSpell): CombatSpell["effects"][number] | null {
  return spell.effects.find((effect) => effect.kind === 1) ?? null;
}

export function kind1OverlayCharges(spell: CombatSpell): number {
  const kind1 = kind1Effect(spell);
  if (!kind1) return 0;
  if ((kind1.dmgType ?? 1) === 1) return 0;
  const capacity = kind1.capacity ?? 0;
  const charging = kind1.charging ?? 0;
  if (capacity > 0) return capacity;
  if (charging > 0) return charging;
  return 0;
}

export function magicHitFromKind1(
  spell: CombatSpell,
  casterStrength: number,
  caster: MagStats,
  target: MagStats,
  random: RandomSource,
  rules: BattleRules,
): number {
  const kind1 = kind1Effect(spell);
  if (!kind1) throw new Error("Kind-1 effect is required for a magic hit");
  if (kind1OverlayCharges(spell) > 0) {
    throw new Error("Charging kind-1 overlay is not an instant magic hit");
  }
  const catalogAmount = numericAmount(kind1.amount);
  return rollMagicHit({
    caster,
    target,
    casterStrength,
    dmgType: kind1.dmgType ?? 1,
    ...(catalogAmount !== undefined ? { catalogAmount } : {}),
    catalogStr: spellSkillValue(kind1, "STR"),
    catalogPcStr: spellSkillValue(kind1, "pcSTR"),
    random,
    rules,
  });
}

function requireMagicHitRules(rules: BattleRules): void {
  if (rules.strPerDamagePoint < 1) throw new Error("strPerDamagePoint must be positive");
  if (
    typeof rules.damageSpread !== "number" ||
    Number.isNaN(rules.damageSpread) ||
    rules.damageSpread <= 0 ||
    rules.damageSpread >= 1
  ) {
    throw new Error("damageSpread must be in (0, 1)");
  }
  if (!(rules.magresSoftC > 0) || Number.isNaN(rules.magresSoftC)) {
    throw new Error("magresSoftC must be positive");
  }
}

function resolveMagicBase(input: MagicHitInput): number {
  const amount = input.catalogAmount;
  if (amount !== undefined && amount > 0) return amount;
  const catalogStr = input.catalogStr ?? 0;
  const pc = input.catalogPcStr ?? 0;
  if (catalogStr > 0 && pc === 0) return catalogStr;
  let str = input.casterStrength;
  if (catalogStr > 0) str += catalogStr;
  if (!(str > 0)) return 1;
  const melee = str / input.rules.strPerDamagePoint;
  return pc !== 0 ? melee * (1 + pc / 100) : melee;
}

function mitigationFromMagres(resist: number, rules: BattleRules): number {
  return resist / (resist + rules.magresSoftC);
}

function numericAmount(amount: number | string | undefined): number | undefined {
  if (typeof amount !== "number") return undefined;
  return amount;
}
