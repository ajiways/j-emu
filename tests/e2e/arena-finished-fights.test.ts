import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import type { AmfValue } from "../../src/modules/jugger-wire/amf/amf3.ts";
import {
  AuthenticatedClient,
  createIsolatedHero,
} from "../support/harness/authenticated-client.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";
import {
  completeMeleeHunt,
  putOnStarterGloveIfInBag,
  strikeUntilPvpFinish,
} from "../support/harness/complete-melee-hunt.ts";
import { heroIdFrom, huntFightIdFrom } from "../support/harness/wire-payload.ts";

describe("arena finished fights", () => {
  let harness: ApplicationHarness;
  let application: Application;

  beforeEach(async () => {
    harness = new ApplicationHarness(undefined, undefined, {
      combatRules: { strPerDamagePoint: 1 },
    });
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("lists type 6 practice history in the current area after a duel", async () => {
    const a = await createIsolatedHero(application);
    const b = await createIsolatedHero(application);
    const initA = await a.objectAction({ object: "common", action: "init", sq: 1 });
    const initB = await b.objectAction({ object: "common", action: "init", sq: 1 });
    const nickA = nickFrom(initA);
    const nickB = nickFrom(initB);
    const heroA = heroIdFrom(initA);
    await putOnStarterGloveIfInBag(a, 2);
    await putOnStarterGloveIfInBag(b, 2);
    await a.objectAction({
      object: "user",
      action: "friendly_duel_propose",
      form: { nick: nickB },
      sq: 4,
    });
    const accept = await b.objectAction({
      object: "user",
      action: "friendly_duel_accept",
      form: { nick: nickA },
      sq: 5,
    });
    const fightId = huntFightIdFrom(accept);
    expect(await b.fight({ rc: "auth", eid: fightId, sq: 6 })).toHaveLength(0);
    expect(await a.fight({ rc: "auth", eid: fightId, sq: 6 })).toHaveLength(0);
    await a.pollFight();
    await b.pollFight();
    await strikeUntilPvpFinish(a, b, (ms) => harness.elapseCombat(ms), 7);

    const listed = await a.objectAction({
      object: "arena",
      action: "finished_fights",
      form: { type: 6, page: 1 },
      sq: 50,
    });
    const block = requireRecord(listed["arena|finished_fights"], "arena|finished_fights");
    expect(block.status).toBe(100);
    const fights = amfList(block.fights, "fights");
    const practice = fights.find((row) => requireRecord(row, "fight").type === 6);
    expect(requireRecord(practice, "practice fight")).toMatchObject({
      id: Number(fightId),
      type: 6,
      title: `Нападение ${nickA} на ${nickB}`,
      winner: "1",
    });
    const teams = requireRecord(requireRecord(practice, "practice fight").teams, "teams");
    expect(requireRecord(amfList(teams["1"], "team 1")[0], "challenger")).toMatchObject({
      id: heroA,
      nick: nickA,
      bot: 0,
      me: 1,
    });
    expect(requireRecord(amfList(teams["2"], "team 2")[0], "acceptor")).toMatchObject({
      nick: nickB,
      bot: 0,
      me: 0,
    });

    const typed = await a.objectAction({
      object: "arena",
      action: "finished_fights",
      form: { type: 6, nick: nickA, page: 1 },
      sq: 51,
    });
    const typedFights = amfList(
      requireRecord(typed["arena|finished_fights"], "typed").fights,
      "typed fights",
    );
    expect(typedFights).toHaveLength(1);
    expect(requireRecord(typedFights[0], "typed practice")).toMatchObject({
      id: Number(fightId),
      type: 6,
    });

    await application.characterLocation.setArea({
      characterId: heroA,
      areaId: "552",
      moveReadyAt: null,
      instanceCopyId: null,
    });
    const moved = await a.objectAction({
      object: "arena",
      action: "finished_fights",
      form: { page: 1 },
      sq: 52,
    });
    expect(requireRecord(moved["arena|finished_fights"], "moved").total_items).toBe(0);

    application = await harness.restart();
    const again = new AuthenticatedClient(application, a.cookie);
    await again.objectAction({ object: "common", action: "init", sq: 60 });
    await application.characterLocation.setArea({
      characterId: heroA,
      areaId: "503",
      moveReadyAt: null,
      instanceCopyId: null,
    });
    const restored = await again.objectAction({
      object: "arena",
      action: "finished_fights",
      form: { type: 6, nick: nickA, page: 1 },
      sq: 61,
    });
    const restoredFights = amfList(
      requireRecord(restored["arena|finished_fights"], "restored").fights,
      "restored fights",
    );
    const restoredPractice = restoredFights.find(
      (row) => requireRecord(row, "restored row").id === Number(fightId),
    );
    expect(requireRecord(restoredPractice, "restored practice")).toMatchObject({
      id: Number(fightId),
      type: 6,
    });
  });

  it("lists a finished hunt as type 1 on the same area board", async () => {
    const client = await AuthenticatedClient.login(application);
    const init = await client.objectAction({ object: "common", action: "init", sq: 1 });
    const nick = nickFrom(init);
    const fightId = await completeMeleeHunt(client, (ms) => harness.elapseCombat(ms));
    const listed = await client.objectAction({
      object: "arena",
      action: "finished_fights",
      form: { nick, type: 1, page: 1 },
      sq: 20,
    });
    const fights = amfList(
      requireRecord(listed["arena|finished_fights"], "arena|finished_fights").fights,
      "fights",
    );
    const hunt = fights.find((row) => requireRecord(row, "fight").id === Number(fightId));
    const huntRow = requireRecord(hunt, "hunt fight");
    expect(huntRow).toMatchObject({
      id: Number(fightId),
      type: 1,
    });
    const teams = requireRecord(huntRow.teams, "hunt teams");
    expect(requireRecord(amfList(teams["2"], "team 2")[0], "bot")).toMatchObject({
      bot: 1,
      artikul_id: "2",
    });
  });
});

function nickFrom(payload: Record<string, AmfValue>): string {
  const conf = payload["user|conf"];
  if (!conf || typeof conf !== "object" || Array.isArray(conf)) {
    throw new Error("user|conf missing");
  }
  if (typeof conf.nick !== "string" || !conf.nick) throw new Error("user|conf.nick missing");
  return conf.nick;
}

function requireRecord(value: unknown, label: string): Record<string, AmfValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} is missing`);
  }
  return value as Record<string, AmfValue>;
}

function amfList(value: unknown, label: string): AmfValue[] {
  if (!Array.isArray(value)) throw new Error(`${label} is not a list`);
  return value;
}
