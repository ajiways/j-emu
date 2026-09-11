import type { Catalog } from "../modules/catalog/ports/catalog.ts";
import type { CharacterService } from "../modules/character/application/character-service.ts";
import { GhostHeroError } from "../modules/character/domain/ghost-hero-error.ts";
import { userProfessionsWire } from "../modules/character/domain/profession-wire.ts";
import type { InventoryService } from "../modules/inventory/domain/inventory-service.ts";
import { ProfessionDeniedError } from "../modules/professions/domain/profession-denied-error.ts";
import type { CraftService } from "../modules/professions/application/craft-service.ts";
import { buildUserBag } from "../modules/jugger-wire/application/user-bag-block.ts";
import type { ObjectActionEnvelope } from "../modules/jugger-wire/commands/oa/object-action-envelope.ts";
import type { OaEncodedResponse } from "../modules/jugger-wire/commands/oa/oa-command.ts";

export class CraftDesk {
  constructor(
    private readonly craft: CraftService,
    private readonly characters: CharacterService,
    private readonly inventory: InventoryService,
    private readonly catalog: Catalog,
  ) {}

  async execute(
    key: string,
    accountId: number,
    envelope: ObjectActionEnvelope,
  ): Promise<OaEncodedResponse> {
    const hero = await this.characters.getByAccountId(accountId);
    if (!hero) throw new Error(`Hero for account ${accountId} is missing`);
    const fields = { ...(envelope.form ?? {}), ...(envelope.root ?? {}) };
    try {
      if (key === "craft|user_recipes_list") {
        return { kind: "nested", value: await this.craft.recipesList(hero.id) };
      }
      const recipeId = requireRecipeId(fields);
      if (key === "craft|recipe_add_favorite") {
        await this.craft.setFavorite(hero.id, recipeId, true);
        return this.favoriteBlocks(hero.id, key);
      }
      if (key === "craft|recipe_remove_favorite") {
        await this.craft.setFavorite(hero.id, recipeId, false);
        return this.favoriteBlocks(hero.id, key);
      }
      if (key !== "craft|craft_items") throw new Error(`Craft OA ${key} is not registered`);
      const crafted = await this.craft.craftItems(hero.id, recipeId);
      const created: Record<string, number> = {};
      for (const id of crafted.createdItemIds) created[String(id)] = id;
      const blocks: Record<string, object> = {
        "craft|craft_items": {
          status: 100,
          recipe_id: crafted.recipeId,
          create_artikul_id: String(crafted.createArtikulId),
          create_artikul_num: String(crafted.createArtikulNum),
          changed_artifacts: {},
          created_artifacts: created,
        },
        "craft|user_recipes_list": await this.craft.recipesList(hero.id),
        "user|bag": await buildUserBag(hero, this.inventory, this.catalog),
      };
      if (crafted.skillBumped) {
        const licenses = await this.characters.professionLicenses(hero.id);
        blocks["user|professions"] = userProfessionsWire(licenses, hero.level);
      }
      return { kind: "flat", blocks };
    } catch (error) {
      if (error instanceof ProfessionDeniedError || error instanceof GhostHeroError) {
        return { kind: "nested", value: { status: 2, error: error.message } };
      }
      throw error;
    }
  }

  private async favoriteBlocks(heroId: number, key: string): Promise<OaEncodedResponse> {
    const hero = await this.characters.getById(heroId);
    if (!hero) throw new Error(`Hero ${heroId} is missing`);
    return {
      kind: "flat",
      blocks: {
        [key]: { status: 100 },
        "craft|user_recipes_list": await this.craft.recipesList(hero.id),
        "user|bag": await buildUserBag(hero, this.inventory, this.catalog),
      },
    };
  }
}

function requireRecipeId(fields: Readonly<Record<string, unknown>>): number {
  const raw = fields.recipe_id;
  if (typeof raw !== "number" && typeof raw !== "string") {
    throw new ProfessionDeniedError("Нет такого рецепта");
  }
  const recipeId = Number(raw);
  if (!Number.isInteger(recipeId) || recipeId < 1) {
    throw new ProfessionDeniedError("Нет такого рецепта");
  }
  return recipeId;
}
