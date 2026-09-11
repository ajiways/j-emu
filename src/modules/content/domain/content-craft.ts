type CraftIngredientDocument = Readonly<{
  artikulId: number;
  amount: number;
}>;

export type CraftRecipeDocument = Readonly<{
  id: number;
  title: string;
  description: string;
  artikulId: number;
  type: 1;
  professionId: number;
  skillValue: number;
  maxSkillValue: number;
  ingredients: readonly CraftIngredientDocument[];
  duration: number;
  createArtikulId: number;
  createArtikulNum: number;
  createQuality: number;
  createTypeId: number;
  createTitle: string;
  createLevelMin: number;
  tableId: number;
}>;
