import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import { AuthenticatedClient } from "../support/harness/authenticated-client.ts";
import { MAP_HUNT_SPAWN_ID } from "../support/harness/map-hunt-spawn.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";
import {
  framesIncludeFightFinish,
  fightEventTypes,
  huntFightIdFrom,
  huntOppNewFrom,
} from "../support/harness/wire-payload.ts";

describe("fproxy", () => {
  let harness: ApplicationHarness;
  let application: Application;

  beforeEach(async () => {
    harness = new ApplicationHarness();
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("authenticates, polls melee order, then bot counter and attacknow", async () => {
    const client = await AuthenticatedClient.login(application);
    const start = await client.objectAction({
      object: "common",
      action: "object",
      form: { code: "ATTACK_BOT", bot_id: MAP_HUNT_SPAWN_ID },
      sq: 4,
    });
    const fightId = huntFightIdFrom(start);
    expect(await client.fight({ rc: "auth", eid: fightId, sq: 5 })).toHaveLength(0);
    const authenticated = await client.pollFight();
    expect(authenticated[0]).toMatchObject({ rs: true });
    expect(fightEventTypes(authenticated)).toEqual(
      expect.arrayContaining(["fightState", "persList", "oppnew", "attacknow"]),
    );
    const opponent = huntOppNewFrom(authenticated);
    expect(opponent).toMatchObject({ et: "oppnew", nick: "Грызль", bot: true, sk: "11", team: 2 });
    expect(opponent.id).toBeGreaterThanOrEqual(1_000_000);

    const sides = [
      { srcId: 1, animation: "attack_left" },
      { srcId: 2, animation: "attack_center" },
      { srcId: 3, animation: "attack_right" },
    ] as const;
    let finished = false;
    for (let strike = 0; strike < 8 && !finished; strike += 1) {
      const side = sides[strike % sides.length];
      if (!side) throw new Error("Melee side is missing");
      expect(
        await client.fight({ rc: "castSpell", srcType: 1, srcId: side.srcId, sq: 6 + strike }),
      ).toHaveLength(0);
      const melee = await client.pollFight();
      const meleeFrame = melee[0];
      if (meleeFrame === undefined) throw new Error("Melee poll did not return a frame");
      expect(fightEventTypes([meleeFrame])).toEqual(["attackwait", "cast"]);
      expect(castAnimation(meleeFrame)).toBe(side.animation);
      expect(melee.some((frame) => frame && typeof frame === "object" && "rs" in frame)).toBe(true);
      expect(fightEventTypes(melee)).not.toContain("attacknow");
      if (framesIncludeFightFinish(melee)) {
        finished = true;
        break;
      }
      await harness.elapseCombat(1400);
      const bot = await client.pollFight();
      expect(fightEventTypes(bot)).toContain("cast");
      expect(fightEventTypes(bot)).not.toContain("attacknow");
      if (framesIncludeFightFinish(bot)) {
        finished = true;
        break;
      }
      await harness.elapseCombat(1100);
      const grant = await client.pollFight();
      expect(fightEventTypes(grant)).toEqual(["attacknow"]);
    }
    expect(finished).toBe(true);
  });
});

function castAnimation(frame: unknown): string {
  if (!frame || typeof frame !== "object" || Array.isArray(frame)) {
    throw new Error("cast frame is missing");
  }
  const ev = (frame as { ev?: Record<string, { et?: string; animData?: string }> }).ev;
  const cast = ev ? Object.values(ev).find((item) => item.et === "cast") : undefined;
  if (!cast || typeof cast.animData !== "string") throw new Error("cast animData is missing");
  return cast.animData;
}
