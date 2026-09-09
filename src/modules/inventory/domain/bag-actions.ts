import { isPaperdollSlotMask } from "./paperdoll-slot.ts";
import { isLeftPocket } from "./pocket-slot.ts";
import { CAN_BE_UPGRADED } from "./upgrade-tables.ts";

export const FLAG_DROP = 1;
export const FLAG_SELL = 2;
export const FLAG_USE = 4;
const FLAG_PUT_ON = 8;

export function bagActionsFor(
  slotMask: number,
  hasUseAction: boolean,
  broken: boolean,
  upgradeable: boolean,
): number {
  let actions = FLAG_DROP | FLAG_SELL;
  if (!broken && (isPaperdollSlotMask(slotMask) || isLeftPocket(slotMask))) actions |= FLAG_PUT_ON;
  if (hasUseAction) actions |= FLAG_USE;
  if (upgradeable) actions |= CAN_BE_UPGRADED;
  return actions;
}
