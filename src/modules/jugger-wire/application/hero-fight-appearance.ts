import type { Catalog } from "../../catalog/ports/catalog.ts";
import type { Hero } from "../../character/domain/hero.ts";
import type { FighterAppearance } from "../../combat/domain/human-fighter.ts";
import type { FightConfHeroLook } from "./fight-wire-mapper.ts";

export function heroFightConfLook(hero: Hero): FightConfHeroLook {
  if (!hero.body) throw new Error("Hero body is required");
  return { heroSkill: hero.sk, heroBody: hero.body };
}

export async function heroFightAppearance(
  catalog: Catalog,
  hero: Hero,
): Promise<FighterAppearance> {
  const appearance = await catalog.appearance(hero.kind, hero.gender);
  return { avatar: appearance.avatarSmall, body: hero.body, sk: String(hero.sk) };
}
