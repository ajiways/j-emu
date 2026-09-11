import type { ContentBundle } from "../domain/content-document.ts";
import type { CraftRecipeDocument } from "../domain/content-craft.ts";

const RECIPE_ID = 61;
const BOOK_ID = 1861;
const OUTPUT_ID = 1714;
const INGREDIENT_ID = 1720;
const PROFESSION_ID = 6;

export function collectCraftIssues(bundle: ContentBundle): readonly string[] {
  const issues: string[] = [];
  const ids = new Set<number>();
  const books = new Set<number>();
  for (const row of bundle.craftRecipes) {
    if (ids.has(row.id)) issues.push(`duplicate craft recipe ${row.id}`);
    ids.add(row.id);
    if (books.has(row.artikulId)) issues.push(`duplicate craft book ${row.artikulId}`);
    books.add(row.artikulId);
  }
  const recipe = bundle.craftRecipes.find((row) => row.id === RECIPE_ID);
  if (!recipe) issues.push(`craft recipe ${RECIPE_ID} is required`);
  else pushRecipe61Issues(issues, recipe);
  const artifacts = new Set(bundle.artifacts.map((row) => row.id));
  if (!artifacts.has(BOOK_ID))
    issues.push(`artifact ${BOOK_ID} is required for recipe ${RECIPE_ID}`);
  else pushBookIssues(issues, bundle, BOOK_ID);
  if (!artifacts.has(OUTPUT_ID)) {
    issues.push(`artifact ${OUTPUT_ID} is required for recipe ${RECIPE_ID}`);
  }
  if (!artifacts.has(INGREDIENT_ID)) {
    issues.push(`artifact ${INGREDIENT_ID} is required for recipe ${RECIPE_ID}`);
  }
  for (const row of bundle.craftRecipes) {
    if (!artifacts.has(row.artikulId)) {
      issues.push(`craft recipe ${row.id} book ${row.artikulId} is missing`);
    }
    if (!artifacts.has(row.createArtikulId)) {
      issues.push(`craft recipe ${row.id} output ${row.createArtikulId} is missing`);
    }
    for (const ingredient of row.ingredients) {
      if (!artifacts.has(ingredient.artikulId)) {
        issues.push(`craft recipe ${row.id} ingredient ${ingredient.artikulId} is missing`);
      }
    }
  }
  return issues;
}

function pushRecipe61Issues(issues: string[], row: CraftRecipeDocument): void {
  if (row.title !== "Раствор хрусталя")
    issues.push(`recipe ${row.id} title must be Раствор хрусталя`);
  if (row.professionId !== PROFESSION_ID)
    issues.push(`recipe ${row.id} profession must be ${PROFESSION_ID}`);
  if (row.artikulId !== BOOK_ID) issues.push(`recipe ${row.id} book must be ${BOOK_ID}`);
  if (row.skillValue !== 0) issues.push(`recipe ${row.id} skillValue must be 0`);
  if (row.maxSkillValue !== 60) issues.push(`recipe ${row.id} maxSkillValue must be 60`);
  if (row.duration !== 35) issues.push(`recipe ${row.id} duration must be 35`);
  if (row.createArtikulId !== OUTPUT_ID)
    issues.push(`recipe ${row.id} output must be ${OUTPUT_ID}`);
  if (row.createArtikulNum !== 10) issues.push(`recipe ${row.id} createArtikulNum must be 10`);
  const ingredient = row.ingredients[0];
  if (
    row.ingredients.length !== 1 ||
    ingredient?.artikulId !== INGREDIENT_ID ||
    ingredient.amount !== 1
  ) {
    issues.push(`recipe ${row.id} must consume 1720×1`);
  }
}

function pushBookIssues(issues: string[], bundle: ContentBundle, bookId: number): void {
  const book = bundle.artifacts.find((row) => row.id === bookId);
  if (!book) return;
  const action = Object.values(book.artifact_actions)[0];
  if (!action || action.code !== "LEARN_RECIPE") {
    issues.push(`artifact ${bookId} use action must be LEARN_RECIPE`);
  }
  if (action?.dispose !== 1) issues.push(`artifact ${bookId} dispose must be 1`);
}
