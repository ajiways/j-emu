import { InsufficientMoneyError } from "./insufficient-money-error.ts";

const MAX_MONEY_MINOR = 2_147_483_647;

export function debitMoneyMinor(current: number, minorUnits: number): number {
  if (!Number.isInteger(current) || current < 0 || current > MAX_MONEY_MINOR) {
    throw new Error("Hero money is outside the wire integer range");
  }
  if (!Number.isInteger(minorUnits) || minorUnits < 1) {
    throw new Error("Money debit must be a positive integer");
  }
  const next = current - minorUnits;
  if (next < 0) throw new InsufficientMoneyError(current, minorUnits);
  return next;
}
