import { describe, expect, it } from "vitest";
import { concentrate } from "../../../src/modules/combat/domain/concentration.ts";
import type { CombatSpell } from "../../../src/modules/combat/domain/combat-loadout.ts";
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

/** The cataloged «Удар в спину» (artikul 487): a hit of the hero's strength cut by `pcSTR -90`. */
const SPELL: CombatSpell = {
  animData: "magic_backstab",
  cooldown: 90,
  persRestr: { dead: false, noopp: true },
  targetRestr: { dead: false },
  effects: [{ kind: 1, dmgType: 256, order: 1, skills: [{ skillId: "pcSTR", value: -90 }] }],
};

function waitingHero(strength = 10): HumanFighter {
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
    ...unitHuntHumanStats(strength),
    startedAtMs: 0,
    loadout: { ...EMPTY_COMBAT_LOADOUT, concentration: SPELL },
    appearance: UNIT_HUNT_APPEARANCE,
    effectIds: new FightEffectIds(),
  });
  human.authed = true;
  return human;
}

function use(hero: HumanFighter, bot = unitRosterBot({ hp: 20 }), draws = [0, 1], nowMs = 0) {
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
  it("hits for a tenth of a strike of his strength, at least 1, and books it as his own", () => {
    const weak = waitingHero(10);
    const { result, bot } = use(weak, unitRosterBot({ hp: 20 }), [0, 1]);
    expect(result?.events[0]).toMatchObject({
      type: "damage",
      sourceId: 1,
      animation: "magic_backstab",
      dmgType: 256,
      hpChange: -1,
    });
    expect(bot.hp).toBe(19);
    expect(weak.damageToBot).toBe(1);
    const strong = waitingHero(400);
    // A strength of 400 makes a hit of 40, a tenth of it is 4, spread over 3..5.
    expect(use(strong, unitRosterBot({ hp: 50 }), [0, 4]).bot.hp).toBe(46);
  });

  it("does nothing for a fighter without the spell", () => {
    const hero = waitingHero();
    const bare = new HumanFighter({
      accountId: 2,
      heroId: 2,
      nick: "H2",
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
    expect(use(bare).result).toBeNull();
    expect(use(hero).result).not.toBeNull();
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
        random: new SequenceRandom([0, 1, 0, 1]),
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
    const { result } = use(waitingHero(), unitRosterBot({ hp: 1 }), [0, 1]);
    expect(result?.fallout.finished).toMatchObject({ type: "finished", winnerTeam: 1 });
    expect(result?.events.at(-1)).toMatchObject({ type: "finished" });
  });
});
