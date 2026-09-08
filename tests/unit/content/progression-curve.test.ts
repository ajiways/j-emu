import path from "node:path";
import { describe, expect, it } from "vitest";
import { ContentValidator } from "../../../src/modules/content/application/content-validator.ts";
import type { ContentBundle } from "../../../src/modules/content/domain/content-document.ts";
import { progressionDigestFromLevels } from "../../../src/modules/content/domain/progression-curve.ts";
import { loadContentBundleFile } from "../../../src/modules/content/infrastructure/load-content-bundle-file.ts";

const playable = loadContentBundleFile(path.resolve(process.cwd(), "content/playable-slice.json"));

const CORE_CURVE = [
  { level: 1, expMin: 0, expMax: 68, STR: 12, RAG: 8, DEX: 8, DEF: 8, VIT: 10, MPMAX: 12 },
  { level: 2, expMin: 68, expMax: 203, STR: 13, RAG: 9, DEX: 9, DEF: 9, VIT: 11, MPMAX: 13 },
  { level: 3, expMin: 203, expMax: 473, STR: 14, RAG: 10, DEX: 10, DEF: 10, VIT: 12, MPMAX: 14 },
  { level: 4, expMin: 473, expMax: 1013, STR: 16, RAG: 11, DEX: 11, DEF: 11, VIT: 13, MPMAX: 16 },
  { level: 5, expMin: 1013, expMax: 1823, STR: 17, RAG: 12, DEX: 12, DEF: 12, VIT: 14, MPMAX: 17 },
  { level: 6, expMin: 1823, expMax: 3623, STR: 19, RAG: 13, DEX: 13, DEF: 13, VIT: 16, MPMAX: 19 },
  { level: 7, expMin: 3623, expMax: 10373, STR: 20, RAG: 14, DEX: 14, DEF: 14, VIT: 17, MPMAX: 20 },
  {
    level: 8,
    expMin: 10373,
    expMax: 23873,
    STR: 21,
    RAG: 15,
    DEX: 15,
    DEF: 15,
    VIT: 18,
    MPMAX: 21,
  },
] as const;

describe("DATA-01 progression content", () => {
  it("freezes the CHARACTER.md L1-L8 managed values", () => {
    expect(playable.levels).toHaveLength(8);
    for (const expected of CORE_CURVE) {
      const row = playable.levels.find((level) => level.level === expected.level);
      if (!row) throw new Error(`Missing level ${expected.level}`);
      expect(row.expMin).toBe(expected.expMin);
      expect(row.expMax).toBe(expected.expMax);
      expect(row.bagCnt).toBe(2);
      expect(skillValue(row, "STR")).toBe(expected.STR);
      expect(skillValue(row, "RAG")).toBe(expected.RAG);
      expect(skillValue(row, "DEX")).toBe(expected.DEX);
      expect(skillValue(row, "DEF")).toBe(expected.DEF);
      expect(skillValue(row, "VIT")).toBe(expected.VIT);
      expect(skillValue(row, "MPMAX")).toBe(expected.MPMAX);
      expect(row.evidenceKind).toBe(expected.level <= 6 ? "confirmed" : "legacy_extrapolated");
    }
    expect(progressionDigestFromLevels(playable.levels)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rejects a gapped curve", () => {
    const bundle: ContentBundle = {
      ...playable,
      levels: playable.levels.filter((level) => level.level !== 3),
    };
    expect(() => new ContentValidator().validate(bundle)).toThrow(/contiguous/);
  });

  it("rejects an unknown managed skill", () => {
    const bundle: ContentBundle = {
      ...playable,
      levels: playable.levels.map((level) =>
        level.level === 1
          ? {
              ...level,
              managedSkills: [...level.managedSkills, { id: "NOPE", value: 1 }],
            }
          : level,
      ),
    };
    expect(() => new ContentValidator().validate(bundle)).toThrow(/unknown managed skill NOPE/);
  });
});

function skillValue(
  level: (typeof playable.levels)[number],
  id: "STR" | "RAG" | "DEX" | "DEF" | "VIT" | "MPMAX",
): number {
  const skill = level.managedSkills.find((entry) => entry.id === id);
  if (!skill) throw new Error(`Missing ${id} on level ${level.level}`);
  return skill.value;
}
