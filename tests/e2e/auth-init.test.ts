import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import type { AmfValue } from "../../src/modules/jugger-wire/amf/amf3.ts";
import { AuthenticatedClient } from "../support/harness/authenticated-client.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";
import { bagItemIdFrom, firstBagItemFrom, heroIdFrom } from "../support/harness/wire-payload.ts";

describe("auth and init", () => {
  let harness: ApplicationHarness;
  let application: Application;
  let client: AuthenticatedClient;

  beforeEach(async () => {
    harness = new ApplicationHarness();
    application = await harness.start();
    client = await AuthenticatedClient.login(application);
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("serves cookies on game.php 200 and a flat init with nested bag", async () => {
    const init = await client.objectAction({ object: "common", action: "init", sq: 1 });
    expect(init["common|init"]).toEqual({ status: 100 });
    expect(init["user|bag"]).toMatchObject({ status: 100, amount: 1 });
    expect((init["common|init"] as Record<string, AmfValue>)["user|bag"]).toBeUndefined();
    const bagItem = firstBagItemFrom(init);
    if (typeof bagItem.id !== "number") throw new Error("bag item id must be a number");
    expect(bagItem.id).toBeGreaterThanOrEqual(1_000_000_000);
    expect(bagItem.id).toBeLessThanOrEqual(2_147_483_647);

    const bagOnly = await client.objectAction({ object: "user", action: "bag", sq: 11 });
    expect(bagOnly["user|bag"]).toMatchObject({ status: 100, amount: 1 });
    expect(bagOnly["common|init"]).toBeUndefined();

    const init2 = await client.objectAction({ object: "common", action: "init2", sq: 2 });
    expect(init2["common|hunt"]).toMatchObject({ status: 100 });
  });

  it("keeps the same hero and bag item after application restart", async () => {
    const init = await client.objectAction({ object: "common", action: "init", sq: 1 });
    const heroId = heroIdFrom(init);
    const itemId = bagItemIdFrom(init);
    application = await harness.restart();
    client = new AuthenticatedClient(application, client.cookie);
    const afterRestart = await client.objectAction({ object: "common", action: "init", sq: 20 });
    expect(heroIdFrom(afterRestart)).toBe(heroId);
    expect(bagItemIdFrom(afterRestart)).toBe(itemId);
    const huntAfterRestart = await client.objectAction({
      object: "common",
      action: "init2",
      sq: 21,
    });
    expect(huntAfterRestart["common|hunt"]).toMatchObject({ status: 100 });
  });
});
