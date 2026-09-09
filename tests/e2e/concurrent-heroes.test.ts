import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import type { AmfValue } from "../../src/modules/jugger-wire/amf/amf3.ts";
import { AuthenticatedClient } from "../support/harness/authenticated-client.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";
import { uniqueDevelopmentSlot } from "../support/harness/unique-development-slot.ts";
import { MAP_HUNT_SPAWN_ID } from "../support/harness/map-hunt-spawn.ts";
import { heroIdFrom, huntFightConfFrom } from "../support/harness/wire-payload.ts";

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

  it("issues distinct hero ids and lets both join spawn 50310", async () => {
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
        form: { code: "ATTACK_BOT", bot_id: MAP_HUNT_SPAWN_ID },
        sq: 2,
      }),
      clientB.objectAction({
        object: "common",
        action: "object",
        form: { code: "ATTACK_BOT", bot_id: MAP_HUNT_SPAWN_ID },
        sq: 2,
      }),
    ]);
    expect(actionStatus(startA)).toBe(100);
    expect(actionStatus(startB)).toBe(100);
    const fightA = huntFightConfFrom(startA);
    const fightB = huntFightConfFrom(startB);
    expect(fightA.fightId).toBe(fightB.fightId);
    expect(fightA.fightAkey).toBe(fightB.fightAkey);
    expect(fightA.userId).toBe(String(heroIdFrom(initA)));
    expect(fightB.userId).toBe(String(heroIdFrom(initB)));
    expect(fightA.userId).not.toBe(fightB.userId);
  });
});

function actionStatus(payload: Record<string, AmfValue>): number | undefined {
  const action = payload["common|action"];
  if (!action || typeof action !== "object" || Array.isArray(action)) return undefined;
  return typeof action.status === "number" ? action.status : undefined;
}
