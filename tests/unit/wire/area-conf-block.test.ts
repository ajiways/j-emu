import { describe, expect, it } from "vitest";
import { BotDefinition } from "../../../src/modules/catalog/domain/bot-definition.ts";
import { HuntLook } from "../../../src/modules/catalog/domain/hunt-look.ts";
import {
  buildLocationAreaConf,
  huntBotsForArea,
} from "../../../src/modules/jugger-wire/application/area-conf-block.ts";
import { Area } from "../../../src/modules/world/domain/area.ts";
import { HuntSpawn } from "../../../src/modules/world/domain/hunt-spawn.ts";

const gryzlLook = new HuntLook(
  "Грызл",
  "gryzl1.swf",
  90,
  15,
  10,
  "avatar_gryzl1_sm.jpg",
  0,
  0,
  "11",
  "",
);
const gryzl = new BotDefinition(2, "Грызль", 1, 20, 10, gryzlLook);
const spawn = new HuntSpawn(50310, 2, 883, 1499, "bot_1");
const area = new Area(
  "503",
  "Горное поселение",
  "forestvillage.swf",
  "2_1",
  "radvei_map.swf",
  0,
  "",
  "",
  "4",
  "Ambience_village.mp3",
  "Ambience_village.mp3",
  0,
  0,
  0,
  0,
  1,
  0,
  [spawn],
);

describe("buildLocationAreaConf", () => {
  it("nests live area_conf scalars and empty click/overlay collections", () => {
    const huntBots = huntBotsForArea([spawn], new Map([[2, gryzl]]));
    expect(buildLocationAreaConf(area, huntBots, [], 0)).toEqual({
      status: 100,
      area_ftime: 0,
      area_conf: {
        area_id: "503",
        title: "Горное поселение",
        ftime_max: 0,
        items: [],
        code: "",
        client_data: "",
        swf: "forestvillage.swf",
        region_map: "radvei_map.swf",
        sound_intro: "Ambience_village.mp3",
        sound_bg: "Ambience_village.mp3",
        inst_artikul_id: 0,
        context: "4",
        have_trade_channel: 0,
        have_kind_channel: 0,
        hide_finished_fights: 0,
        hide_running_fights: 1,
        no_clan_chat: 0,
        hunt_bots: {
          "2": {
            id: 2,
            nick: "Грызл",
            level: 1,
            kind: 0,
            speed: 10,
            hunt_swf: "gryzl1.swf",
            hunt_scale: 90,
            hunt_fps: 15,
            avatar: "avatar_gryzl1_sm.jpg",
            hide_on_map: 0,
          },
        },
        hunt_farm: [],
      },
    });
  });

  it("fails when a spawn references a missing bot", () => {
    expect(() => huntBotsForArea([spawn], new Map())).toThrow(/Bot catalog entry 2 is missing/);
  });
});
