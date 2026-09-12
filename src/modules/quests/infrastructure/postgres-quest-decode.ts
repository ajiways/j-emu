import type {
  AmbushStartFightOpDocument,
  NpcDocument,
  QuestAwardItemDocument,
  QuestAwardRepDocument,
  QuestBoardLinkDocument,
  QuestDialogStepDocument,
  QuestDocument,
  QuestGoalArtikulDocument,
  QuestGoalDocument,
  QuestScriptOpDocument,
} from "../../content/domain/content-quest.ts";
import type {
  authoredQuests,
  npcQuests,
  npcs,
  questAwardItems,
  questGoals,
} from "./schema-authored.ts";
import type {
  questDialogSteps,
  questGoalArtikuls,
  questScriptFightRoster,
  questScriptOps,
} from "./schema-ops.ts";

type AuthoredQuestRow = typeof authoredQuests.$inferSelect;
type NpcQuestLinkRow = typeof npcQuests.$inferSelect;

export function toNpc(row: typeof npcs.$inferSelect): NpcDocument {
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

export function toQuest(
  row: AuthoredQuestRow,
  awards: readonly (typeof questAwardItems.$inferSelect)[],
  goals: readonly (typeof questGoals.$inferSelect)[],
  artikuls: readonly (typeof questGoalArtikuls.$inferSelect)[],
  steps: readonly (typeof questDialogSteps.$inferSelect)[],
  ops: readonly (typeof questScriptOps.$inferSelect)[],
  roster: readonly (typeof questScriptFightRoster.$inferSelect)[],
  links: readonly NpcQuestLinkRow[],
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
  const awardRep = toAwardRep(row);
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
    ...(awardRep ? { awardRep } : {}),
    boards: extraBoards(row, links),
    scripts: { onAccept: opsFor(ops, roster, row.key, "on_accept", "on_accept") },
    goals: questGoalsRows,
    dialogSteps,
  };
}

function extraBoards(
  row: AuthoredQuestRow,
  links: readonly NpcQuestLinkRow[],
): readonly QuestBoardLinkDocument[] {
  return links
    .filter(
      (link) =>
        link.questKey === row.key && !(link.npcId === row.npcId && link.pointId === row.pointId),
    )
    .sort((left, right) => left.boardOrd - right.boardOrd)
    .map((link) => ({
      npcId: link.npcId,
      boardOrd: link.boardOrd,
      pointId: link.pointId,
      activeOnly: link.activeOnly,
      welcomeMessage: link.welcomeMessage,
    }));
}

function toAwardRep(row: AuthoredQuestRow): QuestAwardRepDocument | undefined {
  if (row.awardRepObjectId === null) {
    if (row.awardRepAmount !== null || row.awardRepCap !== null) {
      throw new Error(`Quest ${row.key} awardRep is incomplete`);
    }
    return undefined;
  }
  if (row.awardRepAmount === null || row.awardRepCap === null) {
    throw new Error(`Quest ${row.key} awardRep is incomplete`);
  }
  return {
    objectId: row.awardRepObjectId,
    amount: row.awardRepAmount,
    cap: row.awardRepCap,
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
  hook: "dialog" | "goal_on_finish" | "reward" | "on_accept",
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
    if (row.fightMode === "quest") {
      const entries = roster.filter(
        (item) =>
          item.questKey === row.questKey &&
          item.hook === row.hook &&
          item.ownerKey === row.ownerKey,
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
    if (row.fightMode !== null) {
      throw new Error(`START_FIGHT fight_mode ${row.fightMode} is not supported`);
    }
    const ambush: AmbushStartFightOpDocument = {
      type: "START_FIGHT",
      artikulId: requireInt(row.artikulId),
      ...decodeAmbushChance(row.value),
    };
    return ambush;
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
  if (row.type === "JUMP_AREA") return { type: "JUMP_AREA" };
  throw new Error(`Quest script type ${row.type} is unknown`);
}

function decodeAmbushChance(raw: string | null): { chance: number } | Record<string, never> {
  if (raw === null) return {};
  const chance = Number(raw);
  if (!Number.isFinite(chance) || chance < 0 || chance > 1) {
    throw new Error(`Ambush chance ${raw} is not in [0, 1]`);
  }
  return { chance };
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
