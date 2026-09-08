export function moneyFromMinorUnits(value: number): string {
  if (!Number.isInteger(value) || value < 0) throw new Error("Invalid money amount");
  return (value / 100).toFixed(2);
}

export function moneyNumberFromMinorUnits(value: number): number {
  if (!Number.isInteger(value) || value < 0) throw new Error("Invalid money amount");
  return value / 100;
}
