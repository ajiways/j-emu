import { bumpMatchingGoal } from "../domain/bump-goal.ts";
import { currentGoal } from "../domain/prior-gate.ts";
import { neededLoot } from "../domain/quest-loot-needed.ts";
import { bagCountForGoal, itemGoalToSync, rewriteItemGoal } from "../domain/sync-item-goal.ts";
import { hasQuestStartFight } from "../domain/quest-start-fight.ts";
import { effectsWithoutLeftover } from "../domain/quest-script-leftover.ts";
import type { QuestScriptEffect } from "../domain/quest-script-effect.ts";
import type { HeroQuestRepository } from "../ports/hero-quest-repository.ts";
import type { QuestCatalog } from "../ports/quest-catalog.ts";
import type { QuestMutation } from "./quest-mutation.ts";

export async function completeParkedAreaFight(
  catalog: QuestCatalog,
  progress: HeroQuestRepository,
  heroId: number,
): Promise<QuestMutation> {
  const active = (await progress.lockHeroQuests(heroId)).filter((row) => row.status === "active");
  const effects: QuestScriptEffect[] = [];
  let bookDirty = false;
  let npcId = 0;
  for (const row of active) {
    const quest = await requireQuest(catalog, row.questKey);
    const goals = await progress.goals(heroId, quest.key);
    const current = currentGoal(quest, goals);
    if (!current || current.kind !== "area_action" || !hasQuestStartFight(current.onFinish)) {
      continue;
    }
    const bumped = bumpMatchingGoal(quest, goals, {
      kind: "area_action",
      actionId: current.actionId,
    });
    if (!bumped) continue;
    await progress.saveGoal(bumped.goal);
    effects.push(...effectsWithoutLeftover(bumped.onFinish));
    bookDirty = true;
    npcId = quest.npcId;
  }
  return { effects, bookDirty, npcId };
}

export async function neededForHero(
  catalog: QuestCatalog,
  progress: HeroQuestRepository,
  heroId: number,
  artikulId: number,
  ownedInBag: number,
): Promise<number | null> {
  const active = (await progress.lockHeroQuests(heroId)).filter((row) => row.status === "active");
  const rows = [];
  for (const row of active) {
    rows.push({
      quest: await requireQuest(catalog, row.questKey),
      goals: await progress.goals(heroId, row.questKey),
    });
  }
  return neededLoot(rows, artikulId, ownedInBag);
}

export async function syncOwnedGoals(
  catalog: QuestCatalog,
  progress: HeroQuestRepository,
  heroId: number,
  counts: ReadonlyMap<number, number>,
): Promise<QuestMutation> {
  const active = (await progress.lockHeroQuests(heroId)).filter((row) => row.status === "active");
  const effects: QuestScriptEffect[] = [];
  let bookDirty = false;
  let npcId = 0;
  for (const row of active) {
    const quest = await requireQuest(catalog, row.questKey);
    const goals = await progress.goals(heroId, quest.key);
    const target = itemGoalToSync(quest, goals);
    if (!target) continue;
    const rewritten = rewriteItemGoal(goals, target, bagCountForGoal(target, counts));
    if (!rewritten) continue;
    await progress.saveGoal(rewritten.goal);
    effects.push(...rewritten.onFinish);
    bookDirty = true;
    npcId = quest.npcId;
  }
  return { effects, bookDirty, npcId };
}

async function requireQuest(catalog: QuestCatalog, key: string) {
  const quest = await catalog.quest(key);
  if (!quest) throw new Error(`Quest ${key} is missing from the catalog`);
  return quest;
}
