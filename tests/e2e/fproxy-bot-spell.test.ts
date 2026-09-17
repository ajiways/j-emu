import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import { AuthenticatedClient } from "../support/harness/authenticated-client.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";
import { fightEventTypes, huntFightIdFrom } from "../support/harness/wire-payload.ts";
import { SequenceRandom } from "../support/fakes/sequence-random.ts";

describe("fproxy bot spell", () => {
  let harness: ApplicationHarness;
  let application: Application;

  beforeEach(async () => {
    harness = new ApplicationHarness(undefined, undefined, {
      combatRandom: new SequenceRandom([1, 0.9, 0.88, 1]),
    });
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("lets Hissa 50101 cast magic_direct instead of only melee", async () => {
    const client = await AuthenticatedClient.login(application);
    await client.objectAction({ object: "common", action: "init", sq: 1 });
    const gorge = await client.objectAction({
      object: "common",
      action: "action",
      form: { code: "COME_IN", area_id: 501 },
      sq: 2,
    });
    expect(gorge["common|action"]).toEqual({ status: 100, action: "COME_IN" });
    const start = await client.objectAction({
      object: "common",
      action: "object",
      form: { code: "ATTACK_BOT", bot_id: 50101 },
      sq: 3,
    });
    const fightId = huntFightIdFrom(start);
    expect(await client.fight({ rc: "auth", eid: fightId, sq: 4 })).toHaveLength(0);
    await client.pollFight();
    expect(await client.fight({ rc: "castSpell", srcType: 1, srcId: 2, sq: 5 })).toHaveLength(0);
    await client.pollFight();
    await harness.elapseCombat(1400);
    const bot = await client.pollFight();
    expect(fightEventTypes(bot)).toEqual(expect.arrayContaining(["effUse", "cast"]));
    const castFrame = bot.find((frame) => fightEventTypes([frame]).includes("cast"));
    if (castFrame === undefined) throw new Error("Bot poll is missing a cast frame");
    expect(castAnimation(castFrame)).toBe("magic_direct");
    expect(effectUse(bot)).toMatchObject({
      et: "effUse",
      artikulId: 396,
      title: "Ядовитый плевок",
      img: "hissa_magic1.png",
      kind: 4,
      groupId: 845,
    });
  });
});

function effectUse(frames: readonly unknown[]): Record<string, unknown> {
  for (const frame of frames) {
    if (!frame || typeof frame !== "object" || Array.isArray(frame)) continue;
    const ev = (frame as { ev?: Record<string, { et?: string }> }).ev;
    const found = ev ? Object.values(ev).find((item) => item.et === "effUse") : undefined;
    if (found) return found as Record<string, unknown>;
  }
  throw new Error("Bot poll is missing effUse");
}

function castAnimation(frame: unknown): string {
  if (!frame || typeof frame !== "object" || Array.isArray(frame)) {
    throw new Error("cast frame is missing");
  }
  const ev = (frame as { ev?: Record<string, { et?: string; animData?: string }> }).ev;
  const cast = ev ? Object.values(ev).find((item) => item.et === "cast") : undefined;
  if (!cast || typeof cast.animData !== "string") throw new Error("cast animData is missing");
  return cast.animData;
}
