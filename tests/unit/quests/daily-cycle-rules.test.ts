import { describe, expect, it } from "vitest";
import {
  DAILY_CYCLE_RULES,
  dailyCooldownSec,
  isDailyQuest,
  journalTimes,
  lastMoscow6am,
  nextMoscow6am,
  questExpOperationId,
  questExperienceGrant,
  shouldListFinishedDaily,
  shouldListInFinishedIds,
  shouldWipeDailyProgress,
} from "../../../src/modules/quests/domain/daily-cycle-rules.ts";

/** 2026-08-29 05:59:00 Europe/Moscow = 02:59 UTC */
const BEFORE_6 = Date.UTC(2026, 7, 29, 2, 59, 0) / 1000;
/** 2026-08-29 06:00:00 Europe/Moscow = 03:00 UTC */
const AT_6 = Date.UTC(2026, 7, 29, 3, 0, 0) / 1000;
const AFTER_6 = Date.UTC(2026, 7, 29, 3, 1, 0) / 1000;
const EVENING = Date.UTC(2026, 7, 29, 20, 0, 0) / 1000;
const TODAY_6 = AT_6;
const TOMORROW_6 = Date.UTC(2026, 7, 30, 3, 0, 0) / 1000;
const YESTERDAY_6 = Date.UTC(2026, 7, 28, 3, 0, 0) / 1000;

describe("DailyCycleRules Moscow 06:00", () => {
  it("uses today's 06:00 before the boundary and yesterday as last", () => {
    expect(nextMoscow6am(BEFORE_6, DAILY_CYCLE_RULES)).toBe(TODAY_6);
    expect(lastMoscow6am(BEFORE_6, DAILY_CYCLE_RULES)).toBe(YESTERDAY_6);
    expect(BEFORE_6 + dailyCooldownSec(BEFORE_6, DAILY_CYCLE_RULES)).toBe(TODAY_6);
  });

  it("rolls next to tomorrow at and after 06:00", () => {
    expect(nextMoscow6am(AT_6, DAILY_CYCLE_RULES)).toBe(TOMORROW_6);
    expect(nextMoscow6am(AFTER_6, DAILY_CYCLE_RULES)).toBe(TOMORROW_6);
    expect(nextMoscow6am(EVENING, DAILY_CYCLE_RULES)).toBe(TOMORROW_6);
    expect(lastMoscow6am(AT_6, DAILY_CYCLE_RULES)).toBe(TODAY_6);
    expect(lastMoscow6am(AFTER_6, DAILY_CYCLE_RULES)).toBe(TODAY_6);
    expect(AT_6 + dailyCooldownSec(AT_6, DAILY_CYCLE_RULES)).toBe(TOMORROW_6);
  });

  it("lands finished daily ftime+cooldown on the next 06:00 MSK", () => {
    const finishedAt = new Date(Date.UTC(2026, 7, 29, 20, 0, 0));
    const times = journalTimes(
      { flags: 1, status: "done", startedAt: finishedAt, finishedAt },
      DAILY_CYCLE_RULES,
    );
    expect(times.multitime).toBe(1);
    expect(times.ftime + times.cooldown).toBe(nextMoscow6am(times.ftime, DAILY_CYCLE_RULES));
    expect(times.ftime === 0 && times.cooldown === 86400).toBe(false);
  });

  it("does not countdown on an active daily", () => {
    const startedAt = new Date(AFTER_6 * 1000);
    const times = journalTimes(
      { flags: 1, status: "active", startedAt, finishedAt: null },
      DAILY_CYCLE_RULES,
    );
    expect(times.multitime).toBe(1);
    expect(times.ftime).toBe(0);
    expect(times.cooldown).toBe(0);
  });

  it("keeps daily done out of finished_quests_id and lists until hidden", () => {
    expect(shouldListInFinishedIds(0, "done")).toBe(true);
    expect(shouldListInFinishedIds(1, "done")).toBe(false);
    expect(shouldListInFinishedIds(256, "done")).toBe(true);
    expect(shouldListFinishedDaily(1, "done", 0)).toBe(true);
    expect(shouldListFinishedDaily(1, "done", 1)).toBe(false);
    expect(shouldListFinishedDaily(0, "done", 0)).toBe(false);
  });

  it("wipes stale active and done dailies relative to last 06:00", () => {
    expect(
      shouldWipeDailyProgress({
        flags: 1,
        status: "active",
        startedAtUnix: YESTERDAY_6 + 60,
        finishedAtUnix: null,
        last6am: TODAY_6,
      }),
    ).toBe(true);
    expect(
      shouldWipeDailyProgress({
        flags: 1,
        status: "active",
        startedAtUnix: TODAY_6,
        finishedAtUnix: null,
        last6am: TODAY_6,
      }),
    ).toBe(false);
    expect(
      shouldWipeDailyProgress({
        flags: 1,
        status: "done",
        startedAtUnix: YESTERDAY_6,
        finishedAtUnix: YESTERDAY_6 + 3600,
        last6am: TODAY_6,
      }),
    ).toBe(true);
    expect(
      shouldWipeDailyProgress({
        flags: 1,
        status: "done",
        startedAtUnix: TODAY_6,
        finishedAtUnix: TODAY_6 + 60,
        last6am: TODAY_6,
      }),
    ).toBe(false);
    expect(
      shouldWipeDailyProgress({
        flags: 0,
        status: "done",
        startedAtUnix: YESTERDAY_6,
        finishedAtUnix: YESTERDAY_6,
        last6am: TODAY_6,
      }),
    ).toBe(false);
    expect(
      shouldWipeDailyProgress({
        flags: 256,
        status: "done",
        startedAtUnix: YESTERDAY_6,
        finishedAtUnix: YESTERDAY_6,
        last6am: TODAY_6,
      }),
    ).toBe(false);
  });

  it("fails fast on missing flags, daily done without finishedAt, and ftime:0+86400", () => {
    expect(() => isDailyQuest(Number.NaN)).toThrow(/Quest flags is required/);
    expect(() =>
      shouldWipeDailyProgress({
        flags: 1,
        status: "done",
        startedAtUnix: YESTERDAY_6,
        finishedAtUnix: null,
        last6am: TODAY_6,
      }),
    ).toThrow(/Daily quest done without finishedAt/);
    expect(() =>
      journalTimes(
        {
          flags: 1,
          status: "done",
          startedAt: new Date(EVENING * 1000),
          finishedAt: null,
        },
        DAILY_CYCLE_RULES,
      ),
    ).toThrow(/Daily quest done without finishedAt/);
  });

  it("uses a cycle-aware EXP operation id only for daily quests", () => {
    expect(questExpOperationId(9, "q_engine_board", 0, null, DAILY_CYCLE_RULES)).toBe(
      "quest:9:q_engine_board:exp",
    );
    expect(questExpOperationId(9, "q_engine_daily", 1, EVENING, DAILY_CYCLE_RULES)).toBe(
      `quest:9:q_engine_daily:exp:${lastMoscow6am(EVENING, DAILY_CYCLE_RULES)}`,
    );
    expect(() => questExpOperationId(9, "q_engine_daily", 1, null, DAILY_CYCLE_RULES)).toThrow(
      /Daily quest done without finishedAt/,
    );
    expect(
      questExperienceGrant(9, "q_engine_board", 0, 0, new Date(EVENING * 1000)),
    ).toBeUndefined();
    expect(questExperienceGrant(9, "q_engine_daily", 1, 4, new Date(EVENING * 1000))).toEqual({
      operationId: `quest:9:q_engine_daily:exp:${lastMoscow6am(EVENING, DAILY_CYCLE_RULES)}`,
      amount: 4,
    });
  });
});
