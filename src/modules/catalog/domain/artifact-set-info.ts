export type SetBonusThreshold = Readonly<{ count: number; artikulId: number }>;

export type ArtifactSetInfo = Readonly<{
  setId: number;
  title: string;
  thresholds: readonly SetBonusThreshold[];
  avatarMan: string;
  avatarWoman: string;
}>;
