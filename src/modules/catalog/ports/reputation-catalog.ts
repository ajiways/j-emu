import type { ReputationTrack } from "../domain/reputation-track.ts";

export interface ReputationCatalog {
  reputationTrack(objectId: number): Promise<ReputationTrack | null>;
  reputationTracks(): Promise<readonly ReputationTrack[]>;
}
