import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import { AuthenticatedClient } from "../support/harness/authenticated-client.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";

describe("common conf", () => {
  let harness: ApplicationHarness;
  let application: Application;

  beforeEach(async () => {
    harness = new ApplicationHarness();
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("returns the live catalog block with state and status 100", async () => {
    const client = await AuthenticatedClient.login(application);
    const payload = await client.objectAction({ object: "common", action: "conf", sq: 2 });
    const conf = payload["common|conf"];
    if (!conf || typeof conf !== "object" || Array.isArray(conf)) {
      throw new Error("common|conf is missing");
    }
    expect(conf.status).toBe(100);
    expect(conf.gag_reason_info).toMatchObject({
      "1": { id: 1, title: "предупреждение", duration: 60 },
    });
    expect(payload.state).toMatchObject({
      area_id: "503",
      level: 1,
      money: "25.00",
      money_gold: "0.00",
    });
    expect(payload["user|view"]).toBeUndefined();
  });
});
