import { describe, expect, it } from "vitest";
import { Hero } from "../../../src/modules/character/domain/hero.ts";
import { buildUserView } from "../../../src/modules/jugger-wire/application/user-view-block.ts";
import { emptyBookTrio } from "../../../src/modules/jugger-wire/application/book-quest-blocks.ts";
import { buildChatConf } from "../../../src/modules/jugger-wire/application/chat-conf-block.ts";

describe("jgr-emu bootstrap sheet builders", () => {
  it("builds a naked paperdoll with live empty collections", () => {
    const hero = Hero.restore({
      id: 1,
      accountId: 9,
      nick: "Ada",
      level: 1,
      hp: 27,
      maxHp: 27,
      areaId: "503",
      moneyMinor: 2500,
    });
    expect(
      buildUserView(hero, {
        sk: 1,
        body: "armor();head(0,0,8,152);skin()",
        avatar_big: "avatar_m_set_0_gray.png",
        bag_cnt: 2,
      }),
    ).toMatchObject({
      status: 100,
      nick: "Ada",
      uid: 9,
      lvl: 1,
      artifacts: [],
      temp_effects: null,
    });
  });

  it("builds chat conf cid from the account id", () => {
    expect(
      buildChatConf(4, {
        protocol: "mpd",
        key: "EMUKEY1",
        chat_server: "https://s1.jugger.ru/esrv//emu",
      }),
    ).toEqual({
      status: 100,
      protocol: "mpd",
      cid: "4",
      key: "EMUKEY1",
      chat_server: "https://s1.jugger.ru/esrv//emu",
    });
  });

  it("builds an empty book trio like a hero with no quests", () => {
    expect(emptyBookTrio("started")["book|quest_list"]).toMatchObject({
      status: 100,
      filter_type: "started",
      quests: {},
      finished_quests_id: [],
    });
  });
});
