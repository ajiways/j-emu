import { and, asc, eq } from "drizzle-orm";
import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import type { StoreLot, StoreType } from "../domain/store-lot.ts";
import { parseStorePay } from "../domain/store-pay.ts";
import { parseStoreRequires } from "../domain/store-requires.ts";
import { storeLots, storeTypes } from "./schema.ts";

export async function loadStoreTypes(
  database: PostgresDatabase,
  releaseId: string,
  areaId: string,
): Promise<readonly StoreType[]> {
  if (!areaId) throw new Error("Store area id is required");
  const rows = await database
    .session()
    .select()
    .from(storeTypes)
    .where(and(eq(storeTypes.releaseId, releaseId), eq(storeTypes.areaId, areaId)))
    .orderBy(asc(storeTypes.ord), asc(storeTypes.typeId));
  return rows.map((row) => ({
    areaId: row.areaId,
    typeId: row.typeId,
    title: row.title,
    ord: row.ord,
  }));
}

export async function loadStoreLots(
  database: PostgresDatabase,
  releaseId: string,
  areaId: string,
): Promise<readonly StoreLot[]> {
  if (!areaId) throw new Error("Store area id is required");
  const rows = await database
    .session()
    .select()
    .from(storeLots)
    .where(and(eq(storeLots.releaseId, releaseId), eq(storeLots.areaId, areaId)))
    .orderBy(asc(storeLots.ord), asc(storeLots.lotId));
  return rows.map((row) => ({
    areaId: row.areaId,
    lotId: row.lotId,
    artikulId: row.artikulId,
    typeId: row.typeId,
    price: row.price,
    ord: row.ord,
    pay: parseStorePay(row.pay),
    requires: parseStoreRequires(row.requires),
  }));
}
