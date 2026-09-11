export type AreaFarmDefinition = Readonly<{
  areaId: string;
  huntSpotId: number;
  farmId: number;
  tactics: number;
  assistantMax: number;
  cntMax: number;
  cntCooldown: number;
}>;
