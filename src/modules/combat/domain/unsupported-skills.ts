import type { CombatSpell } from "./combat-loadout.ts";
import { skillSupport } from "./skill-registry.ts";

export type UnsupportedSkill = Readonly<{ skillId: string; effectKind: number }>;

/**
 * The skills of a spell's effects that combat does not apply yet (each listed once per effect).
 * A skill with value 0 changes nothing, so it never counts.
 */
export function unsupportedSkillsOf(
  spell: CombatSpell,
  carrier: "human" | "bot",
): readonly UnsupportedSkill[] {
  const found: UnsupportedSkill[] = [];
  for (const effect of spell.effects) {
    for (const entry of effect.skills ?? []) {
      if (entry.value === 0) continue;
      const support = skillSupport(entry.skillId, effect.kind);
      if (support === "deferred" || (support === "humans" && carrier === "bot")) {
        found.push({ skillId: entry.skillId, effectKind: effect.kind });
      }
    }
  }
  return found;
}
