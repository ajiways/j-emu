export const RECIPE_FAVORITE_FLAG = 1;

export type HeroRecipe = Readonly<{
  id: number;
  heroId: number;
  recipeId: number;
  ftime: number;
  flags: number;
}>;

export type HeroRecipeInsert = Omit<HeroRecipe, "id">;
