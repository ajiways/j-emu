import { and, eq, inArray, sql } from "drizzle-orm";
import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import { requireWireIdentity } from "../../../shared/kernel/decimal-id.ts";
import type { TradeItemSnapshot } from "../domain/trade-session.ts";
import type { HeldItemRecord, HeldItemsRepository } from "../ports/held-items-repository.ts";
import { heldItems } from "./schema.ts";

export class PostgresHeldItemsRepository implements HeldItemsRepository {
  constructor(private readonly database: PostgresDatabase) {}

  async upsertAdd(heroId: number, snapshot: TradeItemSnapshot): Promise<void> {
    requireWireIdentity(heroId, "hero id");
    requireWireIdentity(snapshot.originalItemId, "original item id");
    requireWireIdentity(snapshot.artifactId, "artifact id");
    if (!Number.isInteger(snapshot.quantity) || snapshot.quantity < 1) {
      throw new Error("Trade held quantity must be positive");
    }
    await this.database
      .session()
      .insert(heldItems)
      .values(toInsert(heroId, snapshot))
      .onConflictDoUpdate({
        target: [heldItems.heroId, heldItems.originalItemId],
        set: { quantity: sql`${heldItems.quantity} + ${snapshot.quantity}` },
      });
  }

  async lock(heroId: number, originalItemId: number): Promise<HeldItemRecord> {
    requireWireIdentity(heroId, "hero id");
    requireWireIdentity(originalItemId, "original item id");
    const rows = await this.database
      .session()
      .select()
      .from(heldItems)
      .where(and(eq(heldItems.heroId, heroId), eq(heldItems.originalItemId, originalItemId)))
      .for("update");
    if (rows.length > 1) {
      throw new Error(`Multiple trade held items for hero ${heroId} original ${originalItemId}`);
    }
    const row = rows[0];
    if (!row) {
      throw new Error(`Trade held item for hero ${heroId} original ${originalItemId} is missing`);
    }
    return toRecord(row);
  }

  async decrease(heroId: number, originalItemId: number, quantity: number): Promise<void> {
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new Error("Trade held decrease quantity must be positive");
    }
    const row = await this.lock(heroId, originalItemId);
    if (row.quantity < quantity) {
      throw new Error(
        `Trade held item for hero ${heroId} original ${originalItemId} has quantity ${row.quantity}, need ${quantity}`,
      );
    }
    if (row.quantity === quantity) {
      await this.deleteById(row.id);
      return;
    }
    const updated = await this.database
      .session()
      .update(heldItems)
      .set({ quantity: row.quantity - quantity })
      .where(eq(heldItems.id, row.id))
      .returning({ id: heldItems.id });
    if (updated.length !== 1) {
      throw new Error(`Trade held item ${row.id} quantity update missed the row`);
    }
  }

  async deleteForHeroes(heroIds: readonly number[]): Promise<void> {
    if (heroIds.length < 1) return;
    const ids = [...new Set(heroIds.map((id) => requireWireIdentity(id, "hero id")))];
    await this.database.session().delete(heldItems).where(inArray(heldItems.heroId, ids));
  }

  async listAll(): Promise<readonly HeldItemRecord[]> {
    const rows = await this.database.session().select().from(heldItems).orderBy(heldItems.id);
    return rows.map(toRecord);
  }

  async deleteById(id: number): Promise<void> {
    requireWireIdentity(id, "held item id");
    const deleted = await this.database
      .session()
      .delete(heldItems)
      .where(eq(heldItems.id, id))
      .returning({ id: heldItems.id });
    if (deleted.length !== 1) throw new Error(`Trade held item ${id} delete missed the row`);
  }
}

function toInsert(heroId: number, snapshot: TradeItemSnapshot) {
  return {
    heroId,
    originalItemId: snapshot.originalItemId,
    artifactId: snapshot.artifactId,
    quantity: snapshot.quantity,
    durability: snapshot.durability,
    durabilityMax: snapshot.durabilityMax,
    upgradeId: snapshot.upgrade.id,
    upgradeLevel: snapshot.upgrade.level,
    upgradeSkillId: snapshot.upgrade.skillId,
    upgradeBound: snapshot.upgrade.bound ? 1 : 0,
  };
}

function toRecord(row: typeof heldItems.$inferSelect): HeldItemRecord {
  const upgradeBound = row.upgradeBound;
  if (upgradeBound !== 0 && upgradeBound !== 1) {
    throw new Error(`Trade held item ${row.id} upgrade_bound is invalid`);
  }
  return {
    id: requireWireIdentity(row.id, "held item id"),
    heroId: requireWireIdentity(row.heroId, "hero id"),
    originalItemId: requireWireIdentity(row.originalItemId, "original item id"),
    artifactId: requireWireIdentity(row.artifactId, "artifact id"),
    quantity: row.quantity,
    durability: row.durability,
    durabilityMax: row.durabilityMax,
    upgrade: {
      id: row.upgradeId,
      level: row.upgradeLevel,
      skillId: row.upgradeSkillId,
      bound: upgradeBound === 1,
    },
  };
}
