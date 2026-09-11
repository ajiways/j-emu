import type { QuestScriptOpDocument } from "../../content/domain/content-quest.ts";

export type QuestScriptEffect =
  | Extract<QuestScriptOpDocument, { type: "START_FIGHT" }>
  | Extract<QuestScriptOpDocument, { type: "GRANT_ARTIKUL" }>
  | Extract<QuestScriptOpDocument, { type: "GRANT_PROFESSION" }>
  | Extract<QuestScriptOpDocument, { type: "REMOVE_ARTIKUL" }>
  | Extract<QuestScriptOpDocument, { type: "MSG" }>
  | Extract<QuestScriptOpDocument, { type: "SET_FLAG" }>
  | Extract<QuestScriptOpDocument, { type: "CLEAR_FLAG" }>
  | Extract<QuestScriptOpDocument, { type: "BUMP_GOAL" }>
  | Extract<QuestScriptOpDocument, { type: "COMPLETE_GOAL" }>
  | Extract<QuestScriptOpDocument, { type: "GRANT_AWARDS" }>;

export function scriptEffects(ops: readonly QuestScriptOpDocument[]): readonly QuestScriptEffect[] {
  return ops.map((op) => op);
}
