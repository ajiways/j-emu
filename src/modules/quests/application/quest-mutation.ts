import type { DialogView } from "../domain/dialog-cursor.ts";
import type { QuestScriptEffect } from "../domain/quest-script-effect.ts";

export type QuestAnswerInput = Readonly<{
  npcRef: number;
  pointId: number;
  answerId: number;
}>;

type QuestExperienceGrant = Readonly<{
  operationId: string;
  amount: number;
}>;

export type QuestMutation = Readonly<{
  effects: readonly QuestScriptEffect[];
  bookDirty: boolean;
  npcId: number;
  questKey?: string;
  dialog?: DialogView;
  pointId?: number;
  waiting?: Readonly<{
    title: string;
    start: number;
    finish: number;
    popup: string;
  }>;
  popup?: string;
  finishedAt?: Date;
  experienceGrant?: QuestExperienceGrant;
}>;
