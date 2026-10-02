import { describe, expect, it } from "vitest";
import { fightCounterDeltas } from "../../../src/app/fight-counter-deltas.ts";
import type {
  FightHumanOutcome,
  FightOutcomeSnapshot,
} from "../../../src/modules/combat/domain/fight-outcome-snapshot.ts";

const human = (over: Partial<FightHumanOutcome> = {}): FightHumanOutcome => ({
  accountId: 10,
  characterId: 1,
  team: 1,
  level: 7,
  hp: 20,
  maxHp: 50,
  mp: 5,
  damageToBot: 30,
  damageToHumans: 12,
  damageByVictim: [],
  healedByTarget: [],
  executedVictimIds: [],
  humanKills: 0,
  leftLive: false,
  pocket: [],
  ...over,
});

const pvp = (humans: readonly FightHumanOutcome[], winnerTeam: 1 | 2): FightOutcomeSnapshot => ({
  mode: "pvp",
  fightId: "5",
  winnerTeam,
  kind: "win",
  humans,
});

describe("fightCounterDeltas", () => {
  it("counts a win or a loss for everyone who stayed, with his damage, executions and kills", () => {
    const deltas = fightCounterDeltas(
      pvp(
        [
          human({ executedVictimIds: [2, 3], humanKills: 2 }),
          human({ characterId: 2, accountId: 11, team: 2, damageToHumans: 5, damageToBot: 0 }),
        ],
        1,
      ),
      777,
    );
    expect(deltas).toEqual([
      {
        characterId: 1,
        wins: 1,
        losses: 0,
        duelWins: 0,
        fightDamage: 42,
        fatalities: 2,
        pvpKills: 2,
        dailyCycleStart: 777,
      },
      {
        characterId: 2,
        wins: 0,
        losses: 1,
        duelWins: 0,
        fightDamage: 5,
        fatalities: 0,
        pvpKills: 0,
        dailyCycleStart: 777,
      },
    ]);
  });

  it("counts only the won duel of a friendly one", () => {
    const outcome: FightOutcomeSnapshot = {
      mode: "friendly-practice",
      fightId: "6",
      winnerTeam: 2,
      kind: "win",
      humans: [human(), human({ characterId: 2, accountId: 11, team: 2 })],
      restore: [],
    };
    expect(fightCounterDeltas(outcome, 1).map((d) => [d.wins, d.losses, d.duelWins])).toEqual([
      [0, 0, 0],
      [0, 0, 1],
    ]);
  });

  it("pays nothing to a human who walked out of the fight", () => {
    expect(fightCounterDeltas(pvp([human({ leftLive: true })], 1), 1)).toEqual([]);
  });
});
