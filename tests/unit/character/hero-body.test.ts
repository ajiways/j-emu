import { describe, expect, it } from "vitest";
import {
  composeHeroBody,
  extractHeadSkin,
  parseFBodyTokens,
} from "../../../src/modules/character/domain/hero-body.ts";

const NAKED = "armor();head(0,0,8,152);skin()";

describe("hero body", () => {
  it("keeps head and skin when no overlay tokens are worn", () => {
    expect(composeHeroBody(NAKED, [])).toBe(NAKED);
  });

  it("sorts Unity overlay tokens by visual slot", () => {
    expect(composeHeroBody(NAKED, ["1#4112", "110_1#4097"])).toBe(
      "armor(110_1#4097,1#4112);head(0,0,8,152);skin()",
    );
  });

  it("splits authored comma-separated f_body", () => {
    expect(parseFBodyTokens("110_1#4097, 1#4112")).toEqual(["110_1#4097", "1#4112"]);
    expect(parseFBodyTokens("")).toEqual([]);
  });

  it("fails when the current body has no head or skin segment", () => {
    expect(() => extractHeadSkin("armor()")).toThrow(/missing head/);
    expect(() => extractHeadSkin("armor();head(0,0,8,152)")).toThrow(/missing skin/);
  });
});
