import { describe, expect, it } from "vitest";
import type { ProgressionSnapshot } from "../../../src/modules/catalog/domain/progression-snapshot.ts";
import type { CatalogProgression } from "../../../src/modules/catalog/ports/catalog-progression.ts";
import { ResourceService } from "../../../src/modules/character/application/resource-service.ts";
import { remainingHpSeconds } from "../../../src/modules/character/domain/hp-regen.ts";
import { MissingHpregError } from "../../../src/modules/character/domain/missing-hpreg-error.ts";
import type { Hero } from "../../../src/modules/character/domain/hero.ts";
import type { HeroSkill } from "../../../src/modules/character/domain/hero-skill.ts";
import type { ActiveFightQuery } from "../../../src/modules/character/ports/active-fight-query.ts";
import type { EquippedModifiers } from "../../../src/modules/character/ports/equipped-modifiers.ts";
import type { HeroRepository } from "../../../src/modules/character/ports/hero-repository.ts";
import type { HeroSkillRepository } from "../../../src/modules/character/ports/hero-skill-repository.ts";
import type { UnitOfWork } from "../../../src/shared/kernel/unit-of-work.ts";
import { FakeClock } from "../../support/fake-clock.ts";
import { PLAYABLE_REGEN_POLICY, testHero } from "../../support/hero-fixtures.ts";

const START_MS = 1_700_000_000_000;

describe("ResourceService", () => {
  it("does not write regen_at while the hero is in an active fight", async () => {
    const hero = woundedHero({ hp: 10, maxHp: 50, hpTime: 40 });
    const { service, saves } = resources(hero, { inFight: true });
    const result = await service.syncResources({ characterId: hero.id });
    expect(result).toMatchObject({ hp: 10, hpTime: 0, inActiveFight: true, persisted: false });
    expect(hero.hp).toBe(10);
    expect(hero.regenAt.getTime()).toBe(START_MS);
    expect(saves).toHaveLength(0);
  });

  it("does not move regen_at when elapsed is less than one HP", async () => {
    const hpTime = remainingHpSeconds(40, 100, PLAYABLE_REGEN_POLICY.k, 1);
    const hero = woundedHero({ hp: 10, maxHp: 50, hpTime, hpreg: 100 });
    const clock = new FakeClock(START_MS);
    const { service, saves } = resources(hero, { clock, hpreg: 100 });
    clock.advanceSeconds(1);
    const result = await service.syncResources({ characterId: hero.id });
    expect(result.hp).toBe(10);
    expect(result.hpTime).toBe(hpTime);
    expect(result.persisted).toBe(false);
    expect(hero.regenAt.getTime()).toBe(START_MS);
    expect(saves).toHaveLength(0);
  });

  it("clears leftover hp_time at full HP", async () => {
    const hero = woundedHero({ hp: 50, maxHp: 50, hpTime: 12 });
    const { service } = resources(hero);
    const result = await service.syncResources({ characterId: hero.id });
    expect(result).toMatchObject({ hp: 50, hpTime: 0, persisted: true });
    expect(hero.hpTime).toBe(0);
  });

  it("fails when HPREG is missing while wounded", async () => {
    const hero = woundedHero({ hp: 8, maxHp: 50, hpTime: 35, hpreg: 0 });
    const { service } = resources(hero, { hpreg: 0 });
    await expect(service.syncResources({ characterId: hero.id })).rejects.toBeInstanceOf(
      MissingHpregError,
    );
    expect(hero.hp).toBe(8);
  });

  it("updates hp_time from a HPREG gear change without an instant full heal", async () => {
    const hero = woundedHero({ hp: 8, maxHp: 50, hpTime: 35, hpreg: 300 });
    const { service } = resources(hero, { hpreg: 400 });
    await service.recomputeHpTimeAfterMutation(hero);
    expect(hero.hp).toBe(8);
    expect(hero.hpTime).toBe(remainingHpSeconds(42, 400, PLAYABLE_REGEN_POLICY.k, hero.id));
    expect(hero.regenAt.getTime()).toBe(START_MS);
  });

  it("does not regenerate HP while the hero is ghosted", async () => {
    const hero = woundedHero({ hp: 0, maxHp: 10, hpTime: 0 });
    hero.applyDefeat(Math.floor(START_MS / 1000) + 600, new Date(START_MS));
    const clock = new FakeClock(START_MS);
    const { service, saves } = resources(hero, { clock, hpreg: 700 });
    clock.advanceSeconds(3_600);
    const result = await service.syncResources({ characterId: hero.id });
    expect(result).toMatchObject({ hp: 0, hpTime: 0, persisted: false });
    expect(hero.hp).toBe(0);
    expect(saves).toHaveLength(0);
  });

  it("resurrects a ghost to max(2, floor(hpMax*0.05)) and clears injury", async () => {
    const hero = woundedHero({ hp: 0, maxHp: 10, hpTime: 0 });
    hero.applyDefeat(Math.floor(START_MS / 1000) + 600, new Date(START_MS));
    const { service } = resources(hero, { hpreg: 700 });
    const result = await service.resurrect({ characterId: hero.id });
    expect(result.hp).toBe(2);
    expect(hero.ghost).toBe(false);
    expect(hero.injuryTime).toBe(0);
    expect(hero.injuryArtikulId).toBe(0);
  });
  it("does not change hp_time or regen_at when equipment mutates during a fight", async () => {
    const hero = woundedHero({ hp: 8, maxHp: 50, hpTime: 35, hpreg: 300 });
    const { service } = resources(hero, { inFight: true, hpreg: 400 });
    await service.recomputeHpTimeAfterMutation(hero);
    expect(hero.hp).toBe(8);
    expect(hero.hpTime).toBe(35);
    expect(hero.regenAt.getTime()).toBe(START_MS);
  });
});

function woundedHero(input: { hp: number; maxHp: number; hpTime: number; hpreg?: number }): Hero {
  return testHero({
    hp: input.hp,
    maxHp: input.maxHp,
    hpTime: input.hpTime,
    regenAt: new Date(START_MS),
  });
}

function resources(
  hero: Hero,
  opts: { clock?: FakeClock; inFight?: boolean; hpreg?: number } = {},
) {
  const saves: Hero[] = [];
  const hpreg = opts.hpreg ?? 300;
  const clock = opts.clock ?? new FakeClock(START_MS);
  const service = new ResourceService(
    { run: (work) => work() } satisfies UnitOfWork,
    memoryHeroes(hero, saves),
    memorySkills(hpreg),
    fakeProgression(),
    { modifiersForHero: async () => [] } satisfies EquippedModifiers,
    clock,
    PLAYABLE_REGEN_POLICY,
    { isHeroInActiveFight: async () => Boolean(opts.inFight) } satisfies ActiveFightQuery,
  );
  return { service, saves, clock };
}

function memoryHeroes(hero: Hero, saves: Hero[]): HeroRepository {
  return {
    findById: async (id) => (id === hero.id ? hero : null),
    findByAccountId: async () => hero,
    listByAreaId: async (areaId) => (hero.areaId === areaId ? [hero] : []),
    lockByAccountId: async () => hero,
    lockById: async (id) => (id === hero.id ? hero : null),
    create: async () => {
      throw new Error("create is not used");
    },
    save: async (next) => {
      saves.push(next);
    },
  };
}

function memorySkills(hpreg: number): HeroSkillRepository {
  const skills: HeroSkill[] =
    hpreg > 0 ? [{ id: "HPREG", value: hpreg }] : [{ id: "ORATORY", value: 1 }];
  return {
    list: async () => skills,
    replace: async () => {
      throw new Error("replace is not used");
    },
  };
}

function fakeProgression(): CatalogProgression {
  return {
    progressionSnapshot: async () =>
      ({ contentReleaseId: "rel-1", progressionDigest: "d" }) as ProgressionSnapshot,
  };
}
