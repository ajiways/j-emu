export type QuestGoalKind =
  "talk" | "kill" | "loot" | "buy" | "equip" | "deliver" | "area_action" | "win_fight";

export type QuestScriptOpDocument =
  | Readonly<{
      type: "START_FIGHT";
      mode: "quest";
      enemies: readonly Readonly<{ artikulId: number; count: number }>[];
      allies: readonly Readonly<{ artikulId: number; count: number }>[];
      chatStart: string;
      chatWin: string;
      chatLose: string;
    }>
  | Readonly<{ type: "GRANT_ARTIKUL"; artikulId: number; count: number }>
  | Readonly<{ type: "GRANT_PROFESSION"; professionId: number }>
  | Readonly<{ type: "REMOVE_ARTIKUL"; artikulId: number; count: number }>
  | Readonly<{ type: "MSG"; text: string }>
  | Readonly<{ type: "SET_FLAG"; flag: string; value: string }>
  | Readonly<{ type: "CLEAR_FLAG"; flag: string }>
  | Readonly<{ type: "BUMP_GOAL"; goal: string }>
  | Readonly<{ type: "COMPLETE_GOAL"; goal: string }>
  | Readonly<{ type: "GRANT_AWARDS" }>
  | Readonly<{ type: "JUMP_AREA" }>;

export type QuestDialogStepDocument =
  | Readonly<{ type: "npc" | "note" | "stage"; text: string; id: string }>
  | Readonly<{ type: "goal"; text: string; goal: string; id: string }>
  | Readonly<{
      type: "player";
      text: string;
      id: string;
      next: string;
      toFight: 0 | 1;
      scripts: readonly QuestScriptOpDocument[];
    }>
  | Readonly<{
      type: "reward";
      text: string;
      answer: string;
      id: string;
      scripts: readonly QuestScriptOpDocument[];
    }>;

export type QuestGoalArtikulDocument = Readonly<{
  role: "kill" | "buy" | "equip" | "loot" | "deliver" | "loot_mob";
  artikulId: number;
}>;

export type QuestGoalDocument = Readonly<{
  id: string;
  kind: QuestGoalKind;
  title: string;
  goalOrd: number;
  limit: number;
  artikuls: readonly QuestGoalArtikulDocument[];
  actionId: number;
  objectId: number;
  waitingTitle: string;
  waitingDurationSec: number;
  waitingPopup: string;
  onFinish: readonly QuestScriptOpDocument[];
}>;

export type QuestAwardItemDocument = Readonly<{ artikulId: number; count: number }>;

export type QuestAwardRepDocument = Readonly<{
  objectId: number;
  amount: number;
  cap: number;
}>;

export type QuestBoardLinkDocument = Readonly<{
  npcId: number;
  boardOrd: number;
  pointId: number;
  activeOnly: boolean;
  welcomeMessage: string;
}>;

type QuestScriptsDocument = Readonly<{
  onAccept: readonly QuestScriptOpDocument[];
}>;

export type NpcDocument = Readonly<{
  id: number;
  infoId: number;
  title: string;
  picture: string;
  description: string;
  elsetext: string;
  areaId: string;
  itemId: number;
}>;

export type WorldFactDocument = Readonly<{
  id: string;
  values: readonly string[];
}>;

export type QuestDocument = Readonly<{
  key: string;
  bookId: number;
  title: string;
  description: string;
  awardDescription: string;
  flags: number;
  levelMin: number;
  levelMax: number;
  npcId: number;
  pointId: number;
  boardOrd: number;
  welcomeOffer: string;
  welcomeActive: string;
  welcomeReady: string;
  awardExp: number;
  awardMoneyMinor: number;
  awardItems: readonly QuestAwardItemDocument[];
  awardRep?: QuestAwardRepDocument;
  boards: readonly QuestBoardLinkDocument[];
  scripts: QuestScriptsDocument;
  goals: readonly QuestGoalDocument[];
  dialogSteps: readonly QuestDialogStepDocument[];
}>;
