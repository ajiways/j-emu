import type { ArtifactDefinition } from "../../catalog/domain/artifact-definition.ts";
import type { ArtifactSkillBonus } from "../../catalog/domain/artifact-skill-bonus.ts";
import type { Catalog } from "../../catalog/ports/catalog.ts";
import type { ReleaseArtifacts } from "../../catalog/ports/release-artifacts.ts";
import type { InventoryItem, ItemLocation } from "./inventory-item.ts";
import type { InventoryRepository } from "../ports/inventory-repository.ts";
import { bagActionsFor, FLAG_DROP, FLAG_SELL } from "./bag-actions.ts";
import { computeBagLoad, type BagLoad } from "./bag-load.ts";
import { DropDeniedError } from "./drop-denied-error.ts";
import { requireQuantityWithinStack } from "./require-quantity-within-stack.ts";
import { sellPriceMinor } from "./sell-price.ts";
import { takeDropQuantity } from "./take-drop-quantity.ts";
import { requireEquippedItem, requireWearablePaperdoll, type WearHero } from "./wear-paperdoll.ts";

export type StarterItemSpec = Readonly<{
  artifactId: number;
  quantity: number;
  location: ItemLocation;
}>;

export type DropCommand = Readonly<{
  characterId: number;
  itemId: number;
  amount?: number;
  intent?: "drop" | "sell";
}>;

export type DropSettlement = Readonly<{
  take: number;
  creditMinor: number;
}>;

export class InventoryService {
  constructor(
    private readonly inventory: InventoryRepository,
    private readonly starterItems: readonly StarterItemSpec[],
    private readonly artifacts: ReleaseArtifacts,
    private readonly catalog: Catalog,
    private readonly bagCapacity: number,
  ) {
    if (starterItems.length === 0) throw new Error("Starter inventory policy is required");
    if (!Number.isInteger(bagCapacity) || bagCapacity < 1) {
      throw new Error("Bag capacity must be a positive integer");
    }
  }

  list(heroId: number): Promise<readonly InventoryItem[]> {
    return this.inventory.listForHero(heroId);
  }

  async ensureStarterInventory(heroId: number): Promise<void> {
    if ((await this.inventory.listForHero(heroId)).length > 0) return;
    for (const spec of this.starterItems) {
      await this.inventory.create({
        heroId,
        artifactId: spec.artifactId,
        quantity: spec.quantity,
        location: spec.location,
      });
    }
  }

  async putOn(hero: WearHero, itemId: number, definition: ArtifactDefinition): Promise<void> {
    const items = await this.inventory.lockForHero(hero.id);
    const item = requireHeroItem(items, hero.id, itemId);
    const occupied = occupiedEquipmentSlots(items, itemId);
    const slot = requireWearablePaperdoll(hero, item, definition, occupied);
    for (const occupant of items) {
      if (occupant.id === item.id || occupant.location.kind !== "equipment") continue;
      if (occupant.location.slot !== slot && (occupant.location.slot & slot) === 0) continue;
      await this.inventory.save(occupant.withLocation({ kind: "bag" }));
    }
    await this.inventory.save(item.withLocation({ kind: "equipment", slot }));
  }

  async putOff(heroId: number, itemId: number): Promise<void> {
    const items = await this.inventory.lockForHero(heroId);
    const item = requireHeroItem(items, heroId, itemId);
    requireEquippedItem(item, heroId);
    await this.inventory.save(item.withLocation({ kind: "bag" }));
  }

  async drop(command: DropCommand): Promise<DropSettlement> {
    const intent = command.intent ?? "drop";
    const items = await this.inventory.lockForHero(command.characterId);
    const item = requireDropItem(items, command.characterId, command.itemId, intent);
    if (item.location.kind !== "bag") throw DropDeniedError.forIntent(intent);
    const definition = await this.catalog.artifact(item.artifactId);
    if (!definition) throw new Error(`Artifact catalog entry ${item.artifactId} is missing`);
    requireQuantityWithinStack(definition, item.quantity);
    const actions = bagActionsFor(definition.slotMask);
    const unit = sellPriceMinor(definition.priceMinor);
    const voidSell = (actions & FLAG_SELL) !== 0 && unit > 0;
    if (intent === "sell") {
      if (!voidSell) throw DropDeniedError.forIntent(intent);
    } else if (!voidSell && (actions & FLAG_DROP) === 0) {
      throw DropDeniedError.forIntent(intent);
    }
    const take = takeDropQuantity(item.quantity, command.amount);
    const remaining = item.quantity - take;
    if (remaining < 1) await this.inventory.delete(item);
    else await this.inventory.save(item.withQuantity(remaining));
    return { take, creditMinor: voidSell ? unit * take : 0 };
  }

  async bagLoad(command: { characterId: number }): Promise<BagLoad> {
    const items = await this.inventory.listForHero(command.characterId);
    const ids = [...new Set(items.map((item) => item.artifactId))];
    const definitions = new Map<number, ArtifactDefinition>();
    for (const id of ids) {
      const definition = await this.catalog.artifact(id);
      if (!definition) throw new Error(`Artifact catalog entry ${id} is missing`);
      definitions.set(id, definition);
    }
    return computeBagLoad(items, definitions, this.bagCapacity);
  }

  async modifiersForHero(
    characterId: number,
    releaseId: string,
  ): Promise<readonly ArtifactSkillBonus[]> {
    const items = await this.inventory.lockForHero(characterId);
    const equipped = items.filter((item) => item.location.kind === "equipment");
    const ids = [...new Set(equipped.map((item) => item.artifactId))];
    const definitions = await this.artifacts.definitionsFor(releaseId, ids);
    const byId = new Map(definitions.map((definition) => [definition.id, definition]));
    const bonuses: ArtifactSkillBonus[] = [];
    for (const item of equipped) {
      const definition = byId.get(item.artifactId);
      if (!definition) {
        throw new Error(`Artifact catalog entry ${item.artifactId} is missing`);
      }
      bonuses.push(...definition.skills);
    }
    return bonuses;
  }
}

function requireHeroItem(
  items: readonly InventoryItem[],
  heroId: number,
  itemId: number,
): InventoryItem {
  const matches = items.filter((item) => item.id === itemId);
  if (matches.length > 1) throw new Error(`Multiple items found for ${itemId}`);
  const item = matches[0];
  if (!item) throw new Error(`Item ${itemId} for hero ${heroId} is missing`);
  return item;
}

function requireDropItem(
  items: readonly InventoryItem[],
  heroId: number,
  itemId: number,
  intent: "drop" | "sell",
): InventoryItem {
  const matches = items.filter((item) => item.id === itemId);
  if (matches.length > 1) throw new Error(`Multiple items found for ${itemId}`);
  const item = matches[0];
  if (!item || item.heroId !== heroId) throw DropDeniedError.forIntent(intent);
  return item;
}

function occupiedEquipmentSlots(
  items: readonly InventoryItem[],
  exceptItemId: number,
): Set<number> {
  const occupied = new Set<number>();
  for (const item of items) {
    if (item.id === exceptItemId || item.location.kind !== "equipment") continue;
    occupied.add(item.location.slot);
  }
  return occupied;
}
