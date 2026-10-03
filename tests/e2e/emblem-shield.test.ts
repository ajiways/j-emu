import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import type { AmfValue } from "../../src/modules/jugger-wire/amf/amf3.ts";
import { FixedRandom } from "../support/fakes/fixed-random.ts";
import {
  createIsolatedHero,
  type AuthenticatedClient,
} from "../support/harness/authenticated-client.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";
import {
  bagItemByArtikulId,
  fightEventTypes,
  heroIdFrom,
  huntFightIdFrom,
} from "../support/harness/wire-payload.ts";
import { insertBagArtifacts } from "../support/postgres/insert-bag-artifacts.ts";

/** «Эмблема задиры»: shield power 13, from level 6 and the first rank. */
const EMBLEM = 9833;
const LEVEL_7_GRANT = 3622;
const FIRST_RANK_HONOR = 100;

describe("an emblem's shield in a duel between players", () => {
  let harness: ApplicationHarness;
  let application: Application;

  beforeEach(async () => {
    // Nothing dodges or blocks on a high roll; the card's `randomly` grades are made certain.
    harness = new ApplicationHarness(undefined, undefined, {
      combatRandom: new FixedRandom(),
      combatRules: { emblemChances: [1, 1] },
    });
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  async function wearEmblem(client: AuthenticatedClient, sq: number): Promise<number> {
    const init = await client.objectAction({ object: "common", action: "init", sq });
    const heroId = heroIdFrom(init);
    await application.characterProgression.grantExperience({
      characterId: heroId,
      operationId: `test:${heroId}:emblem-l7`,
      amount: LEVEL_7_GRANT,
    });
    await application.characterProgression.grantHonor({
      characterId: heroId,
      operationId: `test:${heroId}:emblem-honor`,
      amount: FIRST_RANK_HONOR,
    });
    await insertBagArtifacts(heroId, [{ artifactId: EMBLEM, durability: 0, durabilityMax: 0 }]);
    const bag = await client.objectAction({ object: "common", action: "init", sq: sq + 1 });
    const itemId = bagItemByArtikulId(bag, EMBLEM).id;
    if (itemId === undefined) throw new Error("The emblem has no item id");
    const worn = await client.objectAction({
      object: "common",
      action: "action",
      form: { code: "PUT_ON", artifact_id: itemId },
      sq: sq + 2,
    });
    expect(worn["common|action"]).toEqual({ status: 100 });
    return heroId;
  }

  it("is put on at the start of the wearer's turn and takes the first blow", async () => {
    const challenger = await createIsolatedHero(application);
    const acceptor = await createIsolatedHero(application);
    const challengerId = heroIdFrom(
      await challenger.objectAction({ object: "common", action: "init", sq: 1 }),
    );
    const acceptorId = await wearEmblem(acceptor, 1);
    const nickOf = async (client: AuthenticatedClient, sq: number): Promise<string> => {
      const conf = (await client.objectAction({ object: "common", action: "init", sq }))[
        "user|conf"
      ];
      if (!conf || typeof conf !== "object" || Array.isArray(conf) || !conf.nick) {
        throw new Error("user|conf.nick missing");
      }
      return String(conf.nick);
    };
    const nickChallenger = await nickOf(challenger, 2);
    const nickAcceptor = await nickOf(acceptor, 10);
    await challenger.objectAction({
      object: "user",
      action: "friendly_duel_propose",
      form: { nick: nickAcceptor },
      sq: 3,
    });
    await acceptor.pollEsrv();
    const accept = await acceptor.objectAction({
      object: "user",
      action: "friendly_duel_accept",
      form: { nick: nickChallenger },
      sq: 11,
    });
    const fightId = huntFightIdFrom(accept);
    await acceptor.fight({ rc: "auth", eid: fightId, sq: 12 });
    await challenger.fight({ rc: "auth", eid: fightId, sq: 4 });
    await challenger.pollFight();
    await acceptor.pollFight();

    // The challenger strikes first; the acceptor's turn follows, and his emblem fires with it.
    await challenger.fight({ rc: "castSpell", srcType: 1, srcId: 2, sq: 5 });
    await challenger.pollFight();
    await harness.elapseCombat(2500);
    const turn = await acceptor.pollFight();
    const types = fightEventTypes(turn);
    expect(types.indexOf("effUse")).toBeGreaterThanOrEqual(0);
    expect(types.indexOf("effUse")).toBeLessThan(types.indexOf("attacknow"));
    const shield = frames(turn).find((frame) => frame.et === "effUse" && frame.kind === 9);
    expect(shield).toMatchObject({ persId: acceptorId, artikulId: EMBLEM, amount: 13 });
    // The challenger sees the shield appear on his foe too.
    const seen = await challenger.pollFight();
    expect(frames(seen).find((frame) => frame.et === "effUse" && frame.kind === 9)).toMatchObject({
      persId: acceptorId,
      amount: 13,
    });

    // The acceptor strikes, and the challenger's answer lands on the shield.
    await acceptor.fight({ rc: "castSpell", srcType: 1, srcId: 2, sq: 13 });
    await acceptor.pollFight();
    await harness.elapseCombat(2500);
    await challenger.pollFight();
    await challenger.fight({ rc: "castSpell", srcType: 1, srcId: 2, sq: 6 });
    const blow = frames(await challenger.pollFight());
    const absorbed = blow.flatMap(hpChanges).find((row) => Number(row.absorb) > 0);
    expect(absorbed).toMatchObject({ targetId: acceptorId, hp: 0 });
    expect(challengerId).not.toBe(acceptorId);
  });
});

/** The frames of a poll: each packet carries its frames under `ev`. */
function frames(events: readonly AmfValue[]): Record<string, AmfValue>[] {
  const out: Record<string, AmfValue>[] = [];
  for (const event of events) {
    if (!event || typeof event !== "object" || Array.isArray(event)) continue;
    const nested = event.ev;
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      for (const frame of Object.values(nested)) {
        if (frame && typeof frame === "object" && !Array.isArray(frame)) out.push(frame);
      }
    } else {
      out.push(event);
    }
  }
  return out;
}

/** The `hpChange` rows of a frame: the frame itself, or the nested rows of a cast. */
function hpChanges(frame: Record<string, AmfValue>): Record<string, AmfValue>[] {
  const rows: Record<string, AmfValue>[] = frame.et === "hpChange" ? [frame] : [];
  const nested = frame.ev;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    for (const row of Object.values(nested)) {
      if (row && typeof row === "object" && !Array.isArray(row) && row.et === "hpChange") {
        rows.push(row);
      }
    }
  }
  return rows;
}
