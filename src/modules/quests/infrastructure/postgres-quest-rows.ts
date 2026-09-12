import type {
  NpcDocument,
  QuestDocument,
  QuestScriptOpDocument,
  WorldFactDocument,
} from "../../content/domain/content-quest.ts";
import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import { encodeWorldFactValues } from "../domain/world-fact-values.ts";
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

export async function insertQuestDocuments(
  session: ReturnType<PostgresDatabase["session"]>,
  releaseId: string,
  npcsRows: readonly NpcDocument[],
  quests: readonly QuestDocument[],
  facts: readonly WorldFactDocument[],
): Promise<void> {
  if (npcsRows.length === 0) throw new Error("Quest npcs are missing");
  if (quests.length === 0) throw new Error("Quest documents are missing");
  if (facts.length === 0) throw new Error("World facts are missing");
  await session.insert(npcs).values(
    npcsRows.map((npc) => ({
      releaseId,
      id: npc.id,
      infoId: npc.infoId,
      title: npc.title,
      picture: npc.picture,
      description: npc.description,
      elsetext: npc.elsetext,
      areaId: npc.areaId,
      itemId: npc.itemId,
    })),
  );
  await session.insert(worldFacts).values(
    facts.map((fact) => ({
      releaseId,
      id: fact.id,
      values: encodeWorldFactValues(fact.values),
    })),
  );
  await session.insert(authoredQuests).values(
    quests.map((quest) => ({
      releaseId,
      key: quest.key,
      bookId: quest.bookId,
      title: quest.title,
      description: quest.description,
      awardDescription: quest.awardDescription,
      flags: quest.flags,
      levelMin: quest.levelMin,
      levelMax: quest.levelMax,
      npcId: quest.npcId,
      pointId: quest.pointId,
      boardOrd: quest.boardOrd,
      welcomeOffer: quest.welcomeOffer,
      welcomeActive: quest.welcomeActive,
      welcomeReady: quest.welcomeReady,
      awardExp: quest.awardExp,
      awardMoneyMinor: quest.awardMoneyMinor,
      awardRepObjectId: quest.awardRep?.objectId ?? null,
      awardRepAmount: quest.awardRep?.amount ?? null,
      awardRepCap: quest.awardRep?.cap ?? null,
    })),
  );
  await session.insert(npcQuests).values(
    quests.flatMap((quest) => [
      {
        releaseId,
        npcId: quest.npcId,
        questKey: quest.key,
        boardOrd: quest.boardOrd,
        pointId: quest.pointId,
        activeOnly: false,
        welcomeMessage: quest.welcomeOffer,
      },
      ...quest.boards.map((board) => ({
        releaseId,
        npcId: board.npcId,
        questKey: quest.key,
        boardOrd: board.boardOrd,
        pointId: board.pointId,
        activeOnly: board.activeOnly,
        welcomeMessage: board.welcomeMessage,
      })),
    ]),
  );
  const awards = quests.flatMap((quest) =>
    quest.awardItems.map((item) => ({
      releaseId,
      questKey: quest.key,
      artikulId: item.artikulId,
      count: item.count,
    })),
  );
  if (awards.length > 0) await session.insert(questAwardItems).values(awards);
  await insertGoals(session, releaseId, quests);
  await insertDialog(session, releaseId, quests);
  await insertOps(
    session,
    releaseId,
    quests.flatMap((quest) =>
      quest.scripts.onAccept.map((op, opOrd) => ({
        questKey: quest.key,
        hook: "on_accept" as const,
        ownerKey: "on_accept",
        opOrd,
        op,
      })),
    ),
  );
}

async function insertGoals(
  session: ReturnType<PostgresDatabase["session"]>,
  releaseId: string,
  quests: readonly QuestDocument[],
): Promise<void> {
  await session.insert(questGoals).values(
    quests.flatMap((quest) =>
      quest.goals.map((goal) => ({
        releaseId,
        questKey: quest.key,
        goalId: goal.id,
        kind: goal.kind,
        title: goal.title,
        goalOrd: goal.goalOrd,
        limitValue: goal.limit,
        actionId: goal.actionId,
        objectId: goal.objectId,
        waitingTitle: goal.waitingTitle,
        waitingDurationSec: goal.waitingDurationSec,
        waitingPopup: goal.waitingPopup,
      })),
    ),
  );
  const artikuls = quests.flatMap((quest) =>
    quest.goals.flatMap((goal) =>
      goal.artikuls.map((artikul) => ({
        releaseId,
        questKey: quest.key,
        goalId: goal.id,
        role: artikul.role,
        artikulId: artikul.artikulId,
      })),
    ),
  );
  if (artikuls.length > 0) await session.insert(questGoalArtikuls).values(artikuls);
  await insertOps(
    session,
    releaseId,
    quests.flatMap((quest) =>
      quest.goals.flatMap((goal) =>
        goal.onFinish.map((op, opOrd) => ({
          questKey: quest.key,
          hook: "goal_on_finish" as const,
          ownerKey: goal.id,
          opOrd,
          op,
        })),
      ),
    ),
  );
}

async function insertDialog(
  session: ReturnType<PostgresDatabase["session"]>,
  releaseId: string,
  quests: readonly QuestDocument[],
): Promise<void> {
  await session.insert(questDialogSteps).values(
    quests.flatMap((quest) =>
      quest.dialogSteps.map((step, stepOrd) => ({
        releaseId,
        questKey: quest.key,
        stepOrd,
        type: step.type,
        text: step.type === "reward" ? step.text : step.type === "player" ? step.text : step.text,
        stepId:
          step.type === "player"
            ? step.id
            : step.type === "reward"
              ? step.id
              : step.type === "goal"
                ? step.id
                : step.id,
        nextKey: step.type === "player" ? step.next : "",
        goalId: step.type === "goal" ? step.goal : "",
        answer: step.type === "reward" ? step.answer : "",
        toFight: step.type === "player" ? step.toFight : 0,
      })),
    ),
  );
  await insertOps(
    session,
    releaseId,
    quests.flatMap((quest) =>
      quest.dialogSteps.flatMap((step, stepOrd) => {
        if (step.type !== "player" && step.type !== "reward") return [];
        const hook = step.type === "reward" ? ("reward" as const) : ("dialog" as const);
        return step.scripts.map((op, opOrd) => ({
          questKey: quest.key,
          hook,
          ownerKey: String(stepOrd),
          opOrd,
          op,
        }));
      }),
    ),
  );
}

async function insertOps(
  session: ReturnType<PostgresDatabase["session"]>,
  releaseId: string,
  rows: readonly Readonly<{
    questKey: string;
    hook: "dialog" | "goal_on_finish" | "reward" | "on_accept";
    ownerKey: string;
    opOrd: number;
    op: QuestScriptOpDocument;
  }>[],
): Promise<void> {
  if (rows.length === 0) return;
  await session.insert(questScriptOps).values(rows.map((row) => opColumns(releaseId, row)));
  const roster = rows.flatMap((row) => {
    if (row.op.type !== "START_FIGHT" || !("mode" in row.op)) return [];
    return [
      ...row.op.enemies.map((entry, ord) => ({
        releaseId,
        questKey: row.questKey,
        hook: row.hook,
        ownerKey: row.ownerKey,
        side: "enemy" as const,
        ord,
        artikulId: entry.artikulId,
        count: entry.count,
      })),
      ...row.op.allies.map((entry, ord) => ({
        releaseId,
        questKey: row.questKey,
        hook: row.hook,
        ownerKey: row.ownerKey,
        side: "ally" as const,
        ord,
        artikulId: entry.artikulId,
        count: entry.count,
      })),
    ];
  });
  if (roster.length > 0) await session.insert(questScriptFightRoster).values(roster);
}

function opColumns(
  releaseId: string,
  row: Readonly<{
    questKey: string;
    hook: "dialog" | "goal_on_finish" | "reward" | "on_accept";
    ownerKey: string;
    opOrd: number;
    op: QuestScriptOpDocument;
  }>,
) {
  const base = {
    releaseId,
    questKey: row.questKey,
    hook: row.hook,
    ownerKey: row.ownerKey,
    opOrd: row.opOrd,
    type: row.op.type,
    artikulId: null as number | null,
    count: null as number | null,
    professionId: null as number | null,
    flag: null as string | null,
    value: null as string | null,
    text: null as string | null,
    goalId: null as string | null,
    fightMode: null as string | null,
    chatStart: null as string | null,
    chatWin: null as string | null,
    chatLose: null as string | null,
  };
  const op = row.op;
  if (op.type === "START_FIGHT") {
    if ("mode" in op) {
      return {
        ...base,
        fightMode: op.mode,
        chatStart: op.chatStart,
        chatWin: op.chatWin,
        chatLose: op.chatLose,
      };
    }
    return {
      ...base,
      artikulId: op.artikulId,
      value: "chance" in op && op.chance !== undefined ? String(op.chance) : null,
    };
  }
  if (op.type === "GRANT_ARTIKUL" || op.type === "REMOVE_ARTIKUL") {
    return { ...base, artikulId: op.artikulId, count: op.count };
  }
  if (op.type === "GRANT_PROFESSION") return { ...base, professionId: op.professionId };
  if (op.type === "MSG") return { ...base, text: op.text };
  if (op.type === "SET_FLAG") return { ...base, flag: op.flag, value: op.value };
  if (op.type === "CLEAR_FLAG") return { ...base, flag: op.flag };
  if (op.type === "BUMP_GOAL" || op.type === "COMPLETE_GOAL") return { ...base, goalId: op.goal };
  return base;
}
