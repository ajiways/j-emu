export type PartyRecord = Readonly<{
  id: number;
  leaderHeroId: number;
  lootRules: string;
  noChat: number;
  flags: number;
  isSearch: number;
  password: string;
  instanceArtikulId: string;
  botArtikulId: string;
  type: string;
  distributeReadyAt: number;
  createdAt: Date;
}>;

export type PartyMemberRow = Readonly<{
  partyId: number;
  heroId: number;
  accountId: number;
  joinedAt: Date;
}>;

export type PartyInviteRow = Readonly<{
  partyId: number;
  targetHeroId: number;
  fromHeroId: number;
  createdAt: Date;
}>;

export type PartyMembership = Readonly<{
  party: PartyRecord;
  member: PartyMemberRow;
}>;

export type NewParty = Omit<PartyRecord, "id">;
