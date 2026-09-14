import { describe, expect, it } from "vitest";
import { FightDuel } from "../../../src/modules/combat/domain/fight-duel.ts";
import { HuntHuman } from "../../../src/modules/combat/domain/hunt-human.ts";
import { EMPTY_COMBAT_LOADOUT } from "../../../src/modules/combat/domain/combat-loadout.ts";
import { pairHuntHumanQueues } from "../../../src/modules/combat/domain/try-pair-hunt-queues.ts";
import { UNIT_HUNT_APPEARANCE } from "../../support/hunt-start-input.ts";

function human(
  input: Readonly<{ accountId: number; heroId: number; team: 1 | 2; waiting: boolean }>,
) {
  return new HuntHuman({
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
    strength: 80,
    startedAtMs: 0,
    loadout: EMPTY_COMBAT_LOADOUT,
    appearance: UNIT_HUNT_APPEARANCE,
  });
}

describe("pairHuntHumanQueues", () => {
  it("pairs living waiters across teams and leaves a bot pair alone", () => {
    const opener = human({ accountId: 1, heroId: 1, team: 1, waiting: false });
    const waiter = human({ accountId: 2, heroId: 2, team: 1, waiting: true });
    const intervenor = human({ accountId: 3, heroId: 3, team: 2, waiting: true });
    const duels = [new FightDuel(1, 1_000_000, 1)];
    const created = pairHuntHumanQueues([opener, waiter, intervenor], duels);
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
    expect(pairHuntHumanQueues([opener, intervenor], duels)).toBeNull();
    expect(intervenor.waiting).toBe(true);
    expect(duels).toHaveLength(1);
  });
});
