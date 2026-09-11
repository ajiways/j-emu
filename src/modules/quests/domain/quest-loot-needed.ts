import type { QuestDocument } from "../../content/domain/content-quest.ts";
import type { HeroQuestGoal } from "./hero-quest.ts";
import { currentGoal } from "./prior-gate.ts";

export type QuestLootProgress = Readonly<{
  quest: QuestDocument;
  goals: readonly HeroQuestGoal[];
}>;

export function neededLoot(
  progress: readonly QuestLootProgress[],
  artikulId: number,
  ownedInBag: number,
): number | null {
  if (!Number.isInteger(artikulId) || artikulId < 1) {
    throw new Error("Loot artikul id is required");
  }
  if (!Number.isInteger(ownedInBag) || ownedInBag < 0) {
    throw new Error("Owned bag count is required");
  }
  const matching: number[] = [];
  for (const row of progress) {
    const current = currentGoal(row.quest, row.goals);
    if (!current || (current.kind !== "loot" && current.kind !== "deliver")) continue;
    if (!current.artikuls.some((item) => item.artikulId === artikulId)) continue;
    matching.push(Math.max(0, current.limit - ownedInBag));
  }
  if (matching.length === 0) return null;
  return Math.min(...matching);
}

export function capDropQuantity(candidate: number, needed: number | null): number {
  if (!Number.isInteger(candidate) || candidate < 0) {
    throw new Error("Drop quantity is required");
  }
  if (needed === null) return candidate;
  if (!Number.isInteger(needed) || needed < 0) {
    throw new Error("Needed loot count is required");
  }
  return Math.min(candidate, needed);
}
