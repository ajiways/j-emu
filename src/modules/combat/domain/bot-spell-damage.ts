import type { BattleRules } from "./battle-rules.ts";
import type { CombatSpell } from "./combat-loadout.ts";
import type { MagStats } from "./mag-stats.ts";
import { kind1Effect, kind1OverlayCharges, magicHitFromKind1 } from "./magic-hit.ts";
import type { RandomSource } from "./random-source.ts";

export function rollBotSpellDamage(
  strength: number,
  spell: CombatSpell,
  random: RandomSource,
  rules: BattleRules,
  caster: MagStats,
  target: MagStats,
): number {
  if (!Number.isInteger(strength) || strength < 1) {
    throw new Error("Bot spell strength must be a positive integer");
  }
  if (kind1OverlayCharges(spell) > 0) {
    throw new Error("Charging bot spells apply a school overlay, not an instant hit");
  }
  return magicHitFromKind1(spell, strength, caster, target, random, rules);
}

export function botSpellAnimation(spell: CombatSpell, artikulId: number): string {
  if (!spell.animData) {
    throw new Error(`Bot spell ${artikulId} animData is required`);
  }
  return spell.animData;
}

export function botSpellEndsTurn(spell: CombatSpell): boolean {
  return spell.endTurn !== false;
}

export function botSpellKind1DmgType(spell: CombatSpell): number {
  return kind1Effect(spell)?.dmgType ?? 1;
}
