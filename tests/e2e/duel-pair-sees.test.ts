import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AmfValue } from "../../src/modules/jugger-wire/amf/amf3.ts";
import type { Application } from "../../src/app/application.ts";
import {
  AuthenticatedClient,
  createIsolatedHero,
} from "../support/harness/authenticated-client.ts";
import { FixedRandom } from "../support/fakes/fixed-random.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";
import {
  bagItemByArtikulId,
  fightEventTypes,
  huntFightIdFrom,
} from "../support/harness/wire-payload.ts";

describe("what one player does in a duel, the player across sees", () => {
  let harness: ApplicationHarness;
  let application: Application;

  beforeEach(async () => {
    harness = new ApplicationHarness(undefined, undefined, { combatRandom: new FixedRandom() });
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("shows the pocket items one drinks to the one across: the heal with its hit points, the orb with its cast", async () => {
    const a = await AuthenticatedClient.login(application);
    const b = await createIsolatedHero(application);
    const init = await a.objectAction({ object: "common", action: "init", sq: 1 });
    const pocketIds = new Map<number, number>();
    let pocketBefore: AmfValue | undefined;
    for (const art of [93, 99]) {
      const itemId = requireId(bagItemByArtikulId(init, art));
      const put = await a.objectAction({
        object: "common",
        action: "object",
        form: { code: "PUT_ON", artifact_id: itemId },
        sq: 2,
      });
      pocketBefore = put["user|pocket"];
      pocketIds.set(
        art,
        requireId(pocketItems(put["user|pocket"]).find((i) => i.artikul_id === art)),
      );
    }
    const pocketId = (art: number): number => {
      const id = pocketIds.get(art);
      if (id === undefined) throw new Error(`pocket item ${art} is missing`);
      return id;
    };
    const nickA = nickFrom(init);
    const nickB = nickFrom(await b.objectAction({ object: "common", action: "init", sq: 1 }));
    await a.objectAction({
      object: "user",
      action: "friendly_duel_propose",
      form: { nick: nickB },
      sq: 3,
    });
    await b.pollEsrv();
    const accept = await b.objectAction({
      object: "user",
      action: "friendly_duel_accept",
      form: { nick: nickA },
      sq: 3,
    });
    await a.pollEsrv();
    const fightId = huntFightIdFrom(accept);
    await b.fight({ rc: "auth", eid: fightId, sq: 4 });
    await a.fight({ rc: "auth", eid: fightId, sq: 4 });
    await a.pollFight();
    await b.pollFight();
    await a.fight({ rc: "castSpell", srcType: 2, srcId: pocketId(93), sq: 20 });
    expect(fightEventTypes(await a.pollFight())).toEqual(["effUse", "cast", "persChangeInfo"]);
    expect(fightEventTypes(await b.pollFight())).toEqual(
      expect.arrayContaining(["effUse", "cast", "persChangeInfo"]),
    );
    // A practice duel restores its fighters: what was drunk in it stays in the pocket.
    const after = await a.objectAction({ object: "common", action: "init", sq: 22 });
    const row93 = (pocket: AmfValue | undefined) =>
      JSON.stringify(pocketItems(pocket).find((row) => row.artikul_id === 93));
    expect(row93(after["user|pocket"])).toBe(row93(pocketBefore));
    await a.fight({ rc: "castSpell", srcType: 2, srcId: pocketId(99), sq: 21 });
    await a.pollFight();
    expect(fightEventTypes(await b.pollFight())).toEqual(["effUse", "cast"]);
  });
});

function objectBlock(value: AmfValue | undefined): Record<string, AmfValue> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("object expected");
  return value;
}
function pocketItems(value: AmfValue | undefined): Record<string, AmfValue>[] {
  const pocket = objectBlock(value).pocket;
  if (!Array.isArray(pocket)) throw new Error("pocket missing");
  return pocket.map((row) => objectBlock(row));
}
function requireId(item: Record<string, AmfValue> | undefined): number {
  if (!item || typeof item.id !== "number") throw new Error("item id is missing");
  return item.id;
}

function nickFrom(payload: Record<string, AmfValue>): string {
  const conf = objectBlock(payload["user|conf"]);
  if (typeof conf.nick !== "string" || !conf.nick) throw new Error("user|conf.nick missing");
  return conf.nick;
}
