export type ProfessionDocument = Readonly<{
  id: number;
  title: string;
  type: 1 | 2;
  skillId: string;
  picture: string;
  position: number;
  skillStepOverride: number | null;
  skillMinlvlOverride: number | null;
  description: string;
  infoUrl: string;
  userStatId: number | null;
}>;
