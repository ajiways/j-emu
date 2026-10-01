import { historyOf } from "./battle-join.ts";
import { battleOpener } from "./battle-lookups.ts";
import type { BotFighter } from "./bot-fighter.ts";
import { primaryEnemyBot } from "./fight-bots.ts";
import type { FightRules } from "./fight-rules.ts";
import type { FightSetup } from "./fight-setup.ts";
import type { HumanFighter } from "./human-fighter.ts";
import { practiceHistoryOf } from "./practice-fight-history.ts";

export function questChatOf(
  setup: FightSetup,
  rules: FightRules,
): Readonly<{ chatWin: string; chatLose: string }> {
  if (!rules.includesQuestChat) {
    throw new Error("Quest chat requires FightRules.includesQuestChat");
  }
  return { chatWin: setup.meta.chatWin, chatLose: setup.meta.chatLose };
}

export function huntHistoryOf(
  humans: readonly HumanFighter[],
  bots: readonly BotFighter[],
  rules: FightRules,
) {
  return historyOf(battleOpener(humans), primaryEnemyBot(bots, rules.teamAssignment.enemyTeam));
}

export function practiceHistoryOfRules(humans: readonly HumanFighter[], rules: FightRules) {
  if (rules.historyRow !== "practice-humans") {
    throw new Error("Practice history is only available for a friendly duel");
  }
  return practiceHistoryOf(humans);
}
