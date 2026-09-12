import type { QuestDocument, QuestDialogStepDocument } from "../../content/domain/content-quest.ts";
import type { HeroQuestGoal } from "./hero-quest.ts";
import { currentGoal, goalsComplete } from "./prior-gate.ts";

type DialogAnswer = Readonly<{
  id: number;
  message: string;
  key: string;
  toFight: 0 | 1;
  stepOrd: number;
}>;

export type DialogView = Readonly<{
  stepOrd: number;
  message: string;
  targetMessage: string;
  awardMessage: string;
  answers: readonly DialogAnswer[];
  mode: "goal" | "player" | "reward" | "stub";
}>;

export function dialogView(
  quest: QuestDocument,
  dialogStep: number,
  allGoalsDone: boolean,
): DialogView {
  const start = walkPreamble(quest.dialogSteps, dialogStep);
  const head = quest.dialogSteps[start.index];
  if (!head) return stubView(start.index, quest.welcomeActive);
  if (head.type === "reward" && !allGoalsDone) {
    return stubView(start.index, quest.welcomeActive);
  }
  if (head.type === "goal") {
    const player = nextPlayer(quest.dialogSteps, start.index + 1);
    return {
      stepOrd: start.index,
      message: start.message,
      targetMessage: head.text,
      awardMessage: "",
      answers: [
        {
          id: 1,
          message: player?.text ?? "Продолжить",
          key: player?.id ?? head.goal,
          toFight: player?.toFight ?? 0,
          stepOrd: start.index,
        },
      ],
      mode: "goal",
    };
  }
  if (head.type === "player") {
    if (allGoalsDone) {
      const after = advanceAfterPlayer(quest.dialogSteps, start.index);
      if (after !== start.index) return dialogView(quest, after, true);
    }
    const answers = playerAnswers(quest.dialogSteps, start.index);
    return {
      stepOrd: start.index,
      message: start.message,
      targetMessage: "",
      awardMessage: "",
      answers,
      mode: "player",
    };
  }
  if (head.type === "reward") {
    return {
      stepOrd: start.index,
      message: start.message || quest.welcomeReady,
      targetMessage: "",
      awardMessage: quest.awardDescription,
      answers: [
        {
          id: 1,
          message: head.answer,
          key: head.id || "reward",
          toFight: 0,
          stepOrd: start.index,
        },
      ],
      mode: "reward",
    };
  }
  return stubView(start.index, start.message || quest.welcomeActive);
}

export function dialogViewForProgress(
  quest: QuestDocument,
  dialogStep: number,
  goals: readonly HeroQuestGoal[],
): DialogView {
  const view = dialogView(quest, dialogStep, goalsComplete(quest, goals));
  const current = currentGoal(quest, goals);
  if (
    view.mode === "player" &&
    view.answers.some((answer) => answer.toFight === 1) &&
    current?.kind === "talk"
  ) {
    return stubView(view.stepOrd, quest.welcomeActive);
  }
  return view;
}

export function advanceAfterPlayer(
  steps: readonly QuestDialogStepDocument[],
  playerOrd: number,
): number {
  let index = playerOrd;
  while (index < steps.length && steps[index]?.type === "player") index += 1;
  return index;
}

export function parkedFightStep(
  quest: QuestDocument,
  dialogStep: number,
  allGoalsDone: boolean,
): number {
  if (allGoalsDone) return advanceAfterPlayer(quest.dialogSteps, dialogStep);
  const step = quest.dialogSteps[dialogStep];
  if (step?.type === "player" && step.toFight === 1) return dialogStep;
  return dialogStep;
}

function walkPreamble(
  steps: readonly QuestDialogStepDocument[],
  from: number,
): Readonly<{ index: number; message: string }> {
  const parts: string[] = [];
  let index = from;
  while (index < steps.length) {
    const step = steps[index];
    if (!step || (step.type !== "npc" && step.type !== "note" && step.type !== "stage")) break;
    parts.push(step.text);
    index += 1;
  }
  return { index, message: parts.join("<br><br>") };
}

function nextPlayer(
  steps: readonly QuestDialogStepDocument[],
  from: number,
): Extract<QuestDialogStepDocument, { type: "player" }> | undefined {
  const step = steps[from];
  return step?.type === "player" ? step : undefined;
}

function playerAnswers(
  steps: readonly QuestDialogStepDocument[],
  from: number,
): readonly DialogAnswer[] {
  const answers: DialogAnswer[] = [];
  let index = from;
  let id = 1;
  while (index < steps.length) {
    const step = steps[index];
    if (step?.type !== "player") break;
    answers.push({
      id,
      message: step.text,
      key: step.id,
      toFight: step.toFight,
      stepOrd: index,
    });
    id += 1;
    index += 1;
  }
  return answers;
}

function stubView(stepOrd: number, message: string): DialogView {
  return {
    stepOrd,
    message,
    targetMessage: "",
    awardMessage: "",
    answers: [{ id: 1, message: "Уйти", key: "bye", toFight: 0, stepOrd }],
    mode: "stub",
  };
}
