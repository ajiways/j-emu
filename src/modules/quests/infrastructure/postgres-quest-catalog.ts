import { and, eq } from "drizzle-orm";
import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import type {
  NpcDocument,
  QuestDocument,
  WorldFactDocument,
} from "../../content/domain/content-quest.ts";
import type { ActiveContentRevision } from "../../content/ports/active-content-revision.ts";
import type { AreaActionHotspot, QuestCatalog } from "../ports/quest-catalog.ts";
import { decodeWorldFactValues } from "../domain/world-fact-values.ts";
import { toNpc, toQuest } from "./postgres-quest-decode.ts";
import {
  authoredQuests,
  npcQuests,
  npcs,
  questAwardItems,
  questGoals,
  worldFacts,
} from "./schema-authored.ts";
import {
  questDialogSteps,
  questGoalArtikuls,
  questScriptFightRoster,
  questScriptOps,
} from "./schema-ops.ts";

type AuthoredQuestRow = typeof authoredQuests.$inferSelect;

export class PostgresQuestCatalog implements QuestCatalog {
  constructor(
    private readonly database: PostgresDatabase,
    private readonly revision: ActiveContentRevision,
  ) {}

  async npc(id: number): Promise<NpcDocument | null> {
    requirePositive(id, "NPC id");
    const releaseId = await this.revision.requireId();
    const rows = await this.database
      .session()
      .select()
      .from(npcs)
      .where(and(eq(npcs.releaseId, releaseId), eq(npcs.id, id)));
    if (rows.length > 1) throw new Error(`Multiple NPCs found for ${id}`);
    const row = rows[0];
    return row ? toNpc(row) : null;
  }

  async npcsInArea(areaId: string): Promise<readonly NpcDocument[]> {
    if (!areaId) throw new Error("NPC area id is required");
    const releaseId = await this.revision.requireId();
    const rows = await this.database
      .session()
      .select()
      .from(npcs)
      .where(and(eq(npcs.releaseId, releaseId), eq(npcs.areaId, areaId)));
    return rows.map(toNpc);
  }

  async quest(key: string): Promise<QuestDocument | null> {
    if (!key) throw new Error("Quest key is required");
    const releaseId = await this.revision.requireId();
    const rows = await this.database
      .session()
      .select()
      .from(authoredQuests)
      .where(and(eq(authoredQuests.releaseId, releaseId), eq(authoredQuests.key, key)));
    if (rows.length > 1) throw new Error(`Multiple quests found for ${key}`);
    const row = rows[0];
    if (!row) return null;
    const all = await this.hydrateAll(releaseId, [row]);
    return all[0] ?? null;
  }

  async questsForNpc(npcId: number): Promise<readonly QuestDocument[]> {
    requirePositive(npcId, "NPC id");
    const releaseId = await this.revision.requireId();
    const links = await this.database
      .session()
      .select()
      .from(npcQuests)
      .where(and(eq(npcQuests.releaseId, releaseId), eq(npcQuests.npcId, npcId)));
    if (links.length === 0) return [];
    const rows = await this.database
      .session()
      .select()
      .from(authoredQuests)
      .where(eq(authoredQuests.releaseId, releaseId));
    const wanted = new Set(links.map((link) => link.questKey));
    return this.hydrateAll(
      releaseId,
      rows.filter((row) => wanted.has(row.key)),
    );
  }

  async allQuests(): Promise<readonly QuestDocument[]> {
    const releaseId = await this.revision.requireId();
    const rows = await this.database
      .session()
      .select()
      .from(authoredQuests)
      .where(eq(authoredQuests.releaseId, releaseId));
    return this.hydrateAll(releaseId, rows);
  }

  async areaHotspots(areaId: string): Promise<readonly AreaActionHotspot[]> {
    const standing = await this.npcsInArea(areaId);
    const npcIds = new Set(standing.map((npc) => npc.id));
    const quests = await this.allQuests();
    const out: AreaActionHotspot[] = [];
    for (const quest of quests) {
      if (!npcIds.has(quest.npcId)) continue;
      for (const goal of quest.goals) {
        if (goal.kind !== "area_action") continue;
        if (goal.objectId < 1 || goal.actionId < 1) {
          throw new Error(`Quest ${quest.key} area_action hotspot is incomplete`);
        }
        out.push({
          objectId: goal.objectId,
          actionId: goal.actionId,
          title: goal.title,
          waitingTitle: goal.waitingTitle,
          waitingDurationSec: goal.waitingDurationSec,
          waitingPopup: goal.waitingPopup,
        });
      }
    }
    return out;
  }

  async worldFact(id: string): Promise<WorldFactDocument | null> {
    if (!id) throw new Error("World fact id is required");
    const releaseId = await this.revision.requireId();
    const rows = await this.database
      .session()
      .select()
      .from(worldFacts)
      .where(and(eq(worldFacts.releaseId, releaseId), eq(worldFacts.id, id)));
    if (rows.length > 1) throw new Error(`Multiple world facts found for ${id}`);
    const row = rows[0];
    return row ? { id: row.id, values: decodeWorldFactValues(row.values) } : null;
  }

  private async hydrateAll(
    releaseId: string,
    rows: readonly AuthoredQuestRow[],
  ): Promise<readonly QuestDocument[]> {
    if (rows.length === 0) return [];
    const awards = await this.database
      .session()
      .select()
      .from(questAwardItems)
      .where(eq(questAwardItems.releaseId, releaseId));
    const goals = await this.database
      .session()
      .select()
      .from(questGoals)
      .where(eq(questGoals.releaseId, releaseId));
    const artikuls = await this.database
      .session()
      .select()
      .from(questGoalArtikuls)
      .where(eq(questGoalArtikuls.releaseId, releaseId));
    const steps = await this.database
      .session()
      .select()
      .from(questDialogSteps)
      .where(eq(questDialogSteps.releaseId, releaseId));
    const ops = await this.database
      .session()
      .select()
      .from(questScriptOps)
      .where(eq(questScriptOps.releaseId, releaseId));
    const roster = await this.database
      .session()
      .select()
      .from(questScriptFightRoster)
      .where(eq(questScriptFightRoster.releaseId, releaseId));
    const links = await this.database
      .session()
      .select()
      .from(npcQuests)
      .where(eq(npcQuests.releaseId, releaseId));
    return rows
      .map((row) => toQuest(row, awards, goals, artikuls, steps, ops, roster, links))
      .sort((left, right) => left.boardOrd - right.boardOrd);
  }
}

function requirePositive(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 1) throw new Error(`${label} is required`);
}
