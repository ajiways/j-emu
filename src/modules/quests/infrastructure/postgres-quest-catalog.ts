import { and, eq } from "drizzle-orm";
import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import type {
  NpcDocument,
  QuestAwardItemDocument,
  QuestDialogStepDocument,
  QuestDocument,
  QuestGoalArtikulDocument,
  QuestGoalDocument,
  QuestScriptOpDocument,
  WorldFactDocument,
} from "../../content/domain/content-quest.ts";
import type { ActiveContentRevision } from "../../content/ports/active-content-revision.ts";
import type { AreaActionHotspot, QuestCatalog } from "../ports/quest-catalog.ts";
import { decodeWorldFactValues } from "../domain/world-fact-values.ts";
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
    return rows
      .map((row) => toQuest(row, awards, goals, artikuls, steps, ops, roster))
      .sort((left, right) => left.boardOrd - right.boardOrd);
  }
}

type AuthoredQuestRow = typeof authoredQuests.$inferSelect;

function toNpc(row: typeof npcs.$inferSelect): NpcDocument {
  return {
    id: row.id,
    infoId: row.infoId,
    title: row.title,
    picture: row.picture,
    description: row.description,
    elsetext: row.elsetext,
    areaId: row.areaId,
    itemId: row.itemId,
  };
}

function toQuest(
  row: AuthoredQuestRow,
  awards: readonly (typeof questAwardItems.$inferSelect)[],
  goals: readonly (typeof questGoals.$inferSelect)[],
  artikuls: readonly (typeof questGoalArtikuls.$inferSelect)[],
  steps: readonly (typeof questDialogSteps.$inferSelect)[],
  ops: readonly (typeof questScriptOps.$inferSelect)[],
  roster: readonly (typeof questScriptFightRoster.$inferSelect)[],
): QuestDocument {
  const awardItems: QuestAwardItemDocument[] = awards
    .filter((item) => item.questKey === row.key)
    .map((item) => ({ artikulId: item.artikulId, count: item.count }));
  const questGoalsRows = goals
    .filter((goal) => goal.questKey === row.key)
    .sort((left, right) => left.goalOrd - right.goalOrd)
    .map((goal) => toGoal(goal, artikuls, ops, roster));
  const dialogSteps = steps
    .filter((step) => step.questKey === row.key)
    .sort((left, right) => left.stepOrd - right.stepOrd)
    .map((step) => toStep(step, ops, roster));
  return {
    key: row.key,
    bookId: row.bookId,
    title: row.title,
    description: row.description,
    awardDescription: row.awardDescription,
    flags: requireFlags(row.flags),
    levelMin: row.levelMin,
    levelMax: row.levelMax,
    npcId: row.npcId,
    pointId: row.pointId,
    boardOrd: row.boardOrd,
    welcomeOffer: row.welcomeOffer,
    welcomeActive: row.welcomeActive,
    welcomeReady: row.welcomeReady,
    awardExp: row.awardExp,
    awardMoneyMinor: row.awardMoneyMinor,
    awardItems,
    goals: questGoalsRows,
    dialogSteps,
  };
}

function toGoal(
  row: typeof questGoals.$inferSelect,
  artikuls: readonly (typeof questGoalArtikuls.$inferSelect)[],
  ops: readonly (typeof questScriptOps.$inferSelect)[],
  roster: readonly (typeof questScriptFightRoster.$inferSelect)[],
): QuestGoalDocument {
  const goalArtikuls: QuestGoalArtikulDocument[] = artikuls
    .filter((item) => item.questKey === row.questKey && item.goalId === row.goalId)
    .map((item) => ({
      role: item.role as QuestGoalArtikulDocument["role"],
      artikulId: item.artikulId,
    }));
  return {
    id: row.goalId,
    kind: row.kind as QuestGoalDocument["kind"],
    title: row.title,
    goalOrd: row.goalOrd,
    limit: row.limitValue,
    artikuls: goalArtikuls,
    actionId: row.actionId,
    objectId: row.objectId,
    waitingTitle: row.waitingTitle,
    waitingDurationSec: row.waitingDurationSec,
    waitingPopup: row.waitingPopup,
    onFinish: opsFor(ops, roster, row.questKey, "goal_on_finish", row.goalId),
  };
}

function toStep(
  row: typeof questDialogSteps.$inferSelect,
  ops: readonly (typeof questScriptOps.$inferSelect)[],
  roster: readonly (typeof questScriptFightRoster.$inferSelect)[],
): QuestDialogStepDocument {
  if (row.type === "goal") {
    return { type: "goal", text: row.text, goal: row.goalId, id: row.stepId };
  }
  if (row.type === "player") {
    return {
      type: "player",
      text: row.text,
      id: row.stepId,
      next: row.nextKey,
      toFight: row.toFight === 1 ? 1 : 0,
      scripts: opsFor(ops, roster, row.questKey, "dialog", String(row.stepOrd)),
    };
  }
  if (row.type === "reward") {
    return {
      type: "reward",
      text: row.text,
      answer: row.answer,
      id: row.stepId,
      scripts: opsFor(ops, roster, row.questKey, "reward", String(row.stepOrd)),
    };
  }
  if (row.type !== "npc" && row.type !== "note" && row.type !== "stage") {
    throw new Error(`Quest dialog step type ${row.type} is unknown`);
  }
  return { type: row.type, text: row.text, id: row.stepId };
}

function opsFor(
  ops: readonly (typeof questScriptOps.$inferSelect)[],
  roster: readonly (typeof questScriptFightRoster.$inferSelect)[],
  questKey: string,
  hook: "dialog" | "goal_on_finish" | "reward",
  ownerKey: string,
): readonly QuestScriptOpDocument[] {
  return ops
    .filter((op) => op.questKey === questKey && op.hook === hook && op.ownerKey === ownerKey)
    .sort((left, right) => left.opOrd - right.opOrd)
    .map((op) => decodeOp(op, roster));
}

function decodeOp(
  row: typeof questScriptOps.$inferSelect,
  roster: readonly (typeof questScriptFightRoster.$inferSelect)[],
): QuestScriptOpDocument {
  if (row.type === "START_FIGHT") {
    const entries = roster.filter(
      (item) =>
        item.questKey === row.questKey && item.hook === row.hook && item.ownerKey === row.ownerKey,
    );
    return {
      type: "START_FIGHT",
      mode: "quest",
      enemies: entries
        .filter((item) => item.side === "enemy")
        .sort((left, right) => left.ord - right.ord)
        .map((item) => ({ artikulId: item.artikulId, count: item.count })),
      allies: entries
        .filter((item) => item.side === "ally")
        .sort((left, right) => left.ord - right.ord)
        .map((item) => ({ artikulId: item.artikulId, count: item.count })),
      chatStart: row.chatStart ?? "",
      chatWin: row.chatWin ?? "",
      chatLose: row.chatLose ?? "",
    };
  }
  if (row.type === "GRANT_ARTIKUL") {
    return {
      type: "GRANT_ARTIKUL",
      artikulId: requireInt(row.artikulId),
      count: requireInt(row.count),
    };
  }
  if (row.type === "REMOVE_ARTIKUL") {
    return {
      type: "REMOVE_ARTIKUL",
      artikulId: requireInt(row.artikulId),
      count: requireInt(row.count),
    };
  }
  if (row.type === "GRANT_PROFESSION") {
    return { type: "GRANT_PROFESSION", professionId: requireInt(row.professionId) };
  }
  if (row.type === "MSG") {
    if (!row.text) throw new Error("MSG script text is required");
    return { type: "MSG", text: row.text };
  }
  if (row.type === "SET_FLAG") {
    if (!row.flag || row.value === null) throw new Error("SET_FLAG requires flag and value");
    return { type: "SET_FLAG", flag: row.flag, value: row.value };
  }
  if (row.type === "CLEAR_FLAG") {
    if (!row.flag) throw new Error("CLEAR_FLAG requires flag");
    return { type: "CLEAR_FLAG", flag: row.flag };
  }
  if (row.type === "BUMP_GOAL") {
    if (!row.goalId) throw new Error("BUMP_GOAL requires goal");
    return { type: "BUMP_GOAL", goal: row.goalId };
  }
  if (row.type === "COMPLETE_GOAL") {
    if (!row.goalId) throw new Error("COMPLETE_GOAL requires goal");
    return { type: "COMPLETE_GOAL", goal: row.goalId };
  }
  if (row.type === "GRANT_AWARDS") return { type: "GRANT_AWARDS" };
  throw new Error(`Quest script type ${row.type} is unknown`);
}

function requirePositive(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 1) throw new Error(`${label} is required`);
}

function requireInt(value: number | null): number {
  if (value === null || !Number.isInteger(value) || value < 1) {
    throw new Error("Quest script numeric field is required");
  }
  return value;
}

function requireFlags(value: number): number {
  if (!Number.isInteger(value) || value < 0) throw new Error("Quest flags is required");
  return value;
}
