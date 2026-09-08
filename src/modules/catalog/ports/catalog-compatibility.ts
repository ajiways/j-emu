export type ArtifactSkillFingerprint = Readonly<{
  id: number;
  skills: readonly Readonly<{ id: string; value: number; flags: number }>[];
}>;

export type CatalogCompatibilitySnapshot = Readonly<{
  progressionDigest: string;
  artifacts: readonly ArtifactSkillFingerprint[];
}>;

export interface CatalogCompatibility {
  compatibilitySnapshot(releaseId: string): Promise<CatalogCompatibilitySnapshot>;
}
