export function takeDropQuantity(have: number, amount: number | undefined): number {
  if (!Number.isInteger(have) || have < 1) {
    throw new Error("Item quantity must be a positive integer");
  }
  if (amount === undefined) return have;
  const take = Math.floor(amount);
  if (!Number.isFinite(take) || take <= 0) return have;
  return Math.min(take, have);
}
