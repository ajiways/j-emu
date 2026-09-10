import { requireWireIdentity } from "../../../shared/kernel/decimal-id.ts";

export const MAX_PARTY_MEMBERS = 5;
export const DISTRIBUTE_COOLDOWN_SEC = 6;

export function partyChannel(partyId: number): string {
  return `4:${requireWireIdentity(partyId, "party id")}`;
}
