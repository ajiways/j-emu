import { describe, expect, it } from "vitest";
import { concentrate } from "../../../src/modules/combat/domain/concentration.ts";
import { EMPTY_COMBAT_LOADOUT } from "../../../src/modules/combat/domain/combat-loadout.ts";
import { FightEffectIds } from "../../../src/modules/combat/domain/fight-effect-ids.ts";
import { FightRules } from "../../../src/modules/combat/domain/fight-rules.ts";
import { HumanFighter } from "../../../src/modules/combat/domain/human-fighter.ts";
import { UNIT_BATTLE_RULES } from "../../support/battle-rules.ts";
import { SequenceRandom } from "../../support/fakes/sequence-random.ts";
import {
  UNIT_HUNT_APPEARANCE,
  unitHuntHumanStats,
  unitRosterBot,
} from "../../support/hunt-start-input.ts";
import { rosterOf } from "../../support/roster-of.ts";

function waitingHero(): HumanFighter {
  const human = new HumanFighter({
    accountId: 1,
    heroId: 1,
    nick: "H1",
    level: 3,
    kind: 1,
    hp: 30,
    maxHp: 30,
    mp: 5,
    maxMp: 5,
    team: 1,
    waiting: true,
    ...unitHuntHumanStats(10),
    startedAtMs: 0,
    loadout: EMPTY_COMBAT_LOADOUT,
    appearance: UNIT_HUNT_APPEARANCE,
    effectIds: new FightEffectIds(),
  });
  human.authed = true;
  return human;
}

function use(hero: HumanFighter, bot = unitRosterBot({ hp: 20 }), draws = [0, 0.99], nowMs = 0) {
  const roster = rosterOf([hero], [bot]);
  const result = concentrate({
    actor: hero,
    roster,
    duels: [],
    fightRules: FightRules.forHunt(null),
    fightId: "9",
    rules: UNIT_BATTLE_RULES,
    random: new SequenceRandom(draws),
    nowMs,
  });
  return { result, bot };
}

describe("concentration", () => {
  it("deals 1 to the max damage to a random enemy and books it as the hero's own", () => {
    const hero = waitingHero();
    const { result, bot } = use(hero, unitRosterBot({ hp: 20 }), [0, 0.99]);
    expect(result?.events[0]).toMatchObject({
      type: "damage",
      sourceId: 1,
      animation: "magic_backstab",
      hpChange: -6,
    });
    expect(bot.hp).toBe(14);
    expect(hero.damageToBot).toBe(6);
  });

  it("deals at least 1", () => {
    const { bot } = use(waitingHero(), unitRosterBot({ hp: 20 }), [0, 0]);
    expect(bot.hp).toBe(19);
  });

  it("waits out its cooldown", () => {
    const hero = waitingHero();
    const roster = rosterOf([hero], [unitRosterBot({ hp: 20 })]);
    const fire = (nowMs: number) =>
      concentrate({
        actor: hero,
        roster,
        duels: [],
        fightRules: FightRules.forHunt(null),
        fightId: "9",
        rules: UNIT_BATTLE_RULES,
        random: new SequenceRandom([0, 0.5, 0, 0.5]),
        nowMs,
      });
    expect(fire(0)).not.toBeNull();
    expect(fire(89_999)).toBeNull();
    expect(fire(90_000)).not.toBeNull();
  });

  it("is only for one who stands without a foe", () => {
    const hero = waitingHero();
    hero.pair();
    expect(use(hero).result).toBeNull();
  });

  it("ends the fight when it takes down the last enemy", () => {
    const { result } = use(waitingHero(), unitRosterBot({ hp: 1 }), [0, 0]);
    expect(result?.fallout.finished).toMatchObject({ type: "finished", winnerTeam: 1 });
    expect(result?.events.at(-1)).toMatchObject({ type: "finished" });
  });
});
