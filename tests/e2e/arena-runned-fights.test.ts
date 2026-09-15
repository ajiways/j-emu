import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import type { AmfValue } from "../../src/modules/jugger-wire/amf/amf3.ts";
import {
  AuthenticatedClient,
  createIsolatedHero,
} from "../support/harness/authenticated-client.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";
import {
  finishStartedMeleeHunt,
  putOnStarterGloveIfInBag,
} from "../support/harness/complete-melee-hunt.ts";
import { MAP_HUNT_SPAWN_ID } from "../support/harness/map-hunt-spawn.ts";
import { huntFightIdFrom } from "../support/harness/wire-payload.ts";

describe("arena runned fights and fight_info", () => {
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

  it("lists a live hunt on the area board and serves a test fight card", async () => {
    const client = await AuthenticatedClient.login(application);
    const init = await client.objectAction({ object: "common", action: "init", sq: 1 });
    const nick = nickFrom(init);
    const start = await client.objectAction({
      object: "common",
      action: "object",
      form: { code: "ATTACK_BOT", bot_id: MAP_HUNT_SPAWN_ID },
      sq: 4,
    });
    const fightId = huntFightIdFrom(start);

    const listed = await client.objectAction({
      object: "arena",
      action: "runned_fights",
      form: { nick, type: 1, page: 1 },
      sq: 10,
    });
    const block = requireRecord(listed["arena|runned_fights"], "arena|runned_fights");
    expect(block.status).toBe(100);
    const live = requireRecord(
      amfList(block.fights, "fights").find(
        (row) => requireRecord(row, "row").id === Number(fightId),
      ),
      "live hunt",
    );
    expect(live).toMatchObject({ id: Number(fightId), type: 1 });
    expect(live).not.toHaveProperty("winner");
    const teams = requireRecord(live.teams, "teams");
    expect(requireRecord(amfList(teams["1"], "team 1")[0], "hero")).toMatchObject({
      nick,
      bot: 0,
      me: 1,
    });
    expect(requireRecord(amfList(teams["2"], "team 2")[0], "bot")).toMatchObject({
      bot: 1,
      artikul_id: "2",
    });

    const liveCard = await application.http.inject({
      method: "GET",
      url: `/fight_info.php?fight_id=${fightId}`,
    });
    expect(liveCard.statusCode).toBe(200);
    expect(liveCard.body).toContain(nick);
    expect(liveCard.body).toContain("Идёт сейчас");

    await finishStartedMeleeHunt(client, fightId, (ms) => harness.elapseCombat(ms), 20);
    const after = await client.objectAction({
      object: "arena",
      action: "runned_fights",
      form: { nick, type: 1, page: 1 },
      sq: 40,
    });
    const leftover = amfList(
      requireRecord(after["arena|runned_fights"], "after").fights,
      "after fights",
    ).filter((row) => requireRecord(row, "after row").id === Number(fightId));
    expect(leftover).toHaveLength(0);

    const finishedCard = await application.http.inject({
      method: "GET",
      url: `/fight_info.php?fight_id=${fightId}`,
    });
    expect(finishedCard.statusCode).toBe(200);
    expect(finishedCard.body).toContain("Завершён");
    expect(finishedCard.body).toContain(nick);
  });

  it("lists a live practice duel as type 6 and hides it after restart", async () => {
    const a = await createIsolatedHero(application);
    const b = await createIsolatedHero(application);
    const initA = await a.objectAction({ object: "common", action: "init", sq: 1 });
    const initB = await b.objectAction({ object: "common", action: "init", sq: 1 });
    const nickA = nickFrom(initA);
    const nickB = nickFrom(initB);
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
    const listed = await a.objectAction({
      object: "arena",
      action: "runned_fights",
      form: { type: 6, nick: nickA, page: 1 },
      sq: 10,
    });
    const live = requireRecord(
      amfList(
        requireRecord(listed["arena|runned_fights"], "practice board").fights,
        "practice fights",
      ).find((row) => requireRecord(row, "row").id === Number(fightId)),
      "live practice",
    );
    expect(live).toMatchObject({
      id: Number(fightId),
      type: 6,
      title: `Нападение ${nickA} на ${nickB}`,
    });

    application = await harness.restart();
    const again = new AuthenticatedClient(application, a.cookie);
    await again.objectAction({ object: "common", action: "init", sq: 20 });
    const restored = await again.objectAction({
      object: "arena",
      action: "runned_fights",
      form: { type: 6, nick: nickA, page: 1 },
      sq: 21,
    });
    expect(requireRecord(restored["arena|runned_fights"], "restarted").total_items).toBe(0);
  });

  it("rejects an invalid fight_id and renders missing cards", async () => {
    const missing = await application.http.inject({
      method: "GET",
      url: "/fight_info.php?fight_id=999999",
    });
    expect(missing.statusCode).toBe(200);
    expect(missing.body).toContain("Бой не найден");

    const invalid = await application.http.inject({
      method: "GET",
      url: "/fight_info.php?fight_id=0",
    });
    expect(invalid.statusCode).toBe(400);
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
