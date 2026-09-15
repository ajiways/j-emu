import { describe, expect, it } from "vitest";
import { practiceFinishedFightRecord } from "../../../src/modules/combat/domain/finished-fight-record.ts";
import { parseFinishedFightTeams } from "../../../src/modules/combat/domain/finished-fight-teams.ts";
import { createCombatService } from "../../support/create-combat-service.ts";
import { EMPTY_COMBAT_LOADOUT } from "../../../src/modules/combat/domain/combat-loadout.ts";
import { UNIT_FIGHT_SECONDARIES } from "../../support/hunt-start-input.ts";
import { SequenceRandom } from "../../support/fakes/sequence-random.ts";
import type { FriendlyDuelStartInput } from "../../../src/modules/combat/ports/combat-port.ts";
import { RecordingFinishedFightStore } from "../../support/fakes/recording-finished-fight-store.ts";

const startedAt = new Date("2026-09-07T12:00:00.000Z");
const finishedAt = new Date("2026-09-07T12:00:12.000Z");

describe("practice finished fight history", () => {
  it("stores type 6 with two humans and no bot member", () => {
    const row = practiceRow();
    expect(row).toMatchObject({
      type: 6,
      title: "Нападение Alice на Bob",
      mlTitle: "3|10|3",
      levelMin: 3,
      levelMax: 5,
      winner: 1,
    });
    expect(row.teams["1"][0]).toMatchObject({ id: 10, nick: "Alice", bot: 0, dead: false, me: 0 });
    expect(row.teams["2"][0]).toMatchObject({ id: 11, nick: "Bob", bot: 0, dead: true, me: 0 });
    expect("artikul_id" in (row.teams["2"][0] ?? {})).toBe(false);
  });

  it("restores a two-human team snapshot", () => {
    const teams = parseFinishedFightTeams(practiceRow().teams);
    expect(teams["2"][0]).toMatchObject({ bot: 0, id: 11, nick: "Bob" });
  });

  it("records type 6 after a friendly duel finishes and skips PvP", async () => {
    const history = new RecordingFinishedFightStore();
    const { combat } = createCombatService({
      history,
      random: new SequenceRandom([20]),
    });
    const fightId = await combat.nextFightId();
    await combat.startFriendlyDuel({
      fightId,
      arena: "1_1",
      areaId: "503",
      instanceCopyId: null,
      fightFlags: null,
      challenger: duelFighter(1, 10, "Alice", 200, 27),
      acceptor: duelFighter(2, 11, "Bob", 10, 10),
    });
    await combat.execute(1, { kind: "authenticate", fightId, sequence: 1 });
    await combat.execute(1, { kind: "poll" });
    await combat.execute(2, { kind: "authenticate", fightId, sequence: 1 });
    await combat.execute(2, { kind: "poll" });
    await combat.execute(1, { kind: "strike", side: "left", sequence: 2 });
    expect(history.records).toHaveLength(1);
    expect(history.records[0]).toMatchObject({
      type: 6,
      heroId: 10,
      title: "Нападение Alice на Bob",
      winner: 1,
    });
    expect(history.records[0]?.teams["2"][0]).toMatchObject({ bot: 0, nick: "Bob" });
  });
});

function practiceRow() {
  return practiceFinishedFightRecord({
    fightId: "9",
    accountId: 1,
    heroId: 10,
    challengerId: 10,
    challengerNick: "Alice",
    challengerLevel: 3,
    challengerKind: 1,
    challengerDead: false,
    challengerFlee: 0,
    acceptorId: 11,
    acceptorNick: "Bob",
    acceptorLevel: 5,
    acceptorKind: 1,
    acceptorDead: true,
    acceptorFlee: 0,
    timeout: 20,
    areaId: "503",
    winner: 1,
    startedAt,
    finishedAt,
  });
}

function duelFighter(
  accountId: number,
  heroId: number,
  nick: string,
  strength: number,
  hp: number,
): FriendlyDuelStartInput["challenger"] {
  return {
    accountId,
    heroId,
    heroNick: nick,
    heroLevel: 1,
    heroKind: 1,
    heroHp: hp,
    heroMaxHp: hp,
    heroMp: 10,
    heroMaxMp: 10,
    heroStrength: strength,
    ...UNIT_FIGHT_SECONDARIES,
    loadout: EMPTY_COMBAT_LOADOUT,
    avatar: "avatar_small.jpg",
    body: "m1",
    sk: "1",
  };
}
