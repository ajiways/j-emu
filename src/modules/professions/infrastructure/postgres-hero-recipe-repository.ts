import { and, eq } from "drizzle-orm";
import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import type { HeroRecipe, HeroRecipeInsert } from "../domain/hero-recipe.ts";
import type { HeroRecipeRepository } from "../ports/hero-recipe-repository.ts";
import { heroRecipes } from "./schema.ts";

export class PostgresHeroRecipeRepository implements HeroRecipeRepository {
  constructor(private readonly database: PostgresDatabase) {}

  async listByHero(heroId: number): Promise<HeroRecipe[]> {
    if (!Number.isInteger(heroId) || heroId < 1) throw new Error("Hero id is required");
    const rows = await this.database
      .session()
      .select()
      .from(heroRecipes)
      .where(eq(heroRecipes.heroId, heroId));
    return rows.map(toRecipe);
  }

  async findByHeroRecipe(heroId: number, recipeId: number): Promise<HeroRecipe | null> {
    if (!Number.isInteger(heroId) || heroId < 1) throw new Error("Hero id is required");
    if (!Number.isInteger(recipeId) || recipeId < 1) throw new Error("Recipe id is required");
    const rows = await this.database
      .session()
      .select()
      .from(heroRecipes)
      .where(and(eq(heroRecipes.heroId, heroId), eq(heroRecipes.recipeId, recipeId)));
    if (rows.length > 1) {
      throw new Error(`Multiple hero recipes found for hero ${heroId} recipe ${recipeId}`);
    }
    const row = rows[0];
    return row ? toRecipe(row) : null;
  }

  async insert(row: HeroRecipeInsert): Promise<HeroRecipe> {
    const inserted = await this.database.session().insert(heroRecipes).values(row).returning();
    const created = inserted[0];
    if (!created) throw new Error("Hero recipe insert did not return a row");
    return toRecipe(created);
  }

  async save(row: HeroRecipe): Promise<void> {
    await this.database
      .session()
      .update(heroRecipes)
      .set({ ftime: row.ftime, flags: row.flags })
      .where(eq(heroRecipes.id, row.id));
  }
}

function toRecipe(row: typeof heroRecipes.$inferSelect): HeroRecipe {
  return {
    id: row.id,
    heroId: row.heroId,
    recipeId: row.recipeId,
    ftime: row.ftime,
    flags: row.flags,
  };
}
