import type { ExperienceGrantResult } from "../domain/experience-grant-result.ts";

export type PersistedExperienceGrant = ExperienceGrantResult &
  Readonly<{
    heroId: number;
    operationId: string;
    amount: number;
  }>;

export interface ExperienceGrantRepository {
  find(heroId: number, operationId: string): Promise<PersistedExperienceGrant | null>;
  insert(grant: PersistedExperienceGrant): Promise<void>;
}
