import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import type { AmfValue } from "../../src/modules/jugger-wire/amf/amf3.ts";
import { AuthenticatedClient } from "../support/harness/authenticated-client.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";

describe("personal details", () => {
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

  it("saves a sparse form, returns flat status 100, and keeps tutorial flags", async () => {
    const saved = await client.objectAction({
      object: "user",
      action: "save_personal_details",
      form: { pondViewLast: "0" },
      sq: 14,
    });
    expect(saved["user|save_personal_details"]).toEqual({ status: 100 });
    expect(saved["user|personal_details"]).toBeUndefined();
    expect(saved.state).toMatchObject({
      area_id: "503",
      level: 1,
      money: "25.00",
      money_gold: "0.00",
    });

    const details = await client.objectAction({
      object: "user",
      action: "personal_details",
      sq: 15,
    });
    expect(infoFrom(details["user|personal_details"])).toMatchObject({
      pondViewLast: "0",
      finished_first_fight: "1",
      tutorial2: '{"finished":true}',
    });

    const emptySave = await client.objectAction({
      object: "user",
      action: "save_personal_details",
      sq: 16,
    });
    expect(emptySave["user|save_personal_details"]).toEqual({ status: 100 });
  });

  it("keeps saved personal details after application restart", async () => {
    await client.objectAction({
      object: "user",
      action: "save_personal_details",
      form: { pondViewLast: "0", "Chat.mute": 1 },
      sq: 14,
    });
    application = await harness.restart();
    client = new AuthenticatedClient(application, client.cookie);
    const init = await client.objectAction({ object: "common", action: "init", sq: 20 });
    expect(infoFrom(init["user|personal_details"])).toMatchObject({
      pondViewLast: "0",
      "Chat.mute": 1,
      finished_first_fight: "1",
      tutorial2: '{"finished":true}',
    });
  });
});

function infoFrom(block: AmfValue | undefined): Record<string, AmfValue> {
  if (!block || typeof block !== "object" || Array.isArray(block)) {
    throw new Error("user|personal_details is missing");
  }
  const info = block["info"];
  if (!info || typeof info !== "object" || Array.isArray(info)) {
    throw new Error("user|personal_details.info is missing");
  }
  return info;
}
