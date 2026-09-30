import type { CombatSpell } from "./combat-loadout.ts";

/** The effect groups a dispel spell removes: the `targetEffectGroupId` of each of its kind-8 effects. */
export function dispelTargetGroups(spell: CombatSpell): readonly number[] {
  const groups: number[] = [];
  for (const effect of spell.effects) {
    if (effect.kind !== 8) continue;
    if (effect.targetEffectGroupId === undefined) {
      throw new Error("Dispel effect targetEffectGroupId is required");
    }
    groups.push(effect.targetEffectGroupId);
  }
  return groups;
}
