import { isPaperdollSlotMask } from "./paperdoll-slot.ts";

/** AS3 SlotCodes.SLOT_EFFECT — belt cell bit 26. */
export const SLOT_EFFECT = 67_108_864;

export function isLeftPocket(slotMask: number): boolean {
  if (!Number.isInteger(slotMask) || slotMask < 0) {
    throw new Error("Item slotMask is invalid");
  }
  return (slotMask & SLOT_EFFECT) !== 0 && !isPaperdollSlotMask(slotMask);
}

export function pocketCntMax(weight: number): number {
  if (!Number.isInteger(weight) || weight < 1) {
    throw new Error("Pocket artifact weight must be a positive integer");
  }
  return Math.max(1, Math.floor(100 / weight));
}

export function requirePocketCapacity(capacity: number): number {
  if (!Number.isInteger(capacity) || capacity < 1) {
    throw new Error("Pocket capacity must be a positive integer");
  }
  return capacity;
}
