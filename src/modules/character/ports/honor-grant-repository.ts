import type { HonorGrantResult } from "../domain/honor-grant-result.ts";

export type PersistedHonorGrant = HonorGrantResult &
  Readonly<{
    heroId: number;
    operationId: string;
    amount: number;
  }>;

export interface HonorGrantRepository {
  find(heroId: number, operationId: string): Promise<PersistedHonorGrant | null>;
  insert(grant: PersistedHonorGrant): Promise<void>;
}
