import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import { decodeAmf3, encodeAmf3 } from "../../src/modules/jugger-wire/amf/amf3.ts";
import { decodeFrames } from "../../src/modules/jugger-wire/amf/framing.ts";
import { AuthenticatedClient } from "../support/harness/authenticated-client.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";

describe("command protocol errors", () => {
  let harness: ApplicationHarness;
  let application: Application;

  beforeEach(async () => {
    harness = new ApplicationHarness();
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("returns status 4 without a session", async () => {
    const oa = await application.http.inject({
      method: "POST",
      url: "/entry_point.php",
      headers: { "content-type": "application/octet-stream" },
      payload: encodeAmf3({ object: "common", action: "init", sq: 1 }),
    });
    expect(decodeAmf3(oa.rawPayload)).toEqual({
      "common|init": { status: 4, error: "No active session" },
      sq: 1,
    });

    const fight = await application.http.inject({
      method: "POST",
      url: "/fproxy/",
      headers: { "content-type": "application/octet-stream" },
      payload: encodeAmf3({ rc: "auth", eid: "1", sq: 1 }),
    });
    expect(decodeFrames(fight.rawPayload)).toEqual([{ rs: false, error: "No active session" }]);

    const esrv = await application.http.inject({
      method: "POST",
      url: "/esrv/poll",
      headers: { "content-type": "application/octet-stream" },
      payload: Buffer.alloc(0),
    });
    expect(decodeFrames(esrv.rawPayload)).toEqual([
      {
        channel: "2:unauthenticated",
        ctime: 0,
        object: { "common|dummy": { status: 4, error: "No active session" } },
      },
    ]);
  });

  it("returns status 204 for a malformed OA payload", async () => {
    const client = await AuthenticatedClient.login(application);
    const response = await application.http.inject({
      method: "POST",
      url: "/entry_point.php",
      headers: { cookie: client.cookie, "content-type": "application/octet-stream" },
      payload: Buffer.from([0xff]),
    });
    expect(decodeAmf3(response.rawPayload)).toEqual({
      "common|unknown": { status: 204, error: "Unsupported AMF3 marker 0xff" },
      sq: null,
    });
  });

  it("returns status 203 for an unknown common|object code", async () => {
    const client = await AuthenticatedClient.login(application);
    const response = await client.objectAction({
      object: "common",
      action: "object",
      form: { code: "OPEN_WINDOW" },
      sq: 9,
    });
    expect(response).toEqual({
      "common|action": {
        status: 203,
        error: "common|object code OPEN_WINDOW is not implemented",
      },
      sq: 9,
    });
  });

  it("returns status 203 when ATTACK_BOT is missing bot_id or form", async () => {
    const client = await AuthenticatedClient.login(application);
    const missingForm = await client.objectAction({
      object: "common",
      action: "action",
      sq: 10,
    });
    expect(missingForm).toEqual({
      "common|action": { status: 203, error: "common|object requires form" },
      sq: 10,
    });

    const missingBot = await client.objectAction({
      object: "common",
      action: "object",
      form: { code: "ATTACK_BOT" },
      sq: 11,
    });
    expect(missingBot).toEqual({
      "common|action": { status: 203, error: "ATTACK_BOT requires bot_id" },
      sq: 11,
    });
  });

  it("returns rs:false for an unsupported fproxy command", async () => {
    const client = await AuthenticatedClient.login(application);
    expect(await client.fight({ rc: "nope", sq: 1 })).toEqual([
      { rs: false, error: "Fight command nope is unsupported" },
    ]);
  });
});
