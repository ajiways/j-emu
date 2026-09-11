import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import type { AmfValue } from "../../src/modules/jugger-wire/amf/amf3.ts";
import { AuthenticatedClient } from "../support/harness/authenticated-client.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";
import { bagItemByArtikulId, heroIdFrom } from "../support/harness/wire-payload.ts";

const LEVEL7_EXP = 3622;

describe("craft recipe 61", () => {
  let harness: ApplicationHarness;
  let application: Application;

  beforeEach(async () => {
    harness = new ApplicationHarness(undefined, undefined, { farmRandom: { unit: () => 0 } });
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("learns from book 1861, crafts 1714, cools down, and keeps favorites after restart", async () => {
    const client = await AuthenticatedClient.login(application);
    const init = await client.objectAction({ object: "common", action: "init", sq: 1 });
    const heroId = heroIdFrom(init);
    await application.characterProfessions.learnProfession({
      characterId: heroId,
      professionId: 6,
    });
    const leveled = await application.characterProgression.grantExperience({
      characterId: heroId,
      operationId: `prf:${heroId}:craft-l7`,
      amount: LEVEL7_EXP,
    });
    if (leveled.levelAfter !== 7) {
      throw new Error(`Expected level 7 after ${LEVEL7_EXP} EXP, got ${leveled.levelAfter}`);
    }
    await application.inventory.grantToBag({
      characterId: heroId,
      artifactId: 1861,
      quantity: 1,
    });
    await application.inventory.grantToBag({
      characterId: heroId,
      artifactId: 1720,
      quantity: 1,
    });
    const bag = await client.objectAction({ object: "common", action: "init", sq: 2 });
    const bookId = requireNumber(bagItemByArtikulId(bag, 1861).id);
    const learned = await client.objectAction({
      object: "common",
      action: "action",
      form: { object_class: "ARTIFACT", object_id: bookId },
      sq: 3,
    });
    expect(learned["common|action"]).toEqual({ status: 100, action: "USE" });
    expect(() => bagItemByArtikulId(learned, 1861)).toThrow(/1861 is missing/);
    const recipes = record(learned["craft|user_recipes_list"], "learned recipes");
    expect(recipes.status).toBe(100);
    const studied = requireRecipe(recipes.recipes, 61);
    expect(studied.artikul_id).toBe(61);
    expect(studied.ftime).toBe(0);
    expect(studied.flags).toBe(0);

    await application.inventory.grantToBag({
      characterId: heroId,
      artifactId: 1861,
      quantity: 1,
    });
    const againBag = await client.objectAction({ object: "common", action: "init", sq: 4 });
    const denied = await client.objectAction({
      object: "common",
      action: "action",
      form: {
        object_class: "ARTIFACT",
        object_id: requireNumber(bagItemByArtikulId(againBag, 1861).id),
      },
      sq: 5,
    });
    expect(denied["common|action"]).toEqual({ status: 203, error: "Рецепт уже изучен" });

    const crafted = await client.objectAction({
      object: "craft",
      action: "craft_items",
      recipe_id: 61,
      sq: 6,
    });
    expect(record(crafted["craft|craft_items"], "craft payload")).toMatchObject({
      status: 100,
      recipe_id: 61,
      create_artikul_id: "1714",
      create_artikul_num: "10",
    });
    expect(() => bagItemByArtikulId(crafted, 1720)).toThrow(/1720 is missing/);
    expect(bagItemByArtikulId(crafted, 1714)).toMatchObject({ cnt: 10 });
    const professions = record(crafted["user|professions"], "bumped professions");
    expect(professions.max_profession_skill).toBe(59);
    const slot6 = professions.professions;
    if (!Array.isArray(slot6)) throw new Error("user|professions.professions is missing");
    expect(record(slot6[5], "craft slot").value).toBe(2);
    const cooling = requireRecipe(
      record(crafted["craft|user_recipes_list"], "cooling list").recipes,
      61,
    );
    expect(cooling.ftime).toBeGreaterThan(0);

    const retry = await client.objectAction({
      object: "craft",
      action: "craft_items",
      recipe_id: 61,
      sq: 7,
    });
    expect(record(retry["craft|craft_items"], "cooldown")).toEqual({
      status: 2,
      error: "Рецепт ещё готовится",
    });

    await harness.advanceClock(35_000);
    await application.inventory.grantToBag({
      characterId: heroId,
      artifactId: 1720,
      quantity: 1,
    });
    const second = await client.objectAction({
      object: "craft",
      action: "craft_items",
      recipe_id: 61,
      sq: 8,
    });
    expect(record(second["craft|craft_items"], "second craft").status).toBe(100);
    expect(bagItemByArtikulId(second, 1714)).toMatchObject({ cnt: 20 });

    const favorited = await client.objectAction({
      object: "craft",
      action: "recipe_add_favorite",
      recipe_id: 61,
      sq: 9,
    });
    expect(
      requireRecipe(record(favorited["craft|user_recipes_list"], "fav").recipes, 61).flags,
    ).toBe(1);
    const cleared = await client.objectAction({
      object: "craft",
      action: "recipe_remove_favorite",
      recipe_id: 61,
      sq: 10,
    });
    expect(
      requireRecipe(record(cleared["craft|user_recipes_list"], "unfav").recipes, 61).flags,
    ).toBe(0);
    await client.objectAction({
      object: "craft",
      action: "recipe_add_favorite",
      recipe_id: 61,
      sq: 11,
    });

    application = await harness.restart();
    const again = new AuthenticatedClient(application, client.cookie);
    const restored = await again.objectAction({
      object: "craft",
      action: "user_recipes_list",
      sq: 20,
    });
    const restoredRow = requireRecipe(
      record(restored["craft|user_recipes_list"], "restart list").recipes,
      61,
    );
    expect(restoredRow.flags).toBe(1);
    const professionsAgain = await again.objectAction({
      object: "user",
      action: "professions",
      sq: 21,
    });
    const slots = record(professionsAgain["user|professions"], "restart professions").professions;
    if (!Array.isArray(slots)) throw new Error("restart professions are missing");
    expect(record(slots[5], "restart craft slot").value).toBe(3);
  });
});

function record(value: AmfValue | undefined, label: string): Record<string, AmfValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} is missing`);
  }
  return value;
}

function requireNumber(value: AmfValue | undefined): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error("expected an integer");
  }
  return value;
}

function requireRecipe(value: AmfValue | undefined, recipeId: number): Record<string, AmfValue> {
  if (!Array.isArray(value)) throw new Error("recipes list is missing");
  for (const row of value) {
    const recipe = record(row, "recipe");
    if (recipe.artikul_id === recipeId) return recipe;
  }
  throw new Error(`recipe ${recipeId} is missing`);
}
