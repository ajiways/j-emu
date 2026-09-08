const SELL_PRICE_MINOR_CAP = 4000;

/** Provenance: legacy behavior / empirical (`TRAVEL_BAG.md`, `sellPriceFromCatalog`). */
export function sellPriceMinor(priceMinor: number): number {
  if (!Number.isInteger(priceMinor) || priceMinor < 0) {
    throw new Error("Catalog priceMinor is invalid");
  }
  if (priceMinor <= 0) return 0;
  return Math.min(SELL_PRICE_MINOR_CAP, Math.floor(priceMinor / 10));
}
