import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import { AuthenticatedClient } from "../support/harness/authenticated-client.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";

describe("bootstrap chrome from jgr-emu", () => {
  let harness: ApplicationHarness;
  let application: Application;

  beforeEach(async () => {
    harness = new ApplicationHarness();
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("returns jgr-emu shapes for view, magic, chat, book trio and empty chrome lists", async () => {
    const client = await AuthenticatedClient.login(application);
    const view = await client.objectAction({ object: "user", action: "view", sq: 4 });
    expect(view["user|view"]).toMatchObject({
      status: 100,
      sk: 1,
      body: "armor();head(0,0,8,152);skin()",
      avatar_big: "avatar_m_set_0_gray.png",
      bag_cnt: 2,
      artifacts: [],
      temp_effects: null,
      juggernaut_armor: 0,
      campaigns: [],
    });
    expect(view.state).toMatchObject({ area_id: "503", money: "25.00" });

    const magic = await client.objectAction({ object: "user", action: "magic", sq: 5 });
    expect(magic["user|magic"]).toEqual({ status: 100, gloves: [] });

    const chat = await client.objectAction({ object: "chat", action: "conf", sq: 6 });
    expect(chat["chat|conf"]).toMatchObject({
      status: 100,
      protocol: "mpd",
      key: "EMUKEY1",
      chat_server: "https://s1.jugger.ru/esrv//emu",
    });
    expect((chat["chat|conf"] as { cid: string }).cid).toMatch(/^[1-9][0-9]*$/);

    const flash = await client.objectAction({ object: "user", action: "flash_message", sq: 7 });
    expect(flash["user|flash_message"]).toEqual({ status: 100 });

    const menu = await client.objectAction({
      object: "common",
      action: "menu_link_status",
      sq: 10,
    });
    expect(menu["common|menu_link_status"]).toMatchObject({
      status: 100,
      menu_links: { "3": "1465239232", "13": "1367311719" },
    });
    expect(menu.state).toBeUndefined();

    const book = await client.objectAction({
      object: "book",
      action: "quest_list",
      form: { filter_type: "started" },
      sq: 12,
    });
    expect(book["book|quest_list"]).toMatchObject({
      status: 100,
      filter_type: "started",
      quests: {},
      finished_quests_id: [],
    });
    expect(book["book|quest_targets"]).toEqual({ status: 100, target_list: [], macros_list: [] });
    expect(book["book|quest_counters"]).toEqual({ status: 100, counter_list: [] });

    const companion = await client.objectAction({
      object: "companion",
      action: "list_user_companions",
      sq: 8,
    });
    expect(companion["companion|list_user_companions"]).toEqual({ status: 100, companions: [] });
    const recipes = await client.objectAction({
      object: "craft",
      action: "user_recipes_list",
      sq: 9,
    });
    expect(recipes["craft|user_recipes_list"]).toEqual({ status: 100, recipes: [] });
    const battlepass = await client.objectAction({ object: "battlepass", action: "list", sq: 11 });
    expect(battlepass["battlepass|list"]).toEqual({ status: 100, list: [] });
    const jail = await client.objectAction({ object: "jail", action: "list", sq: 13 });
    expect(jail["jail|list"]).toEqual({ status: 100, punishments: [] });
  });
});
