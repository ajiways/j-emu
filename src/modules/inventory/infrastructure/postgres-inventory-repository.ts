import { eq, sql } from "drizzle-orm";
import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import { requireFightSafeItemId } from "../../../shared/kernel/decimal-id.ts";
import { InventoryItem, type ItemLocation } from "../domain/inventory-item.ts";
import type { InventoryRepository, NewInventoryItem } from "../ports/inventory-repository.ts";
import { items } from "./schema.ts";

export class PostgresInventoryRepository implements InventoryRepository {
  constructor(private readonly database: PostgresDatabase) {}

  async listForHero(heroId: string): Promise<readonly InventoryItem[]> {
    const rows = await this.database
      .session()
      .select()
      .from(items)
      .where(eq(items.heroId, heroId))
      .orderBy(items.id);
    return rows.map(
      (row) =>
        new InventoryItem(
          requireFightSafeItemId(row.id),
          row.heroId,
          row.artifactId,
          row.quantity,
          this.location(row),
        ),
    );
  }

  async create(item: NewInventoryItem): Promise<InventoryItem> {
    const pocketPosition = item.location.kind === "pocket" ? item.location.position : null;
    const equipmentSlot = item.location.kind === "equipment" ? item.location.slot : null;
    const rows = await this.database
      .session()
      .insert(items)
      .values({
        heroId: item.heroId,
        artifactId: item.artifactId,
        quantity: item.quantity,
        locationKind: item.location.kind,
        pocketPosition,
        equipmentSlot,
        version: 1,
      })
      .returning();
    const row = rows[0];
    if (rows.length !== 1 || !row) throw new Error("Item insert did not return an id");
    return new InventoryItem(
      requireFightSafeItemId(row.id),
      row.heroId,
      row.artifactId,
      row.quantity,
      this.location(row),
    );
  }

  async save(item: InventoryItem): Promise<void> {
    const pocketPosition = item.location.kind === "pocket" ? item.location.position : null;
    const equipmentSlot = item.location.kind === "equipment" ? item.location.slot : null;
    await this.database
      .session()
      .insert(items)
      .values({
        id: BigInt(item.id),
        heroId: item.heroId,
        artifactId: item.artifactId,
        quantity: item.quantity,
        locationKind: item.location.kind,
        pocketPosition,
        equipmentSlot,
        version: 1,
      })
      .onConflictDoUpdate({
        target: items.id,
        set: {
          quantity: item.quantity,
          locationKind: item.location.kind,
          pocketPosition,
          equipmentSlot,
          version: sql`${items.version} + 1`,
        },
      });
  }

  private location(row: {
    id: bigint;
    locationKind: string;
    pocketPosition: number | null;
    equipmentSlot: number | null;
  }): ItemLocation {
    if (row.locationKind === "bag") {
      if (row.pocketPosition !== null || row.equipmentSlot !== null) {
        throw new Error(`Bag item ${row.id} has slot columns`);
      }
      return { kind: "bag" };
    }
    if (row.locationKind === "pocket") {
      if (row.pocketPosition === null || row.equipmentSlot !== null) {
        throw new Error(`Pocket item ${row.id} has invalid slot columns`);
      }
      return { kind: "pocket", position: row.pocketPosition };
    }
    if (row.locationKind !== "equipment") {
      throw new Error(`Unknown item location ${row.locationKind}`);
    }
    if (row.equipmentSlot === null || row.pocketPosition !== null) {
      throw new Error(`Equipment item ${row.id} has invalid slot columns`);
    }
    return { kind: "equipment", slot: row.equipmentSlot };
  }
}
