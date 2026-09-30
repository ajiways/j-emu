import { rosterOf } from "../../support/roster-of.ts";
import { describe, expect, it } from "vitest";
import {
  hasPairableWaiters,
  pairWaitingSeekers,
} from "../../../src/modules/combat/domain/battle-ai-duels.ts";
import { fightContinuesWithout } from "../../../src/modules/combat/domain/battle-lookups.ts";
import { FightRules } from "../../../src/modules/combat/domain/fight-rules.ts";
import { UNIT_BATTLE_RULES } from "../../support/battle-rules.ts";
import { FixedRandom } from "../../support/fakes/fixed-random.ts";
import { shuffleAfterHits } from "../../../src/modules/combat/domain/battle-pairing.ts";
import { BotFighter } from "../../../src/modules/combat/domain/bot-fighter.ts";
import { EMPTY_COMBAT_LOADOUT } from "../../../src/modules/combat/domain/combat-loadout.ts";
import { FightDuel } from "../../../src/modules/combat/domain/fight-duel.ts";
import { FightEffectIds } from "../../../src/modules/combat/domain/fight-effect-ids.ts";
import { HumanFighter } from "../../../src/modules/combat/domain/human-fighter.ts";
import {
  EMPTY_HUNT_BOT_SPELL_BOOK,
  UNIT_HUNT_APPEARANCE,
  unitHuntHumanStats,
} from "../../support/hunt-start-input.ts";

function hero(effectIds: FightEffectIds): HumanFighter {
  const human = new HumanFighter({
    accountId: 1,
    heroId: 1,
    nick: "H1",
    level: 1,
    kind: 1,
    hp: 50,
    maxHp: 50,
    mp: 10,
    maxMp: 10,
    team: 2,
    waiting: false,
    ...unitHuntHumanStats(20),
    startedAtMs: 0,
    loadout: EMPTY_COMBAT_LOADOUT,
    appearance: UNIT_HUNT_APPEARANCE,
    effectIds,
  });
  human.authed = true;
  return human;
}

function mob(fightId: number, team: 1 | 2, effectIds: FightEffectIds): BotFighter {
  return BotFighter.fromSeed(
    {
      fightId,
      artikulId: 6,
      nick: `Mob${fightId}`,
      level: 1,
      hp: 100,
      strength: 5,
      initiative: 0,
      magPower: 0,
      magResist: 0,
      avatar: "a.jpg",
      sk: "1",
      body: "",
      spellBook: EMPTY_HUNT_BOT_SPELL_BOOK,
    },
    team,
    effectIds,
  );
}

describe("a waiting ally mob takes a duel over", () => {
  it("replaces the hero in a 3↔3 duel and leaves him waiting", () => {
    const effectIds = new FightEffectIds();
    const human = hero(effectIds);
    const foe = mob(1_000_000, 1, effectIds);
    const ally = mob(1_000_001, 2, effectIds);
    ally.unpair();
    const duel = new FightDuel(human.heroId, foe.fightId, human.heroId);
    for (let round = 0; round < 3; round += 1) {
      duel.addHit(human.heroId);
      duel.addHit(foe.fightId);
    }
    const outcome = shuffleAfterHits({
      pairing: { duel, humans: [human], pairedAccountId: human.accountId },
      openerTeam: 2,
      enemyTeam: 1,
      bots: [foe, ally],
      duels: [duel],
      finished: false,
    });
    expect(outcome).toEqual({ kind: "ally-handoff", actorAccountId: 1 });
    expect(duel.otherId(foe.fightId)).toBe(ally.fightId);
    expect(duel.nextActorId).toBe(ally.fightId);
    expect(human.waiting).toBe(true);
    expect(ally.waiting).toBe(false);
    expect(duel.hitsFor(foe.fightId)).toBe(0);
  });

  it("pairs a waiting hero with a free foe on the fight clock", () => {
    const effectIds = new FightEffectIds();
    const human = hero(effectIds);
    human.unpair();
    const foe = mob(1_000_000, 1, effectIds);
    foe.unpair();
    const state = {
      fightRules: FightRules.for({ kind: "quest", botCount: 1 }),
      finished: false,
      roster: rosterOf([human], [foe]),
      duels: [] as FightDuel[],
      rules: UNIT_BATTLE_RULES,
      random: new FixedRandom(0.5),
      fightId: "8",
    };
    expect(hasPairableWaiters(state)).toBe(true);
    expect(pairWaitingSeekers(state)).toEqual([1]);
    expect(state.duels).toHaveLength(1);
    expect(human.waiting).toBe(false);
    expect(foe.waiting).toBe(false);
    expect(hasPairableWaiters(state)).toBe(false);
  });

  it("lets a fight go on without a leaver while an ally mob stands, and ends it otherwise", () => {
    const effectIds = new FightEffectIds();
    const human = hero(effectIds);
    const foe = mob(1_000_000, 1, effectIds);
    const ally = mob(1_000_001, 2, effectIds);
    expect(fightContinuesWithout([human], [foe], 1)).toBe(false);
    expect(fightContinuesWithout([human], [foe, ally], 1)).toBe(true);
    ally.applyDamage(ally.hp);
    expect(fightContinuesWithout([human], [foe, ally], 1)).toBe(false);
  });
});
