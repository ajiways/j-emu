import type {
  AmbushStartFightOpDocument,
  QuestScriptOpDocument,
  QuestStartFightOpDocument,
} from "../../content/domain/content-quest.ts";
import { scriptEffects, type QuestScriptEffect } from "./quest-script-effect.ts";

export function isQuestModeStartFight(op: QuestScriptOpDocument): op is QuestStartFightOpDocument {
  return op.type === "START_FIGHT" && "mode" in op;
}

export function isAmbushStartFight(op: QuestScriptOpDocument): op is AmbushStartFightOpDocument {
  return op.type === "START_FIGHT" && !("mode" in op);
}

export function hasQuestStartFight(ops: readonly QuestScriptOpDocument[]): boolean {
  return ops.some(isQuestModeStartFight);
}

export function startFightEffects(
  ops: readonly QuestScriptOpDocument[],
): readonly QuestScriptEffect[] {
  return scriptEffects(ops.filter((op) => op.type === "START_FIGHT"));
}
