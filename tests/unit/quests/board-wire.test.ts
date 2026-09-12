import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadContentBundleFile } from "../../../src/modules/content/infrastructure/load-content-bundle-file.ts";
import { boardRow } from "../../../src/modules/quests/domain/board-wire.ts";
import { boardLinkForNpc } from "../../../src/modules/quests/domain/npc-board-link.ts";
import type { HeroQuest, HeroQuestGoal } from "../../../src/modules/quests/domain/hero-quest.ts";

const playable = loadContentBundleFile(path.resolve(process.cwd(), "content/playable-slice.json"));

function multiQuest() {
  const row = playable.quests.find((item) => item.key === "q_engine_multi");
  if (!row) throw new Error("playable slice is missing q_engine_multi");
  return row;
}

function progress(status: "active" | "done"): HeroQuest {
  const multi = multiQuest();
  return {
    id: 1,
    heroId: 1,
    questKey: multi.key,
    bookId: multi.bookId,
    status,
    dialogStep: 0,
    dialogCursor: "0",
    waiting: null,
    startedAt: new Date(0),
    finishedAt: status === "done" ? new Date(1) : null,
    hiddenInJournal: 0,
  };
}

function goals(talkDone: 0 | 1): HeroQuestGoal[] {
  const multi = multiQuest();
  return multi.goals.map((goal) => ({
    heroId: 1,
    questKey: multi.key,
    goalId: goal.id,
    goalOrd: goal.goalOrd,
    done: goal.kind === "talk" ? talkDone : 0,
    value: goal.kind === "talk" ? talkDone : 0,
  }));
}

describe("multi-board visibility", () => {
  it("offers 271 with flags 32 and point_flags 8", () => {
    const multi = multiQuest();
    const link = boardLinkForNpc(multi, 271);
    if (!link) throw new Error("271 link is missing");
    const row = boardRow(multi, null, [], link);
    expect(row).toMatchObject({
      flags: 32,
      point_flags: 8,
      point_id: 6,
      award_rep: "",
    });
  });

  it("hides 272 until accept and after talk 272 is done", () => {
    const multi = multiQuest();
    const link = boardLinkForNpc(multi, 272);
    if (!link) throw new Error("272 link is missing");
    expect(boardRow(multi, null, [], link)).toBeNull();
    expect(boardRow(multi, progress("active"), goals(0), link)).toMatchObject({
      flags: 32,
      point_flags: 0,
      point_id: 7,
      award_rep: "",
      welcome_message: "Диковинная голова ждёт разговор.",
    });
    expect(boardRow(multi, progress("active"), goals(1), link)).toBeNull();
  });
});
