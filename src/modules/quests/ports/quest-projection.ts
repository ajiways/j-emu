import type {
  NpcDocument,
  QuestDocument,
  WorldFactDocument,
} from "../../content/domain/content-quest.ts";

export type QuestMaterialization = Readonly<{
  npcs: readonly NpcDocument[];
  quests: readonly QuestDocument[];
  worldFacts: readonly WorldFactDocument[];
}>;

export interface QuestProjection {
  materialize(releaseId: string, documents: QuestMaterialization): Promise<void>;
}
