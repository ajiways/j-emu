export type PresenceHero = Readonly<{
  accountId: number;
  nick: string;
  level: number;
  kind: number;
  gender: number;
  body: string;
  sk: number;
  areaId: string;
}>;

export interface CharacterPresence {
  listInArea(areaId: string): Promise<readonly PresenceHero[]>;
  requirePresence(accountId: number): Promise<PresenceHero>;
}
