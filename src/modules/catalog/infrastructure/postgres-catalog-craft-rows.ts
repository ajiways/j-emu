import type { CraftRecipeDocument } from "../../content/domain/content-craft.ts";
import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import { craftRecipes } from "./schema-crafts.ts";

export async function insertCraftRecipes(
  session: ReturnType<PostgresDatabase["session"]>,
  releaseId: string,
  rows: readonly CraftRecipeDocument[],
): Promise<void> {
  if (rows.length === 0) throw new Error("Craft recipes are missing");
  const values = rows.map((row) => ({
    releaseId,
    id: row.id,
    title: row.title,
    description: row.description,
    artikulId: row.artikulId,
    type: row.type,
    professionId: row.professionId,
    skillValue: row.skillValue,
    maxSkillValue: row.maxSkillValue,
    ingredients: row.ingredients,
    duration: row.duration,
    createArtikulId: row.createArtikulId,
    createArtikulNum: row.createArtikulNum,
    createQuality: row.createQuality,
    createTypeId: row.createTypeId,
    createTitle: row.createTitle,
    createLevelMin: row.createLevelMin,
    tableId: row.tableId,
  }));
  await insertInBatches(values, async (batch) => {
    await session.insert(craftRecipes).values(batch);
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
