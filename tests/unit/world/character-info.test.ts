import { describe, expect, it } from "vitest";
import {
  areaPopulationBlock,
  buildCharacterInfo,
  populationDiff,
} from "../../../src/modules/world/domain/character-info.ts";

const hero = {
  accountId: 7,
  nick: "Player8",
  level: 1,
  kind: 1,
  body: "armor();head(0,0,8,152);skin()",
  sk: 1,
  ghost: false,
  injuryTime: 0,
  injuryArtikulId: 0,
  instanceCopyId: null as number | null,
};

describe("CharacterInfo", () => {
  it("puts the live copy id on character-info and zero in the world", () => {
    expect(
      buildCharacterInfo({ ...hero, instanceCopyId: 12 }, "avatar_m_set_0_gray.png").instance_id,
    ).toBe(12);
    expect(buildCharacterInfo(hero, "avatar_m_set_0_gray.png").instance_id).toBe(0);
  });

  it("uses accountId and keeps ghost/injury zeros on the wire", () => {
    expect(buildCharacterInfo(hero, "avatar_m_set_0_gray.png")).toEqual({
      id: 7,
      nick: "Player8",
      level: 1,
      kind: 1,
      instance_id: 0,
      dead: 0,
      injury_time: 0,
      injury_artikul_id: 0,
      body: hero.body,
      sk: 1,
      avatar_small: "avatar_m_set_0_gray.png",
    });
  });

  it("fails when a ghost is missing injury fields", () => {
    expect(() =>
      buildCharacterInfo(
        { ...hero, ghost: true, injuryTime: 0, injuryArtikulId: 875 },
        "avatar_m_set_0_gray.png",
      ),
    ).toThrow(/missing injury_time/);
    expect(() =>
      buildCharacterInfo(
        { ...hero, ghost: true, injuryTime: 1_700_000_600, injuryArtikulId: 0 },
        "avatar_m_set_0_gray.png",
      ),
    ).toThrow(/missing injury_artikul_id/);
  });

  it("sets dead:4 and injury fields when ghosted", () => {
    expect(
      buildCharacterInfo(
        { ...hero, ghost: true, injuryTime: 1_700_000_600, injuryArtikulId: 875 },
        "avatar_m_set_0_gray.png",
      ),
    ).toMatchObject({
      dead: 4,
      injury_time: 1_700_000_600,
      injury_artikul_id: 875,
    });
  });

  it("fails when appearance avatar_small is missing", () => {
    expect(() => buildCharacterInfo(hero, "")).toThrow(/avatar_small/);
  });

  it("wraps a full roster without inventing empty chrome", () => {
    const info = buildCharacterInfo(hero, "avatar_m_set_0_gray.png");
    expect(areaPopulationBlock([info])).toEqual({ status: 100, population: [info] });
  });

  it("encodes add infos and remove nicks", () => {
    const info = buildCharacterInfo(hero, "avatar_m_set_0_gray.png");
    expect(populationDiff({ add: [info] })).toEqual({
      "chat|area_population_diff": { status: 100, add: [info] },
    });
    expect(populationDiff({ remove: [hero.nick] })).toEqual({
      "chat|area_population_diff": { status: 100, remove: ["Player8"] },
    });
    expect(populationDiff({ add: [info], remove: ["Other"] })).toEqual({
      "chat|area_population_diff": { status: 100, add: [info], remove: ["Other"] },
    });
  });

  it("rejects a diff with neither add nor remove", () => {
    expect(() => populationDiff({})).toThrow(/add or remove/);
    expect(() => populationDiff({ add: [], remove: [] })).toThrow(/add or remove/);
  });
});
