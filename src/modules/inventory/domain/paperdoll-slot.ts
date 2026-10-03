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

/** `SLOT2_INSIGNIA` of the client: the slot of the distinction signs (emblems). */
const SLOT2_INSIGNIA = 1;
/**
 * The insignia slot as the equipment row keeps it. It shares no bit with a paperdoll slot, so the
 * overlap test that frees a slot on wear never takes a worn item out of the paperdoll for it.
 */
export const INSIGNIA_EQUIPMENT_SLOT = 1 << 30;

/** An item that has no paperdoll slot and goes to the insignia slot. */
export function wearsInInsigniaSlot(slotMask: number, slot2Mask: number): boolean {
  return !isPaperdollSlotMask(slotMask) && (slot2Mask & SLOT2_INSIGNIA) !== 0;
}

/** The wire pair of an equipped item: `slot`, and `slot2` for the second mask's slots. */
export function wireSlotPair(equipmentSlot: number): Readonly<{ slot: number; slot2: number }> {
  if (equipmentSlot === INSIGNIA_EQUIPMENT_SLOT) return { slot: 0, slot2: SLOT2_INSIGNIA };
  return { slot: equipmentSlot, slot2: 0 };
}
