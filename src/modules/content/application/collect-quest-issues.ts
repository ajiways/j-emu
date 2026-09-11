import type { ContentBundle } from "../domain/content-document.ts";
import type {
  QuestDocument,
  QuestGoalKind,
  QuestScriptOpDocument,
} from "../domain/content-quest.ts";

const NPC_ID = 271;
const BOARD_KEY = "q_engine_board";
const FIGHT_KEY = "q_engine_fight";
const AREA_KEY = "q_engine_area";
const DAILY_KEY = "q_engine_daily";
const AREA_ACTION_ID = 8;
const AREA_ITEM_ID = 3;
const NPC_ITEM_ID = 1;
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
  for (const npc of bundle.npcs) {
    if (npcIds.has(npc.id)) issues.push(`duplicate npc ${npc.id}`);
    npcIds.add(npc.id);
    if (!bundle.areas.some((area) => area.id === npc.areaId)) {
      issues.push(`npc ${npc.id} area ${npc.areaId} is missing`);
    }
    const clash = bundle.areaLinks.find(
      (link) => link.fromAreaId === npc.areaId && link.itemId === npc.itemId,
    );
    if (clash) issues.push(`npc ${npc.id} item ${npc.itemId} collides with a travel link`);
  }
  const npc = bundle.npcs.find((row) => row.id === NPC_ID);
  if (!npc) issues.push(`npc ${NPC_ID} is required`);
  else {
    if (npc.infoId !== NPC_ID) issues.push(`npc ${NPC_ID} infoId must be ${NPC_ID}`);
    if (npc.areaId !== "503") issues.push(`npc ${NPC_ID} must stand in area 503`);
    if (npc.itemId !== NPC_ITEM_ID) issues.push(`npc ${NPC_ID} itemId must be ${NPC_ITEM_ID}`);
    if (npc.title !== "Голова мертвеца") issues.push(`npc ${NPC_ID} title is wrong`);
  }
  const keys = new Set<string>();
  const bookIds = new Set<number>();
  const pointIds = new Set<number>();
  const kinds = new Set<QuestGoalKind>();
  for (const quest of bundle.quests) {
    if (keys.has(quest.key)) issues.push(`duplicate quest ${quest.key}`);
    keys.add(quest.key);
    if (bookIds.has(quest.bookId)) issues.push(`duplicate quest book_id ${quest.bookId}`);
    bookIds.add(quest.bookId);
    if (pointIds.has(quest.pointId)) issues.push(`duplicate quest point_id ${quest.pointId}`);
    pointIds.add(quest.pointId);
    if (!npcIds.has(quest.npcId)) issues.push(`quest ${quest.key} npc ${quest.npcId} is missing`);
    pushQuestRefIssues(issues, bundle, quest);
    for (const goal of quest.goals) kinds.add(goal.kind);
  }
  if (!keys.has(BOARD_KEY)) issues.push(`quest ${BOARD_KEY} is required`);
  if (!keys.has(FIGHT_KEY)) issues.push(`quest ${FIGHT_KEY} is required`);
  if (!keys.has(AREA_KEY)) issues.push(`quest ${AREA_KEY} is required`);
  if (!keys.has(DAILY_KEY)) issues.push(`quest ${DAILY_KEY} is required`);
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
  if (areaGoal && !areaGoal.onFinish.some((op) => op.type === "START_FIGHT")) {
    issues.push(`quest ${AREA_KEY} area_action must start a quest fight`);
  }
  if (areaGoal && bundle.npcs.some((row) => row.itemId === AREA_ITEM_ID && row.areaId === "503")) {
    issues.push(`area item ${AREA_ITEM_ID} collides with an npc hotspot`);
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
  return issues;
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
  for (const key of [BOARD_KEY, FIGHT_KEY, AREA_KEY]) {
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
  for (const item of quest.awardItems) {
    if (!artifacts.has(item.artikulId)) {
      issues.push(`quest ${quest.key} award ${item.artikulId} is missing`);
    }
  }
  for (const goal of quest.goals) {
    for (const artikul of goal.artikuls) {
      if (!artifacts.has(artikul.artikulId) && !bots.has(artikul.artikulId)) {
        issues.push(`quest ${quest.key} goal ${goal.id} artikul ${artikul.artikulId} is missing`);
      }
    }
    pushScriptIssues(issues, bundle, quest.key, goal.onFinish, artifacts, facts);
  }
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
      for (const enemy of op.enemies) {
        if (!bots.has(enemy.artikulId)) {
          issues.push(`quest ${questKey} fight enemy ${enemy.artikulId} is missing`);
        }
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
