import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import { createIsolatedHero } from "../support/harness/authenticated-client.ts";
import { FixedRandom } from "../support/fakes/fixed-random.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";
import {
  putOnStarterGloveIfInBag,
  strikeUntilHuntFinish,
} from "../support/harness/complete-melee-hunt.ts";
import { MAP_HUNT_SPAWN_ID } from "../support/harness/map-hunt-spawn.ts";
import { huntFightIdFrom, personalEsrvObject } from "../support/harness/wire-payload.ts";

describe("walking out of a fight that goes on", () => {
  let harness: ApplicationHarness;
  let application: Application;

  beforeEach(async () => {
    harness = new ApplicationHarness(undefined, undefined, {
      combatBotStrength: 1,
      combatRules: { strPerDamagePoint: 3 },
      combatRandom: new FixedRandom(),
    });
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("gets the exit at once, cannot come back, and is paid when the fight ends", async () => {
    const a = await createIsolatedHero(application);
    const b = await createIsolatedHero(application);
    await a.objectAction({ object: "common", action: "init", sq: 1 });
    await b.objectAction({ object: "common", action: "init", sq: 1 });
    const sqA = await putOnStarterGloveIfInBag(a, 2);
    const sqB = await putOnStarterGloveIfInBag(b, 2);
    const attack = { code: "ATTACK_BOT", bot_id: MAP_HUNT_SPAWN_ID };
    const start = await a.objectAction({
      object: "common",
      action: "object",
      form: attack,
      sq: sqA,
    });
    const fightId = huntFightIdFrom(start);
    await a.fight({ rc: "auth", eid: fightId, sq: sqA + 1 });
    await a.pollFight();
    const joined = await b.objectAction({
      object: "common",
      action: "object",
      form: attack,
      sq: sqB,
    });
    expect(huntFightIdFrom(joined)).toBe(fightId);
    await b.fight({ rc: "auth", eid: fightId, sq: sqB + 1 });
    await b.pollFight();
    // The opener lands a blow, then walks out while his ally takes over.
    await a.fight({ rc: "castSpell", srcType: 1, srcId: 2, sq: sqA + 2 });
    await a.pollFight();
    expect(await a.fight({ rc: "leaveFight", sq: sqA + 3 })).toEqual([{ rs: true, sq: sqA + 3 }]);
    const exit = personalEsrvObject(await a.pollEsrv())["fight|exit"];
    expect(exit).toMatchObject({ flee: true, status: 100 });
    const info = await a.objectAction({ object: "fight", action: "finish", sq: sqA + 4 });
    expect(Object.keys(info)).toContain("fight|info");
    // Attacking the same mob again does not put him back into the fight he left.
    const again = await a.objectAction({
      object: "common",
      action: "object",
      form: attack,
      sq: sqA + 5,
    });
    expect(again["common|action"]).toEqual({
      status: 203,
      error: "вы уже участвовали в этом бою",
    });
    await harness.elapseCombat(3000);
    await b.pollFight();
    await strikeUntilHuntFinish(b, (ms) => harness.elapseCombat(ms), sqB + 2);
    await harness.elapseCombat(5000);
    const packets = await a.pollEsrv();
    const paid = personalEsrvObject(packets);
    expect(JSON.stringify(packets)).toContain("Окончен бой");
    expect(paid["fight|loot"]).toMatchObject({ status: 100, experience: 8 });
  });

  it("lets a player who waits for a foe use «Концентрация» on the mob, once per cooldown", async () => {
    const a = await createIsolatedHero(application);
    const b = await createIsolatedHero(application);
    await a.objectAction({ object: "common", action: "init", sq: 1 });
    await b.objectAction({ object: "common", action: "init", sq: 1 });
    const attack = { code: "ATTACK_BOT", bot_id: MAP_HUNT_SPAWN_ID };
    const start = await a.objectAction({ object: "common", action: "object", form: attack, sq: 2 });
    const fightId = huntFightIdFrom(start);
    await a.fight({ rc: "auth", eid: fightId, sq: 3 });
    await a.pollFight();
    await b.objectAction({ object: "common", action: "object", form: attack, sq: 2 });
    await b.fight({ rc: "auth", eid: fightId, sq: 3 });
    await b.pollFight();
    // «Удар в спину» (srcId 5) is the native «Концентрация»: b has no foe yet.
    await b.fight({ rc: "castSpell", srcType: 1, srcId: 5, sq: 4 });
    const first = JSON.stringify(await b.pollFight());
    expect(first).toContain("magic_backstab");
    await b.fight({ rc: "castSpell", srcType: 1, srcId: 5, sq: 5 });
    expect(JSON.stringify(await b.pollFight())).not.toContain("magic_backstab");
    // The others see the mob's hit points drop.
    expect(JSON.stringify(await a.pollFight())).toContain('"et":"persChangeInfo"');
  });
});
