type GoldStorePay = Readonly<{ currency: "gold"; amount: number }>;
type DiamondStorePay = Readonly<{ currency: "diamond"; amount: number }>;
type BarterStorePay = Readonly<{
  currency: "barter";
  artikulId: number;
  count: number;
}>;
type BundleBarterCost = Readonly<{ artikulId: number; count: number }>;
type BundleStorePay = Readonly<{
  currency: "bundle";
  gold: number;
  barter: readonly BundleBarterCost[];
}>;
export type StorePay = GoldStorePay | DiamondStorePay | BarterStorePay | BundleStorePay;

export type StorePayTotals = Readonly<{
  gold: number;
  diamond: number;
  barter: ReadonlyMap<number, number>;
}>;

export function isGoldCoins(value: number): boolean {
  if (!Number.isFinite(value) || value < 0) return false;
  return Math.abs(value * 100 - goldCoinsToMinor(value)) <= 1e-6;
}

export function requireGoldCoins(value: unknown, message: string): number {
  if (typeof value !== "number" || !isGoldCoins(value)) throw new Error(message);
  return value;
}

export function goldCoinsEqual(left: number, right: number): boolean {
  return goldCoinsToMinor(left) === goldCoinsToMinor(right);
}

export function parseStorePay(raw: unknown): StorePay {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Store lot pay is required");
  }
  const row = raw as Record<string, unknown>;
  const currency = row.currency;
  if (currency === "gold") {
    const amount = requireGoldCoins(
      row.amount,
      "Gold store pay amount must be non-negative gold coins",
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
  if (currency === "bundle") {
    const gold = requireGoldCoins(
      row.gold,
      "Bundle store pay gold must be non-negative gold coins",
    );
    const barter = parseBundleBarter(row.barter);
    if (Object.keys(row).length !== 3) throw new Error("Bundle store pay has unknown fields");
    if (goldCoinsToMinor(gold) === 0 && barter.length < 2) {
      throw new Error("Bundle store pay without gold must have at least two barter costs");
    }
    return { currency: "bundle", gold, barter };
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
  if (pay.currency === "barter") {
    return addBarter(totals, pay.artikulId, pay.count * quantity);
  }
  let next = totals;
  if (goldCoinsToMinor(pay.gold) > 0) {
    next = { ...next, gold: next.gold + pay.gold * quantity };
  }
  for (const cost of pay.barter) {
    next = addBarter(next, cost.artikulId, cost.count * quantity);
  }
  return next;
}

function addBarter(totals: StorePayTotals, artikulId: number, count: number): StorePayTotals {
  const next = new Map(totals.barter);
  const current = next.get(artikulId);
  next.set(artikulId, (current === undefined ? 0 : current) + count);
  return { ...totals, barter: next };
}

function parseBundleBarter(raw: unknown): readonly BundleBarterCost[] {
  if (!Array.isArray(raw) || raw.length < 1) {
    throw new Error("Bundle store pay barter must be a non-empty array");
  }
  const seen = new Set<number>();
  return raw.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`Bundle store pay barter ${index} must be an object`);
    }
    const row = entry as Record<string, unknown>;
    const artikulId = requirePayInt(
      row.artikulId,
      `Bundle store pay barter ${index} artikulId must be a positive integer`,
      1,
    );
    const count = requirePayInt(
      row.count,
      `Bundle store pay barter ${index} count must be a positive integer`,
      1,
    );
    if (Object.keys(row).length !== 2) {
      throw new Error(`Bundle store pay barter ${index} has unknown fields`);
    }
    if (seen.has(artikulId)) {
      throw new Error(`Bundle store pay has duplicate barter artikulId ${artikulId}`);
    }
    seen.add(artikulId);
    return { artikulId, count };
  });
}

/** Same 1.00 = 100 minor rule as `goldToMinor`; catalog must not import character. */
function goldCoinsToMinor(gold: number): number {
  return Math.round(gold * 100);
}

function requirePayInt(value: unknown, message: string, min: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min) {
    throw new Error(message);
  }
  return value;
}
