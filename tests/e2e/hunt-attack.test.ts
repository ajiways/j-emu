import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import { AuthenticatedClient } from "../support/harness/authenticated-client.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";
import { huntFightIdFrom } from "../support/harness/wire-payload.ts";

describe("hunt attack", () => {
  let harness: ApplicationHarness;
  let application: Application;

  beforeEach(async () => {
    harness = new ApplicationHarness();
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("starts a hunt fight with a flat fight|conf block", async () => {
    const client = await AuthenticatedClient.login(application);
    const start = await client.objectAction({
      object: "common",
      action: "object",
      form: { code: "ATTACK_BOT", bot_id: 2 },
      sq: 4,
    });
    expect(start["common|action"]).toEqual({ status: 100 });
    expect(start["fight|conf"]).toMatchObject({
      status: 100,
      conf: { bg: "1_1", port: 33120, instance_id: "0" },
    });
    const fightConf = start["fight|conf"] as {
      conf: { fightId: string; userId: string; instance_id: string };
    };
    expect(fightConf.conf.fightId).toMatch(/^[1-9][0-9]*$/);
    expect(fightConf.conf.userId).toMatch(/^[1-9][0-9]*$/);
    expect(Number(fightConf.conf.userId)).toBeGreaterThanOrEqual(1);
    expect(huntFightIdFrom(start)).toBe(fightConf.conf.fightId);
  });
});
