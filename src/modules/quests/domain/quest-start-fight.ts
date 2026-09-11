import type { QuestScriptOpDocument } from "../../content/domain/content-quest.ts";
import { scriptEffects, type QuestScriptEffect } from "./quest-script-effect.ts";

function questStartFightOps(
  ops: readonly QuestScriptOpDocument[],
): readonly Extract<QuestScriptOpDocument, { type: "START_FIGHT" }>[] {
  return ops.filter(
    (op): op is Extract<QuestScriptOpDocument, { type: "START_FIGHT" }> =>
      op.type === "START_FIGHT",
  );
}

export function hasQuestStartFight(ops: readonly QuestScriptOpDocument[]): boolean {
  return questStartFightOps(ops).length > 0;
}

export function effectsWithoutStartFight(
  effects: readonly QuestScriptEffect[],
): readonly QuestScriptEffect[] {
  return effects.filter((effect) => effect.type !== "START_FIGHT");
}

export function startFightEffects(
  ops: readonly QuestScriptOpDocument[],
): readonly QuestScriptEffect[] {
  return scriptEffects(questStartFightOps(ops));
}
