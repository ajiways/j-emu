export function amountFromParams(
  resourceMax: number,
  param1: number,
  param2: number,
  label: string,
): number {
  if (!Number.isInteger(resourceMax) || resourceMax < 1) {
    throw new Error(`${label} resourceMax must be a positive integer`);
  }
  if (!Number.isInteger(param1) || param1 < 1) {
    throw new Error(`${label} param1 is required and must be > 0`);
  }
  if (!Number.isInteger(param2) || param2 < 0) {
    throw new Error(`${label} param2 is invalid`);
  }
  if (param2 === 0) return Math.max(1, Math.floor((resourceMax * param1) / 100));
  return param1;
}
