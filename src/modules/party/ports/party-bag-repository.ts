import type { NewPartyBagItem, PartyBagItem } from "../domain/party-record.ts";

export interface PartyBagRepository {
  insertItem(row: NewPartyBagItem): Promise<PartyBagItem>;
  lockItem(partyId: number, itemId: number): Promise<PartyBagItem | null>;
  listItems(partyId: number): Promise<readonly PartyBagItem[]>;
  saveItem(item: PartyBagItem): Promise<void>;
  deleteItem(partyId: number, itemId: number): Promise<void>;
  deleteExpired(partyId: number, nowUnix: number): Promise<number>;
}
