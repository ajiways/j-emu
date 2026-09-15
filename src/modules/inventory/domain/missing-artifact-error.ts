export class MissingArtifactError extends Error {
  constructor(readonly artifactId: number) {
    super(`Artifact catalog entry ${artifactId} is missing`);
    this.name = "MissingArtifactError";
  }
}
