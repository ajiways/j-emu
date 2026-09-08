import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import { AuthenticatedClient } from "../support/harness/authenticated-client.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";

describe("user unitframe", () => {
  let harness: ApplicationHarness;
  let application: Application;

  beforeEach(async () => {
    harness = new ApplicationHarness();
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("returns the live HUD block with state and status 100", async () => {
    const client = await AuthenticatedClient.login(application);
    const payload = await client.objectAction({ object: "user", action: "unitframe", sq: 3 });
    const unitframe = payload["user|unitframe"];
    if (!unitframe || typeof unitframe !== "object" || Array.isArray(unitframe)) {
      throw new Error("user|unitframe is missing");
    }
    expect(unitframe).toMatchObject({
      status: 100,
      level: 1,
      hp: 10,
      hpMax: 10,
      mp: 12,
      mpMax: 12,
      exp: 1,
      expMin: 0,
      expMax: 68,
      revengeMax: "300",
      avatar_small: "avatar_m_set_0_gray_sm.png",
      fight_id: 0,
    });
    expect(unitframe).not.toHaveProperty("id");
    expect(unitframe).not.toHaveProperty("maxHp");
    expect(payload.state).toMatchObject({
      area_id: "503",
      level: 1,
      money: "25.00",
    });
    expect(payload["user|view"]).toBeUndefined();
  });
});
