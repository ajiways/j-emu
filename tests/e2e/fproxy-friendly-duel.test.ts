import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import type { AmfValue } from "../../src/modules/jugger-wire/amf/amf3.ts";
import { createIsolatedHero } from "../support/harness/authenticated-client.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";
import {
  fightEventTypes,
  huntFightConfFrom,
  huntFightIdFrom,
} from "../support/harness/wire-payload.ts";

describe("fproxy friendly duel", () => {
  let harness: ApplicationHarness;
  let application: Application;

  beforeEach(async () => {
    harness = new ApplicationHarness();
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("proposes and accepts a practice duel between two heroes in 503", async () => {
    const a = await createIsolatedHero(application);
    const b = await createIsolatedHero(application);
    const initA = await a.objectAction({ object: "common", action: "init", sq: 1 });
    const initB = await b.objectAction({ object: "common", action: "init", sq: 1 });
    const nickA = nickFrom(initA);
    const nickB = nickFrom(initB);
    const propose = await a.objectAction({
      object: "user",
      action: "friendly_duel_propose",
      form: { nick: nickB },
      sq: 2,
    });
    expect(propose["user|friendly_duel_propose"]).toEqual({ status: 100 });
    const request = personalObject(await b.pollEsrv())["user|friendly_duel_request"];
    expect(request).toMatchObject({
      status: 100,
      user: { nick: nickA, id: a.accountId },
    });
    const accept = await b.objectAction({
      object: "user",
      action: "friendly_duel_accept",
      form: { nick: nickA },
      sq: 3,
    });
    expect(accept["user|friendly_duel_accept"]).toEqual({ status: 100 });
    const acceptorConf = huntFightConfFrom(accept);
    expect(confPvp(accept)).toEqual({ is_pvp: 1, type: "6" });
    const challengerEsrv = personalObject(await a.pollEsrv());
    expect(challengerEsrv["fight|conf"]).toBeDefined();
    const fightId = huntFightIdFrom(accept);
    expect(await b.fight({ rc: "auth", eid: fightId, sq: 4 })).toHaveLength(0);
    expect(await a.fight({ rc: "auth", eid: fightId, sq: 4 })).toHaveLength(0);
    const bootstrapA = await a.pollFight();
    expect(fightEventTypes(bootstrapA)).toEqual(
      expect.arrayContaining(["fightState", "persList", "oppnew", "attacknow"]),
    );
    const bootstrapB = await b.pollFight();
    expect(fightEventTypes(bootstrapB)).toEqual(
      expect.arrayContaining(["fightState", "persList", "oppnew"]),
    );
    expect(fightEventTypes(bootstrapB)).not.toContain("attacknow");
    expect(await a.fight({ rc: "castSpell", srcType: 1, srcId: 2, sq: 5 })).toHaveLength(0);
    const strike = await a.pollFight();
    expect(fightEventTypes(strike)).toEqual(expect.arrayContaining(["attackwait", "cast"]));
    await harness.elapseCombat(2500);
    const grantB = await b.pollFight();
    expect(fightEventTypes(grantB)).toContain("attacknow");
    expect(acceptorConf.fightId).toBe(fightId);
  });
});

function nickFrom(payload: Record<string, AmfValue>): string {
  const conf = payload["user|conf"];
  if (!conf || typeof conf !== "object" || Array.isArray(conf))
    throw new Error("user|conf missing");
  if (typeof conf.nick !== "string" || !conf.nick) throw new Error("user|conf.nick missing");
  return conf.nick;
}

function confPvp(payload: Record<string, AmfValue>): { is_pvp: number; type: string } {
  const fight = payload["fight|conf"];
  if (!fight || typeof fight !== "object" || Array.isArray(fight))
    throw new Error("fight|conf missing");
  const conf = fight.conf;
  if (!conf || typeof conf !== "object" || Array.isArray(conf))
    throw new Error("fight|conf.conf missing");
  if (conf.is_pvp !== 1 && conf.is_pvp !== 0) throw new Error("is_pvp missing");
  if (typeof conf.type !== "string") throw new Error("type missing");
  return { is_pvp: conf.is_pvp, type: conf.type };
}

function personalObject(packets: readonly AmfValue[]): Record<string, AmfValue> {
  for (const packet of packets) {
    if (!packet || typeof packet !== "object" || Array.isArray(packet)) continue;
    if (typeof packet.channel !== "string" || !packet.channel.startsWith("2:")) continue;
    if (!packet.object || typeof packet.object !== "object" || Array.isArray(packet.object))
      continue;
    return packet.object as Record<string, AmfValue>;
  }
  throw new Error("personal esrv object is missing");
}
