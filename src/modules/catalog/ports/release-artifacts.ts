import type { ArtifactDefinition } from "../domain/artifact-definition.ts";

export interface ReleaseArtifacts {
  definitionsFor(
    releaseId: string,
    artifactIds: readonly number[],
  ): Promise<readonly ArtifactDefinition[]>;
}
