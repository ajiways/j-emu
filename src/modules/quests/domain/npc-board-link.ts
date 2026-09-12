import type { QuestBoardLinkDocument, QuestDocument } from "../../content/domain/content-quest.ts";

export function primaryBoardLink(quest: QuestDocument): QuestBoardLinkDocument {
  return {
    npcId: quest.npcId,
    boardOrd: quest.boardOrd,
    pointId: quest.pointId,
    activeOnly: false,
    welcomeMessage: quest.welcomeOffer,
  };
}

function questBoardLinks(quest: QuestDocument): readonly QuestBoardLinkDocument[] {
  return [primaryBoardLink(quest), ...quest.boards];
}

export function boardLinkForNpc(
  quest: QuestDocument,
  npcId: number,
): QuestBoardLinkDocument | null {
  return questBoardLinks(quest).find((link) => link.npcId === npcId) ?? null;
}

export function boardLinkForPoint(
  quest: QuestDocument,
  npcId: number,
  pointId: number,
): QuestBoardLinkDocument | null {
  return (
    questBoardLinks(quest).find((link) => link.npcId === npcId && link.pointId === pointId) ?? null
  );
}
