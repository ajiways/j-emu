import { describe, expect, it } from "vitest";
import {
  buildLocationAreaConf,
  huntBotsForArea,
} from "../../../src/modules/jugger-wire/application/area-conf-block.ts";
import { Area } from "../../../src/modules/world/domain/area.ts";
import { HuntSpawn } from "../../../src/modules/world/domain/hunt-spawn.ts";
import { playableHuntBot } from "../../support/playable-bot.ts";

const huntBot = playableHuntBot();
const spawn = new HuntSpawn(50310, huntBot.id, 883, 1499, "bot_1");
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
    const huntBots = huntBotsForArea([spawn], new Map([[huntBot.id, huntBot]]));
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
          [String(huntBot.id)]: {
            id: huntBot.id,
            nick: huntBot.hunt.nick,
            level: huntBot.level,
            kind: huntBot.hunt.kind,
            speed: huntBot.hunt.speed,
            hunt_swf: huntBot.hunt.swf,
            hunt_scale: huntBot.hunt.scale,
            hunt_fps: huntBot.hunt.fps,
            avatar: huntBot.hunt.avatar,
            hide_on_map: huntBot.hunt.hideOnMap,
          },
        },
        hunt_farm: [],
      },
    });
  });

  it("fails when a spawn references a missing bot", () => {
    expect(() => huntBotsForArea([spawn], new Map())).toThrow(
      new RegExp(`Bot catalog entry ${huntBot.id} is missing`),
    );
  });
});
