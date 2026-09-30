import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import { AuthenticatedClient } from "../support/harness/authenticated-client.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";
import { FixedRandom } from "../support/fakes/fixed-random.ts";
import { fightEventTypes, huntFightIdFrom } from "../support/harness/wire-payload.ts";

describe("scripted fight scenarios from chat", () => {
  let harness: ApplicationHarness;
  let application: Application;

  beforeEach(async () => {
    harness = new ApplicationHarness(undefined, undefined, { combatRandom: new FixedRandom() });
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("starts the named scenario from a chat message and puts the hero in its fight", async () => {
    const client = await AuthenticatedClient.login(application);
    const sent = await client.objectAction({
      object: "chat",
      action: "add",
      form: { message: "/scenario dot-lethal-tick", type: "main" },
      sq: 2,
    });
    expect(sent["chat|add"]).toEqual({ status: 100 });
    const fightId = huntFightIdFrom(sent);
    expect(await client.fight({ rc: "auth", eid: fightId, sq: 3 })).toHaveLength(0);
  });

  it("dot-lethal-tick kills the hero with a DoT tick, not with a bot strike", async () => {
    const client = await AuthenticatedClient.login(application);
    const sent = await client.objectAction({
      object: "chat",
      action: "add",
      form: { message: "/scenario dot-lethal-tick", type: "main" },
      sq: 2,
    });
    const fightId = huntFightIdFrom(sent);
    await client.fight({ rc: "auth", eid: fightId, sq: 3 });
    await client.pollFight();
    let sawTickBeforeFinish = false;
    let finished = false;
    for (let turn = 0; turn < 6 && !finished; turn += 1) {
      await client.fight({ rc: "castSpell", srcType: 1, srcId: 2, sq: 4 + turn });
      await client.pollFight();
      await harness.elapseCombat(2500);
      const types = fightEventTypes(await client.pollFight());
      finished = types.includes("fightFinish");
      if (finished) sawTickBeforeFinish = types.includes("hpChange");
    }
    expect(finished).toBe(true);
    expect(sawTickBeforeFinish).toBe(true);
  });

  it("stun-by-bot skips the hero's next two turns while the bot keeps striking", async () => {
    const client = await startScenario("stun-by-bot");
    await client.fight({ rc: "castSpell", srcType: 1, srcId: 2, sq: 4 });
    const seen: string[][] = [];
    for (let second = 0; second < 15; second += 1) {
      await harness.elapseCombat(1000);
      const types = fightEventTypes(await client.pollFight());
      if (types.length > 0) seen.push(types);
      if (types.includes("attacknow")) break;
    }
    expect(seen.at(-1)).toEqual(["attacknow"]);
    const botCasts = seen.filter((types) => types.includes("cast")).length;
    expect(botCasts).toBeGreaterThanOrEqual(4);
  });

  it("answers an unknown scenario with a system line and starts no fight", async () => {
    const client = await AuthenticatedClient.login(application);
    const sent = await client.objectAction({
      object: "chat",
      action: "add",
      form: { message: "/scenario no-such-scenario", type: "main" },
      sq: 2,
    });
    expect(sent["chat|add"]).toEqual({ status: 100 });
    expect(sent["fight|conf"]).toBeUndefined();
  });

  async function startScenario(name: string): Promise<AuthenticatedClient> {
    const client = await AuthenticatedClient.login(application);
    const sent = await client.objectAction({
      object: "chat",
      action: "add",
      form: { message: `/scenario ${name}`, type: "main" },
      sq: 2,
    });
    await client.fight({ rc: "auth", eid: huntFightIdFrom(sent), sq: 3 });
    await client.pollFight();
    return client;
  }
});
