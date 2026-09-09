import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import { AuthenticatedClient } from "../support/harness/authenticated-client.ts";
import { MAP_HUNT_SPAWN_ID } from "../support/harness/map-hunt-spawn.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";
import { completeMeleeHunt } from "../support/harness/complete-melee-hunt.ts";

describe("esrv exit and reconnect", () => {
  let harness: ApplicationHarness;
  let application: Application;

  beforeEach(async () => {
    harness = new ApplicationHarness();
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("pushes fight|exit and keeps hunt after restart", async () => {
    const client = await AuthenticatedClient.login(application);
    await completeMeleeHunt(client);
    const packets = await client.pollEsrv();
    const exitPacket = packets.find(
      (packet) =>
        packet !== null &&
        typeof packet === "object" &&
        !Array.isArray(packet) &&
        packet.object !== null &&
        typeof packet.object === "object" &&
        !Array.isArray(packet.object) &&
        "fight|exit" in packet.object,
    );
    expect(exitPacket).toMatchObject({
      object: { "fight|exit": { status: 100, type: 0 } },
    });

    application = await harness.restart();
    const afterRestart = new AuthenticatedClient(application, client.cookie);
    const huntAfterRestart = await afterRestart.objectAction({
      object: "common",
      action: "init2",
      sq: 21,
    });
    expect(huntAfterRestart["common|hunt"]).toMatchObject({ status: 100 });
    const startAgain = await afterRestart.objectAction({
      object: "common",
      action: "object",
      form: { code: "ATTACK_BOT", bot_id: MAP_HUNT_SPAWN_ID },
      sq: 22,
    });
    expect(startAgain["common|action"]).toEqual({ status: 100 });
  });
});
