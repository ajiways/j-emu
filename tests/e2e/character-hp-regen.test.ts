import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import type { AmfValue } from "../../src/modules/jugger-wire/amf/amf3.ts";
import { AuthenticatedClient } from "../support/harness/authenticated-client.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";
import { FakeClock } from "../support/fake-clock.ts";
import { bagItemIdFrom, heroIdFrom } from "../support/harness/wire-payload.ts";

const START_MS = 1_700_000_000_000;

describe("character HP regeneration", () => {
  let harness: ApplicationHarness;
  let application: Application;
  let clock: FakeClock;

  beforeEach(async () => {
    clock = new FakeClock(START_MS);
    harness = new ApplicationHarness(clock);
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("shows noted HP and remaining hp_time on init, init2 and unitframe", async () => {
    const client = await AuthenticatedClient.login(application);
    const init = await client.objectAction({ object: "common", action: "init", sq: 1 });
    const characterId = heroIdFrom(init);
    const noted = await application.characterResources.noteHp({ characterId, hp: 1 });
    expect(noted).toMatchObject({ hp: 1, hpTime: 3, persisted: true });

    const afterNote = await client.objectAction({ object: "common", action: "init", sq: 2 });
    expect(objectBlock(afterNote.state)).toMatchObject({ hp: 1 });
    const init2 = await client.objectAction({ object: "common", action: "init2", sq: 3 });
    expect(objectBlock(init2["user|unitframe"])).toMatchObject({
      hp: 1,
      hpMax: 10,
      hp_time: 3,
      mp_time: 0,
    });
    const frame = await client.objectAction({ object: "user", action: "unitframe", sq: 4 });
    expect(objectBlock(frame["user|unitframe"])).toMatchObject({
      hp: 1,
      hpMax: 10,
      hp_time: 3,
      mp_time: 0,
    });
  });

  it("advances HP on a fake clock that survives harness restart", async () => {
    const client = await AuthenticatedClient.login(application);
    const init = await client.objectAction({ object: "common", action: "init", sq: 1 });
    const characterId = heroIdFrom(init);
    await application.characterResources.noteHp({ characterId, hp: 1 });
    clock.advanceSeconds(1);
    application = await harness.restart();
    const again = new AuthenticatedClient(application, client.cookie);
    const frame = await again.objectAction({ object: "user", action: "unitframe", sq: 20 });
    expect(objectBlock(frame["user|unitframe"])).toMatchObject({
      hp: 3,
      hp_time: 3,
      mp_time: 0,
    });
  });

  it("syncs HP before ATTACK_BOT and overlays hp_time to 0", async () => {
    const client = await AuthenticatedClient.login(application);
    const init = await client.objectAction({ object: "common", action: "init", sq: 1 });
    const characterId = heroIdFrom(init);
    await application.characterResources.noteHp({ characterId, hp: 1 });
    clock.advanceSeconds(1);
    const start = await client.objectAction({
      object: "common",
      action: "object",
      form: { code: "ATTACK_BOT", bot_id: 2 },
      sq: 4,
    });
    expect(objectBlock(start["user|unitframe"])).toMatchObject({
      hp: 3,
      hp_time: 0,
      mp_time: 0,
    });
  });

  it("recomputes hp_time after PUT_ON without instantly filling HP", async () => {
    const client = await AuthenticatedClient.login(application);
    const init = await client.objectAction({ object: "common", action: "init", sq: 1 });
    const characterId = heroIdFrom(init);
    await application.characterResources.noteHp({ characterId, hp: 1 });
    const itemId = bagItemIdFrom(init);
    const worn = await client.objectAction({
      object: "common",
      action: "action",
      form: { code: "PUT_ON", artifact_id: itemId },
      sq: 5,
    });
    const frame = objectBlock(worn["user|unitframe"]);
    expect(frame.hp).toBeGreaterThanOrEqual(1);
    expect(frame.hp).toBeLessThan(frame.hpMax as number);
    expect(frame.hp_time).toBeGreaterThan(0);
    expect(frame.mp_time).toBe(0);
  });

  it("returns status 204 when the clock goes before regen_at", async () => {
    const client = await AuthenticatedClient.login(application);
    const init = await client.objectAction({ object: "common", action: "init", sq: 1 });
    const characterId = heroIdFrom(init);
    await application.characterResources.noteHp({ characterId, hp: 1 });
    clock.rewindSeconds(1);
    const regression = {
      status: 204,
      error: "Clock regression: unix second 1699999999 is before regen_at 1700000000",
    };
    expect(await client.objectAction({ object: "common", action: "init", sq: 6 })).toEqual({
      "common|init": regression,
      sq: 6,
    });
    expect(await client.objectAction({ object: "user", action: "unitframe", sq: 7 })).toEqual({
      "user|unitframe": regression,
      sq: 7,
    });
  });
});

function objectBlock(value: AmfValue | undefined): Record<string, AmfValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("expected object block");
  }
  return value;
}
