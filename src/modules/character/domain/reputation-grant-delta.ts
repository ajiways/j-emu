import { REPUTATION_TRACK_MAX } from "../../catalog/domain/reputation-ids.ts";

export function reputationGrantDelta(current: number, amount: number, cap: number): number {
  if (!Number.isInteger(current) || current < 0 || current > REPUTATION_TRACK_MAX) {
    throw new Error("Hero reputation is outside the track range");
  }
  if (!Number.isInteger(amount) || amount < 1) {
    throw new Error("Reputation grant amount must be a positive integer");
  }
  if (!Number.isInteger(cap) || cap < 0) {
    throw new Error("Reputation grant cap must be a non-negative integer");
  }
  if (cap > 0 && current >= cap) return 0;
  let room = REPUTATION_TRACK_MAX - current;
  if (cap > 0) room = Math.min(room, cap - current);
  return Math.min(amount, room);
}
