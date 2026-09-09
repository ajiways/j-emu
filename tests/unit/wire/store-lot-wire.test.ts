import { describe, expect, it } from "vitest";
import { storeLotWire } from "../../../src/modules/jugger-wire/application/store-lot-wire.ts";
import type { StoreLot } from "../../../src/modules/catalog/domain/store-lot.ts";

const lot: StoreLot = {
  areaId: "504",
  lotId: 80,
  artikulId: 23,
  typeId: -131,
  price: 1,
  ord: 8,
};

describe("storeLotWire", () => {
  it("uses published artifact fields without a title fallback", () => {
    const wire = storeLotWire(lot, {
      id: 23,
      title: "Простая магическая перчатка",
      picture: "greyset5_lhand.png",
      kindId: 44,
      slotMask: 32,
      levelMin: 2,
      levelMax: 0,
      flags: 0,
      durability: 30,
      durabilityMax: 30,
      skills: {},
    });
    expect(wire.title).toBe("Простая магическая перчатка");
    expect(wire.type_id).toBe(-131);
    expect(wire.lot_id).toBe(80);
    expect(wire.cnt).toBe(0);
    expect(wire.price).toBe(1);
    expect(wire.durability).toBe(30);
    expect(wire.durability_max).toBe(30);
  });

  it("rejects a missing catalog title instead of substituting Артикул", () => {
    expect(() =>
      storeLotWire(lot, {
        id: 23,
        title: "",
        picture: "greyset5_lhand.png",
        kindId: 44,
        slotMask: 32,
        levelMin: 2,
        levelMax: 0,
        flags: 0,
        durability: 30,
        durabilityMax: 30,
        skills: {},
      }),
    ).toThrow(/title is required/);
  });
});
