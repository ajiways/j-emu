import type { WearHero } from "../../src/modules/inventory/domain/wear-paperdoll.ts";

type Wearer = Readonly<{ id: number; level: number; gender: number }>;

/** A hero for a wear: his rank is given, 0 if the test is not about ranks. */
export function testWearHero(hero: Wearer, rank = 0): WearHero {
  return {
    id: hero.id,
    level: hero.level,
    gender: hero.gender,
    rank,
    rankTitle: (wanted) => `Звание ${wanted}`,
  };
}
