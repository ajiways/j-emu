import type { QuestDocument } from "../../content/domain/content-quest.ts";
import { boardLinkForPoint } from "../domain/npc-board-link.ts";
import { QuestDeniedError } from "../domain/quest-denied-error.ts";
import type { QuestCatalog } from "../ports/quest-catalog.ts";

export function requirePositive(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 1) throw new Error(`${label} is required`);
}

export async function requireNpc(catalog: QuestCatalog, npcRef: number) {
  requirePositive(npcRef, "NPC ref");
  const npc = await catalog.npc(npcRef);
  if (!npc) throw new QuestDeniedError("Нет такого NPC");
  return npc;
}

export async function questByPoint(
  catalog: QuestCatalog,
  npcId: number,
  pointId: number,
): Promise<QuestDocument> {
  requirePositive(pointId, "point id");
  const quests = await catalog.questsForNpc(npcId);
  const quest = quests.find((row) => boardLinkForPoint(row, npcId, pointId));
  if (!quest) throw new QuestDeniedError("Нет такого задания");
  return quest;
}
