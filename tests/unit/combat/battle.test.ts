import { describe, expect, it } from "vitest";
import { Battle } from "../../../src/modules/combat/domain/battle.ts";
import { SequenceRandom } from "../../support/fakes/sequence-random.ts";

function createBattle(random: SequenceRandom): Battle {
  return new Battle(
    {
      fightId: "1",
      accessKey: "access-key",
      accountId: 1,
      heroId: 1,
      heroNick: "Hero",
      heroLevel: 1,
      heroKind: 1,
      botArtikulId: 2,
      botFightId: 1_000_000,
      botNick: "Грызль",
      botLevel: 1,
      playerMaxHp: 27,
      botMaxHp: 20,
      arena: "1_1",
      areaId: "503",
      startedAt: new Date("2026-09-07T12:00:00.000Z"),
    },
    {
      playerDamageMin: 8,
      playerDamageMax: 12,
      botDamageMin: 2,
      botDamageMax: 4,
      turnTimeoutSeconds: 20,
    },
    random,
  );
}

describe("Battle", () => {
  it("fails instead of accepting a strike before authentication", () => {
    const battle = createBattle(new SequenceRandom([8]));
    expect(() => battle.strike("center")).toThrow(/not authenticated/);
  });

  it("uses the explicit rules and keeps packet order", () => {
    const battle = createBattle(new SequenceRandom([8, 2]));
    expect(battle.authenticate()).toEqual([
      {
        type: "opponent-introduced",
        id: 1_000_000,
        nick: "Грызль",
        hp: 20,
        maxHp: 20,
        level: 1,
        team: 2,
      },
      { type: "turn-granted", timeoutSeconds: 20 },
    ]);
    const events = battle.strike("left");
    expect(events[0]).toMatchObject({
      type: "damage",
      sourceId: 1,
      targetId: 1_000_000,
      hpChange: -8,
    });
    expect(events[1]).toMatchObject({
      type: "damage",
      sourceId: 1_000_000,
      targetId: 1,
      hpChange: -2,
    });
    expect(events[2]).toEqual({ type: "turn-granted", timeoutSeconds: 20 });
  });

  it("rejects a bot fight id that collides with the hero", () => {
    expect(
      () =>
        new Battle(
          {
            fightId: "1",
            accessKey: "access-key",
            accountId: 1,
            heroId: 1_000_000,
            heroNick: "Hero",
            heroLevel: 1,
            heroKind: 1,
            botArtikulId: 2,
            botFightId: 1_000_000,
            botNick: "Грызль",
            botLevel: 1,
            playerMaxHp: 27,
            botMaxHp: 20,
            arena: "1_1",
            areaId: "503",
            startedAt: new Date("2026-09-07T12:00:00.000Z"),
          },
          {
            playerDamageMin: 8,
            playerDamageMax: 12,
            botDamageMin: 2,
            botDamageMax: 4,
            turnTimeoutSeconds: 20,
          },
          new SequenceRandom([8]),
        ),
    ).toThrow(/collides with the human participant id/);
  });
});
