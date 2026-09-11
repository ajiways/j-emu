import type { HeroFact, HeroQuest, HeroQuestGoal, HeroQuestWaiting } from "../domain/hero-quest.ts";

export type NewHeroQuest = Readonly<{
  heroId: number;
  questKey: string;
  bookId: number;
  dialogStep: number;
  dialogCursor: string;
  startedAt: Date;
  hiddenInJournal: 0 | 1;
}>;

export type HeroQuestPatch = Readonly<{
  status?: "active" | "done";
  dialogStep?: number;
  dialogCursor?: string;
  waiting?: HeroQuestWaiting | null;
  finishedAt?: Date | null;
  hiddenInJournal?: 0 | 1;
}>;

export type HeroQuestGoalPatch = Readonly<{
  goalId: string;
  goalOrd: number;
  done: 0 | 1;
  value: number;
}>;

export interface HeroQuestRepository {
  lockHeroQuests(heroId: number): Promise<readonly HeroQuest[]>;
  find(heroId: number, questKey: string): Promise<HeroQuest | null>;
  insert(row: NewHeroQuest): Promise<HeroQuest>;
  update(heroId: number, questKey: string, patch: HeroQuestPatch): Promise<void>;
  delete(heroId: number, questKey: string): Promise<void>;
  hideInJournal(heroId: number, questKey: string): Promise<void>;
  goals(heroId: number, questKey: string): Promise<readonly HeroQuestGoal[]>;
  upsertGoals(heroId: number, questKey: string, rows: readonly HeroQuestGoalPatch[]): Promise<void>;
  saveGoal(row: HeroQuestGoal): Promise<void>;
  deleteGoals(heroId: number, questKey: string): Promise<void>;
  facts(heroId: number): Promise<readonly HeroFact[]>;
  setFact(heroId: number, factId: string, value: string): Promise<void>;
  clearFact(heroId: number, factId: string): Promise<void>;
  waiting(heroId: number): Promise<HeroQuest | null>;
}
