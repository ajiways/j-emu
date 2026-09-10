export type PresenceHero = Readonly<{
  accountId: number;
  nick: string;
  level: number;
  kind: number;
  gender: number;
  body: string;
  sk: number;
  areaId: string;
  instanceCopyId: number | null;
  ghost: boolean;
  injuryTime: number;
  injuryArtikulId: number;
}>;

export interface CharacterPresence {
  listInArea(areaId: string, instanceCopyId: number | null): Promise<readonly PresenceHero[]>;
  listInCopy(copyId: number): Promise<readonly PresenceHero[]>;
  requirePresence(accountId: number): Promise<PresenceHero>;
}
