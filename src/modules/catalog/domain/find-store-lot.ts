import type { StoreLot } from "./store-lot.ts";

export function findStoreLot(lots: readonly StoreLot[], key: string): StoreLot | null {
  if (!key) throw new Error("Store lot key is required");
  const id = Number(key);
  if (!Number.isInteger(id)) return null;
  const byLotId = lots.find((lot) => lot.lotId === id);
  if (byLotId) return byLotId;
  return lots.find((lot) => lot.artikulId === id) ?? null;
}
