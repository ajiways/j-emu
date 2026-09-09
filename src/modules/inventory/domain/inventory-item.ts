import { requireFightSafeItemId, requireWireIdentity } from "../../../shared/kernel/decimal-id.ts";
import { requireItemUpgrade, UNUPGRADED, type ItemUpgrade } from "./item-upgrade.ts";

export type ItemLocation =
  | Readonly<{ kind: "bag" }>
  | Readonly<{ kind: "pocket"; position: number }>
  | Readonly<{ kind: "equipment"; slot: number }>
  | Readonly<{ kind: "tempeffect" }>;

export class InventoryItem {
  readonly upgrade: ItemUpgrade;

  constructor(
    readonly id: number,
    readonly heroId: number,
    readonly artifactId: number,
    private quantityValue: number,
    readonly location: ItemLocation,
    readonly durability: number,
    readonly durabilityMax: number,
    upgrade: ItemUpgrade = UNUPGRADED,
  ) {
    if (!Number.isInteger(id)) throw new Error("Jugger item ids must be integers");
    requireFightSafeItemId(BigInt(id));
    requireWireIdentity(heroId, "hero id");
    if (location.kind === "tempeffect") {
      if (quantityValue !== 0) throw new Error("Tempeffect quantity must be 0");
    } else if (quantityValue < 1) {
      throw new Error("Item quantity must be positive");
    }
    if (!Number.isInteger(durability) || durability < 0) throw new Error("Durability is invalid");
    if (!Number.isInteger(durabilityMax) || durabilityMax < 0) {
      throw new Error("Durability max is invalid");
    }
    if (durability > durabilityMax) throw new Error("Durability exceeds durability max");
    this.upgrade = requireItemUpgrade(upgrade);
  }

  get quantity(): number {
    return this.quantityValue;
  }

  withLocation(location: ItemLocation): InventoryItem {
    return new InventoryItem(
      this.id,
      this.heroId,
      this.artifactId,
      this.quantityValue,
      location,
      this.durability,
      this.durabilityMax,
      this.upgrade,
    );
  }

  withQuantity(quantity: number): InventoryItem {
    return new InventoryItem(
      this.id,
      this.heroId,
      this.artifactId,
      quantity,
      this.location,
      this.durability,
      this.durabilityMax,
      this.upgrade,
    );
  }

  withDurability(current: number, max: number): InventoryItem {
    return new InventoryItem(
      this.id,
      this.heroId,
      this.artifactId,
      this.quantityValue,
      this.location,
      current,
      max,
      this.upgrade,
    );
  }

  withUpgrade(upgrade: ItemUpgrade): InventoryItem {
    return new InventoryItem(
      this.id,
      this.heroId,
      this.artifactId,
      this.quantityValue,
      this.location,
      this.durability,
      this.durabilityMax,
      upgrade,
    );
  }
}
