import { and, eq } from "drizzle-orm";
import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import type { CraftIngredient, CraftRecipeDefinition } from "../domain/craft-recipe-definition.ts";
import { craftRecipes } from "./schema-crafts.ts";

export async function loadCraftRecipe(
  database: PostgresDatabase,
  releaseId: string,
  id: number,
): Promise<CraftRecipeDefinition | null> {
  if (!Number.isInteger(id) || id < 1) throw new Error("Craft recipe id is required");
  const rows = await database
    .session()
    .select()
    .from(craftRecipes)
    .where(and(eq(craftRecipes.releaseId, releaseId), eq(craftRecipes.id, id)));
  if (rows.length > 1) throw new Error(`Multiple craft recipes found for ${id}`);
  const row = rows[0];
  return row ? toRecipe(row) : null;
}

export async function loadCraftRecipeByBook(
  database: PostgresDatabase,
  releaseId: string,
  artikulId: number,
): Promise<CraftRecipeDefinition | null> {
  if (!Number.isInteger(artikulId) || artikulId < 1) {
    throw new Error("Craft book artikul id is required");
  }
  const rows = await database
    .session()
    .select()
    .from(craftRecipes)
    .where(and(eq(craftRecipes.releaseId, releaseId), eq(craftRecipes.artikulId, artikulId)));
  if (rows.length > 1) throw new Error(`Multiple craft recipes found for book ${artikulId}`);
  const row = rows[0];
  return row ? toRecipe(row) : null;
}

function toRecipe(row: typeof craftRecipes.$inferSelect): CraftRecipeDefinition {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    artikulId: row.artikulId,
    type: row.type,
    professionId: row.professionId,
    skillValue: row.skillValue,
    maxSkillValue: row.maxSkillValue,
    ingredients: parseIngredients(row.ingredients, row.id),
    duration: row.duration,
    createArtikulId: row.createArtikulId,
    createArtikulNum: row.createArtikulNum,
    createQuality: row.createQuality,
    createTypeId: row.createTypeId,
    createTitle: row.createTitle,
    createLevelMin: row.createLevelMin,
    tableId: row.tableId,
  };
}

function parseIngredients(value: unknown, recipeId: number): readonly CraftIngredient[] {
  if (!Array.isArray(value) || value.length < 1) {
    throw new Error(`Craft recipe ${recipeId} ingredients are missing`);
  }
  return value.map((row, index) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      throw new Error(`Craft recipe ${recipeId} ingredient ${index} is invalid`);
    }
    const record = row as Record<string, unknown>;
    const artikulId = record.artikulId;
    const amount = record.amount;
    if (typeof artikulId !== "number" || !Number.isInteger(artikulId) || artikulId < 1) {
      throw new Error(`Craft recipe ${recipeId} ingredient ${index} artikulId is missing`);
    }
    if (typeof amount !== "number" || !Number.isInteger(amount) || amount < 1) {
      throw new Error(`Craft recipe ${recipeId} ingredient ${index} amount is missing`);
    }
    return { artikulId, amount };
  });
}
