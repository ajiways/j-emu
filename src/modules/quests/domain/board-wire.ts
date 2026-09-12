import type {
  NpcDocument,
  QuestBoardLinkDocument,
  QuestDocument,
} from "../../content/domain/content-quest.ts";
import type { HeroQuest, HeroQuestGoal } from "./hero-quest.ts";
import { currentGoal, goalsComplete } from "./prior-gate.ts";
import { primaryBoardLink } from "./npc-board-link.ts";

const OFFER_POINT_FLAGS = 8;
const PROGRESS_POINT_FLAGS = 0;

export type BoardRow = Readonly<{
  title: string;
  award_money: 0;
  award_money_type: 1;
  award_rep: "";
  award_exp: 0;
  level_min: number;
  level_max: number;
  flags: number;
  point_id: number;
  point_flags: number;
  welcome_message: string;
  key: string;
}>;

export function npcInfoBlock(npc: NpcDocument): Readonly<{
  status: 100;
  npc: Readonly<{
    id: number;
    title: string;
    picture: string;
    npc_description: string;
    elsetext: string;
  }>;
}> {
  return {
    status: 100,
    npc: {
      id: npc.infoId,
      title: npc.title,
      picture: npc.picture,
      npc_description: npc.description,
      elsetext: npc.elsetext,
    },
  };
}

export function boardRow(
  quest: QuestDocument,
  progress: HeroQuest | null,
  goals: readonly HeroQuestGoal[],
  link: QuestBoardLinkDocument = primaryBoardLink(quest),
): BoardRow | null {
  if (progress?.status === "done") return null;
  if (link.activeOnly) {
    if (progress?.status !== "active") return null;
    const current = currentGoal(quest, goals);
    if (!current || current.objectId !== link.npcId) return null;
  }
  const welcome = boardWelcome(quest, progress, goals, link);
  return {
    title: quest.title,
    award_money: 0,
    award_money_type: 1,
    award_rep: "",
    award_exp: 0,
    level_min: quest.levelMin,
    level_max: quest.levelMax,
    flags: quest.flags,
    point_id: link.pointId,
    point_flags: progress ? PROGRESS_POINT_FLAGS : OFFER_POINT_FLAGS,
    welcome_message: welcome,
    key: quest.key,
  };
}

export function npcQuestsBlock(
  npc: NpcDocument,
  rows: readonly BoardRow[],
): Readonly<{
  status: 100;
  quests: readonly BoardRow[];
  action_list: readonly [];
  macros_list: readonly [];
  href: Readonly<{ object: "npc"; action: "quests"; ref: number; action_user: false }>;
}> {
  return {
    status: 100,
    quests: rows,
    action_list: [],
    macros_list: [],
    href: { object: "npc", action: "quests", ref: npc.id, action_user: false },
  };
}

function boardWelcome(
  quest: QuestDocument,
  progress: HeroQuest | null,
  goals: readonly HeroQuestGoal[],
  link: QuestBoardLinkDocument,
): string {
  if (link.npcId !== quest.npcId || link.pointId !== quest.pointId) return link.welcomeMessage;
  if (!progress) return quest.welcomeOffer;
  if (goalsComplete(quest, goals)) return quest.welcomeReady;
  const current = currentGoal(quest, goals);
  return current?.title ? `${quest.welcomeActive} ${current.title}` : quest.welcomeActive;
}
