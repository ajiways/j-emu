import type { BattleRules } from "./battle-rules.ts";
import type { CombatSpell } from "./combat-loadout.ts";
import type { RandomSource } from "./random-source.ts";

export function rollBotSpellDamage(
  strength: number,
  spell: CombatSpell,
  random: RandomSource,
  rules: BattleRules,
): number {
  if (!Number.isInteger(strength) || strength < 1) {
    throw new Error("Bot spell strength must be a positive integer");
  }
  const kind1 = requireKind1(spell);
  if ((kind1.charging ?? 0) > 0) {
    throw new Error("Charging bot spells are not in the CMB-06 slice");
  }
  const mean = (strength / rules.strPerDamagePoint) * (1 + spellPcStr(kind1) / 100);
  const min = Math.max(1, Math.round(mean * (1 - rules.damageSpread)));
  const max = Math.max(min, Math.round(mean * (1 + rules.damageSpread)));
  return random.integer(min, max);
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
  return requireKind1(spell).dmgType ?? 1;
}

function requireKind1(spell: CombatSpell): CombatSpell["effects"][number] {
  const kind1 = spell.effects.find((effect) => effect.kind === 1);
  if (!kind1) throw new Error("Bot offense spell must include a kind-1 effect");
  return kind1;
}

function spellPcStr(effect: CombatSpell["effects"][number]): number {
  const pc = effect.skills?.find((skill) => skill.skillId === "pcSTR");
  return pc ? pc.value : 0;
}
