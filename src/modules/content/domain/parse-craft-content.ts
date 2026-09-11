import { z } from "zod";
import { PROFESSION_ID_MAX, PROFESSION_ID_MIN } from "../../catalog/domain/profession-ids.ts";

const ingredientSchema = z
  .object({
    artikulId: z.number().int().positive(),
    amount: z.number().int().positive(),
  })
  .strict();

const craftRecipeDocumentSchema = z
  .object({
    id: z.number().int().positive(),
    title: z.string().min(1),
    description: z.string(),
    artikulId: z.number().int().positive(),
    type: z.literal(1),
    professionId: z.number().int().min(PROFESSION_ID_MIN).max(PROFESSION_ID_MAX),
    skillValue: z.number().int().nonnegative(),
    maxSkillValue: z.number().int().positive(),
    ingredients: z.array(ingredientSchema).min(1),
    duration: z.number().int().nonnegative(),
    createArtikulId: z.number().int().positive(),
    createArtikulNum: z.number().int().positive(),
    createQuality: z.number().int().nonnegative(),
    createTypeId: z.number().int().nonnegative(),
    createTitle: z.string().min(1),
    createLevelMin: z.number().int().nonnegative(),
    tableId: z.number().int().nonnegative(),
  })
  .strict();

export const craftRecipesSchema = z.array(craftRecipeDocumentSchema);
