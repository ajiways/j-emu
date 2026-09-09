import type { ArtifactDefinition } from "../../catalog/domain/artifact-definition.ts";
import type { ArtifactSkillBonus } from "../../catalog/domain/artifact-skill-bonus.ts";
import type { InventoryItem } from "../../inventory/domain/inventory-item.ts";
import {
  overlayNamedAdds,
  overlayPrimaryBonus,
  overlaySkillBonuses,
} from "../../inventory/domain/gear-upgrade.ts";
import { ARTIFACT_FLAG_NOGIVE } from "../../inventory/domain/upgrade-tables.ts";

export type ArtifactInstanceOverlay = Readonly<{
  upgrade_id: number;
  upgrade_level: number;
  upgrade_add: number;
  flags: number;
  skills: readonly ArtifactSkillBonus[];
  upgradeBySkill: ReadonlyMap<string, Readonly<{ upgradeId: number; upgradeValue: number }>>;
}>;

export function artifactInstanceOverlay(
  definition: ArtifactDefinition,
  item: InventoryItem,
): ArtifactInstanceOverlay {
  const skills = overlaySkillBonuses(definition.skills, item.upgrade);
  const upgradeBySkill = new Map<string, { upgradeId: number; upgradeValue: number }>();
  if (item.upgrade.level >= 1) {
    upgradeBySkill.set(item.upgrade.skillId, {
      upgradeId: item.upgrade.id,
      upgradeValue: overlayPrimaryBonus(definition.skills, item.upgrade),
    });
    for (const extra of overlayNamedAdds(item.upgrade)) {
      upgradeBySkill.set(extra.skillId, { upgradeId: item.upgrade.id, upgradeValue: extra.value });
    }
  }
  return {
    upgrade_id: item.upgrade.id,
    upgrade_level: item.upgrade.level,
    upgrade_add: overlayPrimaryBonus(definition.skills, item.upgrade),
    flags: item.upgrade.bound ? definition.flags | ARTIFACT_FLAG_NOGIVE : definition.flags,
    skills,
    upgradeBySkill,
  };
}
