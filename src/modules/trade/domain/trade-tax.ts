export function moneyRound(gold: number): number {
  if (!Number.isFinite(gold)) throw new Error("Gold amount is invalid");
  return Math.round(gold * 100) / 100;
}

export function goldFromMinorUnits(minor: number): number {
  if (!Number.isInteger(minor) || minor < 0) throw new Error("Invalid money amount");
  return minor / 100;
}

export function tradeTax(value: number): number {
  if (!Number.isFinite(value)) throw new Error("Trade value is invalid");
  if (value <= 0) return 0;
  return 0.25 * value ** Math.log10(5);
}

function trayValue(
  moneyGold: number,
  arts: readonly Readonly<{ priceGold: number; quantity: number }>[],
): number {
  if (!Number.isFinite(moneyGold) || moneyGold < 0) throw new Error("Tray money is invalid");
  let value = moneyGold;
  for (const art of arts) {
    if (!Number.isFinite(art.priceGold) || art.priceGold < 0) {
      throw new Error("Tray artifact price is invalid");
    }
    if (!Number.isInteger(art.quantity) || art.quantity < 1) {
      throw new Error("Tray artifact quantity is invalid");
    }
    value += art.priceGold * art.quantity;
  }
  return value;
}

export function trayTax(
  moneyGold: number,
  arts: readonly Readonly<{ priceGold: number; quantity: number }>[],
): number {
  return tradeTax(trayValue(moneyGold, arts));
}
