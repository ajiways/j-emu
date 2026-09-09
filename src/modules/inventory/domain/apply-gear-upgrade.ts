import type { ArtifactDefinition } from "../../catalog/domain/artifact-definition.ts";
import type { Catalog } from "../../catalog/ports/catalog.ts";
import type { InventoryItem } from "./inventory-item.ts";
import type { InventoryRepository } from "../ports/inventory-repository.ts";
import { UpgradeDeniedError } from "./upgrade-denied-error.ts";
import {
  canItemBeUpgraded,
  canResonateItem,
  isResonatorAction,
  parseUpgradeAction,
  pickUpgradeSkill,
  rollUpgradeSuccess,
  upgradeChance,
  upgradeSkillPool,
} from "./gear-upgrade.ts";
import {
  isSupportedUpgradeType,
  shouldBindOnSuccess,
  upgradeTypesCompatible,
  UPGRADE_FAIL_ERROR,
  UPGRADE_MAX_LEVEL,
  UPGRADE_RESONATOR_ERROR,
  UPGRADE_TYPE_UNLIMITED,
  UPGRADE_UNSUPPORTED,
} from "./upgrade-tables.ts";

export type ApplyGearUpgradeCommand = Readonly<{
  characterId: number;
  crystalItemId: number;
  targetItemId: number;
  random: Readonly<{ unit(): number }>;
}>;

export type GearUpgradeResult = Readonly<{ ok: true } | { ok: false; error: string }>;

export async function applyGearUpgrade(
  inventory: InventoryRepository,
  catalog: Catalog,
  command: ApplyGearUpgradeCommand,
): Promise<GearUpgradeResult> {
  if (command.crystalItemId === command.targetItemId) {
    throw new UpgradeDeniedError(UPGRADE_UNSUPPORTED);
  }
  const items = await inventory.lockForHero(command.characterId);
  const crystal = requireBagItem(items, command.characterId, command.crystalItemId);
  const target = requireBagItem(items, command.characterId, command.targetItemId);
  const crystalCat = await requireArtifact(catalog, crystal.artifactId);
  const targetCat = await requireArtifact(catalog, target.artifactId);
  const action = parseUpgradeAction(crystalCat.useActions);
  if (!action) throw new UpgradeDeniedError(UPGRADE_UNSUPPORTED);
  if (action.param2 === UPGRADE_TYPE_UNLIMITED) {
    throw new UpgradeDeniedError(UPGRADE_UNSUPPORTED);
  }
  const resonator = isResonatorAction(action);
  if (!resonator && !isSupportedUpgradeType(action.param2)) {
    throw new UpgradeDeniedError(UPGRADE_UNSUPPORTED);
  }
  const rng = () => command.random.unit();
  if (resonator) {
    await applyResonator(inventory, crystal, target, targetCat, rng);
    return { ok: true };
  }
  return applyCrystal(inventory, crystal, target, targetCat, action.param2, rng);
}

async function applyResonator(
  inventory: InventoryRepository,
  crystal: InventoryItem,
  target: InventoryItem,
  targetCat: ArtifactDefinition,
  rng: () => number,
): Promise<void> {
  if (
    !canResonateItem({
      typeId: targetCat.typeId,
      kindId: targetCat.kindId,
      skills: targetCat.skills,
      upgradeId: target.upgrade.id,
      upgradeLevel: target.upgrade.level,
      slotMask: targetCat.slotMask,
    })
  ) {
    throw new UpgradeDeniedError(UPGRADE_RESONATOR_ERROR);
  }
  const skillId = pickUpgradeSkill(upgradeSkillPool(targetCat.skills), rng, target.upgrade.skillId);
  if (!skillId) throw new UpgradeDeniedError(UPGRADE_RESONATOR_ERROR);
  await consumeOne(inventory, crystal);
  await inventory.save(
    target.withUpgrade({
      id: target.upgrade.id,
      level: target.upgrade.level,
      skillId,
      bound: target.upgrade.bound,
    }),
  );
}

async function applyCrystal(
  inventory: InventoryRepository,
  crystal: InventoryItem,
  target: InventoryItem,
  targetCat: ArtifactDefinition,
  crystalType: number,
  rng: () => number,
): Promise<GearUpgradeResult> {
  if (target.upgrade.id && !upgradeTypesCompatible(target.upgrade.id, crystalType)) {
    throw new UpgradeDeniedError(UPGRADE_UNSUPPORTED);
  }
  if (
    !canItemBeUpgraded({
      typeId: targetCat.typeId,
      kindId: targetCat.kindId,
      skills: targetCat.skills,
      upgradeId: target.upgrade.id,
      upgradeLevel: target.upgrade.level,
      slotMask: targetCat.slotMask,
    })
  ) {
    throw new UpgradeDeniedError(UPGRADE_UNSUPPORTED);
  }
  const nextLevel = target.upgrade.level + 1;
  if (nextLevel > UPGRADE_MAX_LEVEL) throw new UpgradeDeniedError(UPGRADE_UNSUPPORTED);
  await consumeOne(inventory, crystal);
  const chance = upgradeChance(crystalType, nextLevel);
  if (!rollUpgradeSuccess(chance, rng)) {
    return { ok: false, error: UPGRADE_FAIL_ERROR };
  }
  const skillId = pickUpgradeSkill(upgradeSkillPool(targetCat.skills), rng);
  if (!skillId) return { ok: false, error: UPGRADE_UNSUPPORTED };
  const overlayType =
    target.upgrade.id && upgradeTypesCompatible(target.upgrade.id, crystalType)
      ? target.upgrade.id
      : crystalType;
  await inventory.save(
    target.withUpgrade({
      id: overlayType,
      level: nextLevel,
      skillId,
      bound: target.upgrade.bound || shouldBindOnSuccess(crystal.artifactId, nextLevel),
    }),
  );
  return { ok: true };
}

function requireBagItem(
  items: readonly InventoryItem[],
  heroId: number,
  itemId: number,
): InventoryItem {
  const matches = items.filter((item) => item.id === itemId);
  if (matches.length > 1) throw new Error(`Multiple items found for ${itemId}`);
  const item = matches[0];
  if (!item || item.heroId !== heroId) throw new UpgradeDeniedError(UPGRADE_UNSUPPORTED);
  if (item.location.kind !== "bag") throw new UpgradeDeniedError(UPGRADE_UNSUPPORTED);
  return item;
}

async function requireArtifact(catalog: Catalog, artifactId: number): Promise<ArtifactDefinition> {
  const definition = await catalog.artifact(artifactId);
  if (!definition) throw new Error(`Artifact catalog entry ${artifactId} is missing`);
  return definition;
}

async function consumeOne(inventory: InventoryRepository, item: InventoryItem): Promise<void> {
  if (item.quantity <= 1) await inventory.delete(item);
  else await inventory.save(item.withQuantity(item.quantity - 1));
}
