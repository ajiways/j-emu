import type { ArtifactSkillBonus } from "../../catalog/domain/artifact-skill-bonus.ts";

export interface EquippedModifiers {
  modifiersForHero(characterId: number, releaseId: string): Promise<readonly ArtifactSkillBonus[]>;
}
