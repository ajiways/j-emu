import type { ArtifactSkillBonus } from "../../catalog/domain/artifact-skill-bonus.ts";
import type { Catalog } from "../../catalog/ports/catalog.ts";
import { overlaySkillBonuses } from "../../inventory/domain/gear-upgrade.ts";
import type { InventoryService } from "../../inventory/domain/inventory-service.ts";

export async function equippedSkillBonuses(
  inventory: InventoryService,
  catalog: Catalog,
  heroId: number,
): Promise<readonly ArtifactSkillBonus[]> {
  const bonuses: ArtifactSkillBonus[] = [];
  for (const item of await inventory.list(heroId)) {
    if (item.location.kind !== "equipment") continue;
    const definition = await catalog.artifact(item.artifactId);
    if (!definition) throw new Error(`Artifact catalog entry ${item.artifactId} is missing`);
    bonuses.push(...overlaySkillBonuses(definition.skills, item.upgrade));
  }
  return bonuses;
}
