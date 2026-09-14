/** Paperdoll bits 0..19 from Pub1 slot_mask / seed_artifacts.ts evidence. */
const SLOT_PAPERDOLL = (1 << 20) - 1;
/** Bag occupancy bits 20..25 from seed_artifacts.ts evidence. */
const SLOT_BAG = 1048576 | 2097152 | 4194304 | 8388608 | 16777216 | 33554432;

/** Named bagStack formula from jgr-emu seed_artifacts.ts; not a missing-field fallback. */
export function bagStackFor(weight: number, slotMask: number): number {
  if ((slotMask & SLOT_PAPERDOLL) !== 0 || (slotMask & SLOT_BAG) !== 0) return 1;
  return weight > 0 ? Math.floor(9990 / weight) : 9999;
}
