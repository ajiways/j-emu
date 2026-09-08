export type ExperienceGrantResult = Readonly<{
  expBefore: number;
  expAfter: number;
  levelBefore: number;
  levelAfter: number;
  levelsGained: number;
  contentReleaseId: string;
  progressionDigest: string;
}>;
