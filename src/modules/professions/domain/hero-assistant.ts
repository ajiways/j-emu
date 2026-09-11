export type HeroAssistant = Readonly<{
  id: number;
  heroId: number;
  artikulId: number;
  nick: string;
  skillSpeed: number;
  skillDefence: number;
  skillIntellect: number;
  tactics: number;
  farmId: number;
  areaId: string;
  ftime: number;
  stime: number;
  attackAt: number;
  stamina: number;
  staminaResetTime: number;
  masteryValue: number;
  resultType: number;
  resultValue: string;
  flags: number;
  cycleResult: string;
  lootGranted: boolean;
}>;

export type HeroAssistantInsert = Omit<HeroAssistant, "id">;

export type FarmStock = Readonly<{
  areaId: string;
  huntSpotId: number;
  farmId: number;
  cntCurrent: number;
  lastRespawnTime: number;
  nextRespawnTime: number;
}>;

export type HeroFarmStat = Readonly<{
  farmId: number;
  value: number;
}>;
