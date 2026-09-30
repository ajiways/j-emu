import { describe, expect, it } from "vitest";
import { FightDuel } from "../../../src/modules/combat/domain/fight-duel.ts";
import { FightEffectIds } from "../../../src/modules/combat/domain/fight-effect-ids.ts";
import { HumanFighter } from "../../../src/modules/combat/domain/human-fighter.ts";
import { EMPTY_COMBAT_LOADOUT } from "../../../src/modules/combat/domain/combat-loadout.ts";
import { requireFightBot, seedFightBots } from "../../../src/modules/combat/domain/fight-bots.ts";
import type { BotFighterSeed } from "../../../src/modules/combat/domain/bot-fighter.ts";
import {
  pairHumanQueues,
  pairQueues,
  pickPair,
} from "../../../src/modules/combat/domain/pairing.ts";
import { SequenceRandom } from "../../support/fakes/sequence-random.ts";
import { unitFightBots } from "../../support/fight-bots.ts";
import {
  EMPTY_HUNT_BOT_SPELL_BOOK,
  GRYZL_FIGHT_LOOK,
  UNIT_HUNT_APPEARANCE,
  unitHuntHumanStats,
} from "../../support/hunt-start-input.ts";

function human(
  input: Readonly<{ accountId: number; heroId: number; team: 1 | 2; waiting: boolean }>,
) {
  return new HumanFighter({
    accountId: input.accountId,
    heroId: input.heroId,
    nick: `h${input.heroId}`,
    level: 1,
    kind: 1,
    hp: 27,
    maxHp: 27,
    mp: 10,
    maxMp: 10,
    team: input.team,
    waiting: input.waiting,
    ...unitHuntHumanStats(),
    startedAtMs: 0,
    loadout: EMPTY_COMBAT_LOADOUT,
    appearance: UNIT_HUNT_APPEARANCE,
    effectIds: new FightEffectIds(),
  });
}

function botSeed(fightId: number): BotFighterSeed {
  return {
    fightId,
    artikulId: 2,
    nick: `bot${fightId}`,
    level: 1,
    hp: 20,
    strength: 10,
    initiative: 0,
    magPower: 0,
    magResist: 0,
    avatar: GRYZL_FIGHT_LOOK.botAvatar,
    sk: GRYZL_FIGHT_LOOK.botSk,
    body: GRYZL_FIGHT_LOOK.botBody,
    spellBook: EMPTY_HUNT_BOT_SPELL_BOOK,
  };
}

function botsWith(extraEnemies: readonly BotFighterSeed[], allies: readonly BotFighterSeed[] = []) {
  return unitFightBots({ extraEnemies, allies });
}

describe("pairHumanQueues", () => {
  it("pairs living waiters across teams and leaves a bot pair alone", () => {
    const opener = human({ accountId: 1, heroId: 1, team: 1, waiting: false });
    const waiter = human({ accountId: 2, heroId: 2, team: 1, waiting: true });
    const intervenor = human({ accountId: 3, heroId: 3, team: 2, waiting: true });
    const duels = [new FightDuel(1, 1_000_000, 1)];
    const created = pairHumanQueues([opener, waiter, intervenor], duels, new SequenceRandom([0.4]));
    expect(created).toMatchObject({ aId: 2, bId: 3, nextActorId: 2 });
    expect(waiter.waiting).toBe(false);
    expect(intervenor.waiting).toBe(false);
    expect(opener.waiting).toBe(false);
    expect(duels).toHaveLength(2);
  });

  it("does not pair a lone team-2 waiter while the opener holds the bot", () => {
    const opener = human({ accountId: 1, heroId: 1, team: 1, waiting: false });
    const intervenor = human({ accountId: 2, heroId: 2, team: 2, waiting: true });
    const duels = [new FightDuel(1, 1_000_000, 1)];
    expect(pairHumanQueues([opener, intervenor], duels, new SequenceRandom([0.4]))).toBeNull();
    expect(intervenor.waiting).toBe(true);
    expect(duels).toHaveLength(1);
  });
});

describe("one hunt pairing engine", () => {
  it("returns null when the wait queue is empty", () => {
    expect(pickPair([], new Set(), new SequenceRandom([0.4]))).toBeNull();
    const opener = human({ accountId: 1, heroId: 1, team: 1, waiting: false });
    const duels = [new FightDuel(1, 1_000_000, 1)];
    expect(
      pairQueues({
        participants: [opener],
        duels,
        random: new SequenceRandom([0.4]),
      }),
    ).toBeNull();
    expect(duels).toHaveLength(1);
  });

  it("pairs a waiting human with a waiting bot into the same duel list", () => {
    const opener = human({ accountId: 1, heroId: 1, team: 1, waiting: false });
    const waiter = human({ accountId: 2, heroId: 2, team: 1, waiting: true });
    const bots = botsWith([botSeed(1_000_001)]);
    const duels = [new FightDuel(1, 1_000_000, 1)];
    const created = pairQueues({
      participants: [opener, waiter, ...bots],
      duels,
      random: new SequenceRandom([0.4]),
    });
    expect(created).toMatchObject({ aId: 2, bId: 1_000_001 });
    expect(duels).toHaveLength(2);
    expect(duels[0]?.has(1)).toBe(true);
    expect(duels[1]).toBe(created);
    expect(waiter.waiting).toBe(false);
    expect(requireFightBot(bots, 1_000_001).waiting).toBe(false);
  });

  it("pairs bot↔bot into the same duel list as the human opener", () => {
    const opener = human({ accountId: 1, heroId: 1, team: 1, waiting: false });
    const bots = botsWith([botSeed(1_000_001)], [botSeed(1_000_002)]);
    const duels = [new FightDuel(1, 1_000_000, 1)];
    const created = pairQueues({
      participants: [opener, ...bots],
      duels,
      random: new SequenceRandom([0.4]),
    });
    expect(created).toMatchObject({ aId: 1_000_002, bId: 1_000_001, nextActorId: 1_000_002 });
    expect(duels).toHaveLength(2);
    expect(duels[0]?.has(1)).toBe(true);
    expect(duels[1]?.has(1_000_001)).toBe(true);
    expect(duels[1]?.has(1_000_002)).toBe(true);
    expect(requireFightBot(bots, 1_000_001).waiting).toBe(false);
    expect(requireFightBot(bots, 1_000_002).waiting).toBe(false);
  });

  it("fails fast when a roster bot id collides with an occupied id", () => {
    expect(() =>
      seedFightBots({
        enemyAis: [botSeed(1_000_000)],
        openerAis: [],
        occupiedIds: [1_000_000],
        effectIds: new FightEffectIds(),
        enemyTeam: 2,
        openerTeam: 1,
      }),
    ).toThrow(/Fight bot id 1000000 collides/);
  });
});

describe("pickPair last-foe", () => {
  it("prefers a foe who is not the last opponent", () => {
    const seekers = [
      { id: 1, team: 1 as const, lastOpponentId: 3, initiative: 0, kind: "human" as const },
      { id: 2, team: 1 as const, lastOpponentId: null, initiative: 0, kind: "human" as const },
      { id: 3, team: 2 as const, lastOpponentId: 1, initiative: 0, kind: "bot" as const },
      { id: 4, team: 2 as const, lastOpponentId: null, initiative: 0, kind: "bot" as const },
    ];
    expect(pickPair(seekers, new Set(), new SequenceRandom([0, 0, 0.4]))).toEqual({
      aId: 2,
      bId: 4,
    });
  });
});
