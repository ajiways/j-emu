import type { ExperienceGrantCommand } from "../domain/experience-grant-command.ts";
import type { ExperienceGrantResult } from "../domain/experience-grant-result.ts";

export interface CharacterProgression {
  grantExperience(command: ExperienceGrantCommand): Promise<ExperienceGrantResult>;
}
