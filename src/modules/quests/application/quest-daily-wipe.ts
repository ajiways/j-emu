import type { Clock } from "../../../shared/kernel/clock.ts";
import {
  DAILY_CYCLE_RULES,
  isDailyQuest,
  lastMoscow6am,
  shouldWipeDailyProgress,
  unixOf,
  type DailyCycleRules,
} from "../domain/daily-cycle-rules.ts";
import { QuestDeniedError } from "../domain/quest-denied-error.ts";
import type { HeroQuestRepository } from "../ports/hero-quest-repository.ts";
import type { QuestCatalog } from "../ports/quest-catalog.ts";

export async function catchUpDailyCycle(
  catalog: QuestCatalog,
  progress: HeroQuestRepository,
  clock: Clock,
  heroId: number,
  rules: DailyCycleRules = DAILY_CYCLE_RULES,
): Promise<void> {
  if (!Number.isInteger(heroId) || heroId < 1) throw new Error("Hero id is required");
  const last6am = lastMoscow6am(clock.unixSeconds(), rules);
  const authored = await catalog.allQuests();
  const byKey = new Map(authored.map((quest) => [quest.key, quest]));
  for (const row of await progress.lockHeroQuests(heroId)) {
    const quest = byKey.get(row.questKey);
    if (!quest) throw new Error(`Quest ${row.questKey} is missing from the catalog`);
    if (
      !shouldWipeDailyProgress({
        flags: quest.flags,
        status: row.status,
        startedAtUnix: unixOf(row.startedAt, "quest startedAt"),
        finishedAtUnix: row.finishedAt ? unixOf(row.finishedAt, "quest finishedAt") : null,
        last6am,
      })
    ) {
      continue;
    }
    await progress.delete(heroId, row.questKey);
  }
}

export async function hideFinishedDaily(
  catalog: QuestCatalog,
  progress: HeroQuestRepository,
  heroId: number,
  bookId: number,
): Promise<void> {
  if (!Number.isInteger(heroId) || heroId < 1) throw new Error("Hero id is required");
  if (!Number.isInteger(bookId) || bookId < 1) {
    throw new QuestDeniedError("нет квеста");
  }
  const quests = await catalog.allQuests();
  const quest = quests.find((row) => row.bookId === bookId);
  if (!quest) throw new QuestDeniedError("квест не найден");
  if (!isDailyQuest(quest.flags)) return;
  const row = await progress.find(heroId, quest.key);
  if (!row || row.status !== "done") return;
  await progress.hideInJournal(heroId, quest.key);
}
