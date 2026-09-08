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
  ) {
    if (!Number.isInteger(id)) throw new Error("Jugger item ids must be integers");
    requireFightSafeItemId(BigInt(id));
    requireWireIdentity(heroId, "hero id");
    if (quantityValue < 1) throw new Error("Item quantity must be positive");
  }

  get quantity(): number {
    return this.quantityValue;
  }

  withLocation(location: ItemLocation): InventoryItem {
    return new InventoryItem(this.id, this.heroId, this.artifactId, this.quantityValue, location);
  }
}
