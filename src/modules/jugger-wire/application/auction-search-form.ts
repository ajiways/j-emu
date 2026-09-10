import { AuctionDeniedError } from "../../auction/domain/auction-denied-error.ts";
import type { ListingOrder, ListingSearch } from "../../auction/domain/listing-search.ts";

export function parseAuctionSearch(
  form: Readonly<Record<string, unknown>> | undefined,
): ListingSearch {
  const raw = form ?? {};
  return {
    title: String(raw.title ?? "").trim(),
    levelMin: optionalNonNeg(raw.level_min, "level_min"),
    levelMax: optionalNonNeg(raw.level_max, "level_max"),
    countMin: optionalNonNeg(raw.count_min, "count_min"),
    countMax: optionalNonNeg(raw.count_max, "count_max"),
    kindIds: asNumList(raw.kind),
    quality: qualityFilter(raw.quality),
    ownerKinds: asNumList(raw.user_kind),
    order: parseOrder(raw.order),
    reverse: String(raw.rev ?? "0") === "1",
    offset: parseOffset(raw.offs),
  };
}

function optionalNonNeg(value: unknown, label: string): number {
  if (value === undefined || value === null || value === "") return 0;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new AuctionDeniedError(`${label} is invalid`);
  return n;
}

function qualityFilter(value: unknown): number {
  if (value === undefined || value === null || value === "") return -1;
  const n = Number(value);
  if (!Number.isFinite(n)) throw new AuctionDeniedError("quality is invalid");
  return n;
}

function parseOrder(value: unknown): ListingOrder {
  const order = String(value ?? "");
  if (order === "title" || order === "bid" || order === "buyout" || order === "time") return order;
  return "time";
}

function parseOffset(value: unknown): number {
  if (value === undefined || value === null || value === "") return 0;
  const n = Math.floor(Number(value));
  if (!Number.isInteger(n) || n < 0) throw new AuctionDeniedError("offs is invalid");
  return n;
}

function asNumList(value: unknown): readonly number[] {
  if (value === undefined || value === null || value === "") return [];
  const raw = Array.isArray(value)
    ? value
    : typeof value === "object"
      ? Object.values(value as Record<string, unknown>)
      : [value];
  const out: number[] = [];
  for (const item of raw) {
    const n = Number(item);
    if (Number.isFinite(n) && n > 0) out.push(n);
  }
  return out;
}

export function parseAvailableFlag(form: Readonly<Record<string, unknown>> | undefined): boolean {
  return String((form ?? {}).available ?? "0") === "1";
}
