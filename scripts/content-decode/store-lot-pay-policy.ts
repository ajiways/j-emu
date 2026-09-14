import type { StoreLotDocument } from "../../src/modules/content/domain/content-playable-entities.ts";
import { requireGoldCoins } from "../../src/modules/catalog/domain/store-pay.ts";
import { isRecord, rejectUnknownKeys, requireInteger } from "./json-object-keys.ts";

type StoreLotPay = StoreLotDocument["pay"];
type BarterCost = Readonly<{ artikulId: number; count: number }>;

const BADGE_KEYS = new Set(["id", "data", "stack_cnt"]);
const BADGE_DATA_KEYS = new Set(["type", "cnt", "artikul_id", "price_type"]);

export function storeLotPayFromDump(
  areaId: string,
  artikulId: number,
  dumpPrice: unknown,
  badgeData: unknown,
): { price: number; pay: StoreLotPay } {
  const shelf = requireGoldCoins(
    dumpPrice,
    `store ${areaId} artikul ${artikulId} price must be non-negative gold coins`,
  );
  if (badgeData === undefined) {
    return { price: shelf, pay: { currency: "gold", amount: shelf } };
  }
  if (!Array.isArray(badgeData) || badgeData.length < 1) {
    throw new Error(`store ${areaId} artikul ${artikulId} badge_data must be a non-empty array`);
  }
  const first = badgeData[0];
  if (!isRecord(first)) {
    throw new Error(`store ${areaId} artikul ${artikulId} badge must be an object`);
  }
  rejectUnknownKeys(first, BADGE_KEYS, `store ${areaId} artikul ${artikulId} badge`);
  const costs = costsFromBadge(first, areaId, artikulId);
  if (costs.diamond > 0) {
    throw new Error(
      `store ${areaId} artikul ${artikulId} leftover diamond pay is not authored; dump must already be gold`,
    );
  }
  if (costs.barter.length === 0) {
    return { price: costs.gold, pay: { currency: "gold", amount: costs.gold } };
  }
  if (costs.gold === 0 && costs.barter.length === 1) {
    const [barter] = costs.barter;
    if (!barter) throw new Error(`store ${areaId} artikul ${artikulId} barter cost is required`);
    return { price: shelf, pay: { currency: "barter", ...barter } };
  }
  return {
    price: shelf,
    pay: { currency: "bundle", gold: costs.gold, barter: costs.barter },
  };
}

function costsFromBadge(
  badge: Readonly<Record<string, unknown>>,
  areaId: string,
  artikulId: number,
): { gold: number; diamond: number; barter: readonly BarterCost[] } {
  const rows = badge.data;
  if (!Array.isArray(rows) || rows.length < 1) {
    throw new Error(`store ${areaId} artikul ${artikulId} badge data is required`);
  }
  let gold = 0;
  let diamond = 0;
  const barter: BarterCost[] = [];
  const seen = new Set<number>();
  for (const [index, row] of rows.entries()) {
    if (!isRecord(row)) {
      throw new Error(`store ${areaId} artikul ${artikulId} badge data ${index} must be an object`);
    }
    rejectUnknownKeys(
      row,
      BADGE_DATA_KEYS,
      `store ${areaId} artikul ${artikulId} badge data ${index}`,
    );
    const type = row.type;
    if (type === "money") {
      const cnt = requireGoldCoins(
        row.cnt,
        `store ${areaId} artikul ${artikulId} money cnt must be non-negative gold coins`,
      );
      const priceType =
        row.price_type === undefined ? 1 : requireInteger(row.price_type, "price_type");
      if (priceType === 1) gold += cnt;
      else if (priceType === 3) diamond += cnt;
      else {
        throw new Error(
          `store ${areaId} artikul ${artikulId} money price_type ${priceType} is not supported`,
        );
      }
      continue;
    }
    if (type === "artifact") {
      const costId = requireInteger(
        row.artikul_id,
        `store ${areaId} artikul ${artikulId} barter id`,
      );
      const count = requireInteger(row.cnt, `store ${areaId} artikul ${artikulId} barter count`);
      if (costId < 1 || count < 1) {
        throw new Error(`store ${areaId} artikul ${artikulId} barter cost is invalid`);
      }
      if (seen.has(costId)) {
        throw new Error(
          `store ${areaId} artikul ${artikulId} duplicate barter artikul ${costId} on the first badge`,
        );
      }
      seen.add(costId);
      barter.push({ artikulId: costId, count });
      continue;
    }
    throw new Error(
      `store ${areaId} artikul ${artikulId} badge data type ${String(type)} is not supported`,
    );
  }
  return { gold, diamond, barter };
}
