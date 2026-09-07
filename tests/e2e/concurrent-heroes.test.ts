import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import { AuthenticatedClient } from "../support/harness/authenticated-client.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";
import { uniqueDevelopmentSlot } from "../support/harness/unique-development-slot.ts";
import { heroIdFrom, huntFightIdFrom } from "../support/harness/wire-payload.ts";

describe("concurrent heroes", () => {
  let harness: ApplicationHarness;
  let application: Application;

  beforeEach(async () => {
    harness = new ApplicationHarness();
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("issues distinct hero and fight ids for two sessions at once", async () => {
    const slotA = uniqueDevelopmentSlot();
    let slotB = uniqueDevelopmentSlot();
    while (slotB === slotA) slotB = uniqueDevelopmentSlot();
    const [clientA, clientB] = await Promise.all([
      AuthenticatedClient.login(application, slotA),
      AuthenticatedClient.login(application, slotB),
    ]);
    const [initA, initB] = await Promise.all([
      clientA.objectAction({ object: "common", action: "init", sq: 1 }),
      clientB.objectAction({ object: "common", action: "init", sq: 1 }),
    ]);
    expect(heroIdFrom(initA)).not.toBe(heroIdFrom(initB));
    const [startA, startB] = await Promise.all([
      clientA.objectAction({
        object: "common",
        action: "object",
        form: { code: "ATTACK_BOT", bot_id: 2 },
        sq: 2,
      }),
      clientB.objectAction({
        object: "common",
        action: "object",
        form: { code: "ATTACK_BOT", bot_id: 2 },
        sq: 2,
      }),
    ]);
    expect(huntFightIdFrom(startA)).not.toBe(huntFightIdFrom(startB));
  });
});
