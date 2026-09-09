import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import { AuthenticatedClient } from "../support/harness/authenticated-client.ts";
import { MAP_HUNT_SPAWN_ID } from "../support/harness/map-hunt-spawn.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";
import { loadFinishedFightByWireId } from "../support/postgres/finished-fight-rows.ts";
import { bagItemIdFrom, heroIdFrom, huntFightIdFrom } from "../support/harness/wire-payload.ts";

describe("combat restart", () => {
  let harness: ApplicationHarness;
  let application: Application;

  beforeEach(async () => {
    harness = new ApplicationHarness();
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("drops a mid-fight battle without history or persistent side effects", async () => {
    const client = await AuthenticatedClient.login(application);
    const init = await client.objectAction({ object: "common", action: "init", sq: 1 });
    const heroId = heroIdFrom(init);
    const itemId = bagItemIdFrom(init);
    const hp = (init.state as { hp: number }).hp;
    const start = await client.objectAction({
      object: "common",
      action: "object",
      form: { code: "ATTACK_BOT", bot_id: MAP_HUNT_SPAWN_ID },
      sq: 4,
    });
    const fightId = huntFightIdFrom(start);
    expect(await client.fight({ rc: "auth", eid: fightId, sq: 5 })).toHaveLength(0);
    await client.pollFight();
    expect(await loadFinishedFightByWireId(fightId)).toBeNull();

    application = await harness.restart();
    const afterRestart = new AuthenticatedClient(application, client.cookie);
    const again = await afterRestart.objectAction({ object: "common", action: "init", sq: 20 });
    expect(heroIdFrom(again)).toBe(heroId);
    expect(bagItemIdFrom(again)).toBe(itemId);
    expect((again.state as { hp: number }).hp).toBe(hp);
    expect(await loadFinishedFightByWireId(fightId)).toBeNull();

    const hunt = await afterRestart.objectAction({
      object: "common",
      action: "object",
      form: { code: "ATTACK_BOT", bot_id: MAP_HUNT_SPAWN_ID },
      sq: 22,
    });
    expect(hunt["common|action"]).toEqual({ status: 100 });
    expect(huntFightIdFrom(hunt)).not.toBe(fightId);
  });
});
