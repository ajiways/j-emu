import type { BattleEvent } from "./battle-event.ts";
import type { CombatSpell } from "./combat-loadout.ts";
import { FightCastDenied } from "./fight-cast-denied.ts";
import type { Participant } from "./participant.ts";

/** A spell with a spend range takes whatever mana its caster has, up to `mpCost + manaCost`. */
function manaRange(spell: CombatSpell): Readonly<{ min: number; max: number }> {
  const min = spell.mpCost ?? 0;
  const extra = spell.effects.reduce((sum, effect) => sum + (effect.manaCost ?? 0), 0);
  return { min, max: min + extra };
}

/** Mana the cast would take now; 0 for a spell that costs none. Throws when it is unaffordable. */
export function manaToSpend(spell: CombatSpell, available: number): number {
  const { min, max } = manaRange(spell);
  if (min === 0 && max === 0) return 0;
  if (available < min) throw new Error(`Spell needs ${min} mana, ${available} left`);
  return Math.min(available, max);
}

/** Whether `caster` can pay for `spell` right now. */
function canPayMana(caster: Participant, spell: CombatSpell): boolean {
  return caster.mp >= manaRange(spell).min;
}

/** Refuses a cast the player cannot pay for, before anything is consumed. */
export function requireMana(
  caster: Participant,
  spell: CombatSpell,
  sequence: string | number,
): void {
  if (!canPayMana(caster, spell)) throw new FightCastDenied("mana", sequence);
}

/** Takes the mana of a cast and says so; `null` for a spell that costs none. */
export function payMana(
  caster: Participant,
  spell: CombatSpell,
): Extract<BattleEvent, { type: "mp-change" }> | null {
  const amount = manaToSpend(spell, caster.mp);
  if (amount === 0) return null;
  caster.spendMana(amount);
  return { type: "mp-change", targetId: caster.id, delta: -amount };
}
