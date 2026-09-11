import type { Catalog } from "../../catalog/ports/catalog.ts";
import type { CraftCatalog } from "../../catalog/ports/craft-catalog.ts";
import type { ProfessionCatalog } from "../../catalog/ports/profession-catalog.ts";
import type { CharacterService } from "../../character/application/character-service.ts";
import { GhostHeroError } from "../../character/domain/ghost-hero-error.ts";
import { maxProfessionSkillForLevel } from "../../character/domain/profession-cap.ts";
import type { InventoryService } from "../../inventory/domain/inventory-service.ts";
import type { Clock } from "../../../shared/kernel/clock.ts";
import { requirePresent } from "../../../shared/kernel/require-present.ts";
import type { UnitOfWork } from "../../../shared/kernel/unit-of-work.ts";
import { PROFESSION_TYPE_CRAFT } from "../../catalog/domain/profession-ids.ts";
import type { FarmRng } from "../domain/farm-formulas.ts";
import { craftTrainCap, rollCraftXp } from "../domain/craft-formulas.ts";
import { RECIPE_FAVORITE_FLAG } from "../domain/hero-recipe.ts";
import { ProfessionDeniedError } from "../domain/profession-denied-error.ts";
import type { HeroRecipeRepository } from "../ports/hero-recipe-repository.ts";

type CraftRecipeWire = Readonly<{
  id: number;
  user_id: number;
  artikul_id: number;
  ftime: number;
  flags: number;
  rand_seed: 0;
}>;

type CraftItemsResult = Readonly<{
  recipeId: number;
  createArtikulId: number;
  createArtikulNum: number;
  createdItemIds: readonly number[];
  skillBumped: boolean;
  professionValue: number;
}>;

export class CraftService {
  constructor(
    private readonly recipes: HeroRecipeRepository,
    private readonly catalog: Catalog & CraftCatalog & ProfessionCatalog,
    private readonly characters: CharacterService,
    private readonly inventory: InventoryService,
    private readonly clock: Clock,
    private readonly unitOfWork: UnitOfWork,
    private readonly random: FarmRng,
  ) {}

  async recipesList(heroId: number): Promise<{ status: 100; recipes: readonly CraftRecipeWire[] }> {
    const hero = await this.requireHero(heroId);
    const rows = await this.recipes.listByHero(hero.id);
    return {
      status: 100,
      recipes: rows.map((row) => ({
        id: row.id,
        user_id: row.heroId,
        artikul_id: row.recipeId,
        ftime: row.ftime,
        flags: row.flags,
        rand_seed: 0,
      })),
    };
  }

  learnFromBook(heroId: number, artikulId: number): Promise<void> {
    return this.unitOfWork.run(async () => {
      const hero = await this.requireHero(heroId);
      if (hero.ghost) throw new GhostHeroError(heroId, "learnFromBook");
      const recipe = await this.catalog.craftRecipeByBook(artikulId);
      if (!recipe) throw new ProfessionDeniedError("Нет такого рецепта");
      await this.assertCanStudy(hero.id, hero.level, recipe.professionId, recipe.skillValue);
      const existing = await this.recipes.findByHeroRecipe(hero.id, recipe.id);
      if (existing) throw new ProfessionDeniedError("Рецепт уже изучен");
      await this.recipes.insert({
        heroId: hero.id,
        recipeId: recipe.id,
        ftime: 0,
        flags: 0,
      });
    });
  }

  craftItems(heroId: number, recipeId: number): Promise<CraftItemsResult> {
    return this.unitOfWork.run(async () => {
      const hero = await this.requireHero(heroId);
      if (hero.ghost) throw new GhostHeroError(heroId, "craftItems");
      const recipe = await this.catalog.craftRecipe(recipeId);
      if (!recipe) throw new ProfessionDeniedError("Нет такого рецепта");
      const license = await this.requireLicense(hero.id, recipe.professionId);
      this.assertSkillGate(hero.level, license.value, recipe.skillValue);
      const studied = await this.recipes.findByHeroRecipe(hero.id, recipe.id);
      if (!studied) throw new ProfessionDeniedError("Рецепт не изучен");
      const now = this.clock.unixSeconds();
      if (studied.ftime > now) throw new ProfessionDeniedError("Рецепт ещё готовится");
      for (const ingredient of recipe.ingredients) {
        const have = await this.inventory.countBagByArtifact({
          characterId: hero.id,
          artifactId: ingredient.artikulId,
        });
        if (have < ingredient.amount) {
          throw new ProfessionDeniedError("Не хватает ингредиентов");
        }
      }
      const canFit = await this.inventory.canFitBag({
        characterId: hero.id,
        artifactId: recipe.createArtikulId,
        quantity: recipe.createArtikulNum,
      });
      if (!canFit) throw new ProfessionDeniedError("Не хватает места в сумке");
      for (const ingredient of recipe.ingredients) {
        await this.inventory.consumeFromBag({
          characterId: hero.id,
          artifactId: ingredient.artikulId,
          quantity: ingredient.amount,
        });
      }
      await this.inventory.grantToBag({
        characterId: hero.id,
        artifactId: recipe.createArtikulId,
        quantity: recipe.createArtikulNum,
      });
      const createdItemIds = (await this.inventory.list(hero.id))
        .filter(
          (item) => item.location.kind === "bag" && item.artifactId === recipe.createArtikulId,
        )
        .map((item) => item.id);
      const nextFtime = now + recipe.duration;
      await this.recipes.save({ ...studied, ftime: nextFtime });
      const cap = craftTrainCap(
        recipe.skillValue,
        recipe.maxSkillValue,
        maxProfessionSkillForLevel(hero.level),
      );
      const skillBumped = rollCraftXp(license.value, recipe.skillValue, cap, this.random);
      const professionValue = skillBumped
        ? await this.characters.bumpCraftSkill({
            characterId: hero.id,
            professionId: recipe.professionId,
          })
        : license.value;
      return {
        recipeId: recipe.id,
        createArtikulId: recipe.createArtikulId,
        createArtikulNum: recipe.createArtikulNum,
        createdItemIds,
        skillBumped,
        professionValue,
      };
    });
  }

  setFavorite(heroId: number, recipeId: number, favorite: boolean): Promise<void> {
    return this.unitOfWork.run(async () => {
      const hero = await this.requireHero(heroId);
      if (hero.ghost) throw new GhostHeroError(heroId, "setFavorite");
      const studied = await this.recipes.findByHeroRecipe(hero.id, recipeId);
      if (!studied) throw new ProfessionDeniedError("Рецепт не изучен");
      const flags = favorite
        ? studied.flags | RECIPE_FAVORITE_FLAG
        : studied.flags & ~RECIPE_FAVORITE_FLAG;
      await this.recipes.save({ ...studied, flags });
    });
  }

  private async requireHero(heroId: number) {
    if (!Number.isInteger(heroId) || heroId < 1) throw new Error("Hero id is required");
    const hero = await this.characters.getById(heroId);
    return requirePresent(hero, `Hero ${heroId} is missing`);
  }

  private async requireLicense(heroId: number, professionId: number) {
    const licenses = await this.characters.professionLicenses(heroId);
    const license = licenses.find((row) => row.professionId === professionId);
    if (!license) throw new ProfessionDeniedError("Нет профессии");
    return license;
  }

  private async assertCanStudy(
    heroId: number,
    level: number,
    professionId: number,
    skillValue: number,
  ): Promise<void> {
    const definition = await this.catalog.profession(professionId);
    if (!definition) throw new ProfessionDeniedError("Нет профессии");
    if (definition.type !== PROFESSION_TYPE_CRAFT) {
      throw new Error(`Profession ${professionId} is not a craft profession`);
    }
    const license = await this.requireLicense(heroId, professionId);
    this.assertSkillGate(level, license.value, skillValue);
  }

  private assertSkillGate(level: number, value: number, skillValue: number): void {
    const maxSkill = maxProfessionSkillForLevel(level);
    if (maxSkill <= 0 || skillValue >= maxSkill || value < skillValue) {
      throw new ProfessionDeniedError("Недостаточное мастерство");
    }
  }
}
