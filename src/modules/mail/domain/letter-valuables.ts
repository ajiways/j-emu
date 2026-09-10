import type { Letter } from "./letter.ts";

export function letterHasValuables(letter: Letter): boolean {
  return letter.moneyComeMinor > 0 || letter.paymentMinor > 0;
}
