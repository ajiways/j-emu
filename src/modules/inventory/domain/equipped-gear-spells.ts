import type { ArtifactDefinition } from "../../catalog/domain/artifact-definition.ts";
import type { ArtifactSpell } from "../../catalog/domain/artifact-spell.ts";
import type { InventoryItem } from "./inventory-item.ts";

export function equippedGearSpells(
  items: readonly InventoryItem[],
  definitions: ReadonlyMap<number, ArtifactDefinition>,
): readonly ArtifactSpell[] {
  const spells: ArtifactSpell[] = [];
  for (const item of items) {
    if (item.location.kind !== "equipment") continue;
    const definition = definitions.get(item.artifactId);
    if (!definition) {
      throw new Error(`Artifact catalog entry ${item.artifactId} is missing`);
    }
    const spell = definition.extra.spell;
    if (!spell || spell.effects.length < 1) continue;
    spells.push(spell);
  }
  return spells;
}
