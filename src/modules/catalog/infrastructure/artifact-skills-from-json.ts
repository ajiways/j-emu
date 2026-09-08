import { ArtifactSkillBonus } from "../domain/artifact-skill-bonus.ts";

export function artifactSkillsFromJson(
  artifactId: number,
  value: unknown,
): readonly ArtifactSkillBonus[] {
  if (!Array.isArray(value)) {
    throw new Error(`Artifact ${artifactId} skills must be an array`);
  }
  return value.map((entry, index) => skillFromJson(artifactId, entry, index));
}

function skillFromJson(artifactId: number, value: unknown, index: number): ArtifactSkillBonus {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Artifact ${artifactId} skill ${index} is invalid`);
  }
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || !row.id) {
    throw new Error(`Artifact ${artifactId} skill ${index} id is required`);
  }
  if (typeof row.value !== "number" || !Number.isInteger(row.value)) {
    throw new Error(`Artifact ${artifactId} skill ${row.id} value is invalid`);
  }
  if (typeof row.flags !== "number" || !Number.isInteger(row.flags) || row.flags < 0) {
    throw new Error(`Artifact ${artifactId} skill ${row.id} flags are invalid`);
  }
  return new ArtifactSkillBonus(row.id, row.value, row.flags);
}
