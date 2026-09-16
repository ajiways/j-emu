import { requireFightSafeItemId, requireWireIdentity } from "../../../shared/kernel/decimal-id.ts";
import {
  EMPTY_ITEM_INSTANCE,
  type ItemInstanceData,
  requireItemInstanceData,
} from "./item-instance-data.ts";
import { requireItemUpgrade, UNUPGRADED, type ItemUpgrade } from "./item-upgrade.ts";

export type ItemLocation =
  | Readonly<{ kind: "bag" }>
  | Readonly<{ kind: "pocket"; position: number }>
  | Readonly<{ kind: "equipment"; slot: number }>
  | Readonly<{ kind: "tempeffect" }>;

export class InventoryItem {
  readonly upgrade: ItemUpgrade;
  readonly data: ItemInstanceData;

  constructor(
    readonly id: number,
    readonly heroId: number,
    readonly artifactId: number,
    private quantityValue: number,
    readonly location: ItemLocation,
    readonly durability: number,
    readonly durabilityMax: number,
    upgrade: ItemUpgrade = UNUPGRADED,
    readonly expire: number = 0,
    data: ItemInstanceData = EMPTY_ITEM_INSTANCE,
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
    if (!Number.isInteger(expire) || expire < 0) throw new Error("Item expire is invalid");
    this.upgrade = requireItemUpgrade(upgrade);
    this.data = requireItemInstanceData(data, `item ${id} data`);
  }

  get quantity(): number {
    return this.quantityValue;
  }

  withLocation(location: ItemLocation): InventoryItem {
    return this.clone({ location });
  }

  withQuantity(quantity: number): InventoryItem {
    return this.clone({ quantity });
  }

  withDurability(current: number, max: number): InventoryItem {
    return this.clone({ durability: current, durabilityMax: max });
  }

  withUpgrade(upgrade: ItemUpgrade): InventoryItem {
    return this.clone({ upgrade });
  }

  withExpire(expire: number): InventoryItem {
    return this.clone({ expire });
  }

  withData(data: ItemInstanceData): InventoryItem {
    return this.clone({ data });
  }

  asTempeffect(expire: number): InventoryItem {
    return this.clone({ quantity: 0, location: { kind: "tempeffect" }, expire });
  }

  private clone(patch: {
    quantity?: number;
    location?: ItemLocation;
    durability?: number;
    durabilityMax?: number;
    upgrade?: ItemUpgrade;
    expire?: number;
    data?: ItemInstanceData;
  }): InventoryItem {
    return new InventoryItem(
      this.id,
      this.heroId,
      this.artifactId,
      patch.quantity ?? this.quantityValue,
      patch.location ?? this.location,
      patch.durability ?? this.durability,
      patch.durabilityMax ?? this.durabilityMax,
      patch.upgrade ?? this.upgrade,
      patch.expire ?? this.expire,
      patch.data ?? this.data,
    );
  }
}
