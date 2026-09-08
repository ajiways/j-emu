import { digestCanonical } from "./canonical-digest.ts";

export type ProgressionDigestLevel = Readonly<{
  level: number;
  expMin: number;
  expMax: number;
  bagCnt: number;
  skills: readonly Readonly<{ id: string; value: number }>[];
}>;

export function computeProgressionDigest(levels: readonly ProgressionDigestLevel[]): string {
  const ordered = [...levels]
    .map((level) => ({
      bagCnt: level.bagCnt,
      expMax: level.expMax,
      expMin: level.expMin,
      level: level.level,
      skills: [...level.skills]
        .map((skill) => ({ id: skill.id, value: skill.value }))
        .sort((left, right) => left.id.localeCompare(right.id)),
    }))
    .sort((left, right) => left.level - right.level);
  return digestCanonical(ordered);
}
