import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import type { AmfValue } from "../../src/modules/jugger-wire/amf/amf3.ts";
import {
  createIsolatedHero,
  AuthenticatedClient,
} from "../support/harness/authenticated-client.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";
import { FakeClock } from "../support/fake-clock.ts";
import { ManualCombatDelay } from "../support/fakes/manual-combat-delay.ts";
import { completeMeleeHunt } from "../support/harness/complete-melee-hunt.ts";
import { heroIdFrom } from "../support/harness/wire-payload.ts";
import { uniqueDevelopmentSlot } from "../support/harness/unique-development-slot.ts";

const START_MS = 1_700_000_000_000;
const LEVEL3_EXP = 202;
const GRYZL_ID = "2";

describe("book bestiary and instances", () => {
  let harness: ApplicationHarness;
  let application: Application;
  let clock: FakeClock;

  beforeEach(async () => {
    clock = new FakeClock(START_MS);
    harness = new ApplicationHarness(clock, new ManualCombatDelay(), {
      combatBotStrength: 1,
      combatRules: { strPerDamagePoint: 1 },
    });
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("records hunt wins in bestiary_info and keeps them after restart", async () => {
    const client = await createIsolatedHero(application);
    await client.objectAction({ object: "common", action: "init", sq: 1 });
    const empty = await client.objectAction({ object: "book", action: "bestiary_info", sq: 2 });
    expect(requireRecord(empty["book|bestiary_info"], "empty bestiary")).toEqual({
      status: 100,
      bots: [],
    });
    await completeMeleeHunt(client, (ms) => harness.elapseCombat(ms), 3);
    const filled = await client.objectAction({ object: "book", action: "bestiary_info", sq: 20 });
    expect(requireRecord(filled["book|bestiary_info"], "filled bestiary")).toEqual({
      status: 100,
      bots: { [GRYZL_ID]: { id: GRYZL_ID, win_cnt: "1" } },
    });
    application = await harness.restart();
    const again = new AuthenticatedClient(application, client.cookie);
    const restored = await again.objectAction({ object: "book", action: "bestiary_info", sq: 21 });
    expect(requireRecord(restored["book|bestiary_info"], "restart bestiary")).toEqual({
      status: 100,
      bots: { [GRYZL_ID]: { id: GRYZL_ID, win_cnt: "1" } },
    });
  });

  it("lists a live ogre bind as active and the expired copy as blocked", async () => {
    const client = await AuthenticatedClient.login(application, uniqueDevelopmentSlot());
    const init = await client.objectAction({ object: "common", action: "init", sq: 1 });
    await grantLevel3(application, heroIdFrom(init));
    const gorge = await client.objectAction({
      object: "common",
      action: "action",
      form: { code: "COME_IN", area_id: 501 },
      sq: 2,
    });
    expect(requireRecord(gorge.state, "gorge").area_id).toBe("501");
    clock.advanceSeconds(15);
    const entered = await client.objectAction({
      object: "common",
      action: "action",
      form: { code: "COME_IN", area_id: 542 },
      sq: 4,
    });
    expect(requireRecord(entered.state, "ogre").area_id).toBe("542");
    const live = await client.objectAction({ object: "book", action: "instances", sq: 5 });
    expect(requireRecord(live["book|instances"], "live book")).toEqual({
      status: 100,
      active: { "0": { artikul_id: "1" } },
      blocked: [],
    });
    await harness.elapseCombat(3_600_000 + 15_000);
    const expired = await client.objectAction({ object: "book", action: "instances", sq: 6 });
    expect(requireRecord(expired["book|instances"], "expired book")).toEqual({
      status: 100,
      active: [],
      blocked: { "0": { artikul_id: "1", dtime: Math.floor(START_MS / 1000) + 15 + 3600 } },
    });
  });
});

async function grantLevel3(application: Application, characterId: number): Promise<void> {
  const granted = await application.characterProgression.grantExperience({
    characterId,
    operationId: `book:${characterId}:l3`,
    amount: LEVEL3_EXP,
  });
  if (granted.levelAfter !== 3) {
    throw new Error(`Expected level 3 after ${LEVEL3_EXP} EXP, got ${granted.levelAfter}`);
  }
}

function requireRecord(value: AmfValue | undefined, label: string): Record<string, AmfValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
}
