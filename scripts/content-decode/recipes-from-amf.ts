import {
  PROFESSION_ID_MAX,
  PROFESSION_ID_MIN,
} from "../../src/modules/catalog/domain/profession-ids.ts";
import type { CraftRecipeDocument } from "../../src/modules/content/domain/content-craft.ts";
import { CRAFT_XP_BANDS } from "../../src/modules/professions/domain/craft-formulas.ts";
import { amfInteger, amfString, isRecord } from "./amf-fields.ts";
import { amfRecordList } from "./amf-record-list.ts";
import { rejectUnknownKeys } from "./json-object-keys.ts";

const RECIPE_ROOT_KEYS = new Set(["recipes", "probabilities"]);
const RECIPE_KEYS = new Set([
  "id",
  "title",
  "description",
  "artikul_id",
  "type",
  "profession_id",
  "skill_value",
  "max_skill_value",
  "data",
  "data_2",
  "duration",
  "create_artikul_id",
  "create_artikul_num",
  "create_quality",
  "create_type_id",
  "create_title",
  "create_level_min",
  "table_id",
  "force_flags",
]);
const INGREDIENT_KEYS = new Set(["artikul_id", "amount", "amount_max", "type", "title"]);
const BAND_KEYS = new Set(["probability", "color"]);
const LEFTOVER_RECIPE_TYPES = new Set([2, 3, 4, 5, 7]);
const LEFTOVER_XP_SENTINEL = 16777215;
const CRAFT_TYPE = 1;

export function recipesFromAmf(raw: unknown): CraftRecipeDocument[] {
  if (!isRecord(raw)) throw new Error("recipes.amf root must be an object");
  rejectUnknownKeys(raw, RECIPE_ROOT_KEYS, "recipes.amf");
  assertXpBands(raw.probabilities);
  const rows = amfRecordList(raw.recipes, "recipes.amf recipes");
  const recipes: CraftRecipeDocument[] = [];
  const seen = new Set<number>();
  const books = new Set<number>();
  for (const row of rows) {
    const recipe = recipeFromAmf(row);
    if (!recipe) continue;
    if (seen.has(recipe.id)) throw new Error(`Duplicate craft recipe ${recipe.id}`);
    seen.add(recipe.id);
    if (books.has(recipe.artikulId)) throw new Error(`Duplicate craft book ${recipe.artikulId}`);
    books.add(recipe.artikulId);
    recipes.push(recipe);
  }
  if (!recipes.some((row) => row.id === 61)) throw new Error("craft recipe 61 is required");
  return recipes.sort((left, right) => left.id - right.id);
}

function recipeFromAmf(raw: Record<string, unknown>): CraftRecipeDocument | null {
  if (!isRecord(raw)) throw new Error("recipes.amf row must be an object");
  rejectUnknownKeys(raw, RECIPE_KEYS, "recipes.amf row");
  const id = amfInteger(raw.id, "recipes.amf id");
  if (id < 1) throw new Error(`recipe ${id} id must be positive`);
  const type = amfInteger(raw.type, `recipe ${id} type`);
  if (type !== CRAFT_TYPE) {
    if (!LEFTOVER_RECIPE_TYPES.has(type)) throw new Error(`recipe ${id} type ${type} is unknown`);
    return null;
  }
  const professionId = amfInteger(raw.profession_id, `recipe ${id} profession_id`);
  if (professionId < PROFESSION_ID_MIN) return null;
  if (professionId > PROFESSION_ID_MAX) {
    throw new Error(`recipe ${id} profession ${professionId} is out of range`);
  }
  if (Array.isArray(raw.data_2) && raw.data_2.length > 0) {
    throw new Error(`recipe ${id} data_2 is leftover and must be empty`);
  }
  const ingredients = ingredientsFromAmf(raw.data, id);
  const artikulId = amfInteger(raw.artikul_id, `recipe ${id} artikul_id`);
  if (artikulId < 1) throw new Error(`recipe ${id} book artikul_id must be positive`);
  const createArtikulId = amfInteger(raw.create_artikul_id, `recipe ${id} create_artikul_id`);
  if (createArtikulId < 1) throw new Error(`recipe ${id} create_artikul_id must be positive`);
  const skillValue = amfInteger(raw.skill_value, `recipe ${id} skill_value`);
  if (skillValue < 0) throw new Error(`recipe ${id} skill_value is invalid`);
  const maxSkillValue = amfInteger(raw.max_skill_value, `recipe ${id} max_skill_value`);
  if (maxSkillValue < 1) throw new Error(`recipe ${id} max_skill_value must be positive`);
  const duration = amfInteger(raw.duration, `recipe ${id} duration`);
  if (duration < 0) throw new Error(`recipe ${id} duration is invalid`);
  const createArtikulNum = amfInteger(raw.create_artikul_num, `recipe ${id} create_artikul_num`);
  if (createArtikulNum < 1) throw new Error(`recipe ${id} create_artikul_num must be positive`);
  const createQuality = amfInteger(raw.create_quality, `recipe ${id} create_quality`);
  if (createQuality < 0) throw new Error(`recipe ${id} create_quality is invalid`);
  const createTypeId = amfInteger(raw.create_type_id, `recipe ${id} create_type_id`);
  if (createTypeId < 0) throw new Error(`recipe ${id} create_type_id is invalid`);
  const createLevelMin = amfInteger(raw.create_level_min, `recipe ${id} create_level_min`);
  if (createLevelMin < 0) throw new Error(`recipe ${id} create_level_min is invalid`);
  const tableId = amfInteger(raw.table_id, `recipe ${id} table_id`);
  if (tableId < 0) throw new Error(`recipe ${id} table_id is invalid`);
  const title = amfString(raw.title, `recipe ${id} title`);
  if (!title) throw new Error(`recipe ${id} title is required`);
  const createTitle = amfString(raw.create_title, `recipe ${id} create_title`);
  if (!createTitle) throw new Error(`recipe ${id} create_title is required`);
  return {
    id,
    title,
    description: amfString(raw.description, `recipe ${id} description`),
    artikulId,
    type: CRAFT_TYPE,
    professionId,
    skillValue,
    maxSkillValue,
    ingredients,
    duration,
    createArtikulId,
    createArtikulNum,
    createQuality,
    createTypeId,
    createTitle,
    createLevelMin,
    tableId,
  };
}

function ingredientsFromAmf(raw: unknown, recipeId: number): CraftRecipeDocument["ingredients"] {
  if (!Array.isArray(raw)) throw new Error(`recipe ${recipeId} data must be an array`);
  const ingredients: Array<{ artikulId: number; amount: number }> = [];
  for (const [index, item] of raw.entries()) {
    if (!isRecord(item))
      throw new Error(`recipe ${recipeId} ingredient ${index} must be an object`);
    rejectUnknownKeys(item, INGREDIENT_KEYS, `recipe ${recipeId} ingredient`);
    const kind = amfString(item.type, `recipe ${recipeId} ingredient ${index} type`);
    if (kind !== "artifact") {
      throw new Error(`recipe ${recipeId} ingredient type ${kind} is leftover`);
    }
    const artikulId = amfInteger(
      item.artikul_id,
      `recipe ${recipeId} ingredient ${index} artikul_id`,
    );
    if (artikulId < 1) throw new Error(`recipe ${recipeId} ingredient artikul_id must be positive`);
    const amount = amfInteger(item.amount, `recipe ${recipeId} ingredient ${index} amount`);
    if (amount < 1) throw new Error(`recipe ${recipeId} ingredient amount must be positive`);
    ingredients.push({ artikulId, amount });
  }
  if (ingredients.length < 1) throw new Error(`recipe ${recipeId} has no ingredients`);
  return ingredients;
}

function assertXpBands(raw: unknown): void {
  if (!isRecord(raw)) throw new Error("recipes.amf probabilities must be an object");
  const expected = new Map(CRAFT_XP_BANDS.map((band) => [String(band.delta), band.percent]));
  for (const key of Object.keys(raw)) {
    if (Number(key) === LEFTOVER_XP_SENTINEL) continue;
    if (!expected.has(key)) throw new Error(`recipes.amf probability delta ${key} is unknown`);
  }
  for (const [delta, percent] of expected) {
    const row = raw[delta];
    if (!isRecord(row)) throw new Error(`recipes.amf probability ${delta} must be an object`);
    rejectUnknownKeys(row, BAND_KEYS, `recipes.amf probability ${delta}`);
    const probability = amfInteger(row.probability, `recipes.amf probability ${delta}`);
    if (probability !== percent) {
      throw new Error(`recipes.amf probability ${delta} must be ${percent}`);
    }
    amfString(row.color, `recipes.amf probability ${delta} color`);
  }
}
