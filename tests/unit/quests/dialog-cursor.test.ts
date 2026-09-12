import { describe, expect, it } from "vitest";
import path from "node:path";
import { loadContentBundleFile } from "../../../src/modules/content/infrastructure/load-content-bundle-file.ts";
import {
  dialogView,
  dialogViewForProgress,
  parkedFightStep,
} from "../../../src/modules/quests/domain/dialog-cursor.ts";
import { bumpMatchingGoal } from "../../../src/modules/quests/domain/bump-goal.ts";
import { currentGoal, goalsComplete } from "../../../src/modules/quests/domain/prior-gate.ts";
import type { HeroQuestGoal } from "../../../src/modules/quests/domain/hero-quest.ts";

const playable = loadContentBundleFile(path.resolve(process.cwd(), "content/playable-slice.json"));

function quest(key: string) {
  const row = playable.quests.find((item) => item.key === key);
  if (!row) throw new Error(`playable slice is missing ${key}`);
  return row;
}

function goalRow(questKey: string, goalId: string, done: 0 | 1, value: number): HeroQuestGoal {
  const authored = quest(questKey).goals.find((goal) => goal.id === goalId);
  if (!authored) throw new Error(`${questKey} is missing goal ${goalId}`);
  return { heroId: 1, questKey, goalId, goalOrd: authored.goalOrd, done, value };
}

describe("quest dialog cursor", () => {
  it("opens the board quest on the talk goal", () => {
    const view = dialogView(quest("q_engine_board"), 0, false);
    expect(view.mode).toBe("goal");
    expect(view.answers[0]?.key).toBe("accept_board");
  });

  it("parks the ritual on START_FIGHT until goals are done", () => {
    const ritual = quest("q_engine_fight");
    const parked = dialogView(ritual, 2, false);
    expect(parked.mode).toBe("player");
    expect(parked.answers[0]?.toFight).toBe(1);
    expect(parkedFightStep(ritual, 2, false)).toBe(2);
  });

  it("skips the parked fight button after goals complete", () => {
    const ritual = quest("q_engine_fight");
    const view = dialogView(ritual, 2, true);
    expect(view.mode).toBe("reward");
    expect(parkedFightStep(ritual, 2, true)).toBe(3);
  });
});

describe("quest prior-gate bump", () => {
  it("bumps only the current talk goal", () => {
    const board = quest("q_engine_board");
    const goals = board.goals.map((goal) => goalRow(board.key, goal.id, 0, 0));
    expect(currentGoal(board, goals)?.id).toBe("talk");
    const talk = bumpMatchingGoal(board, goals, { kind: "talk", npcId: 271 });
    expect(talk?.goal.done).toBe(1);
    expect(bumpMatchingGoal(board, goals, { kind: "buy", artikulId: 23 })).toBeNull();
  });

  it("treats empty goals as complete", () => {
    const empty = { ...quest("q_engine_board"), goals: [] };
    expect(goalsComplete(empty, [])).toBe(true);
  });

  it("parks the multi fight button while talk 272 is current", () => {
    const multi = quest("q_engine_multi");
    const goals = multi.goals.map((goal) => goalRow(multi.key, goal.id, 0, 0));
    const view = dialogViewForProgress(multi, 3, goals);
    expect(view.mode).toBe("stub");
  });

  it("does not bump talk on the wrong NPC", () => {
    const multi = quest("q_engine_multi");
    const goals = multi.goals.map((goal) => goalRow(multi.key, goal.id, 0, 0));
    expect(bumpMatchingGoal(multi, goals, { kind: "talk", npcId: 271 })).toBeNull();
    expect(bumpMatchingGoal(multi, goals, { kind: "talk", npcId: 272 })?.goal.done).toBe(1);
  });

  it("matches area_action by action id", () => {
    const area = quest("q_engine_area");
    const goals = area.goals.map((goal) => goalRow(area.key, goal.id, 0, 0));
    const bump = bumpMatchingGoal(area, goals, { kind: "area_action", actionId: 8 });
    expect(bump?.finished).toBe(true);
    expect(bump?.onFinish.map((effect) => effect.type)).toEqual(["START_FIGHT", "MSG", "SET_FLAG"]);
  });
});
