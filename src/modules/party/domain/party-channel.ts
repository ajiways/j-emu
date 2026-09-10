import { requireWireIdentity } from "../../../shared/kernel/decimal-id.ts";

export const MAX_PARTY_MEMBERS = 5;
export const DISTRIBUTE_COOLDOWN_SEC = 6;
export const BAG_TTL_SEC = 3 * 60 * 60;
export const LOTTERY_CHAT_GAP_MS = 450;
export const LOTTERY_REROLL_CAP = 20;

export function partyChannel(partyId: number): string {
  return `4:${requireWireIdentity(partyId, "party id")}`;
}
