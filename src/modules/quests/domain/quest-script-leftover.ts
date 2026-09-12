import type { QuestScriptEffect } from "./quest-script-effect.ts";

function isQuestScriptLeftover(effect: QuestScriptEffect): boolean {
  return (
    effect.type === "START_FIGHT" || effect.type === "JUMP_AREA" || effect.type === "OPEN_STORE"
  );
}

export function leftoverQuestEffects(
  effects: readonly QuestScriptEffect[],
): readonly QuestScriptEffect[] {
  return effects.filter(isQuestScriptLeftover);
}

export function effectsWithoutLeftover(
  effects: readonly QuestScriptEffect[],
): readonly QuestScriptEffect[] {
  return effects.filter((effect) => !isQuestScriptLeftover(effect));
}

export function leftoverJumpArea(
  effects: readonly QuestScriptEffect[],
): Extract<QuestScriptEffect, { type: "JUMP_AREA" }> | null {
  const jump = effects.find((effect) => effect.type === "JUMP_AREA");
  return jump && jump.type === "JUMP_AREA" ? jump : null;
}

export function leftoverOpenStore(
  effects: readonly QuestScriptEffect[],
): Extract<QuestScriptEffect, { type: "OPEN_STORE" }> | null {
  const store = effects.find((effect) => effect.type === "OPEN_STORE");
  return store && store.type === "OPEN_STORE" ? store : null;
}
