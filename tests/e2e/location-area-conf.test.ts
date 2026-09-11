import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import type { AmfValue } from "../../src/modules/jugger-wire/amf/amf3.ts";
import { AuthenticatedClient } from "../support/harness/authenticated-client.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";

describe("location area_conf", () => {
  let harness: ApplicationHarness;
  let application: Application;

  beforeEach(async () => {
    harness = new ApplicationHarness();
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("returns nested forestvillage area_conf and array hunt on init2", async () => {
    const client = await AuthenticatedClient.login(application);
    const init2 = await client.objectAction({ object: "common", action: "init2", sq: 2 });
    const areaConf = requireRecord(init2["common|area_conf"], "common|area_conf");
    expect(areaConf.status).toBe(100);
    expect(areaConf.area_ftime).toBe(0);
    const nested = requireRecord(areaConf["area_conf"], "common|area_conf.area_conf");
    expect(nested).toMatchObject({
      area_id: "503",
      title: "Горное поселение",
      swf: "forestvillage.swf",
      region_map: "radvei_map.swf",
      ftime_max: 0,
      client_data: "",
      context: "4",
      hide_running_fights: 1,
    });
    expect(nested.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 5,
          title: "Деревенская лавка",
          flags: 8,
          to_id: "504",
        }),
        expect.objectContaining({
          id: 7,
          title: "Ущелье разлуки",
          flags: 0,
          to_id: "501",
        }),
      ]),
    );
    expect(nested.hunt_farm).toEqual([]);
    const huntBots = requireRecord(nested["hunt_bots"], "area_conf.hunt_bots");
    expect(huntBots["2"]).toMatchObject({
      id: 2,
      nick: "Грызл",
      hunt_swf: "gryzl1.swf",
      hunt_scale: 90,
    });

    const hunt = requireRecord(init2["common|hunt"], "common|hunt");
    expect(hunt.status).toBe(100);
    if (!Array.isArray(hunt.bots)) throw new Error("common|hunt.bots must be an array");
    expect(hunt.bots).toEqual([
      {
        id: 50309,
        artikul_id: 4,
        fight_id: 0,
        hunt_mask: "bot_1",
        position_x: 935,
        position_y: 1260,
        prev_x: 922,
        prev_y: 1401,
      },
      {
        id: 50310,
        artikul_id: 2,
        fight_id: 0,
        hunt_mask: "bot_1",
        position_x: 883,
        position_y: 1499,
        prev_x: 883,
        prev_y: 1499,
      },
    ]);
  });
});

function requireRecord(value: AmfValue | undefined, label: string): Record<string, AmfValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} is missing`);
  }
  return value;
}
