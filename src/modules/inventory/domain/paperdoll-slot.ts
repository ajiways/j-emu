/** AS3 SlotCodes bits 0..19 — paperdoll, not bag/pocket/TEMPEFFECT. */
const SLOT_PAPERDOLL = (1 << 20) - 1;

function paperdollSlotBits(slotMask: number): readonly number[] {
  if (!Number.isInteger(slotMask) || slotMask < 0) {
    throw new Error("Item slotMask is invalid");
  }
  const masked = slotMask & SLOT_PAPERDOLL;
  const bits: number[] = [];
  for (let bit = 1; bit <= SLOT_PAPERDOLL; bit <<= 1) {
    if ((masked & bit) !== 0) bits.push(bit);
  }
  return bits;
}

export function isPaperdollSlotMask(slotMask: number): boolean {
  return paperdollSlotBits(slotMask).length > 0;
}

export function pickPaperdollSlot(
  slotMask: number,
  occupied: ReadonlySet<number>,
): number | undefined {
  const bits = paperdollSlotBits(slotMask);
  if (bits.length === 0) return undefined;
  const preferred = bits.find((bit) => !occupied.has(bit));
  return preferred ?? bits[0];
}
