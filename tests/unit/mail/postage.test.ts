import { describe, expect, it } from "vitest";
import {
  mailTax,
  mailTaxRaw,
  MAIL_POSTAGE_GOLD,
} from "../../../src/modules/mail/domain/postage.ts";

describe("mail postage tax", () => {
  it("returns 0 for empty enclosed value and keeps 1g postage", () => {
    expect(MAIL_POSTAGE_GOLD).toBe(1);
    expect(mailTax(0)).toBe(0);
    expect(mailTaxRaw(0)).toBe(0);
  });

  it("charges more tax for COD than ordinary enclosed value", () => {
    expect(mailTax(100)).toBeGreaterThan(0);
    expect(mailTax(100, true)).toBeGreaterThan(mailTax(100));
  });
});
