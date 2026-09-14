import { describe, expect, it } from "vitest";
import { dungeonFromJson } from "../../../scripts/content-decode/dungeon-from-json.ts";
import { instancesFromAmf } from "../../../scripts/content-decode/instance-from-amf.ts";

describe("dungeon decoder", () => {
  it("maps a has_clear fixture and omits leftover bands", () => {
    const dungeon = dungeonFromJson(provalFixture(), "proval.json");
    expect(dungeon).toMatchObject({
      artikulId: 4,
      startAreaId: "548",
      hasClear: true,
      progressFinishValue: 9,
      clear: { coinArtikulId: 3163, coinMin: 1, coinMax: 30 },
      loot: { bossBotId: 115, personalGuaranteed: [] },
    });
    expect(dungeon.areas[0]?.spawns[0]?.zone).toHaveLength(4);
  });

  it("fills omitted hunt_mask and spawn wait from dump constants", () => {
    const dungeon = dungeonFromJson(ogreFixture(), "ogre_cave.json");
    expect(dungeon.areas[0]?.spawns[0]).toMatchObject({
      spawnKey: "ogre",
      huntMask: "bot_1",
      waitMin: 2,
      waitMax: 8,
    });
  });

  it("fails on an unknown spawn field", () => {
    const raw = ogreFixture();
    const spawn = raw.areas[0]?.spawns[0];
    if (!spawn) throw new Error("ogre spawn is missing");
    spawn.mystery = 1;
    expect(() => dungeonFromJson(raw, "ogre_cave.json")).toThrow(/unknown field mystery/);
  });

  it("reads instance.amf chrome and fails on an unknown row field", () => {
    const catalog = instancesFromAmf({
      instance: [instanceRow(1, "Мрачная пещера")],
      macroses: {},
    });
    expect(catalog.get(1)).toEqual({ id: 1, title: "Мрачная пещера", levelMin: 3 });
    expect(() =>
      instancesFromAmf({
        instance: [{ ...instanceRow(1, "Мрачная пещера"), mystery: 1 }],
        macroses: {},
      }),
    ).toThrow(/unknown field mystery/);
  });
});

function instanceRow(id: number, title: string): Record<string, unknown> {
  return {
    id,
    title,
    level_min: 3,
    level_max: -1,
    flags: 0,
    progress_desc: "",
    area_info: "",
    img_url: "x.png",
    description_full: "",
    show_in_book: 1,
  };
}

function ogreFixture(): Record<string, unknown> & {
  areas: Array<{ area_id: string; spawns: Array<Record<string, unknown>> }>;
} {
  return {
    artikul_id: 1,
    title: "Мрачная пещера",
    start_area_id: "542",
    parent_area_id: "501",
    level_min: 3,
    duration_sec: 3600,
    img_url: "alt_noob_cave.jpg",
    has_clear: false,
    areas: [
      {
        area_id: "542",
        spawns: [
          {
            spawn_key: "ogre",
            hunt_bot_id: 99,
            encounter: [{ bot_id: 99, count: 1 }],
            is_boss: true,
            counts_for_clear: true,
            position_x: 662,
            position_y: 547,
            route: [
              { x: 647, y: 536, wait_min: 2, wait_max: 8 },
              { x: 494, y: 534, wait_min: 2, wait_max: 8 },
            ],
          },
        ],
      },
    ],
    loot: { boss_bot_id: 99, personal_guaranteed: [2371], bands: [] },
  };
}

function provalFixture(): Record<string, unknown> {
  return {
    artikul_id: 4,
    title: "Провал",
    start_area_id: "548",
    parent_area_id: "536",
    level_min: 6,
    duration_sec: 28800,
    img_url: "alt_inst_proval.jpg",
    has_clear: true,
    progress_finish_value: 9,
    clear: { coin_artikul_id: 3163, coin_min: 1, coin_max: 30 },
    loot: { boss_bot_id: 115, personal_guaranteed: [], bands: [] },
    areas: [
      {
        area_id: "548",
        spawns: [
          {
            spawn_key: "548_1",
            hunt_bot_id: 117,
            encounter: [{ bot_id: 117, count: 8 }],
            is_boss: false,
            counts_for_clear: true,
            hunt_mask: "bot_1",
            position_x: 401,
            position_y: 378,
            wait_min: 2,
            wait_max: 6,
            zone: [
              { x: 437, y: 292 },
              { x: 349, y: 377 },
              { x: 381, y: 451 },
              { x: 472, y: 421 },
            ],
          },
        ],
      },
    ],
  };
}
