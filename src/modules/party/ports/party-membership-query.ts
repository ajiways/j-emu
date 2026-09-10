export interface PartyMembershipQuery {
  inParty(heroId: number): Promise<boolean>;
}
