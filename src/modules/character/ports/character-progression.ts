import type { ExperienceGrantCommand } from "../domain/experience-grant-command.ts";
import type { ExperienceGrantResult } from "../domain/experience-grant-result.ts";
import type { HonorGrantCommand } from "../domain/honor-grant-command.ts";
import type { HonorGrantResult } from "../domain/honor-grant-result.ts";

export interface CharacterProgression {
  grantExperience(command: ExperienceGrantCommand): Promise<ExperienceGrantResult>;
  grantHonor(command: HonorGrantCommand): Promise<HonorGrantResult>;
}
