export type CraftIngredient = Readonly<{
  artikulId: number;
  amount: number;
}>;

export type CraftRecipeDefinition = Readonly<{
  id: number;
  title: string;
  description: string;
  artikulId: number;
  type: number;
  professionId: number;
  skillValue: number;
  maxSkillValue: number;
  ingredients: readonly CraftIngredient[];
  duration: number;
  createArtikulId: number;
  createArtikulNum: number;
  createQuality: number;
  createTypeId: number;
  createTitle: string;
  createLevelMin: number;
  tableId: number;
}>;
