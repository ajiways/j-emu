import { describe, expect, it } from "vitest";
import { grantHeroProfession } from "../../../src/modules/character/application/grant-hero-profession.ts";
import { GhostHeroError } from "../../../src/modules/character/domain/ghost-hero-error.ts";
import { UnknownProfessionError } from "../../../src/modules/character/domain/unknown-profession-error.ts";
import type { ProfessionCatalog } from "../../../src/modules/catalog/ports/profession-catalog.ts";
import type { ProfessionDefinition } from "../../../src/modules/catalog/domain/profession-definition.ts";
import type { Hero } from "../../../src/modules/character/domain/hero.ts";
import type { HeroRepository } from "../../../src/modules/character/ports/hero-repository.ts";
import type {
  HeroProfessionRepository,
  HeroProfessionValue,
} from "../../../src/modules/character/ports/hero-profession-repository.ts";
import { testHero } from "../../support/hero-fixtures.ts";

const GATHER: ProfessionDefinition = {
  id: 2,
  title: "Cтаратель",
  type: 2,
  skillId: "PR_GEOLOGY",
  picture: "geology.png",
  position: 2,
  skillStepOverride: null,
  skillMinlvlOverride: null,
  description: "gather",
  infoUrl: "/info/2",
  userStatId: null,
};

describe("grantHeroProfession", () => {
  it("inserts a license at value 1 and no-ops a second grant", async () => {
    const licenses = fakeLicenses();
    const first = await grantHeroProfession(
      fakeHeroes(testHero()),
      licenses,
      fakeCatalog([GATHER]),
      {
        characterId: 1,
        professionId: 2,
      },
    );
    expect(first).toEqual({ professionId: 2, value: 1, learned: true });
    const second = await grantHeroProfession(
      fakeHeroes(testHero()),
      licenses,
      fakeCatalog([GATHER]),
      { characterId: 1, professionId: 2 },
    );
    expect(second).toEqual({ professionId: 2, value: 1, learned: false });
  });

  it("rejects an unpublished profession", async () => {
    await expect(
      grantHeroProfession(fakeHeroes(testHero()), fakeLicenses(), fakeCatalog([GATHER]), {
        characterId: 1,
        professionId: 10,
      }),
    ).rejects.toBeInstanceOf(UnknownProfessionError);
  });

  it("rejects a ghost hero", async () => {
    await expect(
      grantHeroProfession(
        fakeHeroes(testHero({ ghost: true, injuryArtikulId: 875, injuryTime: 1 })),
        fakeLicenses(),
        fakeCatalog([GATHER]),
        { characterId: 1, professionId: 2 },
      ),
    ).rejects.toBeInstanceOf(GhostHeroError);
  });
});

function fakeHeroes(hero: Hero): HeroRepository {
  return {
    findById: async () => hero,
    findByAccountId: async () => hero,
    findByNick: async (nick: string) =>
      hero.nick.toLowerCase() === nick.trim().toLowerCase() ? hero : null,
    listByAreaShard: async () => [hero],
    listByInstanceCopyId: async (copyId: number) => (hero.instanceCopyId === copyId ? [hero] : []),
    lockByAccountId: async () => hero,
    lockById: async (id: number) => (id === hero.id ? hero : null),
    create: async () => hero,
    save: async () => undefined,
  };
}

function fakeLicenses(initial: readonly HeroProfessionValue[] = []): HeroProfessionRepository {
  const rows = [...initial];
  return {
    listByHeroId: async () => [...rows],
    insertLicense: async (_heroId, professionId, value) => {
      rows.push({ professionId, value });
    },
  };
}

function fakeCatalog(rows: readonly ProfessionDefinition[]): ProfessionCatalog {
  return {
    profession: async (id) => rows.find((row) => row.id === id) ?? null,
    professions: async () => rows,
  };
}
