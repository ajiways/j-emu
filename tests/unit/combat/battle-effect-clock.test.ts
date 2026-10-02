import { describe, expect, it } from "vitest";
import type { Battle } from "../../../src/modules/combat/domain/battle.ts";
import { EMPTY_HUNT_BOT_SPELL_BOOK } from "../../support/hunt-start-input.ts";
import { createUnitBattle } from "../../support/fight-rules.ts";
import { unitFightJoin, unitHuntFightSetup } from "../../support/fight-setup.ts";
import { SequenceRandom } from "../../support/fakes/sequence-random.ts";

const NOW = Date.parse("2026-09-07T12:00:00.000Z");

function poison(battle: Battle, botIndex: number): void {
  const bot = battle.bots[botIndex];
  if (!bot) throw new Error("expected a bot");
  bot.effects.attachTick({
    kind: 4,
    sourceId: 1,
    artikulId: 447,
    title: "Ветхий знак погибели",
    img: "znak_death1.png",
    dmgType: 256,
    durationSeconds: 80,
    periodSeconds: 20,
    nowMs: NOW,
    castEndsTurn: false,
    amount: 500,
    catalogPcStr: 0,
    catalogStr: 0,
    casterStrength: 10,
    casterMagPower: 0,
    casterMagResist: 0,
  });
}

const EXTRA_BOT = {
  fightId: 1_000_001,
  artikulId: 2,
  nick: "Второй",
  level: 1,
  hp: 20,
  strength: 10,
  initiative: 0,
  magPower: 0,
  magResist: 0,
  avatar: "avatar_gryzl1_sm.jpg",
  sk: "11",
  body: "",
  spellBook: EMPTY_HUNT_BOT_SPELL_BOOK,
};

describe("Battle effect clock", () => {
  it("has no wake-up until some fighter carries a periodic effect", () => {
    const battle = createUnitBattle(unitHuntFightSetup(), new SequenceRandom([1]));
    expect(battle.nextEffectDueMs()).toBeNull();
    poison(battle, 0);
    expect(battle.nextEffectDueMs()).toBe(NOW + 20_000);
  });

  it("ends the fight when a timer tick kills the last bot", () => {
    const battle = createUnitBattle(unitHuntFightSetup(), new SequenceRandom([500]));
    battle.authenticate(1, NOW);
    poison(battle, 0);
    const outcome = battle.tickDueEffects(NOW + 20_000);
    expect(outcome.finished).toMatchObject({ type: "finished", winnerTeam: 1 });
    expect(battle.finished).toBe(true);
    expect(outcome.deliveries[0]?.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "damage",
          animation: "",
          targetId: 1_000_000,
          killed: true,
        }),
      ]),
    );
  });

  it("brings the next foe when a timer tick kills the paired bot", () => {
    const battle = createUnitBattle(
      unitHuntFightSetup({ purpose: "quest", extraEnemies: [EXTRA_BOT] }),
      new SequenceRandom([500]),
    );
    battle.authenticate(1, NOW);
    poison(battle, 0);
    const outcome = battle.tickDueEffects(NOW + 20_000);
    expect(outcome.finished).toBeNull();
    expect(outcome.reassignedAccountIds).toEqual([1]);
    expect(outcome.deliveries.flatMap((delivery) => delivery.events)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "opponent-new",
          bot: expect.objectContaining({ id: 1_000_001 }),
        }),
      ]),
    );
    expect(battle.pairedOpponent(1)).toEqual({ kind: "bot" });
    expect(battle.foeBotSnap(1).id).toBe(1_000_001);
  });

  it("lets the next foe strike first when the opening roll falls to it", () => {
    const battle = createUnitBattle(
      unitHuntFightSetup({ purpose: "quest", extraEnemies: [EXTRA_BOT] }),
      new SequenceRandom([500]),
      new SequenceRandom([0.99, 0.01]),
    );
    battle.authenticate(1, NOW);
    poison(battle, 0);
    const outcome = battle.tickDueEffects(NOW + 20_000);
    expect(outcome.finished).toBeNull();
    expect(outcome.reassignedAccountIds).toEqual([1]);
    expect(outcome.deliveries.flatMap((delivery) => delivery.events)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "opponent-new",
          bot: expect.objectContaining({ id: 1_000_001 }),
        }),
      ]),
    );
    expect(battle.nextActorIdOf(1)).toBe(1_000_001);
  });

  it("ticks an effect on a participant who waits for a foe, as it does on one in a duel", () => {
    const battle = createUnitBattle(unitHuntFightSetup(), new SequenceRandom([5]));
    battle.authenticate(1, NOW);
    battle.addHuman(unitFightJoin({ hp: 100, maxHp: 100 }));
    battle.authenticate(2, NOW);
    const waiter = battle.boardParticipants().humans[1];
    if (!waiter?.waiting) throw new Error("the joiner should be waiting");
    waiter.effects.attachTick({
      kind: 4,
      sourceId: 1,
      artikulId: 447,
      title: "Ветхий знак погибели",
      img: "znak_death1.png",
      dmgType: 256,
      durationSeconds: 80,
      periodSeconds: 20,
      nowMs: NOW,
      castEndsTurn: false,
      amount: 5,
      catalogPcStr: 0,
      catalogStr: 0,
      casterStrength: 10,
      casterMagPower: 0,
      casterMagResist: 0,
    });
    expect(battle.nextEffectDueMs()).toBe(NOW + 20_000);
    battle.tickDueEffects(NOW + 20_000);
    expect(waiter.hp).toBeLessThan(100);
  });
});
