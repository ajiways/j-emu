export type HuntBotSnapshot = Readonly<{
  id: number;
  artikulId: number;
  fightId: number;
  huntMask: string;
  positionX: number;
  positionY: number;
  prevX: number;
  prevY: number;
}>;
