import { amountFromParams } from "./amount-from-params.ts";

export function addHpGain(hpMax: number, param1: number, param2: number): number {
  return amountFromParams(hpMax, param1, param2, "ADD_HP");
}
