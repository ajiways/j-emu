import { isPaperdollSlotMask } from "./paperdoll-slot.ts";
import { isLeftPocket } from "./pocket-slot.ts";

export const FLAG_DROP = 1;
export const FLAG_SELL = 2;
const FLAG_PUT_ON = 8;

export function bagActionsFor(slotMask: number): number {
  let actions = FLAG_DROP | FLAG_SELL;
  if (isPaperdollSlotMask(slotMask) || isLeftPocket(slotMask)) actions |= FLAG_PUT_ON;
  return actions;
}
