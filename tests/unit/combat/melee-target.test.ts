import { describe, expect, it } from "vitest";
import { EMPTY_COMBAT_LOADOUT } from "../../../src/modules/combat/domain/combat-loadout.ts";
import { FightDuel } from "../../../src/modules/combat/domain/fight-duel.ts";
import { HuntHuman } from "../../../src/modules/combat/domain/hunt-human.ts";
import { UNIT_HUNT_APPEARANCE, unitHuntHumanStats } from "../../support/hunt-start-input.ts";
import {
  enemySideCleared,
  resolveMeleeTarget,
} from "../../../src/modules/combat/domain/melee-target.ts";

function human(heroId: number, team: 1 | 2, waiting = false): HuntHuman {
  return new HuntHuman({
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
  });
}

describe("resolveMeleeTarget", () => {
  it("resolves the hunt bot while a teammate waits", () => {
    const opener = human(1, 1);
    const waiter = human(2, 1, true);
    const target = resolveMeleeTarget({
      attackerHeroId: 1,
      duel: new FightDuel(1, 1_000_000, 1),
      humans: [opener, waiter],
      bots: [{ fightId: 1_000_000, hp: 20, maxHp: 20, team: 2, mag: { power: 0, resist: 0 } }],
    });
    expect(target).toEqual({
      kind: "bot",
      id: 1_000_000,
      team: 2,
      hp: 20,
      maxHp: 20,
      mag: { power: 0, resist: 0 },
    });
  });

  it("resolves the paired human when there is no bot", () => {
    const challenger = human(1, 1);
    const acceptor = human(2, 2);
    const target = resolveMeleeTarget({
      attackerHeroId: 1,
      duel: new FightDuel(1, 2, 1),
      humans: [challenger, acceptor],
      bots: [],
    });
    expect(target).toEqual({ kind: "human", human: acceptor });
  });

  it("fails when the pair id is neither a human nor the hunt bot", () => {
    expect(() =>
      resolveMeleeTarget({
        attackerHeroId: 1,
        duel: new FightDuel(1, 99, 1),
        humans: [human(1, 1)],
        bots: [{ fightId: 1_000_000, hp: 20, maxHp: 20, team: 2, mag: { power: 0, resist: 0 } }],
      }),
    ).toThrow(/neither a human nor a fight bot/);
  });
});

describe("enemySideCleared", () => {
  it("stays uncleared while a bot remains on the killed human's team", () => {
    const dead = human(2, 2);
    dead.applyDamage(27);
    expect(
      enemySideCleared(
        2,
        [human(1, 1), dead],
        [
          {
            fightId: 1_000_000,
            hp: 10,
            maxHp: 10,
            team: 2,
            mag: { power: 0, resist: 0 },
          },
        ],
      ),
    ).toBe(false);
  });

  it("clears hunt team 2 after the bot dies", () => {
    expect(
      enemySideCleared(
        2,
        [human(1, 1)],
        [
          {
            fightId: 1_000_000,
            hp: 0,
            maxHp: 20,
            team: 2,
            mag: { power: 0, resist: 0 },
          },
        ],
      ),
    ).toBe(true);
  });
});
