import { describe, expect, it } from "vitest";
import path from "node:path";
import { loadContentBundleFile } from "../../../src/modules/content/infrastructure/load-content-bundle-file.ts";
import type { QuestDocument } from "../../../src/modules/content/domain/content-quest.ts";
import type { HeroQuest, HeroQuestGoal } from "../../../src/modules/quests/domain/hero-quest.ts";
import { questBookSnapshot } from "../../../src/modules/quests/domain/quest-book-snapshot.ts";
import { boardRow } from "../../../src/modules/quests/domain/board-wire.ts";
import {
  DAILY_CYCLE_RULES,
  nextMoscow6am,
  unixOf,
} from "../../../src/modules/quests/domain/daily-cycle-rules.ts";

const playable = loadContentBundleFile(path.resolve(process.cwd(), "content/playable-slice.json"));

function quest(key: string): QuestDocument {
  const row = playable.quests.find((item) => item.key === key);
  if (!row) throw new Error(`playable slice is missing ${key}`);
  return row;
}

function progress(
  key: string,
  status: "active" | "done",
  extras: Partial<HeroQuest> = {},
): HeroQuest {
  const authored = quest(key);
  const startedAt = extras.startedAt ?? new Date("2026-08-29T20:00:00.000Z");
  return {
    id: 1,
    heroId: 1,
    questKey: key,
    bookId: authored.bookId,
    status,
    dialogStep: 0,
    dialogCursor: "0",
    waiting: null,
    startedAt,
    finishedAt: extras.finishedAt ?? (status === "done" ? startedAt : null),
    hiddenInJournal: extras.hiddenInJournal ?? 0,
  };
}

describe("quest book snapshot daily journal", () => {
  it("keeps finished daily out of finished_quests_id and on the started tab", () => {
    const daily = quest("q_engine_daily");
    const finishedAt = new Date("2026-08-29T20:00:00.000Z");
    const snapshot = questBookSnapshot(
      "started",
      playable.quests,
      [progress("q_engine_daily", "done", { finishedAt })],
      new Map(),
    );
    expect(snapshot.finishedIds).not.toContain(daily.bookId);
    const row = snapshot.active.find((item) => item.bookId === daily.bookId);
    expect(row).toMatchObject({
      status: "finished",
      multitime: 1,
      flags: 1,
    });
    if (!row) throw new Error("finished daily is missing from started tab");
    expect(row.ftime).toBe(unixOf(finishedAt, "finishedAt"));
    expect(row.ftime + row.cooldown).toBe(nextMoscow6am(row.ftime, DAILY_CYCLE_RULES));
    expect(row.ftime === 0 && row.cooldown === 86400).toBe(false);
  });

  it("hides a finished daily after book|quest_delete", () => {
    const snapshot = questBookSnapshot(
      "started",
      playable.quests,
      [progress("q_engine_daily", "done", { hiddenInJournal: 1 })],
      new Map(),
    );
    expect(snapshot.active).toEqual([]);
    expect(snapshot.finishedIds).toEqual([]);
  });

  it("still lists one-shot done in finished_quests_id", () => {
    const board = quest("q_engine_board");
    const snapshot = questBookSnapshot(
      "started",
      playable.quests,
      [progress("q_engine_board", "done")],
      new Map(),
    );
    expect(snapshot.finishedIds).toEqual([board.bookId]);
    expect(snapshot.active).toEqual([]);
  });

  it("hides a done daily from the NPC board", () => {
    expect(boardRow(quest("q_engine_daily"), progress("q_engine_daily", "done"), [])).toBeNull();
    const offer = boardRow(quest("q_engine_daily"), null, []);
    expect(offer?.flags).toBe(1);
    expect(offer?.point_flags).toBe(8);
    const goals: HeroQuestGoal[] = [
      {
        heroId: 1,
        questKey: "q_engine_daily",
        goalId: "talk_daily",
        goalOrd: 1,
        done: 0,
        value: 0,
      },
    ];
    const mid = boardRow(quest("q_engine_daily"), progress("q_engine_daily", "active"), goals);
    expect(mid?.point_flags).toBe(0);
  });
});
