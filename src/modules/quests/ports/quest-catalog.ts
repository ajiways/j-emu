import type {
  NpcDocument,
  QuestDocument,
  WorldFactDocument,
} from "../../content/domain/content-quest.ts";

export type AreaActionHotspot = Readonly<{
  objectId: number;
  actionId: number;
  title: string;
  waitingTitle: string;
  waitingDurationSec: number;
  waitingPopup: string;
}>;

export interface QuestCatalog {
  npc(id: number): Promise<NpcDocument | null>;
  npcsInArea(areaId: string): Promise<readonly NpcDocument[]>;
  quest(key: string): Promise<QuestDocument | null>;
  questsForNpc(npcId: number): Promise<readonly QuestDocument[]>;
  allQuests(): Promise<readonly QuestDocument[]>;
  areaHotspots(areaId: string): Promise<readonly AreaActionHotspot[]>;
  worldFact(id: string): Promise<WorldFactDocument | null>;
}
