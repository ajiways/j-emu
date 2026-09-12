import type { Catalog } from "../../catalog/ports/catalog.ts";
import type { Hero } from "../../character/domain/hero.ts";
import type { HuntHumanAppearance } from "../../combat/domain/hunt-human.ts";

export async function heroFightAppearance(
  catalog: Catalog,
  hero: Hero,
): Promise<HuntHumanAppearance> {
  const appearance = await catalog.appearance(hero.kind, hero.gender);
  return { avatar: appearance.avatarSmall, body: hero.body, sk: String(hero.sk) };
}
