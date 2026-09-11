import type { CraftRecipeDefinition } from "../domain/craft-recipe-definition.ts";

export interface CraftCatalog {
  craftRecipe(id: number): Promise<CraftRecipeDefinition | null>;
  craftRecipeByBook(artikulId: number): Promise<CraftRecipeDefinition | null>;
}
