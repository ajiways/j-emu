import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import type { StoreLotDocument, StoreTypeDocument } from "../../content/domain/content-document.ts";
import { storeLots, storeTypes } from "./schema.ts";

export async function insertStoreTypes(
  session: ReturnType<PostgresDatabase["session"]>,
  releaseId: string,
  rows: readonly StoreTypeDocument[],
): Promise<void> {
  if (rows.length === 0) return;
  await session.insert(storeTypes).values(
    rows.map((row) => ({
      releaseId,
      areaId: row.areaId,
      typeId: row.typeId,
      title: row.title,
      ord: row.ord,
    })),
  );
}

export async function insertStoreLots(
  session: ReturnType<PostgresDatabase["session"]>,
  releaseId: string,
  rows: readonly StoreLotDocument[],
): Promise<void> {
  if (rows.length === 0) return;
  const values = rows.map((row) => ({
    releaseId,
    areaId: row.areaId,
    lotId: row.lotId,
    artikulId: row.artikulId,
    typeId: row.typeId,
    price: row.price,
    ord: row.ord,
    pay: row.pay,
    requires: row.requires === undefined ? null : row.requires,
  }));
  await insertInBatches(values, async (batch) => {
    await session.insert(storeLots).values(batch);
  });
}

const INSERT_BATCH = 250;

async function insertInBatches<T>(
  rows: readonly T[],
  write: (batch: T[]) => Promise<unknown>,
): Promise<void> {
  for (let offset = 0; offset < rows.length; offset += INSERT_BATCH) {
    await write(rows.slice(offset, offset + INSERT_BATCH));
  }
}
