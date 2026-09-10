import type {
  NewParty,
  PartyInviteRow,
  PartyMemberRow,
  PartyMembership,
  PartyRecord,
} from "../domain/party-record.ts";

export interface PartyRepository {
  insertParty(row: NewParty): Promise<PartyRecord>;
  lockParty(partyId: number): Promise<PartyRecord | null>;
  getParty(partyId: number): Promise<PartyRecord | null>;
  saveParty(party: PartyRecord): Promise<void>;
  deleteParty(partyId: number): Promise<void>;
  insertMember(row: Omit<PartyMemberRow, "joinedAt"> & { joinedAt: Date }): Promise<void>;
  membershipByHero(heroId: number): Promise<PartyMembership | null>;
  listMembers(partyId: number): Promise<readonly PartyMemberRow[]>;
  deleteMember(partyId: number, heroId: number): Promise<void>;
  deleteMembers(partyId: number): Promise<void>;
  replaceInvite(row: Omit<PartyInviteRow, "createdAt"> & { createdAt: Date }): Promise<void>;
  findInvite(partyId: number, targetHeroId: number): Promise<PartyInviteRow | null>;
  deleteInvite(partyId: number, targetHeroId: number): Promise<void>;
  deleteInvites(partyId: number): Promise<void>;
  listSearchable(): Promise<readonly PartyRecord[]>;
}
