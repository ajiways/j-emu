export function huntAggroCharges(agrilka: number): number {
  if (!Number.isInteger(agrilka) || agrilka < 0) {
    throw new Error("AGRILKA_MOBOV must be a non-negative integer");
  }
  return 1 + agrilka;
}
