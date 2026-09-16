import type { Catalog } from "../../catalog/ports/catalog.ts";
import type { CharacterService } from "../../character/application/character-service.ts";
import { composeHeroBody, parseFBodyTokens } from "../../character/domain/hero-body.ts";
import type { Hero } from "../../character/domain/hero.ts";
import type { InventoryService } from "../../inventory/domain/inventory-service.ts";

export async function syncWornBody(
  characters: CharacterService,
  inventory: InventoryService,
  catalog: Catalog,
  hero: Hero,
): Promise<Hero> {
  const tokens: string[] = [];
  for (const item of await inventory.list(hero.id)) {
    if (item.location.kind !== "equipment" && item.location.kind !== "tempeffect") continue;
    const definition = await catalog.artifact(item.artifactId);
    if (!definition) {
      throw new Error(`Artifact catalog entry ${item.artifactId} is missing`);
    }
    tokens.push(...parseFBodyTokens(definition.fBody));
  }
  const body = composeHeroBody(hero.body, tokens);
  if (body === hero.body) return hero;
  hero.applyBody(body);
  await characters.save(hero);
  return hero;
}
