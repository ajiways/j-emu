import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import type { AmfValue } from "../../src/modules/jugger-wire/amf/amf3.ts";
import { AuthenticatedClient } from "../support/harness/authenticated-client.ts";
import { MAP_HUNT_SPAWN_ID } from "../support/harness/map-hunt-spawn.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";
import { bagItemByArtikulId, huntFightIdFrom } from "../support/harness/wire-payload.ts";
import { NAKED_HERO_BODY, wornHeroBodyFromGenerated } from "../support/worn-hero-body.ts";

const GLOVE_BODY = wornHeroBodyFromGenerated(9095);

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
      form: { code: "ATTACK_BOT", bot_id: MAP_HUNT_SPAWN_ID },
      sq: 4,
    });
    expect(start["common|action"]).toEqual({ status: 100 });
    expect(start["fight|conf"]).toMatchObject({
      status: 100,
      conf: {
        bg: "2_1",
        port: 33120,
        instance_id: "0",
        proxy: "https://s1.jugger.ru/fproxy//;",
        persSelf_sk: 1,
        persSelf_body: NAKED_HERO_BODY,
      },
    });
    const fightConf = start["fight|conf"] as {
      conf: { fightId: string; userId: string; instance_id: string };
    };
    expect(fightConf.conf.fightId).toMatch(/^[1-9][0-9]*$/);
    expect(fightConf.conf.userId).toMatch(/^[1-9][0-9]*$/);
    expect(Number(fightConf.conf.userId)).toBeGreaterThanOrEqual(1);
    expect(huntFightIdFrom(start)).toBe(fightConf.conf.fightId);
  });

  it("puts worn Unity overlay into fight|conf.persSelf_body", async () => {
    const client = await AuthenticatedClient.login(application);
    const init = await client.objectAction({ object: "common", action: "init", sq: 1 });
    const itemId = requireNumber(bagItemByArtikulId(init, 9095).id);
    const putOn = await client.objectAction({
      object: "common",
      action: "action",
      form: { code: "PUT_ON", artifact_id: itemId },
      sq: 2,
    });
    expect(putOn["common|action"]).toEqual({ status: 100 });
    const start = await client.objectAction({
      object: "common",
      action: "object",
      form: { code: "ATTACK_BOT", bot_id: MAP_HUNT_SPAWN_ID },
      sq: 3,
    });
    expect(start["common|action"]).toEqual({ status: 100 });
    expect(confBlock(start["fight|conf"]).persSelf_body).toBe(GLOVE_BODY);
    expect(confBlock(start["fight|conf"]).persSelf_sk).toBe(1);
  });
});

function confBlock(value: AmfValue | undefined): Record<string, AmfValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("fight|conf is missing");
  }
  const conf = value.conf;
  if (!conf || typeof conf !== "object" || Array.isArray(conf)) {
    throw new Error("fight|conf.conf is missing");
  }
  return conf;
}

function requireNumber(value: AmfValue | undefined): number {
  if (typeof value !== "number") throw new Error("expected a number");
  return value;
}
