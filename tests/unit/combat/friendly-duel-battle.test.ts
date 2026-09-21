import { describe, expect, it } from "vitest";
import { createUnitBattle } from "../../support/fight-rules.ts";
import { unitDuelFightSetup } from "../../support/fight-setup.ts";
import { SequenceRandom } from "../../support/fakes/sequence-random.ts";

const AUTH_NOW = Date.parse("2026-09-07T12:00:00.000Z");

describe("friendly duel Battle", () => {
  it("lets the challenger strike the acceptor and finishes without a bot", () => {
    const battle = createUnitBattle(unitDuelFightSetup(), new SequenceRandom([1, 1, 1]));
    expect(battle.bots).toEqual([]);
    const opener = battle.authenticate(1, AUTH_NOW);
    expect(opener[0]).toMatchObject({
      type: "friendly-bootstrap",
      hero: { id: 1, team: 1 },
      opponent: { id: 2, team: 2 },
    });
    expect(opener.some((event) => event.type === "turn-granted")).toBe(true);
    const waiting = battle.authenticate(2, AUTH_NOW);
    expect(waiting.some((event) => event.type === "turn-granted")).toBe(false);
    const hit = battle.tryPlayerMelee(1, "center", AUTH_NOW);
    expect(hit).toMatchObject({
      kind: "resolved",
      events: [
        { type: "turn-wait", timeoutSeconds: 20 },
        { type: "damage", sourceId: 1, targetId: 2, hpChange: -1, killed: false },
      ],
    });
    expect(battle.tryPlayerMelee(1, "center", AUTH_NOW)).toEqual({ kind: "ignored" });
    battle.grantTurn(2, AUTH_NOW);
    expect(battle.tryPlayerMelee(2, "left", AUTH_NOW).kind).toBe("resolved");
    expect(battle.pairedOpponent(1)).toEqual({ kind: "human", accountId: 2 });
    expect(() => battle.resolveBotMelee(1)).toThrow(/no bot to take a turn/);
  });
});
