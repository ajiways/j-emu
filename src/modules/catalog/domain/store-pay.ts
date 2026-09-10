type GoldStorePay = Readonly<{ currency: "gold"; amount: number }>;
type DiamondStorePay = Readonly<{ currency: "diamond"; amount: number }>;
type BarterStorePay = Readonly<{
  currency: "barter";
  artikulId: number;
  count: number;
}>;
export type StorePay = GoldStorePay | DiamondStorePay | BarterStorePay;

export type StorePayTotals = Readonly<{
  gold: number;
  diamond: number;
  barter: ReadonlyMap<number, number>;
}>;

export function parseStorePay(raw: unknown): StorePay {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Store lot pay is required");
  }
  const row = raw as Record<string, unknown>;
  const currency = row.currency;
  if (currency === "gold") {
    const amount = requirePayInt(
      row.amount,
      "Gold store pay amount must be a non-negative integer",
      0,
    );
    if (Object.keys(row).length !== 2) throw new Error("Gold store pay has unknown fields");
    return { currency: "gold", amount };
  }
  if (currency === "diamond") {
    const amount = requirePayInt(
      row.amount,
      "Diamond store pay amount must be a positive integer",
      1,
    );
    if (Object.keys(row).length !== 2) throw new Error("Diamond store pay has unknown fields");
    return { currency: "diamond", amount };
  }
  if (currency === "barter") {
    const artikulId = requirePayInt(
      row.artikulId,
      "Barter store pay artikulId must be a positive integer",
      1,
    );
    const count = requirePayInt(row.count, "Barter store pay count must be a positive integer", 1);
    if (Object.keys(row).length !== 3) throw new Error("Barter store pay has unknown fields");
    return { currency: "barter", artikulId, count };
  }
  throw new Error(`Store lot pay currency ${String(currency)} is not supported`);
}

export function emptyStorePayTotals(): StorePayTotals {
  return { gold: 0, diamond: 0, barter: new Map() };
}

export function addStorePay(
  totals: StorePayTotals,
  pay: StorePay,
  quantity: number,
): StorePayTotals {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error("Store basket quantity must be a positive integer");
  }
  if (pay.currency === "gold") {
    return { ...totals, gold: totals.gold + pay.amount * quantity };
  }
  if (pay.currency === "diamond") {
    return { ...totals, diamond: totals.diamond + pay.amount * quantity };
  }
  const next = new Map(totals.barter);
  const current = next.get(pay.artikulId);
  next.set(pay.artikulId, (current === undefined ? 0 : current) + pay.count * quantity);
  return { ...totals, barter: next };
}

function requirePayInt(value: unknown, message: string, min: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min) {
    throw new Error(message);
  }
  return value;
}
