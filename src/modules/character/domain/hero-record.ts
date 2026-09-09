type StarterSkill = Readonly<{ id: string; value: number }>;

export type HeroCreationPolicy = Readonly<{
  exp: number;
  areaId: string;
  moneyMinor: number;
  moneyGoldMinor: number;
  kind: number;
  gender: number;
  language: string;
  body: string;
  sk: number;
  honor: number;
  tutorialInfo: Readonly<{
    finished_first_fight: string;
    tutorial2: string;
  }>;
  skills: readonly StarterSkill[];
}>;

export type HeroRecord = Readonly<{
  id: number;
  accountId: number;
  nick: string;
  level: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  exp: number;
  areaId: string;
  moneyMinor: number;
  moneyGoldMinor: number;
  kind: number;
  gender: number;
  language: string;
  body: string;
  sk: number;
  honor: number;
  hpTime: number;
  regenAt: Date;
  moveReadyAt: Date | null;
  ghost: boolean;
  injuryTime: number;
  injuryArtikulId: number;
}>;

export type NewHero = Omit<HeroRecord, "id">;
