export type PartyBagDrop = Readonly<{ artikulId: number; quantity: number }>;

export interface PartyBagDeposit {
  deposit(partyId: number, drops: readonly PartyBagDrop[]): Promise<void>;
}
