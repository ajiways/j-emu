import { describe, expect, it } from "vitest";
import { assistantsFromAmf } from "../../../scripts/content-decode/assistant-from-amf.ts";
import { areaFarmsFromJson } from "../../../scripts/content-decode/area-farms-from-json.ts";
import { recipesFromAmf } from "../../../scripts/content-decode/recipes-from-amf.ts";

const BANDS = {
  "8": { probability: 90, color: "#e15f00" },
  "18": { probability: 50, color: "#990099" },
  "28": { probability: 25, color: "blue" },
  "38": { probability: 15, color: "#114d01" },
  "48": { probability: 5, color: "#114d01" },
  "60": { probability: 3, color: "#114d01" },
  "16777215": { probability: 0, color: "gray" },
};

describe("profession decoder", () => {
  it("omits leftover voodoo assistants and fails on an unknown field", () => {
    const rows = assistantsFromAmf({
      "3": starter(3),
      "28": { ...starter(28), profession: 0, level: 0, picture: "" },
    });
    expect(rows.map((row) => row.id)).toEqual([3]);
    expect(() => assistantsFromAmf({ "3": { ...starter(3), mystery: 1 } })).toThrow(
      /unknown field mystery/,
    );
  });

  it("omits leftover recipe types and profession 0 crafts, keeps recipe 61", () => {
    const recipes = recipesFromAmf({
      recipes: [recipe61(), leftoverTablet(), noProfessionCraft()],
      probabilities: BANDS,
    });
    expect(recipes.map((row) => row.id)).toEqual([61]);
    expect(() =>
      recipesFromAmf({
        recipes: [recipe61()],
        probabilities: { ...BANDS, "9": { probability: 1, color: "red" } },
      }),
    ).toThrow(/probability delta 9 is unknown/);
  });

  it("fails leftover non-artifact ingredients on type 1", () => {
    expect(() =>
      recipesFromAmf({
        recipes: [
          {
            ...recipe61(),
            data: [{ amount: "1", type: "money" }],
          },
        ],
        probabilities: BANDS,
      }),
    ).toThrow(/ingredient type money is leftover/);
  });

  it("reads area farm overrides and fails on an unknown spot field", () => {
    const parsed = areaFarmsFromJson(areaFarmsFixture());
    expect(parsed.spots).toEqual([
      {
        areaId: "500",
        huntSpotId: 15,
        farmId: 4,
        tactics: 0,
        assistantMax: 37,
        cntMax: 1600,
        cntCurrent: 1396,
        cntCooldown: 1800,
      },
    ]);
    expect(parsed.overrides.farmTime).toEqual({ "4": 60 });
    const bad = areaFarmsFixture();
    const spot = bad.areas["500"]?.spots[0];
    if (!spot) throw new Error("fixture spot 500 is missing");
    spot.mystery = 1;
    expect(() => areaFarmsFromJson(bad)).toThrow(/unknown field mystery/);
  });
});

function starter(id: number): Record<string, unknown> {
  return {
    id,
    title: "Имуро-Юи",
    description: "",
    profession: 2,
    level: 1,
    quality: 0,
    next_artikul_id: 13,
    skill_sum: 4,
    price: 10,
    price_type: 1,
    picture: "gremlin_star_grey_1.png",
    restrictions: "",
    voodoo_energy: 0,
  };
}

function recipe61(): Record<string, unknown> {
  return {
    id: 61,
    title: "Раствор хрусталя",
    description: "",
    artikul_id: 1861,
    type: 1,
    profession_id: 6,
    skill_value: 0,
    max_skill_value: 60,
    data: [{ artikul_id: "1720", amount: "1", type: "artifact", title: "Хрусталь" }],
    data_2: [],
    duration: 35,
    create_artikul_id: 1714,
    create_artikul_num: 10,
    force_flags: 0,
    table_id: 0,
    create_quality: "0",
    create_type_id: "94",
    create_title: "Колба с раствором хрусталя",
    create_level_min: "7",
  };
}

function leftoverTablet(): Record<string, unknown> {
  return { ...recipe61(), id: 7, type: 2, profession_id: 0, artikul_id: 510 };
}

function noProfessionCraft(): Record<string, unknown> {
  return { ...recipe61(), id: 434, profession_id: 0, artikul_id: 5144, create_artikul_id: 2998 };
}

function areaFarmsFixture(): {
  _comment: string;
  farm_time_overrides: Record<string, number>;
  stamina_drain_overrides: Record<string, number>;
  areas: Record<string, { tactics: number; spots: Array<Record<string, unknown>> }>;
} {
  return {
    _comment: "dump overlay",
    farm_time_overrides: { "4": 60 },
    stamina_drain_overrides: {},
    areas: {
      "500": {
        tactics: 0,
        spots: [
          {
            hunt_spot_id: 15,
            farm_id: 4,
            assistant_max: 37,
            cnt_max: 1600,
            cnt_current: 1396,
            cnt_cooldown: 1800,
          },
        ],
      },
    },
  };
}
