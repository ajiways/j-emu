import { describe, expect, it } from "vitest";
import { BattlegroundQueue } from "../../../src/modules/battleground/application/battleground-queue.ts";
import type { BattlegroundDefinition } from "../../../src/modules/battleground/domain/battleground-definition.ts";
import { BattlegroundDeniedError } from "../../../src/modules/battleground/domain/battleground-denied-error.ts";
import { FakeClock } from "../../support/fake-clock.ts";
import { ManualCombatDelay } from "../../support/fakes/manual-combat-delay.ts";

const START_MS = 1_700_000_000_000;

describe("BattlegroundQueue", () => {
  it("matches two waiters, overlays dump zeros stay on unplayable cards, and bans an expired invite", async () => {
    const { queue, clock, delay, invites } = makeQueue();
    const a = hero(1, 6);
    const b = hero(2, 7);
    queue.add(a);
    expect(queue.overlay(a.heroId)).toMatchObject({
      requestCount: 1,
      userInQueue: 1,
      bgCount: 0,
      hasAnyRequest: 1,
      penaltyTime: 0,
    });
    queue.add(a);
    expect(queue.overlay(a.heroId).requestCount).toBe(1);
    queue.add(b);
    expect(invites).toHaveLength(1);
    expect(queue.overlay(a.heroId)).toMatchObject({
      requestCount: 2,
      userInQueue: 1,
      hasAnyRequest: 1,
    });
    clock.advanceSeconds(120);
    await delay.fireDue(clock.now());
    expect(queue.overlay(a.heroId).penaltyTime).toBe(3600);
    expect(queue.overlay(b.heroId).penaltyTime).toBe(3600);
    expect(() => queue.add(a)).toThrow(BattlegroundDeniedError);
  });

  it("requeues a confirmed hero when the invite expires and bans the rest", async () => {
    const { queue, clock, delay } = makeQueue();
    const a = hero(1, 6);
    const b = hero(2, 7);
    queue.add(a);
    queue.add(b);
    expect(queue.confirm(a.heroId)).toEqual({ kind: "pending" });
    clock.advanceSeconds(120);
    await delay.fireDue(clock.now());
    expect(queue.overlay(a.heroId)).toMatchObject({
      userInQueue: 1,
      penaltyTime: 0,
      requestCount: 1,
    });
    expect(queue.overlay(b.heroId).penaltyTime).toBe(3600);
    expect(() => queue.add(b)).toThrow(/еще 60 мин/);
  });

  it("bans a hero who deletes an invite and puts the other back in line", () => {
    const { queue } = makeQueue();
    const a = hero(1, 6);
    const b = hero(2, 7);
    queue.add(a);
    queue.add(b);
    queue.delete(a.heroId);
    expect(queue.overlay(a.heroId).penaltyTime).toBe(3600);
    expect(queue.overlay(b.heroId)).toMatchObject({ userInQueue: 1, penaltyTime: 0 });
  });

  it("rejects a level outside the playable range", () => {
    const { queue } = makeQueue();
    expect(() => queue.add(hero(1, 1))).toThrow(/уровневые группы/);
  });

  it("tracks running matches and both-confirm", () => {
    const { queue } = makeQueue();
    const a = hero(1, 6);
    const b = hero(2, 7);
    queue.add(a);
    queue.add(b);
    expect(queue.confirm(a.heroId)).toEqual({ kind: "pending" });
    expect(queue.confirm(b.heroId)).toMatchObject({ kind: "matched", a, b });
    queue.noteMatchStarted();
    expect(queue.overlay(a.heroId).bgCount).toBe(1);
    queue.noteMatchEnded();
    expect(queue.overlay(a.heroId).bgCount).toBe(0);
  });
});

function makeQueue() {
  const clock = new FakeClock(START_MS);
  const delay = new ManualCombatDelay();
  const invites: Array<{ a: { heroId: number }; b: { heroId: number } }> = [];
  const queue = new BattlegroundQueue(raskop(), clock, delay, (invite) => {
    invites.push(invite);
  });
  return { queue, clock, delay, invites };
}

function hero(id: number, level: number) {
  return { heroId: id, accountId: id * 10, nick: `n${id}`, level };
}

function raskop(): BattlegroundDefinition {
  return {
    id: 2,
    type: "general",
    title: "Раскоп",
    flags: 2,
    available: 1,
    queueLevel: "[6 - 7]",
    error: "",
    playable: true,
    instArtikulId: "10",
    levelMin: 6,
    levelMax: 7,
    returnAreaId: "500",
    westAreaId: "635",
    arenaAreaId: "636",
    eastAreaId: "637",
    inviteTtlSec: 120,
    banSec: 3600,
    matchDurationSec: 600,
    maxScore: 20,
    pointsPerKill: 20,
    fightBg: "5_1",
    fightFlags: "128",
    mapPicture: "m.png",
    statsPicture: "s.jpg",
    description: "d",
    rules: "r",
    roomPos: [],
    leaderGroups: [],
  };
}
