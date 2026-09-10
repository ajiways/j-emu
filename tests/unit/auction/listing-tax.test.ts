import { describe, expect, it } from "vitest";
import { formatRtime } from "../../../src/modules/auction/domain/listing-rtime.ts";
import {
  durationHours,
  listingTaxGold,
  minBuyoutGold,
  MIN_START_BID_GOLD,
  ORDER_TAX_GOLD,
} from "../../../src/modules/auction/domain/listing-tax.ts";
import { AuctionDeniedError } from "../../../src/modules/auction/domain/auction-denied-error.ts";

describe("auction listing tax", () => {
  it("duration is 2 / 8 / 24 only", () => {
    expect(durationHours(2)).toBe(2);
    expect(durationHours("8")).toBe(8);
    expect(durationHours(24)).toBe(24);
    expect(() => durationHours(3)).toThrow(AuctionDeniedError);
  });

  it("listing tax is 1% of catalog*qty*mult, min 0.01", () => {
    expect(listingTaxGold(100, 1, 2)).toBe(1);
    expect(listingTaxGold(100, 1, 8)).toBe(1.11);
    expect(listingTaxGold(100, 1, 24)).toBe(1.4);
    expect(listingTaxGold(100, 2, 2)).toBe(2);
    expect(listingTaxGold(0, 1, 2)).toBe(0.01);
  });

  it("order tax is a flat 1 gold", () => {
    expect(ORDER_TAX_GOLD).toBe(1);
  });

  it("buyout floor is start × 1.05", () => {
    expect(minBuyoutGold(1)).toBe(1.05);
    expect(MIN_START_BID_GOLD).toBe(0.21);
  });
});

describe("auction rtime", () => {
  it("buckets remaining hours as Много/Средне/Мало", () => {
    expect(formatRtime(24 * 3600)).toEqual({ rtime: "Много", rtime_num: 24 });
    expect(formatRtime(8 * 3600)).toEqual({ rtime: "Много", rtime_num: 8 });
    expect(formatRtime(2 * 3600)).toEqual({ rtime: "Средне", rtime_num: 2 });
    expect(formatRtime(60)).toEqual({ rtime: "Мало", rtime_num: 1 });
  });
});
