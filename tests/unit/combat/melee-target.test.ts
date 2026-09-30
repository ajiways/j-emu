import { describe, expect, it } from "vitest";
import { EMPTY_COMBAT_LOADOUT } from "../../../src/modules/combat/domain/combat-loadout.ts";
import { FightEffectIds } from "../../../src/modules/combat/domain/fight-effect-ids.ts";
import { FightDuel } from "../../../src/modules/combat/domain/fight-duel.ts";
import { HumanFighter } from "../../../src/modules/combat/domain/human-fighter.ts";
import {
  UNIT_HUNT_APPEARANCE,
  unitHuntHumanStats,
  unitRosterBot,
} from "../../support/hunt-start-input.ts";
import { duelFoe, enemySideCleared } from "../../../src/modules/combat/domain/melee-target.ts";

function human(heroId: number, team: 1 | 2, waiting = false): HumanFighter {
  return new HumanFighter({
    accountId: heroId,
    heroId,
    nick: `H${heroId}`,
    level: 1,
    kind: 1,
    hp: 27,
    maxHp: 27,
    mp: 10,
    maxMp: 10,
    team,
    waiting,
    ...unitHuntHumanStats(10),
    startedAtMs: 0,
    loadout: EMPTY_COMBAT_LOADOUT,
    appearance: UNIT_HUNT_APPEARANCE,
    effectIds: new FightEffectIds(),
  });
}

describe("duelFoe", () => {
  it("resolves the mob across from the hero while a teammate waits", () => {
    const opener = human(1, 1);
    const waiter = human(2, 1, true);
    const bot = unitRosterBot();
    const foe = duelFoe(new FightDuel(1, 1_000_000, 1), [opener, waiter, bot], 1);
    expect(foe).toBe(bot);
    expect(foe).toMatchObject({ id: 1_000_000, team: 2, maxHp: 20, alive: true });
    expect(foe.mag).toEqual({ power: 0, resist: 0 });
    expect(foe.strikeStats()).toMatchObject({
      strength: 10,
      rage: 0,
      dexterity: 0,
      defense: 0,
      block: 0,
    });
  });

  it("resolves the paired human when there is no mob", () => {
    const challenger = human(1, 1);
    const acceptor = human(2, 2);
    expect(duelFoe(new FightDuel(1, 2, 1), [challenger, acceptor], 1)).toBe(acceptor);
  });

  it("fails when the pair id is not in the fight", () => {
    expect(() => duelFoe(new FightDuel(1, 99, 1), [human(1, 1), unitRosterBot()], 1)).toThrow(
      /not in the fight/,
    );
  });
});

describe("enemySideCleared", () => {
  it("stays uncleared while a bot remains on the killed human's team", () => {
    const dead = human(2, 2);
    dead.applyDamage(27);
    expect(enemySideCleared(2, [human(1, 1), dead, unitRosterBot({ hp: 10 })])).toBe(false);
  });

  it("clears hunt team 2 after the bot dies", () => {
    const bot = unitRosterBot();
    bot.applyDamage(20);
    expect(enemySideCleared(2, [human(1, 1), bot])).toBe(true);
  });

  it("treats a left-live human as not keeping the side alive", () => {
    const leaver = human(2, 2);
    leaver.markLeft();
    expect(enemySideCleared(2, [human(1, 1), leaver])).toBe(true);
    expect(leaver.alive).toBe(false);
    expect(unitRosterBot({ hp: 1 }).alive).toBe(true);
  });
});
