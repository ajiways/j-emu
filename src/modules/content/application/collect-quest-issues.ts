import {
  RADVEY_REPUTATION_OBJECT_ID,
  SUM_REPUTATION_OBJECT_ID,
} from "../../catalog/domain/reputation-ids.ts";
import type { ContentBundle } from "../domain/content-document.ts";
import type {
  QuestDocument,
  QuestGoalKind,
  QuestScriptOpDocument,
  QuestStartFightOpDocument,
} from "../domain/content-quest.ts";

const NPC_ID = 271;
const NPC_MULTI_ID = 272;
const BOARD_KEY = "q_engine_board";
const FIGHT_KEY = "q_engine_fight";
const AREA_KEY = "q_engine_area";
const AMBUSH_KEY = "q_engine_ambush";
const DAILY_KEY = "q_engine_daily";
const ROSTER_KEY = "q_engine_roster";
const MULTI_KEY = "q_engine_multi";
const AREA_ACTION_ID = 8;
const AREA_ITEM_ID = 3;
const AMBUSH_ACTION_ID = 9;
const AMBUSH_ITEM_ID = 1;
const NPC_ITEM_ID = 4;
const NPC_MULTI_ITEM_ID = 8;
const BLOCKED_HOTSPOT_ITEMS = new Set([1, 3, 5, 7]);
const FACT_ID = "engine_area";

const REQUIRED_KINDS: readonly QuestGoalKind[] = [
  "talk",
  "buy",
  "equip",
  "deliver",
  "kill",
  "loot",
  "win_fight",
  "area_action",
];

export function collectQuestIssues(bundle: ContentBundle): readonly string[] {
  const issues: string[] = [];
  const npcIds = new Set<number>();
  const spots = new Set<string>();
  for (const npc of bundle.npcs) {
    if (npcIds.has(npc.id)) issues.push(`duplicate npc ${npc.id}`);
    npcIds.add(npc.id);
    if (!bundle.areas.some((area) => area.id === npc.areaId)) {
      issues.push(`npc ${npc.id} area ${npc.areaId} is missing`);
    }
    const spot = `${npc.areaId}:${npc.itemId}`;
    if (spots.has(spot)) {
      issues.push(`two NPCs share area ${npc.areaId} item ${npc.itemId}`);
    }
    spots.add(spot);
    const clash = bundle.areaLinks.find(
      (link) => link.fromAreaId === npc.areaId && link.itemId === npc.itemId,
    );
    if (clash) issues.push(`npc ${npc.id} item ${npc.itemId} collides with a travel link`);
  }
  pushNpcIssues(issues, bundle, NPC_ID, NPC_ITEM_ID);
  pushNpcIssues(issues, bundle, NPC_MULTI_ID, NPC_MULTI_ITEM_ID);
  const keys = new Set<string>();
  const bookIds = new Set<number>();
  const pointIds = new Set<number>();
  const kinds = new Set<QuestGoalKind>();
  for (const quest of bundle.quests) {
    if (keys.has(quest.key)) issues.push(`duplicate quest ${quest.key}`);
    keys.add(quest.key);
    if (bookIds.has(quest.bookId)) issues.push(`duplicate quest book_id ${quest.bookId}`);
    bookIds.add(quest.bookId);
    pushPointId(issues, pointIds, quest.pointId, quest.key);
    if (!npcIds.has(quest.npcId)) issues.push(`quest ${quest.key} npc ${quest.npcId} is missing`);
    for (const board of quest.boards) {
      if (!npcIds.has(board.npcId)) {
        issues.push(`quest ${quest.key} board npc ${board.npcId} is missing`);
      }
      pushPointId(issues, pointIds, board.pointId, quest.key);
    }
    pushQuestRefIssues(issues, bundle, quest);
    for (const goal of quest.goals) kinds.add(goal.kind);
  }
  for (const key of [
    BOARD_KEY,
    FIGHT_KEY,
    AREA_KEY,
    AMBUSH_KEY,
    DAILY_KEY,
    ROSTER_KEY,
    MULTI_KEY,
  ]) {
    if (!keys.has(key)) issues.push(`quest ${key} is required`);
  }
  pushDailyFlagIssues(issues, bundle.quests);
  for (const kind of REQUIRED_KINDS) {
    if (!kinds.has(kind)) issues.push(`slice quests must include a ${kind} goal`);
  }
  const areaQuest = bundle.quests.find((row) => row.key === AREA_KEY);
  const areaGoal = areaQuest?.goals.find((goal) => goal.kind === "area_action");
  if (areaGoal && areaGoal.actionId !== AREA_ACTION_ID) {
    issues.push(`quest ${AREA_KEY} area_action id must be ${AREA_ACTION_ID}`);
  }
  if (areaGoal && areaGoal.objectId !== AREA_ITEM_ID) {
    issues.push(`quest ${AREA_KEY} area object id must be ${AREA_ITEM_ID}`);
  }
  if (areaGoal && !areaGoal.onFinish.some((op) => op.type === "START_FIGHT" && "mode" in op)) {
    issues.push(`quest ${AREA_KEY} area_action must start a quest fight`);
  }
  if (areaGoal && bundle.npcs.some((row) => row.itemId === AREA_ITEM_ID && row.areaId === "503")) {
    issues.push(`area item ${AREA_ITEM_ID} collides with an npc hotspot`);
  }
  const ambushQuest = bundle.quests.find((row) => row.key === AMBUSH_KEY);
  const ambushGoal = ambushQuest?.goals.find((goal) => goal.kind === "area_action");
  if (ambushGoal && ambushGoal.actionId !== AMBUSH_ACTION_ID) {
    issues.push(`quest ${AMBUSH_KEY} area_action id must be ${AMBUSH_ACTION_ID}`);
  }
  if (ambushGoal && ambushGoal.objectId !== AMBUSH_ITEM_ID) {
    issues.push(`quest ${AMBUSH_KEY} area object id must be ${AMBUSH_ITEM_ID}`);
  }
  const ambushFight = ambushGoal?.onFinish.find((op) => op.type === "START_FIGHT");
  if (
    !ambushFight ||
    ambushFight.type !== "START_FIGHT" ||
    "mode" in ambushFight ||
    ambushFight.artikulId !== 2
  ) {
    issues.push(`quest ${AMBUSH_KEY} area_action must start an ambush hunt vs bot 2`);
  }
  if (
    ambushGoal &&
    bundle.npcs.some((row) => row.itemId === AMBUSH_ITEM_ID && row.areaId === "503")
  ) {
    issues.push(`area item ${AMBUSH_ITEM_ID} collides with an npc hotspot`);
  }
  if (
    ambushGoal &&
    bundle.areaLinks.some((link) => link.fromAreaId === "503" && link.itemId === AMBUSH_ITEM_ID)
  ) {
    issues.push(`area item ${AMBUSH_ITEM_ID} collides with a travel link`);
  }
  const factIds = new Set<string>();
  for (const fact of bundle.worldFacts) {
    if (factIds.has(fact.id)) issues.push(`duplicate world fact ${fact.id}`);
    factIds.add(fact.id);
  }
  if (!factIds.has(FACT_ID)) issues.push(`world fact ${FACT_ID} is required`);
  const head = bundle.artifacts.find((row) => row.id === 584);
  const action = head ? Object.values(head.artifact_actions)[0] : undefined;
  if (!action || action.code !== "NPC" || action.param1 !== NPC_ID) {
    issues.push("artifact 584 must open NPC 271");
  }
  pushRosterQuestIssues(
    issues,
    bundle.quests.find((row) => row.key === ROSTER_KEY),
  );
  pushMultiQuestIssues(
    issues,
    bundle.quests.find((row) => row.key === MULTI_KEY),
  );
  return issues;
}

function pushNpcIssues(
  issues: string[],
  bundle: ContentBundle,
  npcId: number,
  itemId: number,
): void {
  const npc = bundle.npcs.find((row) => row.id === npcId);
  if (!npc) {
    issues.push(`npc ${npcId} is required`);
    return;
  }
  if (npc.infoId !== npcId) issues.push(`npc ${npcId} infoId must be ${npcId}`);
  if (npc.areaId !== "503") issues.push(`npc ${npcId} must stand in area 503`);
  if (npc.itemId !== itemId) issues.push(`npc ${npcId} itemId must be ${itemId}`);
  if (BLOCKED_HOTSPOT_ITEMS.has(npc.itemId)) {
    issues.push(`npc ${npcId} must not occupy item ${npc.itemId}`);
  }
}

function pushPointId(
  issues: string[],
  pointIds: Set<number>,
  pointId: number,
  questKey: string,
): void {
  if (pointIds.has(pointId)) issues.push(`duplicate quest point_id ${pointId}`);
  pointIds.add(pointId);
  if (!Number.isInteger(pointId) || pointId < 1) {
    issues.push(`quest ${questKey} point_id is required`);
  }
}

function pushDailyFlagIssues(issues: string[], quests: readonly QuestDocument[]): void {
  const dailies: string[] = [];
  for (const quest of quests) {
    if (!Number.isInteger(quest.flags) || quest.flags < 0) {
      issues.push(`quest ${quest.key} flags is required`);
      continue;
    }
    if ((quest.flags & 1) === 1) dailies.push(quest.key);
  }
  if (dailies.length !== 1) {
    issues.push("slice must contain exactly one quest with flags & 1");
  }
  const daily = quests.find((quest) => quest.key === DAILY_KEY);
  if (daily && (!Number.isInteger(daily.flags) || (daily.flags & 1) !== 1)) {
    issues.push(`quest ${DAILY_KEY} must have flags & 1`);
  }
  for (const key of [BOARD_KEY, FIGHT_KEY, AREA_KEY, AMBUSH_KEY, ROSTER_KEY, MULTI_KEY]) {
    const quest = quests.find((row) => row.key === key);
    if (quest && Number.isInteger(quest.flags) && (quest.flags & 1) === 1) {
      issues.push(`quest ${key} must not be daily`);
    }
  }
}

function pushQuestRefIssues(issues: string[], bundle: ContentBundle, quest: QuestDocument): void {
  const artifacts = new Set(bundle.artifacts.map((row) => row.id));
  const bots = new Set(bundle.bots.map((row) => row.id));
  const facts = new Set(bundle.worldFacts.map((row) => row.id));
  const tracks = new Set(bundle.reputationTracks.map((row) => row.objectId));
  for (const item of quest.awardItems) {
    if (!artifacts.has(item.artikulId)) {
      issues.push(`quest ${quest.key} award ${item.artikulId} is missing`);
    }
  }
  if (quest.awardRep) {
    if (quest.awardRep.objectId === SUM_REPUTATION_OBJECT_ID) {
      issues.push(`quest ${quest.key} awardRep must not grant track ${SUM_REPUTATION_OBJECT_ID}`);
    } else if (!tracks.has(quest.awardRep.objectId)) {
      issues.push(`quest ${quest.key} awardRep track ${quest.awardRep.objectId} is missing`);
    }
  }
  for (const goal of quest.goals) {
    if (goal.kind === "talk" && goal.objectId < 1) {
      issues.push(`quest ${quest.key} talk ${goal.id} objectId is required`);
    }
    for (const artikul of goal.artikuls) {
      if (!artifacts.has(artikul.artikulId) && !bots.has(artikul.artikulId)) {
        issues.push(`quest ${quest.key} goal ${goal.id} artikul ${artikul.artikulId} is missing`);
      }
    }
    pushScriptIssues(issues, bundle, quest.key, goal.onFinish, artifacts, facts);
  }
  pushScriptIssues(issues, bundle, quest.key, quest.scripts.onAccept, artifacts, facts);
  for (const step of quest.dialogSteps) {
    if (step.type !== "player" && step.type !== "reward") continue;
    pushScriptIssues(issues, bundle, quest.key, step.scripts, artifacts, facts);
  }
}

function pushScriptIssues(
  issues: string[],
  bundle: ContentBundle,
  questKey: string,
  ops: readonly QuestScriptOpDocument[],
  artifacts: Set<number>,
  facts: Set<string>,
): void {
  const bots = new Set(bundle.bots.map((bot) => bot.id));
  for (const op of ops) {
    if (op.type === "START_FIGHT") {
      if ("mode" in op) {
        for (const enemy of op.enemies) {
          if (!bots.has(enemy.artikulId)) {
            issues.push(`quest ${questKey} fight enemy ${enemy.artikulId} is missing`);
          }
        }
        for (const ally of op.allies) {
          if (!bots.has(ally.artikulId)) {
            issues.push(`quest ${questKey} fight ally ${ally.artikulId} is missing`);
          }
        }
      } else if (!bots.has(op.artikulId)) {
        issues.push(`quest ${questKey} ambush bot ${op.artikulId} is missing`);
      }
    }
    if (op.type === "GRANT_ARTIKUL" && !artifacts.has(op.artikulId)) {
      issues.push(`quest ${questKey} grant ${op.artikulId} is missing`);
    }
    if (op.type === "SET_FLAG" && !facts.has(op.flag)) {
      issues.push(`quest ${questKey} flag ${op.flag} is missing`);
    }
  }
}

function pushRosterQuestIssues(issues: string[], quest: QuestDocument | undefined): void {
  if (!quest) return;
  const fight = rosterStartFight(quest);
  if (!fight) {
    issues.push(`quest ${ROSTER_KEY} must start a roster fight`);
    return;
  }
  const enemyIds = fight.enemies.map((enemy) => enemy.artikulId);
  const allyIds = fight.allies.map((ally) => ally.artikulId);
  if (enemyIds.length !== 2 || enemyIds[0] !== 2 || enemyIds[1] !== 32) {
    issues.push(`quest ${ROSTER_KEY} enemies must be bot 2 then bot 32`);
  }
  if (allyIds.length !== 1 || allyIds[0] !== 4) {
    issues.push(`quest ${ROSTER_KEY} ally must be bot 4`);
  }
  if (!fight.chatStart) issues.push(`quest ${ROSTER_KEY} chatStart is required`);
  const kinds = quest.goals.map((goal) => goal.kind);
  if (kinds[0] !== "talk" || kinds[1] !== "win_fight" || kinds.includes("kill")) {
    issues.push(`quest ${ROSTER_KEY} goals must be talk then win_fight`);
  }
}

function pushMultiQuestIssues(issues: string[], quest: QuestDocument | undefined): void {
  if (!quest) return;
  if (quest.bookId !== 6) issues.push(`quest ${MULTI_KEY} bookId must be 6`);
  if (quest.flags !== 32) issues.push(`quest ${MULTI_KEY} flags must be 32`);
  if (quest.awardExp !== 6) issues.push(`quest ${MULTI_KEY} awardExp must be 6`);
  if (quest.npcId !== NPC_ID || quest.pointId !== 6 || quest.boardOrd !== 6) {
    issues.push(`quest ${MULTI_KEY} primary board must be NPC ${NPC_ID} point 6`);
  }
  const board = quest.boards[0];
  if (
    quest.boards.length !== 1 ||
    !board ||
    board.npcId !== NPC_MULTI_ID ||
    board.pointId !== 7 ||
    board.boardOrd !== 1 ||
    board.activeOnly !== true
  ) {
    issues.push(`quest ${MULTI_KEY} must link NPC ${NPC_MULTI_ID} as active_only`);
  }
  if (
    quest.awardRep?.objectId !== RADVEY_REPUTATION_OBJECT_ID ||
    quest.awardRep.amount !== 10 ||
    quest.awardRep.cap !== 0
  ) {
    issues.push(`quest ${MULTI_KEY} awardRep must be track 5 amount 10 cap 0`);
  }
  const acceptTypes = quest.scripts.onAccept.map((op) => op.type);
  if (!acceptTypes.includes("JUMP_AREA") || !acceptTypes.includes("GRANT_ARTIKUL")) {
    issues.push(`quest ${MULTI_KEY} onAccept must JUMP_AREA and GRANT_ARTIKUL`);
  }
  const talk = quest.goals.find((goal) => goal.kind === "talk");
  const win = quest.goals.find((goal) => goal.kind === "win_fight");
  if (!talk || talk.objectId !== NPC_MULTI_ID) {
    issues.push(`quest ${MULTI_KEY} talk objectId must be ${NPC_MULTI_ID}`);
  }
  if (!win || !win.onFinish.some((op) => op.type === "REMOVE_ARTIKUL")) {
    issues.push(`quest ${MULTI_KEY} win_fight must REMOVE_ARTIKUL`);
  }
}

function rosterStartFight(quest: QuestDocument): QuestStartFightOpDocument | null {
  for (const step of quest.dialogSteps) {
    if (step.type !== "player" && step.type !== "reward") continue;
    for (const op of step.scripts) {
      if (op.type === "START_FIGHT" && "mode" in op) return op;
    }
  }
  return null;
}
