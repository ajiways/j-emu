export interface PartyMembershipQuery {
  inParty(heroId: number): Promise<boolean>;
  /** The party of the hero, `null` when he has none. */
  partyIdOf(heroId: number): Promise<number | null>;
}
