import type { ArtifactSkillBonus } from "./artifact-skill-bonus.ts";

export class ArtifactDefinition {
  constructor(
    readonly id: number,
    readonly title: string,
    readonly picture: string,
    readonly typeId: string,
    readonly kindId: number,
    readonly slotMask: number,
    readonly weight: number,
    readonly levelMin: number,
    readonly levelMax: number,
    readonly gender: number,
    readonly priceMinor: number,
    readonly flags: number,
    readonly bagStack: number,
    readonly skills: readonly ArtifactSkillBonus[],
  ) {
    if (!Number.isInteger(id) || id <= 0) throw new Error("Invalid artifact id");
    if (!title) throw new Error(`Artifact ${id} title is required`);
    if (!picture) throw new Error(`Artifact ${id} picture is required`);
    if (!typeId) throw new Error(`Artifact ${id} typeId is required`);
    if (!Number.isInteger(kindId) || kindId < 0) {
      throw new Error(`Artifact ${id} kindId is invalid`);
    }
    if (!Number.isInteger(slotMask) || slotMask < 0) {
      throw new Error(`Artifact ${id} slotMask is invalid`);
    }
    if (!Number.isInteger(weight) || weight < 0) {
      throw new Error(`Artifact ${id} weight is invalid`);
    }
    if (!Number.isInteger(levelMin) || levelMin < 0) {
      throw new Error(`Artifact ${id} levelMin is invalid`);
    }
    if (!Number.isInteger(levelMax) || levelMax < 0) {
      throw new Error(`Artifact ${id} levelMax is invalid`);
    }
    if (levelMax > 0 && levelMax < levelMin) {
      throw new Error(`Artifact ${id} levelMax is below levelMin`);
    }
    if (!Number.isInteger(gender) || gender < 0) {
      throw new Error(`Artifact ${id} gender is invalid`);
    }
    if (!Number.isInteger(priceMinor) || priceMinor < 0) {
      throw new Error(`Artifact ${id} priceMinor is invalid`);
    }
    if (!Number.isInteger(flags) || flags < 0) {
      throw new Error(`Artifact ${id} flags are invalid`);
    }
    if (!Number.isInteger(bagStack) || bagStack < 1) {
      throw new Error(`Artifact ${id} bagStack is invalid`);
    }
    const ids = new Set<string>();
    for (const skill of skills) {
      if (ids.has(skill.id)) throw new Error(`Artifact ${id} has duplicate skill ${skill.id}`);
      ids.add(skill.id);
    }
  }
}
