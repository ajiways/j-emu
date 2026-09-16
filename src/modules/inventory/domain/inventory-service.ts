import type { ArtifactDefinition } from "../../catalog/domain/artifact-definition.ts";
import type { ArtifactSkillBonus } from "../../catalog/domain/artifact-skill-bonus.ts";
import type { Catalog } from "../../catalog/ports/catalog.ts";
import type { ReleaseArtifacts } from "../../catalog/ports/release-artifacts.ts";
import type { InventoryItem, ItemLocation } from "./inventory-item.ts";
import type { InventoryRepository } from "../ports/inventory-repository.ts";
import { applyInventoryMutation } from "./apply-inventory-mutation.ts";
import {
  applyDeathDurability,
  type ApplyDeathDurabilityCommand,
  type DeathDurabilityResult,
} from "./apply-death-durability.ts";
import { bagActionsFor, FLAG_DROP, FLAG_SELL } from "./bag-actions.ts";
import { canFitBag } from "./can-fit-bag.ts";
import { computeBagLoad, type BagLoad } from "./bag-load.ts";
import { DropDeniedError } from "./drop-denied-error.ts";
import { instanceDurability, isBroken } from "./durability.ts";
import { planMergeBagStacks } from "./merge-bag-stacks.ts";
import { isLeftPocket, requirePocketCapacity } from "./pocket-slot.ts";
import { planPutOnPocket, type PocketTarget } from "./put-on-pocket.ts";
import { requireQuantityWithinStack } from "./require-quantity-within-stack.ts";
import { repairItem, type RepairItemCommand, type RepairItemResult } from "./repair-item.ts";
import { sellPriceMinor } from "./sell-price.ts";
import { takeDropQuantity } from "./take-drop-quantity.ts";
import { requireEquippedItem, requireWearablePaperdoll, type WearHero } from "./wear-paperdoll.ts";
import { grantToBag } from "./grant-to-bag.ts";
import { consumeByArtikul, type ConsumeByArtikulCommand } from "./consume-by-artikul.ts";
import { consumeFromBagForHero, countBagByArtifact } from "./consume-from-bag.ts";
import { takeFromBagForMail } from "./take-from-bag-for-mail.ts";
import { takeFromBagForAuction } from "./take-from-bag-for-auction.ts";
import { takeFromBagForTrade } from "./take-from-bag-for-trade.ts";
import { canFitMailSnapshots } from "./can-fit-mail-snapshots.ts";
import { grantMailSnapshots } from "./grant-mail-snapshots.ts";
import type { MailItemSnapshot } from "./mail-item-snapshot.ts";
import {
  occupiedEquipmentSlots,
  pocketPosition,
  requireDropItem,
  requireHeroItem,
} from "./inventory-item-lookup.ts";
import { refillPocketAfterFight, type PocketRefillCell } from "./refill-pocket-after-fight.ts";
import {
  applyGearUpgrade,
  type ApplyGearUpgradeCommand,
  type GearUpgradeResult,
} from "./apply-gear-upgrade.ts";
import { overlaySkillBonuses } from "./gear-upgrade.ts";
import { equippedGearSpells } from "./equipped-gear-spells.ts";
import type { ArtifactSpell } from "../../catalog/domain/artifact-spell.ts";
import { paperdollTrendsAfterWear, syncGearSetBonuses } from "./apply-gear-set-bonuses.ts";
import { setMixBlocked } from "./gear-sets.ts";
import { MixDeniedError } from "./mix-denied-error.ts";
import {
  consumeBagCharge,
  useFromBag,
  type UseFromBagCommand,
  type UseFromBagResult,
} from "./use-from-bag.ts";
import { purgeExpiredDrinks } from "./purge-expired-drinks.ts";
import { ensureGloveInstances } from "./ensure-glove-instances.ts";
import { grantStarterInventory } from "./ensure-starter-inventory.ts";

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

type WearKind = "paperdoll" | "pocket";

export class InventoryService {
  constructor(
    private readonly inventory: InventoryRepository,
    private readonly starterItems: readonly StarterItemSpec[],
    private readonly artifacts: ReleaseArtifacts,
    private readonly catalog: Catalog,
    private readonly bagCapacity: number,
    private readonly pocketCapacity: number,
    private readonly random: Readonly<{ unit(): number }>,
  ) {
    if (starterItems.length === 0) throw new Error("Starter inventory policy is required");
    if (!Number.isInteger(bagCapacity) || bagCapacity < 1) {
      throw new Error("Bag capacity must be a positive integer");
    }
    requirePocketCapacity(pocketCapacity);
    if (typeof random.unit !== "function") throw new Error("Inventory random source is required");
  }

  async list(heroId: number): Promise<readonly InventoryItem[]> {
    return ensureGloveInstances(
      this.inventory,
      this.catalog,
      this.random,
      await this.inventory.listForHero(heroId),
    );
  }

  async listPocket(command: { characterId: number }): Promise<readonly InventoryItem[]> {
    const items = await this.list(command.characterId);
    return items
      .filter((item) => item.location.kind === "pocket")
      .sort((left, right) => pocketPosition(left) - pocketPosition(right));
  }

  async ensureStarterInventory(heroId: number): Promise<void> {
    await grantStarterInventory(
      this.inventory,
      this.catalog,
      this.random,
      this.starterItems,
      heroId,
    );
  }

  async putOn(
    hero: WearHero,
    itemId: number,
    definition: ArtifactDefinition,
    pocketTarget?: PocketTarget,
  ): Promise<WearKind> {
    const items = await this.inventory.lockForHero(hero.id);
    const item = requireHeroItem(items, hero.id, itemId);
    if (pocketTarget !== undefined || isLeftPocket(definition.slotMask)) {
      await applyInventoryMutation(
        this.inventory,
        planPutOnPocket({
          items,
          itemId: item.id,
          definition,
          capacity: this.pocketCapacity,
          target: pocketTarget ?? "auto",
        }),
      );
      return "pocket";
    }
    const occupied = occupiedEquipmentSlots(items, itemId);
    const slot = requireWearablePaperdoll(hero, item, definition, occupied);
    if (setMixBlocked(await paperdollTrendsAfterWear(items, this.catalog, item, slot))) {
      throw new MixDeniedError();
    }
    for (const occupant of items) {
      if (occupant.id === item.id || occupant.location.kind !== "equipment") continue;
      if (occupant.location.slot !== slot && (occupant.location.slot & slot) === 0) continue;
      await this.inventory.save(occupant.withLocation({ kind: "bag" }));
    }
    await this.inventory.save(item.withLocation({ kind: "equipment", slot }));
    await syncGearSetBonuses(this.inventory, this.catalog, hero.id);
    return "paperdoll";
  }

  async putOff(heroId: number, itemId: number): Promise<WearKind> {
    const items = await this.inventory.lockForHero(heroId);
    const item = requireHeroItem(items, heroId, itemId);
    if (item.location.kind === "pocket") {
      const definition = await this.catalog.artifact(item.artifactId);
      if (!definition) throw new Error(`Artifact catalog entry ${item.artifactId} is missing`);
      const toBag = item.withLocation({ kind: "bag" });
      const merged = planMergeBagStacks(
        items.map((row) => (row.id === item.id ? toBag : row)),
        toBag,
        definition.bagStack,
      );
      await applyInventoryMutation(this.inventory, { ...merged, create: [] });
      return "pocket";
    }
    if (item.location.kind === "tempeffect") {
      await this.inventory.delete(item);
      await syncGearSetBonuses(this.inventory, this.catalog, heroId);
      return "paperdoll";
    }
    requireEquippedItem(item, heroId);
    await this.inventory.save(item.withLocation({ kind: "bag" }));
    await syncGearSetBonuses(this.inventory, this.catalog, heroId);
    return "paperdoll";
  }

  async drop(command: DropCommand): Promise<DropSettlement> {
    const intent = command.intent ?? "drop";
    const items = await this.inventory.lockForHero(command.characterId);
    const item = requireDropItem(items, command.characterId, command.itemId, intent);
    if (item.location.kind !== "bag") throw DropDeniedError.forIntent(intent);
    const definition = await this.catalog.artifact(item.artifactId);
    if (!definition) throw new Error(`Artifact catalog entry ${item.artifactId} is missing`);
    requireQuantityWithinStack(definition, item.quantity);
    const actions = bagActionsFor(
      definition.slotMask,
      definition.useAction !== undefined,
      isBroken(instanceDurability(item.durability, item.durabilityMax, definition.flags)),
      false,
    );
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

  useFromBag(
    command: Omit<UseFromBagCommand, "bagCapacity" | "random">,
  ): Promise<UseFromBagResult> {
    return useFromBag(this.inventory, this.catalog, {
      ...command,
      bagCapacity: this.bagCapacity,
      random: this.random,
    });
  }

  consumeBagCharge(command: { characterId: number; itemId: number }): Promise<void> {
    return consumeBagCharge(this.inventory, command.characterId, command.itemId);
  }

  purgeExpiredDrinks(characterId: number, nowSec: number): Promise<boolean> {
    return purgeExpiredDrinks(this.inventory, this.catalog, characterId, nowSec);
  }

  grantToBag(command: {
    characterId: number;
    artifactId: number;
    quantity: number;
  }): Promise<void> {
    return grantToBag(this.inventory, this.catalog, this.bagCapacity, this.random, command);
  }

  canFitBag(command: {
    characterId: number;
    artifactId: number;
    quantity: number;
  }): Promise<boolean> {
    return canFitBag(this.inventory, this.catalog, this.bagCapacity, command);
  }

  async countBagByArtifact(command: { characterId: number; artifactId: number }): Promise<number> {
    const items = await this.inventory.lockForHero(command.characterId);
    return countBagByArtifact(items, command.characterId, command.artifactId);
  }

  consumeFromBag(command: {
    characterId: number;
    artifactId: number;
    quantity: number;
  }): Promise<void> {
    return consumeFromBagForHero(this.inventory, command);
  }

  consumeByArtikul(command: ConsumeByArtikulCommand): Promise<void> {
    return consumeByArtikul(this.inventory, this.catalog, command);
  }

  takeFromBagForMail(command: {
    characterId: number;
    itemId: number;
    quantity: number;
  }): Promise<MailItemSnapshot> {
    return takeFromBagForMail(this.inventory, this.catalog, command);
  }

  takeFromBagForAuction(command: {
    characterId: number;
    itemId: number;
    quantity: number;
  }): Promise<MailItemSnapshot> {
    return takeFromBagForAuction(this.inventory, this.catalog, command);
  }

  takeFromBagForTrade(command: {
    characterId: number;
    itemId: number;
    quantity: number;
  }): Promise<MailItemSnapshot> {
    return takeFromBagForTrade(this.inventory, this.catalog, command);
  }

  canFitMailSnapshots(command: {
    characterId: number;
    snapshots: readonly MailItemSnapshot[];
  }): Promise<boolean> {
    return canFitMailSnapshots(this.inventory, this.catalog, this.bagCapacity, command);
  }

  grantMailSnapshots(command: {
    characterId: number;
    snapshots: readonly MailItemSnapshot[];
  }): Promise<void> {
    return grantMailSnapshots(this.inventory, this.catalog, this.bagCapacity, command);
  }

  refillPocketAfterFight(command: {
    characterId: number;
    cells: readonly PocketRefillCell[];
  }): Promise<void> {
    return refillPocketAfterFight(this.inventory, this.catalog, command);
  }

  applyDeathDurability(command: ApplyDeathDurabilityCommand): Promise<DeathDurabilityResult> {
    return applyDeathDurability(this.inventory, this.catalog, command).then(async (result) => {
      if (result.paperdollChanged) {
        await syncGearSetBonuses(this.inventory, this.catalog, command.characterId);
      }
      return result;
    });
  }

  repair(command: RepairItemCommand): Promise<RepairItemResult> {
    return repairItem(this.inventory, this.catalog, command);
  }

  applyGearUpgrade(command: Omit<ApplyGearUpgradeCommand, "random">): Promise<GearUpgradeResult> {
    return applyGearUpgrade(this.inventory, this.catalog, { ...command, random: this.random });
  }

  async equippedSkillBonuses(characterId: number): Promise<readonly ArtifactSkillBonus[]> {
    const bonuses: ArtifactSkillBonus[] = [];
    for (const item of await this.inventory.listForHero(characterId)) {
      if (item.location.kind !== "equipment" && item.location.kind !== "tempeffect") continue;
      const definition = await this.catalog.artifact(item.artifactId);
      if (!definition) throw new Error(`Artifact catalog entry ${item.artifactId} is missing`);
      bonuses.push(...overlaySkillBonuses(definition.skills, item.upgrade));
    }
    return bonuses;
  }

  async consumePocket(command: { characterId: number; itemId: number }): Promise<void> {
    const items = await this.inventory.lockForHero(command.characterId);
    const item = requireHeroItem(items, command.characterId, command.itemId);
    if (item.location.kind !== "pocket") {
      throw new Error(`Item ${command.itemId} is not in the pocket`);
    }
    if (item.quantity <= 1) await this.inventory.delete(item);
    else await this.inventory.save(item.withQuantity(item.quantity - 1));
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
    const equipped = items.filter(
      (item) => item.location.kind === "equipment" || item.location.kind === "tempeffect",
    );
    const ids = [...new Set(equipped.map((item) => item.artifactId))];
    const definitions = await this.artifacts.definitionsFor(releaseId, ids);
    const byId = new Map(definitions.map((definition) => [definition.id, definition]));
    const bonuses: ArtifactSkillBonus[] = [];
    for (const item of equipped) {
      const definition = byId.get(item.artifactId);
      if (!definition) {
        throw new Error(`Artifact catalog entry ${item.artifactId} is missing`);
      }
      bonuses.push(...overlaySkillBonuses(definition.skills, item.upgrade));
    }
    return bonuses;
  }

  async equippedGearSpells(characterId: number): Promise<readonly ArtifactSpell[]> {
    const items = await this.inventory.listForHero(characterId);
    const definitions = new Map<number, ArtifactDefinition>();
    for (const item of items) {
      if (item.location.kind !== "equipment") continue;
      if (definitions.has(item.artifactId)) continue;
      const definition = await this.catalog.artifact(item.artifactId);
      if (!definition) throw new Error(`Artifact catalog entry ${item.artifactId} is missing`);
      definitions.set(item.artifactId, definition);
    }
    return equippedGearSpells(items, definitions);
  }
}
