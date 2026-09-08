export function addHpGain(hpMax: number, param1: number, param2: number): number {
  if (!Number.isInteger(hpMax) || hpMax < 1) {
    throw new Error("ADD_HP hpMax must be a positive integer");
  }
  if (!Number.isInteger(param1) || param1 < 1) {
    throw new Error("ADD_HP param1 is required and must be > 0");
  }
  if (!Number.isInteger(param2) || param2 < 0) {
    throw new Error("ADD_HP param2 is invalid");
  }
  if (param2 === 0) return Math.max(1, Math.floor((hpMax * param1) / 100));
  return param1;
}
