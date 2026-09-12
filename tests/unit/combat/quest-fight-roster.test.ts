import { describe, expect, it } from "vitest";
import { startQuestFight } from "../../../src/app/quest-fight-start.ts";
import type { Hero } from "../../../src/modules/character/domain/hero.ts";
import type { HuntRosterBotInput } from "../../../src/modules/combat/ports/combat-port.ts";
import { startHuntWithIssuedId } from "../../support/combat-start-hunt.ts";
import { createCombatService } from "../../support/create-combat-service.ts";
import { MutableClock } from "../../support/fakes/mutable-clock.ts";
import { RecordingFightTerminalObserver } from "../../support/fakes/recording-fight-terminal-observer.ts";
import { SequenceRandom } from "../../support/fakes/sequence-random.ts";
import {
  EMPTY_HUNT_BOT_SPELL_BOOK,
  GRYZL_FIGHT_LOOK,
  unitHuntStart,
} from "../../support/hunt-start-input.ts";

const hero = {
  ghost: false,
  hp: 10,
  accountId: 1,
  id: 1,
  nick: "Hero",
  level: 1,
  kind: 1,
  maxHp: 10,
  mp: 0,
  maxMp: 1,
  areaId: "503",
} as unknown as Hero;

describe("quest fight roster", () => {
  it("puts the opener on team 2 and enemies on team 1 with extra ephemeral bot ids", async () => {
    const { combat } = createCombatService({ random: new SequenceRandom([20]) });
    const start = await startHuntWithIssuedId(combat, rosterStart());
    await combat.execute(1, { kind: "authenticate", fightId: start.fightId, sequence: 1 });
    const events = await combat.execute(1, { kind: "poll" });
    const bootstrap = events.find((event) => event.type === "hunt-bootstrap");
    if (!bootstrap || bootstrap.type !== "hunt-bootstrap") {
      throw new Error("hunt-bootstrap is required");
    }
    expect(bootstrap.hero.team).toBe(2);
    expect(bootstrap.bot.team).toBe(1);
    expect(bootstrap.rosterBots.map((bot) => bot.id)).toEqual([1_000_000, 1_000_001, 1_000_002]);
    expect(bootstrap.rosterBots.map((bot) => bot.team)).toEqual([1, 1, 2]);
  });

  it("rejects a hunt fight that includes a quest roster", async () => {
    const { combat } = createCombatService({ random: new SequenceRandom([20]) });
    await expect(
      startHuntWithIssuedId(
        combat,
        unitHuntStart({ extraEnemies: [rosterBot(32, "Spirit", { hp: 5 })] }),
      ),
    ).rejects.toThrow(/Hunt fights cannot include a quest roster/);
  });

  it("skips quest kills on a roster win and keeps extra fight ids ephemeral", async () => {
    const hook = new RecordingFightTerminalObserver();
    const clock = new MutableClock(new Date("2026-09-07T12:00:00.000Z"));
    const { combat, delay } = createCombatService({
      clock,
      random: new SequenceRandom([20, 2, 20]),
    });
    combat.bindTerminalObserver(hook);
    const start = await startHuntWithIssuedId(
      combat,
      rosterStart({ extraEnemies: [rosterBot(32, "Spirit", { hp: 5 })] }),
    );
    await combat.execute(1, { kind: "authenticate", fightId: start.fightId, sequence: 1 });
    await combat.execute(1, { kind: "poll" });
    await combat.execute(1, { kind: "strike", side: "left", sequence: 2 });
    expect(hook.notices).toEqual([]);
    clock.advanceMs(1400);
    await delay.fireDue(clock.now());
    clock.advanceMs(1100);
    await delay.fireDue(clock.now());
    await combat.execute(1, { kind: "poll" });
    await combat.execute(1, { kind: "strike", side: "left", sequence: 3 });
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
        skipQuestKills: true,
      },
    ]);
  });

  it("fails when a roster bot is missing from catalog", async () => {
    await expect(
      startQuestFight(
        hero,
        {
          type: "START_FIGHT",
          mode: "quest",
          enemies: [{ artikulId: 2, count: 1 }],
          allies: [],
          chatStart: "",
          chatWin: "",
          chatLose: "",
        },
        {
          catalog: { bot: async () => null },
          combatStrength: async () => 1,
        } as never,
      ),
    ).rejects.toThrow(/Bot catalog entry 2 is missing/);
  });

  it("fails when START_FIGHT has no enemies", async () => {
    await expect(
      startQuestFight(
        hero,
        {
          type: "START_FIGHT",
          mode: "quest",
          enemies: [],
          allies: [],
          chatStart: "",
          chatWin: "",
          chatLose: "",
        },
        {
          catalog: { bot: async () => null },
          combatStrength: async () => 1,
        } as never,
      ),
    ).rejects.toThrow(/START_FIGHT requires an enemy/);
  });
});

function rosterStart(
  overrides: Parameters<typeof unitHuntStart>[0] = {},
): ReturnType<typeof unitHuntStart> {
  return unitHuntStart({
    purpose: "quest",
    heroStrength: 200,
    extraEnemies: [rosterBot(32, "Spirit", { hp: 5 })],
    allies: [rosterBot(4, "Hissa", { hp: 50, strength: 80 })],
    ...overrides,
  });
}

function rosterBot(
  artikulId: number,
  nick: string,
  overrides: Partial<HuntRosterBotInput> = {},
): HuntRosterBotInput {
  return {
    artikulId,
    nick,
    level: 1,
    hp: 20,
    strength: 20,
    avatar: GRYZL_FIGHT_LOOK.botAvatar,
    sk: GRYZL_FIGHT_LOOK.botSk,
    body: GRYZL_FIGHT_LOOK.botBody,
    spellBook: EMPTY_HUNT_BOT_SPELL_BOOK,
    ...overrides,
  };
}
