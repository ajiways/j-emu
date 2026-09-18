import { describe, expect, it } from "vitest";
import { EMPTY_COMBAT_LOADOUT } from "../../../src/modules/combat/domain/combat-loadout.ts";
import { FightEffectIds } from "../../../src/modules/combat/domain/fight-effect-ids.ts";
import { FightDuel } from "../../../src/modules/combat/domain/fight-duel.ts";
import { HuntHuman } from "../../../src/modules/combat/domain/hunt-human.ts";
import {
  UNIT_HUNT_APPEARANCE,
  unitHuntHumanStats,
  unitRosterBot,
} from "../../support/hunt-start-input.ts";
import {
  botMeleeTarget,
  enemySideCleared,
  fightCombatants,
  humanMeleeTarget,
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
    effectIds: new FightEffectIds(),
  });
}

describe("resolveMeleeTarget", () => {
  it("resolves the hunt bot while a teammate waits", () => {
    const opener = human(1, 1);
    const waiter = human(2, 1, true);
    const bot = unitRosterBot();
    const target = resolveMeleeTarget({
      attackerHeroId: 1,
      duel: new FightDuel(1, 1_000_000, 1),
      humans: [opener, waiter],
      bots: [bot],
    });
    expect(target.kind).toBe("bot");
    if (target.kind !== "bot") throw new Error("expected bot target");
    expect(target.bot).toBe(bot);
    expect(target).toMatchObject({
      id: 1_000_000,
      team: 2,
      hp: 20,
      maxHp: 20,
      mag: { power: 0, resist: 0 },
      strikeStats: { strength: 10, rage: 0, dexterity: 0, defense: 0, block: 0 },
      alive: true,
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
    expect(target).toEqual(humanMeleeTarget(acceptor));
  });

  it("fails when the pair id is neither a human nor the hunt bot", () => {
    expect(() =>
      resolveMeleeTarget({
        attackerHeroId: 1,
        duel: new FightDuel(1, 99, 1),
        humans: [human(1, 1)],
        bots: [unitRosterBot()],
      }),
    ).toThrow(/neither a human nor a fight bot/);
  });
});

describe("enemySideCleared", () => {
  it("stays uncleared while a bot remains on the killed human's team", () => {
    const dead = human(2, 2);
    dead.applyDamage(27);
    expect(
      enemySideCleared(2, fightCombatants([human(1, 1), dead], [unitRosterBot({ hp: 10 })])),
    ).toBe(false);
  });

  it("clears hunt team 2 after the bot dies", () => {
    const bot = unitRosterBot();
    bot.applyDamage(20);
    expect(enemySideCleared(2, fightCombatants([human(1, 1)], [bot]))).toBe(true);
  });

  it("treats a left-live human as not keeping the side alive", () => {
    const leaver = human(2, 2);
    leaver.markLeft();
    expect(enemySideCleared(2, fightCombatants([human(1, 1), leaver], []))).toBe(true);
    expect(humanMeleeTarget(leaver).alive).toBe(false);
    expect(botMeleeTarget(unitRosterBot({ hp: 1 })).alive).toBe(true);
  });
});
