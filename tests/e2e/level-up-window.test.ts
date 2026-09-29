import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import type { AmfValue } from "../../src/modules/jugger-wire/amf/amf3.ts";
import { AuthenticatedClient } from "../support/harness/authenticated-client.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";
import { completeMeleeHunt } from "../support/harness/complete-melee-hunt.ts";
import { esrvObjectWith, heroIdFrom } from "../support/harness/wire-payload.ts";

describe("level-up window", () => {
  let harness: ApplicationHarness;
  let application: Application;

  beforeEach(async () => {
    harness = new ApplicationHarness();
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("sends the authored level 2 window with the hunt result, once", async () => {
    const client = await AuthenticatedClient.login(application);
    const init = await client.objectAction({ object: "common", action: "init", sq: 1 });
    await application.characterProgression.grantExperience({
      characterId: heroIdFrom(init),
      operationId: `test:${heroIdFrom(init)}:pre-level`,
      amount: 60,
    });
    await completeMeleeHunt(client, (ms) => harness.elapseCombat(ms));
    const packets = await client.pollEsrv();
    const order = packets.map((packet) => {
      const object = (packet as { object?: Record<string, unknown> }).object ?? {};
      return "common|window" in object ? "window" : "fight|exit" in object ? "exit" : "other";
    });
    expect(order.indexOf("exit")).toBeGreaterThanOrEqual(0);
    expect(order.indexOf("window")).toBeGreaterThan(order.indexOf("exit"));
    const window = esrvObjectWith(packets, "common|window")["common|window"];
    if (!window || typeof window !== "object" || Array.isArray(window)) {
      throw new Error("common|window is missing");
    }
    expect(window).toMatchObject({
      status: 100,
      title: "",
      image: "",
      width: 380,
      buttons: [{ caption: "Закрыть" }],
    });
    expect(String(window.text)).toContain("Вы достигли второго уровня!");
    const macros = Object.values(window.macroses as Record<string, Record<string, AmfValue>>);
    expect(macros.filter((m) => m.macro_type === "IMG").map((m) => m.src)).toEqual(
      expect.arrayContaining([
        "/images/data/achievements/achiv_lvl_2.png",
        "/images/data/upl/text_pozdrav.png",
      ]),
    );
    expect(
      macros
        .filter((m) => m.macro_type === "ARTIFACT_IMG")
        .map((m) => m.id)
        .sort(),
    ).toEqual([23, 24]);
    await expect(async () =>
      esrvObjectWith(await client.pollEsrv(), "common|window"),
    ).rejects.toThrow("esrv object with common|window is missing");
  });
});
