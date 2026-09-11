import type { HeroRecipe, HeroRecipeInsert } from "../domain/hero-recipe.ts";

export interface HeroRecipeRepository {
  listByHero(heroId: number): Promise<HeroRecipe[]>;
  findByHeroRecipe(heroId: number, recipeId: number): Promise<HeroRecipe | null>;
  insert(row: HeroRecipeInsert): Promise<HeroRecipe>;
  save(row: HeroRecipe): Promise<void>;
}
