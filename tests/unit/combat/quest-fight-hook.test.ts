import { describe, expect, it } from "vitest";
import { startHuntWithIssuedId } from "../../support/combat-start-hunt.ts";
import { createCombatService } from "../../support/create-combat-service.ts";
import { MutableClock } from "../../support/fakes/mutable-clock.ts";
import { RecordingFightTerminalObserver } from "../../support/fakes/recording-fight-terminal-observer.ts";
import { SequenceRandom } from "../../support/fakes/sequence-random.ts";
import { unitHuntJoin, unitHuntStart } from "../../support/hunt-start-input.ts";

describe("quest fight terminal hook", () => {
  it("notifies a subscriber of quest win and denies join", async () => {
    const hook = new RecordingFightTerminalObserver();
    const { combat } = createCombatService({ random: new SequenceRandom([20]) });
    combat.bindTerminalObserver(hook);
    const start = await startHuntWithIssuedId(
      combat,
      unitHuntStart({ purpose: "quest", heroStrength: 200 }),
    );
    await expect(combat.joinHunt(unitHuntJoin({ fightId: start.fightId }))).rejects.toMatchObject({
      name: "HuntJoinDenied",
      message: "нельзя вмешаться в квестовый бой",
    });
    await combat.execute(1, { kind: "authenticate", fightId: start.fightId, sequence: 1 });
    await combat.execute(1, { kind: "strike", side: "left", sequence: 2 });
    expect(hook.notices).toEqual([
      {
        accountId: 1,
        fightId: start.fightId,
        winnerTeam: 2,
        outcome: "win",
        purpose: "quest",
        botId: 2,
        chatWin: "",
        chatLose: "",
      },
    ]);
  });

  it("notifies quest loss when the bot wins", async () => {
    const hook = new RecordingFightTerminalObserver();
    const clock = new MutableClock(new Date("2026-09-07T12:00:00.000Z"));
    const { combat, delay } = createCombatService({
      clock,
      random: new SequenceRandom([1, 27]),
    });
    combat.bindTerminalObserver(hook);
    const start = await startHuntWithIssuedId(
      combat,
      unitHuntStart({ purpose: "quest", heroStrength: 10, botStrength: 270 }),
    );
    await combat.execute(1, { kind: "authenticate", fightId: start.fightId, sequence: 1 });
    await combat.execute(1, { kind: "poll" });
    await combat.execute(1, { kind: "strike", side: "center", sequence: 2 });
    await combat.execute(1, { kind: "poll" });
    clock.advanceMs(1400);
    await delay.fireDue(clock.now());
    expect(hook.notices).toEqual([
      {
        accountId: 1,
        fightId: start.fightId,
        winnerTeam: 1,
        outcome: "loss",
        purpose: "quest",
        botId: 2,
        chatWin: "",
        chatLose: "",
      },
    ]);
  });

  it("tags a map hunt finish as purpose hunt", async () => {
    const hook = new RecordingFightTerminalObserver();
    const { combat } = createCombatService({ random: new SequenceRandom([20]) });
    combat.bindTerminalObserver(hook);
    const start = await startHuntWithIssuedId(combat, unitHuntStart({ heroStrength: 200 }));
    await combat.execute(1, { kind: "authenticate", fightId: start.fightId, sequence: 1 });
    await combat.execute(1, { kind: "strike", side: "left", sequence: 2 });
    expect(hook.notices).toEqual([
      {
        accountId: 1,
        fightId: start.fightId,
        winnerTeam: 1,
        outcome: "win",
        purpose: "hunt",
        botId: 2,
      },
    ]);
  });
});
