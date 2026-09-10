import { and, eq, lte } from "drizzle-orm";
import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import { requireWireIdentity } from "../../../shared/kernel/decimal-id.ts";
import type { NewPartyBagItem, PartyBagItem } from "../domain/party-record.ts";
import type { PartyBagRepository } from "../ports/party-bag-repository.ts";
import { partyBagItems } from "./schema.ts";

export class PostgresPartyBagRepository implements PartyBagRepository {
  constructor(private readonly database: PostgresDatabase) {}

  async insertItem(row: NewPartyBagItem): Promise<PartyBagItem> {
    requireWireIdentity(row.partyId, "party id");
    requireWireIdentity(row.artikulId, "artikul id");
    const inserted = await this.database.session().insert(partyBagItems).values(row).returning();
    const created = inserted[0];
    if (inserted.length !== 1 || !created) {
      throw new Error("Party bag insert did not return an id");
    }
    return toBagItem(created);
  }

  async lockItem(partyId: number, itemId: number): Promise<PartyBagItem | null> {
    requireWireIdentity(partyId, "party id");
    requireWireIdentity(itemId, "party bag item id");
    const rows = await this.database
      .session()
      .select()
      .from(partyBagItems)
      .where(and(eq(partyBagItems.id, itemId), eq(partyBagItems.partyId, partyId)))
      .for("update")
      .limit(1);
    const row = rows[0];
    return row ? toBagItem(row) : null;
  }

  async listItems(partyId: number): Promise<readonly PartyBagItem[]> {
    requireWireIdentity(partyId, "party id");
    const rows = await this.database
      .session()
      .select()
      .from(partyBagItems)
      .where(eq(partyBagItems.partyId, partyId));
    return rows.map(toBagItem);
  }

  async saveItem(item: PartyBagItem): Promise<void> {
    const updated = await this.database
      .session()
      .update(partyBagItems)
      .set({ cnt: item.cnt, removeTime: item.removeTime })
      .where(and(eq(partyBagItems.id, item.id), eq(partyBagItems.partyId, item.partyId)))
      .returning({ id: partyBagItems.id });
    if (updated.length !== 1) {
      throw new Error(`Party bag item ${item.id} update missed the row`);
    }
  }

  async deleteItem(partyId: number, itemId: number): Promise<void> {
    requireWireIdentity(partyId, "party id");
    requireWireIdentity(itemId, "party bag item id");
    const deleted = await this.database
      .session()
      .delete(partyBagItems)
      .where(and(eq(partyBagItems.id, itemId), eq(partyBagItems.partyId, partyId)))
      .returning({ id: partyBagItems.id });
    if (deleted.length !== 1) {
      throw new Error(`Party bag item ${itemId} delete missed the row`);
    }
  }

  async deleteExpired(partyId: number, nowUnix: number): Promise<number> {
    requireWireIdentity(partyId, "party id");
    if (!Number.isInteger(nowUnix) || nowUnix < 0) {
      throw new Error("Party bag purge time is invalid");
    }
    const deleted = await this.database
      .session()
      .delete(partyBagItems)
      .where(and(eq(partyBagItems.partyId, partyId), lte(partyBagItems.removeTime, nowUnix)))
      .returning({ id: partyBagItems.id });
    return deleted.length;
  }
}

function toBagItem(row: typeof partyBagItems.$inferSelect): PartyBagItem {
  return {
    id: row.id,
    partyId: row.partyId,
    artikulId: row.artikulId,
    cnt: row.cnt,
    removeTime: row.removeTime,
  };
}
