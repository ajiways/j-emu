import {
  honorProgress,
  honorRankCatalogFromConf,
  honorRankTitle,
} from "../../catalog/domain/honor-progress.ts";
import type { Catalog } from "../../catalog/ports/catalog.ts";
import type { Hero } from "../../character/domain/hero.ts";
import type { WearHero } from "../../inventory/domain/wear-paperdoll.ts";

/** The hero as the inventory judges a wear: level, gender and the honor rank held now. */
export async function wearHeroOf(catalog: Catalog, hero: Hero): Promise<WearHero> {
  const ranks = honorRankCatalogFromConf(await catalog.commonConf());
  return {
    id: hero.id,
    level: hero.level,
    gender: hero.gender,
    rank: honorProgress(ranks, hero.honor, hero.level).rank,
    rankTitle: (rank) => honorRankTitle(ranks, rank),
  };
}
