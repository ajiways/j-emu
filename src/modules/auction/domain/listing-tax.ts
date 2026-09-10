import { AuctionDeniedError } from "./auction-denied-error.ts";

export const MIN_START_BID_GOLD = 0.21;
export const PRICE_TYPE_GOLD = 1;

const DURATION_MULT: Readonly<Record<2 | 8 | 24, number>> = { 2: 1, 8: 1.11, 24: 1.4 };

export type LotDurationHours = 2 | 8 | 24;

export function durationHours(raw: unknown): LotDurationHours {
  const n = Number(raw);
  if (n === 2 || n === 8 || n === 24) return n;
  throw new AuctionDeniedError("выберите длительность");
}

export function moneyRound(gold: number): number {
  return Math.round(gold * 100) / 100;
}

export function listingTaxGold(
  catalogPriceGold: number,
  qty: number,
  hours: LotDurationHours,
): number {
  const price = Number(catalogPriceGold);
  if (!Number.isInteger(qty) || qty < 1) throw new Error("Listing quantity is invalid");
  const base = Number.isFinite(price) && price > 0 ? price * qty : 0;
  const mult = DURATION_MULT[hours];
  return moneyRound(Math.max(0.01, 0.01 * base * mult));
}

export function minBuyoutGold(startPriceGold: number): number {
  let v = startPriceGold * 1.05;
  const nearInt = Math.round((Math.round(v) - Math.round(v * 100) / 100) * 100) / 100;
  if (Math.abs(nearInt) <= 0.01) v = Math.round(v);
  return moneyRound(v);
}
