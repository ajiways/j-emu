import { describe, expect, it } from "vitest";
import { grantHeroReputation } from "../../../src/modules/character/application/grant-hero-reputation.ts";
import { GhostHeroError } from "../../../src/modules/character/domain/ghost-hero-error.ts";
import { SumReputationGrantError } from "../../../src/modules/character/domain/sum-reputation-grant-error.ts";
import { UnknownReputationTrackError } from "../../../src/modules/character/domain/unknown-reputation-track-error.ts";
import type { ReputationCatalog } from "../../../src/modules/catalog/ports/reputation-catalog.ts";
import type { ReputationTrack } from "../../../src/modules/catalog/domain/reputation-track.ts";
import type { Hero } from "../../../src/modules/character/domain/hero.ts";
import type { HeroRepository } from "../../../src/modules/character/ports/hero-repository.ts";
import type {
  HeroReputationRepository,
  HeroReputationValue,
} from "../../../src/modules/character/ports/hero-reputation-repository.ts";
import { testHero } from "../../support/hero-fixtures.ts";

const RADVEY: ReputationTrack = {
  objectId: 5,
  type: 2,
  title: "Репутация Радвея",
  image: "rep_radvey_sm.png",
  unlockFlag: "",
};

describe("grantHeroReputation", () => {
  it("grants track 5 and returns the derived SUM", async () => {
    const result = await grantHeroReputation(
      fakeHeroes(testHero()),
      fakeReputations(),
      fakeCatalog([RADVEY]),
      { characterId: 1, objectId: 5, amount: 10, cap: 0 },
    );
    expect(result).toEqual({ objectId: 5, value: 10, total: 10 });
  });

  it("rejects a grant targeting derived SUM 36", async () => {
    await expect(
      grantHeroReputation(fakeHeroes(testHero()), fakeReputations(), fakeCatalog([RADVEY]), {
        characterId: 1,
        objectId: 36,
        amount: 10,
        cap: 0,
      }),
    ).rejects.toBeInstanceOf(SumReputationGrantError);
  });

  it("rejects an unknown published track instead of adding 0", async () => {
    await expect(
      grantHeroReputation(fakeHeroes(testHero()), fakeReputations(), fakeCatalog([RADVEY]), {
        characterId: 1,
        objectId: 7,
        amount: 10,
        cap: 0,
      }),
    ).rejects.toBeInstanceOf(UnknownReputationTrackError);
  });

  it("rejects a ghost hero", async () => {
    await expect(
      grantHeroReputation(
        fakeHeroes(testHero({ ghost: true, injuryArtikulId: 875, injuryTime: 1 })),
        fakeReputations(),
        fakeCatalog([RADVEY]),
        { characterId: 1, objectId: 5, amount: 10, cap: 0 },
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
    listByAreaId: async () => [hero],
    lockByAccountId: async () => hero,
    lockById: async (id: number) => (id === hero.id ? hero : null),
    create: async () => hero,
    save: async () => undefined,
  };
}

function fakeReputations(initial: readonly HeroReputationValue[] = []): HeroReputationRepository {
  const rows = [...initial];
  return {
    listByHeroId: async () => [...rows],
    upsert: async (_heroId, objectId, value) => {
      const index = rows.findIndex((row) => row.objectId === objectId);
      if (index >= 0) rows[index] = { objectId, value };
      else rows.push({ objectId, value });
    },
  };
}

function fakeCatalog(tracks: readonly ReputationTrack[]): ReputationCatalog {
  return {
    reputationTrack: async (objectId) =>
      tracks.find((track) => track.objectId === objectId) ?? null,
    reputationTracks: async () => tracks,
  };
}
