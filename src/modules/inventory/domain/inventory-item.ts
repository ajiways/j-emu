import { requireFightSafeItemId, requireWireIdentity } from "../../../shared/kernel/decimal-id.ts";

export type ItemLocation =
  | Readonly<{ kind: "bag" }>
  | Readonly<{ kind: "pocket"; position: number }>
  | Readonly<{ kind: "equipment"; slot: number }>;

export class InventoryItem {
  constructor(
    readonly id: number,
    readonly heroId: number,
    readonly artifactId: number,
    private quantityValue: number,
    readonly location: ItemLocation,
    readonly durability: number,
    readonly durabilityMax: number,
  ) {
    if (!Number.isInteger(id)) throw new Error("Jugger item ids must be integers");
    requireFightSafeItemId(BigInt(id));
    requireWireIdentity(heroId, "hero id");
    if (quantityValue < 1) throw new Error("Item quantity must be positive");
    if (!Number.isInteger(durability) || durability < 0) throw new Error("Durability is invalid");
    if (!Number.isInteger(durabilityMax) || durabilityMax < 0) {
      throw new Error("Durability max is invalid");
    }
    if (durability > durabilityMax) throw new Error("Durability exceeds durability max");
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
    );
  }
}
