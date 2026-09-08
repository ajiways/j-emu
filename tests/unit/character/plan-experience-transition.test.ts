import path from "node:path";
import { describe, expect, it } from "vitest";
import { LevelBoundary } from "../../../src/modules/catalog/domain/level-boundary.ts";
import { ProgressionSnapshot } from "../../../src/modules/catalog/domain/progression-snapshot.ts";
import { CharacterProgressionStateError } from "../../../src/modules/character/domain/character-progression-state-error.ts";
import { InvalidExperienceGrantError } from "../../../src/modules/character/domain/invalid-experience-grant-error.ts";
import { planExperienceTransition } from "../../../src/modules/character/domain/plan-experience-transition.ts";
import { ProgressionLimitError } from "../../../src/modules/character/domain/progression-limit-error.ts";
import { parseExperienceGrantCommand } from "../../../src/modules/character/domain/parse-experience-grant-command.ts";
import { progressionDigestFromLevels } from "../../../src/modules/content/domain/progression-curve.ts";
import { loadContentBundleFile } from "../../../src/modules/content/infrastructure/load-content-bundle-file.ts";
import type { HeroSkill } from "../../../src/modules/character/domain/hero-skill.ts";

const playable = loadContentBundleFile(path.resolve(process.cwd(), "content/playable-slice.json"));

const snapshot = new ProgressionSnapshot(
  "00000000-0000-4000-8000-000000000001",
  progressionDigestFromLevels(playable.levels),
  playable.levels.map((level) => ({
    boundary: new LevelBoundary(
      level.level,
      level.expMin,
      level.expMax,
      level.bagCnt,
      level.honorRank,
      level.honorMin,
      level.honorMax,
      level.honorStatus,
    ),
    managedSkills: level.managedSkills.map((skill) => ({
      id: skill.id,
      value: skill.value,
      evidenceKind: level.evidenceKind,
      sourceDigest: "a".repeat(64),
    })),
  })),
);

const l1Skills: readonly HeroSkill[] = [
  { id: "HPREG", value: 700 },
  { id: "ORATORY", value: 1 },
  { id: "STR", value: 12 },
  { id: "RAG", value: 8 },
  { id: "DEX", value: 8 },
  { id: "DEF", value: 8 },
  { id: "VIT", value: 10 },
  { id: "MPMAX", value: 12 },
  { id: "MONEYMOD", value: 0 },
];

describe("parseExperienceGrantCommand", () => {
  it("rejects malformed keys, non-positive amounts and overflow", () => {
    expect(() =>
      parseExperienceGrantCommand({ characterId: 0, operationId: "fight:1", amount: 1 }),
    ).toThrow(InvalidExperienceGrantError);
    expect(() =>
      parseExperienceGrantCommand({ characterId: 1, operationId: "1:bad", amount: 1 }),
    ).toThrow(InvalidExperienceGrantError);
    expect(() =>
      parseExperienceGrantCommand({ characterId: 1, operationId: "fight:1", amount: 0 }),
    ).toThrow(InvalidExperienceGrantError);
  });
});

describe("planExperienceTransition", () => {
  it("keeps level for a no-level grant and jumps multiple levels in one step", () => {
    const noLevel = planExperienceTransition({
      exp: 1,
      level: 1,
      skills: l1Skills,
      snapshot,
      amount: 10,
    });
    expect(noLevel).toMatchObject({ expAfter: 11, levelAfter: 1 });
    expect(noLevel.nextManaged.find((skill) => skill.id === "VIT")?.value).toBe(10);
    expect(noLevel.miscSkills.find((skill) => skill.id === "HPREG")?.value).toBe(700);

    const boundary = planExperienceTransition({
      exp: 1,
      level: 1,
      skills: l1Skills,
      snapshot,
      amount: 67,
    });
    expect(boundary).toMatchObject({ expAfter: 68, levelAfter: 2 });

    const multi = planExperienceTransition({
      exp: 1,
      level: 1,
      skills: l1Skills,
      snapshot,
      amount: 472,
    });
    expect(multi).toMatchObject({ expAfter: 473, levelAfter: 4 });
    expect(multi.nextManaged.find((skill) => skill.id === "VIT")?.value).toBe(13);
    expect(multi.nextManaged.find((skill) => skill.id === "STR")?.value).toBe(16);
  });

  it("rejects out-of-curve EXP, overflow and inconsistent stored skills", () => {
    expect(() =>
      planExperienceTransition({
        exp: 1,
        level: 1,
        skills: l1Skills,
        snapshot,
        amount: 23872,
      }),
    ).toThrow(ProgressionLimitError);
    expect(() =>
      planExperienceTransition({
        exp: 1,
        level: 1,
        skills: l1Skills,
        snapshot,
        amount: 2_147_483_647,
      }),
    ).toThrow(InvalidExperienceGrantError);
    expect(() =>
      planExperienceTransition({
        exp: 1,
        level: 1,
        skills: l1Skills.map((skill) => (skill.id === "STR" ? { ...skill, value: 99 } : skill)),
        snapshot,
        amount: 1,
      }),
    ).toThrow(CharacterProgressionStateError);
  });
});
