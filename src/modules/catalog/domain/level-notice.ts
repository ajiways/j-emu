export type LevelNotice = Readonly<{
  level: number;
  headline: string;
  body: string;
  achievementImage?: string;
  artikulIds: readonly number[];
}>;
